import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { query } from '@/lib/db';
import { LLMModel, ChatMessage, LLMConfig, KnowledgeBase } from '@/types';

// Interface para imagens extraídas da base de conhecimento
interface ExtractedImage {
  id: string;
  url: string;
  docTitle: string;
  position: number;
}

// Função para extrair imagens do conteúdo HTML
function extractImagesFromContent(content: string, docTitle: string, startIndex: number): { 
  cleanContent: string; 
  images: ExtractedImage[];
} {
  const images: ExtractedImage[] = [];
  let imageIndex = startIndex;
  
  // Regex para encontrar tags de imagem
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  
  // Substitui imagens por marcadores
  const cleanContent = content.replace(imgRegex, (match, src) => {
    const imageId = `[IMAGEM_${imageIndex}]`;
    images.push({
      id: imageId,
      url: src,
      docTitle: docTitle,
      position: imageIndex
    });
    imageIndex++;
    return imageId;
  });
  
  // Remove outras tags HTML mas mantém os marcadores
  const textContent = cleanContent
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return { cleanContent: textContent, images };
}

// Função para processar resposta do LLM e inserir imagens
function processResponseWithImages(response: string, images: ExtractedImage[]): {
  content: string;
  responseImages: string[];
} {
  const responseImages: string[] = [];
  let processedContent = response;
  
  // Encontra todos os marcadores de imagem na resposta
  const markerRegex = /\[IMAGEM_(\d+)\]/g;
  let match;
  
  while ((match = markerRegex.exec(response)) !== null) {
    const imageIndex = parseInt(match[1]);
    const image = images.find(img => img.position === imageIndex);
    if (image) {
      responseImages.push(image.url);
    }
  }
  
  // Remove os marcadores do texto (as imagens serão exibidas separadamente)
  processedContent = response.replace(markerRegex, '').replace(/\s+/g, ' ').trim();
  
  return { content: processedContent, responseImages };
}

// Função auxiliar para delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função para chamar a API do provedor com retry para rate limiting
async function callLLMProvider(
  model: LLMModel, 
  messages: { role: string; content: string | any[] }[],
  hasImages: boolean = false,
  retryCount: number = 0,
  maxRetries: number = 3
): Promise<string> {
  const { provider, modelo, api_key, api_url } = model;

  let url = '';
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let body: any = {};

  switch (provider) {
    case 'openai':
      url = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${api_key}`;
      body = {
        model: modelo,
        messages: messages,
        max_tokens: 4096,
      };
      break;

    case 'anthropic':
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = api_key || '';
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model: modelo,
        max_tokens: 4096,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content
        })),
      };
      // Adiciona system message separadamente para Anthropic
      const systemMsg = messages.find(m => m.role === 'system');
      if (systemMsg) {
        body.system = typeof systemMsg.content === 'string' ? systemMsg.content : systemMsg.content[0]?.text || '';
      }
      break;

    case 'deepseek':
      url = 'https://api.deepseek.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${api_key}`;
      body = {
        model: modelo,
        messages: messages,
        max_tokens: 4096,
      };
      break;

    case 'lmstudio':
      url = api_url || 'http://localhost:1234/v1/chat/completions';
      body = {
        model: modelo,
        messages: messages,
        max_tokens: 4096,
      };
      break;

    case 'openrouter':
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers['Authorization'] = `Bearer ${api_key}`;
      headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Base de Conhecimento';
      // Formato OpenRouter API REST: usa image_url com snake_case
      const openRouterMessages = messages.map(m => {
        if (Array.isArray(m.content)) {
          return {
            role: m.role,
            content: m.content.map((c: any) => {
              if (c.type === 'image_url') {
                const imgUrl = c.image_url?.url || c.imageUrl?.url || '';
                return {
                  type: 'image_url',
                  image_url: {
                    url: imgUrl
                  }
                };
              }
              return c;
            })
          };
        }
        return m;
      });
      body = {
        model: modelo,
        messages: openRouterMessages,
        max_tokens: 4096,
      };
      break;

    case 'ollama':
      url = api_url || 'http://localhost:11434/api/chat';
      body = {
        model: modelo,
        messages: messages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : m.content[0]?.text || '',
          images: hasImages && Array.isArray(m.content) 
            ? m.content.filter((c: any) => c.type === 'image_url').map((c: any) => c.image_url?.url?.split(',')[1])
            : undefined
        })),
        stream: false,
      };
      break;

    default:
      throw new Error(`Provedor não suportado: ${provider}`);
  }

  try {
    console.log('=== CHAMADA LLM ===');
    console.log('Provider:', provider);
    console.log('URL:', url);
    console.log('Model:', modelo);
    console.log('Has Images:', hasImages);
    console.log('Retry:', retryCount);
    console.log('Messages:', JSON.stringify(body.messages, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== ERRO DA API ===');
      console.error('Status:', response.status);
      console.error('Response:', errorText);
      
      // Retry automático para erro 429 (rate limiting)
      if (response.status === 429 && retryCount < maxRetries) {
        const waitTime = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s
        console.log(`Rate limited (429). Aguardando ${waitTime}ms antes de tentar novamente... (tentativa ${retryCount + 1}/${maxRetries})`);
        await delay(waitTime);
        return callLLMProvider(model, messages, hasImages, retryCount + 1, maxRetries);
      }
      
      // Mensagem de erro mais amigável para 429
      if (response.status === 429) {
        throw new Error('O serviço está temporariamente sobrecarregado. Por favor, aguarde alguns segundos e tente novamente.');
      }
      
      throw new Error(`Erro da API: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('=== RESPOSTA LLM ===');
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));

    // Extrai a resposta baseado no provedor
    switch (provider) {
      case 'openai':
      case 'deepseek':
      case 'lmstudio':
      case 'openrouter':
        return data.choices?.[0]?.message?.content || 'Sem resposta';
      case 'anthropic':
        return data.content?.[0]?.text || 'Sem resposta';
      case 'ollama':
        return data.message?.content || 'Sem resposta';
      default:
        return 'Sem resposta';
    }
  } catch (error) {
    console.error('Erro ao chamar LLM:', error);
    throw error;
  }
}

// Função para verificar se a pergunta precisa da base de conhecimento
async function checkIfNeedsKnowledge(
  model: LLMModel,
  userMessage: string,
  knowledgeTitles: string[]
): Promise<boolean> {
  const checkPrompt = `Você é um assistente que analisa perguntas. Sua tarefa é determinar se a pergunta do usuário precisa de informações de uma base de conhecimento corporativa para ser respondida.

DOCUMENTOS DISPONÍVEIS NA BASE DE CONHECIMENTO:
${knowledgeTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

PERGUNTA DO USUÁRIO: "${userMessage}"

Responda APENAS com "SIM" se a pergunta:
- Pede informações sobre procedimentos, processos ou documentação
- Pergunta sobre como fazer algo relacionado ao trabalho/empresa
- Solicita dados específicos que podem estar na base de conhecimento
- É uma dúvida técnica ou operacional

Responda APENAS com "NAO" se a pergunta:
- É uma saudação (oi, olá, bom dia, etc.)
- É uma despedida (tchau, até logo, etc.)
- É uma confirmação simples (ok, beleza, entendi, certo, etc.)
- É uma conversa casual não relacionada a trabalho
- É um agradecimento (obrigado, valeu, etc.)
- Não tem relação com os documentos disponíveis

Responda SOMENTE "SIM" ou "NAO", sem explicações.`;

  const messages = [
    { role: 'user', content: checkPrompt }
  ];

  try {
    const response = await callLLMProvider(model, messages, false);
    const answer = response.trim().toUpperCase();
    return answer.includes('SIM');
  } catch (error) {
    console.error('Erro ao verificar necessidade de KB:', error);
    // Em caso de erro, assume que precisa da base (comportamento seguro)
    return true;
  }
}

// Função para construir o prompt do sistema
function buildSystemPrompt(config: LLMConfig | null, knowledgeDescriptions: string, hasKnowledgeImages: boolean): string {
  const empresaNome = config?.nome_empresa || 'a empresa';
  
  let imageInstructions = '';
  if (hasKnowledgeImages) {
    imageInstructions = `
INSTRUÇÕES SOBRE IMAGENS:
- A base de conhecimento contém imagens marcadas como [IMAGEM_X] onde X é um número.
- Quando sua resposta precisar incluir uma imagem da base de conhecimento, USE O MARCADOR EXATO [IMAGEM_X] no local apropriado da sua resposta.
- Inclua as imagens NA ORDEM CORRETA conforme o passo-a-passo ou explicação.
- Coloque cada marcador de imagem em uma linha separada para melhor visualização.
- Exemplo de resposta com imagens:
  "Para realizar esta ação, siga os passos:
  
  1. Primeiro, acesse o menu principal
  [IMAGEM_1]
  
  2. Em seguida, clique no botão configurações
  [IMAGEM_2]"
`;
  }

  if (config?.prompt_sistema) {
    return config.prompt_sistema + '\n\n' + imageInstructions + '\n\n' + knowledgeDescriptions;
  }
  
  return `Você é um assistente virtual de ${empresaNome}. Sua função é ajudar os usuários respondendo perguntas com base na base de conhecimento da empresa.

DIRETRIZES IMPORTANTES:
1. Responda APENAS com base nas informações fornecidas na base de conhecimento.
2. Se a informação não estiver disponível na base de conhecimento, diga claramente que não possui essa informação.
3. NÃO invente, suponha ou crie informações que não estejam explicitamente na base de conhecimento.
4. Seja objetivo, claro e profissional nas respostas.
5. Se a pergunta não estiver relacionada ao conteúdo da base de conhecimento, informe educadamente que só pode ajudar com assuntos relacionados à documentação disponível.
${imageInstructions}
${knowledgeDescriptions}`;
}

// Função para construir prompt simples (sem base de conhecimento)
function buildSimplePrompt(config: LLMConfig | null): string {
  const empresaNome = config?.nome_empresa || 'a empresa';
  
  return `Você é um assistente virtual de ${empresaNome}.

REGRAS IMPORTANTES:
1. Seja BREVE e NATURAL nas respostas
2. Para saudações (oi, bom dia, olá), responda apenas com uma saudação curta e simples
3. Para confirmações (ok, beleza, entendi), responda de forma curta e natural
4. Para agradecimentos, responda brevemente
5. NÃO faça apresentações longas
6. NÃO use emojis excessivos
7. NÃO pergunte "como posso ajudar" repetidamente
8. Responda como uma pessoa normal responderia em uma conversa casual
9. Seja direto e conciso

Exemplos de respostas adequadas:
- "Bom dia" → "Bom dia! Tudo bem?"
- "Beleza" → "Certo!"
- "Ok, entendi" → "Perfeito!"
- "Obrigado" → "De nada!"`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const userId = (session.user as any).id;

  try {
    const { conversation_id, module_id, message, image_base64 } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    // Busca o modelo ativo
    const models = await query('SELECT * FROM llm_models WHERE ativo = TRUE LIMIT 1') as LLMModel[];
    
    if (models.length === 0) {
      return res.status(400).json({ error: 'Nenhum modelo LLM configurado. Contate o administrador.' });
    }

    const activeModel = models[0];

    // Busca configuração da empresa
    const configs = await query('SELECT * FROM llm_config ORDER BY id DESC LIMIT 1') as LLMConfig[];
    const config = configs.length > 0 ? configs[0] : null;

    if (!config) {
      return res.status(400).json({ error: 'Configuração da empresa não encontrada. Contate o administrador.' });
    }

    let conversationId = conversation_id;
    let moduleId = module_id;

    // Se não tem conversa, precisa do module_id para criar
    if (!conversationId) {
      if (!moduleId) {
        return res.status(400).json({ error: 'Módulo é obrigatório para iniciar uma conversa' });
      }

      // Busca o nome do módulo
      const modules = await query('SELECT nome FROM modules WHERE id = ?', [moduleId]) as any[];
      const moduleName = modules[0]?.nome || 'Módulo';

      const result = await query(
        'INSERT INTO chat_conversations (user_id, module_id, titulo) VALUES (?, ?, ?)',
        [userId, moduleId, `Chat - ${moduleName}`]
      ) as any;
      conversationId = result.insertId;
    } else {
      // Verifica se a conversa pertence ao usuário e pega o module_id
      const conversations = await query(
        'SELECT id, module_id FROM chat_conversations WHERE id = ? AND user_id = ?',
        [conversationId, userId]
      ) as any[];

      if (conversations.length === 0) {
        return res.status(404).json({ error: 'Conversa não encontrada' });
      }
      moduleId = conversations[0].module_id;
    }

    // Salva imagem se houver
    let imageUrl = null;
    if (image_base64 && activeModel.visualiza_imagem) {
      // Salva a imagem
      const fs = require('fs');
      const path = require('path');
      const { v4: uuidv4 } = require('uuid');
      
      const matches = image_base64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1];
        const base64Data = matches[2];
        const filename = `${uuidv4()}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images');
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        fs.writeFileSync(path.join(uploadDir, filename), base64Data, 'base64');
        imageUrl = `/uploads/images/${filename}`;
      }
    }

    // Salva a mensagem do usuário
    await query(
      'INSERT INTO chat_messages (conversation_id, role, content, image_url) VALUES (?, ?, ?, ?)',
      [conversationId, 'user', message, imageUrl]
    );

    // Busca toda a base de conhecimento do módulo
    const knowledgeBase = await query(
      `SELECT titulo, conteudo, tags FROM knowledge_base WHERE module_id = ?`,
      [moduleId]
    ) as KnowledgeBase[];

    // Extrai títulos para verificação
    const knowledgeTitles = knowledgeBase.map(kb => kb.titulo);

    // ETAPA 1: Verifica se a pergunta precisa da base de conhecimento
    const needsKnowledge = knowledgeBase.length > 0 
      ? await checkIfNeedsKnowledge(activeModel, message, knowledgeTitles)
      : false;

    console.log(`Pergunta: "${message}" - Precisa da base: ${needsKnowledge}`);

    // Extrai imagens e monta descrição da base de conhecimento (só se precisar)
    let knowledgeDescriptions = '';
    let allImages: ExtractedImage[] = [];
    let imageCounter = 1;
    let hasKnowledgeImages = false;
    
    if (needsKnowledge && knowledgeBase.length > 0) {
      knowledgeDescriptions = 'BASE DE CONHECIMENTO DISPONÍVEL:\n\n';
      knowledgeBase.forEach((kb, index) => {
        knowledgeDescriptions += `--- DOCUMENTO ${index + 1}: ${kb.titulo} ---\n`;
        if (kb.tags) {
          knowledgeDescriptions += `Tags: ${kb.tags}\n`;
        }
        
        // Extrai imagens e substitui por marcadores
        const { cleanContent, images } = extractImagesFromContent(
          kb.conteudo || '', 
          kb.titulo, 
          imageCounter
        );
        
        allImages = [...allImages, ...images];
        imageCounter += images.length;
        
        knowledgeDescriptions += `Conteúdo: ${cleanContent}\n\n`;
      });
      
      // Adiciona lista de imagens disponíveis
      if (allImages.length > 0) {
        knowledgeDescriptions += '\nIMAGENS DISPONÍVEIS NA BASE DE CONHECIMENTO:\n';
        allImages.forEach(img => {
          knowledgeDescriptions += `- ${img.id}: Imagem do documento "${img.docTitle}"\n`;
        });
        hasKnowledgeImages = true;
      }
    }

    // Constrói o prompt do sistema (com ou sem base de conhecimento)
    const systemPrompt = needsKnowledge 
      ? buildSystemPrompt(config, knowledgeDescriptions, hasKnowledgeImages)
      : buildSimplePrompt(config);

    // Busca histórico de mensagens para contexto (últimas 20 mensagens)
    const history = await query(
      'SELECT role, content, image_url FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20',
      [conversationId]
    ) as ChatMessage[];

    // Inverte para ordem cronológica
    history.reverse();

    // Prepara mensagens para o LLM
    const llmMessages: { role: string; content: string | any[] }[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Adiciona histórico
    for (const msg of history) {
      if (msg.image_url && activeModel.visualiza_imagem) {
        // Mensagem com imagem
        llmMessages.push({
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            { 
              type: 'image_url', 
              image_url: { 
                url: image_base64 || `${process.env.NEXTAUTH_URL}${msg.image_url}` 
              } 
            }
          ]
        });
      } else {
        llmMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // ETAPA 2: Chama o LLM com ou sem contexto da base
    const hasImages = history.some(m => m.image_url) || !!image_base64;
    const rawResponse = await callLLMProvider(activeModel, llmMessages, hasImages);

    // Processa a resposta para extrair imagens da base de conhecimento
    let assistantResponse = rawResponse;
    let responseImages: string[] = [];
    
    if (hasKnowledgeImages && needsKnowledge) {
      const processed = processResponseWithImages(rawResponse, allImages);
      // Mantém os marcadores no texto para renderização no frontend
      assistantResponse = rawResponse;
      responseImages = processed.responseImages;
    }

    // Salva a resposta do assistente
    await query(
      'INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [conversationId, 'assistant', assistantResponse]
    );

    // Atualiza o timestamp da conversa
    await query(
      'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    return res.status(200).json({
      conversation_id: conversationId,
      response: assistantResponse,
      image_url: imageUrl,
      knowledge_images: responseImages,
      all_knowledge_images: allImages.map(img => ({ id: img.id, url: img.url }))
    });

  } catch (error: any) {
    console.error('Erro ao processar mensagem:', error);
    return res.status(500).json({ 
      error: 'Erro ao processar mensagem', 
      details: error.message 
    });
  }
}

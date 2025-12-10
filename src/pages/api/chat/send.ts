import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { query } from '@/lib/db';
import { LLMModel, ChatMessage, LLMConfig, KnowledgeBase, Attachment } from '@/types';

// Configuração para aumentar limite do body (para imagens base64)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Interface para imagens extraídas da base de conhecimento
interface ExtractedImage {
  id: string;
  url: string;
  docTitle: string;
  position: number;
}

// Interface para anexos extraídos da base de conhecimento
interface ExtractedAttachment {
  id: string;
  url: string;
  name: string;
  docTitle: string;
  position: number;
}

// Função para extrair imagens do conteúdo HTML e converter para formato Markdown
function extractImagesFromContent(content: string, docTitle: string, startIndex: number, baseUrl: string): { 
  cleanContent: string; 
  images: ExtractedImage[];
} {
  const images: ExtractedImage[] = [];
  let imageIndex = startIndex;
  
  // Regex para encontrar tags de imagem
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  
  // Substitui imagens por formato Markdown com URL completa
  const cleanContent = content.replace(imgRegex, (match, src) => {
    // Garante que a URL seja absoluta
    let fullUrl = src;
    if (src.startsWith('/')) {
      fullUrl = `${baseUrl}${src}`;
    } else if (!src.startsWith('http')) {
      fullUrl = `${baseUrl}/${src}`;
    }
    
    const imageId = `[IMAGEM_${imageIndex}]`;
    images.push({
      id: imageId,
      url: fullUrl,
      docTitle: docTitle,
      position: imageIndex
    });
    imageIndex++;
    // Retorna formato Markdown com URL completa
    return `\n![Imagem ${imageIndex - 1} - ${docTitle}](${fullUrl})\n`;
  });
  
  // Remove outras tags HTML mas mantém as imagens em Markdown
  const textContent = cleanContent
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*(!\[)/g, '\n\n$1') // Garante quebra de linha antes das imagens
    .replace(/(\))\s*/g, '$1\n\n') // Garante quebra de linha depois das imagens
    .trim();
  
  return { cleanContent: textContent, images };
}

// Função para processar resposta do LLM - agora apenas extrai URLs das imagens para referência
function processResponseWithImages(response: string, images: ExtractedImage[]): {
  content: string;
  responseImages: string[];
} {
  const responseImages: string[] = [];
  
  // Encontra todas as imagens em formato Markdown na resposta
  const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  
  while ((match = markdownImageRegex.exec(response)) !== null) {
    responseImages.push(match[1]);
  }
  
  // Mantém o conteúdo como está (com as imagens em Markdown)
  return { content: response, responseImages };
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

// Função para selecionar documentos relevantes baseado nos títulos
async function selectRelevantDocuments(
  model: LLMModel,
  userMessage: string,
  knowledgeTitles: string[]
): Promise<string[]> {
  const selectPrompt = `Você é um assistente que seleciona documentos relevantes. Analise a pergunta do usuário e selecione APENAS os documentos que são relevantes para responder.

DOCUMENTOS DISPONÍVEIS (títulos):
${knowledgeTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

PERGUNTA DO USUÁRIO: "${userMessage}"

INSTRUÇÕES:
- Analise cuidadosamente a pergunta e os títulos dos documentos
- Selecione APENAS os documentos cujo conteúdo provavelmente ajudará a responder a pergunta
- Seja criterioso: não selecione documentos que não têm relação clara com a pergunta
- Se nenhum documento parecer relevante, retorne "NENHUM"

RESPONDA APENAS com os títulos dos documentos relevantes, um por linha, EXATAMENTE como aparecem na lista acima.
Não adicione números, explicações ou qualquer outro texto.`;

  const messages = [
    { role: 'user', content: selectPrompt }
  ];

  try {
    const response = await callLLMProvider(model, messages, false);
    const answer = response.trim();
    
    console.log('=== SELEÇÃO DE DOCUMENTOS ===');
    console.log('Resposta do LLM:', answer);
    
    // Se retornou "NENHUM", retorna array vazio
    if (answer.toUpperCase() === 'NENHUM') {
      return [];
    }
    
    // Extrai os títulos da resposta
    const selectedTitles = answer
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      // Remove possíveis números no início (ex: "1. Título" -> "Título")
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      // Filtra apenas títulos que existem na lista original
      .filter(title => knowledgeTitles.some(kt => 
        kt.toLowerCase() === title.toLowerCase() ||
        kt.toLowerCase().includes(title.toLowerCase()) ||
        title.toLowerCase().includes(kt.toLowerCase())
      ));
    
    // Mapeia para os títulos originais (mantendo case correto)
    const matchedTitles = selectedTitles.map(selected => {
      const match = knowledgeTitles.find(kt => 
        kt.toLowerCase() === selected.toLowerCase() ||
        kt.toLowerCase().includes(selected.toLowerCase()) ||
        selected.toLowerCase().includes(kt.toLowerCase())
      );
      return match || selected;
    });
    
    // Remove duplicatas
    const uniqueTitles = Array.from(new Set(matchedTitles));
    
    console.log('Títulos selecionados:', uniqueTitles);
    
    return uniqueTitles;
  } catch (error) {
    console.error('Erro ao selecionar documentos relevantes:', error);
    // Em caso de erro, retorna todos os títulos (comportamento seguro)
    return knowledgeTitles;
  }
}

// Função para gerar título da conversa baseado na primeira mensagem
async function generateConversationTitle(
  model: LLMModel,
  userMessage: string,
  moduleName: string,
  systemName: string
): Promise<string> {
  const titlePrompt = `Você é um assistente que cria títulos curtos e descritivos para conversas.

CONTEXTO:
- Módulo: ${moduleName}${systemName ? ` - ${systemName}` : ''}
- Primeira mensagem do usuário: "${userMessage}"

INSTRUÇÕES:
- Crie um título CURTO (máximo 50 caracteres) que descreva o assunto da conversa
- O título deve ser claro e objetivo
- NÃO use aspas no título
- NÃO inclua prefixos como "Título:" ou "Assunto:"
- Apenas retorne o título, nada mais

EXEMPLO:
Se a mensagem for "Como cadastrar um cliente no sistema?", um bom título seria: "Cadastro de Cliente"`;

  const messages = [
    { role: 'user', content: titlePrompt }
  ];

  try {
    const response = await callLLMProvider(model, messages, false);
    let title = response.trim();
    
    // Remove aspas se houver
    title = title.replace(/^["']|["']$/g, '');
    
    // Limita a 50 caracteres
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    console.log('=== TÍTULO GERADO ===');
    console.log('Título:', title);
    
    return title;
  } catch (error) {
    console.error('Erro ao gerar título:', error);
    // Em caso de erro, retorna título padrão
    return `Chat - ${moduleName}${systemName ? ` - ${systemName}` : ''}`;
  }
}

// Função para construir o prompt do sistema
function buildSystemPrompt(config: LLMConfig | null, knowledgeDescriptions: string, hasKnowledgeImages: boolean, hasKnowledgeAttachments: boolean = false): string {
  const empresaNome = config?.nome_empresa || 'a empresa';
  
  let imageInstructions = '';
  if (hasKnowledgeImages) {
    imageInstructions = `
INSTRUÇÕES SOBRE IMAGENS:
- A base de conhecimento contém imagens no formato Markdown: ![descrição](URL)
- Quando sua resposta precisar incluir uma imagem da base de conhecimento, COPIE EXATAMENTE a sintaxe Markdown da imagem como ela aparece no conteúdo.
- Inclua as imagens NA ORDEM CORRETA conforme o passo-a-passo ou explicação.
- Coloque cada imagem em uma linha separada para melhor visualização.
- IMPORTANTE: Mantenha a URL completa da imagem exatamente como está no conteúdo.
`;
  }

  let attachmentInstructions = '';
  if (hasKnowledgeAttachments) {
    attachmentInstructions = `
INSTRUÇÕES SOBRE ANEXOS/DOCUMENTOS:
- A base de conhecimento contém anexos (arquivos) marcados como [ANEXO_X] onde X é um número.
- SOMENTE use marcadores [ANEXO_X] se o anexo foi EXPLICITAMENTE listado na seção "ANEXOS DISPONÍVEIS NA BASE DE CONHECIMENTO" acima.
- NÃO invente ou mencione anexos que não existem na lista.
- Se não houver anexos listados, NÃO mencione anexos na resposta.
- Quando sua resposta precisar de um anexo que EXISTE na lista, USE O MARCADOR EXATO [ANEXO_X].
`;
  }

  if (config?.prompt_sistema) {
    return config.prompt_sistema + '\n\n' + imageInstructions + attachmentInstructions + '\n\n' + knowledgeDescriptions;
  }
  
  return `Você é um assistente virtual de ${empresaNome}. Sua função é ajudar os usuários respondendo perguntas com base na base de conhecimento da empresa.

DIRETRIZES IMPORTANTES:
1. Responda APENAS com base nas informações fornecidas na base de conhecimento.
2. Se a informação não estiver disponível na base de conhecimento, diga claramente que não possui essa informação.
3. NÃO invente, suponha ou crie informações que não estejam explicitamente na base de conhecimento.
4. NÃO mencione anexos [ANEXO_X] a menos que eles estejam EXPLICITAMENTE listados na seção de anexos disponíveis.
5. Seja objetivo, claro e profissional nas respostas.
6. Se a pergunta não estiver relacionada ao conteúdo da base de conhecimento, informe educadamente que só pode ajudar com assuntos relacionados à documentação disponível.
${imageInstructions}
${attachmentInstructions}
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
    const { conversation_id, module_id, system_id, message, image_base64, file_url, file_name } = req.body;

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
    let systemId = system_id;

    // Flag para indicar se é uma nova conversa (para gerar título por IA)
    let isNewConversation = false;
    let moduleName = '';
    let systemName = '';

    // Se não tem conversa, precisa do module_id para criar
    if (!conversationId) {
      if (!moduleId) {
        return res.status(400).json({ error: 'Módulo é obrigatório para iniciar uma conversa' });
      }

      // Busca o nome do módulo e sistema
      const modules = await query('SELECT nome FROM modules WHERE id = ?', [moduleId]) as any[];
      moduleName = modules[0]?.nome || 'Módulo';
      
      if (systemId) {
        const systems = await query('SELECT nome FROM systems WHERE id = ?', [systemId]) as any[];
        systemName = systems[0]?.nome || '';
      }

      // Cria conversa com título temporário (será atualizado após gerar título por IA)
      const result = await query(
        'INSERT INTO chat_conversations (user_id, module_id, system_id, titulo) VALUES (?, ?, ?, ?)',
        [userId, moduleId, systemId || null, `Chat - ${moduleName}${systemName ? ` - ${systemName}` : ''}`]
      ) as any;
      conversationId = result.insertId;
      isNewConversation = true;
    } else {
      // Verifica se a conversa pertence ao usuário e pega o module_id e system_id
      const conversations = await query(
        'SELECT id, module_id, system_id FROM chat_conversations WHERE id = ? AND user_id = ?',
        [conversationId, userId]
      ) as any[];

      if (conversations.length === 0) {
        return res.status(404).json({ error: 'Conversa não encontrada' });
      }
      moduleId = conversations[0].module_id;
      systemId = conversations[0].system_id;
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
      'INSERT INTO chat_messages (conversation_id, role, content, image_url, file_url, file_name) VALUES (?, ?, ?, ?, ?, ?)',
      [conversationId, 'user', message, imageUrl, file_url || null, file_name || null]
    );

    // Busca toda a base de conhecimento do módulo/sistema
    let knowledgeQuery = `SELECT id, titulo, conteudo, tags FROM knowledge_base WHERE module_id = ?`;
    let knowledgeParams: any[] = [moduleId];
    
    if (systemId) {
      knowledgeQuery += ` AND system_id = ?`;
      knowledgeParams.push(systemId);
    }
    
    const knowledgeBase = await query(knowledgeQuery, knowledgeParams) as (KnowledgeBase & { id: number })[];

    // Busca anexos de todos os documentos do módulo/sistema
    let attachmentsQuery = `SELECT a.*, kb.titulo as doc_titulo 
       FROM attachments a 
       INNER JOIN knowledge_base kb ON a.knowledge_id = kb.id 
       WHERE kb.module_id = ?`;
    let attachmentsParams: any[] = [moduleId];
    
    if (systemId) {
      attachmentsQuery += ` AND kb.system_id = ?`;
      attachmentsParams.push(systemId);
    }
    
    const allAttachmentsFromDB = await query(attachmentsQuery, attachmentsParams) as (Attachment & { doc_titulo: string })[];

    // Extrai títulos para verificação
    const knowledgeTitles = knowledgeBase.map(kb => kb.titulo);

    // ETAPA 1: Verifica se a pergunta precisa da base de conhecimento
    const needsKnowledge = knowledgeBase.length > 0 
      ? await checkIfNeedsKnowledge(activeModel, message, knowledgeTitles)
      : false;

    console.log(`Pergunta: "${message}" - Precisa da base: ${needsKnowledge}`);

    // ETAPA 2: Se precisa da base, seleciona apenas os documentos relevantes
    let relevantTitles: string[] = [];
    let filteredKnowledgeBase: (KnowledgeBase & { id: number })[] = [];
    
    if (needsKnowledge && knowledgeBase.length > 0) {
      relevantTitles = await selectRelevantDocuments(activeModel, message, knowledgeTitles);
      console.log(`Documentos relevantes selecionados: ${relevantTitles.length} de ${knowledgeBase.length}`);
      
      // Filtra a base de conhecimento para incluir apenas os documentos relevantes
      if (relevantTitles.length > 0) {
        filteredKnowledgeBase = knowledgeBase.filter(kb => 
          relevantTitles.some(title => 
            kb.titulo.toLowerCase() === title.toLowerCase() ||
            kb.titulo.toLowerCase().includes(title.toLowerCase()) ||
            title.toLowerCase().includes(kb.titulo.toLowerCase())
          )
        );
      } else {
        // Se nenhum documento foi selecionado, usa todos (fallback seguro)
        filteredKnowledgeBase = knowledgeBase;
        console.log('Nenhum documento específico selecionado, usando toda a base.');
      }
    }

    // Obtém a URL base do servidor para construir URLs absolutas das imagens
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Extrai imagens e monta descrição da base de conhecimento (só se precisar)
    let knowledgeDescriptions = '';
    let allImages: ExtractedImage[] = [];
    let allAttachments: ExtractedAttachment[] = [];
    let imageCounter = 1;
    let attachmentCounter = 1;
    let hasKnowledgeImages = false;
    let hasKnowledgeAttachments = false;
    
    if (needsKnowledge && filteredKnowledgeBase.length > 0) {
      knowledgeDescriptions = `BASE DE CONHECIMENTO DISPONÍVEL (${filteredKnowledgeBase.length} documento(s) relevante(s)):\n\n`;
      filteredKnowledgeBase.forEach((kb, index) => {
        knowledgeDescriptions += `--- DOCUMENTO ${index + 1}: ${kb.titulo} ---\n`;
        if (kb.tags) {
          knowledgeDescriptions += `Tags: ${kb.tags}\n`;
        }
        
        // Extrai imagens e converte para formato Markdown com URLs absolutas
        const { cleanContent, images } = extractImagesFromContent(
          kb.conteudo || '', 
          kb.titulo, 
          imageCounter,
          baseUrl
        );
        
        allImages = [...allImages, ...images];
        imageCounter += images.length;
        
        // Busca anexos deste documento
        const docAttachments = allAttachmentsFromDB.filter(a => a.knowledge_id === kb.id);
        if (docAttachments.length > 0) {
          knowledgeDescriptions += `Anexos disponíveis:\n`;
          docAttachments.forEach(att => {
            const attachId = `[ANEXO_${attachmentCounter}]`;
            // Garante que a URL seja válida
            let attachUrl = att.file_path;
            if (attachUrl && !attachUrl.startsWith('http') && !attachUrl.startsWith('/')) {
              attachUrl = '/' + attachUrl;
            }
            allAttachments.push({
              id: attachId,
              url: attachUrl,
              name: att.original_name,
              docTitle: kb.titulo,
              position: attachmentCounter
            });
            knowledgeDescriptions += `- ${attachId}: ${att.original_name}\n`;
            attachmentCounter++;
          });
        }
        
        knowledgeDescriptions += `Conteúdo: ${cleanContent}\n\n`;
      });
      
      // Marca que há imagens disponíveis (já estão no formato Markdown no conteúdo)
      if (allImages.length > 0) {
        hasKnowledgeImages = true;
      }
      
      // Adiciona lista de anexos disponíveis
      if (allAttachments.length > 0) {
        knowledgeDescriptions += '\nANEXOS DISPONÍVEIS NA BASE DE CONHECIMENTO:\n';
        allAttachments.forEach(att => {
          knowledgeDescriptions += `- ${att.id}: "${att.name}" do documento "${att.docTitle}"\n`;
        });
        knowledgeDescriptions += '\nQuando mencionar um anexo, USE O MARCADOR EXATO [ANEXO_X] para que o usuário possa baixá-lo.\n';
        hasKnowledgeAttachments = true;
      }
    }

    // Constrói o prompt do sistema (com ou sem base de conhecimento)
    const systemPrompt = needsKnowledge 
      ? buildSystemPrompt(config, knowledgeDescriptions, hasKnowledgeImages, hasKnowledgeAttachments)
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

    // Verifica se o modelo realmente suporta imagens
    const modelSupportsImages = !!activeModel.visualiza_imagem;

    // Adiciona histórico
    for (const msg of history) {
      if (msg.image_url && modelSupportsImages) {
        // Mensagem com imagem - converte para base64 se for URL local
        let imageData = image_base64;
        
        if (!imageData && msg.image_url) {
          // Lê a imagem do disco e converte para base64
          try {
            const fs = require('fs');
            const path = require('path');
            const imagePath = path.join(process.cwd(), 'public', msg.image_url);
            
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath);
              const ext = path.extname(msg.image_url).slice(1).toLowerCase();
              const mimeType = ext === 'jpg' ? 'jpeg' : ext;
              imageData = `data:image/${mimeType};base64,${imageBuffer.toString('base64')}`;
            }
          } catch (err) {
            console.error('Erro ao ler imagem do disco:', err);
          }
        }
        
        if (imageData) {
          llmMessages.push({
            role: msg.role,
            content: [
              { type: 'text', text: msg.content },
              { 
                type: 'image_url', 
                image_url: { 
                  url: imageData
                } 
              }
            ]
          });
        } else {
          // Se não conseguiu carregar a imagem, envia só o texto
          llmMessages.push({ role: msg.role, content: msg.content });
        }
      } else if (msg.image_url && !modelSupportsImages) {
        // Modelo não suporta imagens - envia texto informando que há uma imagem
        llmMessages.push({ 
          role: msg.role, 
          content: msg.content + '\n[O usuário enviou uma imagem, mas este modelo não suporta visualização de imagens]'
        });
      } else {
        llmMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // ETAPA 3: Chama o LLM com ou sem contexto da base
    const hasImages = modelSupportsImages && (history.some(m => m.image_url) || !!image_base64);
    
    let rawResponse: string;
    try {
      rawResponse = await callLLMProvider(activeModel, llmMessages, hasImages);
    } catch (error: any) {
      // Se o erro for relacionado a imagens não suportadas, tenta novamente sem imagens
      if (error.message?.includes('image') || error.message?.includes('No endpoints found')) {
        console.log('Modelo não suporta imagens, tentando novamente sem imagens...');
        
        // Remove imagens das mensagens
        const messagesWithoutImages = llmMessages.map(m => {
          if (Array.isArray(m.content)) {
            const textContent = m.content.find((c: any) => c.type === 'text');
            return {
              role: m.role,
              content: textContent?.text || ''
            };
          }
          return m;
        });
        
        rawResponse = await callLLMProvider(activeModel, messagesWithoutImages, false);
      } else {
        throw error;
      }
    }

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

    // Se é uma nova conversa, gera título por IA baseado na primeira mensagem
    let generatedTitle = null;
    if (isNewConversation) {
      try {
        generatedTitle = await generateConversationTitle(activeModel, message, moduleName, systemName);
        // Atualiza o título da conversa
        await query(
          'UPDATE chat_conversations SET titulo = ? WHERE id = ?',
          [generatedTitle, conversationId]
        );
      } catch (titleError) {
        console.error('Erro ao gerar título da conversa:', titleError);
        // Mantém o título padrão em caso de erro
      }
    }

    // IDs dos documentos que foram realmente enviados ao modelo
    const usedKnowledgeIds = filteredKnowledgeBase.map(kb => kb.id);

    return res.status(200).json({
      conversation_id: conversationId,
      response: assistantResponse,
      image_url: imageUrl,
      file_url: file_url || null,
      file_name: file_name || null,
      knowledge_images: responseImages,
      all_knowledge_images: allImages.map(img => ({ id: img.id, url: img.url })),
      all_knowledge_attachments: allAttachments.map(att => ({ id: att.id, url: att.url, name: att.name })),
      used_knowledge_ids: usedKnowledgeIds,
      generated_title: generatedTitle
    });

  } catch (error: any) {
    console.error('Erro ao processar mensagem:', error);
    return res.status(500).json({ 
      error: 'Erro ao processar mensagem', 
      details: error.message 
    });
  }
}

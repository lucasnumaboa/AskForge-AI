import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { query } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const user = session.user as any;

  if (req.method === 'POST') {
    try {
      const { conversation_id, user_message, assistant_response, feedback, used_knowledge_ids } = req.body;

      // Validações
      if (!conversation_id) {
        return res.status(400).json({ error: 'ID da conversa é obrigatório' });
      }

      if (!user_message || !assistant_response) {
        return res.status(400).json({ error: 'Mensagem do usuário e resposta do assistente são obrigatórios' });
      }

      if (!feedback || !['positive', 'negative'].includes(feedback)) {
        return res.status(400).json({ error: 'Feedback deve ser "positive" ou "negative"' });
      }

      // Verifica se a conversa pertence ao usuário e busca module_id e system_id
      const conversations = await query<any[]>(
        'SELECT id, module_id, system_id FROM chat_conversations WHERE id = ? AND user_id = ?',
        [conversation_id, user.id]
      );

      if (conversations.length === 0) {
        return res.status(404).json({ error: 'Conversa não encontrada' });
      }

      const { module_id, system_id } = conversations[0];

      // Busca toda a conversa até o momento
      const messages = await query<any[]>(
        `SELECT role, content, created_at FROM chat_messages 
         WHERE conversation_id = ? 
         ORDER BY created_at ASC`,
        [conversation_id]
      );

      // Formata o histórico da conversa como JSON
      const conversationHistory = JSON.stringify(messages);

      // Busca a base de conhecimento que foi realmente enviada ao modelo
      let knowledgeBaseSent: string | null = null;
      
      // Se temos os IDs dos documentos usados, busca apenas esses
      if (used_knowledge_ids && Array.isArray(used_knowledge_ids) && used_knowledge_ids.length > 0) {
        const placeholders = used_knowledge_ids.map(() => '?').join(',');
        const knowledgeBase = await query<any[]>(
          `SELECT id, titulo, conteudo, tags FROM knowledge_base WHERE id IN (${placeholders})`,
          used_knowledge_ids
        );

        if (knowledgeBase.length > 0) {
          const kbSummary = knowledgeBase.map((kb: any) => ({
            id: kb.id,
            titulo: kb.titulo,
            tags: kb.tags,
            conteudo_preview: kb.conteudo ? kb.conteudo.substring(0, 500) + (kb.conteudo.length > 500 ? '...' : '') : ''
          }));
          knowledgeBaseSent = JSON.stringify(kbSummary);
        }
      } else {
        // Fallback: busca toda a base do módulo/sistema (comportamento antigo)
        let knowledgeQuery = `SELECT id, titulo, conteudo, tags FROM knowledge_base WHERE module_id = ?`;
        let knowledgeParams: any[] = [module_id];
        
        if (system_id) {
          knowledgeQuery += ` AND system_id = ?`;
          knowledgeParams.push(system_id);
        }
        
        const knowledgeBase = await query<any[]>(knowledgeQuery, knowledgeParams);

        if (knowledgeBase.length > 0) {
          const kbSummary = knowledgeBase.map((kb: any) => ({
            id: kb.id,
            titulo: kb.titulo,
            tags: kb.tags,
            conteudo_preview: kb.conteudo ? kb.conteudo.substring(0, 500) + (kb.conteudo.length > 500 ? '...' : '') : ''
          }));
          knowledgeBaseSent = JSON.stringify(kbSummary);
        }
      }

      // Verifica se já existe feedback para esta combinação de mensagem/resposta
      const existingFeedback = await query<any[]>(
        `SELECT id FROM chat_feedback 
         WHERE conversation_id = ? AND user_id = ? 
         AND user_message = ? AND assistant_response = ?`,
        [conversation_id, user.id, user_message, assistant_response]
      );

      if (existingFeedback.length > 0) {
        // Atualiza o feedback existente (incluindo histórico atualizado)
        await query(
          `UPDATE chat_feedback 
           SET feedback = ?, conversation_history = ?, knowledge_base_sent = ?, created_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [feedback, conversationHistory, knowledgeBaseSent, existingFeedback[0].id]
        );
        return res.status(200).json({ message: 'Feedback atualizado com sucesso' });
      }

      // Insere o novo feedback com histórico completo
      await query(
        `INSERT INTO chat_feedback (conversation_id, user_id, user_message, assistant_response, conversation_history, knowledge_base_sent, feedback)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [conversation_id, user.id, user_message, assistant_response, conversationHistory, knowledgeBaseSent, feedback]
      );

      return res.status(201).json({ message: 'Feedback salvo com sucesso' });
    } catch (error) {
      console.error('Erro ao salvar feedback:', error);
      return res.status(500).json({ error: 'Erro ao salvar feedback' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

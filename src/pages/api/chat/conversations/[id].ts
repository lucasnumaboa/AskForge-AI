import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { query } from '@/lib/db';
import { ChatConversation, ChatMessage } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const userId = (session.user as any).id;
  const { id } = req.query;

  // Verifica se a conversa pertence ao usuário (inclui nome do sistema)
  const conversations = await query(
    `SELECT c.*, s.nome as system_nome 
     FROM chat_conversations c 
     LEFT JOIN systems s ON c.system_id = s.id 
     WHERE c.id = ? AND c.user_id = ?`,
    [id, userId]
  ) as ChatConversation[];

  if (conversations.length === 0) {
    return res.status(404).json({ error: 'Conversa não encontrada' });
  }

  // GET - Buscar conversa com mensagens
  if (req.method === 'GET') {
    try {
      const messages = await query(
        'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [id]
      ) as ChatMessage[];

      const conversation = conversations[0];
      
      // Busca anexos da base de conhecimento do módulo/sistema
      let attachmentsQuery = `SELECT a.*, kb.titulo as doc_titulo 
         FROM attachments a 
         INNER JOIN knowledge_base kb ON a.knowledge_id = kb.id 
         WHERE kb.module_id = ?`;
      let attachmentsParams: any[] = [conversation.module_id];
      
      if (conversation.system_id) {
        attachmentsQuery += ` AND kb.system_id = ?`;
        attachmentsParams.push(conversation.system_id);
      }
      
      const attachmentsFromDB = await query(attachmentsQuery, attachmentsParams) as any[];
      
      // Formata anexos com marcadores
      const allAttachments = attachmentsFromDB.map((att, index) => {
        // Garante que a URL seja válida
        let url = att.file_path;
        if (url && !url.startsWith('http') && !url.startsWith('/')) {
          url = '/' + url;
        }
        return {
          id: `[ANEXO_${index + 1}]`,
          url: url,
          name: att.original_name
        };
      });

      return res.status(200).json({
        conversation,
        messages,
        all_knowledge_attachments: allAttachments
      });
    } catch (error) {
      console.error('Erro ao buscar conversa:', error);
      return res.status(500).json({ error: 'Erro ao buscar conversa' });
    }
  }

  // PUT - Atualizar título da conversa
  if (req.method === 'PUT') {
    try {
      const { titulo } = req.body;

      await query(
        'UPDATE chat_conversations SET titulo = ? WHERE id = ?',
        [titulo, id]
      );

      return res.status(200).json({ message: 'Conversa atualizada com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar conversa:', error);
      return res.status(500).json({ error: 'Erro ao atualizar conversa' });
    }
  }

  // DELETE - Excluir conversa
  if (req.method === 'DELETE') {
    try {
      await query('DELETE FROM chat_conversations WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Conversa excluída com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
      return res.status(500).json({ error: 'Erro ao excluir conversa' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

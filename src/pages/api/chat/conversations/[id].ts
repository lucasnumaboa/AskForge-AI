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

  // Verifica se a conversa pertence ao usuário
  const conversations = await query(
    'SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?',
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

      return res.status(200).json({
        conversation: conversations[0],
        messages
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

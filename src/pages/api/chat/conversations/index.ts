import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { query } from '@/lib/db';
import { ChatConversation } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const userId = (session.user as any).id;

  // GET - Listar conversas do usuário
  if (req.method === 'GET') {
    try {
      const conversations = await query(
        `SELECT c.*, m.nome as module_nome, s.nome as system_nome 
         FROM chat_conversations c 
         JOIN modules m ON c.module_id = m.id 
         LEFT JOIN systems s ON c.system_id = s.id
         WHERE c.user_id = ? 
         ORDER BY c.updated_at DESC`,
        [userId]
      ) as ChatConversation[];

      return res.status(200).json(conversations);
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      return res.status(500).json({ error: 'Erro ao buscar conversas' });
    }
  }

  // POST - Criar nova conversa
  if (req.method === 'POST') {
    try {
      const { titulo, module_id } = req.body;

      if (!module_id) {
        return res.status(400).json({ error: 'Módulo é obrigatório' });
      }

      // Verifica se o usuário tem acesso ao módulo
      const user = session.user as any;
      const isAdmin = user.grupo === 'adm';
      
      if (!isAdmin) {
        const access = await query(
          'SELECT id FROM module_access WHERE user_id = ? AND module_id = ?',
          [userId, module_id]
        ) as any[];
        
        if (access.length === 0) {
          return res.status(403).json({ error: 'Você não tem acesso a este módulo' });
        }
      }

      // Busca o nome do módulo
      const modules = await query('SELECT nome FROM modules WHERE id = ?', [module_id]) as any[];
      const moduleName = modules[0]?.nome || 'Módulo';

      const result = await query(
        'INSERT INTO chat_conversations (user_id, module_id, titulo) VALUES (?, ?, ?)',
        [userId, module_id, titulo || `Chat - ${moduleName}`]
      ) as any;

      return res.status(201).json({ 
        id: result.insertId, 
        user_id: userId,
        module_id: module_id,
        titulo: titulo || `Chat - ${moduleName}`,
        message: 'Conversa criada com sucesso' 
      });
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      return res.status(500).json({ error: 'Erro ao criar conversa' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

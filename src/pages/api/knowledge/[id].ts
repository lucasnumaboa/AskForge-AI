import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const user = session.user as any;
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const knowledge = await query<any[]>(
        `SELECT kb.*, m.nome as module_nome, s.nome as system_nome, u.nome as autor_nome
         FROM knowledge_base kb
         LEFT JOIN modules m ON kb.module_id = m.id
         LEFT JOIN systems s ON kb.system_id = s.id
         LEFT JOIN users u ON kb.created_by = u.id
         WHERE kb.id = ?`,
        [id]
      );

      if (knowledge.length === 0) {
        return res.status(404).json({ error: 'Documento não encontrado' });
      }

      const doc = knowledge[0];

      // Verifica acesso
      if (user.grupo !== 'adm') {
        const access = await query<any[]>(
          'SELECT id FROM module_access WHERE user_id = ? AND module_id = ?',
          [user.id, doc.module_id]
        );
        if (access.length === 0) {
          return res.status(403).json({ error: 'Acesso negado' });
        }
      }

      // Busca anexos
      const attachments = await query<any[]>(
        'SELECT * FROM attachments WHERE knowledge_id = ?',
        [id]
      );

      res.status(200).json({ ...doc, attachments });
    } catch (error) {
      console.error('Error fetching knowledge:', error);
      res.status(500).json({ error: 'Erro ao buscar documento' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { titulo, conteudo, tags, system_id } = req.body;

      // Busca documento
      const knowledge = await query<any[]>(
        'SELECT * FROM knowledge_base WHERE id = ?',
        [id]
      );

      if (knowledge.length === 0) {
        return res.status(404).json({ error: 'Documento não encontrado' });
      }

      const doc = knowledge[0];

      // Verifica permissão (admin ou autor)
      if (user.grupo !== 'adm' && doc.created_by !== parseInt(user.id)) {
        return res.status(403).json({ error: 'Sem permissão para editar' });
      }

      await query(
        `UPDATE knowledge_base 
         SET titulo = ?, conteudo = ?, tags = ?, system_id = ?, data_atualizacao = NOW()
         WHERE id = ?`,
        [titulo, conteudo || '', tags || '', system_id || null, id]
      );

      res.status(200).json({ message: 'Documento atualizado com sucesso' });
    } catch (error) {
      console.error('Error updating knowledge:', error);
      res.status(500).json({ error: 'Erro ao atualizar documento' });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Busca documento
      const knowledge = await query<any[]>(
        'SELECT * FROM knowledge_base WHERE id = ?',
        [id]
      );

      if (knowledge.length === 0) {
        return res.status(404).json({ error: 'Documento não encontrado' });
      }

      const doc = knowledge[0];

      // Verifica permissão (admin ou autor)
      if (user.grupo !== 'adm' && doc.created_by !== parseInt(user.id)) {
        return res.status(403).json({ error: 'Sem permissão para excluir' });
      }

      await query('DELETE FROM knowledge_base WHERE id = ?', [id]);

      res.status(200).json({ message: 'Documento excluído com sucesso' });
    } catch (error) {
      console.error('Error deleting knowledge:', error);
      res.status(500).json({ error: 'Erro ao excluir documento' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

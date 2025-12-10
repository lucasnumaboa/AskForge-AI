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
      const systems = await query<any[]>(
        `SELECT s.*, m.nome as module_nome 
         FROM systems s
         LEFT JOIN modules m ON s.module_id = m.id
         WHERE s.id = ?`,
        [id]
      );

      if (systems.length === 0) {
        return res.status(404).json({ error: 'Sistema não encontrado' });
      }

      res.status(200).json(systems[0]);
    } catch (error) {
      console.error('Error fetching system:', error);
      res.status(500).json({ error: 'Erro ao buscar sistema' });
    }
  } else if (req.method === 'PUT') {
    if (user.grupo !== 'adm') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
      const { nome, descricao } = req.body;

      if (!nome) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
      }

      // Verifica se existe outro sistema com mesmo nome no mesmo módulo
      const existing = await query<any[]>(
        'SELECT id, module_id FROM systems WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Sistema não encontrado' });
      }

      const duplicate = await query<any[]>(
        'SELECT id FROM systems WHERE nome = ? AND module_id = ? AND id != ?',
        [nome, existing[0].module_id, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({ error: 'Já existe um sistema com este nome neste módulo' });
      }

      await query(
        'UPDATE systems SET nome = ?, descricao = ? WHERE id = ?',
        [nome, descricao || null, id]
      );

      res.status(200).json({ message: 'Sistema atualizado com sucesso' });
    } catch (error) {
      console.error('Error updating system:', error);
      res.status(500).json({ error: 'Erro ao atualizar sistema' });
    }
  } else if (req.method === 'DELETE') {
    if (user.grupo !== 'adm') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
      // Verifica se existe
      const existing = await query<any[]>('SELECT id FROM systems WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Sistema não encontrado' });
      }

      await query('DELETE FROM systems WHERE id = ?', [id]);

      res.status(200).json({ message: 'Sistema excluído com sucesso' });
    } catch (error) {
      console.error('Error deleting system:', error);
      res.status(500).json({ error: 'Erro ao excluir sistema' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

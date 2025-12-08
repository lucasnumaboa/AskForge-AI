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
      const modules = await query<any[]>('SELECT * FROM modules WHERE id = ?', [id]);

      if (modules.length === 0) {
        return res.status(404).json({ error: 'Módulo não encontrado' });
      }

      // Verifica acesso
      if (user.grupo !== 'adm') {
        const access = await query<any[]>(
          'SELECT id FROM module_access WHERE user_id = ? AND module_id = ?',
          [user.id, id]
        );
        if (access.length === 0) {
          return res.status(403).json({ error: 'Acesso negado' });
        }
      }

      res.status(200).json(modules[0]);
    } catch (error) {
      console.error('Error fetching module:', error);
      res.status(500).json({ error: 'Erro ao buscar módulo' });
    }
  } else if (req.method === 'PUT') {
    if (user.grupo !== 'adm') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
      const { nome, descricao } = req.body;

      // Verifica se nome já existe para outro módulo
      const existing = await query<any[]>(
        'SELECT id FROM modules WHERE nome = ? AND id != ?',
        [nome, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Nome de módulo já existe' });
      }

      await query(
        'UPDATE modules SET nome = ?, descricao = ? WHERE id = ?',
        [nome, descricao || null, id]
      );

      res.status(200).json({ message: 'Módulo atualizado com sucesso' });
    } catch (error) {
      console.error('Error updating module:', error);
      res.status(500).json({ error: 'Erro ao atualizar módulo' });
    }
  } else if (req.method === 'DELETE') {
    if (user.grupo !== 'adm') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
      await query('DELETE FROM modules WHERE id = ?', [id]);
      res.status(200).json({ message: 'Módulo excluído com sucesso' });
    } catch (error) {
      console.error('Error deleting module:', error);
      res.status(500).json({ error: 'Erro ao excluir módulo' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

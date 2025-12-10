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

  if (req.method === 'GET') {
    try {
      const { module_id } = req.query;

      let systems;
      if (module_id) {
        systems = await query<any[]>(
          `SELECT s.*, m.nome as module_nome 
           FROM systems s
           LEFT JOIN modules m ON s.module_id = m.id
           WHERE s.module_id = ?
           ORDER BY s.nome`,
          [module_id]
        );
      } else {
        systems = await query<any[]>(
          `SELECT s.*, m.nome as module_nome 
           FROM systems s
           LEFT JOIN modules m ON s.module_id = m.id
           ORDER BY m.nome, s.nome`
        );
      }
      res.status(200).json(systems);
    } catch (error) {
      console.error('Error fetching systems:', error);
      res.status(500).json({ error: 'Erro ao buscar sistemas' });
    }
  } else if (req.method === 'POST') {
    if (user.grupo !== 'adm') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
      const { module_id, nome, descricao } = req.body;

      if (!module_id || !nome) {
        return res.status(400).json({ error: 'Módulo e nome são obrigatórios' });
      }

      // Verifica se sistema já existe neste módulo
      const existing = await query<any[]>(
        'SELECT id FROM systems WHERE nome = ? AND module_id = ?', 
        [nome, module_id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Sistema já existe neste módulo' });
      }

      const result = await query<any>(
        'INSERT INTO systems (module_id, nome, descricao) VALUES (?, ?, ?)',
        [module_id, nome, descricao || null]
      );

      res.status(201).json({ id: result.insertId, message: 'Sistema criado com sucesso' });
    } catch (error) {
      console.error('Error creating system:', error);
      res.status(500).json({ error: 'Erro ao criar sistema' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

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
      let modules;
      if (user.grupo === 'adm') {
        modules = await query<any[]>('SELECT * FROM modules ORDER BY nome');
      } else {
        modules = await query<any[]>(
          `SELECT m.* FROM modules m 
           INNER JOIN module_access ma ON m.id = ma.module_id 
           WHERE ma.user_id = ? 
           ORDER BY m.nome`,
          [user.id]
        );
      }
      res.status(200).json(modules);
    } catch (error) {
      console.error('Error fetching modules:', error);
      res.status(500).json({ error: 'Erro ao buscar módulos' });
    }
  } else if (req.method === 'POST') {
    if (user.grupo !== 'adm') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
      const { nome, descricao } = req.body;

      // Verifica se módulo já existe
      const existing = await query<any[]>('SELECT id FROM modules WHERE nome = ?', [nome]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Módulo já existe' });
      }

      const result = await query<any>(
        'INSERT INTO modules (nome, descricao) VALUES (?, ?)',
        [nome, descricao || null]
      );

      res.status(201).json({ id: result.insertId, message: 'Módulo criado com sucesso' });
    } catch (error) {
      console.error('Error creating module:', error);
      res.status(500).json({ error: 'Erro ao criar módulo' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

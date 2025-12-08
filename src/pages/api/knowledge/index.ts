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

      let knowledge;
      if (user.grupo === 'adm') {
        if (module_id) {
          knowledge = await query<any[]>(
            `SELECT kb.*, m.nome as module_nome, u.nome as autor_nome
             FROM knowledge_base kb
             LEFT JOIN modules m ON kb.module_id = m.id
             LEFT JOIN users u ON kb.created_by = u.id
             WHERE kb.module_id = ?
             ORDER BY kb.data_criacao DESC`,
            [module_id]
          );
        } else {
          knowledge = await query<any[]>(
            `SELECT kb.*, m.nome as module_nome, u.nome as autor_nome
             FROM knowledge_base kb
             LEFT JOIN modules m ON kb.module_id = m.id
             LEFT JOIN users u ON kb.created_by = u.id
             ORDER BY kb.data_criacao DESC`
          );
        }
      } else {
        if (module_id) {
          // Verifica acesso ao módulo
          const access = await query<any[]>(
            'SELECT id FROM module_access WHERE user_id = ? AND module_id = ?',
            [user.id, module_id]
          );
          if (access.length === 0) {
            return res.status(403).json({ error: 'Acesso negado' });
          }

          knowledge = await query<any[]>(
            `SELECT kb.*, m.nome as module_nome, u.nome as autor_nome
             FROM knowledge_base kb
             LEFT JOIN modules m ON kb.module_id = m.id
             LEFT JOIN users u ON kb.created_by = u.id
             WHERE kb.module_id = ?
             ORDER BY kb.data_criacao DESC`,
            [module_id]
          );
        } else {
          knowledge = await query<any[]>(
            `SELECT kb.*, m.nome as module_nome, u.nome as autor_nome
             FROM knowledge_base kb
             INNER JOIN module_access ma ON kb.module_id = ma.module_id
             LEFT JOIN modules m ON kb.module_id = m.id
             LEFT JOIN users u ON kb.created_by = u.id
             WHERE ma.user_id = ?
             ORDER BY kb.data_criacao DESC`,
            [user.id]
          );
        }
      }

      res.status(200).json(knowledge);
    } catch (error) {
      console.error('Error fetching knowledge:', error);
      res.status(500).json({ error: 'Erro ao buscar documentos' });
    }
  } else if (req.method === 'POST') {
    try {
      const { module_id, titulo, conteudo, tags } = req.body;

      // Verifica acesso ao módulo
      if (user.grupo !== 'adm') {
        const access = await query<any[]>(
          'SELECT id FROM module_access WHERE user_id = ? AND module_id = ?',
          [user.id, module_id]
        );
        if (access.length === 0) {
          return res.status(403).json({ error: 'Acesso negado' });
        }

        // Verifica permissão de cadastrar
        const perms = await query<any[]>(
          'SELECT cadastrar FROM permissions WHERE user_id = ?',
          [user.id]
        );
        if (perms.length === 0 || !perms[0].cadastrar) {
          return res.status(403).json({ error: 'Sem permissão para cadastrar' });
        }
      }

      const result = await query<any>(
        `INSERT INTO knowledge_base (module_id, created_by, titulo, conteudo, tags)
         VALUES (?, ?, ?, ?, ?)`,
        [module_id, user.id, titulo, conteudo || '', tags || '']
      );

      res.status(201).json({ id: result.insertId, message: 'Documento criado com sucesso' });
    } catch (error) {
      console.error('Error creating knowledge:', error);
      res.status(500).json({ error: 'Erro ao criar documento' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

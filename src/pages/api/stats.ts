import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const user = session.user as any;
    const isAdmin = user.grupo === 'adm';

    // Total de usuários (apenas admin)
    let totalUsers = 0;
    if (isAdmin) {
      const usersResult = await query<any[]>('SELECT COUNT(*) as count FROM users');
      totalUsers = usersResult[0].count;
    }

    // Total de módulos
    let totalModules = 0;
    if (isAdmin) {
      const modulesResult = await query<any[]>('SELECT COUNT(*) as count FROM modules');
      totalModules = modulesResult[0].count;
    } else {
      const modulesResult = await query<any[]>(
        'SELECT COUNT(*) as count FROM module_access WHERE user_id = ?',
        [user.id]
      );
      totalModules = modulesResult[0].count;
    }

    // Total de documentos
    let totalKnowledge = 0;
    let recentKnowledge: any[] = [];

    if (isAdmin) {
      const knowledgeResult = await query<any[]>('SELECT COUNT(*) as count FROM knowledge_base');
      totalKnowledge = knowledgeResult[0].count;

      recentKnowledge = await query<any[]>(`
        SELECT kb.*, m.nome as module_nome, u.nome as autor_nome
        FROM knowledge_base kb
        LEFT JOIN modules m ON kb.module_id = m.id
        LEFT JOIN users u ON kb.created_by = u.id
        ORDER BY kb.data_criacao DESC
        LIMIT 5
      `);
    } else {
      const knowledgeResult = await query<any[]>(
        `SELECT COUNT(*) as count FROM knowledge_base kb
         INNER JOIN module_access ma ON kb.module_id = ma.module_id
         WHERE ma.user_id = ?`,
        [user.id]
      );
      totalKnowledge = knowledgeResult[0].count;

      recentKnowledge = await query<any[]>(
        `SELECT kb.*, m.nome as module_nome, u.nome as autor_nome
         FROM knowledge_base kb
         INNER JOIN module_access ma ON kb.module_id = ma.module_id
         LEFT JOIN modules m ON kb.module_id = m.id
         LEFT JOIN users u ON kb.created_by = u.id
         WHERE ma.user_id = ?
         ORDER BY kb.data_criacao DESC
         LIMIT 5`,
        [user.id]
      );
    }

    res.status(200).json({
      totalUsers,
      totalModules,
      totalKnowledge,
      recentKnowledge,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}

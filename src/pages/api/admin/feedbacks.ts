import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { query } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const user = session.user as any;

  // Apenas administradores podem acessar
  if (user.grupo !== 'adm') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  if (req.method === 'GET') {
    try {
      const { 
        feedback, 
        user_id, 
        module_id,
        date_from, 
        date_to,
        page = '1',
        limit = '20'
      } = req.query;

      let sql = `
        SELECT 
          cf.id,
          cf.conversation_id,
          cf.user_id,
          cf.user_message,
          cf.assistant_response,
          cf.conversation_history,
          cf.knowledge_base_sent,
          cf.feedback,
          cf.created_at,
          u.nome as user_name,
          u.email as user_email,
          cc.titulo as conversation_title,
          m.nome as module_name,
          s.nome as system_name
        FROM chat_feedback cf
        INNER JOIN users u ON cf.user_id = u.id
        INNER JOIN chat_conversations cc ON cf.conversation_id = cc.id
        LEFT JOIN modules m ON cc.module_id = m.id
        LEFT JOIN systems s ON cc.system_id = s.id
        WHERE 1=1
      `;
      
      const params: any[] = [];

      // Filtro por tipo de feedback
      if (feedback && (feedback === 'positive' || feedback === 'negative')) {
        sql += ' AND cf.feedback = ?';
        params.push(feedback);
      }

      // Filtro por usuário
      if (user_id) {
        sql += ' AND cf.user_id = ?';
        params.push(user_id);
      }

      // Filtro por módulo
      if (module_id) {
        sql += ' AND cc.module_id = ?';
        params.push(module_id);
      }

      // Filtro por data inicial
      if (date_from) {
        sql += ' AND DATE(cf.created_at) >= ?';
        params.push(date_from);
      }

      // Filtro por data final
      if (date_to) {
        sql += ' AND DATE(cf.created_at) <= ?';
        params.push(date_to);
      }

      // Paginação
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;
      const offset = (pageNum - 1) * limitNum;

      // Query para contar total
      const countSql = sql.replace(
        /SELECT[\s\S]*?FROM/,
        'SELECT COUNT(*) as total FROM'
      );

      const countResult = await query<any[]>(countSql, params);
      const total = countResult[0]?.total || 0;

      // Ordenação e paginação (valores numéricos interpolados diretamente por segurança)
      sql += ` ORDER BY cf.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

      const feedbacks = await query<any[]>(sql, params);

      // Estatísticas gerais
      const statsResult = await query<any[]>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN feedback = 'positive' THEN 1 ELSE 0 END) as positive,
          SUM(CASE WHEN feedback = 'negative' THEN 1 ELSE 0 END) as negative
        FROM chat_feedback
      `);

      const stats = statsResult[0] || { total: 0, positive: 0, negative: 0 };

      return res.status(200).json({
        feedbacks,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        },
        stats
      });
    } catch (error) {
      console.error('Erro ao buscar feedbacks:', error);
      return res.status(500).json({ error: 'Erro ao buscar feedbacks' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

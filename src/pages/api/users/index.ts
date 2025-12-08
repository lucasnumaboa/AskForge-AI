import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const user = session.user as any;
  if (user.grupo !== 'adm') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  if (req.method === 'GET') {
    try {
      const users = await query<any[]>('SELECT id, nome, email, grupo, created_at FROM users ORDER BY nome');
      res.status(200).json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
  } else if (req.method === 'POST') {
    try {
      const { nome, email, senha, grupo, cadastrar, batepapo, moduleIds } = req.body;

      // Verifica se email já existe
      const existing = await query<any[]>('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }

      // Hash da senha
      const senhaHash = await bcrypt.hash(senha, 10);

      // Insere usuário
      const result = await query<any>(
        'INSERT INTO users (nome, email, senha, grupo) VALUES (?, ?, ?, ?)',
        [nome, email, senhaHash, grupo]
      );

      const userId = result.insertId;

      // Insere permissões
      await query(
        'INSERT INTO permissions (user_id, cadastrar, batepapo) VALUES (?, ?, ?)',
        [userId, cadastrar ? 1 : 0, batepapo ? 1 : 0]
      );

      // Insere acesso aos módulos
      if (moduleIds && moduleIds.length > 0) {
        for (const moduleId of moduleIds) {
          await query(
            'INSERT INTO module_access (user_id, module_id) VALUES (?, ?)',
            [userId, moduleId]
          );
        }
      }

      res.status(201).json({ id: userId, message: 'Usuário criado com sucesso' });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

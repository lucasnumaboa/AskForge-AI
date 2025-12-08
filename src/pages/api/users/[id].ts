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

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const users = await query<any[]>(
        'SELECT id, nome, email, grupo, created_at FROM users WHERE id = ?',
        [id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const userData = users[0];

      // Busca permissões
      const permissions = await query<any[]>(
        'SELECT cadastrar, batepapo FROM permissions WHERE user_id = ?',
        [id]
      );

      // Busca módulos
      const modules = await query<any[]>(
        `SELECT m.* FROM modules m 
         INNER JOIN module_access ma ON m.id = ma.module_id 
         WHERE ma.user_id = ?`,
        [id]
      );

      res.status(200).json({
        ...userData,
        permissions: permissions[0] || { cadastrar: false, batepapo: false },
        modules,
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { nome, email, senha, grupo, cadastrar, batepapo, moduleIds } = req.body;

      // Verifica se email já existe para outro usuário
      const existing = await query<any[]>(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }

      // Atualiza usuário
      if (senha) {
        const senhaHash = await bcrypt.hash(senha, 10);
        await query(
          'UPDATE users SET nome = ?, email = ?, senha = ?, grupo = ? WHERE id = ?',
          [nome, email, senhaHash, grupo, id]
        );
      } else {
        await query(
          'UPDATE users SET nome = ?, email = ?, grupo = ? WHERE id = ?',
          [nome, email, grupo, id]
        );
      }

      // Atualiza permissões
      const existingPerms = await query<any[]>(
        'SELECT id FROM permissions WHERE user_id = ?',
        [id]
      );

      if (existingPerms.length > 0) {
        await query(
          'UPDATE permissions SET cadastrar = ?, batepapo = ? WHERE user_id = ?',
          [cadastrar ? 1 : 0, batepapo ? 1 : 0, id]
        );
      } else {
        await query(
          'INSERT INTO permissions (user_id, cadastrar, batepapo) VALUES (?, ?, ?)',
          [id, cadastrar ? 1 : 0, batepapo ? 1 : 0]
        );
      }

      // Atualiza acesso aos módulos
      await query('DELETE FROM module_access WHERE user_id = ?', [id]);
      if (moduleIds && moduleIds.length > 0) {
        for (const moduleId of moduleIds) {
          await query(
            'INSERT INTO module_access (user_id, module_id) VALUES (?, ?)',
            [id, moduleId]
          );
        }
      }

      res.status(200).json({ message: 'Usuário atualizado com sucesso' });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Não permite excluir o próprio usuário
      if (parseInt(id as string) === parseInt(user.id)) {
        return res.status(400).json({ error: 'Não é possível excluir seu próprio usuário' });
      }

      await query('DELETE FROM users WHERE id = ?', [id]);
      res.status(200).json({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Erro ao excluir usuário' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { query } from '@/lib/db';
import { LLMModel } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // GET - Listar modelos (todos podem ver o modelo ativo, admin vê todos)
  if (req.method === 'GET') {
    try {
      const isAdmin = (session.user as any).grupo === 'adm';
      
      if (isAdmin) {
        // Admin vê todos os modelos
        const models = await query('SELECT * FROM llm_models ORDER BY created_at DESC') as LLMModel[];
        return res.status(200).json(models);
      } else {
        // Usuário comum vê apenas o modelo ativo (sem api_key)
        const models = await query(
          'SELECT id, provider, nome, modelo, visualiza_imagem, ativo FROM llm_models WHERE ativo = TRUE LIMIT 1'
        ) as LLMModel[];
        return res.status(200).json(models);
      }
    } catch (error) {
      console.error('Erro ao buscar modelos:', error);
      return res.status(500).json({ error: 'Erro ao buscar modelos' });
    }
  }

  // POST - Criar modelo (apenas admin)
  if (req.method === 'POST') {
    const isAdmin = (session.user as any).grupo === 'adm';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
      const { provider, nome, modelo, api_key, api_url, visualiza_imagem, ativo } = req.body;

      if (!provider || !nome || !modelo) {
        return res.status(400).json({ error: 'Provider, nome e modelo são obrigatórios' });
      }

      // Se o novo modelo for ativo, desativa todos os outros
      if (ativo) {
        await query('UPDATE llm_models SET ativo = FALSE');
      }

      const result = await query(
        `INSERT INTO llm_models (provider, nome, modelo, api_key, api_url, visualiza_imagem, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [provider, nome, modelo, api_key || null, api_url || null, visualiza_imagem || false, ativo || false]
      ) as any;

      return res.status(201).json({ id: result.insertId, message: 'Modelo criado com sucesso' });
    } catch (error) {
      console.error('Erro ao criar modelo:', error);
      return res.status(500).json({ error: 'Erro ao criar modelo' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

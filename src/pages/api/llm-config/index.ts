import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { query } from '@/lib/db';
import { LLMConfig } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // GET - Buscar configuração
  if (req.method === 'GET') {
    try {
      const configs = await query('SELECT * FROM llm_config ORDER BY id DESC LIMIT 1') as LLMConfig[];
      
      if (configs.length === 0) {
        return res.status(200).json(null);
      }

      return res.status(200).json(configs[0]);
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      return res.status(500).json({ error: 'Erro ao buscar configuração' });
    }
  }

  // POST/PUT - Criar ou atualizar configuração (apenas admin)
  if (req.method === 'POST' || req.method === 'PUT') {
    const isAdmin = (session.user as any).grupo === 'adm';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
      const { nome_empresa, prompt_sistema } = req.body;

      if (!nome_empresa) {
        return res.status(400).json({ error: 'Nome da empresa é obrigatório' });
      }

      // Verifica se já existe uma configuração
      const existing = await query('SELECT id FROM llm_config LIMIT 1') as any[];

      if (existing.length > 0) {
        // Atualiza
        await query(
          'UPDATE llm_config SET nome_empresa = ?, prompt_sistema = ? WHERE id = ?',
          [nome_empresa, prompt_sistema || null, existing[0].id]
        );
        return res.status(200).json({ message: 'Configuração atualizada com sucesso' });
      } else {
        // Cria
        const result = await query(
          'INSERT INTO llm_config (nome_empresa, prompt_sistema) VALUES (?, ?)',
          [nome_empresa, prompt_sistema || null]
        ) as any;
        return res.status(201).json({ id: result.insertId, message: 'Configuração criada com sucesso' });
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      return res.status(500).json({ error: 'Erro ao salvar configuração' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

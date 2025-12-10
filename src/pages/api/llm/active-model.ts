import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  if (req.method === 'GET') {
    try {
      // Busca o modelo LLM ativo
      const models = await query<any[]>(
        'SELECT id, provider, nome, modelo, visualiza_imagem FROM llm_models WHERE ativo = 1 LIMIT 1'
      );

      if (models.length === 0) {
        return res.status(404).json({ error: 'Nenhum modelo LLM ativo' });
      }

      const model = models[0];
      res.status(200).json({
        id: model.id,
        provider: model.provider,
        nome: model.nome,
        modelo: model.modelo,
        visualiza_imagem: !!model.visualiza_imagem
      });
    } catch (error) {
      console.error('Error fetching active model:', error);
      res.status(500).json({ error: 'Erro ao buscar modelo ativo' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

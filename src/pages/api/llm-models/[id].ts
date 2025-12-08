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

  const isAdmin = (session.user as any).grupo === 'adm';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { id } = req.query;

  // GET - Buscar modelo específico
  if (req.method === 'GET') {
    try {
      const models = await query('SELECT * FROM llm_models WHERE id = ?', [id]) as LLMModel[];
      
      if (models.length === 0) {
        return res.status(404).json({ error: 'Modelo não encontrado' });
      }

      return res.status(200).json(models[0]);
    } catch (error) {
      console.error('Erro ao buscar modelo:', error);
      return res.status(500).json({ error: 'Erro ao buscar modelo' });
    }
  }

  // PUT - Atualizar modelo
  if (req.method === 'PUT') {
    try {
      const { provider, nome, modelo, api_key, api_url, visualiza_imagem, ativo } = req.body;

      if (!provider || !nome || !modelo) {
        return res.status(400).json({ error: 'Provider, nome e modelo são obrigatórios' });
      }

      // Se o modelo for ativado, desativa todos os outros
      if (ativo) {
        await query('UPDATE llm_models SET ativo = FALSE WHERE id != ?', [id]);
      }

      await query(
        `UPDATE llm_models 
         SET provider = ?, nome = ?, modelo = ?, api_key = ?, api_url = ?, visualiza_imagem = ?, ativo = ?
         WHERE id = ?`,
        [provider, nome, modelo, api_key || null, api_url || null, visualiza_imagem || false, ativo || false, id]
      );

      return res.status(200).json({ message: 'Modelo atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar modelo:', error);
      return res.status(500).json({ error: 'Erro ao atualizar modelo' });
    }
  }

  // DELETE - Excluir modelo
  if (req.method === 'DELETE') {
    try {
      await query('DELETE FROM llm_models WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Modelo excluído com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir modelo:', error);
      return res.status(500).json({ error: 'Erro ao excluir modelo' });
    }
  }

  // PATCH - Ativar/Desativar modelo
  if (req.method === 'PATCH') {
    try {
      const { ativo } = req.body;

      if (ativo) {
        // Desativa todos os outros modelos
        await query('UPDATE llm_models SET ativo = FALSE');
      }

      await query('UPDATE llm_models SET ativo = ? WHERE id = ?', [ativo, id]);

      return res.status(200).json({ message: ativo ? 'Modelo ativado' : 'Modelo desativado' });
    } catch (error) {
      console.error('Erro ao alterar status do modelo:', error);
      return res.status(500).json({ error: 'Erro ao alterar status do modelo' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

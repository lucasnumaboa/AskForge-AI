import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images');

// Garante que o diretório de upload existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Imagem não fornecida' });
    }

    // Remove o prefixo data:image/xxx;base64,
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Formato de imagem inválido' });
    }

    const extension = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Gera nome único para o arquivo
    const filename = `${uuidv4()}.${extension}`;
    const filepath = path.join(uploadDir, filename);

    // Salva o arquivo
    fs.writeFileSync(filepath, buffer);

    // Retorna a URL da imagem
    const imageUrl = `/uploads/images/${filename}`;

    res.status(200).json({ url: imageUrl });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
  }
}

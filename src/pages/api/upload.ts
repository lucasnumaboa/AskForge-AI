import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadDir = path.join(process.cwd(), 'public', 'uploads');

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
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      filename: (name, ext, part) => {
        const uniqueName = `${uuidv4()}${ext}`;
        return uniqueName;
      },
    });

    const [fields, files] = await form.parse(req);

    const uploadedFiles: any[] = [];

    // Processa arquivos
    for (const key in files) {
      const fileArray = files[key];
      if (fileArray) {
        for (const file of fileArray) {
          const filename = path.basename(file.filepath);
          uploadedFiles.push({
            filename,
            originalName: file.originalFilename,
            filePath: `/uploads/${filename}`,
            fileType: file.mimetype,
            fileSize: file.size,
          });
        }
      }
    }

    res.status(200).json({ files: uploadedFiles });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
}

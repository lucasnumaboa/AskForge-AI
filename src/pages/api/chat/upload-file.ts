import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
// @ts-ignore
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Diretório para arquivos do chat (acessível publicamente)
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat-files');

// Garante que o diretório de upload existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Tipos de arquivo permitidos
const ALLOWED_TYPES = [
  // Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Imagens
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

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
      maxFileSize: 20 * 1024 * 1024, // 20MB
      filename: (name: string, ext: string, part: any) => {
        const uniqueName = `${uuidv4()}${ext}`;
        return uniqueName;
      },
      filter: (part: any) => {
        // Verifica se o tipo de arquivo é permitido
        const mimeType = part.mimetype || '';
        return ALLOWED_TYPES.includes(mimeType);
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
          
          // Verifica se o arquivo foi realmente salvo
          if (!fs.existsSync(file.filepath)) {
            continue;
          }

          uploadedFiles.push({
            filename,
            originalName: file.originalFilename,
            filePath: `/uploads/chat-files/${filename}`,
            fileType: file.mimetype,
            fileSize: file.size,
          });
        }
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ 
        error: 'Nenhum arquivo válido foi enviado. Tipos permitidos: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, JPG, PNG, GIF, WEBP' 
      });
    }

    res.status(200).json({ files: uploadedFiles });
  } catch (error: any) {
    console.error('Upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 20MB' });
    }
    
    res.status(500).json({ error: 'Erro ao fazer upload do arquivo' });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
// @ts-ignore
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Diretório para anexos (acessível publicamente)
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'attachments');

// Garante que o diretório de upload existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  if (req.method === 'POST') {
    try {
      const form = formidable({
        uploadDir,
        keepExtensions: true,
        maxFileSize: 200 * 1024 * 1024, // 200MB por arquivo
        maxTotalFileSize: 1024 * 1024 * 1024, // 1GB total
        filename: (name: string, ext: string, part: any) => {
          const uniqueName = `${uuidv4()}${ext}`;
          return uniqueName;
        },
      });

      let fields, files;
      try {
        [fields, files] = await form.parse(req);
      } catch (parseError: any) {
        console.error('Form parse error:', parseError);
        
        // Verifica se é erro de tamanho
        if (parseError.code === 1009 || parseError.httpCode === 413) {
          return res.status(413).json({ 
            error: 'Arquivo muito grande. O limite máximo é de 200MB por arquivo e 1GB no total.',
            code: 'FILE_TOO_LARGE'
          });
        }
        
        return res.status(400).json({ 
          error: 'Erro ao processar o arquivo. Verifique se o formato é válido.',
          code: 'PARSE_ERROR'
        });
      }

      const knowledgeId = fields.knowledge_id?.[0];

      if (!knowledgeId) {
        return res.status(400).json({ error: 'knowledge_id é obrigatório' });
      }

      const uploadedFiles: any[] = [];

      // Processa arquivos
      for (const key in files) {
        const fileArray = files[key];
        if (fileArray) {
          for (const file of fileArray) {
            const filename = path.basename(file.filepath);
            const filePath = `/uploads/attachments/${filename}`;

            // Salva no banco de dados
            const result = await query(
              `INSERT INTO attachments (knowledge_id, filename, original_name, file_path, file_type, file_size)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [knowledgeId, filename, file.originalFilename, filePath, file.mimetype, file.size]
            ) as any;

            uploadedFiles.push({
              id: result.insertId,
              filename,
              originalName: file.originalFilename,
              filePath,
              fileType: file.mimetype,
              fileSize: file.size,
            });
          }
        }
      }

      res.status(200).json({ files: uploadedFiles });
    } catch (error: any) {
      console.error('Attachments upload error:', error);
      res.status(500).json({ error: 'Erro ao fazer upload dos anexos' });
    }
  } else if (req.method === 'DELETE') {
    // Para deletar anexos, precisamos do ID
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'ID do anexo é obrigatório' });
    }

    try {
      // Busca o anexo
      const attachments = await query<any[]>(
        'SELECT * FROM attachments WHERE id = ?',
        [id]
      );

      if (attachments.length === 0) {
        return res.status(404).json({ error: 'Anexo não encontrado' });
      }

      const attachment = attachments[0];

      // Remove o arquivo do disco
      const filePath = path.join(process.cwd(), 'public', attachment.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remove do banco de dados
      await query('DELETE FROM attachments WHERE id = ?', [id]);

      res.status(200).json({ message: 'Anexo excluído com sucesso' });
    } catch (error) {
      console.error('Error deleting attachment:', error);
      res.status(500).json({ error: 'Erro ao excluir anexo' });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}

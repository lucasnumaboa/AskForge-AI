import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { ArrowLeft, Edit, Calendar, User, Tag, Paperclip, Download } from 'lucide-react';
import { KnowledgeBase, Attachment } from '@/types';

export default function KnowledgeViewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [knowledge, setKnowledge] = useState<KnowledgeBase & { attachments?: Attachment[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user as any;
  const isAdmin = user?.grupo === 'adm';
  const canEdit = isAdmin || (knowledge && knowledge.created_by === parseInt(user?.id));

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    if (id) {
      fetchKnowledge();
    }
  }, [session, status, router, id]);

  const fetchKnowledge = async () => {
    try {
      const res = await fetch(`/api/knowledge/${id}`);
      if (res.ok) {
        const data = await res.json();
        setKnowledge(data);
      } else if (res.status === 403) {
        router.push('/modules');
      }
    } catch (error) {
      console.error('Error fetching knowledge:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!knowledge) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Documento não encontrado.</p>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>{knowledge.titulo} - Base de Conhecimento</title>
      </Head>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/modules/${knowledge.module_id}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="text-sm text-blue-600 font-medium">{knowledge.module_nome}</p>
                <h1 className="text-3xl font-bold text-gray-800">{knowledge.titulo}</h1>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => router.push(`/knowledge/${id}/edit`)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                <Edit className="w-5 h-5" />
                Editar
              </button>
            )}
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{knowledge.autor_nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                Criado em {new Date(knowledge.data_criacao!).toLocaleDateString('pt-BR')}
              </span>
            </div>
            {knowledge.data_atualizacao && knowledge.data_atualizacao !== knowledge.data_criacao && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  Atualizado em {new Date(knowledge.data_atualizacao).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          {/* Tags */}
          {knowledge.tags && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-gray-400" />
              {knowledge.tags.split(',').map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: knowledge.conteudo || '' }}
            />
          </div>

          {/* Attachments */}
          {knowledge.attachments && knowledge.attachments.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                Anexos
              </h3>
              <div className="space-y-2">
                {knowledge.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.file_path}
                    download={attachment.original_name}
                    className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                  >
                    <span className="text-gray-700">{attachment.original_name}</span>
                    <Download className="w-5 h-5 text-gray-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}

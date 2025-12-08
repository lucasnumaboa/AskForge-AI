import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { Plus, Search, FileText, ArrowLeft, Edit, Trash2, Eye } from 'lucide-react';
import { Module, KnowledgeBase } from '@/types';

export default function ModuleDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [module, setModule] = useState<Module | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState<number | null>(null);

  const user = session?.user as any;
  const isAdmin = user?.grupo === 'adm';
  const canCreate = isAdmin || user?.permissions?.cadastrar;

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    if (id) {
      fetchModule();
      fetchKnowledge();
    }
  }, [session, status, router, id]);

  const fetchModule = async () => {
    try {
      const res = await fetch(`/api/modules/${id}`);
      if (res.ok) {
        const data = await res.json();
        setModule(data);
      } else if (res.status === 403) {
        router.push('/modules');
      }
    } catch (error) {
      console.error('Error fetching module:', error);
    }
  };

  const fetchKnowledge = async () => {
    try {
      const res = await fetch(`/api/knowledge?module_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setKnowledge(data);
      }
    } catch (error) {
      console.error('Error fetching knowledge:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (knowledgeId: number) => {
    try {
      const res = await fetch(`/api/knowledge/${knowledgeId}`, { method: 'DELETE' });
      if (res.ok) {
        setKnowledge(knowledge.filter((k) => k.id !== knowledgeId));
        setDeleteModal(null);
      }
    } catch (error) {
      console.error('Error deleting knowledge:', error);
    }
  };

  const filteredKnowledge = knowledge.filter(
    (k) =>
      k.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (k.tags && k.tags.toLowerCase().includes(search.toLowerCase()))
  );

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{module?.nome || 'Módulo'} - Base de Conhecimento</title>
      </Head>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/modules')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{module?.nome}</h1>
                <p className="text-gray-500 mt-1">
                  {module?.descricao || 'Base de conhecimento do módulo'}
                </p>
              </div>
            </div>
            {canCreate && (
              <button
                onClick={() => router.push(`/modules/${id}/new`)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                <Plus className="w-5 h-5" />
                Novo Documento
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Knowledge List */}
          <div className="space-y-4">
            {filteredKnowledge.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => router.push(`/knowledge/${item.id}`)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-800 text-lg">
                        {item.titulo}
                      </h3>
                    </div>
                    {item.tags && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {item.tags.split(',').map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-500">
                      Por {item.autor_nome} •{' '}
                      {new Date(item.data_criacao!).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/knowledge/${item.id}`)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      title="Visualizar"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {(isAdmin || item.created_by === parseInt(user?.id)) && (
                      <>
                        <button
                          onClick={() => router.push(`/knowledge/${item.id}/edit`)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setDeleteModal(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredKnowledge.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {knowledge.length === 0
                  ? 'Nenhum documento cadastrado neste módulo.'
                  : 'Nenhum documento encontrado.'}
              </p>
            </div>
          )}
        </div>

        {/* Delete Modal */}
        {deleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Confirmar exclusão
              </h3>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir este documento? Esta ação não pode
                ser desfeita.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteModal)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}

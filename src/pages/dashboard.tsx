import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { BookOpen, Users, Layers, FileText, UserCircle } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalModules: number;
  totalKnowledge: number;
  recentKnowledge: any[];
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalModules: 0,
    totalKnowledge: 0,
    recentKnowledge: [],
  });
  const [loading, setLoading] = useState(true);

  const user = session?.user as any;
  const isAdmin = user?.grupo === 'adm';

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    fetchStats();
  }, [session, status, router]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
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

  return (
    <>
      <Head>
        <title>Dashboard - Base de Conhecimento</title>
      </Head>
      <Layout>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Bem-vindo, {user?.name || 'Usuário'}!
              </h1>
              <p className="text-gray-500 mt-1">
                {isAdmin
                  ? 'Você tem acesso administrativo ao sistema.'
                  : 'Acesse os módulos disponíveis no menu lateral.'}
              </p>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
            >
              <UserCircle className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700 font-medium">Meu Perfil</span>
            </button>
          </div>

          {/* Stats Cards */}
          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalUsers}</p>
                    <p className="text-gray-500">Usuários</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Layers className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalModules}</p>
                    <p className="text-gray-500">Módulos</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalKnowledge}</p>
                    <p className="text-gray-500">Documentos</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Knowledge */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Documentos Recentes
            </h2>
            {stats.recentKnowledge.length > 0 ? (
              <div className="space-y-4">
                {stats.recentKnowledge.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                    onClick={() => router.push(`/knowledge/${item.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{item.titulo}</p>
                        <p className="text-sm text-gray-500">
                          {item.module_nome} • Por {item.autor_nome}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">
                      {new Date(item.data_criacao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nenhum documento cadastrado ainda.
              </p>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}

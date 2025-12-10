import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { 
  ThumbsUp, 
  ThumbsDown, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  User as UserIcon,
  MessageSquare,
  FolderOpen,
  X,
  Bot,
  Database,
  Eye,
  FileText,
  AlertCircle
} from 'lucide-react';

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface KnowledgeBaseItem {
  id: number;
  titulo: string;
  tags: string;
  conteudo_preview: string;
}

interface Feedback {
  id: number;
  conversation_id: number;
  user_id: number;
  user_message: string;
  assistant_response: string;
  conversation_history: string | null;
  knowledge_base_sent: string | null;
  feedback: 'positive' | 'negative';
  created_at: string;
  user_name: string;
  user_email: string;
  conversation_title: string;
  module_name: string;
  system_name: string | null;
}

interface Stats {
  total: number;
  positive: number;
  negative: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface User {
  id: number;
  nome: string;
  email: string;
}

interface Module {
  id: number;
  nome: string;
}

export default function FeedbacksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, positive: 0, negative: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversation' | 'knowledge'>('conversation');

  // Filtros
  const [filterFeedback, setFilterFeedback] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  const user = session?.user as any;
  const isAdmin = user?.grupo === 'adm';

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || !isAdmin) {
      router.push('/dashboard');
      return;
    }

    fetchUsers();
    fetchModules();
  }, [session, status, router, isAdmin]);

  useEffect(() => {
    if (session && isAdmin) {
      fetchFeedbacks();
    }
  }, [session, isAdmin, pagination.page, filterFeedback, filterUser, filterModule, filterDateFrom, filterDateTo]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      
      if (filterFeedback) params.append('feedback', filterFeedback);
      if (filterUser) params.append('user_id', filterUser);
      if (filterModule) params.append('module_id', filterModule);
      if (filterDateFrom) params.append('date_from', filterDateFrom);
      if (filterDateTo) params.append('date_to', filterDateTo);

      const res = await fetch(`/api/admin/feedbacks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Erro ao buscar feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const fetchModules = async () => {
    try {
      const res = await fetch('/api/modules');
      if (res.ok) {
        const data = await res.json();
        setModules(data);
      }
    } catch (error) {
      console.error('Erro ao buscar módulos:', error);
    }
  };

  const clearFilters = () => {
    setFilterFeedback('');
    setFilterUser('');
    setFilterModule('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = filterFeedback || filterUser || filterModule || filterDateFrom || filterDateTo;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const openFeedbackModal = (fb: Feedback) => {
    setSelectedFeedback(fb);
    setActiveTab('conversation');
    setShowModal(true);
  };

  const closeFeedbackModal = () => {
    setShowModal(false);
    setSelectedFeedback(null);
  };

  const parseConversationHistory = (historyJson: string | null): ConversationMessage[] => {
    if (!historyJson) return [];
    try {
      return JSON.parse(historyJson);
    } catch {
      return [];
    }
  };

  const parseKnowledgeBase = (kbJson: string | null): KnowledgeBaseItem[] => {
    if (!kbJson) return [];
    try {
      return JSON.parse(kbJson);
    } catch {
      return [];
    }
  };

  if (status === 'loading' || (loading && feedbacks.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Feedbacks - Base de Conhecimento</title>
      </Head>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Feedbacks do Chat</h1>
              <p className="text-gray-500 mt-1">Visualize as avaliações dos usuários sobre as respostas do assistente</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                showFilters || hasActiveFilters
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filtros
              {hasActiveFilters && (
                <span className="bg-white text-blue-600 text-xs px-2 py-0.5 rounded-full">
                  Ativos
                </span>
              )}
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total de Feedbacks</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Positivos</p>
                  <p className="text-3xl font-bold text-green-600">{stats.positive}</p>
                  <p className="text-xs text-gray-400">
                    {stats.total > 0 ? ((stats.positive / stats.total) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <ThumbsUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Negativos</p>
                  <p className="text-3xl font-bold text-red-600">{stats.negative}</p>
                  <p className="text-xs text-gray-400">
                    {stats.total > 0 ? ((stats.negative / stats.total) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <ThumbsDown className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Filtros</h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Limpar filtros
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Tipo de Feedback */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Feedback
                  </label>
                  <select
                    value={filterFeedback}
                    onChange={(e) => {
                      setFilterFeedback(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    <option value="positive">Positivo</option>
                    <option value="negative">Negativo</option>
                  </select>
                </div>

                {/* Usuário */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuário
                  </label>
                  <select
                    value={filterUser}
                    onChange={(e) => {
                      setFilterUser(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Módulo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Módulo
                  </label>
                  <select
                    value={filterModule}
                    onChange={(e) => {
                      setFilterModule(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {modules.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Data Inicial */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => {
                      setFilterDateFrom(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Data Final */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => {
                      setFilterDateTo(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Feedbacks List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhum feedback encontrado</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-blue-600 hover:text-blue-700"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {feedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => openFeedbackModal(fb)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Feedback Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        fb.feedback === 'positive' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {fb.feedback === 'positive' ? (
                          <ThumbsUp className="w-5 h-5 text-green-600" />
                        ) : (
                          <ThumbsDown className="w-5 h-5 text-red-600" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-medium text-gray-800">{fb.user_name}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-500">{fb.user_email}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-500">{formatDate(fb.created_at)}</span>
                        </div>

                        {/* Module/System Info */}
                        <div className="flex items-center gap-2 mb-3 text-sm">
                          <FolderOpen className="w-4 h-4 text-blue-500" />
                          <span className="text-blue-600">{fb.module_name}</span>
                          {fb.system_name && (
                            <>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600">{fb.system_name}</span>
                            </>
                          )}
                          {/* Indicadores de dados disponíveis */}
                          <span className="text-gray-300 mx-2">|</span>
                          {fb.conversation_history ? (
                            <span className="text-xs text-purple-600 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              Conversa salva
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              Sem histórico
                            </span>
                          )}
                          <span className="text-gray-300">|</span>
                          {fb.knowledge_base_sent ? (
                            <span className="text-xs text-orange-600 flex items-center gap-1">
                              <Database className="w-3 h-3" />
                              Base enviada
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Database className="w-3 h-3" />
                              Sem base
                            </span>
                          )}
                        </div>

                        {/* Messages Preview */}
                        <div className="space-y-2">
                          {/* User Message */}
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-blue-600 mb-1">Última pergunta:</p>
                            <p className="text-sm text-gray-700">{truncateText(fb.user_message)}</p>
                          </div>

                          {/* Assistant Response */}
                          <div className="bg-gray-100 rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-600 mb-1">Última resposta:</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {truncateText(fb.assistant_response, 200)}
                            </p>
                          </div>
                        </div>

                        {/* Ver detalhes */}
                        <div className="mt-2 flex items-center gap-1 text-sm text-blue-600">
                          <Eye className="w-4 h-4" />
                          <span>Clique para ver conversa completa</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                  {pagination.total} resultados
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Conversa Completa */}
        {showModal && selectedFeedback && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedFeedback.feedback === 'positive' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {selectedFeedback.feedback === 'positive' ? (
                      <ThumbsUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <ThumbsDown className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      Feedback de {selectedFeedback.user_name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedFeedback.module_name}
                      {selectedFeedback.system_name && ` → ${selectedFeedback.system_name}`}
                      {' • '}{formatDate(selectedFeedback.created_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeFeedbackModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('conversation')}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'conversation'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Conversa Completa
                </button>
                <button
                  onClick={() => setActiveTab('knowledge')}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'knowledge'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  Base de Conhecimento
                  {selectedFeedback.knowledge_base_sent ? (
                    <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full">
                      Enviada
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
                      Não enviada
                    </span>
                  )}
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'conversation' ? (
                  <div className="space-y-4">
                    {selectedFeedback.conversation_history ? (
                      parseConversationHistory(selectedFeedback.conversation_history).map((msg, index) => (
                        <div
                          key={index}
                          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                              msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                            }`}>
                              {formatDate(msg.created_at)}
                            </p>
                          </div>
                          {msg.role === 'user' && (
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                              <UserIcon className="w-4 h-4 text-gray-600" />
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Histórico da conversa não disponível</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Este feedback foi registrado antes da atualização que salva o histórico completo.
                        </p>
                        <div className="mt-6 space-y-3">
                          <div className="bg-blue-50 rounded-lg p-3 text-left">
                            <p className="text-xs font-medium text-blue-600 mb-1">Última pergunta registrada:</p>
                            <p className="text-sm text-gray-700">{selectedFeedback.user_message}</p>
                          </div>
                          <div className="bg-gray-100 rounded-lg p-3 text-left">
                            <p className="text-xs font-medium text-gray-600 mb-1">Última resposta registrada:</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedFeedback.assistant_response}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedFeedback.knowledge_base_sent ? (
                      <>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                          <div className="flex items-center gap-2 text-orange-700">
                            <Database className="w-5 h-5" />
                            <span className="font-medium">Base de conhecimento enviada ao modelo</span>
                          </div>
                          <p className="text-sm text-orange-600 mt-1">
                            Os documentos abaixo foram incluídos no contexto da conversa.
                          </p>
                        </div>
                        {parseKnowledgeBase(selectedFeedback.knowledge_base_sent).map((kb, index) => (
                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-800">{kb.titulo}</h4>
                                {kb.tags && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {kb.tags.split(',').map((tag, i) => (
                                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                        {tag.trim()}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {kb.conteudo_preview && (
                                  <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                                    {kb.conteudo_preview}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Nenhuma base de conhecimento foi enviada</p>
                        <p className="text-sm text-gray-400 mt-1">
                          O modelo respondeu sem utilizar documentos da base de conhecimento,
                          ou este feedback foi registrado antes da atualização.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={closeFeedbackModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}

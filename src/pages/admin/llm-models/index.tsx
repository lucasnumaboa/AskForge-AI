import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { Plus, Edit2, Trash2, Power, PowerOff, Eye, EyeOff, Bot, Building2, Save } from 'lucide-react';
import { LLMModel, LLMProvider, LLMConfig } from '@/types';

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: 'ollama', label: 'Ollama' },
];

export default function LLMModelsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState<LLMModel | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configData, setConfigData] = useState<{ nome_empresa: string; prompt_sistema: string }>({
    nome_empresa: '',
    prompt_sistema: '',
  });
  const [formData, setFormData] = useState({
    provider: 'openai' as LLMProvider,
    nome: '',
    modelo: '',
    api_key: '',
    api_url: '',
    visualiza_imagem: false,
    ativo: false,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session && (session.user as any).grupo !== 'adm') {
      router.push('/dashboard');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session && (session.user as any).grupo === 'adm') {
      fetchModels();
      fetchConfig();
    }
  }, [session]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/llm-config');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setConfigData({
            nome_empresa: data.nome_empresa || '',
            prompt_sistema: data.prompt_sistema || '',
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!configData.nome_empresa.trim()) {
      alert('Nome da empresa é obrigatório');
      return;
    }

    setSavingConfig(true);
    try {
      const res = await fetch('/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });

      if (res.ok) {
        alert('Configuração salva com sucesso!');
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar configuração');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      alert('Erro ao salvar configuração');
    } finally {
      setSavingConfig(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/llm-models');
      if (res.ok) {
        const data = await res.json();
        setModels(data);
      }
    } catch (error) {
      console.error('Erro ao buscar modelos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingModel 
        ? `/api/llm-models/${editingModel.id}` 
        : '/api/llm-models';
      
      const res = await fetch(url, {
        method: editingModel ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingModel(null);
        resetForm();
        fetchModels();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar modelo');
      }
    } catch (error) {
      console.error('Erro ao salvar modelo:', error);
      alert('Erro ao salvar modelo');
    }
  };

  const handleEdit = (model: LLMModel) => {
    setEditingModel(model);
    setFormData({
      provider: model.provider,
      nome: model.nome,
      modelo: model.modelo,
      api_key: model.api_key || '',
      api_url: model.api_url || '',
      visualiza_imagem: model.visualiza_imagem,
      ativo: model.ativo,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este modelo?')) return;

    try {
      const res = await fetch(`/api/llm-models/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchModels();
      }
    } catch (error) {
      console.error('Erro ao excluir modelo:', error);
    }
  };

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/llm-models/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !currentActive }),
      });

      if (res.ok) {
        fetchModels();
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      provider: 'openai',
      nome: '',
      modelo: '',
      api_key: '',
      api_url: '',
      visualiza_imagem: false,
      ativo: false,
    });
  };

  const openNewModal = () => {
    setEditingModel(null);
    resetForm();
    setShowModal(true);
  };

  if (status === 'loading' || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!session || (session.user as any).grupo !== 'adm') {
    return null;
  }

  return (
    <Layout>
      <Head>
        <title>Modelos LLM - Admin</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modelos LLM</h1>
            <p className="text-gray-600 mt-1">Configure os modelos de IA para o bate-papo</p>
          </div>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Novo Modelo
          </button>
        </div>

        {/* Configurações da Empresa */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Configurações da Empresa</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Empresa *
              </label>
              <input
                type="text"
                value={configData.nome_empresa}
                onChange={(e) => setConfigData({ ...configData, nome_empresa: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Minha Empresa LTDA"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt do Sistema (opcional)
              </label>
              <textarea
                value={configData.prompt_sistema}
                onChange={(e) => setConfigData({ ...configData, prompt_sistema: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Deixe em branco para usar o prompt padrão. O prompt padrão instrui o modelo a responder apenas com base na base de conhecimento, sem inventar informações."
              />
              <p className="text-xs text-gray-500 mt-1">
                Se não preenchido, será usado: "Você é um assistente da empresa [NOME]. Responda apenas com base nas informações da base de conhecimento. Não invente informações."
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig || !configData.nome_empresa.trim()}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={18} />
              {savingConfig ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            <strong>Atenção:</strong> Apenas um modelo pode estar ativo por vez. 
            O modelo ativo será usado em todas as conversas do bate-papo.
          </p>
        </div>

        {/* Lista de Modelos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modelo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visão
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {models.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Bot size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>Nenhum modelo cadastrado</p>
                    <p className="text-sm mt-1">Clique em "Novo Modelo" para adicionar</p>
                  </td>
                </tr>
              ) : (
                models.map((model) => (
                  <tr key={model.id} className={model.ativo ? 'bg-green-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(model.id, model.ativo)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                          model.ativo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {model.ativo ? (
                          <>
                            <Power size={14} />
                            Ativo
                          </>
                        ) : (
                          <>
                            <PowerOff size={14} />
                            Inativo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{model.nome}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        {PROVIDERS.find(p => p.value === model.provider)?.label || model.provider}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {model.modelo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {model.visualiza_imagem ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <Eye size={16} /> Sim
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400">
                          <EyeOff size={16} /> Não
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleEdit(model)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(model.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">
                {editingModel ? 'Editar Modelo' : 'Novo Modelo'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: GPT-4 Turbo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provedor *
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value as LLMProvider })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modelo *
                </label>
                <input
                  type="text"
                  value={formData.modelo}
                  onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: gpt-4-turbo-preview"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nome exato do modelo conforme documentação do provedor
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="sk-..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Não obrigatório para LM Studio e Ollama locais
                </p>
              </div>

              {(formData.provider === 'lmstudio' || formData.provider === 'ollama') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL da API
                  </label>
                  <input
                    type="text"
                    value={formData.api_url}
                    onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={formData.provider === 'lmstudio' 
                      ? 'http://localhost:1234/v1/chat/completions' 
                      : 'http://localhost:11434/api/chat'}
                  />
                </div>
              )}

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.visualiza_imagem}
                    onChange={(e) => setFormData({ ...formData, visualiza_imagem: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Visualiza imagens</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Ativo</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingModel(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingModel ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

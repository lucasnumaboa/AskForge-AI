import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { Plus, Edit, Trash2, Search, Layers, Server, ChevronDown, ChevronRight } from 'lucide-react';
import { Module, System } from '@/types';

export default function ModulesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState<number | null>(null);
  const [deleteSystemModal, setDeleteSystemModal] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSystemModal, setShowSystemModal] = useState(false);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [editSystem, setEditSystem] = useState<System | null>(null);
  const [selectedModuleForSystem, setSelectedModuleForSystem] = useState<Module | null>(null);
  const [formData, setFormData] = useState({ nome: '', descricao: '' });
  const [systemFormData, setSystemFormData] = useState({ nome: '', descricao: '' });
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<number[]>([]);

  const user = session?.user as any;
  const isAdmin = user?.grupo === 'adm';

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || !isAdmin) {
      router.push('/dashboard');
      return;
    }

    fetchModules();
    fetchSystems();
  }, [session, status, router, isAdmin]);

  const fetchModules = async () => {
    try {
      const res = await fetch('/api/modules');
      if (res.ok) {
        const data = await res.json();
        setModules(data);
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystems = async () => {
    try {
      const res = await fetch('/api/systems');
      if (res.ok) {
        const data = await res.json();
        setSystems(data);
      }
    } catch (error) {
      console.error('Error fetching systems:', error);
    }
  };

  const getSystemsByModule = (moduleId: number) => {
    return systems.filter(s => s.module_id === moduleId);
  };

  const toggleModuleExpand = (moduleId: number) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/modules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setModules(modules.filter((m) => m.id !== id));
        setDeleteModal(null);
      }
    } catch (error) {
      console.error('Error deleting module:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editModule ? `/api/modules/${editModule.id}` : '/api/modules';
      const method = editModule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        fetchModules();
        setShowCreateModal(false);
        setEditModule(null);
        setFormData({ nome: '', descricao: '' });
      }
    } catch (error) {
      console.error('Error saving module:', error);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (mod: Module) => {
    setEditModule(mod);
    setFormData({ nome: mod.nome, descricao: mod.descricao || '' });
    setShowCreateModal(true);
  };

  // Funções para sistemas
  const handleDeleteSystem = async (id: number) => {
    try {
      const res = await fetch(`/api/systems/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSystems(systems.filter((s) => s.id !== id));
        setDeleteSystemModal(null);
      }
    } catch (error) {
      console.error('Error deleting system:', error);
    }
  };

  const handleSaveSystem = async () => {
    setSaving(true);
    try {
      const url = editSystem ? `/api/systems/${editSystem.id}` : '/api/systems';
      const method = editSystem ? 'PUT' : 'POST';

      const body = editSystem 
        ? systemFormData 
        : { ...systemFormData, module_id: selectedModuleForSystem?.id };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        fetchSystems();
        setShowSystemModal(false);
        setEditSystem(null);
        setSelectedModuleForSystem(null);
        setSystemFormData({ nome: '', descricao: '' });
      }
    } catch (error) {
      console.error('Error saving system:', error);
    } finally {
      setSaving(false);
    }
  };

  const openSystemModal = (mod: Module) => {
    setSelectedModuleForSystem(mod);
    setEditSystem(null);
    setSystemFormData({ nome: '', descricao: '' });
    setShowSystemModal(true);
  };

  const openEditSystemModal = (sys: System) => {
    setEditSystem(sys);
    setSystemFormData({ nome: sys.nome, descricao: sys.descricao || '' });
    setShowSystemModal(true);
  };

  const filteredModules = modules.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
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
        <title>Módulos - Base de Conhecimento</title>
      </Head>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Módulos</h1>
              <p className="text-gray-500 mt-1">Gerencie os módulos do sistema</p>
            </div>
            <button
              onClick={() => {
                setEditModule(null);
                setFormData({ nome: '', descricao: '' });
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-5 h-5" />
              Novo Módulo
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar módulos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModules.map((mod) => {
              const moduleSystems = getSystemsByModule(mod.id);
              const isExpanded = expandedModules.includes(mod.id);
              
              return (
                <div
                  key={mod.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Layers className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{mod.nome}</h3>
                          <p className="text-sm text-gray-500">
                            {mod.descricao || 'Sem descrição'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditModal(mod)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          title="Editar módulo"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal(mod.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Excluir módulo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Sistemas do módulo */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => toggleModuleExpand(mod.id)}
                          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-blue-600"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Server className="w-4 h-4" />
                          <span>Sistemas ({moduleSystems.length})</span>
                        </button>
                        <button
                          onClick={() => openSystemModal(mod)}
                          className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition"
                          title="Adicionar sistema"
                        >
                          <Plus className="w-3 h-3" />
                          Novo
                        </button>
                      </div>
                      
                      {isExpanded && (
                        <div className="space-y-2 mt-3">
                          {moduleSystems.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Nenhum sistema cadastrado</p>
                          ) : (
                            moduleSystems.map((sys) => (
                              <div
                                key={sys.id}
                                className="flex items-center justify-between bg-gray-50 p-2 rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <Server className="w-4 h-4 text-gray-500" />
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">{sys.nome}</span>
                                    {sys.descricao && (
                                      <p className="text-xs text-gray-500">{sys.descricao}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => openEditSystemModal(sys)}
                                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                    title="Editar sistema"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteSystemModal(sys.id)}
                                    className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                                    title="Excluir sistema"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredModules.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhum módulo encontrado.
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                {editModule ? 'Editar Módulo' : 'Novo Módulo'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Ex: Faturamento"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    rows={3}
                    placeholder="Descrição do módulo"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditModule(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.nome}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {deleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Confirmar exclusão
              </h3>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir este módulo? Todos os documentos
                e sistemas associados também serão excluídos.
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

        {/* Create/Edit System Modal */}
        {showSystemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                {editSystem ? 'Editar Sistema' : `Novo Sistema - ${selectedModuleForSystem?.nome}`}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Sistema
                  </label>
                  <input
                    type="text"
                    value={systemFormData.nome}
                    onChange={(e) => setSystemFormData({ ...systemFormData, nome: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Ex: Datasul, Veragi, Neogrid"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={systemFormData.descricao}
                    onChange={(e) => setSystemFormData({ ...systemFormData, descricao: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    rows={3}
                    placeholder="Descrição do sistema"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => {
                    setShowSystemModal(false);
                    setEditSystem(null);
                    setSelectedModuleForSystem(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSystem}
                  disabled={saving || !systemFormData.nome}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete System Modal */}
        {deleteSystemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Confirmar exclusão do sistema
              </h3>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir este sistema? Os documentos associados
                perderão a referência ao sistema.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteSystemModal(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteSystem(deleteSystemModal)}
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

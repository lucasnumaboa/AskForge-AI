import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { ArrowLeft, Save, Upload, X, Trash2, Download } from 'lucide-react';
import { KnowledgeBase, Attachment, System } from '@/types';

export default function EditKnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [knowledge, setKnowledge] = useState<KnowledgeBase & { attachments?: Attachment[] } | null>(null);
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    conteudo: '',
    tags: '',
    system_id: '',
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState('');

  const user = session?.user as any;

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

  const fetchSystems = async (moduleId: number) => {
    try {
      const res = await fetch(`/api/systems?module_id=${moduleId}`);
      if (res.ok) {
        const data = await res.json();
        setSystems(data);
      }
    } catch (error) {
      console.error('Error fetching systems:', error);
    }
  };

  useEffect(() => {
    if (knowledge && contentRef.current) {
      contentRef.current.innerHTML = knowledge.conteudo || '';
    }
  }, [knowledge]);

  const fetchKnowledge = async () => {
    try {
      const res = await fetch(`/api/knowledge/${id}`);
      if (res.ok) {
        const data = await res.json();
        setKnowledge(data);
        setFormData({
          titulo: data.titulo,
          conteudo: data.conteudo || '',
          tags: data.tags || '',
          system_id: data.system_id ? String(data.system_id) : '',
        });
        // Busca sistemas do módulo
        if (data.module_id) {
          fetchSystems(data.module_id);
        }
        if (data.attachments) {
          setExistingAttachments(data.attachments);
        }
      } else if (res.status === 403) {
        router.push('/modules');
      }
    } catch (error) {
      console.error('Error fetching knowledge:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await uploadImage(file);
        }
        break;
      }
    }
  };

  const uploadImage = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        try {
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 }),
          });

          if (res.ok) {
            const data = await res.json();
            if (contentRef.current) {
              const img = document.createElement('img');
              img.src = data.url;
              img.style.maxWidth = '100%';
              
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.insertNode(img);
                range.collapse(false);
              } else {
                contentRef.current.appendChild(img);
              }
              
              setFormData(prev => ({
                ...prev,
                conteudo: contentRef.current?.innerHTML || ''
              }));
            }
          } else {
            const errorData = await res.json();
            console.error('Erro ao fazer upload da imagem:', errorData);
            setError('Erro ao fazer upload da imagem: ' + (errorData.error || 'Erro desconhecido'));
          }
        } catch (fetchError) {
          console.error('Erro na requisição de upload:', fetchError);
          setError('Erro ao fazer upload da imagem');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Erro ao processar imagem');
    }
  };

  const handleContentChange = () => {
    if (contentRef.current) {
      setFormData(prev => ({
        ...prev,
        conteudo: contentRef.current?.innerHTML || ''
      }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = async (attachmentId: number) => {
    if (!confirm('Tem certeza que deseja excluir este anexo?')) return;

    try {
      const res = await fetch(`/api/attachments?id=${attachmentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId));
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao excluir anexo');
      }
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      setError('Erro ao excluir anexo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        // Upload de anexos se houver
        if (attachments.length > 0) {
          const formDataUpload = new FormData();
          attachments.forEach(file => {
            formDataUpload.append('files', file);
          });
          formDataUpload.append('knowledge_id', id as string);

          const attachRes = await fetch('/api/attachments', {
            method: 'POST',
            body: formDataUpload,
          });

          if (!attachRes.ok) {
            const attachError = await attachRes.json();
            setError(attachError.error || 'Erro ao fazer upload dos anexos');
            setSaving(false);
            return;
          }
        }

        router.push(`/knowledge/${id}`);
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao atualizar documento');
      }
    } catch (error) {
      setError('Erro ao atualizar documento');
    } finally {
      setSaving(false);
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
        <title>Editar - {knowledge?.titulo}</title>
      </Head>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Editar Documento</h1>
              <p className="text-gray-500 mt-1">Módulo: {knowledge?.module_nome}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
              {/* Seleção de Sistema (obrigatório se módulo tem sistemas) */}
              {systems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sistema <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.system_id}
                    onChange={(e) => setFormData({ ...formData, system_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    required
                  >
                    <option value="">Selecione um sistema</option>
                    {systems.map((sys) => (
                      <option key={sys.id} value={sys.id}>
                        {sys.nome}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Selecione o sistema ao qual este documento pertence
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título
                </label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Título do documento"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conteúdo
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Você pode colar imagens diretamente no editor (Ctrl+V)
                </p>
                <div
                  ref={contentRef}
                  contentEditable
                  onPaste={handlePaste}
                  onInput={handleContentChange}
                  className="content-editor w-full min-h-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  style={{ whiteSpace: 'pre-wrap' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Ex: financeiro, relatório, mensal"
                />
              </div>

              {/* Anexos Existentes */}
              {existingAttachments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Anexos Existentes
                  </label>
                  <div className="space-y-2">
                    {existingAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">{attachment.original_name}</span>
                          <a
                            href={attachment.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExistingAttachment(attachment.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Excluir anexo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Novos Anexos
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                  >
                    <Upload className="w-5 h-5" />
                    Selecionar arquivos
                  </button>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </>
  );
}

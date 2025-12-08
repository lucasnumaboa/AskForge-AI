import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { ArrowLeft, Save, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Module } from '@/types';

export default function NewKnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    conteudo: '',
    tags: '',
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState('');

  const user = session?.user as any;

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    if (id) {
      fetchModule();
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
        
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });

        if (res.ok) {
          const data = await res.json();
          // Insere a imagem no editor
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
            
            // Atualiza o conteúdo
            setFormData(prev => ({
              ...prev,
              conteudo: contentRef.current?.innerHTML || ''
            }));
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Cria o documento
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: id,
          ...formData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Upload de anexos se houver
        if (attachments.length > 0) {
          const formDataUpload = new FormData();
          attachments.forEach(file => {
            formDataUpload.append('files', file);
          });
          formDataUpload.append('knowledge_id', data.id);

          await fetch('/api/attachments', {
            method: 'POST',
            body: formDataUpload,
          });
        }

        router.push(`/modules/${id}`);
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao criar documento');
      }
    } catch (error) {
      setError('Erro ao criar documento');
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
        <title>Novo Documento - {module?.nome}</title>
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
              <h1 className="text-3xl font-bold text-gray-800">Novo Documento</h1>
              <p className="text-gray-500 mt-1">Módulo: {module?.nome}</p>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Anexos
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
                  <p className="text-sm text-gray-500 mt-2">
                    Arraste arquivos ou clique para selecionar
                  </p>
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

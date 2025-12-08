import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { 
  MessageSquare, Send, Plus, Trash2, Edit2, Check, X, 
  Bot, User, Loader2, AlertCircle, Settings, Image, FolderOpen, XCircle
} from 'lucide-react';
import { ChatConversation, ChatMessage, LLMModel, Module } from '@/types';

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const user = session?.user as any;
  const isAdmin = user?.grupo === 'adm';
  const hasChatPermission = isAdmin || user?.permissions?.batepapo;

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeModel, setActiveModel] = useState<LLMModel | null>(null);
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [showModuleSelect, setShowModuleSelect] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [knowledgeImages, setKnowledgeImages] = useState<{ id: string; url: string }[]>([]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    if (!hasChatPermission) {
      router.push('/dashboard');
    }
  }, [session, status, router, hasChatPermission]);

  useEffect(() => {
    if (session && hasChatPermission) {
      fetchConversations();
      fetchActiveModel();
      fetchModules();
    }
  }, [session, hasChatPermission]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
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

  const fetchActiveModel = async () => {
    try {
      const res = await fetch('/api/llm-models');
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setActiveModel(data.find((m: LLMModel) => m.ativo) || null);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar modelo:', error);
    }
  };

  const fetchMessages = async (conversationId: number, moduleId?: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        setActiveConversation(conversationId);
        setActiveModuleId(data.conversation.module_id);
        setShowModuleSelect(false);
        
        // Busca imagens da base de conhecimento do módulo
        if (data.conversation.module_id) {
          fetchKnowledgeImages(data.conversation.module_id);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKnowledgeImages = async (moduleId: number) => {
    try {
      const res = await fetch(`/api/knowledge-base?module_id=${moduleId}`);
      if (res.ok) {
        const data = await res.json();
        // Extrai imagens de todos os documentos
        const images: { id: string; url: string }[] = [];
        let imageCounter = 1;
        
        data.forEach((kb: any) => {
          if (kb.conteudo) {
            const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
            let match;
            while ((match = imgRegex.exec(kb.conteudo)) !== null) {
              images.push({
                id: `[IMAGEM_${imageCounter}]`,
                url: match[1]
              });
              imageCounter++;
            }
          }
        });
        
        setKnowledgeImages(images);
      }
    } catch (error) {
      console.error('Erro ao buscar imagens da base de conhecimento:', error);
    }
  };

  const handleNewConversation = async () => {
    setActiveConversation(null);
    setActiveModuleId(null);
    setMessages([]);
    setError('');
    setSelectedImage(null);
    setImagePreview(null);
    setKnowledgeImages([]);
    setShowModuleSelect(true);
  };

  const handleSelectModule = (moduleId: number) => {
    setActiveModuleId(moduleId);
    setShowModuleSelect(false);
    fetchKnowledgeImages(moduleId);
    inputRef.current?.focus();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Comprime a imagem antes de enviar
      const img = document.createElement('img');
      const reader = new FileReader();
      
      reader.onloadend = () => {
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Redimensiona se for muito grande (max 800px)
          const maxSize = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Converte para JPEG com qualidade 0.7 para reduzir tamanho
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setSelectedImage(compressedBase64);
          setImagePreview(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    if (!activeModel) {
      setError('Nenhum modelo LLM configurado. Contate o administrador.');
      return;
    }

    if (!activeConversation && !activeModuleId) {
      setError('Selecione uma base de conhecimento para iniciar a conversa.');
      setShowModuleSelect(true);
      return;
    }

    const userMessage = inputMessage.trim();
    const currentImage = selectedImage;
    setInputMessage('');
    setSelectedImage(null);
    setImagePreview(null);
    setSending(true);
    setError('');

    // Adiciona mensagem do usuário localmente
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      conversation_id: activeConversation || 0,
      role: 'user',
      content: userMessage,
      image_url: currentImage || undefined,
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversation,
          module_id: activeModuleId,
          message: userMessage,
          image_base64: currentImage,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Se era uma nova conversa, atualiza o ID
        if (!activeConversation) {
          setActiveConversation(data.conversation_id);
          fetchConversations();
        }

        // Atualiza a imagem com a URL do servidor
        if (data.image_url) {
          setMessages(prev => prev.map(m => 
            m.id === tempUserMsg.id ? { ...m, image_url: data.image_url } : m
          ));
        }

        // Atualiza imagens da base de conhecimento
        if (data.all_knowledge_images) {
          setKnowledgeImages(data.all_knowledge_images);
        }

        // Adiciona resposta do assistente
        const assistantMsg: ChatMessage = {
          id: Date.now() + 1,
          conversation_id: data.conversation_id,
          role: 'assistant',
          content: data.response,
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        setError(data.error || 'Erro ao enviar mensagem');
        // Remove a mensagem do usuário em caso de erro
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setError('Erro ao enviar mensagem. Tente novamente.');
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteConversation = async (id: number) => {
    if (!confirm('Excluir esta conversa?')) return;

    try {
      const res = await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeConversation === id) {
          setActiveConversation(null);
          setMessages([]);
        }
        fetchConversations();
      }
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
    }
  };

  const handleRenameConversation = async (id: number) => {
    if (!newTitle.trim()) {
      setEditingTitle(null);
      return;
    }

    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: newTitle }),
      });

      if (res.ok) {
        fetchConversations();
      }
    } catch (error) {
      console.error('Erro ao renomear conversa:', error);
    } finally {
      setEditingTitle(null);
      setNewTitle('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Função para renderizar conteúdo com imagens da base de conhecimento
  const renderMessageContent = (content: string) => {
    // Verifica se há marcadores de imagem
    const imageMarkerRegex = /\[IMAGEM_(\d+)\]/g;
    
    if (!imageMarkerRegex.test(content)) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    // Divide o conteúdo em partes (texto e imagens)
    const parts: (string | { type: 'image'; id: string; url: string })[] = [];
    let lastIndex = 0;
    let match;
    
    // Reset regex
    imageMarkerRegex.lastIndex = 0;
    
    while ((match = imageMarkerRegex.exec(content)) !== null) {
      // Adiciona texto antes do marcador
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      
      // Encontra a imagem correspondente
      const imageId = `[IMAGEM_${match[1]}]`;
      const image = knowledgeImages.find(img => img.id === imageId);
      
      if (image) {
        parts.push({ type: 'image', id: imageId, url: image.url });
      } else {
        // Se não encontrar a imagem, mantém o marcador
        parts.push(match[0]);
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Adiciona texto restante
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return (
      <div className="space-y-2">
        {parts.map((part, index) => {
          if (typeof part === 'string') {
            return (
              <div key={index} className="whitespace-pre-wrap">
                {part}
              </div>
            );
          } else {
            return (
              <div key={index} className="my-2">
                <img 
                  src={part.url} 
                  alt={`Imagem ${part.id}`}
                  className="max-w-full rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(part.url, '_blank')}
                />
              </div>
            );
          }
        })}
      </div>
    );
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !hasChatPermission) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Bate-papo - Base de Conhecimento</title>
      </Head>
      <Layout>
        <div className="flex h-[calc(100vh-8rem)] bg-white rounded-lg shadow overflow-hidden">
          {/* Sidebar - Lista de Conversas */}
          <div className="w-72 bg-gray-50 border-r flex flex-col">
            <div className="p-4 border-b">
              <button
                onClick={handleNewConversation}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                Nova Conversa
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Nenhuma conversa ainda
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 p-3 border-b cursor-pointer hover:bg-gray-100 ${
                      activeConversation === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    {editingTitle === conv.id ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border rounded"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameConversation(conv.id);
                            if (e.key === 'Escape') setEditingTitle(null);
                          }}
                        />
                        <button
                          onClick={() => handleRenameConversation(conv.id)}
                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingTitle(null)}
                          className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="flex-1 min-w-0"
                          onClick={() => fetchMessages(conv.id)}
                        >
                          <div className="flex items-center gap-1">
                            <MessageSquare size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm truncate">{conv.titulo}</span>
                          </div>
                          {conv.module_nome && (
                            <div className="text-xs text-gray-400 truncate ml-5">{conv.module_nome}</div>
                          )}
                        </div>
                        <div className="hidden group-hover:flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTitle(conv.id);
                              setNewTitle(conv.titulo);
                            }}
                            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv.id);
                            }}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Info do modelo ativo */}
            <div className="p-3 border-t bg-gray-100">
              {activeModel ? (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Bot size={14} className="text-green-600" />
                  <span className="truncate">{activeModel.nome}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle size={14} />
                  <span>Nenhum modelo ativo</span>
                </div>
              )}
              {isAdmin && (
                <button
                  onClick={() => router.push('/admin/llm-models')}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <Settings size={12} />
                  Configurar Modelos
                </button>
              )}
            </div>
          </div>

          {/* Área de Chat */}
          <div className="flex-1 flex flex-col">
            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : showModuleSelect || (!activeConversation && !activeModuleId) ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <FolderOpen className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Selecione uma Base de Conhecimento
                  </h2>
                  <p className="text-gray-500 max-w-md mb-6">
                    Escolha o módulo sobre o qual deseja conversar. O assistente usará apenas as informações deste módulo.
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-w-lg">
                    {modules.map((mod) => (
                      <button
                        key={mod.id}
                        onClick={() => handleSelectModule(mod.id)}
                        className="p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                      >
                        <div className="font-medium text-gray-800">{mod.nome}</div>
                        {mod.descricao && (
                          <div className="text-sm text-gray-500 mt-1 line-clamp-2">{mod.descricao}</div>
                        )}
                      </button>
                    ))}
                  </div>
                  {modules.length === 0 && (
                    <p className="text-gray-400 mt-4">Nenhum módulo disponível</p>
                  )}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Inicie uma conversa
                  </h2>
                  <p className="text-gray-500 max-w-md mb-2">
                    Digite sua mensagem abaixo para começar a conversar com o assistente de IA.
                  </p>
                  {activeModuleId && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                      <FolderOpen size={14} />
                      <span>{modules.find(m => m.id === activeModuleId)?.nome}</span>
                    </div>
                  )}
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot size={18} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {msg.image_url && (
                        <div className="mb-2">
                          <img 
                            src={msg.image_url.startsWith('data:') ? msg.image_url : msg.image_url} 
                            alt="Imagem anexada" 
                            className="max-w-full max-h-64 rounded-lg"
                          />
                        </div>
                      )}
                      {msg.role === 'assistant' ? (
                        renderMessageContent(msg.content)
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={18} className="text-gray-600" />
                      </div>
                    )}
                  </div>
                ))
              )}
              {sending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Erro */}
            {error && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-200">
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t bg-gray-50">
              {/* Preview da imagem selecionada */}
              {imagePreview && (
                <div className="mb-3 relative inline-block">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="max-h-32 rounded-lg border"
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              )}
              
              {/* Indicador do módulo selecionado */}
              {activeModuleId && !activeConversation && (
                <div className="mb-2 flex items-center gap-2 text-sm text-blue-600">
                  <FolderOpen size={14} />
                  <span>Conversando sobre: {modules.find(m => m.id === activeModuleId)?.nome}</span>
                </div>
              )}
              
              <div className="flex gap-2">
                {/* Botão de anexar imagem */}
                {activeModel?.visualiza_imagem && (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending || !activeModuleId}
                      className="px-3 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Anexar imagem"
                    >
                      <Image size={20} className="text-gray-600" />
                    </button>
                  </>
                )}
                
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeModuleId ? "Digite sua mensagem..." : "Selecione um módulo para começar..."}
                  className="flex-1 px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={1}
                  disabled={sending || !activeModel || (!activeConversation && !activeModuleId)}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || sending || !activeModel || (!activeConversation && !activeModuleId)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Pressione Enter para enviar, Shift+Enter para nova linha
                {activeModel?.visualiza_imagem && ' • Clique no ícone de imagem para anexar'}
              </p>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}

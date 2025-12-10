import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { 
  MessageSquare, Send, Plus, Trash2, Edit2, Check, X, 
  Bot, User, Loader2, AlertCircle, Settings, Image, FolderOpen, XCircle,
  Paperclip, FileText, Download, ExternalLink, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { ChatConversation, ChatMessage, LLMModel, Module, System } from '@/types';

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
  const [activeSystemId, setActiveSystemId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeModel, setActiveModel] = useState<LLMModel | null>(null);
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [showModuleSelect, setShowModuleSelect] = useState(false);
  const [showSystemSelect, setShowSystemSelect] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [knowledgeImages, setKnowledgeImages] = useState<{ id: string; url: string }[]>([]);
  const [knowledgeAttachments, setKnowledgeAttachments] = useState<{ id: string; url: string; name: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ url: string; name: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<number, 'positive' | 'negative' | null>>({});
  const [messageKnowledgeIds, setMessageKnowledgeIds] = useState<Record<number, number[]>>({});

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

  const fetchSystems = async (moduleId: number) => {
    try {
      const res = await fetch(`/api/systems?module_id=${moduleId}`);
      if (res.ok) {
        const data = await res.json();
        setSystems(data);
        return data;
      }
    } catch (error) {
      console.error('Erro ao buscar sistemas:', error);
    }
    return [];
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
        setActiveSystemId(data.conversation.system_id || null);
        setShowModuleSelect(false);
        setShowSystemSelect(false);
        
        // Carrega anexos da base de conhecimento
        if (data.all_knowledge_attachments) {
          setKnowledgeAttachments(data.all_knowledge_attachments);
        }
        
        // Busca imagens da base de conhecimento do módulo/sistema
        if (data.conversation.module_id) {
          fetchKnowledgeImages(data.conversation.module_id, data.conversation.system_id);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKnowledgeImages = async (moduleId: number, systemId?: number | null) => {
    try {
      let url = `/api/knowledge?module_id=${moduleId}`;
      if (systemId) {
        url += `&system_id=${systemId}`;
      }
      const res = await fetch(url);
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
    setActiveSystemId(null);
    setMessages([]);
    setError('');
    setSelectedImage(null);
    setImagePreview(null);
    setKnowledgeImages([]);
    setSystems([]);
    setShowModuleSelect(true);
    setShowSystemSelect(false);
  };

  const handleSelectModule = async (moduleId: number) => {
    setActiveModuleId(moduleId);
    setShowModuleSelect(false);
    
    // Busca sistemas do módulo
    const moduleSystems = await fetchSystems(moduleId);
    
    // Se o módulo tem sistemas, mostra seleção de sistema
    if (moduleSystems && moduleSystems.length > 0) {
      setShowSystemSelect(true);
    } else {
      // Se não tem sistemas, vai direto para o chat
      setActiveSystemId(null);
      fetchKnowledgeImages(moduleId);
      inputRef.current?.focus();
    }
  };

  const handleSelectSystem = (systemId: number) => {
    setActiveSystemId(systemId);
    setShowSystemSelect(false);
    if (activeModuleId) {
      fetchKnowledgeImages(activeModuleId, systemId);
    }
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

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/chat/upload-file', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.files && data.files.length > 0) {
        const uploadedFile = data.files[0];
        setSelectedFile({
          url: uploadedFile.filePath,
          name: uploadedFile.originalName || file.name,
        });
      } else {
        setError(data.error || 'Erro ao fazer upload do arquivo');
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      setError('Erro ao fazer upload do arquivo');
    } finally {
      setUploadingFile(false);
      if (documentInputRef.current) {
        documentInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
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

    // Se o módulo tem sistemas mas nenhum foi selecionado
    if (!activeConversation && activeModuleId && systems.length > 0 && !activeSystemId) {
      setError('Selecione um sistema para iniciar a conversa.');
      setShowSystemSelect(true);
      return;
    }

    const userMessage = inputMessage.trim();
    const currentImage = selectedImage;
    const currentFile = selectedFile;
    setInputMessage('');
    setSelectedImage(null);
    setImagePreview(null);
    setSelectedFile(null);
    setSending(true);
    setError('');

    // Adiciona mensagem do usuário localmente
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      conversation_id: activeConversation || 0,
      role: 'user',
      content: userMessage,
      image_url: currentImage || undefined,
      file_url: currentFile?.url,
      file_name: currentFile?.name,
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversation,
          module_id: activeModuleId,
          system_id: activeSystemId,
          message: userMessage,
          image_base64: currentImage,
          file_url: currentFile?.url,
          file_name: currentFile?.name,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Se era uma nova conversa, atualiza o ID
        if (!activeConversation) {
          setActiveConversation(data.conversation_id);
          fetchConversations();
        }

        // Atualiza a imagem e arquivo com a URL do servidor
        if (data.image_url || data.file_url) {
          setMessages(prev => prev.map(m => 
            m.id === tempUserMsg.id ? { 
              ...m, 
              image_url: data.image_url || m.image_url,
              file_url: data.file_url || m.file_url,
              file_name: data.file_name || m.file_name,
            } : m
          ));
        }

        // Atualiza imagens da base de conhecimento
        if (data.all_knowledge_images) {
          setKnowledgeImages(data.all_knowledge_images);
        }

        // Atualiza anexos da base de conhecimento
        if (data.all_knowledge_attachments) {
          setKnowledgeAttachments(data.all_knowledge_attachments);
        }

        // Adiciona resposta do assistente
        const assistantMsg: ChatMessage = {
          id: Date.now() + 1,
          conversation_id: data.conversation_id,
          role: 'assistant',
          content: data.response,
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Armazena os IDs dos documentos usados para esta mensagem
        if (data.used_knowledge_ids) {
          setMessageKnowledgeIds(prev => ({ ...prev, [assistantMsg.id]: data.used_knowledge_ids }));
        }
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

  const handleFeedback = async (messageId: number, feedback: 'positive' | 'negative', userMessage: string, assistantResponse: string) => {
    if (!activeConversation) return;

    // Se já tem o mesmo feedback, remove (toggle)
    if (messageFeedback[messageId] === feedback) {
      setMessageFeedback(prev => ({ ...prev, [messageId]: null }));
      return;
    }

    // Obtém os IDs dos documentos usados para esta mensagem
    const usedKnowledgeIds = messageKnowledgeIds[messageId] || [];

    try {
      const res = await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversation,
          user_message: userMessage,
          assistant_response: assistantResponse,
          feedback,
          used_knowledge_ids: usedKnowledgeIds,
        }),
      });

      if (res.ok) {
        setMessageFeedback(prev => ({ ...prev, [messageId]: feedback }));
      } else {
        const data = await res.json();
        console.error('Erro ao salvar feedback:', data.error);
      }
    } catch (error) {
      console.error('Erro ao salvar feedback:', error);
    }
  };

  // Função para obter a mensagem do usuário anterior a uma resposta do assistente
  const getUserMessageForAssistant = (assistantIndex: number): string => {
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content;
      }
    }
    return '';
  };

  // Função para renderizar conteúdo com imagens Markdown e anexos da base de conhecimento
  const renderMessageContent = (content: string) => {
    // Regex para imagens em formato Markdown: ![alt](url)
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    // Regex para anexos: [ANEXO_X]
    const attachmentMarkerRegex = /\[ANEXO_(\d+)\]/g;
    
    const hasMarkdownImages = markdownImageRegex.test(content);
    markdownImageRegex.lastIndex = 0;
    const hasAttachments = attachmentMarkerRegex.test(content);
    attachmentMarkerRegex.lastIndex = 0;
    
    if (!hasMarkdownImages && !hasAttachments) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    // Regex combinada para encontrar imagens Markdown e anexos
    const combinedRegex = /!\[([^\]]*)\]\(([^)]+)\)|\[ANEXO_(\d+)\]/g;

    // Divide o conteúdo em partes (texto, imagens e anexos)
    const parts: (string | { type: 'image'; alt: string; url: string } | { type: 'attachment'; id: string; url: string; name: string })[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = combinedRegex.exec(content)) !== null) {
      // Adiciona texto antes do marcador
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      
      if (match[0].startsWith('![')) {
        // É uma imagem Markdown
        const alt = match[1] || 'Imagem';
        const url = match[2];
        parts.push({ type: 'image', alt, url });
      } else if (match[0].startsWith('[ANEXO_')) {
        // É um anexo
        const markerId = `[ANEXO_${match[3]}]`;
        const attachment = knowledgeAttachments.find(att => att.id === markerId);
        if (attachment && attachment.url) {
          // Garante que a URL seja válida
          let attachmentUrl = attachment.url;
          // Se a URL não começa com http ou /, adiciona /
          if (!attachmentUrl.startsWith('http') && !attachmentUrl.startsWith('/')) {
            attachmentUrl = '/' + attachmentUrl;
          }
          parts.push({ type: 'attachment', id: markerId, url: attachmentUrl, name: attachment.name });
        } else {
          // Anexo não encontrado - mostra como texto com aviso
          console.warn(`Anexo não encontrado: ${markerId}. Anexos disponíveis:`, knowledgeAttachments);
          parts.push(match[0]);
        }
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
          } else if (part.type === 'image') {
            return (
              <div key={index} className="my-2">
                <img 
                  src={part.url} 
                  alt={part.alt}
                  className="max-w-full rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(part.url, '_blank')}
                  onError={(e) => {
                    // Se a imagem falhar ao carregar, tenta com URL relativa
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('://')) {
                      const urlPath = new URL(target.src).pathname;
                      target.src = urlPath;
                    }
                  }}
                />
              </div>
            );
          } else if (part.type === 'attachment') {
            return (
              <div key={index} className="my-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-blue-600" />
                  <span className="flex-1 text-sm text-gray-700 truncate">{part.name}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <a
                    href={part.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-100 text-blue-600 hover:bg-blue-200"
                  >
                    <ExternalLink size={12} />
                    Abrir
                  </a>
                  <a
                    href={part.url}
                    download={part.name}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 text-green-600 hover:bg-green-200"
                  >
                    <Download size={12} />
                    Baixar
                  </a>
                </div>
              </div>
            );
          }
          return null;
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
                            <div className="text-xs text-gray-400 truncate ml-5">
                              {conv.module_nome}
                              {conv.system_nome && <span className="text-green-500"> → {conv.system_nome}</span>}
                            </div>
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
              ) : showSystemSelect && systems.length > 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <FolderOpen className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Selecione o Sistema
                  </h2>
                  <p className="text-gray-500 max-w-md mb-2">
                    Módulo: <span className="font-medium text-blue-600">{modules.find(m => m.id === activeModuleId)?.nome}</span>
                  </p>
                  <p className="text-gray-500 max-w-md mb-6">
                    Escolha o sistema específico. Uma vez selecionado, não poderá ser alterado nesta conversa.
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-w-lg">
                    {systems.map((sys) => (
                      <button
                        key={sys.id}
                        onClick={() => handleSelectSystem(sys.id)}
                        className="p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
                      >
                        <div className="font-medium text-gray-800">{sys.nome}</div>
                        {sys.descricao && (
                          <div className="text-sm text-gray-500 mt-1 line-clamp-2">{sys.descricao}</div>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setShowSystemSelect(false);
                      setShowModuleSelect(true);
                      setActiveModuleId(null);
                      setSystems([]);
                    }}
                    className="mt-4 text-sm text-gray-500 hover:text-gray-700"
                  >
                    ← Voltar para seleção de módulo
                  </button>
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
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {activeModuleId && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        <FolderOpen size={14} />
                        <span>{modules.find(m => m.id === activeModuleId)?.nome}</span>
                      </div>
                    )}
                    {activeSystemId && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                        <FolderOpen size={14} />
                        <span>{systems.find(s => s.id === activeSystemId)?.nome}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot size={18} className="text-white" />
                      </div>
                    )}
                    <div className="flex flex-col max-w-[70%]">
                      <div
                        className={`rounded-lg px-4 py-2 ${
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
                        {msg.file_url && (
                          <div className={`mb-2 p-3 rounded-lg border ${msg.role === 'user' ? 'bg-blue-500 border-blue-400' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center gap-2">
                              <FileText size={20} className={msg.role === 'user' ? 'text-white' : 'text-blue-600'} />
                              <span className={`flex-1 text-sm truncate ${msg.role === 'user' ? 'text-white' : 'text-gray-700'}`}>
                                {msg.file_name || 'Documento anexado'}
                              </span>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <a
                                href={msg.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${msg.role === 'user' ? 'bg-blue-400 text-white hover:bg-blue-300' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                              >
                                <ExternalLink size={12} />
                                Abrir
                              </a>
                              <a
                                href={msg.file_url}
                                download={msg.file_name}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${msg.role === 'user' ? 'bg-blue-400 text-white hover:bg-blue-300' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                              >
                                <Download size={12} />
                                Baixar
                              </a>
                            </div>
                          </div>
                        )}
                        {msg.role === 'assistant' ? (
                          renderMessageContent(msg.content)
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                      </div>
                      {/* Botões de feedback para mensagens do assistente */}
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1 mt-1 ml-1">
                          <button
                            onClick={() => handleFeedback(msg.id, 'positive', getUserMessageForAssistant(index), msg.content)}
                            className={`p-1.5 rounded-full transition-colors ${
                              messageFeedback[msg.id] === 'positive'
                                ? 'bg-green-100 text-green-600'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title="Resposta útil"
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.id, 'negative', getUserMessageForAssistant(index), msg.content)}
                            className={`p-1.5 rounded-full transition-colors ${
                              messageFeedback[msg.id] === 'negative'
                                ? 'bg-red-100 text-red-600'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title="Resposta não útil"
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </div>
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

              {/* Preview do arquivo selecionado */}
              {selectedFile && (
                <div className="mb-3 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <FileText size={18} className="text-blue-600" />
                  <span className="text-sm text-blue-800 max-w-xs truncate">{selectedFile.name}</span>
                  <button
                    onClick={handleRemoveFile}
                    className="text-red-500 hover:text-red-700"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              )}
              
              {/* Indicador do módulo/sistema selecionado */}
              {activeModuleId && !activeConversation && (
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <div className="flex items-center gap-1 text-blue-600">
                    <FolderOpen size={14} />
                    <span>{modules.find(m => m.id === activeModuleId)?.nome}</span>
                  </div>
                  {activeSystemId && (
                    <>
                      <span className="text-gray-400">→</span>
                      <div className="flex items-center gap-1 text-green-600">
                        <FolderOpen size={14} />
                        <span>{systems.find(s => s.id === activeSystemId)?.nome}</span>
                      </div>
                    </>
                  )}
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

                {/* Botão de anexar documento */}
                <input
                  type="file"
                  ref={documentInputRef}
                  onChange={handleDocumentSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  className="hidden"
                />
                <button
                  onClick={() => documentInputRef.current?.click()}
                  disabled={sending || !activeModuleId || uploadingFile}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Anexar documento"
                >
                  {uploadingFile ? (
                    <Loader2 size={20} className="text-gray-600 animate-spin" />
                  ) : (
                    <Paperclip size={20} className="text-gray-600" />
                  )}
                </button>
                
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
                {' • Clique no clipe para anexar documentos (PDF, DOC, XLS, etc.)'}
              </p>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}

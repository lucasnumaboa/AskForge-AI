export interface User {
  id: number;
  nome: string;
  email: string;
  senha?: string;
  grupo: 'adm' | 'user';
  created_at?: Date;
  updated_at?: Date;
}

export interface Permission {
  id: number;
  user_id: number;
  cadastrar: boolean;
  batepapo: boolean;
}

export interface Module {
  id: number;
  nome: string;
  descricao?: string;
  created_at?: Date;
}

export interface ModuleAccess {
  id: number;
  user_id: number;
  module_id: number;
}

export interface KnowledgeBase {
  id: number;
  module_id: number;
  created_by: number;
  titulo: string;
  conteudo?: string;
  tags?: string;
  data_criacao?: Date;
  data_atualizacao?: Date;
  // Campos extras para joins
  module_nome?: string;
  autor_nome?: string;
}

export interface Attachment {
  id: number;
  knowledge_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  created_at?: Date;
}

export interface UserWithPermissions extends User {
  permissions?: Permission;
  modules?: Module[];
}

export type LLMProvider = 'openai' | 'anthropic' | 'deepseek' | 'lmstudio' | 'ollama' | 'openrouter';

export interface LLMModel {
  id: number;
  provider: LLMProvider;
  nome: string;
  modelo: string;
  api_key?: string;
  api_url?: string;
  visualiza_imagem: boolean;
  ativo: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface ChatConversation {
  id: number;
  user_id: number;
  module_id: number;
  titulo: string;
  created_at?: Date;
  updated_at?: Date;
  module_nome?: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image_url?: string;
  created_at?: Date;
}

export interface LLMConfig {
  id: number;
  nome_empresa: string;
  prompt_sistema?: string;
  created_at?: Date;
  updated_at?: Date;
}

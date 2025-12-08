<div align="center">

<img src="icon.png" alt="AskForge-AI Logo" width="120" height="120">

# 🔥 AskForge-AI

**Sistema completo de gestão de conhecimento corporativo com chat IA integrado**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

[Funcionalidades](#-funcionalidades) •
[Instalação](#-instalação) •
[Configuração](#%EF%B8%8F-configuração) •
[Uso](#-uso) •
[API](#-provedores-llm-suportados) •
[Licença](#-licença)

</div>

---

## 🎯 Sobre o Projeto

Sistema de base de conhecimento corporativa desenvolvido em **Next.js** com **MySQL**, que permite organizar documentação por módulos e consultar informações através de um **chat com IA** que utiliza a base de conhecimento como contexto.

### ✨ Destaques

- 🤖 **Chat com IA** - Assistente virtual que responde com base na documentação cadastrada
- 📁 **Organização por Módulos** - Separe conhecimento por áreas (Faturamento, RH, TI, etc.)
- 🔐 **Controle de Acesso** - Permissões granulares por usuário e módulo
- 🖼️ **Suporte a Imagens** - Cole imagens diretamente no editor (Ctrl+V)
- 🔄 **Multi-provedor LLM** - OpenAI, Anthropic, DeepSeek, OpenRouter, Ollama, LM Studio

---

## 🚀 Funcionalidades

### 📖 Base de Conhecimento
- Criação de documentos com editor rico
- Organização por módulos/categorias
- Sistema de tags para busca
- Upload de anexos e imagens
- Colar imagens diretamente (Ctrl+V)

### 💬 Chat com IA
- Assistente virtual integrado
- Respostas baseadas na documentação cadastrada
- Suporte a envio de imagens no chat
- Histórico de conversas
- Seleção de módulo/contexto por conversa

### 👥 Gestão de Usuários
- Dois perfis: Administrador e Usuário
- Permissões: Cadastrar documentos e Bate-papo
- Controle de acesso por módulo
- Alteração de senha pelo próprio usuário

### ⚙️ Configuração de LLM
- Múltiplos provedores suportados
- Configuração de API keys
- Prompt de sistema personalizável
- Ativar/desativar modelos
- Suporte a modelos com visão (imagens)

---

## 📋 Requisitos

- **Node.js** 18+
- **MySQL** 8+
- **Python** 3.8+ (para inicialização do banco)

---

## 📦 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/AskForge-AI.git
cd AskForge-AI
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=knowledge_base

# NextAuth Configuration
NEXTAUTH_SECRET=sua-chave-secreta-super-segura-aqui
NEXTAUTH_URL=http://localhost:3001

# Upload Configuration
UPLOAD_DIR=./public/uploads
```

### 4. Inicialize o banco de dados

```bash
# Instala dependências Python (se necessário)
pip install mysql-connector-python bcrypt python-dotenv

# Executa o script de inicialização
python init_db.py
```

### 5. Inicie o servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm run start
```

Acesse: **http://localhost:3001**

---

## 🔑 Credenciais Padrão

| Campo | Valor |
|-------|-------|
| **Email** | admin@admin.com |
| **Senha** | admin123 |

> ⚠️ **Importante**: Altere a senha do administrador após o primeiro acesso!

---

## ⚙️ Configuração

### Configurando o Chat com IA

1. Acesse o sistema como administrador
2. Vá em **Administração > Modelos LLM**
3. Adicione um novo modelo com suas credenciais
4. Configure o nome da empresa e prompt do sistema
5. Ative o modelo desejado

### 🤖 Provedores LLM Suportados

| Provedor | Modelos Exemplo | Visão |
|----------|-----------------|-------|
| **OpenAI** | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | ✅ |
| **Anthropic** | claude-3-opus, claude-3-sonnet | ✅ |
| **DeepSeek** | deepseek-chat, deepseek-coder | ❌ |
| **OpenRouter** | Diversos modelos | ✅ |
| **Ollama** | llama2, mistral, codellama | ⚠️ |
| **LM Studio** | Modelos locais | ⚠️ |

> ⚠️ Suporte a visão depende do modelo específico

---

## 📁 Estrutura do Projeto

```
knowledge-base/
├── src/
│   ├── components/          # Componentes React
│   │   └── Layout.tsx       # Layout principal com menu lateral
│   ├── lib/
│   │   └── db.ts            # Conexão com MySQL
│   ├── pages/
│   │   ├── api/             # API Routes
│   │   │   ├── auth/        # Autenticação NextAuth
│   │   │   ├── chat/        # Endpoints do chat IA
│   │   │   ├── users/       # CRUD de usuários
│   │   │   ├── modules/     # CRUD de módulos
│   │   │   ├── knowledge/   # CRUD de documentos
│   │   │   ├── llm-models/  # Configuração de modelos LLM
│   │   │   └── llm-config/  # Configuração da empresa
│   │   ├── admin/           # Páginas de administração
│   │   ├── modules/         # Páginas de módulos
│   │   ├── knowledge/       # Páginas de documentos
│   │   ├── chat.tsx         # Interface do chat IA
│   │   ├── dashboard.tsx    # Dashboard principal
│   │   ├── profile.tsx      # Perfil do usuário
│   │   └── login.tsx        # Página de login
│   ├── styles/
│   │   └── globals.css      # Estilos globais + Tailwind
│   └── types/
│       └── index.ts         # Tipos TypeScript
├── public/
│   └── uploads/             # Arquivos enviados
│       └── images/          # Imagens do editor
├── .env                     # Variáveis de ambiente
├── init_db.py               # Script de inicialização do banco
└── package.json
```

---

## 🗄️ Banco de Dados

### Diagrama de Tabelas

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   users     │────<│ permissions │     │    modules      │
└─────────────┘     └─────────────┘     └─────────────────┘
       │                                        │
       │            ┌───────────────┐           │
       └───────────>│ module_access │<──────────┘
                    └───────────────┘
       │                                        │
       │            ┌───────────────┐           │
       └───────────>│ knowledge_base│<──────────┘
                    └───────────────┘
                           │
                    ┌──────┴──────┐
                    │ attachments │
                    └─────────────┘

┌─────────────┐     ┌─────────────────────┐
│  llm_config │     │     llm_models      │
└─────────────┘     └─────────────────────┘

┌─────────────────────┐     ┌─────────────────┐
│ chat_conversations  │────<│  chat_messages  │
└─────────────────────┘     └─────────────────┘
```

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema |
| `permissions` | Permissões (cadastrar, batepapo) |
| `modules` | Módulos/categorias |
| `module_access` | Acesso de usuários aos módulos |
| `knowledge_base` | Documentos da base de conhecimento |
| `attachments` | Anexos dos documentos |
| `llm_config` | Configuração da empresa para o chat |
| `llm_models` | Modelos LLM configurados |
| `chat_conversations` | Conversas do chat |
| `chat_messages` | Mensagens das conversas |

---

## 👤 Perfis de Usuário

### 🔴 Administrador (adm)
- ✅ Acesso total ao sistema
- ✅ Criar/editar/excluir usuários
- ✅ Criar/editar/excluir módulos
- ✅ Definir permissões e acessos
- ✅ Configurar modelos LLM
- ✅ Criar/editar/excluir documentos em qualquer módulo

### 🔵 Usuário (user)
- ✅ Acesso apenas aos módulos liberados
- ✅ Criar documentos (se tiver permissão "cadastrar")
- ✅ Editar/excluir apenas seus próprios documentos
- ✅ Acessar bate-papo (se tiver permissão "batepapo")
- ✅ Alterar própria senha

---

## 🖼️ Upload de Imagens

O sistema suporta colar imagens diretamente no editor:

1. **Copie** uma imagem (Print Screen, Ctrl+C em uma imagem, etc.)
2. **Cole** no editor (Ctrl+V)
3. A imagem é **automaticamente enviada** para o servidor
4. A imagem é **salva** em `public/uploads/images/`
5. A **URL** é inserida no conteúdo

> 💡 As imagens da base de conhecimento são automaticamente incluídas como contexto para o chat IA!

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento (porta 3001) |
| `npm run build` | Gera build de produção |
| `npm run start` | Inicia servidor de produção |
| `npm run lint` | Executa o linter |
| `python init_db.py` | Inicializa o banco de dados |

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **Next.js 14** - Framework React com SSR
- **React 18** - Biblioteca de UI
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização utilitária
- **Lucide React** - Ícones

### Backend
- **Next.js API Routes** - Endpoints REST
- **NextAuth.js** - Autenticação
- **mysql2** - Driver MySQL
- **bcryptjs** - Hash de senhas
- **formidable** - Upload de arquivos

### Banco de Dados
- **MySQL 8** - Banco relacional

### Integrações
- **OpenAI API**
- **Anthropic API**
- **DeepSeek API**
- **OpenRouter API**
- **Ollama** (local)
- **LM Studio** (local)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um Fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona NovaFeature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abrir um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<div align="center">

**AskForge-AI** - Desenvolvido com ❤️ usando Next.js e TypeScript

</div>

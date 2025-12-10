"""
Script de inicialização do banco de dados MySQL
Execute este script para criar todas as tabelas necessárias e o usuário admin padrão.

Uso: python init_db.py
"""

import mysql.connector
from mysql.connector import Error
import hashlib
import os
from dotenv import load_dotenv

# Carrega variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações do banco de dados
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'acore'),
    'password': os.getenv('DB_PASSWORD', 'acore'),
}

DB_NAME = os.getenv('DB_NAME', 'knowledge_base')

def hash_password(password: str) -> str:
    """Gera hash da senha usando bcrypt-like (SHA256 para simplicidade no Python)"""
    import bcrypt
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_database(cursor):
    """Cria o banco de dados se não existir"""
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    cursor.execute(f"USE {DB_NAME}")
    print(f"✓ Banco de dados '{DB_NAME}' criado/selecionado com sucesso!")

def create_tables(cursor):
    """Cria todas as tabelas necessárias"""
    
    # Tabela de usuários
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            senha VARCHAR(255) NOT NULL,
            grupo ENUM('adm', 'user') NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'users' criada com sucesso!")
    
    # Tabela de permissões
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            cadastrar BOOLEAN DEFAULT FALSE,
            batepapo BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'permissions' criada com sucesso!")
    
    # Tabela de módulos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS modules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(255) NOT NULL UNIQUE,
            descricao TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'modules' criada com sucesso!")
    
    # Tabela de acesso aos módulos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS module_access (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            module_id INT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_module (user_id, module_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'module_access' criada com sucesso!")
    
    # Tabela de sistemas (dentro de cada módulo)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS systems (
            id INT AUTO_INCREMENT PRIMARY KEY,
            module_id INT NOT NULL,
            nome VARCHAR(255) NOT NULL,
            descricao TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
            UNIQUE KEY unique_system_module (nome, module_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'systems' criada com sucesso!")
    
    # Tabela de base de conhecimento
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_base (
            id INT AUTO_INCREMENT PRIMARY KEY,
            module_id INT NOT NULL,
            system_id INT,
            created_by INT NOT NULL,
            titulo VARCHAR(500) NOT NULL,
            conteudo LONGTEXT,
            tags VARCHAR(500),
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
            FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'knowledge_base' criada com sucesso!")
    
    # Tabela de anexos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attachments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            knowledge_id INT NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_type VARCHAR(100),
            file_size INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (knowledge_id) REFERENCES knowledge_base(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'attachments' criada com sucesso!")
    
    # Tabela de configurações do LLM
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS llm_config (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome_empresa VARCHAR(255) NOT NULL,
            prompt_sistema LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'llm_config' criada com sucesso!")
    
    # Tabela de modelos LLM
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS llm_models (
            id INT AUTO_INCREMENT PRIMARY KEY,
            provider ENUM('openai', 'anthropic', 'deepseek', 'lmstudio', 'ollama', 'openrouter') NOT NULL,
            nome VARCHAR(255) NOT NULL,
            modelo VARCHAR(255) NOT NULL,
            api_key VARCHAR(500),
            api_url VARCHAR(500),
            visualiza_imagem BOOLEAN DEFAULT FALSE,
            ativo BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'llm_models' criada com sucesso!")
    
    # Tabela de conversas do chat
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_conversations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            module_id INT NOT NULL,
            system_id INT,
            titulo VARCHAR(255) DEFAULT 'Nova conversa',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
            FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'chat_conversations' criada com sucesso!")
    
    # Tabela de mensagens do chat
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            role ENUM('user', 'assistant', 'system') NOT NULL,
            content LONGTEXT NOT NULL,
            image_url VARCHAR(500),
            file_url VARCHAR(500),
            file_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'chat_messages' criada com sucesso!")
    
    # Tabela de feedback das respostas do chat
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_feedback (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            user_id INT NOT NULL,
            user_message LONGTEXT NOT NULL,
            assistant_response LONGTEXT NOT NULL,
            conversation_history LONGTEXT,
            knowledge_base_sent LONGTEXT,
            feedback ENUM('positive', 'negative') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("✓ Tabela 'chat_feedback' criada com sucesso!")

def create_admin_user(cursor):
    """Cria o usuário administrador padrão"""
    try:
        # Verifica se já existe um admin
        cursor.execute("SELECT id FROM users WHERE email = 'admin@admin.com'")
        if cursor.fetchone():
            print("⚠ Usuário admin já existe!")
            return
        
        # Hash da senha 'admin123'
        import bcrypt
        senha_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Insere o usuário admin
        cursor.execute("""
            INSERT INTO users (nome, email, senha, grupo)
            VALUES ('Administrador', 'admin@admin.com', %s, 'adm')
        """, (senha_hash,))
        
        admin_id = cursor.lastrowid
        
        # Cria permissões para o admin (todas ativas)
        cursor.execute("""
            INSERT INTO permissions (user_id, cadastrar, batepapo)
            VALUES (%s, TRUE, TRUE)
        """, (admin_id,))
        
        print("✓ Usuário admin criado com sucesso!")
        print("  Email: admin@admin.com")
        print("  Senha: admin123")
        
    except Error as e:
        print(f"✗ Erro ao criar usuário admin: {e}")

def create_sample_modules(cursor):
    """Cria módulos de exemplo"""
    modules = [
        ('Faturamento', 'Módulo de faturamento e notas fiscais'),
        ('Recebimento', 'Módulo de contas a receber'),
        ('Financeiro', 'Módulo financeiro geral'),
        ('RH', 'Recursos Humanos'),
        ('TI', 'Tecnologia da Informação'),
    ]
    
    for nome, descricao in modules:
        try:
            cursor.execute("""
                INSERT IGNORE INTO modules (nome, descricao)
                VALUES (%s, %s)
            """, (nome, descricao))
        except Error:
            pass
    
    print("✓ Módulos de exemplo criados!")

def main():
    """Função principal"""
    print("=" * 50)
    print("Inicialização do Banco de Dados - Knowledge Base")
    print("=" * 50)
    print()
    
    try:
        # Conecta ao MySQL
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        print("✓ Conectado ao MySQL com sucesso!")
        print()
        
        # Cria o banco de dados
        create_database(cursor)
        print()
        
        # Cria as tabelas
        print("Criando tabelas...")
        create_tables(cursor)
        print()
        
        # Cria o usuário admin
        print("Criando usuário administrador...")
        create_admin_user(cursor)
        print()
        
        # Cria módulos de exemplo
        print("Criando módulos de exemplo...")
        create_sample_modules(cursor)
        print()
        
        # Commit das alterações
        connection.commit()
        
        print("=" * 50)
        print("✓ Banco de dados inicializado com sucesso!")
        print("=" * 50)
        
    except Error as e:
        print(f"✗ Erro ao conectar ao MySQL: {e}")
        print()
        print("Verifique se:")
        print("1. O MySQL está rodando")
        print("2. As credenciais no arquivo .env estão corretas")
        print("3. O usuário tem permissão para criar bancos de dados")
        
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()
            print("\n✓ Conexão fechada.")

if __name__ == "__main__":
    # Instala bcrypt se não estiver instalado
    try:
        import bcrypt
    except ImportError:
        print("Instalando dependência bcrypt...")
        import subprocess
        subprocess.check_call(['pip', 'install', 'bcrypt', 'mysql-connector-python', 'python-dotenv'])
        import bcrypt
    
    main()

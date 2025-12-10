"""
Script de migração para adicionar suporte a Sistemas
Execute este script para atualizar o banco de dados existente.

Uso: python migrate_systems.py
"""

import mysql.connector
from mysql.connector import Error
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
    'database': os.getenv('DB_NAME', 'knowledge_base'),
}

def run_migration():
    """Executa a migração para adicionar suporte a sistemas"""
    print("=" * 50)
    print("Migração: Adicionando suporte a Sistemas")
    print("=" * 50)
    print()
    
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        print("✓ Conectado ao banco de dados!")
        print()
        
        # 1. Criar tabela de sistemas
        print("1. Criando tabela 'systems'...")
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
        print("   ✓ Tabela 'systems' criada/verificada!")
        
        # 2. Verificar e adicionar coluna system_id em knowledge_base
        print("2. Adicionando coluna 'system_id' em 'knowledge_base'...")
        try:
            cursor.execute("ALTER TABLE knowledge_base ADD COLUMN system_id INT NULL AFTER module_id")
            print("   ✓ Coluna adicionada!")
        except Error as e:
            if "Duplicate column name" in str(e):
                print("   ⚠ Coluna já existe, pulando...")
            else:
                raise e
        
        # Adicionar foreign key se não existir
        try:
            cursor.execute("""
                ALTER TABLE knowledge_base 
                ADD CONSTRAINT fk_kb_system 
                FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE SET NULL
            """)
            print("   ✓ Foreign key adicionada!")
        except Error as e:
            if "Duplicate key name" in str(e) or "already exists" in str(e).lower():
                print("   ⚠ Foreign key já existe, pulando...")
            else:
                print(f"   ⚠ Aviso: {e}")
        
        # 3. Verificar e adicionar coluna system_id em chat_conversations
        print("3. Adicionando coluna 'system_id' em 'chat_conversations'...")
        try:
            cursor.execute("ALTER TABLE chat_conversations ADD COLUMN system_id INT NULL AFTER module_id")
            print("   ✓ Coluna adicionada!")
        except Error as e:
            if "Duplicate column name" in str(e):
                print("   ⚠ Coluna já existe, pulando...")
            else:
                raise e
        
        # Adicionar foreign key se não existir
        try:
            cursor.execute("""
                ALTER TABLE chat_conversations 
                ADD CONSTRAINT fk_conv_system 
                FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE SET NULL
            """)
            print("   ✓ Foreign key adicionada!")
        except Error as e:
            if "Duplicate key name" in str(e) or "already exists" in str(e).lower():
                print("   ⚠ Foreign key já existe, pulando...")
            else:
                print(f"   ⚠ Aviso: {e}")
        
        # Commit das alterações
        connection.commit()
        
        print()
        print("=" * 50)
        print("✓ Migração concluída com sucesso!")
        print("=" * 50)
        print()
        print("Agora você pode:")
        print("1. Acessar Admin > Módulos")
        print("2. Expandir um módulo e clicar em 'Novo' para criar sistemas")
        print("3. Ex: No módulo 'Faturamento', criar sistemas: Datasul, Veragi, Neogrid")
        print()
        
    except Error as e:
        print(f"✗ Erro durante a migração: {e}")
        
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()
            print("✓ Conexão fechada.")

if __name__ == "__main__":
    run_migration()

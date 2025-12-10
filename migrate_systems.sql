-- Script de migração para adicionar suporte a Sistemas
-- Execute este script no MySQL para atualizar o banco de dados existente

-- 1. Criar tabela de sistemas
CREATE TABLE IF NOT EXISTS systems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    UNIQUE KEY unique_system_module (nome, module_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Adicionar coluna system_id na tabela knowledge_base (se não existir)
ALTER TABLE knowledge_base 
ADD COLUMN IF NOT EXISTS system_id INT NULL AFTER module_id,
ADD CONSTRAINT fk_kb_system FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE SET NULL;

-- 3. Adicionar coluna system_id na tabela chat_conversations (se não existir)
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS system_id INT NULL AFTER module_id,
ADD CONSTRAINT fk_conv_system FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE SET NULL;

-- Mensagem de sucesso
SELECT 'Migração concluída com sucesso! Tabela systems criada e colunas system_id adicionadas.' as status;

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Aplicativo de Gerenciamento de Usuários
Sistema de Base de Conhecimento

Este script permite criar, editar e excluir usuários do sistema
diretamente no banco de dados MySQL.
"""

import mysql.connector
from mysql.connector import Error
import os
import sys
import bcrypt
from dotenv import load_dotenv
from getpass import getpass

# Carrega variáveis de ambiente
load_dotenv()

# Configurações do banco de dados
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'acore'),
    'password': os.getenv('DB_PASSWORD', 'acore'),
    'database': os.getenv('DB_NAME', 'knowledge_base'),
}

def get_connection():
    """Cria conexão com o banco de dados"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except Error as e:
        print(f"❌ Erro ao conectar ao banco de dados: {e}")
        return None

def hash_password(password):
    """Gera hash da senha usando bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password, hashed):
    """Verifica se a senha corresponde ao hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def clear_screen():
    """Limpa a tela do terminal"""
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header():
    """Imprime o cabeçalho do aplicativo"""
    print("=" * 60)
    print("   GERENCIADOR DE USUÁRIOS - BASE DE CONHECIMENTO")
    print("=" * 60)
    print()

def list_users(cursor):
    """Lista todos os usuários do sistema"""
    cursor.execute("""
        SELECT u.id, u.nome, u.email, u.grupo, 
               COALESCE(p.cadastrar, 0) as cadastrar,
               COALESCE(p.batepapo, 0) as batepapo,
               u.created_at
        FROM users u
        LEFT JOIN permissions p ON u.id = p.user_id
        ORDER BY u.id
    """)
    users = cursor.fetchall()
    
    if not users:
        print("Nenhum usuário cadastrado.")
        return
    
    print("\n" + "-" * 100)
    print(f"{'ID':<5} {'Nome':<25} {'Email':<30} {'Grupo':<10} {'Cadastrar':<10} {'Bate-papo':<10}")
    print("-" * 100)
    
    for user in users:
        cadastrar = "✓" if user[4] else "✗"
        batepapo = "✓" if user[5] else "✗"
        print(f"{user[0]:<5} {user[1]:<25} {user[2]:<30} {user[3]:<10} {cadastrar:<10} {batepapo:<10}")
    
    print("-" * 100)
    print(f"Total: {len(users)} usuário(s)")

def create_user(cursor, conn):
    """Cria um novo usuário"""
    print("\n--- CRIAR NOVO USUÁRIO ---\n")
    
    nome = input("Nome: ").strip()
    if not nome:
        print("❌ Nome é obrigatório!")
        return
    
    email = input("Email: ").strip()
    if not email:
        print("❌ Email é obrigatório!")
        return
    
    # Verifica se email já existe
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        print("❌ Este email já está cadastrado!")
        return
    
    senha = getpass("Senha: ")
    if len(senha) < 6:
        print("❌ A senha deve ter pelo menos 6 caracteres!")
        return
    
    confirma_senha = getpass("Confirmar senha: ")
    if senha != confirma_senha:
        print("❌ As senhas não coincidem!")
        return
    
    print("\nTipo de usuário:")
    print("1. Administrador (adm)")
    print("2. Usuário comum (user)")
    tipo = input("Escolha [1/2]: ").strip()
    
    grupo = 'adm' if tipo == '1' else 'user'
    
    # Permissões (apenas para usuários comuns)
    cadastrar = False
    batepapo = False
    
    if grupo == 'user':
        print("\nPermissões:")
        cadastrar = input("Pode cadastrar documentos? [s/N]: ").strip().lower() == 's'
        batepapo = input("Pode usar bate-papo? [s/N]: ").strip().lower() == 's'
    
    try:
        # Cria o usuário
        senha_hash = hash_password(senha)
        cursor.execute(
            "INSERT INTO users (nome, email, senha, grupo) VALUES (%s, %s, %s, %s)",
            (nome, email, senha_hash, grupo)
        )
        user_id = cursor.lastrowid
        
        # Cria as permissões
        cursor.execute(
            "INSERT INTO permissions (user_id, cadastrar, batepapo) VALUES (%s, %s, %s)",
            (user_id, cadastrar, batepapo)
        )
        
        conn.commit()
        print(f"\n✅ Usuário '{nome}' criado com sucesso! (ID: {user_id})")
        
    except Error as e:
        conn.rollback()
        print(f"❌ Erro ao criar usuário: {e}")

def edit_user(cursor, conn):
    """Edita um usuário existente"""
    print("\n--- EDITAR USUÁRIO ---\n")
    
    list_users(cursor)
    
    user_id = input("\nDigite o ID do usuário para editar (0 para cancelar): ").strip()
    if user_id == '0':
        return
    
    try:
        user_id = int(user_id)
    except ValueError:
        print("❌ ID inválido!")
        return
    
    # Busca o usuário
    cursor.execute("""
        SELECT u.*, p.cadastrar, p.batepapo
        FROM users u
        LEFT JOIN permissions p ON u.id = p.user_id
        WHERE u.id = %s
    """, (user_id,))
    user = cursor.fetchone()
    
    if not user:
        print("❌ Usuário não encontrado!")
        return
    
    print(f"\nEditando: {user[1]} ({user[2]})")
    print("Deixe em branco para manter o valor atual.\n")
    
    # Nome
    novo_nome = input(f"Nome [{user[1]}]: ").strip()
    if not novo_nome:
        novo_nome = user[1]
    
    # Email
    novo_email = input(f"Email [{user[2]}]: ").strip()
    if not novo_email:
        novo_email = user[2]
    elif novo_email != user[2]:
        cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (novo_email, user_id))
        if cursor.fetchone():
            print("❌ Este email já está em uso!")
            return
    
    # Senha
    print("\nAlterar senha?")
    alterar_senha = input("Digite nova senha (ou Enter para manter): ")
    nova_senha_hash = None
    if alterar_senha:
        if len(alterar_senha) < 6:
            print("❌ A senha deve ter pelo menos 6 caracteres!")
            return
        confirma = getpass("Confirmar nova senha: ")
        if alterar_senha != confirma:
            print("❌ As senhas não coincidem!")
            return
        nova_senha_hash = hash_password(alterar_senha)
    
    # Grupo
    print(f"\nGrupo atual: {user[4]}")
    print("1. Administrador (adm)")
    print("2. Usuário comum (user)")
    print("3. Manter atual")
    tipo = input("Escolha [1/2/3]: ").strip()
    
    if tipo == '1':
        novo_grupo = 'adm'
    elif tipo == '2':
        novo_grupo = 'user'
    else:
        novo_grupo = user[4]
    
    # Permissões
    cadastrar = user[7] if user[7] is not None else False
    batepapo = user[8] if user[8] is not None else False
    
    if novo_grupo == 'user':
        print(f"\nPermissões atuais: Cadastrar={'✓' if cadastrar else '✗'}, Bate-papo={'✓' if batepapo else '✗'}")
        alterar_perm = input("Alterar permissões? [s/N]: ").strip().lower() == 's'
        if alterar_perm:
            cadastrar = input("Pode cadastrar documentos? [s/N]: ").strip().lower() == 's'
            batepapo = input("Pode usar bate-papo? [s/N]: ").strip().lower() == 's'
    
    try:
        # Atualiza o usuário
        if nova_senha_hash:
            cursor.execute(
                "UPDATE users SET nome = %s, email = %s, senha = %s, grupo = %s WHERE id = %s",
                (novo_nome, novo_email, nova_senha_hash, novo_grupo, user_id)
            )
        else:
            cursor.execute(
                "UPDATE users SET nome = %s, email = %s, grupo = %s WHERE id = %s",
                (novo_nome, novo_email, novo_grupo, user_id)
            )
        
        # Atualiza ou cria permissões
        cursor.execute("SELECT id FROM permissions WHERE user_id = %s", (user_id,))
        if cursor.fetchone():
            cursor.execute(
                "UPDATE permissions SET cadastrar = %s, batepapo = %s WHERE user_id = %s",
                (cadastrar, batepapo, user_id)
            )
        else:
            cursor.execute(
                "INSERT INTO permissions (user_id, cadastrar, batepapo) VALUES (%s, %s, %s)",
                (user_id, cadastrar, batepapo)
            )
        
        conn.commit()
        print(f"\n✅ Usuário atualizado com sucesso!")
        
    except Error as e:
        conn.rollback()
        print(f"❌ Erro ao atualizar usuário: {e}")

def delete_user(cursor, conn):
    """Exclui um usuário"""
    print("\n--- EXCLUIR USUÁRIO ---\n")
    
    list_users(cursor)
    
    user_id = input("\nDigite o ID do usuário para excluir (0 para cancelar): ").strip()
    if user_id == '0':
        return
    
    try:
        user_id = int(user_id)
    except ValueError:
        print("❌ ID inválido!")
        return
    
    # Busca o usuário
    cursor.execute("SELECT nome, email FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        print("❌ Usuário não encontrado!")
        return
    
    print(f"\n⚠️  Você está prestes a excluir: {user[0]} ({user[1]})")
    print("Esta ação não pode ser desfeita!")
    
    confirma = input("\nDigite 'EXCLUIR' para confirmar: ").strip()
    
    if confirma != 'EXCLUIR':
        print("Operação cancelada.")
        return
    
    try:
        # Exclui permissões primeiro (por causa da FK)
        cursor.execute("DELETE FROM permissions WHERE user_id = %s", (user_id,))
        
        # Exclui acessos a módulos
        cursor.execute("DELETE FROM module_access WHERE user_id = %s", (user_id,))
        
        # Exclui o usuário
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        
        conn.commit()
        print(f"\n✅ Usuário excluído com sucesso!")
        
    except Error as e:
        conn.rollback()
        print(f"❌ Erro ao excluir usuário: {e}")

def reset_password(cursor, conn):
    """Reseta a senha de um usuário"""
    print("\n--- RESETAR SENHA ---\n")
    
    list_users(cursor)
    
    user_id = input("\nDigite o ID do usuário (0 para cancelar): ").strip()
    if user_id == '0':
        return
    
    try:
        user_id = int(user_id)
    except ValueError:
        print("❌ ID inválido!")
        return
    
    # Busca o usuário
    cursor.execute("SELECT nome, email FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        print("❌ Usuário não encontrado!")
        return
    
    print(f"\nResetando senha de: {user[0]} ({user[1]})")
    
    nova_senha = getpass("Nova senha: ")
    if len(nova_senha) < 6:
        print("❌ A senha deve ter pelo menos 6 caracteres!")
        return
    
    confirma = getpass("Confirmar nova senha: ")
    if nova_senha != confirma:
        print("❌ As senhas não coincidem!")
        return
    
    try:
        senha_hash = hash_password(nova_senha)
        cursor.execute("UPDATE users SET senha = %s WHERE id = %s", (senha_hash, user_id))
        conn.commit()
        print(f"\n✅ Senha resetada com sucesso!")
        
    except Error as e:
        conn.rollback()
        print(f"❌ Erro ao resetar senha: {e}")

def main_menu():
    """Menu principal do aplicativo"""
    conn = get_connection()
    if not conn:
        print("Não foi possível conectar ao banco de dados.")
        print("Verifique as configurações no arquivo .env")
        sys.exit(1)
    
    cursor = conn.cursor()
    
    while True:
        clear_screen()
        print_header()
        
        print("MENU PRINCIPAL")
        print("-" * 30)
        print("1. Listar usuários")
        print("2. Criar usuário")
        print("3. Editar usuário")
        print("4. Excluir usuário")
        print("5. Resetar senha")
        print("0. Sair")
        print("-" * 30)
        
        opcao = input("\nEscolha uma opção: ").strip()
        
        if opcao == '1':
            clear_screen()
            print_header()
            list_users(cursor)
            input("\nPressione Enter para continuar...")
            
        elif opcao == '2':
            clear_screen()
            print_header()
            create_user(cursor, conn)
            input("\nPressione Enter para continuar...")
            
        elif opcao == '3':
            clear_screen()
            print_header()
            edit_user(cursor, conn)
            input("\nPressione Enter para continuar...")
            
        elif opcao == '4':
            clear_screen()
            print_header()
            delete_user(cursor, conn)
            input("\nPressione Enter para continuar...")
            
        elif opcao == '5':
            clear_screen()
            print_header()
            reset_password(cursor, conn)
            input("\nPressione Enter para continuar...")
            
        elif opcao == '0':
            print("\nAté logo!")
            break
        
        else:
            print("\n❌ Opção inválida!")
            input("Pressione Enter para continuar...")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    try:
        main_menu()
    except KeyboardInterrupt:
        print("\n\nOperação cancelada pelo usuário.")
        sys.exit(0)

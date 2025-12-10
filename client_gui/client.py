#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AskForge-AI Desktop Client
Cliente desktop para o sistema de Base de Conhecimento
"""

import os
import sys
import json
import re
import io
import threading
import webbrowser
import requests
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse

import ttkbootstrap as ttk
from ttkbootstrap.constants import *
# ScrolledFrame removido - usando Canvas padrão
from ttkbootstrap.dialogs import Messagebox
from tkinter import PhotoImage
import tkinter as tk

# Para system tray e imagens
try:
    import pystray
    from PIL import Image as PILImage, ImageTk
    TRAY_AVAILABLE = True
    PIL_AVAILABLE = True
except ImportError:
    TRAY_AVAILABLE = False
    PIL_AVAILABLE = False
    PILImage = None
    ImageTk = None

# Para hotkey global
try:
    import keyboard
    KEYBOARD_AVAILABLE = True
except ImportError:
    KEYBOARD_AVAILABLE = False

# Para notificações toast (usando ttkbootstrap)
try:
    from ttkbootstrap.toast import ToastNotification
    TOAST_AVAILABLE = True
except ImportError:
    TOAST_AVAILABLE = False
    ToastNotification = None

# Para notificações Windows com callback de clique
try:
    from winotify import Notification, audio
    WINOTIFY_AVAILABLE = True
except ImportError:
    WINOTIFY_AVAILABLE = False
    Notification = None

# Para instância única
import ctypes
from ctypes import wintypes


# ============================================================================
# CONFIGURAÇÕES
# ============================================================================

APP_NAME = "AskForge-AI"
APP_VERSION = "1.0.0"
CONFIG_DIR = Path(os.getenv('APPDATA', os.path.expanduser('~'))) / APP_NAME
CONFIG_FILE = CONFIG_DIR / "config.json"
DEFAULT_HOTKEY = "ctrl+k"
SINGLE_INSTANCE_MUTEX_NAME = "AskForgeAI_SingleInstance_Mutex"


def get_config_path():
    """Retorna o caminho do arquivo de configuração"""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return CONFIG_FILE


def load_config():
    """Carrega configurações do arquivo JSON"""
    config_path = get_config_path()
    if config_path.exists():
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return None


# ============================================================================
# INSTÂNCIA ÚNICA
# ============================================================================

class SingleInstance:
    """Garante que apenas uma instância do aplicativo esteja rodando"""
    
    def __init__(self):
        self.mutex = None
        self.hwnd_file = CONFIG_DIR / "hwnd.txt"
    
    def is_already_running(self):
        """Verifica se já existe uma instância rodando"""
        try:
            # Tenta criar um mutex nomeado
            self.mutex = ctypes.windll.kernel32.CreateMutexW(
                None, 
                ctypes.c_bool(False), 
                SINGLE_INSTANCE_MUTEX_NAME
            )
            
            # Se o mutex já existe, outra instância está rodando
            last_error = ctypes.windll.kernel32.GetLastError()
            ERROR_ALREADY_EXISTS = 183
            
            if last_error == ERROR_ALREADY_EXISTS:
                return True
            
            return False
        except Exception as e:
            print(f"Erro ao verificar instância única: {e}")
            return False
    
    def save_hwnd(self, hwnd):
        """Salva o HWND da janela principal"""
        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            with open(self.hwnd_file, 'w') as f:
                f.write(str(hwnd))
        except Exception as e:
            print(f"Erro ao salvar HWND: {e}")
    
    def get_existing_hwnd(self):
        """Obtém o HWND da instância existente"""
        try:
            if self.hwnd_file.exists():
                with open(self.hwnd_file, 'r') as f:
                    return int(f.read().strip())
        except Exception as e:
            print(f"Erro ao ler HWND: {e}")
        return None
    
    def bring_existing_to_front(self):
        """Traz a janela existente para frente"""
        hwnd = self.get_existing_hwnd()
        if hwnd:
            try:
                user32 = ctypes.windll.user32
                
                # Constantes
                SW_RESTORE = 9
                SW_SHOW = 5
                
                # Verifica se a janela está minimizada
                if user32.IsIconic(hwnd):
                    user32.ShowWindow(hwnd, SW_RESTORE)
                else:
                    user32.ShowWindow(hwnd, SW_SHOW)
                
                # Traz para frente
                user32.SetForegroundWindow(hwnd)
                return True
            except Exception as e:
                print(f"Erro ao trazer janela para frente: {e}")
        return False
    
    def release(self):
        """Libera o mutex"""
        if self.mutex:
            try:
                ctypes.windll.kernel32.ReleaseMutex(self.mutex)
                ctypes.windll.kernel32.CloseHandle(self.mutex)
            except:
                pass


def create_selectable_text(parent, text, font=('Segoe UI', 10), wraplength=500, bg=None, padding=(10, 8)):
    """
    Cria um widget de texto selecionável (readonly) que se comporta como um Label.
    Permite copiar o conteúdo com Ctrl+C.
    """
    # Frame container para padding
    container = ttk.Frame(parent)
    
    # Calcula largura em caracteres (aproximado)
    avg_char_width = 7  # Aproximação para Segoe UI 10
    width_chars = max(20, wraplength // avg_char_width)
    
    # Calcula altura inicial mais generosa
    # Considera quebras de linha naturais + estimativa de wrap
    natural_lines = text.count('\n') + 1
    chars_per_line = max(1, width_chars)
    wrapped_lines = max(1, len(text) // chars_per_line) + 1
    estimated_height = natural_lines + wrapped_lines
    height = min(max(estimated_height, 3), 100)  # Mínimo 3, máximo 100 linhas
    
    # Cria Text widget com largura fixa
    text_widget = tk.Text(
        container,
        font=font,
        wrap=WORD,
        width=width_chars,
        height=height,
        borderwidth=0,
        highlightthickness=0,
        padx=padding[0],
        pady=padding[1],
        cursor="arrow"
    )
    
    # Insere o texto
    text_widget.insert('1.0', text)
    
    # Configura como readonly
    text_widget.config(state=DISABLED)
    
    # Permite seleção e cópia
    def enable_selection(event):
        text_widget.config(state=NORMAL)
        text_widget.config(cursor="ibeam")
    
    def disable_selection(event):
        # Mantém seleção se houver
        try:
            text_widget.selection_get()
        except:
            text_widget.config(state=DISABLED)
            text_widget.config(cursor="arrow")
    
    def copy_selection(event):
        try:
            text_widget.config(state=NORMAL)
            selected = text_widget.selection_get()
            text_widget.clipboard_clear()
            text_widget.clipboard_append(selected)
            text_widget.config(state=DISABLED)
        except:
            pass
        return "break"
    
    def select_all(event):
        text_widget.config(state=NORMAL)
        text_widget.tag_add('sel', '1.0', 'end')
        text_widget.config(state=DISABLED)
        return "break"
    
    # Bindings
    text_widget.bind('<Button-1>', enable_selection)
    text_widget.bind('<FocusOut>', disable_selection)
    text_widget.bind('<Control-c>', copy_selection)
    text_widget.bind('<Control-a>', select_all)
    
    # Permite arrastar para selecionar
    text_widget.bind('<B1-Motion>', lambda e: None)
    
    text_widget.pack(fill=BOTH, expand=YES)
    
    # Ajusta altura após renderização para contar linhas visuais (com wrap)
    def adjust_height():
        try:
            text_widget.config(state=NORMAL)
            text_widget.update_idletasks()
            
            # Conta linhas visuais usando dlineinfo
            # Vai até o final do texto e conta quantas linhas de display existem
            last_index = text_widget.index('end-1c')
            
            # Método mais confiável: usar count com -displaylines
            try:
                # Conta linhas de display do início ao fim
                display_lines = text_widget.count('1.0', 'end', 'displaylines')
                if display_lines and display_lines[0]:
                    line_count = display_lines[0]
                else:
                    # Fallback: conta linhas lógicas
                    line_count = int(last_index.split('.')[0])
            except:
                # Fallback final
                line_count = int(last_index.split('.')[0])
            
            # Adiciona margem de segurança
            line_count = max(line_count, 1) + 1
            
            text_widget.config(height=line_count)
            text_widget.config(state=DISABLED)
        except Exception as e:
            print(f"Erro ao ajustar altura: {e}")
    
    # Ajusta altura com delay maior para garantir que o layout foi calculado
    container.after(50, adjust_height)
    # Segunda tentativa para garantir
    container.after(200, adjust_height)
    
    return container


def save_config(config):
    """Salva configurações no arquivo JSON"""
    config_path = get_config_path()
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


# ============================================================================
# API CLIENT
# ============================================================================

class APIClient:
    """Cliente para comunicação com a API"""
    
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.token = None
        self.user = None
        self.csrf_token = None
    
    def _get_url(self, endpoint):
        return f"{self.base_url}/api{endpoint}"
    
    def _get_headers(self):
        headers = {
            'Content-Type': 'application/json',
        }
        if self.csrf_token:
            headers['X-CSRF-Token'] = self.csrf_token
        return headers
    
    def test_connection(self):
        """Testa conexão com a API"""
        try:
            # Tenta acessar a página principal
            response = self.session.get(self.base_url, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"Erro de conexão: {e}")
            return False
    
    def login(self, email, password):
        """Realiza login via NextAuth"""
        try:
            # Primeiro, obtém o CSRF token
            csrf_url = f"{self.base_url}/api/auth/csrf"
            csrf_response = self.session.get(csrf_url, timeout=10)
            
            if csrf_response.status_code == 200:
                csrf_data = csrf_response.json()
                self.csrf_token = csrf_data.get('csrfToken')
            
            # Faz login via NextAuth credentials
            login_url = f"{self.base_url}/api/auth/callback/credentials"
            
            data = {
                'email': email,
                'password': password,
                'csrfToken': self.csrf_token,
                'callbackUrl': self.base_url,
                'json': 'true'
            }
            
            response = self.session.post(
                login_url,
                data=data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                allow_redirects=True,
                timeout=10
            )
            
            # Verifica se o login foi bem sucedido pegando a sessão
            session_url = f"{self.base_url}/api/auth/session"
            session_response = self.session.get(session_url, timeout=10)
            
            if session_response.status_code == 200:
                session_data = session_response.json()
                if session_data and session_data.get('user'):
                    self.user = session_data['user']
                    return True, self.user
            
            return False, "Credenciais inválidas"
            
        except requests.exceptions.Timeout:
            return False, "Timeout na conexão"
        except requests.exceptions.ConnectionError:
            return False, "Erro de conexão com o servidor"
        except Exception as e:
            return False, str(e)
    
    def get_conversations(self):
        """Obtém lista de conversas do usuário"""
        try:
            response = self.session.get(
                self._get_url('/chat/conversations'),
                headers=self._get_headers(),
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            return []
        except Exception as e:
            print(f"Erro ao buscar conversas: {e}")
            return []
    
    def get_conversation_messages(self, conversation_id):
        """Obtém mensagens de uma conversa"""
        try:
            response = self.session.get(
                self._get_url(f'/chat/conversations/{conversation_id}'),
                headers=self._get_headers(),
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"Erro ao buscar mensagens: {e}")
            return None
    
    def get_modules(self):
        """Obtém lista de módulos disponíveis"""
        try:
            response = self.session.get(
                self._get_url('/modules'),
                headers=self._get_headers(),
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            return []
        except Exception as e:
            print(f"Erro ao buscar módulos: {e}")
            return []
    
    def get_systems(self, module_id):
        """Obtém sistemas de um módulo"""
        try:
            response = self.session.get(
                self._get_url(f'/systems?module_id={module_id}'),
                headers=self._get_headers(),
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            return []
        except Exception as e:
            print(f"Erro ao buscar sistemas: {e}")
            return []
    
    def get_active_model(self):
        """Obtém informações do modelo LLM ativo"""
        try:
            response = self.session.get(
                self._get_url('/llm/active-model'),
                headers=self._get_headers(),
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"Erro ao buscar modelo ativo: {e}")
            return None
    
    def send_message(self, conversation_id, module_id, system_id, message, image_base64=None):
        """Envia uma mensagem"""
        try:
            data = {
                'conversation_id': conversation_id,
                'module_id': module_id,
                'system_id': system_id,
                'message': message
            }
            
            # Adiciona imagem se houver
            if image_base64:
                data['image_base64'] = image_base64
            
            # Timeout maior quando há imagem
            timeout = 180 if image_base64 else 120
            
            response = self.session.post(
                self._get_url('/chat/send'),
                json=data,
                headers=self._get_headers(),
                timeout=timeout
            )
            
            if response.status_code == 200:
                return True, response.json()
            else:
                # Tenta extrair erro da resposta
                try:
                    if response.text:
                        error_data = response.json()
                        return False, error_data.get('error', f'Erro {response.status_code}')
                    else:
                        return False, f'Erro {response.status_code}: Resposta vazia do servidor'
                except:
                    return False, f'Erro {response.status_code}: {response.text[:200] if response.text else "Sem detalhes"}'
        except requests.exceptions.Timeout:
            return False, "Timeout - A resposta está demorando muito"
        except requests.exceptions.ConnectionError:
            return False, "Erro de conexão com o servidor"
        except Exception as e:
            return False, str(e)
    
    def delete_conversation(self, conversation_id):
        """Exclui uma conversa"""
        try:
            response = self.session.delete(
                self._get_url(f'/chat/conversations/{conversation_id}'),
                headers=self._get_headers(),
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Erro ao excluir conversa: {e}")
            return False
    
    def rename_conversation(self, conversation_id, new_title):
        """Renomeia uma conversa"""
        try:
            response = self.session.put(
                self._get_url(f'/chat/conversations/{conversation_id}'),
                json={'titulo': new_title},
                headers=self._get_headers(),
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Erro ao renomear conversa: {e}")
            return False
    
    def send_feedback(self, conversation_id, user_message, assistant_response, feedback, used_knowledge_ids=None):
        """Envia feedback (thumbs up/down) para uma resposta"""
        try:
            data = {
                'conversation_id': conversation_id,
                'user_message': user_message,
                'assistant_response': assistant_response,
                'feedback': feedback  # 'positive' ou 'negative'
            }
            
            # Adiciona IDs dos documentos usados se disponível
            if used_knowledge_ids:
                data['used_knowledge_ids'] = used_knowledge_ids
            
            response = self.session.post(
                self._get_url('/chat/feedback'),
                json=data,
                headers=self._get_headers(),
                timeout=10
            )
            
            if response.status_code in (200, 201):
                print(f"[DEBUG] Feedback '{feedback}' enviado com sucesso")
                return True
            else:
                print(f"[DEBUG] Erro ao enviar feedback: {response.status_code}")
                return False
        except Exception as e:
            print(f"Erro ao enviar feedback: {e}")
            return False


# ============================================================================
# TELA DE CONFIGURAÇÃO INICIAL
# ============================================================================

class ConfigScreen(ttk.Toplevel):
    """Tela de configuração inicial"""
    
    def __init__(self, parent, on_save_callback):
        super().__init__(parent)
        self.on_save_callback = on_save_callback
        self.result = None
        
        self.title(f"{APP_NAME} - Configuração")
        self.geometry("500x400")
        self.resizable(False, False)
        
        # Centraliza na tela
        self.update_idletasks()
        x = (self.winfo_screenwidth() - 500) // 2
        y = (self.winfo_screenheight() - 400) // 2
        self.geometry(f"+{x}+{y}")
        
        self.transient(parent)
        self.grab_set()
        
        self._create_widgets()
    
    def _create_widgets(self):
        # Frame principal
        main_frame = ttk.Frame(self, padding=30)
        main_frame.pack(fill=BOTH, expand=YES)
        
        # Título
        title_label = ttk.Label(
            main_frame,
            text="Configuração Inicial",
            font=('Segoe UI', 18, 'bold'),
            bootstyle="primary"
        )
        title_label.pack(pady=(0, 10))
        
        # Descrição
        desc_label = ttk.Label(
            main_frame,
            text="Configure a URL da API para conectar ao servidor",
            font=('Segoe UI', 10),
            foreground='gray'
        )
        desc_label.pack(pady=(0, 30))
        
        # Campo URL
        url_frame = ttk.Frame(main_frame)
        url_frame.pack(fill=X, pady=10)
        
        ttk.Label(url_frame, text="URL da API:", font=('Segoe UI', 10)).pack(anchor=W)
        
        self.url_entry = ttk.Entry(url_frame, font=('Segoe UI', 11))
        self.url_entry.pack(fill=X, pady=(5, 0))
        self.url_entry.insert(0, "http://localhost:3000")
        
        # Dica
        hint_label = ttk.Label(
            main_frame,
            text="Exemplo: http://192.168.1.100:3000",
            font=('Segoe UI', 9),
            foreground='gray'
        )
        hint_label.pack(anchor=W, pady=(5, 20))
        
        # Status
        self.status_label = ttk.Label(
            main_frame,
            text="",
            font=('Segoe UI', 10)
        )
        self.status_label.pack(pady=10)
        
        # Botões
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=X, pady=(20, 0))
        
        self.test_btn = ttk.Button(
            btn_frame,
            text="Testar Conexão",
            bootstyle="info-outline",
            command=self._test_connection
        )
        self.test_btn.pack(side=LEFT)
        
        self.save_btn = ttk.Button(
            btn_frame,
            text="OK",
            bootstyle="success",
            command=self._save_config,
            width=15
        )
        self.save_btn.pack(side=RIGHT)
    
    def _test_connection(self):
        url = self.url_entry.get().strip()
        if not url:
            self.status_label.config(text="Digite uma URL", foreground='red')
            return
        
        self.status_label.config(text="Testando conexão...", foreground='gray')
        self.update()
        
        client = APIClient(url)
        if client.test_connection():
            self.status_label.config(text="✓ Conexão estabelecida!", foreground='green')
        else:
            self.status_label.config(text="✗ Falha na conexão", foreground='red')
    
    def _save_config(self):
        url = self.url_entry.get().strip()
        if not url:
            Messagebox.show_error("Digite a URL da API", "Erro")
            return
        
        # Testa conexão antes de salvar
        client = APIClient(url)
        if not client.test_connection():
            if not Messagebox.yesno(
                "Não foi possível conectar ao servidor.\nDeseja salvar mesmo assim?",
                "Aviso"
            ):
                return
        
        config = {
            'api_url': url,
            'hotkey': DEFAULT_HOTKEY,
            'created_at': datetime.now().isoformat()
        }
        save_config(config)
        
        self.result = config
        self.on_save_callback(config)
        self.destroy()


# ============================================================================
# DIÁLOGO DE ERRO DE CONEXÃO
# ============================================================================

class ConnectionErrorDialog(ttk.Toplevel):
    """Diálogo para configurar novo IP quando conexão falha"""
    
    def __init__(self, parent, current_url, on_save_callback):
        super().__init__(parent)
        self.current_url = current_url
        self.on_save_callback = on_save_callback
        
        self.title("Erro de Conexão")
        self.geometry("450x320")
        self.resizable(False, False)
        
        # Centraliza
        self.update_idletasks()
        x = (self.winfo_screenwidth() - 450) // 2
        y = (self.winfo_screenheight() - 320) // 2
        self.geometry(f"+{x}+{y}")
        
        self.transient(parent)
        self.grab_set()
        
        self._create_widgets()
    
    def _create_widgets(self):
        main_frame = ttk.Frame(self, padding=20)
        main_frame.pack(fill=BOTH, expand=YES)
        
        # Ícone de erro
        error_frame = ttk.Frame(main_frame)
        error_frame.pack(pady=(0, 15))
        
        ttk.Label(
            error_frame,
            text="⚠️",
            font=('Segoe UI', 32)
        ).pack()
        
        # Mensagem
        ttk.Label(
            main_frame,
            text="Não foi possível conectar ao servidor",
            font=('Segoe UI', 12, 'bold'),
            foreground='#e74c3c'
        ).pack()
        
        ttk.Label(
            main_frame,
            text="Verifique se o endereço do servidor está correto:",
            font=('Segoe UI', 10),
            foreground='gray'
        ).pack(pady=(5, 15))
        
        # Campo de URL
        url_frame = ttk.Frame(main_frame)
        url_frame.pack(fill=X, pady=(0, 10))
        
        ttk.Label(url_frame, text="URL do Servidor:", font=('Segoe UI', 10)).pack(anchor=W)
        self.url_entry = ttk.Entry(url_frame, font=('Segoe UI', 11))
        self.url_entry.pack(fill=X, pady=(5, 0))
        self.url_entry.insert(0, self.current_url)
        self.url_entry.select_range(0, END)
        self.url_entry.focus()
        
        # Dica
        ttk.Label(
            main_frame,
            text="Exemplo: http://192.168.1.100:3001",
            font=('Segoe UI', 9),
            foreground='gray'
        ).pack(anchor=W)
        
        # Botões
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=X, pady=(20, 0))
        
        ttk.Button(
            btn_frame,
            text="Cancelar",
            bootstyle="secondary-outline",
            command=self.destroy
        ).pack(side=LEFT)
        
        ttk.Button(
            btn_frame,
            text="Salvar e Tentar Novamente",
            bootstyle="success",
            command=self._save
        ).pack(side=RIGHT)
        
        # Bind Enter
        self.url_entry.bind('<Return>', lambda e: self._save())
    
    def _save(self):
        """Salva nova URL"""
        new_url = self.url_entry.get().strip()
        
        if not new_url:
            Messagebox.show_warning("Digite a URL do servidor", "Aviso")
            return
        
        # Adiciona http:// se não tiver protocolo
        if not new_url.startswith('http://') and not new_url.startswith('https://'):
            new_url = f"http://{new_url}"
        
        self.on_save_callback(new_url)
        self.destroy()


# ============================================================================
# TELA DE LOGIN
# ============================================================================

class LoginScreen(ttk.Frame):
    """Tela de login"""
    
    def __init__(self, parent, api_client, on_login_callback, on_config_callback=None):
        super().__init__(parent)
        self.api_client = api_client
        self.on_login_callback = on_login_callback
        self.on_config_callback = on_config_callback
        self.retry_count = 0
        self.max_retries = 3
        self.loading_animation_id = None
        self.loading_dots = 0
        
        self._create_widgets()
    
    def _create_widgets(self):
        # Botão de configurações (engrenagem) no canto superior direito
        if self.on_config_callback:
            settings_btn = ttk.Button(
                self,
                text="⚙️",
                bootstyle="link",
                command=self._show_api_config,
                width=3
            )
            settings_btn.place(relx=1.0, rely=0, anchor=NE, x=-10, y=10)
        
        # Container central
        container = ttk.Frame(self)
        container.place(relx=0.5, rely=0.5, anchor=CENTER)
        
        # Logo/Título
        title_frame = ttk.Frame(container)
        title_frame.pack(pady=(0, 30))
        
        title_label = ttk.Label(
            title_frame,
            text="🧠 AskForge-AI",
            font=('Segoe UI', 24, 'bold'),
            bootstyle="primary"
        )
        title_label.pack()
        
        subtitle_label = ttk.Label(
            title_frame,
            text="Base de Conhecimento",
            font=('Segoe UI', 12),
            foreground='gray'
        )
        subtitle_label.pack()
        
        # Form
        form_frame = ttk.Frame(container)
        form_frame.pack(fill=X, padx=50)
        
        # Email
        ttk.Label(form_frame, text="Email:", font=('Segoe UI', 10)).pack(anchor=W, pady=(10, 2))
        self.email_entry = ttk.Entry(form_frame, font=('Segoe UI', 11), width=35)
        self.email_entry.pack(fill=X)
        self.email_entry.bind('<Return>', lambda e: self.password_entry.focus())
        
        # Senha
        ttk.Label(form_frame, text="Senha:", font=('Segoe UI', 10)).pack(anchor=W, pady=(15, 2))
        
        # Frame para senha + botão olho
        password_frame = ttk.Frame(form_frame)
        password_frame.pack(fill=X)
        
        self.password_entry = ttk.Entry(password_frame, font=('Segoe UI', 11), show="•", width=32)
        self.password_entry.pack(side=LEFT, fill=X, expand=YES)
        self.password_entry.bind('<Return>', lambda e: self._do_login())
        
        # Botão olho para mostrar/ocultar senha
        self.password_visible = False
        self.eye_btn = ttk.Button(
            password_frame,
            text="👁",
            bootstyle="link",
            command=self._toggle_password_visibility,
            width=3
        )
        self.eye_btn.pack(side=LEFT, padx=(5, 0))
        
        # Checkbox salvar credenciais
        self.save_credentials_var = tk.BooleanVar(value=False)
        self.save_credentials_check = ttk.Checkbutton(
            form_frame,
            text="Salvar credenciais",
            variable=self.save_credentials_var,
            bootstyle="round-toggle"
        )
        self.save_credentials_check.pack(anchor=W, pady=(10, 0))
        
        # Frame de loading (spinner animado)
        self.loading_frame = ttk.Frame(form_frame)
        self.loading_frame.pack(pady=(15, 0))
        
        self.loading_label = ttk.Label(
            self.loading_frame,
            text="",
            font=('Segoe UI', 14),
            foreground='#3498db'
        )
        self.loading_label.pack()
        
        # Status
        self.status_label = ttk.Label(
            form_frame,
            text="",
            font=('Segoe UI', 10),
            wraplength=300
        )
        self.status_label.pack(pady=(5, 0))
        
        # Botão Login
        self.login_btn = ttk.Button(
            form_frame,
            text="Entrar",
            bootstyle="primary",
            command=self._do_login,
            width=20
        )
        self.login_btn.pack(pady=(20, 0))
        
        # Carrega credenciais salvas
        self._load_saved_credentials()
        
        # Foco inicial
        if self.email_entry.get():
            self.password_entry.focus()
        else:
            self.email_entry.focus()
    
    def _toggle_password_visibility(self):
        """Alterna visibilidade da senha"""
        self.password_visible = not self.password_visible
        if self.password_visible:
            self.password_entry.config(show="")
            self.eye_btn.config(text="🙈")
        else:
            self.password_entry.config(show="•")
            self.eye_btn.config(text="👁")
    
    def _load_saved_credentials(self):
        """Carrega credenciais salvas"""
        try:
            cred_file = CONFIG_DIR / "credentials.json"
            if cred_file.exists():
                with open(cred_file, 'r', encoding='utf-8') as f:
                    creds = json.load(f)
                    if creds.get('email'):
                        self.email_entry.insert(0, creds['email'])
                    if creds.get('password'):
                        # Decodifica senha de base64
                        import base64
                        password = base64.b64decode(creds['password'].encode()).decode()
                        self.password_entry.insert(0, password)
                    self.save_credentials_var.set(True)
        except Exception as e:
            print(f"Erro ao carregar credenciais: {e}")
    
    def _save_credentials(self, email, password):
        """Salva credenciais no arquivo"""
        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            cred_file = CONFIG_DIR / "credentials.json"
            
            if self.save_credentials_var.get():
                # Codifica senha em base64 (ofuscação básica)
                import base64
                encoded_password = base64.b64encode(password.encode()).decode()
                creds = {'email': email, 'password': encoded_password}
                with open(cred_file, 'w', encoding='utf-8') as f:
                    json.dump(creds, f)
            else:
                # Remove arquivo de credenciais se existir
                if cred_file.exists():
                    cred_file.unlink()
        except Exception as e:
            print(f"Erro ao salvar credenciais: {e}")
    
    def _start_loading_animation(self):
        """Inicia animação de loading"""
        spinner_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        
        def animate():
            if self.loading_animation_id is None:
                return
            self.loading_dots = (self.loading_dots + 1) % len(spinner_chars)
            self.loading_label.config(text=spinner_chars[self.loading_dots])
            self.loading_animation_id = self.after(100, animate)
        
        self.loading_animation_id = self.after(0, animate)
    
    def _stop_loading_animation(self):
        """Para animação de loading"""
        if self.loading_animation_id:
            self.after_cancel(self.loading_animation_id)
            self.loading_animation_id = None
        self.loading_label.config(text="")
    
    def _do_login(self):
        email = self.email_entry.get().strip()
        password = self.password_entry.get()
        
        if not email or not password:
            self.status_label.config(text="Preencha email e senha", foreground='red')
            return
        
        # Reseta contador de retry
        self.retry_count = 0
        self._attempt_login(email, password)
    
    def _attempt_login(self, email, password):
        """Tenta fazer login com retry"""
        self.retry_count += 1
        
        retry_text = f" (tentativa {self.retry_count}/{self.max_retries})" if self.retry_count > 1 else ""
        self.status_label.config(text=f"Conectando ao servidor{retry_text}...", foreground='gray')
        self.login_btn.config(state=DISABLED)
        self._start_loading_animation()
        self.update()
        
        def do_login_thread():
            success, result = self.api_client.login(email, password)
            self.after(0, lambda: self._handle_login_result(success, result, email, password))
        
        threading.Thread(target=do_login_thread, daemon=True).start()
    
    def _handle_login_result(self, success, result, email=None, password=None):
        self._stop_loading_animation()
        
        if success:
            # Salva credenciais se marcado
            if email and password:
                self._save_credentials(email, password)
            
            self.login_btn.config(state=NORMAL)
            self.status_label.config(text="", foreground='gray')
            self.on_login_callback(result)
        else:
            # Verifica se é erro de conexão (não erro de credenciais)
            is_connection_error = self._is_connection_error(result)
            
            if is_connection_error and self.retry_count < self.max_retries and email and password:
                # Tenta novamente
                self.status_label.config(
                    text=f"Falha na conexão. Tentando novamente...", 
                    foreground='orange'
                )
                self.after(1000, lambda: self._attempt_login(email, password))
            elif is_connection_error and self.retry_count >= self.max_retries:
                # Esgotou tentativas - mostra diálogo de configuração
                self.login_btn.config(state=NORMAL)
                self.status_label.config(
                    text=f"Não foi possível conectar ao servidor após {self.max_retries} tentativas.", 
                    foreground='red'
                )
                self._show_connection_error_dialog()
            else:
                # Erro de credenciais ou outro erro
                self.login_btn.config(state=NORMAL)
                self.status_label.config(text=f"Erro: {result}", foreground='red')
    
    def _is_connection_error(self, error_message):
        """Verifica se o erro é de conexão"""
        connection_errors = [
            'connection', 'timeout', 'refused', 'unreachable', 
            'network', 'host', 'connect', 'socket', 'dns',
            'Erro de conexão', 'Timeout', 'conexão'
        ]
        error_lower = str(error_message).lower()
        return any(err in error_lower for err in connection_errors)
    
    def _show_connection_error_dialog(self):
        """Mostra diálogo para configurar novo IP"""
        dialog = ConnectionErrorDialog(
            self.winfo_toplevel(),
            self.api_client.base_url,
            self._on_new_url_configured
        )
    
    def _on_new_url_configured(self, new_url):
        """Callback quando novo URL é configurado"""
        self.api_client.base_url = new_url.rstrip('/')
        # Reseta retry e tenta novamente
        self.retry_count = 0
        self.status_label.config(text="URL atualizada. Tente fazer login novamente.", foreground='green')
        
        # Notifica o app principal para salvar a configuração
        if self.on_config_callback:
            self.on_config_callback(new_url)
    
    def _show_api_config(self):
        """Mostra diálogo para configurar URL da API"""
        dialog = ConnectionErrorDialog(
            self.winfo_toplevel(),
            self.api_client.base_url,
            self._on_new_url_configured
        )
        # Muda o título do diálogo
        dialog.title("Configurar API")


# ============================================================================
# TELA DE CHAT
# ============================================================================

class ChatScreen(ttk.Frame):
    """Tela principal do chat"""
    
    def __init__(self, parent, api_client, user, on_logout_callback, on_settings_callback, on_notification_callback=None):
        super().__init__(parent)
        self.api_client = api_client
        self.user = user
        self.on_logout_callback = on_logout_callback
        self.on_settings_callback = on_settings_callback
        self.on_notification_callback = on_notification_callback  # Callback para notificações toast
        
        self.conversations = []
        self.active_conversation = None
        self.active_module_id = None
        self.active_system_id = None
        self.messages = []
        self.modules = []
        self.systems = []
        self.is_sending = False
        self.knowledge_attachments = []  # Lista de anexos da base de conhecimento
        self.image_cache = {}  # Cache de imagens carregadas
        
        # Variáveis para imagem anexada
        self.attached_image = None  # Imagem anexada (base64)
        self.attached_image_preview = None  # Preview da imagem
        self.model_supports_images = False  # Se o modelo suporta imagens
        self.is_capturing_screen = False  # Se está capturando tela
        
        self._create_widgets()
        self._load_initial_data()
        self._check_model_image_support()
    
    def _create_widgets(self):
        # Container principal
        main_container = ttk.Frame(self)
        main_container.pack(fill=BOTH, expand=YES)
        
        # ===== SIDEBAR ESQUERDA =====
        self.sidebar = ttk.Frame(main_container, width=280)
        self.sidebar.pack(side=LEFT, fill=Y)
        self.sidebar.pack_propagate(False)  # Mantém largura fixa
        
        # Header da sidebar
        sidebar_header = ttk.Frame(self.sidebar)
        sidebar_header.pack(fill=X, padx=10, pady=10)
        
        # Botão Nova Conversa
        self.new_conv_btn = ttk.Button(
            sidebar_header,
            text="+ Nova Conversa",
            bootstyle="primary",
            command=self._new_conversation
        )
        self.new_conv_btn.pack(fill=X)
        
        # Lista de conversas com Canvas scrollable
        conv_container = ttk.Frame(self.sidebar)
        conv_container.pack(fill=BOTH, expand=YES, padx=5, pady=5)
        
        # Canvas para scroll
        self.conv_canvas = tk.Canvas(conv_container, highlightthickness=0)
        conv_scrollbar = ttk.Scrollbar(conv_container, orient=VERTICAL, command=self.conv_canvas.yview)
        
        self.conv_list_frame = ttk.Frame(self.conv_canvas)
        
        self.conv_canvas.configure(yscrollcommand=conv_scrollbar.set)
        
        conv_scrollbar.pack(side=RIGHT, fill=Y)
        self.conv_canvas.pack(side=LEFT, fill=BOTH, expand=YES)
        
        self.conv_canvas_window = self.conv_canvas.create_window((0, 0), window=self.conv_list_frame, anchor=NW)
        
        # Bind para atualizar scroll region
        self.conv_list_frame.bind('<Configure>', lambda e: self.conv_canvas.configure(scrollregion=self.conv_canvas.bbox('all')))
        self.conv_canvas.bind('<Configure>', lambda e: self.conv_canvas.itemconfig(self.conv_canvas_window, width=e.width))
        
        # Footer da sidebar
        sidebar_footer = ttk.Frame(self.sidebar)
        sidebar_footer.pack(fill=X, padx=10, pady=10)
        
        # Info do usuário
        user_frame = ttk.Frame(sidebar_footer)
        user_frame.pack(fill=X, pady=(0, 10))
        
        user_name = self.user.get('name', 'Usuário')
        ttk.Label(
            user_frame,
            text=f"👤 {user_name}",
            font=('Segoe UI', 10)
        ).pack(side=LEFT)
        
        # Botões de ação
        btn_frame = ttk.Frame(sidebar_footer)
        btn_frame.pack(fill=X)
        
        ttk.Button(
            btn_frame,
            text="Configurações",
            bootstyle="secondary-outline",
            command=self.on_settings_callback
        ).pack(side=LEFT, padx=(0, 5))
        
        ttk.Button(
            btn_frame,
            text="Sair",
            bootstyle="danger-outline",
            command=self.on_logout_callback
        ).pack(side=RIGHT)
        
        # Separador vertical
        ttk.Separator(main_container, orient=VERTICAL).pack(side=LEFT, fill=Y)
        
        # ===== ÁREA DE CHAT =====
        self.chat_area = ttk.Frame(main_container)
        self.chat_area.pack(side=LEFT, fill=BOTH, expand=YES)
        
        # Header do chat
        self.chat_header = ttk.Frame(self.chat_area)
        self.chat_header.pack(fill=X, padx=15, pady=10)
        
        self.chat_title_label = ttk.Label(
            self.chat_header,
            text="Selecione ou inicie uma conversa",
            font=('Segoe UI', 14, 'bold')
        )
        self.chat_title_label.pack(side=LEFT)
        
        self.module_label = ttk.Label(
            self.chat_header,
            text="",
            font=('Segoe UI', 10),
            foreground='gray'
        )
        self.module_label.pack(side=RIGHT)
        
        # Separador
        ttk.Separator(self.chat_area).pack(fill=X)
        
        # Área de mensagens
        self.messages_frame = ttk.Frame(self.chat_area)
        self.messages_frame.pack(fill=BOTH, expand=YES)
        
        # Frame de seleção de módulo (inicialmente visível)
        self.module_select_frame = ttk.Frame(self.messages_frame)
        
        # Canvas para mensagens com scroll
        self.msg_canvas_frame = ttk.Frame(self.messages_frame)
        
        self.msg_canvas = tk.Canvas(self.msg_canvas_frame, highlightthickness=0)
        msg_scrollbar = ttk.Scrollbar(self.msg_canvas_frame, orient=VERTICAL, command=self.msg_canvas.yview)
        
        self.messages_container = ttk.Frame(self.msg_canvas)
        
        self.msg_canvas.configure(yscrollcommand=msg_scrollbar.set)
        
        msg_scrollbar.pack(side=RIGHT, fill=Y)
        self.msg_canvas.pack(side=LEFT, fill=BOTH, expand=YES)
        
        self.msg_canvas_window = self.msg_canvas.create_window((0, 0), window=self.messages_container, anchor=NW)
        
        # Bind para atualizar scroll region
        self.messages_container.bind('<Configure>', lambda e: self.msg_canvas.configure(scrollregion=self.msg_canvas.bbox('all')))
        self.msg_canvas.bind('<Configure>', lambda e: self.msg_canvas.itemconfig(self.msg_canvas_window, width=e.width))
        
        # Área de input
        self.input_frame = ttk.Frame(self.chat_area)
        self.input_frame.pack(fill=X, padx=15, pady=15)
        
        # Frame para preview de imagem anexada
        self.image_preview_frame = ttk.Frame(self.input_frame)
        self.image_preview_frame.pack(fill=X, pady=(0, 5))
        self.image_preview_frame.pack_forget()  # Esconde inicialmente
        
        # Frame para botões de imagem (só aparece se modelo suporta)
        self.image_buttons_frame = ttk.Frame(self.input_frame)
        self.image_buttons_frame.pack(fill=X, pady=(0, 5))
        self.image_buttons_frame.pack_forget()  # Esconde inicialmente
        
        # Botão anexar imagem
        self.attach_image_btn = ttk.Button(
            self.image_buttons_frame,
            text="📎 Anexar Imagem",
            bootstyle="info-outline",
            command=self._attach_image
        )
        self.attach_image_btn.pack(side=LEFT, padx=(0, 5))
        
        # Botão capturar tela
        self.capture_screen_btn = ttk.Button(
            self.image_buttons_frame,
            text="📷 Capturar Tela",
            bootstyle="info-outline",
            command=self._start_screen_capture
        )
        self.capture_screen_btn.pack(side=LEFT, padx=(0, 5))
        
        # Label de dica
        self.image_hint_label = ttk.Label(
            self.image_buttons_frame,
            text="💡 Ctrl+V para colar imagem",
            font=('Segoe UI', 9),
            foreground='gray'
        )
        self.image_hint_label.pack(side=LEFT, padx=(10, 0))
        
        # Input de mensagem
        input_container = ttk.Frame(self.input_frame)
        input_container.pack(fill=X)
        
        self.message_input = tk.Text(
            input_container,
            height=3,
            font=('Segoe UI', 11),
            wrap=WORD
        )
        self.message_input.pack(side=LEFT, fill=X, expand=YES, padx=(0, 10))
        self.message_input.bind('<Return>', self._on_enter_press)
        self.message_input.bind('<Shift-Return>', lambda e: None)  # Permite Shift+Enter
        self.message_input.bind('<Control-v>', self._on_paste)  # Ctrl+V para colar imagem
        
        self.send_btn = ttk.Button(
            input_container,
            text="Enviar",
            bootstyle="primary",
            command=self._send_message,
            width=10
        )
        self.send_btn.pack(side=RIGHT)
        
        # Status
        self.status_frame = ttk.Frame(self.input_frame)
        self.status_frame.pack(fill=X, pady=(5, 0))
        
        self.status_label = ttk.Label(
            self.status_frame,
            text="",
            font=('Segoe UI', 9),
            foreground='gray'
        )
        self.status_label.pack(side=LEFT)
        
        # Mostra tela inicial
        self._show_welcome_screen()
    
    def _load_initial_data(self):
        """Carrega dados iniciais"""
        def load_thread():
            self.conversations = self.api_client.get_conversations()
            self.modules = self.api_client.get_modules()
            self.after(0, self._update_conversation_list)
        
        threading.Thread(target=load_thread, daemon=True).start()
    
    def _check_model_image_support(self):
        """Verifica se o modelo ativo suporta imagens"""
        def check_thread():
            model = self.api_client.get_active_model()
            if model and model.get('visualiza_imagem'):
                self.model_supports_images = True
                self.after(0, self._show_image_buttons)
            else:
                self.model_supports_images = False
                self.after(0, self._hide_image_buttons)
        
        threading.Thread(target=check_thread, daemon=True).start()
    
    def _show_image_buttons(self):
        """Mostra botões de imagem"""
        self.image_buttons_frame.pack(fill=X, pady=(0, 5), before=self.input_frame.winfo_children()[2])
    
    def _hide_image_buttons(self):
        """Esconde botões de imagem"""
        self.image_buttons_frame.pack_forget()
    
    def _attach_image(self):
        """Abre diálogo para anexar imagem"""
        from tkinter import filedialog
        
        filetypes = [
            ('Imagens', '*.png *.jpg *.jpeg *.gif *.bmp *.webp'),
            ('PNG', '*.png'),
            ('JPEG', '*.jpg *.jpeg'),
            ('Todos os arquivos', '*.*')
        ]
        
        filepath = filedialog.askopenfilename(
            title="Selecionar Imagem",
            filetypes=filetypes
        )
        
        if filepath:
            self._load_and_attach_image(filepath)
    
    def _load_and_attach_image(self, filepath):
        """Carrega imagem do arquivo e anexa"""
        try:
            if PIL_AVAILABLE:
                img = PILImage.open(filepath)
                # Redimensiona se muito grande
                max_size = (1920, 1080)
                img.thumbnail(max_size, PILImage.Resampling.LANCZOS)
                
                # Converte para base64
                buffer = io.BytesIO()
                img_format = img.format or 'PNG'
                if img_format.upper() == 'JPEG':
                    img.save(buffer, format='JPEG', quality=85)
                else:
                    img.save(buffer, format='PNG')
                
                img_data = buffer.getvalue()
                import base64
                b64_data = base64.b64encode(img_data).decode('utf-8')
                
                ext = 'jpeg' if img_format.upper() == 'JPEG' else 'png'
                self.attached_image = f"data:image/{ext};base64,{b64_data}"
                
                self._show_image_preview(img)
            else:
                Messagebox.show_warning("PIL não disponível para processar imagens", "Aviso")
        except Exception as e:
            Messagebox.show_error(f"Erro ao carregar imagem: {e}", "Erro")
    
    def _on_paste(self, event):
        """Handler para Ctrl+V - cola imagem do clipboard"""
        if not self.model_supports_images:
            return
        
        try:
            if PIL_AVAILABLE:
                from PIL import ImageGrab
                
                # Tenta pegar imagem do clipboard
                img = ImageGrab.grabclipboard()
                
                if img and isinstance(img, PILImage.Image):
                    # Redimensiona se muito grande
                    max_size = (1920, 1080)
                    img.thumbnail(max_size, PILImage.Resampling.LANCZOS)
                    
                    # Converte para base64
                    buffer = io.BytesIO()
                    img.save(buffer, format='PNG')
                    img_data = buffer.getvalue()
                    
                    import base64
                    b64_data = base64.b64encode(img_data).decode('utf-8')
                    self.attached_image = f"data:image/png;base64,{b64_data}"
                    
                    self._show_image_preview(img)
                    return 'break'  # Impede o comportamento padrão
        except Exception as e:
            print(f"Erro ao colar imagem: {e}")
    
    def _start_screen_capture(self):
        """Inicia captura de tela"""
        if not PIL_AVAILABLE:
            Messagebox.show_warning("PIL não disponível para captura de tela", "Aviso")
            return
        
        # Minimiza a janela principal
        self.winfo_toplevel().iconify()
        self.is_capturing_screen = True
        
        # Aguarda um pouco e mostra instruções
        self.after(300, self._show_capture_overlay)
    
    def _show_capture_overlay(self):
        """Mostra overlay para seleção de janela"""
        try:
            # Cria janela de overlay transparente
            self.capture_window = tk.Toplevel()
            self.capture_window.attributes('-fullscreen', True)
            self.capture_window.attributes('-alpha', 0.3)
            self.capture_window.attributes('-topmost', True)
            self.capture_window.configure(bg='blue')
            
            # Label com instruções
            label = tk.Label(
                self.capture_window,
                text="🎯 Clique na janela que deseja capturar\n\nPressione ESC para cancelar",
                font=('Segoe UI', 24, 'bold'),
                fg='white',
                bg='blue'
            )
            label.place(relx=0.5, rely=0.5, anchor=CENTER)
            
            # Binds
            self.capture_window.bind('<Button-1>', self._on_capture_click)
            self.capture_window.bind('<Escape>', self._cancel_capture)
            self.capture_window.focus_force()
            
        except Exception as e:
            print(f"Erro ao criar overlay: {e}")
            self._cancel_capture(None)
    
    def _on_capture_click(self, event):
        """Handler para clique durante captura"""
        try:
            # Pega posição do clique
            x, y = event.x_root, event.y_root
            
            # Fecha overlay
            if hasattr(self, 'capture_window'):
                self.capture_window.destroy()
            
            # Aguarda um pouco para o overlay sumir
            self.after(200, lambda: self._capture_window_at_position(x, y))
            
        except Exception as e:
            print(f"Erro no clique de captura: {e}")
            self._cancel_capture(None)
    
    def _capture_window_at_position(self, x, y):
        """Captura a janela na posição especificada"""
        try:
            import ctypes
            from ctypes import wintypes
            
            # Obtém handle da janela na posição
            user32 = ctypes.windll.user32
            hwnd = user32.WindowFromPoint(ctypes.wintypes.POINT(x, y))
            
            if hwnd:
                # Obtém a janela pai (root window)
                root_hwnd = user32.GetAncestor(hwnd, 2)  # GA_ROOT = 2
                if root_hwnd:
                    hwnd = root_hwnd
                
                # Obtém dimensões da janela
                rect = wintypes.RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(rect))
                
                left = rect.left
                top = rect.top
                right = rect.right
                bottom = rect.bottom
                
                # Captura a região
                from PIL import ImageGrab
                screenshot = ImageGrab.grab(bbox=(left, top, right, bottom))
                
                # Redimensiona se muito grande
                max_size = (1920, 1080)
                screenshot.thumbnail(max_size, PILImage.Resampling.LANCZOS)
                
                # Converte para base64
                buffer = io.BytesIO()
                screenshot.save(buffer, format='PNG')
                img_data = buffer.getvalue()
                
                import base64
                b64_data = base64.b64encode(img_data).decode('utf-8')
                self.attached_image = f"data:image/png;base64,{b64_data}"
                
                # Restaura janela principal
                self.winfo_toplevel().deiconify()
                self.winfo_toplevel().lift()
                
                self._show_image_preview(screenshot)
            else:
                self._cancel_capture(None)
                
        except Exception as e:
            print(f"Erro ao capturar janela: {e}")
            self._cancel_capture(None)
        finally:
            self.is_capturing_screen = False
    
    def _cancel_capture(self, event):
        """Cancela captura de tela"""
        if hasattr(self, 'capture_window'):
            self.capture_window.destroy()
        
        self.is_capturing_screen = False
        self.winfo_toplevel().deiconify()
        self.winfo_toplevel().lift()
    
    def _show_image_preview(self, img):
        """Mostra preview da imagem anexada"""
        # Limpa preview anterior
        for widget in self.image_preview_frame.winfo_children():
            widget.destroy()
        
        # Cria thumbnail para preview
        preview_size = (150, 100)
        preview_img = img.copy()
        preview_img.thumbnail(preview_size, PILImage.Resampling.LANCZOS)
        
        # Converte para PhotoImage
        self.attached_image_preview = ImageTk.PhotoImage(preview_img)
        
        # Container do preview
        preview_container = ttk.Frame(self.image_preview_frame)
        preview_container.pack(anchor=W)
        
        # Imagem
        img_label = ttk.Label(preview_container, image=self.attached_image_preview)
        img_label.pack(side=LEFT, padx=(0, 10))
        
        # Info e botão remover
        info_frame = ttk.Frame(preview_container)
        info_frame.pack(side=LEFT, fill=Y)
        
        ttk.Label(
            info_frame,
            text="📎 Imagem anexada",
            font=('Segoe UI', 10, 'bold')
        ).pack(anchor=W)
        
        ttk.Label(
            info_frame,
            text=f"Tamanho: {img.width}x{img.height}",
            font=('Segoe UI', 9),
            foreground='gray'
        ).pack(anchor=W)
        
        ttk.Button(
            info_frame,
            text="❌ Remover",
            bootstyle="danger-outline",
            command=self._remove_attached_image
        ).pack(anchor=W, pady=(5, 0))
        
        # Mostra o frame
        self.image_preview_frame.pack(fill=X, pady=(0, 5), before=self.image_buttons_frame)
    
    def _remove_attached_image(self):
        """Remove imagem anexada"""
        self.attached_image = None
        self.attached_image_preview = None
        
        # Limpa e esconde preview
        for widget in self.image_preview_frame.winfo_children():
            widget.destroy()
        self.image_preview_frame.pack_forget()
    
    def _update_conversation_list(self):
        """Atualiza a lista de conversas na sidebar"""
        # Limpa lista atual
        for widget in self.conv_list_frame.winfo_children():
            widget.destroy()
        
        if not self.conversations:
            ttk.Label(
                self.conv_list_frame,
                text="Nenhuma conversa",
                font=('Segoe UI', 10),
                foreground='gray'
            ).pack(pady=20)
            return
        
        for conv in self.conversations:
            self._create_conversation_item(conv)
    
    def _create_conversation_item(self, conv):
        """Cria um item de conversa na lista"""
        is_active = self.active_conversation and self.active_conversation.get('id') == conv.get('id')
        
        item_frame = ttk.Frame(self.conv_list_frame)
        item_frame.pack(fill=X, pady=2, padx=5)
        
        # Estilo baseado se está ativo
        style = "primary" if is_active else "secondary"
        
        btn = ttk.Button(
            item_frame,
            text=conv.get('titulo', 'Sem título')[:25],
            bootstyle=f"{style}-outline" if not is_active else style,
            command=lambda c=conv: self._select_conversation(c)
        )
        btn.pack(side=LEFT, fill=X, expand=YES)
        
        # Botão de lixeira para excluir
        delete_btn = ttk.Button(
            item_frame,
            text="🗑️",
            bootstyle="danger-link",
            command=lambda c=conv: self._delete_conversation(c),
            width=2
        )
        delete_btn.pack(side=RIGHT, padx=(2, 0))
        
        # Menu de contexto
        menu = tk.Menu(btn, tearoff=0)
        menu.add_command(label="Renomear", command=lambda c=conv: self._rename_conversation(c))
        menu.add_command(label="Excluir", command=lambda c=conv: self._delete_conversation(c))
        
        btn.bind('<Button-3>', lambda e, m=menu: m.post(e.x_root, e.y_root))
    
    def _show_welcome_screen(self):
        """Mostra tela de boas-vindas"""
        self.msg_canvas_frame.pack_forget()
        self.module_select_frame.pack_forget()
        
        # Limpa e recria
        for widget in self.module_select_frame.winfo_children():
            widget.destroy()
        
        self.module_select_frame.pack(fill=BOTH, expand=YES)
        
        # Container central
        center_frame = ttk.Frame(self.module_select_frame)
        center_frame.place(relx=0.5, rely=0.5, anchor=CENTER)
        
        ttk.Label(
            center_frame,
            text="🧠",
            font=('Segoe UI', 48)
        ).pack()
        
        ttk.Label(
            center_frame,
            text="Bem-vindo ao AskForge-AI",
            font=('Segoe UI', 18, 'bold')
        ).pack(pady=(10, 5))
        
        ttk.Label(
            center_frame,
            text="Selecione uma conversa existente ou inicie uma nova",
            font=('Segoe UI', 11),
            foreground='gray'
        ).pack()
    
    def _show_module_selection(self):
        """Mostra seleção de módulo para nova conversa"""
        self.msg_canvas_frame.pack_forget()
        
        # Limpa e recria
        for widget in self.module_select_frame.winfo_children():
            widget.destroy()
        
        self.module_select_frame.pack(fill=BOTH, expand=YES)
        
        # Container central
        center_frame = ttk.Frame(self.module_select_frame)
        center_frame.place(relx=0.5, rely=0.5, anchor=CENTER)
        
        ttk.Label(
            center_frame,
            text="📁 Selecione uma Base de Conhecimento",
            font=('Segoe UI', 16, 'bold')
        ).pack(pady=(0, 20))
        
        # Se não tem módulos carregados, tenta carregar
        if not self.modules:
            ttk.Label(
                center_frame,
                text="Carregando módulos...",
                font=('Segoe UI', 11),
                foreground='gray'
            ).pack()
            
            def load_modules():
                self.modules = self.api_client.get_modules()
                self.after(0, self._show_module_selection)
            
            threading.Thread(target=load_modules, daemon=True).start()
            return
        
        # Grid de módulos
        modules_frame = ttk.Frame(center_frame)
        modules_frame.pack()
        
        print(f"[DEBUG] Módulos carregados: {len(self.modules)}")  # Debug
        
        for i, module in enumerate(self.modules):
            print(f"[DEBUG] Módulo {i}: {module.get('nome', 'Sem nome')}")  # Debug
            btn = ttk.Button(
                modules_frame,
                text=module.get('nome', 'Módulo'),
                bootstyle="info-outline",
                width=25,
                command=lambda m=module: self._select_module(m)
            )
            btn.pack(pady=5)
    
    def _show_system_selection(self, module):
        """Mostra seleção de sistema"""
        # Limpa e recria
        for widget in self.module_select_frame.winfo_children():
            widget.destroy()
        
        # Container central
        center_frame = ttk.Frame(self.module_select_frame)
        center_frame.place(relx=0.5, rely=0.5, anchor=CENTER)
        
        ttk.Label(
            center_frame,
            text=f"📁 {module.get('nome', 'Módulo')}",
            font=('Segoe UI', 14),
            foreground='gray'
        ).pack()
        
        ttk.Label(
            center_frame,
            text="Selecione o Sistema",
            font=('Segoe UI', 16, 'bold')
        ).pack(pady=(5, 20))
        
        # Grid de sistemas
        systems_frame = ttk.Frame(center_frame)
        systems_frame.pack()
        
        for system in self.systems:
            btn = ttk.Button(
                systems_frame,
                text=system.get('nome', 'Sistema'),
                bootstyle="success-outline",
                width=25,
                command=lambda s=system: self._select_system(s)
            )
            btn.pack(pady=5)
        
        # Botão voltar
        ttk.Button(
            center_frame,
            text="← Voltar",
            bootstyle="secondary-link",
            command=self._show_module_selection
        ).pack(pady=(20, 0))
    
    def _show_chat_area(self):
        """Mostra área de chat"""
        self.module_select_frame.pack_forget()
        self.msg_canvas_frame.pack(fill=BOTH, expand=YES, padx=10, pady=10)
    
    def _new_conversation(self):
        """Inicia nova conversa"""
        self.active_conversation = None
        self.active_module_id = None
        self.active_system_id = None
        self.messages = []
        self.systems = []
        
        self.chat_title_label.config(text="Nova Conversa")
        self.module_label.config(text="")
        
        self._show_module_selection()
        self._update_conversation_list()
    
    def _select_module(self, module):
        """Seleciona um módulo"""
        self.active_module_id = module.get('id')
        
        # Busca sistemas do módulo
        def load_systems():
            self.systems = self.api_client.get_systems(self.active_module_id)
            self.after(0, lambda: self._handle_systems_loaded(module))
        
        threading.Thread(target=load_systems, daemon=True).start()
    
    def _handle_systems_loaded(self, module):
        """Callback após carregar sistemas"""
        if self.systems:
            self._show_system_selection(module)
        else:
            # Sem sistemas, vai direto para o chat
            self.active_system_id = None
            self.module_label.config(text=module.get('nome', ''))
            self.chat_title_label.config(text="Nova Conversa")
            self._show_chat_area()
            self._clear_messages()
    
    def _select_system(self, system):
        """Seleciona um sistema"""
        self.active_system_id = system.get('id')
        
        module_name = ""
        for m in self.modules:
            if m.get('id') == self.active_module_id:
                module_name = m.get('nome', '')
                break
        
        self.module_label.config(text=f"{module_name} → {system.get('nome', '')}")
        self.chat_title_label.config(text="Nova Conversa")
        self._show_chat_area()
        self._clear_messages()
    
    def _select_conversation(self, conv):
        """Seleciona uma conversa existente"""
        print(f"[DEBUG] Selecionando conversa: {conv.get('titulo', 'Sem título')}")  # Debug
        
        self.active_conversation = conv
        self.active_module_id = conv.get('module_id')
        self.active_system_id = conv.get('system_id')
        
        self.chat_title_label.config(text=conv.get('titulo', 'Conversa'))
        
        module_info = conv.get('module_nome', '')
        if conv.get('system_nome'):
            module_info += f" → {conv.get('system_nome')}"
        self.module_label.config(text=module_info)
        
        self._show_chat_area()
        self._update_conversation_list()
        
        # Carrega mensagens
        def load_messages():
            print(f"[DEBUG] Carregando mensagens da conversa {conv.get('id')}")  # Debug
            data = self.api_client.get_conversation_messages(conv.get('id'))
            print(f"[DEBUG] Mensagens recebidas: {len(data.get('messages', [])) if data else 0}")  # Debug
            if data:
                self.messages = data.get('messages', [])
                # Carrega anexos da base de conhecimento
                if data.get('all_knowledge_attachments'):
                    self.knowledge_attachments = data.get('all_knowledge_attachments', [])
                    print(f"[DEBUG] Anexos carregados: {len(self.knowledge_attachments)}")
                self.after(0, self._render_messages)
            else:
                self.after(0, lambda: self.status_label.config(text="Erro ao carregar mensagens"))
        
        self.status_label.config(text="Carregando mensagens...")
        threading.Thread(target=load_messages, daemon=True).start()
    
    def _clear_messages(self):
        """Limpa área de mensagens"""
        for widget in self.messages_container.winfo_children():
            widget.destroy()
    
    def _render_messages(self):
        """Renderiza mensagens na área de chat"""
        self._clear_messages()
        self.status_label.config(text="")
        
        for msg in self.messages:
            self._add_message_bubble(msg)
        
        # Scroll para o final
        self.msg_canvas.update_idletasks()
        self.msg_canvas.yview_moveto(1.0)
    
    def _parse_message_content(self, content):
        """
        Parseia o conteúdo da mensagem para extrair texto, imagens Markdown e anexos.
        Retorna uma lista de partes: {'type': 'text'|'image'|'attachment', ...}
        """
        parts = []
        
        # Regex para imagens Markdown: ![alt](url)
        # Regex para anexos: [ANEXO_X]
        combined_pattern = r'(!\[([^\]]*)\]\(([^)]+)\)|\[ANEXO_(\d+)\])'
        
        last_end = 0
        for match in re.finditer(combined_pattern, content):
            # Adiciona texto antes do match
            if match.start() > last_end:
                text = content[last_end:match.start()].strip()
                if text:
                    parts.append({'type': 'text', 'content': text})
            
            full_match = match.group(0)
            
            if full_match.startswith('!['):
                # É uma imagem Markdown
                alt = match.group(2) or 'Imagem'
                url = match.group(3)
                parts.append({'type': 'image', 'alt': alt, 'url': url})
            elif full_match.startswith('[ANEXO_'):
                # É um anexo
                anexo_num = match.group(4)
                marker_id = f'[ANEXO_{anexo_num}]'
                # Busca o anexo na lista de anexos conhecidos
                attachment = None
                for att in self.knowledge_attachments:
                    if att.get('id') == marker_id:
                        attachment = att
                        break
                
                if attachment:
                    parts.append({
                        'type': 'attachment',
                        'id': marker_id,
                        'url': attachment.get('url', ''),
                        'name': attachment.get('name', 'Anexo')
                    })
                else:
                    # Anexo não encontrado, mantém como texto
                    parts.append({'type': 'text', 'content': full_match})
            
            last_end = match.end()
        
        # Adiciona texto restante
        if last_end < len(content):
            text = content[last_end:].strip()
            if text:
                parts.append({'type': 'text', 'content': text})
        
        # Se não encontrou nenhum padrão, retorna o conteúdo como texto
        if not parts:
            parts.append({'type': 'text', 'content': content})
        
        return parts
    
    def _load_image_from_url(self, url, max_width=400):
        """Carrega uma imagem de uma URL e retorna um PhotoImage"""
        if not PIL_AVAILABLE:
            return None
        
        # Verifica cache
        if url in self.image_cache:
            return self.image_cache[url]
        
        try:
            # Se a URL é relativa, constrói a URL completa
            if not url.startswith('http'):
                base_url = self.api_client.base_url
                if url.startswith('/'):
                    url = f"{base_url}{url}"
                else:
                    url = f"{base_url}/{url}"
            
            # Baixa a imagem
            response = self.api_client.session.get(url, timeout=10)
            if response.status_code == 200:
                # Carrega com PIL
                img_data = io.BytesIO(response.content)
                pil_image = PILImage.open(img_data)
                
                # Redimensiona se necessário
                width, height = pil_image.size
                if width > max_width:
                    ratio = max_width / width
                    new_height = int(height * ratio)
                    pil_image = pil_image.resize((max_width, new_height), PILImage.Resampling.LANCZOS)
                
                # Converte para PhotoImage
                photo = ImageTk.PhotoImage(pil_image)
                
                # Armazena no cache
                self.image_cache[url] = photo
                
                return photo
        except Exception as e:
            print(f"[DEBUG] Erro ao carregar imagem {url}: {e}")
        
        return None
    
    def _open_url(self, url):
        """Abre uma URL no navegador"""
        if not url.startswith('http'):
            base_url = self.api_client.base_url
            if url.startswith('/'):
                url = f"{base_url}{url}"
            else:
                url = f"{base_url}/{url}"
        webbrowser.open(url)
    
    def _add_message_bubble(self, msg, user_message=None):
        """Adiciona uma bolha de mensagem com suporte a imagens e anexos"""
        role = msg.get('role', 'user')
        content = msg.get('content', '')
        used_knowledge_ids = msg.get('used_knowledge_ids', [])
        
        # Frame da mensagem
        msg_frame = ttk.Frame(self.messages_container)
        msg_frame.pack(fill=X, pady=5, padx=10)
        
        # Alinhamento baseado no role
        if role == 'user':
            anchor = E
            bg_style = "primary"
            icon = "👤"
        else:
            anchor = W
            bg_style = "secondary"
            icon = "🤖"
        
        # Container da bolha
        bubble_container = ttk.Frame(msg_frame)
        bubble_container.pack(anchor=anchor)
        
        # Ícone
        ttk.Label(
            bubble_container,
            text=icon,
            font=('Segoe UI', 12)
        ).pack(side=LEFT if role == 'assistant' else RIGHT, padx=5)
        
        # Container vertical para bolha + feedback
        content_container = ttk.Frame(bubble_container)
        content_container.pack(side=LEFT if role == 'assistant' else RIGHT)
        
        # Bolha
        bubble = ttk.Frame(content_container, bootstyle=bg_style)
        bubble.pack()
        
        # Processa o conteúdo para extrair texto, imagens e anexos
        if role == 'assistant':
            parts = self._parse_message_content(content)
            
            for part in parts:
                if part['type'] == 'text':
                    # Texto normal - selecioável
                    text_container = create_selectable_text(
                        bubble,
                        part['content'],
                        font=('Segoe UI', 10),
                        wraplength=500,
                        padding=(10, 8)
                    )
                    text_container.pack(anchor=W, fill=X)
                    
                elif part['type'] == 'image':
                    # Imagem
                    img_frame = ttk.Frame(bubble)
                    img_frame.pack(pady=5, padx=10)
                    
                    # Tenta carregar a imagem
                    url = part['url']
                    
                    def load_and_display_image(frame, image_url, alt_text):
                        """Carrega imagem em thread separada"""
                        def load_thread():
                            photo = self._load_image_from_url(image_url)
                            if photo:
                                self.after(0, lambda: self._display_image(frame, photo, image_url))
                            else:
                                self.after(0, lambda: self._display_image_placeholder(frame, alt_text, image_url))
                        
                        threading.Thread(target=load_thread, daemon=True).start()
                    
                    # Placeholder enquanto carrega
                    loading_label = ttk.Label(
                        img_frame,
                        text=f"📷 Carregando: {part['alt']}...",
                        font=('Segoe UI', 9),
                        foreground='gray'
                    )
                    loading_label.pack()
                    
                    # Carrega a imagem em background
                    load_and_display_image(img_frame, url, part['alt'])
                    
                elif part['type'] == 'attachment':
                    # Anexo
                    att_frame = ttk.Frame(bubble, bootstyle="light")
                    att_frame.pack(pady=5, padx=10, fill=X)
                    
                    # Ícone e nome do anexo
                    att_info = ttk.Frame(att_frame)
                    att_info.pack(fill=X, padx=5, pady=5)
                    
                    ttk.Label(
                        att_info,
                        text="📎",
                        font=('Segoe UI', 12)
                    ).pack(side=LEFT)
                    
                    ttk.Label(
                        att_info,
                        text=part['name'],
                        font=('Segoe UI', 10),
                        wraplength=350
                    ).pack(side=LEFT, padx=(5, 0))
                    
                    # Botões de ação
                    btn_frame = ttk.Frame(att_frame)
                    btn_frame.pack(fill=X, padx=5, pady=(0, 5))
                    
                    url = part['url']
                    name = part['name']
                    
                    ttk.Button(
                        btn_frame,
                        text="🔗 Abrir",
                        bootstyle="info-outline",
                        command=lambda u=url: self._open_url(u)
                    ).pack(side=LEFT, padx=(0, 5))
                    
                    ttk.Button(
                        btn_frame,
                        text="⬇️ Baixar",
                        bootstyle="success-outline",
                        command=lambda u=url, n=name: self._download_attachment(u, n)
                    ).pack(side=LEFT)
        else:
            # Mensagem do usuário
            # Verifica se tem imagem anexada
            image_data = msg.get('image_data')
            if image_data and PIL_AVAILABLE:
                try:
                    # Decodifica a imagem base64
                    import base64
                    # Remove o prefixo data:image/...;base64,
                    if ',' in image_data:
                        b64_data = image_data.split(',')[1]
                    else:
                        b64_data = image_data
                    
                    img_bytes = base64.b64decode(b64_data)
                    img = PILImage.open(io.BytesIO(img_bytes))
                    
                    # Cria thumbnail para exibição
                    display_size = (300, 200)
                    img.thumbnail(display_size, PILImage.Resampling.LANCZOS)
                    
                    # Converte para PhotoImage e armazena no cache
                    photo = ImageTk.PhotoImage(img)
                    cache_key = f"user_img_{id(msg)}"
                    self.image_cache[cache_key] = photo
                    
                    # Frame para imagem
                    img_frame = ttk.Frame(bubble)
                    img_frame.pack(pady=5, padx=10)
                    
                    img_label = ttk.Label(img_frame, image=photo)
                    img_label.pack()
                    
                except Exception as e:
                    print(f"Erro ao exibir imagem do usuário: {e}")
            
            # Texto da mensagem (se houver) - selecioável
            if content and content != "[Imagem enviada]":
                text_container = create_selectable_text(
                    bubble,
                    content,
                    font=('Segoe UI', 10),
                    wraplength=500,
                    padding=(10, 8)
                )
                text_container.pack(fill=X)
            elif not image_data:
                # Só mostra texto se não tiver imagem - selecioável
                text_container = create_selectable_text(
                    bubble,
                    content,
                    font=('Segoe UI', 10),
                    wraplength=500,
                    padding=(10, 8)
                )
                text_container.pack(fill=X)
        
        # Botões de feedback (apenas para mensagens do assistente)
        if role == 'assistant' and user_message:
            feedback_frame = ttk.Frame(content_container)
            feedback_frame.pack(anchor=W, pady=(2, 0))
            
            # Variável para rastrear feedback atual
            feedback_var = {'value': None}
            
            def send_feedback(feedback_type):
                if feedback_var['value'] == feedback_type:
                    return  # Já avaliado com esse tipo
                
                feedback_var['value'] = feedback_type
                
                # Atualiza visual dos botões
                if feedback_type == 'positive':
                    thumbs_up_btn.config(bootstyle="success")
                    thumbs_down_btn.config(bootstyle="secondary-outline")
                else:
                    thumbs_up_btn.config(bootstyle="secondary-outline")
                    thumbs_down_btn.config(bootstyle="danger")
                
                # Envia feedback para API
                def send_thread():
                    self.api_client.send_feedback(
                        self.active_conversation.get('id') if self.active_conversation else None,
                        user_message,
                        content,
                        feedback_type,
                        used_knowledge_ids
                    )
                
                threading.Thread(target=send_thread, daemon=True).start()
            
            thumbs_up_btn = ttk.Button(
                feedback_frame,
                text="👍",
                bootstyle="secondary-outline",
                width=3,
                command=lambda: send_feedback('positive')
            )
            thumbs_up_btn.pack(side=LEFT, padx=(0, 2))
            
            thumbs_down_btn = ttk.Button(
                feedback_frame,
                text="👎",
                bootstyle="secondary-outline",
                width=3,
                command=lambda: send_feedback('negative')
            )
            thumbs_down_btn.pack(side=LEFT)
    
    def _display_image(self, frame, photo, url):
        """Exibe uma imagem carregada no frame"""
        # Remove o placeholder
        for widget in frame.winfo_children():
            widget.destroy()
        
        # Cria label com a imagem
        img_label = ttk.Label(frame, image=photo)
        img_label.image = photo  # Mantém referência
        img_label.pack()
        
        # Clique para abrir em tamanho real
        img_label.bind('<Button-1>', lambda e, u=url: self._open_url(u))
        img_label.config(cursor="hand2")
    
    def _display_image_placeholder(self, frame, alt_text, url):
        """Exibe um placeholder quando a imagem não pode ser carregada"""
        # Remove o placeholder de carregamento
        for widget in frame.winfo_children():
            widget.destroy()
        
        # Cria botão para abrir a imagem no navegador
        placeholder_frame = ttk.Frame(frame)
        placeholder_frame.pack(pady=5)
        
        ttk.Label(
            placeholder_frame,
            text=f"🖼️ {alt_text}",
            font=('Segoe UI', 10),
            foreground='gray'
        ).pack()
        
        ttk.Button(
            placeholder_frame,
            text="Abrir imagem no navegador",
            bootstyle="info-outline",
            command=lambda: self._open_url(url)
        ).pack(pady=(5, 0))
    
    def _download_attachment(self, url, filename):
        """Baixa um anexo"""
        try:
            from tkinter import filedialog
            
            # Pergunta onde salvar
            save_path = filedialog.asksaveasfilename(
                initialfile=filename,
                title="Salvar anexo como"
            )
            
            if not save_path:
                return
            
            # Constrói URL completa se necessário
            if not url.startswith('http'):
                base_url = self.api_client.base_url
                if url.startswith('/'):
                    url = f"{base_url}{url}"
                else:
                    url = f"{base_url}/{url}"
            
            # Baixa o arquivo
            def download_thread():
                try:
                    response = self.api_client.session.get(url, timeout=60)
                    if response.status_code == 200:
                        with open(save_path, 'wb') as f:
                            f.write(response.content)
                        self.after(0, lambda: Messagebox.show_info(f"Arquivo salvo em:\n{save_path}", "Download concluído"))
                    else:
                        self.after(0, lambda: Messagebox.show_error("Erro ao baixar arquivo", "Erro"))
                except Exception as e:
                    self.after(0, lambda: Messagebox.show_error(f"Erro: {e}", "Erro"))
            
            threading.Thread(target=download_thread, daemon=True).start()
            
        except Exception as e:
            Messagebox.show_error(f"Erro ao baixar: {e}", "Erro")
    
    def _on_enter_press(self, event):
        """Handler para Enter no input"""
        if not event.state & 0x1:  # Sem Shift
            self._send_message()
            return 'break'
    
    def _send_message(self):
        """Envia mensagem"""
        if self.is_sending:
            return
        
        message = self.message_input.get('1.0', END).strip()
        if not message and not self.attached_image:
            return
        
        if not self.active_module_id:
            Messagebox.show_warning("Selecione um módulo primeiro", "Aviso")
            return
        
        self.is_sending = True
        self.send_btn.config(state=DISABLED)
        self.message_input.delete('1.0', END)
        
        # Captura imagem anexada antes de limpar
        image_to_send = self.attached_image
        image_preview = self.attached_image_preview  # Guarda o preview para exibir
        
        # Adiciona mensagem do usuário localmente
        user_content = message if message else "[Imagem enviada]"
        user_msg = {
            'role': 'user', 
            'content': user_content, 
            'has_image': bool(image_to_send),
            'image_data': image_to_send  # Armazena a imagem para exibição
        }
        self.messages.append(user_msg)
        self._add_message_bubble(user_msg)
        
        # Remove imagem anexada após enviar
        if self.attached_image:
            self._remove_attached_image()
        
        # Scroll para o final
        self.msg_canvas.update_idletasks()
        self.msg_canvas.yview_moveto(1.0)
        
        self.status_label.config(text="Aguardando resposta..." + (" (com imagem)" if image_to_send else ""))
        
        # Guarda a mensagem para usar no callback
        sent_message = message if message else "Analise esta imagem"
        
        def send_thread():
            conv_id = self.active_conversation.get('id') if self.active_conversation else None
            
            success, result = self.api_client.send_message(
                conv_id,
                self.active_module_id,
                self.active_system_id,
                sent_message,
                image_to_send
            )
            
            self.after(0, lambda: self._handle_send_result(success, result, sent_message))
        
        threading.Thread(target=send_thread, daemon=True).start()
    
    def _handle_send_result(self, success, result, user_message):
        """Callback após enviar mensagem"""
        self.is_sending = False
        self.send_btn.config(state=NORMAL)
        self.status_label.config(text="")
        
        if success:
            # Atualiza ID da conversa se era nova
            if not self.active_conversation:
                self.active_conversation = {'id': result.get('conversation_id')}
                # Recarrega lista de conversas
                def reload():
                    self.conversations = self.api_client.get_conversations()
                    self.after(0, self._update_conversation_list)
                threading.Thread(target=reload, daemon=True).start()
            
            # Atualiza lista de anexos da base de conhecimento
            if result.get('all_knowledge_attachments'):
                self.knowledge_attachments = result.get('all_knowledge_attachments', [])
            
            # Armazena IDs dos documentos usados para feedback
            used_knowledge_ids = result.get('used_knowledge_ids', [])
            
            # Adiciona resposta do assistente
            response_text = result.get('response', '')
            assistant_msg = {'role': 'assistant', 'content': response_text, 'used_knowledge_ids': used_knowledge_ids}
            self.messages.append(assistant_msg)
            self._add_message_bubble(assistant_msg, user_message=user_message)
            
            # Mostra notificação toast se a janela estiver minimizada/fechada
            if self.on_notification_callback:
                conv_id = self.active_conversation.get('id') if self.active_conversation else None
                self.on_notification_callback("AskForge-AI", response_text, conv_id)
            
            # Scroll para o final
            self.msg_canvas.update_idletasks()
            self.msg_canvas.yview_moveto(1.0)
        else:
            # Remove mensagem do usuário em caso de erro
            if self.messages and self.messages[-1].get('role') == 'user':
                self.messages.pop()
                self._render_messages()
            
            Messagebox.show_error(f"Erro ao enviar: {result}", "Erro")
    
    def _rename_conversation(self, conv):
        """Renomeia uma conversa"""
        from ttkbootstrap.dialogs import Querybox
        
        new_title = Querybox.get_string(
            prompt="Novo título:",
            title="Renomear Conversa",
            initialvalue=conv.get('titulo', '')
        )
        
        if new_title:
            def rename_thread():
                success = self.api_client.rename_conversation(conv.get('id'), new_title)
                if success:
                    self.conversations = self.api_client.get_conversations()
                    self.after(0, self._update_conversation_list)
            
            threading.Thread(target=rename_thread, daemon=True).start()
    
    def _delete_conversation(self, conv):
        """Exclui uma conversa"""
        if not Messagebox.yesno("Excluir esta conversa?", "Confirmar"):
            return
        
        def delete_thread():
            success = self.api_client.delete_conversation(conv.get('id'))
            if success:
                self.conversations = self.api_client.get_conversations()
                self.after(0, self._handle_delete_result, conv)
        
        threading.Thread(target=delete_thread, daemon=True).start()
    
    def _handle_delete_result(self, conv):
        """Callback após excluir conversa"""
        if self.active_conversation and self.active_conversation.get('id') == conv.get('id'):
            self.active_conversation = None
            self.messages = []
            self._show_welcome_screen()
        
        self._update_conversation_list()
    
    def refresh_conversations(self):
        """Atualiza lista de conversas"""
        def refresh_thread():
            self.conversations = self.api_client.get_conversations()
            self.after(0, self._update_conversation_list)
        
        threading.Thread(target=refresh_thread, daemon=True).start()


# ============================================================================
# TELA DE CONFIGURAÇÕES
# ============================================================================

class SettingsDialog(ttk.Toplevel):
    """Diálogo de configurações"""
    
    def __init__(self, parent, config, on_save_callback):
        super().__init__(parent)
        self.config = config.copy()
        self.on_save_callback = on_save_callback
        
        self.title("Configurações")
        self.geometry("450x420")
        self.resizable(False, False)
        
        # Centraliza
        self.update_idletasks()
        x = (self.winfo_screenwidth() - 450) // 2
        y = (self.winfo_screenheight() - 420) // 2
        self.geometry(f"+{x}+{y}")
        
        self.transient(parent)
        self.grab_set()
        
        self._create_widgets()
    
    def _create_widgets(self):
        main_frame = ttk.Frame(self, padding=20)
        main_frame.pack(fill=BOTH, expand=YES)
        
        # Título
        ttk.Label(
            main_frame,
            text="⚙️ Configurações",
            font=('Segoe UI', 16, 'bold')
        ).pack(anchor=W, pady=(0, 20))
        
        # URL da API
        url_frame = ttk.Labelframe(main_frame, text="Servidor", padding=10)
        url_frame.pack(fill=X, pady=(0, 15))
        
        ttk.Label(url_frame, text="URL da API:").pack(anchor=W)
        self.url_entry = ttk.Entry(url_frame, font=('Segoe UI', 10))
        self.url_entry.pack(fill=X, pady=(5, 0))
        self.url_entry.insert(0, self.config.get('api_url', ''))
        
        # Atalho
        hotkey_frame = ttk.Labelframe(main_frame, text="Atalho Global", padding=10)
        hotkey_frame.pack(fill=X, pady=(0, 15))
        
        ttk.Label(
            hotkey_frame,
            text="Pressione o atalho para abrir o app da bandeja:"
        ).pack(anchor=W)
        
        hotkey_container = ttk.Frame(hotkey_frame)
        hotkey_container.pack(fill=X, pady=(5, 0))
        
        self.hotkey_entry = ttk.Entry(hotkey_container, font=('Segoe UI', 10), width=20)
        self.hotkey_entry.pack(side=LEFT)
        self.hotkey_entry.insert(0, self.config.get('hotkey', DEFAULT_HOTKEY))
        
        ttk.Button(
            hotkey_container,
            text="Capturar",
            bootstyle="info-outline",
            command=self._capture_hotkey
        ).pack(side=LEFT, padx=(10, 0))
        
        # Info
        ttk.Label(
            hotkey_frame,
            text="Exemplo: ctrl+k, ctrl+shift+space, alt+q",
            font=('Segoe UI', 9),
            foreground='gray'
        ).pack(anchor=W, pady=(5, 0))
        
        # Botões
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=X, pady=(20, 0))
        
        ttk.Button(
            btn_frame,
            text="Cancelar",
            bootstyle="secondary-outline",
            command=self.destroy
        ).pack(side=LEFT)
        
        ttk.Button(
            btn_frame,
            text="OK",
            bootstyle="success",
            command=self._save,
            width=12
        ).pack(side=RIGHT)
    
    def _capture_hotkey(self):
        """Captura atalho de teclado"""
        if not KEYBOARD_AVAILABLE:
            Messagebox.show_warning(
                "Biblioteca 'keyboard' não instalada.\nInstale com: pip install keyboard",
                "Aviso"
            )
            return
        
        self.hotkey_entry.delete(0, END)
        self.hotkey_entry.insert(0, "Pressione o atalho...")
        self.hotkey_entry.config(state=DISABLED)
        self.update()
        
        def capture():
            try:
                hotkey = keyboard.read_hotkey(suppress=False)
                self.after(0, lambda: self._set_captured_hotkey(hotkey))
            except:
                self.after(0, lambda: self._set_captured_hotkey(DEFAULT_HOTKEY))
        
        threading.Thread(target=capture, daemon=True).start()
    
    def _set_captured_hotkey(self, hotkey):
        """Define o atalho capturado"""
        self.hotkey_entry.config(state=NORMAL)
        self.hotkey_entry.delete(0, END)
        self.hotkey_entry.insert(0, hotkey)
    
    def _save(self):
        """Salva configurações"""
        self.config['api_url'] = self.url_entry.get().strip()
        self.config['hotkey'] = self.hotkey_entry.get().strip() or DEFAULT_HOTKEY
        
        save_config(self.config)
        self.on_save_callback(self.config)
        self.destroy()


# ============================================================================
# APLICAÇÃO PRINCIPAL
# ============================================================================

class AskForgeApp:
    """Aplicação principal"""
    
    def __init__(self, single_instance=None):
        self.config = load_config()
        self.api_client = None
        self.tray_icon = None
        self.hotkey_registered = False
        self.single_instance = single_instance
        self.is_window_visible = True  # Rastreia se a janela está visível
        
        # Cria janela principal
        self.root = ttk.Window(
            title=APP_NAME,
            themename="cosmo",
            size=(1100, 700),
            minsize=(900, 600)
        )
        
        # Centraliza
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth() - 1100) // 2
        y = (self.root.winfo_screenheight() - 700) // 2
        self.root.geometry(f"+{x}+{y}")
        
        # Configura ícone se existir
        icon_path = Path(__file__).parent / "icon.png"
        if icon_path.exists():
            try:
                self.icon_image = PhotoImage(file=str(icon_path))
                self.root.iconphoto(True, self.icon_image)
            except:
                pass
        
        # Handler de fechamento
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        
        # Salva o HWND para instância única
        self.root.update_idletasks()
        if self.single_instance:
            try:
                hwnd = int(self.root.winfo_id())
                # No Windows, precisamos do HWND real da janela toplevel
                import ctypes
                hwnd = ctypes.windll.user32.GetParent(hwnd)
                if hwnd == 0:
                    hwnd = int(self.root.winfo_id())
                self.single_instance.save_hwnd(hwnd)
            except Exception as e:
                print(f"Erro ao salvar HWND: {e}")
        
        # Container principal
        self.main_container = ttk.Frame(self.root)
        self.main_container.pack(fill=BOTH, expand=YES)
        
        # Bind para rastrear visibilidade da janela
        self.root.bind('<Map>', self._on_window_show)
        self.root.bind('<Unmap>', self._on_window_hide)
        
        # Verifica configuração
        if not self.config:
            self._show_config_screen()
        else:
            self._init_with_config(self.config)
    
    def _on_window_show(self, event):
        """Callback quando janela é mostrada"""
        self.is_window_visible = True
        print(f"[DEBUG] Janela visível: {self.is_window_visible}")
    
    def _on_window_hide(self, event):
        """Callback quando janela é escondida/minimizada"""
        self.is_window_visible = False
        print(f"[DEBUG] Janela visível: {self.is_window_visible}")
    
    def _check_window_visible(self):
        """Verifica se a janela está realmente visível"""
        try:
            # Verifica estado da janela
            state = self.root.state()
            # withdrawn = minimizado para bandeja, iconic = minimizado normal
            is_visible = state == 'normal' and self.root.winfo_viewable()
            return is_visible
        except:
            return True
    
    def show_notification(self, title, message, conversation_id=None):
        """Mostra notificação toast - ao clicar abre a conversa"""
        # Verifica se a janela está visível
        is_visible = self._check_window_visible()
        
        if not is_visible:
            try:
                # Trunca mensagem se muito longa
                if len(message) > 250:
                    message = message[:247] + "..."
                
                # Armazena o ID da conversa para abrir ao clicar
                self._pending_conversation_id = conversation_id
                
                # Tenta usar winotify (suporta callback de clique)
                if WINOTIFY_AVAILABLE:
                    try:
                        toast = Notification(
                            app_id=APP_NAME,
                            title=title,
                            msg=message,
                            duration="short"
                        )
                        toast.set_audio(audio.Default, loop=False)
                        
                        # Adiciona ação para abrir a conversa
                        toast.add_actions(label="Abrir Conversa", launch=f"askforge://open/{conversation_id}" if conversation_id else "askforge://open")
                        
                        # Callback quando clica na notificação
                        toast.on_click = lambda: self._on_notification_click(conversation_id)
                        
                        toast.show()
                        return
                    except Exception as e:
                        print(f"Erro ao mostrar notificação winotify: {e}")
                
                # Fallback para ttkbootstrap toast (sem callback de clique)
                if TOAST_AVAILABLE:
                    toast = ToastNotification(
                        title=title,
                        message=message + "\n\n(Clique no ícone da bandeja para abrir)",
                        duration=5000,
                        bootstyle="info",
                        alert=True,
                        position=(50, 50, "se")
                    )
                    toast.show_toast()
                
            except Exception as e:
                print(f"Erro ao mostrar notificação: {e}")
    
    def _on_notification_click(self, conversation_id=None):
        """Callback quando clica na notificação - abre a conversa"""
        def open_conversation():
            try:
                # Restaura a janela se estiver minimizada
                self.root.deiconify()
                
                # Força a janela para o estado normal (não minimizado)
                self.root.state('normal')
                
                # Traz para frente
                self.root.lift()
                self.root.attributes('-topmost', True)
                self.root.after(100, lambda: self.root.attributes('-topmost', False))
                
                # Foca na janela
                self.root.focus_force()
                
                print(f"[DEBUG] Janela restaurada. Estado: {self.root.state()}")
                
                # Se tem ID de conversa e tela de chat está ativa, abre a conversa
                if conversation_id and hasattr(self, 'chat_screen') and self.chat_screen:
                    # Busca a conversa na lista
                    for conv in self.chat_screen.conversations:
                        if conv.get('id') == conversation_id:
                            print(f"[DEBUG] Abrindo conversa: {conv.get('titulo', 'Sem título')}")
                            self.chat_screen._select_conversation(conv)
                            break
            except Exception as e:
                print(f"[DEBUG] Erro ao abrir janela: {e}")
        
        # Executa na thread principal
        self.root.after(0, open_conversation)
    
    def _show_config_screen(self):
        """Mostra tela de configuração inicial"""
        ConfigScreen(self.root, self._on_config_saved)
    
    def _on_config_saved(self, config):
        """Callback quando configuração é salva"""
        self.config = config
        self._init_with_config(config)
    
    def _init_with_config(self, config):
        """Inicializa com configuração"""
        self.api_client = APIClient(config.get('api_url', ''))
        
        # Testa conexão
        if not self.api_client.test_connection():
            Messagebox.show_warning(
                "Não foi possível conectar ao servidor.\nVerifique a URL nas configurações.",
                "Aviso de Conexão"
            )
        
        # Mostra tela de login
        self._show_login_screen()
        
        # Configura system tray
        self._setup_tray()
        
        # Configura hotkey
        self._setup_hotkey()
    
    def _show_login_screen(self):
        """Mostra tela de login"""
        self._clear_main_container()
        
        self.login_screen = LoginScreen(
            self.main_container,
            self.api_client,
            self._on_login_success,
            self._on_url_changed_from_login
        )
        self.login_screen.pack(fill=BOTH, expand=YES)
    
    def _on_url_changed_from_login(self, new_url):
        """Callback quando URL é alterada na tela de login"""
        self.config['api_url'] = new_url
        save_config(self.config)
    
    def _on_login_success(self, user):
        """Callback quando login é bem sucedido"""
        self._show_chat_screen(user)
    
    def _show_chat_screen(self, user):
        """Mostra tela de chat"""
        self._clear_main_container()
        
        self.chat_screen = ChatScreen(
            self.main_container,
            self.api_client,
            user,
            self._on_logout,
            self._show_settings,
            on_notification_callback=self.show_notification
        )
        self.chat_screen.pack(fill=BOTH, expand=YES)
    
    def _on_logout(self):
        """Callback de logout"""
        self.api_client.session = requests.Session()
        self.api_client.user = None
        self._show_login_screen()
    
    def _show_settings(self):
        """Mostra diálogo de configurações"""
        SettingsDialog(self.root, self.config, self._on_settings_saved)
    
    def _on_settings_saved(self, new_config):
        """Callback quando configurações são salvas"""
        old_hotkey = self.config.get('hotkey')
        self.config = new_config
        
        # Atualiza URL da API
        if self.api_client:
            self.api_client.base_url = new_config.get('api_url', '').rstrip('/')
        
        # Atualiza hotkey se mudou
        if new_config.get('hotkey') != old_hotkey:
            self._setup_hotkey()
    
    def _clear_main_container(self):
        """Limpa container principal"""
        for widget in self.main_container.winfo_children():
            widget.destroy()
    
    def _setup_tray(self):
        """Configura ícone na bandeja do sistema"""
        if not TRAY_AVAILABLE:
            return
        
        # Carrega ícone
        icon_path = Path(__file__).parent / "icon.png"
        if icon_path.exists():
            try:
                image = PILImage.open(str(icon_path))
                image = image.resize((64, 64), PILImage.Resampling.LANCZOS)
            except:
                # Cria ícone padrão
                image = PILImage.new('RGB', (64, 64), color='blue')
        else:
            image = PILImage.new('RGB', (64, 64), color='blue')
        
        # Menu do tray
        menu = pystray.Menu(
            pystray.MenuItem("Abrir", self._show_from_tray, default=True),
            pystray.MenuItem("Configurações", lambda: self.root.after(0, self._show_settings)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair", self._quit_app)
        )
        
        self.tray_icon = pystray.Icon(
            APP_NAME,
            image,
            APP_NAME,
            menu
        )
        
        # Inicia em thread separada
        threading.Thread(target=self.tray_icon.run, daemon=True).start()
    
    def _setup_hotkey(self):
        """Configura atalho global"""
        if not KEYBOARD_AVAILABLE:
            return
        
        # Remove hotkey anterior
        if self.hotkey_registered:
            try:
                keyboard.unhook_all_hotkeys()
            except:
                pass
        
        # Registra novo hotkey
        hotkey = self.config.get('hotkey', DEFAULT_HOTKEY)
        try:
            # suppress=True evita que o atalho seja passado para outros apps
            # trigger_on_release=True evita disparo duplo
            keyboard.add_hotkey(hotkey, self._show_from_tray, suppress=True, trigger_on_release=True)
            self.hotkey_registered = True
        except Exception as e:
            print(f"Erro ao registrar hotkey: {e}")
    
    def _show_from_tray(self):
        """Mostra janela da bandeja"""
        # Evita chamadas duplicadas
        if hasattr(self, '_last_hotkey_time'):
            import time
            if time.time() - self._last_hotkey_time < 0.5:
                return
        
        import time
        self._last_hotkey_time = time.time()
        
        def show():
            self.root.deiconify()
            self.root.lift()
            self.root.focus_force()
        
        self.root.after(0, show)
    
    def _on_close(self):
        """Handler de fechamento - minimiza para bandeja"""
        if TRAY_AVAILABLE and self.tray_icon:
            self.root.withdraw()
        else:
            self._quit_app()
    
    def _quit_app(self):
        """Encerra aplicação"""
        # Remove hotkey
        if KEYBOARD_AVAILABLE and self.hotkey_registered:
            try:
                keyboard.unhook_all_hotkeys()
            except:
                pass
        
        # Para tray icon
        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except:
                pass
        
        # Fecha janela
        self.root.quit()
        self.root.destroy()
    
    def run(self):
        """Inicia aplicação"""
        self.root.mainloop()


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    # Verifica se já existe uma instância rodando
    single_instance = SingleInstance()
    
    if single_instance.is_already_running():
        # Tenta trazer a janela existente para frente
        print("Aplicativo já está em execução. Trazendo para frente...")
        if single_instance.bring_existing_to_front():
            print("Janela existente ativada.")
        else:
            print("Não foi possível ativar a janela existente.")
        sys.exit(0)
    
    try:
        app = AskForgeApp(single_instance=single_instance)
        app.run()
    finally:
        # Libera o mutex ao sair
        single_instance.release()

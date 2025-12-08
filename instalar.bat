@echo off
chcp 65001 >nul
echo ========================================
echo   Instalação - Base de Conhecimento
echo ========================================
echo.

:: Verifica se Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js não encontrado!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

:: Verifica se Python está instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Python não encontrado!
    echo Por favor, instale o Python em: https://python.org/
    pause
    exit /b 1
)

echo [1/4] Instalando dependências do Node.js...
echo.
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependências do Node.js
    pause
    exit /b 1
)

echo.
echo [2/4] Instalando dependências do Python...
echo.
pip install mysql-connector-python bcrypt python-dotenv
if %errorlevel% neq 0 (
    echo [AVISO] Algumas dependências Python podem não ter sido instaladas
)

echo.
echo [3/4] Criando pasta de uploads...
if not exist "public\uploads\images" mkdir "public\uploads\images"

echo.
echo [4/4] Inicializando banco de dados...
echo.
echo IMPORTANTE: Certifique-se que o MySQL está rodando!
echo.
set /p continuar="Deseja inicializar o banco de dados agora? (S/N): "
if /i "%continuar%"=="S" (
    python init_db.py
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao inicializar o banco de dados
        echo Verifique se o MySQL está rodando e as credenciais no arquivo .env
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo   Instalação concluída com sucesso!
echo ========================================
echo.
echo Para iniciar o projeto, execute: iniciar.bat
echo.
echo Credenciais padrão:
echo   Email: admin@admin.com
echo   Senha: admin123
echo.
pause

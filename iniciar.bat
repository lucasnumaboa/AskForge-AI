@echo off
chcp 65001 >nul
echo ========================================
echo   Base de Conhecimento Corporativa
echo ========================================
echo.

:: Verifica se node_modules existe
if not exist "node_modules" (
    echo [ERRO] Dependências não instaladas!
    echo Execute primeiro: instalar.bat
    pause
    exit /b 1
)

echo Iniciando servidor de desenvolvimento...
echo.
echo Acesse: http://localhost:3000
echo.
echo Credenciais padrão:
echo   Email: admin@admin.com
echo   Senha: admin123
echo.
echo Pressione Ctrl+C para parar o servidor
echo ========================================
echo.

npm run dev

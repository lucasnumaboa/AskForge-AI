@echo off
chcp 65001 > nul
title Gerenciador de Usuários - Base de Conhecimento

echo.
echo ============================================
echo   Gerenciador de Usuários
echo   Base de Conhecimento
echo ============================================
echo.

REM Verifica se Python está instalado
python --version > nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python não encontrado!
    echo Por favor, instale o Python 3.x
    pause
    exit /b 1
)

REM Verifica se bcrypt está instalado
python -c "import bcrypt" > nul 2>&1
if errorlevel 1 (
    echo Instalando dependência bcrypt...
    pip install bcrypt
)

REM Executa o aplicativo
python app.py

pause

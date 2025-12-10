@echo off
chcp 65001 >nul
echo Iniciando AskForge-AI Client...
echo.

REM Verifica se as dependências estão instaladas
python -c "import ttkbootstrap" >nul 2>&1
if errorlevel 1 (
    echo Instalando dependências...
    pip install -r requirements_client.txt
    echo.
)

REM Executa o cliente
python client.py

if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao executar o cliente!
    pause
)

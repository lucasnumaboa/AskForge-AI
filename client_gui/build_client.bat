@echo off
chcp 65001 >nul
echo ============================================
echo   AskForge-AI - Build do Cliente Desktop
echo ============================================
echo.

REM Verifica se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python não encontrado!
    echo Instale o Python 3.8+ e adicione ao PATH.
    pause
    exit /b 1
)

REM Instala dependências
echo [1/3] Instalando dependências...
pip install -r requirements_client.txt
pip install pyinstaller

if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependências!
    pause
    exit /b 1
)

echo.
echo [2/3] Gerando executável...

REM Gera o executável
pyinstaller --noconfirm --onefile --windowed ^
    --name "AskForge-AI" ^
    --icon "icon.png" ^
    --add-data "icon.png;." ^
    --hidden-import "pystray._win32" ^
    --hidden-import "PIL._tkinter_finder" ^
    client.py

if errorlevel 1 (
    echo [ERRO] Falha ao gerar executável!
    pause
    exit /b 1
)

echo.
echo [3/3] Limpando arquivos temporários...
rmdir /s /q build 2>nul
del /q *.spec 2>nul

echo.
echo ============================================
echo   Build concluído com sucesso!
echo   Executável: dist\AskForge-AI.exe
echo ============================================
echo.

REM Abre pasta dist
explorer dist

pause

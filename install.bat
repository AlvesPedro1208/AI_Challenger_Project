@echo off
chcp 65001 >nul
cls
echo ========================================
echo    🚀 AI Challenger Project - Instalador
echo ========================================
echo.

echo 📋 Verificando dependências...
echo.

REM Verificar se Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python não encontrado!
    echo.
    echo 📥 Por favor, instale Python 3.9+ de: https://www.python.org/downloads/
    echo ⚠️  IMPORTANTE: Marque "Add Python to PATH" durante a instalação
    echo.
    pause
    exit /b 1
) else (
    echo ✅ Python encontrado
    python --version
)

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado!
    echo.
    echo 📥 Por favor, instale Node.js LTS de: https://nodejs.org/
    echo.
    pause
    exit /b 1
) else (
    echo ✅ Node.js encontrado
    node --version
)

echo.
echo 🔧 Iniciando instalação das dependências...
echo.

REM Instalar dependências Python
echo 📦 Instalando dependências Python...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências Python
    echo 💡 Tentando com --user...
    pip install --user -r requirements.txt
    if %errorlevel% neq 0 (
        echo ❌ Falha na instalação das dependências Python
        pause
        exit /b 1
    )
)
echo ✅ Dependências Python instaladas com sucesso!
echo.

REM Instalar dependências Node.js
echo 📦 Instalando dependências Node.js...
cd frontend
npm install
if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências Node.js
    echo 💡 Tentando limpar cache...
    npm cache clean --force
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Falha na instalação das dependências Node.js
        cd ..
        pause
        exit /b 1
    )
)
cd ..
echo ✅ Dependências Node.js instaladas com sucesso!
echo.

REM Verificar arquivo .env
if not exist ".env" (
    echo ⚠️  Arquivo .env não encontrado!
    echo.
    echo 📝 Criando arquivo .env modelo...
    echo # Configurações do Banco Oracle > .env
    echo DB_HOST=localhost >> .env
    echo DB_PORT=1521 >> .env
    echo DB_SID=XE >> .env
    echo DB_USER=seu_usuario >> .env
    echo DB_PASSWORD=sua_senha >> .env
    echo DB_SCHEMA=seu_schema >> .env
    echo.
    echo ✅ Arquivo .env criado!
    echo ⚠️  IMPORTANTE: Edite o arquivo .env com suas credenciais do banco Oracle
    echo.
) else (
    echo ✅ Arquivo .env encontrado
)

echo.
echo 🎉 Instalação concluída com sucesso!
echo.
echo 📋 Próximos passos:
echo    1. Edite o arquivo .env com suas credenciais do banco Oracle
echo    2. Execute o arquivo run.bat para iniciar o projeto
echo.
echo 💡 Dica: Use o arquivo check.bat para verificar se tudo está funcionando
echo.
pause
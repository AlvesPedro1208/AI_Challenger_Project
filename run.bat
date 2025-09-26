@echo off
chcp 65001 >nul
cls
echo ========================================
echo    🚀 AI Challenger Project - Executar
echo ========================================
echo.

REM Verificar se as dependências estão instaladas
echo 🔍 Verificando instalação...

python -c "import fastapi, cv2, ultralytics, oracledb" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Dependências Python não encontradas!
    echo 💡 Execute install.bat primeiro
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo ❌ Dependências Node.js não encontradas!
    echo 💡 Execute install.bat primeiro
    pause
    exit /b 1
)

if not exist ".env" (
    echo ❌ Arquivo .env não encontrado!
    echo 💡 Execute install.bat primeiro ou crie o arquivo .env manualmente
    pause
    exit /b 1
)

echo ✅ Dependências verificadas!
echo.

echo 🚀 Iniciando servidores...
echo.
echo 📋 O que vai acontecer:
echo    • Backend (Python/FastAPI) será iniciado na porta 8000
echo    • Frontend (React/Vite) será iniciado na porta 5173
echo    • Duas janelas de terminal serão abertas
echo    • O navegador abrirá automaticamente
echo.
echo ⚠️  Para parar os servidores, feche as janelas ou pressione Ctrl+C
echo.

pause

REM Iniciar backend em nova janela
echo 🔧 Iniciando backend...
start "AI Challenger - Backend" cmd /k "cd /d "%~dp0src" && echo 🐍 Iniciando servidor Python... && python main.py"

REM Aguardar um pouco para o backend iniciar
timeout /t 3 /nobreak >nul

REM Iniciar frontend em nova janela
echo 🎨 Iniciando frontend...
start "AI Challenger - Frontend" cmd /k "cd /d "%~dp0frontend" && echo ⚛️  Iniciando servidor React... && npm run dev"

REM Aguardar um pouco para o frontend iniciar
timeout /t 5 /nobreak >nul

echo.
echo 🎉 Servidores iniciados!
echo.
echo 🌐 URLs de acesso:
echo    • Frontend: http://localhost:5173
echo    • Backend API: http://localhost:8000
echo    • Documentação API: http://localhost:8000/docs
echo.
echo 💡 O navegador deve abrir automaticamente em alguns segundos...
echo.
echo ⚠️  Mantenha as janelas dos servidores abertas para o projeto funcionar
echo.

REM Tentar abrir o navegador
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo ✅ Projeto executado com sucesso!
echo.
echo 📋 Para parar o projeto:
echo    • Feche as janelas "AI Challenger - Backend" e "AI Challenger - Frontend"
echo    • Ou pressione Ctrl+C em cada janela
echo.
pause
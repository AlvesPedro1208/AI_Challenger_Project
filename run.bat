@echo off
cls
echo ========================================
echo    AI Challenger Project - Executar
echo ========================================
echo.

REM Verificar se as dependencias estao instaladas
echo [INFO] Verificando instalacao...

python -c "import fastapi, cv2, ultralytics, oracledb" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Dependencias Python nao encontradas!
    echo [DICA] Execute install.bat primeiro
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [ERRO] Dependencias Node.js nao encontradas!
    echo [DICA] Execute install.bat primeiro
    pause
    exit /b 1
)

if not exist ".env" (
    echo [ERRO] Arquivo .env nao encontrado!
    echo [DICA] Execute install.bat primeiro ou crie o arquivo .env manualmente
    pause
    exit /b 1
)

echo [OK] Dependencias verificadas!
echo.

echo [INFO] Iniciando servidores automaticamente...
echo.
echo O que vai acontecer:
echo    - Backend (Python/FastAPI) sera iniciado na porta 8000
echo    - Frontend (React/Vite) sera iniciado na porta 5173
echo    - Duas janelas de terminal serao abertas
echo    - O navegador abrira automaticamente
echo.
echo AVISO: Para parar os servidores, feche as janelas ou pressione Ctrl+C
echo.

REM Iniciar backend em nova janela
echo [INFO] Iniciando backend...
start "AI Challenger - Backend" cmd /k "cd /d "%~dp0src" && echo [BACKEND] Iniciando servidor Python... && python main.py"

REM Aguardar um pouco para o backend iniciar
timeout /t 3 /nobreak >nul

REM Iniciar frontend em nova janela
echo [INFO] Iniciando frontend...
start "AI Challenger - Frontend" cmd /k "cd /d "%~dp0frontend" && echo [FRONTEND] Iniciando servidor React... && npm run dev"

REM Aguardar um pouco para o frontend iniciar
timeout /t 5 /nobreak >nul

echo.
echo [OK] Servidores iniciados!
echo.
echo URLs de acesso:
echo    - Frontend: http://localhost:8080
echo    - Backend API: http://localhost:8000
echo    - Documentacao API: http://localhost:8000/docs
echo.
echo [INFO] O navegador deve abrir automaticamente em alguns segundos...
echo.
echo AVISO: Mantenha as janelas dos servidores abertas para o projeto funcionar
echo.

REM Tentar abrir o navegador
timeout /t 3 /nobreak >nul
start http://localhost:8080

echo [OK] Projeto executado com sucesso!
echo.
echo Para parar o projeto:
echo    - Feche as janelas "AI Challenger - Backend" e "AI Challenger - Frontend"
echo    - Ou pressione Ctrl+C em cada janela
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
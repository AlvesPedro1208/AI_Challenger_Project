@echo off
TITLE Servidor da API - Projeto IA

echo.
echo ======================================================
echo      Iniciando Servidor da API do Projeto...
echo ======================================================
echo.

echo Ativando o ambiente virtual (.venv)...
CALL .venv\Scripts\activate

echo.
echo Ambiente ativado. Iniciando o servidor Uvicorn...
echo Acesse a API em http://127.0.0.1:8000/docs
echo.
echo Pressione CTRL+C nesta janela para parar o servidor.
echo.

python -m uvicorn src.main:app --reload

echo.
echo Servidor encerrado.
pause
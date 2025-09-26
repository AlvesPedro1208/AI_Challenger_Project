# AI Challenger Project

Sistema de análise de comportamento de clientes em lojas usando IA e visão computacional.

## 📋 Pré-requisitos

### Backend (Python)
- Python 3.8 ou superior (recomendado: Python 3.9+)
- pip (gerenciador de pacotes Python)

### Frontend (React)
- Node.js 18 ou superior (recomendado: Node.js 20+)
- npm (incluído com Node.js)

### Banco de Dados
- Oracle Database (configurado e acessível)
- Credenciais de acesso ao banco

## ⚡ Instalação SUPER FÁCIL (Windows)

### 🎯 Método Automático (Recomendado)

**Para usuários Windows - 3 cliques e pronto!**

1. **Instalar dependências**: Clique duas vezes em `install.bat`
2. **Configurar banco**: Edite o arquivo `.env` criado
3. **Executar projeto**: Clique duas vezes em `run.bat`

**Arquivos disponíveis:**
- `install.bat` - Instala todas as dependências automaticamente
- `run.bat` - Executa o projeto (backend + frontend)
- `check.bat` - Verifica se está tudo funcionando
- `COMO_USAR.md` - Instruções super simples

---

## 🛠️ Instalação Manual (Avançado)

### 1. Verificar versões instaladas
Antes de começar, verifique se você tem as versões corretas instaladas:

```bash
# Verificar Python
python --version
# ou
python3 --version

# Verificar Node.js
node --version

# Verificar npm
npm --version
```

### 2. Clone ou baixe o projeto
```bash
# Se usando git
git clone <url-do-repositorio>
cd AI_Challenger_Project

# Ou simplesmente extraia os arquivos baixados
```

### 2. Configuração do Backend

#### 2.1. Instale as dependências Python
```bash
pip install -r requirements.txt
```

**Nota:** O arquivo `requirements.txt` contém todas as dependências necessárias, incluindo:
- FastAPI (framework web)
- Ultralytics (YOLO para detecção de objetos)
- OpenCV (processamento de imagem)
- OracleDB (conexão com banco Oracle)
- E muitas outras bibliotecas essenciais

#### 2.2. Configure o banco de dados
1. Edite o arquivo `.env` na raiz do projeto
2. Configure as variáveis de conexão com o Oracle:
```env
ORA_HOST=seu_host_oracle
ORA_PORT=1521
ORA_SID=seu_sid
ORA_USER=seu_usuario
ORA_PASSWORD=sua_senha
ORA_SCHEMA=seu_schema
```

#### 2.3. Execute o backend
```bash
cd src
python main.py
```

### 3. Configuração do Frontend

#### 3.1. Instale as dependências
```bash
cd frontend
npm install
```

**Nota:** O `package.json` contém todas as dependências do frontend, incluindo:
- React 18 (biblioteca principal)
- Vite (build tool)
- TailwindCSS (estilização)
- Radix UI (componentes)
- React Router (navegação)
- E muitas outras bibliotecas modernas

#### 3.2. Execute o frontend
```bash
npm run dev
```

O frontend estará disponível em: `http://localhost:5173`

## 📁 Estrutura do Projeto

```
AI_Challenger_Project/
├── src/                    # Backend Python
│   ├── main.py            # Servidor principal
│   ├── db_oracle.py       # Conexão com Oracle
│   ├── mvp_store_ai.py    # Lógica de IA
│   ├── roi_picker.py      # Seleção de ROIs
│   └── utils/             # Utilitários
├── frontend/              # Frontend React
│   ├── src/               # Código fonte React
│   ├── public/            # Arquivos públicos
│   └── package.json       # Dependências Node.js
├── data/                  # Dados do projeto
├── requirements.txt       # Dependências Python
├── rois.json             # Configuração de ROIs
└── .env                  # Configurações de ambiente
```

## 🔧 Funcionalidades

- **Upload de Vídeos**: Interface para upload de vídeos de câmeras de segurança
- **Análise de IA**: Processamento automático usando visão computacional
- **Dashboard**: Visualização de KPIs e métricas de comportamento
- **ROI Selection**: Definição de regiões de interesse nos vídeos
- **Banco Oracle**: Armazenamento de dados e resultados

## 🐛 Solução de Problemas

### Erro de conexão com Oracle
- Verifique se o banco Oracle está rodando
- Confirme as credenciais no arquivo `.env`
- Teste a conectividade de rede

### Frontend não carrega
- Verifique se o Node.js está instalado corretamente
- Execute `npm install` novamente se necessário
- Confirme se a porta 5173 está disponível

### Dependências Python
- Use um ambiente virtual Python: `python -m venv venv`
- Ative o ambiente: `venv\Scripts\activate` (Windows) ou `source venv/bin/activate` (Linux/Mac)
- Instale as dependências: `pip install -r requirements.txt`

## 📞 Suporte

Se encontrar problemas durante a instalação ou execução, verifique:
1. Versões dos pré-requisitos
2. Configurações do arquivo `.env`
3. Logs de erro no terminal

## 🎯 Como Usar

1. **Inicie o backend**: Execute `python main.py` na pasta `src`
2. **Inicie o frontend**: Execute `npm run dev` na pasta `frontend`
3. **Acesse o sistema**: Abra `http://localhost:5173` no navegador
4. **Faça upload de vídeos**: Use a interface para enviar vídeos
5. **Visualize resultados**: Acesse o dashboard para ver as análises

---

**Nota**: Este projeto foi desenvolvido para o AI Challenger 2025. Certifique-se de ter todas as dependências instaladas antes de executar.
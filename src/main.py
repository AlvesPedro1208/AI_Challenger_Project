# src/main.py
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import oracledb
from src.db_oracle import _connect

app = FastAPI(
    title="API do Projeto de IA",
    description="API para processar e servir dados do banco Oracle.",
    version="1.0.0"
)

origins = [
    "http://localhost",
    "http://localhost:3000", # Endereço comum para desenvolvimento frontend (React)
    "http://localhost:4200", # Endereço comum para desenvolvimento frontend (Angular)
    "http://localhost:8080", # Endereço comum para desenvolvimento frontend (Vue)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Bem-vindo à API do projeto!"}


@app.get("/funnel-camera")
async def get_funnel_data():
    conn = None
    try:
        conn = _connect()
        cursor = conn.cursor()

        sql_query = "SELECT * FROM V_FUNNEL_CAMERA"
        cursor.execute(sql_query)

        columns = [col[0].lower() for col in cursor.description]
        data = [dict(zip(columns, row)) for row in cursor.fetchall()]

        return {"data": data}

    except oracledb.Error as e:
        print(f"Erro ao buscar dados da V_FUNNEL_CAMERA: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao acessar o banco de dados.")

    finally:
        if conn:
            conn.close()
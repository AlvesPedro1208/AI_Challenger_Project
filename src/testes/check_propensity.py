import os
from dotenv import load_dotenv; load_dotenv()
import oracledb
from datetime import datetime

# Conectar ao banco
dsn = oracledb.makedsn(os.getenv("ORA_HOST"), int(os.getenv("ORA_PORT")), sid=os.getenv("ORA_SID"))
with oracledb.connect(user=os.getenv("ORA_USER"), password=os.getenv("ORA_PASSWORD"), dsn=dsn) as c:
    with c.cursor() as cur:
        print("=== VERIFICAÇÃO DE PROPENSÃO MÉDIA ===")
        print()
        
        # Primeiro, verificar quais tabelas existem
        print("📋 TABELAS EXISTENTES:")
        cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
        tabelas = cur.fetchall()
        for tabela in tabelas:
            print(f"   📄 {tabela[0]}")
        print()
        
        # Verificar dados na tabela objetos_cliente
        print("📊 DADOS NA TABELA OBJETOS_CLIENTE:")
        cur.execute("""
            SELECT id_pessoa, acao, tipo_objeto, id_roi, confianca, 
                   TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI:SS') as data_formatada
            FROM objetos_cliente 
            ORDER BY data_hora DESC
        """)
        
        objetos = cur.fetchall()
        if objetos:
            print(f"Total de registros: {len(objetos)}")
            print()
            for obj in objetos:
                pessoa, acao, tipo, roi, conf, data = obj
                print(f"👤 Cliente: {pessoa}")
                print(f"🎯 Ação: {acao}")
                print(f"📦 Tipo: {tipo}")
                print(f"📍 ROI: {roi}")
                print(f"🎯 Confiança: {conf}")
                print(f"⏰ Data/Hora: {data}")
                print("-" * 50)
        else:
            print("❌ Nenhum registro encontrado na tabela objetos_cliente")
        
        print()
        print("📈 ANÁLISE DE PROPENSÃO:")
        
        # Verificar eventos de segurar (propensão média)
        cur.execute("""
            SELECT id_pessoa, COUNT(*) as total_segurar
            FROM objetos_cliente 
            WHERE acao = 'segurar'
            GROUP BY id_pessoa
        """)
        
        segurar_dados = cur.fetchall()
        if segurar_dados:
            print("✅ CLIENTES COM PROPENSÃO MÉDIA (segurar objeto):")
            for pessoa, total in segurar_dados:
                print(f"   👤 {pessoa}: {total} evento(s) de segurar")
        else:
            print("❌ Nenhum cliente com propensão média encontrado")
        
        print()
        
        # Verificar todos os tipos de ação
        cur.execute("""
            SELECT acao, COUNT(*) as total
            FROM objetos_cliente 
            GROUP BY acao
            ORDER BY total DESC
        """)
        
        acoes = cur.fetchall()
        if acoes:
            print("📊 RESUMO POR TIPO DE AÇÃO:")
            for acao, total in acoes:
                emoji = {
                    'pegar': '🤏',
                    'segurar': '✋',
                    'colocar': '📥',
                    'colocar_carrinho': '🛒'
                }.get(acao, '❓')
                print(f"   {emoji} {acao}: {total} evento(s)")
        
        print()
        print("=== FIM DA VERIFICAÇÃO ===")
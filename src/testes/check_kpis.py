import os
from dotenv import load_dotenv; load_dotenv()
import oracledb
from datetime import datetime

# Conectar ao banco
dsn = oracledb.makedsn(os.getenv("ORA_HOST"), int(os.getenv("ORA_PORT")), sid=os.getenv("ORA_SID"))
with oracledb.connect(user=os.getenv("ORA_USER"), password=os.getenv("ORA_PASSWORD"), dsn=dsn) as c:
    with c.cursor() as cur:
        print("=== RELATÓRIO DE KPIs PARA DASHBOARD ===")
        print()
        
        # 1. PROPENSÃO DE COMPRA POR CLIENTE
        print("📊 1. PROPENSÃO DE COMPRA POR CLIENTE:")
        print()
        
        # Buscar todos os clientes únicos
        cur.execute("SELECT DISTINCT id_pessoa FROM objetos_cliente ORDER BY id_pessoa")
        clientes = [row[0] for row in cur.fetchall()]
        
        for cliente in clientes:
            print(f"👤 CLIENTE: {cliente}")
            
            # Verificar ações do cliente
            cur.execute("""
                SELECT acao, COUNT(*) as total, 
                       MIN(TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI:SS')) as primeira_acao,
                       MAX(TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI:SS')) as ultima_acao
                FROM objetos_cliente 
                WHERE id_pessoa = :cliente
                GROUP BY acao
                ORDER BY total DESC
            """, {'cliente': cliente})
            
            acoes = cur.fetchall()
            score_propensao = 0
            nivel_propensao = "BAIXA"
            
            for acao, total, primeira, ultima in acoes:
                emoji = {
                    'pegar': '🤏',
                    'segurar': '✋',
                    'colocar': '📥',
                    'colocar_carrinho': '🛒'
                }.get(acao, '❓')
                
                print(f"   {emoji} {acao}: {total} vez(es) | {primeira} → {ultima}")
                
                # Calcular score de propensão
                if acao == 'pegar':
                    score_propensao += total * 1
                elif acao == 'segurar':
                    score_propensao += total * 3  # Segurar = MÉDIA propensão
                elif acao == 'colocar':
                    score_propensao += total * 1
                elif acao == 'colocar_carrinho':
                    score_propensao += total * 5  # Carrinho = ALTA propensão
            
            # Determinar nível de propensão
            if score_propensao >= 15:
                nivel_propensao = "ALTA"
            elif score_propensao >= 8:
                nivel_propensao = "MÉDIA"
            else:
                nivel_propensao = "BAIXA"
            
            print(f"   📈 SCORE PROPENSÃO: {score_propensao} pontos")
            print(f"   🎯 NÍVEL: {nivel_propensao}")
            print("-" * 60)
        
        print()
        
        # 2. RESUMO GERAL DE PROPENSÃO
        print("📈 2. RESUMO GERAL DE PROPENSÃO:")
        print()
        
        # Clientes com propensão MÉDIA (segurar objetos)
        cur.execute("""
            SELECT COUNT(DISTINCT id_pessoa) as total_clientes_media
            FROM objetos_cliente 
            WHERE acao = 'segurar'
        """)
        clientes_media = cur.fetchone()[0]
        
        # Clientes com propensão ALTA (colocar no carrinho)
        cur.execute("""
            SELECT COUNT(DISTINCT id_pessoa) as total_clientes_alta
            FROM objetos_cliente 
            WHERE acao = 'colocar_carrinho'
        """)
        clientes_alta = cur.fetchone()[0]
        
        # Total de clientes
        total_clientes = len(clientes)
        
        print(f"👥 TOTAL DE CLIENTES: {total_clientes}")
        print(f"🟡 PROPENSÃO MÉDIA: {clientes_media} cliente(s) ({(clientes_media/total_clientes*100):.1f}%)")
        print(f"🔴 PROPENSÃO ALTA: {clientes_alta} cliente(s) ({(clientes_alta/total_clientes*100):.1f}%)")
        print(f"🟢 PROPENSÃO BAIXA: {total_clientes - clientes_media - clientes_alta} cliente(s)")
        
        print()
        
        # 3. PRODUTOS MAIS INTERAGIDOS
        print("🛍️ 3. PRODUTOS MAIS INTERAGIDOS (por ROI):")
        print()
        
        cur.execute("""
            SELECT id_roi, acao, COUNT(*) as total_interacoes
            FROM objetos_cliente 
            GROUP BY id_roi, acao
            ORDER BY id_roi, total_interacoes DESC
        """)
        
        produtos = cur.fetchall()
        roi_atual = None
        
        for roi, acao, total in produtos:
            if roi != roi_atual:
                if roi_atual is not None:
                    print()
                print(f"📍 ROI: {roi}")
                roi_atual = roi
            
            emoji = {
                'pegar': '🤏',
                'segurar': '✋',
                'colocar': '📥',
                'colocar_carrinho': '🛒'
            }.get(acao, '❓')
            
            print(f"   {emoji} {acao}: {total} interação(ões)")
        
        print()
        
        # 4. DADOS PARA DASHBOARD (formato JSON-like)
        print("📊 4. DADOS ESTRUTURADOS PARA DASHBOARD:")
        print()
        print("```json")
        print("{")
        print(f'  "total_clientes": {total_clientes},')
        print(f'  "propensao_media": {clientes_media},')
        print(f'  "propensao_alta": {clientes_alta},')
        print(f'  "propensao_baixa": {total_clientes - clientes_media - clientes_alta},')
        print(f'  "taxa_conversao_media": {(clientes_media/total_clientes*100):.1f},')
        print(f'  "taxa_conversao_alta": {(clientes_alta/total_clientes*100):.1f},')
        print('  "ultima_atualizacao": "' + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + '"')
        print("}")
        print("```")
        
        print()
        print("=== FIM DO RELATÓRIO ===")
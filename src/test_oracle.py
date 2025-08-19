import os
from dotenv import load_dotenv; load_dotenv()
import oracledb

dsn = oracledb.makedsn(os.getenv("ORA_HOST"), int(os.getenv("ORA_PORT")), sid=os.getenv("ORA_SID"))
with oracledb.connect(user=os.getenv("ORA_USER"), password=os.getenv("ORA_PASSWORD"), dsn=dsn) as c:
    with c.cursor() as cur:
        cur.execute("SELECT * FROM user_tables")
        print("ok, tables:", len(cur.fetchall()))
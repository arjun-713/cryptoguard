import aiosqlite
from config import settings

DB_PATH = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")

async def init_broker_registry_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS broker_customers (
                wallet_address TEXT PRIMARY KEY,
                customer_name TEXT,
                account_type TEXT,
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_flagged BOOLEAN DEFAULT 0
            )
        """)
        await db.commit()

async def register_wallet(address: str, name: str, account_type: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT OR REPLACE INTO broker_customers (wallet_address, customer_name, account_type, registered_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """, (address.lower(), name, account_type))
        await db.commit()

async def get_registered_wallets() -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM broker_customers") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

async def is_registered(address: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT 1 FROM broker_customers WHERE wallet_address = ?", (address.lower(),)) as cursor:
            row = await cursor.fetchone()
            return row is not None

async def get_wallet_info(address: str) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM broker_customers WHERE wallet_address = ?", (address.lower(),)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

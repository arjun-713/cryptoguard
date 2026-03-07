import aiosqlite
from config import settings

DB_PATH = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")

async def init_db():
    """Create all necessary database tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        # suspicious_addresses table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS suspicious_addresses (
                address TEXT PRIMARY KEY,
                first_seen TIMESTAMP,
                last_seen TIMESTAMP,
                times_flagged INTEGER DEFAULT 1,
                highest_score INTEGER,
                triggered_rules TEXT,
                notes TEXT
            )
        """)
        
        # wallet_history table (Fix 2)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS wallet_history (
                address TEXT,
                tx_hash TEXT,
                timestamp TEXT,
                eth_value REAL,
                risk_score INTEGER
            )
        """)
        # Index for performance on large history
        await db.execute("CREATE INDEX IF NOT EXISTS idx_wallet_history_address ON wallet_history (address)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_wallet_history_timestamp ON wallet_history (timestamp)")
        
        await db.commit()
    
    # Initialize and load stats (Fix 5)
    from db.stats import init_stats_db, load_stats
    await init_stats_db()
    await load_stats()

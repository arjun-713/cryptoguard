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
        
        # case_actions table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS case_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_id TEXT,
                action TEXT,
                analyst_notes TEXT,
                actioned_at TEXT,
                actioned_by TEXT,
                is_seed INTEGER DEFAULT 0,
                from_address TEXT,
                to_address TEXT,
                eth_value REAL,
                risk_score INTEGER,
                risk_tier TEXT,
                triggered_rules TEXT,
                ai_explanation TEXT,
                tx_timestamp TEXT,
                status TEXT DEFAULT 'ACTIVE'
            )
        """)

        # missed_scams table (CHANGE 3)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS missed_scams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_id TEXT,
                risk_score INTEGER,
                triggered_rules TEXT,
                analyst_notes TEXT,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Schema migrations for missed_scams (handle older table versions)
        existing_cols = set()
        async with db.execute("PRAGMA table_info(missed_scams)") as cursor:
            rows = await cursor.fetchall()
            for row in rows:
                existing_cols.add(row[1])
        
        if "analyst_notes" not in existing_cols:
            await db.execute('ALTER TABLE missed_scams ADD COLUMN analyst_notes TEXT')
        if "recorded_at" not in existing_cols:
            await db.execute('ALTER TABLE missed_scams ADD COLUMN recorded_at TIMESTAMP')
        
        await db.commit()

    
    # Initialize and load stats (Fix 5)
    from db.stats import init_stats_db, load_stats
    await init_stats_db()
    await load_stats()

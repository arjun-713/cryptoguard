import aiosqlite
import json
from datetime import datetime, timezone
from config import settings

DB_PATH = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")

async def init_db():
    """Create the suspicious_addresses table if it doesn't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
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
        await db.commit()

async def record_suspicious_address(address: str, score: int, rules: list[str]):
    """Upsert a suspicious address record."""
    now = datetime.now(timezone.utc).isoformat()
    rules_json = json.dumps(rules)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO suspicious_addresses (address, first_seen, last_seen, times_flagged, highest_score, triggered_rules, notes)
            VALUES (?, ?, ?, 1, ?, ?, ?)
            ON CONFLICT(address) DO UPDATE SET
                last_seen = excluded.last_seen,
                times_flagged = times_flagged + 1,
                highest_score = MAX(highest_score, excluded.highest_score),
                triggered_rules = excluded.triggered_rules
        """, (address.lower(), now, now, score, rules_json, ""))
        await db.commit()

async def is_known_suspicious(address: str) -> bool:
    """Returns True if address exists in table with times_flagged >= 2."""
    if not address:
        return False
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT times_flagged FROM suspicious_addresses WHERE address = ?", 
            (address.lower(),)
        ) as cursor:
            row = await cursor.fetchone()
            if row and row[0] >= 2:
                return True
    return False

async def get_suspicious_addresses() -> list:
    """Returns all suspicious addresses ordered by times_flagged desc."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM suspicious_addresses ORDER BY times_flagged DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

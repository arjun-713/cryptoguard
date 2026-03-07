import aiosqlite
from config import settings

DB_PATH = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")

# In-memory session counters
_stats = {
    "total_scored": 0,
    "auto_held": 0,
    "auto_monitored": 0,
    "manual_releases": 0,
    "confirmed_scams": 0
}

async def init_stats_db():
    """Create stats table if it doesn't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS system_stats (
                key TEXT PRIMARY KEY,
                value INTEGER DEFAULT 0
            )
        """)
        # Initialize keys if missing
        for key in _stats.keys():
            await db.execute("INSERT OR IGNORE INTO system_stats (key, value) VALUES (?, 0)", (key,))
        await db.commit()

async def load_stats():
    """Load stats from DB into memory on startup."""
    global _stats
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM system_stats") as cursor:
                rows = await cursor.fetchall()
                for row in rows:
                    if row["key"] in _stats:
                        _stats[row["key"]] = row["value"]
        print(f"📊 Stats loaded: {_stats}")
    except Exception as e:
        print(f"⚠️ Failed to load stats: {e}")

async def increment_stat(key: str, delta: int = 1):
    """Increment a stat in memory and persistence."""
    global _stats
    if key in _stats:
        _stats[key] += delta
        try:
            async with aiosqlite.connect(DB_PATH) as db:
                await db.execute("UPDATE system_stats SET value = value + ? WHERE key = ?", (delta, key))
                await db.commit()
        except Exception as e:
            print(f"⚠️ Failed to update stat {key}: {e}")

def get_current_stats():
    """Return all counters and calculated rates."""
    total_held = _stats["auto_held"] or 1 # Avoid div by zero
    
    return {
        **_stats,
        "false_positive_rate": round(_stats["manual_releases"] / total_held, 4),
        "precision": round(_stats["confirmed_scams"] / total_held, 4)
    }

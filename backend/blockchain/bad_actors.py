"""
CryptoGuard — Known Bad Actor Wallet Addresses

These addresses are flagged as high-risk based on OFAC sanctions lists,
known mixer pools, rug pull deployers, and peel chain participants.
"""

# Tornado Cash contracts (OFAC-sanctioned)
TORNADO_CASH_POOL = "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3"
TORNADO_CASH_ROUTER = "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf"

# Known bad actor addresses
BAD_ACTORS: set[str] = {
    TORNADO_CASH_POOL,
    TORNADO_CASH_ROUTER,
    "0xab12cd34ef56ab12cd34ef56ab12cd34ef56ab12",  # Peel Chain Wallet 1
    "0xbc23de45fa67bc23de45fa67bc23de45fa67bc23",  # Peel Chain Wallet 2
    "0xcd34ef56ab78cd34ef56ab78cd34ef56ab78cd34",  # High Velocity Spammer
    "0xde45fa67bc89de45fa67bc89de45fa67bc89de45",  # New Wallet Large Tx
    "0xef56ab78cd90ef56ab78cd90ef56ab78cd90ef56",  # Rug Pull Deployer
}

# Label lookup for display / explanation
BAD_ACTOR_LABELS: dict[str, str] = {
    TORNADO_CASH_POOL: "Tornado Cash Pool",
    TORNADO_CASH_ROUTER: "Tornado Cash Router",
    "0xab12cd34ef56ab12cd34ef56ab12cd34ef56ab12": "Peel Chain Wallet 1",
    "0xbc23de45fa67bc23de45fa67bc23de45fa67bc23": "Peel Chain Wallet 2",
    "0xcd34ef56ab78cd34ef56ab78cd34ef56ab78cd34": "High Velocity Spammer",
    "0xde45fa67bc89de45fa67bc89de45fa67bc89de45": "New Wallet Large Tx",
    "0xef56ab78cd90ef56ab78cd90ef56ab78cd90ef56": "Rug Pull Deployer",
}


def is_bad_actor(address: str) -> bool:
    """Check if a wallet address is on the known bad actors list."""
    return address.lower() in {addr.lower() for addr in BAD_ACTORS}


def get_bad_actor_label(address: str) -> str | None:
    """Return the label for a bad actor address, or None if not found."""
    for addr, label in BAD_ACTOR_LABELS.items():
        if addr.lower() == address.lower():
            return label
    return None

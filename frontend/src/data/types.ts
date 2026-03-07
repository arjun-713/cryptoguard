export interface Wallet {
    address: string;
    label: string;
    risk: number;
    flags?: string[];
}

export interface Transaction {
    id: string;
    hash: string;
    from: string;
    to: string;
    eth_value: number;
    gas_price_gwei: number;
    nonce: number;
    scenario: string;
    risk_score: number;
    risk_tier: 'low' | 'medium' | 'critical';
    triggered_rules: string[];
    hop_chain?: string[];
    timestamp_offset_seconds: number;
    ai_explanation: string | null;
    receivedAt?: number;
    status?: 'scoring' | 'scored' | 'error';
    action?: string;
}

export interface CaseLogEntry {
    tx_id: string;
    action: 'hold' | 'monitor' | 'escalate';
    analyst_notes: string;
    actioned_at: string;
    actioned_by: string;
}

export type RiskTier = 'low' | 'medium' | 'critical';
export type ActionType = 'hold' | 'monitor' | 'escalate';

export function getRiskTier(score: number): RiskTier {
    if (score < 40) return 'low';
    if (score < 70) return 'medium';
    return 'critical';
}

export function getRiskColor(tier: RiskTier): string {
    switch (tier) {
        case 'low': return '#00ff88';
        case 'medium': return '#ffaa00';
        case 'critical': return '#ff3366';
    }
}

export function getRiskDimBg(tier: RiskTier): string {
    switch (tier) {
        case 'low': return '#0a2e1a';
        case 'medium': return '#3d2e00';
        case 'critical': return '#3d0019';
    }
}

export function getRiskLabel(tier: RiskTier): string {
    switch (tier) {
        case 'low': return 'PASS';
        case 'medium': return 'FLAG';
        case 'critical': return 'HOLD';
    }
}

export function truncateAddress(addr: string): string {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatEth(value: number): string {
    return `${value.toFixed(value < 1 ? 4 : 2)} ETH`;
}

export function timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}

export function formatRuleName(rule: string): string {
    return rule
        .split('_')
        .map(w => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
}

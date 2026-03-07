import type { Transaction } from './types';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite handles JSON imports natively
import simulationRaw from './simulation-data.json';

const data = simulationRaw as {
    wallets: {
        clean: { address: string; label: string; risk: number }[];
        suspicious: { address: string; label: string; risk: number; flags: string[] }[];
    };
    transactions: {
        id: string;
        hash: string;
        from: string;
        to: string;
        eth_value: number;
        gas_price_gwei: number;
        nonce: number;
        scenario: string;
        risk_score: number;
        risk_tier: string;
        triggered_rules: string[];
        hop_chain?: string[];
        timestamp_offset_seconds: number;
        ai_explanation: string | null;
    }[];
    playback_config: {
        mode: string;
        loop: boolean;
        loop_delay_seconds: number;
        highlight_critical_ids: string[];
    };
};

export const walletLabels: Record<string, string> = {};
[...data.wallets.clean, ...data.wallets.suspicious].forEach(w => {
    walletLabels[w.address] = w.label;
});

export const mockTransactions: Transaction[] = data.transactions.map(tx => ({
    id: tx.id,
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    eth_value: tx.eth_value,
    gas_price_gwei: tx.gas_price_gwei,
    nonce: tx.nonce,
    scenario: tx.scenario,
    risk_score: tx.risk_score,
    risk_tier: tx.risk_tier as 'low' | 'medium' | 'critical',
    triggered_rules: tx.triggered_rules,
    hop_chain: tx.hop_chain,
    timestamp_offset_seconds: tx.timestamp_offset_seconds,
    ai_explanation: tx.ai_explanation,
}));

export const playbackConfig = data.playback_config;

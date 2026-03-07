import type { Transaction } from '@/data/types';
import { getRiskTier, getRiskColor, getRiskLabel, formatRuleName } from '@/data/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldAlert, ShieldCheck, Eye, AlertTriangle, Copy } from 'lucide-react';
import HashLink from '@/components/HashLink';

interface RiskCardProps {
    transaction: Transaction | null;
}

const ruleIcons: Record<string, string> = {
    BLACKLIST_HIT: '🚫',
    TORNADO_PROXIMITY: '🌀',
    PEEL_CHAIN: '🔗',
    HIGH_VELOCITY: '⚡',
    LARGE_VALUE: '💎',
    NEW_WALLET: '🆕',
    RUG_PULL_PATTERN: '🎭',
};

export default function RiskCard({ transaction }: RiskCardProps) {
    if (!transaction) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-8 px-6">
                <ShieldCheck className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                    Select a transaction to view risk analysis
                </p>
            </div>
        );
    }

    const tier = getRiskTier(transaction.risk_score);
    const color = getRiskColor(tier);
    const label = getRiskLabel(tier);
    const TierIcon = tier === 'critical' ? ShieldAlert : tier === 'medium' ? Eye : ShieldCheck;

    return (
        <div className="flex flex-col h-full animate-fade-in">
            {/* Header row: title + score inline */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b">
                <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Risk Assessment
                </h2>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] gap-1.5 hover:bg-cyan-500/10 hover:text-cyan-500 transition-all border border-transparent hover:border-cyan-500/30"
                        onClick={() => {
                            navigator.clipboard.writeText(transaction.hash);
                            // We could add a local toast here too, but App level might be better
                        }}
                    >
                        <Copy className="w-3 h-3" /> COPY HASH
                    </Button>
                    <HashLink hash={transaction.hash} />
                </div>
            </div>

            {/* Score + tier — compact horizontal row */}
            <div className="shrink-0 flex items-center gap-4 px-5 py-3 border-b bg-muted/20">
                <div
                    className="w-14 h-14 rounded-lg flex items-center justify-center border shrink-0"
                    style={{ borderColor: `${color}30`, background: `${color}08` }}
                >
                    <span className="text-2xl font-bold font-mono" style={{ color }}>
                        {transaction.risk_score}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <TierIcon className="w-4 h-4" style={{ color }} />
                        <Badge
                            variant={tier === 'critical' ? 'destructive' : tier === 'medium' ? 'secondary' : 'outline'}
                            className="text-[11px] tracking-wider"
                        >
                            {label}
                        </Badge>
                        {transaction.auto_held && (
                            <Badge variant="destructive" className="text-[10px] h-5 px-2 uppercase font-bold animate-pulse">
                                AUTO-HELD BY ENGINE
                            </Badge>
                        )}
                        {transaction.auto_monitored && (
                            <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] h-5 px-2 uppercase font-bold">
                                AUTO-MONITORED BY ENGINE
                            </Badge>
                        )}
                    </div>
                    <span className="text-xs text-muted-foreground">{tier.toUpperCase()} RISK</span>
                </div>
            </div>

            {/* Scrollable content: rules + hop chain */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="px-5 py-3 space-y-3">
                    {/* Triggered Rules */}
                    {transaction.triggered_rules.length > 0 && (
                        <div>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
                                Triggered Rules ({transaction.triggered_rules.length})
                            </p>
                            <div className="space-y-1">
                                {transaction.triggered_rules.map(rule => (
                                    <div
                                        key={rule}
                                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md bg-muted/50 text-sm"
                                    >
                                        <span>{ruleIcons[rule] || '⚠'}</span>
                                        <span className="text-foreground flex-1 text-[13px]">{formatRuleName(rule)}</span>
                                        <AlertTriangle className="w-3 h-3 text-muted-foreground shrink-0" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hop chain */}
                    {transaction.hop_chain && transaction.hop_chain.length > 1 && (
                        <div>
                            <Separator className="mb-3" />
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
                                Fund Flow · {transaction.hop_chain.length} hops
                            </p>
                            <div className="flex items-center gap-1 flex-wrap">
                                {transaction.hop_chain.map((addr, i) => (
                                    <div key={`${addr}-${i}`} className="flex items-center gap-1">
                                        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                                            {addr.slice(0, 6)}
                                        </span>
                                        {i < transaction.hop_chain!.length - 1 && (
                                            <span className="text-muted-foreground text-[10px]">→</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {transaction.triggered_rules.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">
                            No rules triggered — transaction appears normal.
                        </p>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

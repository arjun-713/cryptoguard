import type { Transaction } from '@/data/types';
import { truncateAddress, formatEth, timeAgo, getRiskTier, getRiskColor } from '@/data/types';
import { walletLabels } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TransactionFeedProps {
    transactions: Transaction[];
    selectedTxId: string | null;
    onSelect: (tx: Transaction) => void;
}

export default function TransactionFeed({ transactions, selectedTxId, onSelect }: TransactionFeedProps) {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b">
                <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Live Transaction Feed
                </h2>
                <span className="text-xs font-mono text-muted-foreground">
                    {transactions.length} txns
                </span>
            </div>

            <ScrollArea className="flex-1 overflow-hidden">
                {transactions.length === 0 ? (
                    <div className="flex items-center justify-center h-40">
                        <p className="text-sm text-muted-foreground">Waiting for transactions…</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {transactions.map((tx, i) => {
                            const tier = getRiskTier(tx.risk_score);
                            const color = getRiskColor(tier);
                            const isSelected = tx.id === selectedTxId;
                            const fromLabel = walletLabels[tx.from];

                            return (
                                <button
                                    key={`${tx.id}-${i}`}
                                    onClick={() => onSelect(tx)}
                                    className={`w-full text-left px-5 py-3.5 transition-colors duration-150 ${isSelected
                                        ? 'bg-accent/60 border-l-2'
                                        : 'border-l-2 border-transparent hover:bg-accent/30'
                                        } ${i === 0 ? 'animate-slide-in' : ''}`}
                                    style={{ borderLeftColor: isSelected ? color : 'transparent' }}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-mono text-sm text-foreground">
                                                    {truncateAddress(tx.from)}
                                                </span>
                                                {fromLabel && (
                                                    <span className="text-xs text-muted-foreground truncate">
                                                        {fromLabel}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                → {truncateAddress(tx.to)}
                                            </span>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-mono font-medium text-foreground">
                                                {formatEth(tx.eth_value)}
                                            </span>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {tx.gas_price_gwei.toFixed(1)} Gwei
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-1">
                                            <div className="flex items-center gap-1.5">
                                                {tx.auto_held && (
                                                    <Badge variant="destructive" className="text-[9px] h-4 px-1 px-1.5 uppercase font-bold animate-pulse">
                                                        AUTO-HELD
                                                    </Badge>
                                                )}
                                                {tx.auto_monitored && (
                                                    <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[9px] h-4 px-1.5 uppercase font-bold">
                                                        AUTO-MONITORED
                                                    </Badge>
                                                )}
                                                <Badge
                                                    variant={tier === 'critical' ? 'destructive' : tier === 'medium' ? 'secondary' : 'outline'}
                                                    className="font-mono text-[11px] px-2 h-5"
                                                    style={tier === 'low' ? { color, borderColor: `${color}40` } : undefined}
                                                >
                                                    {tx.risk_score}
                                                </Badge>
                                            </div>
                                            <span className="text-[11px] text-muted-foreground">
                                                {tx.receivedAt ? timeAgo(tx.receivedAt) : `+${tx.timestamp_offset_seconds}s`}
                                            </span>
                                        </div>
                                    </div>

                                    {tx.triggered_rules.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {tx.triggered_rules.map(rule => (
                                                <span
                                                    key={rule}
                                                    className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm"
                                                >
                                                    {rule}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}

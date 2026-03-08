import { memo } from 'react';
import type { Transaction } from '@/data/types';
import { truncateAddress, timeAgo, getRiskTier, getRiskColor, getRiskLabel } from '@/data/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell } from 'lucide-react';

interface AlertSidebarProps {
    transactions: Transaction[];
    selectedTxId: string | null;
    onSelect: (tx: Transaction) => void;
}

export default memo(function AlertSidebar({ transactions, selectedTxId, onSelect }: AlertSidebarProps) {
    const flaggedTxs = transactions
        .filter(tx => tx.risk_score >= 40)
        .slice(0, 8);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="shrink-0 px-4 py-3.5 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            Active Alerts
                        </h2>
                    </div>
                    {flaggedTxs.length > 0 && (
                        <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                            {flaggedTxs.length}
                        </Badge>
                    )}
                </div>
            </div>

            <ScrollArea className="flex-1 overflow-hidden">
                {flaggedTxs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 py-8 px-4">
                        <Bell className="w-6 h-6 text-muted-foreground/40 mb-2" />
                        <p className="text-xs text-muted-foreground text-center">No active alerts</p>
                    </div>
                ) : (
                    <div className="space-y-0.5 p-2">
                        {flaggedTxs.map((tx, i) => {
                            const tier = getRiskTier(tx.risk_score);
                            const color = getRiskColor(tier);
                            const label = getRiskLabel(tier);
                            const isSelected = tx.id === selectedTxId;

                            return (
                                <button
                                    key={`alert-${tx.id}-${i}`}
                                    onClick={() => onSelect(tx)}
                                    className={`w-full text-left rounded-md px-3 py-2.5 transition-colors duration-150 ${i === 0 ? 'animate-slide-in' : ''
                                        } ${isSelected ? 'bg-accent/60' : 'hover:bg-accent/30'}`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div
                                            className="flex items-center justify-center w-9 h-9 rounded-md font-mono text-xs font-semibold shrink-0"
                                            style={{ color, background: `${color}10`, border: `1px solid ${color}20` }}
                                        >
                                            {tx.risk_score}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-xs text-foreground truncate">
                                                    {truncateAddress(tx.from)}
                                                </span>
                                                <Badge
                                                    variant={tier === 'critical' ? 'destructive' : 'secondary'}
                                                    className="text-[9px] h-4 px-1"
                                                >
                                                    {label}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-muted-foreground">{tx.eth_value} ETH</span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {tx.receivedAt ? timeAgo(tx.receivedAt) : `+${tx.timestamp_offset_seconds}s`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>

            <div className="px-4 py-2 border-t">
                <p className="text-[10px] text-muted-foreground text-center uppercase tracking-wider">
                    Auto-flagged · Score ≥ 40
                </p>
            </div>
        </div>
    );
});

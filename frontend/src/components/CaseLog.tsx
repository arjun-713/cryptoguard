import { useState, useEffect } from 'react';
import type { CaseLogEntry } from '@/data/types';
import { truncateAddress, timeAgo } from '@/data/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Bot, User, Clock, CheckCircle2 } from 'lucide-react';

export default function CaseLog() {
    const [actions, setActions] = useState<CaseLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchActions = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/actions');
            const data = await res.json();
            setActions(data);
        } catch (err) {
            console.error('Failed to fetch action log:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActions();
        const interval = setInterval(fetchActions, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col h-full bg-background p-4 gap-4 animate-fade-in">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <ClipboardList className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Case Audit Log</h1>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                            {actions.length} Interception Events Logged
                        </p>
                    </div>
                </div>
            </div>

            <Card className="flex-1 min-h-0 flex flex-col border-primary/10 bg-card/50 overflow-hidden">
                <div className="grid grid-cols-12 px-6 py-3 bg-muted/30 border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <div className="col-span-1">ID</div>
                    <div className="col-span-2">Source</div>
                    <div className="col-span-2">Transaction ID</div>
                    <div className="col-span-2 text-center">Action</div>
                    <div className="col-span-3">Analyst Notes / System Reason</div>
                    <div className="col-span-2 text-right">Timestamp</div>
                </div>

                <ScrollArea className="flex-1">
                    {loading && actions.length === 0 ? (
                        <div className="flex items-center justify-center p-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : actions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                            <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                            <p>No actions taken yet. All quiet on the front.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {actions.map((act) => {
                                const isAuto = act.action.startsWith('AUTO_');
                                const displayAction = act.action.replace('AUTO_', '');

                                return (
                                    <div
                                        key={`${act.id}-${act.tx_id}`}
                                        className="grid grid-cols-12 px-6 py-4 items-center gap-2 hover:bg-accent/10 transition-colors"
                                    >
                                        <div className="col-span-1 font-mono text-[10px] text-muted-foreground">
                                            #{act.id}
                                        </div>
                                        <div className="col-span-2 flex items-center gap-2">
                                            {isAuto ? (
                                                <Badge variant="outline" className="text-primary border-primary/30 gap-1.5 h-6">
                                                    <Bot className="w-3 h-3" /> Automatic
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground gap-1.5 h-6">
                                                    <User className="w-3 h-3" /> Manual
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="col-span-2 font-mono text-xs text-foreground truncate">
                                            {act.tx_id}
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <Badge
                                                variant={displayAction === 'hold' || displayAction === 'HOLD' ? "destructive" : "secondary"}
                                                className="uppercase tracking-widest text-[10px] h-6 px-3"
                                            >
                                                {displayAction}
                                            </Badge>
                                        </div>
                                        <div className="col-span-3 text-xs italic text-muted-foreground line-clamp-2">
                                            "{act.analyst_notes || 'No notes provided.'}"
                                        </div>
                                        <div className="col-span-2 text-right text-[11px] text-muted-foreground font-mono flex items-center justify-end gap-2">
                                            <Clock className="w-3 h-3" />
                                            {timeAgo(new Date(act.actioned_at).getTime())}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                <div className="shrink-0 p-4 bg-muted/10 border-t">
                    <p className="text-[10px] text-muted-foreground text-center uppercase tracking-[0.2em]">
                        Immutable Audit Trail · Compliant with Financial Integrity Standards
                    </p>
                </div>
            </Card>
        </div>
    );
}

import { useState, useEffect } from 'react';
import type { CaseLogEntry } from '@/data/types';
import { truncateAddress, timeAgo } from '@/data/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ClipboardList, Bot, User, Clock, CheckCircle2, Search, Copy, ShieldAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CaseLogProps {
    onViewCase: (c: CaseLogEntry, list: CaseLogEntry[]) => void;
}

export default function CaseLog({ onViewCase }: CaseLogProps) {
    const [actions, setActions] = useState<CaseLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'HOLD' | 'MONITOR' | 'AUTHORIZE'>('ALL');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [missedScams, setMissedScams] = useState<any[]>([]);

    const fetchActions = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/actions');
            const data = await res.json();
            setActions(data);

            const missedRes = await fetch('http://localhost:8000/api/missed_scams');
            if (missedRes.ok) setMissedScams(await missedRes.json());
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

    const handleCopy = (e: React.MouseEvent, text: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const getScoreColor = (score: number) => {
        if (score < 40) return 'bg-emerald-500';
        if (score < 70) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    const sortedActions = [...actions].sort((a, b) =>
        new Date(b.actioned_at).getTime() - new Date(a.actioned_at).getTime()
    );

    const filteredActions = sortedActions.filter(act => {
        if (filter === 'ALL') return true;
        const displayAction = act.action.replace('AUTO_', '').toUpperCase();
        return displayAction === filter;
    });

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
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                        <div className="flex bg-muted/50 rounded-md p-1 pl-8 items-center gap-1">
                            {['ALL', 'HOLD', 'MONITOR', 'AUTHORIZE'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f as any)}
                                    className={`px-3 py-1 rounded text-xs font-bold tracking-wider transition-colors ${filter === f
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Card className="flex-1 min-h-0 flex flex-col border-primary/10 bg-card/50 overflow-hidden">
                <div className="grid grid-cols-12 px-6 py-3 bg-muted/30 border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <div className="col-span-1">ID</div>
                    <div className="col-span-2">Source</div>
                    <div className="col-span-2">Transaction ID</div>
                    <div className="col-span-2 text-center">Action</div>
                    <div className="col-span-1 text-center">Risk</div>
                    <div className="col-span-2">Analyst Notes</div>
                    <div className="col-span-2 text-right">Timestamp</div>
                </div>

                <ScrollArea className="flex-1">
                    {loading && actions.length === 0 ? (
                        <div className="flex items-center justify-center p-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : filteredActions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                            <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                            <p>No actions match this filter.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {filteredActions.map((act) => {
                                const isAuto = act.action.startsWith('AUTO_');
                                const displayAction = act.action.replace('AUTO_', '').toUpperCase();
                                const score = act.tx_details?.risk_score ?? 0;

                                return (
                                    <div
                                        key={`${act.id}-${act.tx_id}`}
                                        onClick={() => onViewCase(act, filteredActions)}
                                        className="grid grid-cols-12 px-6 py-4 items-center gap-2 hover:bg-accent/20 cursor-pointer transition-colors"
                                    >
                                        <div className="col-span-1 font-mono text-[10px] text-muted-foreground">
                                            #{act.id}
                                        </div>
                                        <div className="col-span-2 flex items-center gap-2">
                                            {isAuto ? (
                                                <Badge variant="outline" className="text-rose-400 border-rose-400/30 gap-1.5 h-6">
                                                    <Bot className="w-3 h-3" /> Automatic
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 gap-1.5 h-6">
                                                    <User className="w-3 h-3" /> Manual
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="col-span-2 flex items-center gap-1 group">
                                            <span className="font-mono text-xs text-foreground shrink-0 cursor-copy hover:text-cyan-400 transition-colors"
                                                onClick={(e) => handleCopy(e, act.tx_id)}>
                                                {truncateAddress(act.tx_id)}
                                            </span>
                                            {copiedId === act.tx_id && <span className="text-[10px] text-cyan-400">Copied!</span>}
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <Badge
                                                variant="outline"
                                                className={`uppercase tracking-widest text-[10px] h-6 px-3 border-transparent ${displayAction === 'HOLD' ? 'bg-red-500/20 text-red-400' :
                                                    displayAction === 'MONITOR' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        (displayAction === 'ESCALATE' || displayAction === 'AUTHORIZE') ? 'bg-orange-500/20 text-orange-400' :
                                                            'bg-secondary text-secondary-foreground'
                                                    }`}
                                            >
                                                {displayAction}
                                            </Badge>
                                        </div>
                                        <div className="col-span-1 flex items-center justify-center gap-2">
                                            <span className="font-bold text-[10px] w-5 text-right font-mono">{score}</span>
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div className={`h-full ${getScoreColor(score)}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Score: {score}/100</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <div className="col-span-2 text-xs text-muted-foreground truncate pr-2">
                                            {act.analyst_notes ? `"${act.analyst_notes.length > 40 ? act.analyst_notes.substring(0, 40) + '...' : act.analyst_notes}"` : <span className="italic opacity-50">No notes</span>}
                                        </div>
                                        <div className="col-span-2 text-right flex items-center justify-end">
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2 cursor-help">
                                                            <Clock className="w-3 h-3" />
                                                            {timeAgo(new Date(act.actioned_at).getTime())}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left">
                                                        {new Date(act.actioned_at).toLocaleString()}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
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

            {/* CHANGE 3: Reviewed but Missed Section */}
            {missedScams.length > 0 && (
                <div className="mt-6 space-y-3 pb-8">
                    <div className="flex items-center gap-2 text-orange-500">
                        <ShieldAlert className="w-5 h-5" />
                        <h2 className="text-sm font-black uppercase tracking-widest">⚠ REVIEWED BUT MISSED (HIGH RISK OVERRIDES)</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {missedScams.map(scam => (
                            <Card key={scam.id} className="p-4 bg-orange-500/5 border-orange-500/30 flex flex-col gap-2 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                                <div className="flex justify-between items-start">
                                    <Badge className="bg-orange-500 text-white font-mono text-[10px]">SCAM OVERRIDE</Badge>
                                    <span className="font-mono text-[10px] text-orange-500/60">{new Date(scam.recorded_at).toLocaleTimeString()}</span>
                                </div>
                                <div className="font-mono text-[10px] font-bold text-foreground truncate">
                                    {scam.tx_id}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold">Risk Score</span>
                                    <span className="text-sm font-black text-orange-500 font-mono">{scam.risk_score}</span>
                                </div>
                                <p className="text-[10px] leading-tight italic text-orange-200/70 border-l border-orange-500/30 pl-2">
                                    "{scam.analyst_notes}"
                                </p>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

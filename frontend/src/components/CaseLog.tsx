import { useState, useEffect } from 'react';
import type { CaseLogEntry } from '@/data/types';
import { truncateAddress, timeAgo } from '@/data/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Bot, User, Clock, CheckCircle2, Search, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getStoredActions, onSessionUpdate } from '@/lib/sessionStore';

interface CaseLogProps {
    onViewCase: (c: CaseLogEntry, list: CaseLogEntry[]) => void;
}

export default function CaseLog({ onViewCase }: CaseLogProps) {
    const [actions, setActions] = useState<CaseLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'HOLD' | 'MONITOR' | 'AUTHORIZE'>('ALL');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchActions = () => {
        setActions(getStoredActions());
        setLoading(false);
    };

    useEffect(() => {
        fetchActions();
        return onSessionUpdate(fetchActions);
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
        <div className="flex h-full flex-col gap-3 animate-fade-in">
            <div className="flex shrink-0 flex-col gap-3 rounded-md border bg-card/70 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-background">
                        <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">Case Audit Log</h1>
                        <p className="text-xs text-muted-foreground font-mono">
                            {actions.length} interception events logged
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 rounded-md border bg-background p-1">
                    <Search className="ml-2 h-4 w-4 text-muted-foreground" />
                    {['ALL', 'HOLD', 'MONITOR', 'AUTHORIZE'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${filter === f
                                ? 'bg-secondary text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <Card className="flex min-h-0 flex-1 py-0">
                <CardHeader className="border-b py-4">
                    <CardTitle className="text-sm">Intervention Ledger</CardTitle>
                    <CardDescription>Manual and automatic decisions from this browser session.</CardDescription>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 p-0">
                    <ScrollArea className="h-full">
                        {loading && actions.length === 0 ? (
                            <div className="flex items-center justify-center p-20">
                                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
                            </div>
                        ) : filteredActions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                                <CheckCircle2 className="mb-4 h-12 w-12 opacity-20" />
                                <p>No actions match this filter.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {filteredActions.map((act) => {
                                    const isAuto = act.action.startsWith('AUTO_');
                                    const displayAction = act.action.replace('AUTO_', '').toUpperCase();
                                    const score = act.tx_details?.risk_score ?? 0;

                                    return (
                                        <button
                                            key={`${act.id}-${act.tx_id}`}
                                            onClick={() => onViewCase(act, filteredActions)}
                                            className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/15 lg:grid-cols-12 lg:items-center"
                                        >
                                            <div className="font-mono text-[10px] text-muted-foreground lg:col-span-1">
                                                #{act.id}
                                            </div>
                                            <div className="flex items-center gap-2 lg:col-span-2">
                                                {isAuto ? (
                                                    <Badge variant="outline" className="h-6 gap-1.5 rounded-sm border-rose-400/30 text-rose-300">
                                                        <Bot className="h-3 w-3" /> Automatic
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="h-6 gap-1.5 rounded-sm border-primary/30 text-primary">
                                                        <User className="h-3 w-3" /> Manual
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 lg:col-span-2">
                                                <span
                                                    className="font-mono text-xs text-foreground transition-colors hover:text-primary"
                                                    onClick={(e) => handleCopy(e, act.tx_id)}
                                                >
                                                    {truncateAddress(act.tx_id)}
                                                </span>
                                                <Copy className="h-3 w-3 text-muted-foreground" />
                                                {copiedId === act.tx_id && <span className="text-[10px] text-primary">Copied</span>}
                                            </div>
                                            <div className="lg:col-span-2 lg:text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={`h-6 rounded-sm border-transparent px-3 text-[10px] uppercase ${displayAction === 'HOLD' ? 'bg-red-500/20 text-red-300' :
                                                        displayAction === 'MONITOR' ? 'bg-yellow-500/20 text-yellow-300' :
                                                            (displayAction === 'ESCALATE' || displayAction === 'AUTHORIZE') ? 'bg-orange-500/20 text-orange-300' :
                                                                'bg-secondary text-secondary-foreground'
                                                        }`}
                                                >
                                                    {displayAction}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 lg:col-span-1 lg:justify-center">
                                                <span className="w-6 text-right font-mono text-[10px] font-bold">{score}</span>
                                                <TooltipProvider delayDuration={100}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                                                                <div className={`h-full ${getScoreColor(score)}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Score: {score}/100</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <div className="truncate text-xs text-muted-foreground lg:col-span-2">
                                                {act.analyst_notes ? `"${act.analyst_notes.length > 44 ? act.analyst_notes.substring(0, 44) + '...' : act.analyst_notes}"` : <span className="italic opacity-50">No notes</span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground lg:col-span-2 lg:justify-end">
                                                <Clock className="h-3 w-3" />
                                                {timeAgo(new Date(act.actioned_at).getTime())}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}

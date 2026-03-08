import { useState } from 'react';
import type { CaseLogEntry } from '@/data/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Printer, ExternalLink, Bot, User, CheckCircle2, ChevronRight, ChevronLeft, Copy, ShieldAlert, Sparkles } from 'lucide-react';
import { formatEth } from '@/data/types';

interface CaseReportProps {
    caseData: CaseLogEntry;
    caseList?: CaseLogEntry[];
    onNavigate?: (c: CaseLogEntry) => void;
    onBack: () => void;
}

const RULE_WEIGHTS: Record<string, { weight: number, color: string }> = {
    "BLACKLIST_HIT": { weight: 40, color: "bg-red-500/20 text-red-500 border-red-500/50" },
    "TORNADO_PROXIMITY": { weight: 35, color: "bg-purple-500/20 text-purple-500 border-purple-500/50" },
    "PEEL_CHAIN": { weight: 30, color: "bg-orange-500/20 text-orange-500 border-orange-500/50" },
    "HIGH_VELOCITY": { weight: 25, color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" },
    "LARGE_VALUE": { weight: 20, color: "bg-blue-500/20 text-blue-500 border-blue-500/50" },
    "NEW_WALLET": { weight: 10, color: "bg-gray-500/20 text-gray-400 border-gray-500/50" },
    "REPEAT_OFFENDER": { weight: 10, color: "bg-red-950/40 text-red-600 border-red-900/50" },
};

export default function CaseReport({ caseData, caseList = [], onNavigate, onBack }: CaseReportProps) {
    const [copiedContent, setCopiedContent] = useState<string | null>(null);

    const isAuto = caseData.action.startsWith('AUTO_');
    const displayAction = caseData.action.replace('AUTO_', '').toUpperCase();
    const actionDate = new Date(caseData.actioned_at);

    // Tx info
    const tx = caseData.tx_details;
    const score = tx?.risk_score ?? 0;
    const rules = tx?.triggered_rules || [];
    const txDate = (tx as any)?.timestamp ? new Date((tx as any).timestamp) : actionDate;

    // Formatting helpers
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedContent(text);
        setTimeout(() => setCopiedContent(null), 2000);
    };

    const getScoreGaugeColor = () => {
        if (score < 40) return 'text-emerald-500';
        if (score < 70) return 'text-amber-500';
        return 'text-rose-500';
    };

    // Calculate sum string 
    const sumString = rules.map(r => RULE_WEIGHTS[r]?.weight || 0).join(' + ');

    const currentIndex = caseList.findIndex(c => c.id === caseData.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex !== -1 && currentIndex < caseList.length - 1;

    const handlePrev = () => { if (hasPrev && onNavigate) onNavigate(caseList[currentIndex - 1]); };
    const handleNext = () => { if (hasNext && onNavigate) onNavigate(caseList[currentIndex + 1]); };

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 pb-12 animate-fade-in w-full text-foreground relative print:bg-white print:text-black print:p-0">
            {/* Top Navigation */}
            <div className="flex items-center justify-between print:hidden sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b">
                <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Log
                </Button>
                <div className="flex items-center gap-2">
                    {(caseList.length > 0 && onNavigate) && (
                        <div className="flex items-center gap-1 mr-4 border-r pr-4 border-border">
                            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={!hasPrev} className="gap-1 px-2">
                                <ChevronLeft className="w-4 h-4" /> Prev
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleNext} disabled={!hasNext} className="gap-1 px-2">
                                Next <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
                        <Printer className="w-4 h-4" /> Print Report
                    </Button>
                </div>
            </div>

            <Card className="p-8 border-primary/20 bg-card/80 shadow-xl overflow-hidden print:shadow-none print:border-none">

                {/* --- HEADER --- */}
                <div className="flex flex-col gap-8 md:flex-row justify-between items-start mb-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black tracking-tighter">CASE #{caseData.id}</h1>
                            <Badge variant="outline" className={`uppercase tracking-widest px-3 py-1 text-xs border-transparent ${displayAction === 'HOLD' ? 'bg-rose-500/20 text-rose-400' :
                                displayAction === 'MONITOR' ? 'bg-amber-500/20 text-amber-400' :
                                    (displayAction === 'ESCALATE' || displayAction === 'AUTHORIZE') ? 'bg-orange-500/20 text-orange-400' :
                                        'bg-secondary text-secondary-foreground'
                                }`}>
                                {displayAction}
                            </Badge>
                            {isAuto ? (
                                <Badge variant="outline" className="text-rose-400 border-rose-400/30 gap-1 px-3 py-1">
                                    <Bot className="w-3.5 h-3.5" /> AUTO
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 gap-1 px-3 py-1">
                                    <User className="w-3.5 h-3.5" /> MANUAL
                                </Badge>
                            )}
                        </div>
                        <div className="text-muted-foreground font-mono text-sm">
                            {actionDate.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })}
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-6 bg-background rounded-full aspect-square w-32 shrink-0 border border-primary/20 shadow-inner">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">RISK</span>
                        <span className={`text-4xl font-black font-mono ${getScoreGaugeColor()}`}>
                            {score}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-1">/ 100</span>
                    </div>
                </div>

                {/* --- WARNING BANNER (CHANGE 3) --- */}
                {displayAction === 'AUTHORIZE' && score >= 70 && (
                    <div className="mb-8 p-4 bg-orange-500/10 border-2 border-orange-500 rounded-lg flex items-center gap-4 animate-pulse">
                        <ShieldAlert className="w-8 h-8 text-orange-500 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-orange-500 font-black text-lg leading-tight uppercase tracking-tighter">
                                ⚠ POTENTIAL SCAM — Unauthorized Exception
                            </p>
                            <p className="text-orange-200/80 text-sm font-medium">
                                This transaction was manually authorized despite a critical risk score of <span className="text-orange-500 font-bold">{score}/100</span>.
                                Rules triggered: <span className="font-mono text-xs italic">{rules.join(', ').replace(/_/g, ' ')}</span>
                            </p>
                        </div>
                    </div>
                )}

                <Separator className="mb-8" />

                {/* --- TRANSACTION DETAILS --- */}
                <div className="space-y-6 mb-10">
                    <h2 className="text-lg font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5" /> Transaction Fingerprint
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-lg border border-border/50 font-mono text-sm shadow-inner">
                        <div className="space-y-1 overflow-hidden">
                            <span className="text-[10px] uppercase text-muted-foreground tracking-widest font-sans font-bold">Transaction Hash</span>
                            <div className="flex items-center gap-2">
                                <span className="text-foreground font-bold truncate">{caseData.tx_id}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleCopy(caseData.tx_id)}>
                                    <Copy className="w-3.5 h-3.5" />
                                </Button>
                                <a href={`https://etherscan.io/tx/${caseData.tx_id}`} target="_blank" rel="noreferrer" className="text-cyan-500 hover:text-cyan-400 shrink-0">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-[10px] uppercase text-muted-foreground tracking-widest font-sans font-bold">Value Transferred</span>
                            <div className="text-emerald-400 font-bold text-lg">
                                {tx?.eth_value !== undefined ? formatEth(tx.eth_value) : 'UNKNOWN'}
                            </div>
                        </div>

                        <div className="space-y-1 overflow-hidden">
                            <span className="text-[10px] uppercase text-muted-foreground tracking-widest font-sans font-bold">Sender (From)</span>
                            <div className="flex items-center gap-2">
                                <span className="text-foreground truncate">{tx?.from || 'UNKNOWN'}</span>
                                {tx?.from && (
                                    <>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleCopy(tx.from)}>
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                        <a href={`https://etherscan.io/address/${tx.from}`} target="_blank" rel="noreferrer" className="text-cyan-500 hover:text-cyan-400 shrink-0">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1 overflow-hidden">
                            <span className="text-[10px] uppercase text-muted-foreground tracking-widest font-sans font-bold">Receiver (To)</span>
                            <div className="flex items-center gap-2">
                                <span className="text-foreground truncate">{tx?.to || 'UNKNOWN'}</span>
                                {tx?.to && (
                                    <>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleCopy(tx.to)}>
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                        <a href={`https://etherscan.io/address/${tx.to}`} target="_blank" rel="noreferrer" className="text-cyan-500 hover:text-cyan-400 shrink-0">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-[10px] uppercase text-muted-foreground tracking-widest font-sans font-bold">Transaction Timestamp</span>
                            <div className="text-foreground">
                                {txDate.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RISK ANALYSIS --- */}
                <div className="space-y-4 mb-10">
                    <h2 className="text-lg font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                        Risk Vector Analysis
                    </h2>

                    <div className="p-6 border rounded-lg space-y-4 bg-background/50">
                        {rules.length > 0 ? (
                            <div className="flex flex-wrap gap-3">
                                {rules.map((rule) => {
                                    const meta = RULE_WEIGHTS[rule] || { weight: 0, color: "bg-muted text-muted-foreground" };
                                    return (
                                        <Badge key={rule} variant="outline" className={`px-3 py-1.5 text-xs font-mono tracking-tight gap-2 ${meta.color}`}>
                                            {rule.replace(/_/g, ' ')}
                                            <span className="opacity-75 font-bold">+{meta.weight}</span>
                                        </Badge>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-muted-foreground italic text-sm">No specific risk rules triggered initially.</p>
                        )}

                        <div className="pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="font-mono text-xl font-bold bg-muted/50 px-4 py-2 rounded-md inline-flex items-center border">
                                {sumString ? `${sumString} = ${score}/100` : `0 = ${score}/100`}
                            </div>

                            <p className="text-sm border-l-2 pl-4 border-primary italic">
                                {score >= 70 ? "Critical risk. Automatic hold procedures recommended." :
                                    score >= 40 ? "Elevated risk. Continuous monitoring advised." :
                                        "Low risk. Routine processing."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* --- AI COMPLIANCE ANALYSIS --- */}
                {
                    tx?.ai_explanation && (
                        <div className="space-y-4 mb-10">
                            <h2 className="text-lg font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                AI Compliance Analysis
                            </h2>
                            <div className="relative p-6 bg-gradient-to-r from-transparent to-primary/5 border rounded-lg text-sm leading-relaxed italic text-muted-foreground">
                                <Sparkles className="absolute -left-2 -top-2 w-6 h-6 p-1 bg-cyan-900 text-cyan-400 rounded-md ring-2 ring-background shadow-md" />
                                "{tx.ai_explanation}"
                            </div>
                        </div>
                    )
                }

                {/* --- BROKER ACTION --- */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                        Action Audit Log
                    </h2>
                    <div className="p-6 bg-muted/40 rounded-lg border">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="p-3 bg-background rounded border mt-1 shrink-0 shadow-sm">
                                {isAuto ? <Bot className="w-5 h-5 text-rose-400" /> : <User className="w-5 h-5 text-emerald-400" />}
                            </div>
                            <div>
                                <p className="font-bold text-foreground">
                                    {isAuto ? 'System Risk Engine' : `Analyst: ${caseData.actioned_by}`}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono mt-1 2-tracking-widest uppercase">
                                    {actionDate.toUTCString()}
                                </p>
                                <div className="mt-3 text-sm border-l-2 border-primary/40 pl-3">
                                    {caseData.analyst_notes ? (
                                        <p className="italic">"{caseData.analyst_notes}"</p>
                                    ) : (
                                        <p className="text-muted-foreground italic opacity-50">No notes recorded.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Mini timeline */}
                        <div className="mt-8 pt-6 border-t font-mono text-xs flex justify-between items-center text-muted-foreground">
                            <div className="flex items-center gap-2 opacity-50">
                                <span>Detected</span>
                                <span className="bg-background px-2 py-0.5 rounded text-[10px]">{txDate.toLocaleTimeString()}</span>
                            </div>
                            <ChevronRight className="w-3 h-3 opacity-30" />
                            <div className="flex items-center gap-2 opacity-75">
                                <span>Scored [{score}]</span>
                            </div>
                            <ChevronRight className="w-3 h-3 opacity-30" />
                            <div className="flex items-center gap-2 text-foreground font-bold">
                                <span>Action: {displayAction}</span>
                                <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px]">{actionDate.toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </Card >

            {/* Print Footer */}
            < div className="hidden print:block text-center mt-8 text-[10px] text-gray-400 font-mono uppercase" >
                Generated by CryptoGuard Security Engine v1.0.1 • Authorized Financial Record
            </div >
        </div >
    );
}

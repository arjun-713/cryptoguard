import { useState, useEffect, memo } from 'react';
import type { Transaction } from '@/data/types';
import { getRiskTier, getRiskColor } from '@/data/types';
import { BrainCircuit } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExplanationPanelProps {
    transaction: Transaction | null;
}

export default memo(function ExplanationPanel({ transaction }: ExplanationPanelProps) {
    const [displayedText, setDisplayedText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        if (!transaction?.ai_explanation) {
            setDisplayedText('');
            setIsStreaming(false);
            return;
        }

        const fullText = transaction.ai_explanation;
        setDisplayedText('');
        setIsStreaming(true);

        let charIndex = 0;
        const CHARS_PER_TICK = 3;
        const interval = setInterval(() => {
            if (charIndex < fullText.length) {
                charIndex = Math.min(charIndex + CHARS_PER_TICK, fullText.length);
                setDisplayedText(fullText.slice(0, charIndex));
            } else {
                setIsStreaming(false);
                clearInterval(interval);
            }
        }, 20);

        return () => clearInterval(interval);
    }, [transaction?.id, transaction?.ai_explanation]);

    const tier = transaction ? getRiskTier(transaction.risk_score) : 'low';
    const color = transaction ? getRiskColor(tier) : undefined;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b">
                <div className="flex items-center gap-2">
                    <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        AI Analysis
                    </h2>
                    <BrainCircuit className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                {isStreaming && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs text-primary">Streaming</span>
                    </div>
                )}
            </div>

            <ScrollArea className="flex-1 overflow-hidden">
                <div className="px-5 py-4">
                    {!transaction ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                            <BrainCircuit className="w-8 h-8 text-muted-foreground/40 mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Select a transaction to view AI analysis
                            </p>
                        </div>
                    ) : !transaction.ai_explanation ? (
                        <div
                            className="rounded-lg px-4 py-3 border-l-2 bg-muted/30"
                            style={{ borderLeftColor: color }}
                        >
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                No suspicious patterns detected. Transaction appears consistent with normal activity.
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-2 font-mono">
                                Risk Score: {transaction.risk_score} · Tier: {tier.toUpperCase()} · Action: PASS
                            </p>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <div
                                className="rounded-lg px-4 py-3 border-l-2 bg-muted/30"
                                style={{ borderLeftColor: color }}
                            >
                                <p className="text-[14px] text-foreground/90 leading-[1.75]">
                                    {displayedText}
                                    {isStreaming && (
                                        <span className="inline-block w-[2px] h-4 ml-0.5 align-text-bottom bg-primary animate-pulse" />
                                    )}
                                </p>
                            </div>

                            {!isStreaming && (
                                <div className="flex items-center justify-between mt-3 px-1">
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                        Powered by Gemini 2.5 Flash
                                    </span>
                                    <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                                        {transaction.scenario.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
});

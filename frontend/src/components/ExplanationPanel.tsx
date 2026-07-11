import { useState, useEffect, memo } from 'react';
import type { Transaction } from '@/data/types';
import { getRiskTier, getRiskColor } from '@/data/types';
import { BrainCircuit, FileText, Radio } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-primary" />
                    <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                        AI Analysis
                    </h2>
                </div>
                {isStreaming && (
                    <Badge variant="outline" className="h-6 gap-1.5 rounded-sm border-primary/30 text-primary">
                        <Radio className="h-3 w-3 animate-pulse" />
                        Streaming
                    </Badge>
                )}
            </div>

            <ScrollArea className="flex-1 overflow-hidden">
                <div className="px-5 py-4">
                    {!transaction ? (
                        <div className="flex flex-col items-center justify-center h-36 text-center">
                            <BrainCircuit className="w-8 h-8 text-muted-foreground/40 mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Select a transaction to view AI analysis
                            </p>
                        </div>
                    ) : !transaction.ai_explanation ? (
                        <div
                            className="rounded-md border bg-muted/25 px-4 py-3"
                            style={{ borderLeftColor: color }}
                        >
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                No suspicious patterns detected. Transaction appears consistent with normal activity.
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-2 font-mono">
                                Risk Score: {transaction.risk_score} / Tier: {tier.toUpperCase()} / Action: PASS
                            </p>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <div className="rounded-md border bg-muted/25">
                                <div className="flex items-center gap-2 border-b px-4 py-2.5">
                                    <FileText className="h-4 w-4" style={{ color }} />
                                    <span className="text-xs font-medium text-muted-foreground">Compliance narrative</span>
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-[14px] text-foreground/90 leading-[1.75]">
                                        {displayedText}
                                        {isStreaming && (
                                            <span className="inline-block w-[2px] h-4 ml-0.5 align-text-bottom bg-primary animate-pulse" />
                                        )}
                                    </p>
                                </div>
                            </div>

                            {!isStreaming && (
                                <div className="flex items-center justify-between mt-3 px-1">
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                        Rule-backed narrative
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

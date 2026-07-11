import { useState, useEffect } from 'react';
import type { ActionType, Transaction } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { appendStoredAction } from '@/lib/sessionStore';
import { AlertCircle, Check, CheckCircle, Eye, HandMetal, Loader2, ShieldCheck } from 'lucide-react';

interface ActionButtonsProps {
    transaction: Transaction | null;
    onAction: (txId: string, action: ActionType) => void;
}

interface ActionConfig {
    type: ActionType;
    endpoint: string;
    label: string;
    icon: typeof HandMetal;
    colorClass: string;
    successMsg: string;
}

const actions: ActionConfig[] = [
    { type: 'hold', endpoint: '/api/actions/hold', label: 'Hold', icon: HandMetal, colorClass: 'bg-destructive text-destructive-foreground hover:bg-destructive/90', successMsg: 'Transaction held successfully' },
    { type: 'monitor', endpoint: '/api/actions/monitor', label: 'Monitor', icon: Eye, colorClass: 'bg-amber-500 text-black hover:bg-amber-400', successMsg: 'Transaction added to watchlist' },
    { type: 'authorize', endpoint: '/api/actions/authorize', label: 'Authorize', icon: Check, colorClass: 'bg-primary text-primary-foreground hover:bg-primary/90', successMsg: 'Transaction authorized by broker' },
];

export default function ActionButtons({ transaction, onAction }: ActionButtonsProps) {
    const [status, setStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
    const [toast, setToast] = useState<{ message: string; visible: boolean; type: 'success' | 'error' }>({ message: '', visible: false, type: 'success' });

    // Reset status when transaction changes
    useEffect(() => {
        setStatus({});
    }, [transaction?.id]);

    const handleClick = async (config: ActionConfig) => {
        if (!transaction) return;

        setStatus(prev => ({ ...prev, [config.type]: 'loading' }));

        try {
            const response = await apiFetch(config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tx_id: transaction.hash,
                    from_address: transaction.from,
                    to_address: transaction.to,
                    eth_value: transaction.eth_value,
                    risk_score: transaction.risk_score,
                    risk_tier: transaction.risk_tier,
                    triggered_rules: transaction.triggered_rules,
                    ai_explanation: transaction.ai_explanation,
                    timestamp: transaction.receivedAt ? new Date(transaction.receivedAt).toISOString() : new Date().toISOString(),
                    notes: config.type === 'hold' ? "Manual hold by broker" :
                        config.type === 'monitor' ? "Flagged for monitoring" :
                            "Broker authorized transaction"
                })
            });

            if (!response.ok) throw new Error('API Error');
            const payload = await response.json();

            appendStoredAction({
                id: payload.id ?? Date.now(),
                tx_id: transaction.hash,
                action: config.type,
                analyst_notes: payload.analyst_notes ?? (
                    config.type === 'hold' ? 'Manual hold by broker' :
                        config.type === 'monitor' ? 'Flagged for monitoring' :
                            'Broker authorized transaction'
                ),
                actioned_at: payload.actioned_at ?? new Date().toISOString(),
                actioned_by: payload.actioned_by ?? 'analyst_01',
                tx_details: {
                    ...transaction,
                },
            });

            setStatus(prev => ({ ...prev, [config.type]: 'success' }));
            onAction(transaction.id, config.type);
            setToast({ message: config.successMsg, visible: true, type: 'success' });
        } catch (err) {
            console.error(err);
            setStatus(prev => ({ ...prev, [config.type]: 'error' }));
            setToast({ message: "Action failed, try again", visible: true, type: 'error' });
        } finally {
            setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
        }
    };

    if (!transaction) {
        return (
            <div className="flex min-h-[190px] flex-col items-center justify-center p-6 text-muted-foreground">
                <ShieldCheck className="mb-2 h-8 w-8 opacity-40" />
                <p className="text-center text-sm">Select a transaction to take action</p>
            </div>
        );
    }

    const isLowRisk = transaction.risk_score < 40;

    return (
        <div className="flex min-h-[220px] flex-col">
            <div className="shrink-0 px-5 py-4 border-b flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                    Action Suite
                </h2>
                <Badge variant="outline" className="h-5 rounded-sm font-mono text-[10px]">
                    {transaction.hash.slice(0, 10)}
                </Badge>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-2 px-4 py-4">
                {isLowRisk ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                        <ShieldCheck className="w-8 h-8 opacity-45" />
                        <p className="text-sm font-medium">No Action Required</p>
                    </div>
                ) : (
                    actions.map(action => {
                        const state = status[action.type] || 'idle';
                        const isAutoHeld = action.type === 'hold' && transaction.auto_held;
                        const isCompleted = state === 'success' || isAutoHeld;
                        const isLoading = state === 'loading';

                        return (
                            <Button
                                key={action.type}
                                variant={isCompleted ? 'ghost' : 'default'}
                                disabled={isCompleted || isLoading}
                                onClick={() => handleClick(action)}
                                className={`h-10 w-full justify-center gap-2 rounded-sm font-semibold transition-all ${isCompleted
                                    ? 'bg-muted opacity-80'
                                    : action.colorClass
                                    } ${isAutoHeld ? 'border-2 border-destructive' : ''}`}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isCompleted ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <action.icon className="w-4 h-4" />
                                )}

                                {isAutoHeld
                                    ? 'Auto-held'
                                    : isCompleted
                                        ? `${action.label}ed`
                                        : action.label}
                            </Button>
                        );
                    })
                )}
            </div>

            {/* Toast */}
            {toast.visible && (
                <div className={`fixed bottom-6 right-6 z-50 rounded-md border px-5 py-3 text-sm font-semibold shadow-2xl animate-in slide-in-from-right duration-300 ${toast.type === 'success' ? 'bg-card border-primary/20' : 'bg-destructive text-white'
                    }`}>
                    <div className="flex items-center gap-3">
                        {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-primary" /> : <AlertCircle className="w-5 h-5" />}
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
}

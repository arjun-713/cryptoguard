import { useState, useEffect } from 'react';
import type { ActionType, Transaction } from '@/data/types';
import { Button } from '@/components/ui/button';
import { HandMetal, Eye, AlertTriangle, Check, Loader2 } from 'lucide-react';

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
    { type: 'hold', endpoint: '/api/actions/hold', label: 'HOLD', icon: HandMetal, colorClass: 'bg-red-600 hover:bg-red-700 text-white', successMsg: 'Transaction held successfully' },
    { type: 'monitor', endpoint: '/api/actions/monitor', label: 'MONITOR', icon: Eye, colorClass: 'bg-yellow-500 hover:bg-yellow-600 text-black', successMsg: 'Transaction added to watchlist' },
    { type: 'authorize', endpoint: '/api/actions/authorize', label: 'AUTHORIZE', icon: Check, colorClass: 'bg-green-500 hover:bg-green-600 text-white', successMsg: 'Transaction authorized by broker' },
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
            const response = await fetch(`http://localhost:8000${config.endpoint}`, {
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
            <div className="flex flex-col h-full items-center justify-center p-6 text-muted-foreground">
                <p className="text-sm text-center">Select a transaction to take action</p>
            </div>
        );
    }

    const isLowRisk = transaction.risk_score < 40;

    return (
        <div className="flex flex-col h-full border-t border-primary/5 bg-accent/5">
            <div className="shrink-0 px-5 py-3 border-b flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Action Suite
                </h2>
                <Badge variant="outline" className="text-[9px] h-4 font-mono opacity-50">{transaction.hash.slice(0, 8)}</Badge>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-2.5 px-4 py-4">
                {isLowRisk ? (
                    <div className="flex flex-col items-center gap-2 py-6 opacity-40">
                        <Check className="w-8 h-8 text-muted-foreground" />
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
                                className={`w-full justify-center gap-2 tracking-wide font-bold h-10 transition-all ${isCompleted
                                    ? 'bg-muted opacity-80'
                                    : action.colorClass
                                    } ${isAutoHeld ? 'border-destructive border-2' : ''}`}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isCompleted ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <action.icon className="w-4 h-4" />
                                )}

                                {isAutoHeld
                                    ? `✓ AUTO-HELD`
                                    : isCompleted
                                        ? `✓ ${action.label}ED`
                                        : action.label}
                            </Button>
                        );
                    })
                )}
            </div>

            {/* Toast */}
            {toast.visible && (
                <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg text-sm font-bold border shadow-2xl animate-in slide-in-from-right duration-300 ${toast.type === 'success' ? 'bg-card border-primary/20' : 'bg-destructive text-white'
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

const CheckCircle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
);

const AlertCircle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);

const Badge = ({ children, variant, className }: any) => (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${variant === 'outline' ? 'border-muted text-muted-foreground' : ''} ${className}`}>
        {children}
    </span>
);

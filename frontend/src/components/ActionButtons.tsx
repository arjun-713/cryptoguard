import { useState } from 'react';
import type { ActionType } from '@/data/types';
import { Button } from '@/components/ui/button';
import { HandMetal, Eye, AlertTriangle, Check } from 'lucide-react';

interface ActionButtonsProps {
    selectedTxId: string | null;
    onAction: (txId: string, action: ActionType) => void;
}

interface ActionConfig {
    type: ActionType;
    label: string;
    icon: typeof HandMetal;
    variant: 'destructive' | 'secondary' | 'outline';
}

const actions: ActionConfig[] = [
    { type: 'hold', label: 'HOLD', icon: HandMetal, variant: 'destructive' },
    { type: 'monitor', label: 'MONITOR', icon: Eye, variant: 'secondary' },
    { type: 'escalate', label: 'ESCALATE', icon: AlertTriangle, variant: 'outline' },
];

export default function ActionButtons({ selectedTxId, onAction }: ActionButtonsProps) {
    const [confirmedAction, setConfirmedAction] = useState<{ txId: string; action: ActionType } | null>(null);
    const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

    const handleClick = (action: ActionConfig) => {
        if (!selectedTxId) return;
        setConfirmedAction({ txId: selectedTxId, action: action.type });
        onAction(selectedTxId, action.type);
        setToast({ message: `Transaction marked as ${action.label}`, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="shrink-0 px-5 py-3 border-b">
                <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Broker Actions
                </h2>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-2 px-4 py-3">
                {!selectedTxId ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Select a transaction to take action
                    </p>
                ) : (
                    actions.map(action => {
                        const isConfirmed =
                            confirmedAction?.txId === selectedTxId &&
                            confirmedAction?.action === action.type;

                        return (
                            <Button
                                key={action.type}
                                variant={isConfirmed ? 'ghost' : action.variant}
                                disabled={isConfirmed}
                                onClick={() => handleClick(action)}
                                className="w-full justify-center gap-2 tracking-wide font-semibold h-9"
                            >
                                {isConfirmed ? <Check className="w-4 h-4" /> : <action.icon className="w-4 h-4" />}
                                {isConfirmed ? `${action.label} — CONFIRMED` : action.label}
                            </Button>
                        );
                    })
                )}
            </div>

            {/* Toast */}
            {toast.visible && (
                <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium bg-card border shadow-lg animate-slide-in">
                    <div className="flex items-center gap-2 text-foreground">
                        <Check className="w-4 h-4 text-primary" />
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useCallback, useEffect } from 'react';
import type { Transaction, ActionType } from '@/data/types';
import { useTransactionStream } from '@/hooks/useTransactionStream';
import TransactionFeed from '@/components/TransactionFeed';
import RiskCard from '@/components/RiskCard';
import ExplanationPanel from '@/components/ExplanationPanel';
import ActionButtons from '@/components/ActionButtons';
import AlertSidebar from '@/components/AlertSidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, Activity, Zap, Radio } from 'lucide-react';

function App() {
  const { transactions, isConnected, isDemoMode, setDemoMode, resetFeed, error } = useTransactionStream();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [, setActionLog] = useState<Map<string, ActionType>>(new Map());

  useEffect(() => {
    if (!selectedTx && transactions.length > 0) {
      const critical = transactions.find(tx => tx.risk_score >= 70);
      if (critical) setSelectedTx(critical);
    }
  }, [transactions, selectedTx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input (though we don't have any yet)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'd' || e.key === 'D') {
        setDemoMode(prev => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        resetFeed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setDemoMode, resetFeed]);

  const handleSelect = useCallback((tx: Transaction) => {
    setSelectedTx(tx);
  }, []);

  const handleAction = useCallback((txId: string, action: ActionType) => {
    setActionLog(prev => new Map(prev).set(txId, action));
  }, []);

  const alertCount = transactions.filter(tx => tx.risk_score >= 40).length;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="shrink-0 border-b bg-card/50 backdrop-blur-sm px-6 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                CryptoGuard
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] -mt-0.5">
                Real-Time Scam Interception
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Analyzed:</span>
              <span className="text-xs font-mono font-semibold text-foreground">
                {transactions.length}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Alerts:</span>
              <span className="text-xs font-mono font-semibold text-destructive">
                {alertCount}
              </span>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
              <Radio className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Risk Engine:</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-primary border-primary/30">
                ACTIVE
              </Badge>
            </div>

            <Button
              variant={isDemoMode ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-[10px] tracking-widest uppercase font-mono px-3 ml-2"
              onClick={() => setDemoMode(!isDemoMode)}
            >
              {isDemoMode ? 'Demo Mode: ON' : 'Start Demo'}
            </Button>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <div className="flex items-center gap-1.5 w-[72px]">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-primary' : (isDemoMode ? 'bg-chart-2' : 'bg-destructive')}`} />
              <span className={`text-xs font-mono font-medium ${isConnected ? 'text-primary' : (isDemoMode ? 'text-chart-2' : 'text-destructive')}`}>
                {isConnected ? 'LIVE' : (isDemoMode ? 'DEMO' : 'OFFLINE')}
              </span>
            </div>
            <span className="text-xs text-muted-foreground -ml-1">ETH Mainnet</span>
          </div>
        </div>
      </header>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <main className="flex-1 min-h-0 flex p-3 gap-3">
        {/* Left column — Transaction Feed */}
        <Card className="flex-[3] min-w-0 min-h-0 flex flex-col">
          <TransactionFeed
            transactions={transactions}
            selectedTxId={selectedTx?.id ?? null}
            onSelect={handleSelect}
          />
        </Card>

        {/* Center column — Risk + Explanation */}
        <div className="flex-[2] min-w-0 min-h-0 flex flex-col gap-3">
          <Card className="flex-1 min-h-0 flex flex-col">
            <RiskCard transaction={selectedTx} />
          </Card>
          <Card className="flex-1 min-h-0 flex flex-col">
            <ExplanationPanel transaction={selectedTx} />
          </Card>
        </div>

        {/* Right column — Actions + Alerts */}
        <div className="w-[280px] shrink-0 min-h-0 flex flex-col gap-3">
          <Card className="h-[200px] shrink-0 flex flex-col">
            <ActionButtons
              selectedTxId={selectedTx?.id ?? null}
              onAction={handleAction}
            />
          </Card>
          <Card className="flex-1 min-h-0 flex flex-col">
            <AlertSidebar
              transactions={transactions}
              selectedTxId={selectedTx?.id ?? null}
              onSelect={handleSelect}
            />
          </Card>
        </div>
      </main>

      {/* ═══════════════ STATUS BAR ═══════════════ */}
      <footer className="shrink-0 flex items-center justify-between px-6 py-1.5 border-t bg-card/30">
        <span className="text-[10px] font-mono text-muted-foreground">
          PIPELINE: ALCHEMY WSS → RISK ENGINE → DASHBOARD
        </span>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-muted-foreground">
            SCORING LATENCY: &lt;10ms
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            v1.0.0-hackathon
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;

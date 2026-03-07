import { useState, useCallback, useEffect } from 'react';
import type { Transaction, ActionType } from '@/data/types';
import { useTransactionStream } from '@/hooks/useTransactionStream';
import TransactionFeed from '@/components/TransactionFeed';
import RiskCard from '@/components/RiskCard';
import ExplanationPanel from '@/components/ExplanationPanel';
import ActionButtons from '@/components/ActionButtons';
import AlertSidebar from '@/components/AlertSidebar';
import SuspiciousAddresses from '@/components/SuspiciousAddresses';
import CaseLog from '@/components/CaseLog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, Activity, Zap, Radio, LayoutDashboard, ClipboardList, ShieldAlert } from 'lucide-react';

type active_view = 'dashboard' | 'case_log' | 'suspicious';

function App() {
  const { transactions, isConnected, isDemoMode, setDemoMode, resetFeed, error } = useTransactionStream();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [activeView, setActiveView] = useState<active_view>('dashboard');
  const [actionLog, setActionLog] = useState<Map<string, ActionType>>(new Map());
  const [stats, setStats] = useState<any>(null);

  // Fetch metrics (Fix 5)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/stats');
        if (res.ok) setStats(await res.json());
      } catch (err) { /* ignore */ }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedTx && transactions.length > 0) {
      const critical = transactions.find(tx => tx.risk_score >= 70);
      if (critical) setSelectedTx(critical);
    }
  }, [transactions, selectedTx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'd' || e.key === 'D') {
        setDemoMode(prev => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        resetFeed();
      } else if (e.key === '1') {
        setActiveView('dashboard');
      } else if (e.key === '2') {
        setActiveView('case_log');
      } else if (e.key === '3') {
        setActiveView('suspicious');
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
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  CryptoGuard
                </h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] -mt-0.5">
                  Real-Time Interception
                </p>
              </div>
            </div>

            <Separator orientation="vertical" className="h-8" />

            <nav className="flex items-center gap-1">
              <Button
                variant={activeView === 'dashboard' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-2 text-xs font-medium"
                onClick={() => setActiveView('dashboard')}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </Button>
              <Button
                variant={activeView === 'case_log' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-2 text-xs font-medium"
                onClick={() => setActiveView('case_log')}
              >
                <ClipboardList className="w-3.5 h-3.5" /> Case Log
              </Button>
              <Button
                variant={activeView === 'suspicious' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-2 text-xs font-medium"
                onClick={() => setActiveView('suspicious')}
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Bad Actors
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
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

            {/* False Positive Rate Stat (Fix 5) */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500/5 border border-cyan-500/20">
              <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-tight">FP Rate:</span>
              <span className="text-xs font-mono font-bold text-cyan-500">
                {stats ? `${(stats.false_positive_rate * 100).toFixed(1)}%` : '--%'}
              </span>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
              <Radio className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Engine:</span>
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
          </div>
        </div>
      </header>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        {activeView === 'dashboard' && (
          <div className="flex flex-1 p-3 gap-3 overflow-hidden">
            {/* Left column — Transaction Feed */}
            <Card className="flex-[3] min-w-0 min-h-0 flex flex-col border-primary/10">
              <TransactionFeed
                transactions={transactions}
                selectedTxId={selectedTx?.id ?? null}
                onSelect={handleSelect}
                actionLog={actionLog}
              />
            </Card>

            {/* Center column — Risk + Explanation */}
            <div className="flex-[2] min-w-0 min-h-0 flex flex-col gap-3">
              <Card className="flex-1 min-h-0 flex flex-col border-primary/10">
                <RiskCard transaction={selectedTx} />
              </Card>
              <Card className="flex-1 min-h-0 flex flex-col border-primary/10">
                <ExplanationPanel transaction={selectedTx} />
              </Card>
            </div>

            {/* Right column — Actions + Alerts */}
            <div className="w-[280px] shrink-0 min-h-0 flex flex-col gap-3">
              <Card className="h-[200px] shrink-0 flex flex-col border-primary/10">
                <ActionButtons
                  transaction={selectedTx}
                  onAction={handleAction}
                />
              </Card>
              <Card className="flex-1 min-h-0 flex flex-col border-primary/10">
                <AlertSidebar
                  transactions={transactions}
                  selectedTxId={selectedTx?.id ?? null}
                  onSelect={handleSelect}
                />
              </Card>
            </div>
          </div>
        )}

        {activeView === 'case_log' && (
          <div className="flex-1 p-3 overflow-hidden">
            <CaseLog />
          </div>
        )}

        {activeView === 'suspicious' && (
          <div className="flex-1 p-3 overflow-hidden">
            <SuspiciousAddresses />
          </div>
        )}
      </main>

      {/* ═══════════════ STATUS BAR ═══════════════ */}
      <footer className="shrink-0 flex items-center justify-between px-6 py-1.5 border-t bg-card/30">
        <span className="text-[10px] font-mono text-muted-foreground">
          PIPELINE: ALCHEMY WSS → RISK ENGINE → {activeView.toUpperCase()}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-muted-foreground">
            {isConnected ? 'NODE: MAINNET-P2P' : 'NODE: SIMULATOR-DB'}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            CryptoGuard Security v1.0.1
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;


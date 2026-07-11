import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Transaction, ActionType } from '@/data/types';
import { useTransactionStream } from '@/hooks/useTransactionStream';
import { apiFetch } from '@/lib/api';
import { getStoredStats, onSessionUpdate } from '@/lib/sessionStore';
import TransactionFeed from '@/components/TransactionFeed';
import RiskCard from '@/components/RiskCard';
import ExplanationPanel from '@/components/ExplanationPanel';
import ActionButtons from '@/components/ActionButtons';
import AlertSidebar from '@/components/AlertSidebar';
import SuspiciousAddresses from '@/components/SuspiciousAddresses';
import CaseReport from '@/components/CaseReport';
import CaseLog from '@/components/CaseLog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  ClipboardList,
  Database,
  Gauge,
  LayoutDashboard,
  Play,
  Radio,
  RefreshCcw,
  Shield,
  ShieldAlert,
  Siren,
  Square,
  Zap,
} from 'lucide-react';

type active_view = 'dashboard' | 'case_log' | 'suspicious' | 'case_report';

const views: Array<{ id: active_view; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'case_log', label: 'Cases', icon: ClipboardList },
  { id: 'suspicious', label: 'Actors', icon: ShieldAlert },
];

function App() {
  const { transactions, isConnected, isDemoMode, setDemoMode, resetFeed, error, addTransaction } = useTransactionStream();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [activeView, setActiveView] = useState<active_view>('dashboard');
  const [actionLog, setActionLog] = useState<Map<string, ActionType>>(new Map());
  const [stats, setStats] = useState<any>(null);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [caseList, setCaseList] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => setStats(getStoredStats());
    fetchStats();
    return onSessionUpdate(fetchStats);
  }, []);

  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (!selectedTx && !hasAutoSelected.current && transactions.length > 0) {
      const critical = transactions.find(tx => tx.risk_score >= 70);
      if (critical) {
        setSelectedTx(critical);
        hasAutoSelected.current = true;
      }
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

  const alertCount = useMemo(() => transactions.filter(tx => tx.risk_score >= 40).length, [transactions]);
  const criticalCount = useMemo(() => transactions.filter(tx => tx.risk_score >= 70).length, [transactions]);

  const [toast, setToast] = useState<string | null>(null);
  const [scamCooldown, setScamCooldown] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSimulateScam = async () => {
    if (scamCooldown) return;
    setScamCooldown(true);
    setTimeout(() => setScamCooldown(false), 2000);

    try {
      const payload = {
        from_address: '0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3',
        to_address: '0xcleanbroker999',
        eth_value: 15.0,
        wallet_age_days: 2,
        nonce: 1,
        hop_chain: ['0xhop1', '0xhop2', '0xhop3'],
        from_wallet_recent_txs: [
          { timestamp: '2024-01-01T11:59:50Z' },
          { timestamp: '2024-01-01T11:59:45Z' },
          { timestamp: '2024-01-01T11:59:40Z' },
          { timestamp: '2024-01-01T11:59:35Z' },
          { timestamp: '2024-01-01T11:59:30Z' },
        ],
      };

      const res = await apiFetch('/api/broker/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.transaction) {
          const txData = data.transaction;
          addTransaction({
            id: txData.id || txData.hash,
            hash: txData.hash,
            from: txData.from_address || txData.from,
            to: txData.to_address || txData.to,
            eth_value: txData.eth_value,
            gas_price_gwei: txData.gas_price_gwei || 0,
            nonce: txData.nonce || 0,
            risk_score: txData.risk_score,
            risk_tier: txData.risk_tier,
            action: txData.auto_held ? 'HOLD' : (txData.auto_monitored ? 'MONITOR' : 'PASS'),
            triggered_rules: txData.triggered_rules || [],
            hop_chain: txData.hop_chain || [],
            scenario: txData.scenario || 'manual_injection',
            timestamp_offset_seconds: 0,
            ai_explanation: txData.ai_explanation,
            receivedAt: Date.now(),
            status: 'scored',
            auto_held: txData.auto_held,
            auto_monitored: txData.auto_monitored,
          });
        }
        showToast('Scam transaction injected into the triage queue');
      }
    } catch (err) {
      console.error('Scam injection failed:', err);
      showToast('Scam injection failed');
    }
  };

  const handleToggleDemo = async () => {
    const newMode = !isDemoMode;
    setDemoMode(newMode);
    if (newMode) {
      resetFeed();
    }
    showToast(newMode ? 'Demo playback restarted' : 'Demo playback paused');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="app-grid-bg pointer-events-none fixed inset-0 -z-10" />

      {toast && (
        <div className="fixed right-4 top-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300 sm:right-6">
          <div className="flex items-center gap-2 rounded-md border border-primary/25 bg-card px-4 py-2 text-sm font-medium shadow-xl">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur-xl">
        <div className="flex min-h-16 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-card shadow-sm">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold leading-tight">CryptoGuard</h1>
                <Badge variant={isDemoMode ? 'default' : 'outline'} className="h-5 rounded-sm px-2 text-[10px]">
                  {isDemoMode ? 'Demo live' : 'Paused'}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                Real-time scam interception console
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto rounded-md border bg-card/70 p-1">
            {views.map(view => {
              const Icon = view.icon;
              return (
                <Button
                  key={view.id}
                  variant={activeView === view.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 shrink-0 gap-2 rounded-sm px-3 text-xs"
                  onClick={() => setActiveView(view.id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {view.label}
                </Button>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <MetricPill icon={Activity} label="Analyzed" value={transactions.length.toString()} />
            <MetricPill icon={Zap} label="Alerts" value={alertCount.toString()} tone="warning" />
            <MetricPill icon={Siren} label="Critical" value={criticalCount.toString()} tone="critical" />
            <MetricPill icon={Gauge} label="FP" value={stats ? `${(stats.false_positive_rate * 100).toFixed(1)}%` : '--'} />

            <Separator orientation="vertical" className="hidden h-8 lg:block" />

            <Button
              variant="outline"
              size="sm"
              disabled={scamCooldown}
              className="h-9 gap-2 rounded-sm border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleSimulateScam}
            >
              <Siren className="h-4 w-4" />
              Inject
            </Button>
            <Button
              variant={isDemoMode ? 'secondary' : 'default'}
              size="sm"
              className="h-9 gap-2 rounded-sm"
              onClick={handleToggleDemo}
            >
              {isDemoMode ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isDemoMode ? 'Pause' : 'Start'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-sm"
              onClick={resetFeed}
              aria-label="Reset feed"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-65px)] overflow-hidden p-3 lg:p-4">
        {activeView === 'dashboard' && (
          <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(340px,1.25fr)_minmax(360px,1fr)] xl:grid-cols-[minmax(360px,1.2fr)_minmax(380px,0.95fr)_320px]">
            <Card className="min-h-[520px] py-0 lg:min-h-0">
              <TransactionFeed
                transactions={transactions}
                selectedTxId={selectedTx?.id ?? null}
                onSelect={handleSelect}
                actionLog={actionLog}
              />
            </Card>

            <div className="grid min-h-[620px] grid-rows-[minmax(310px,1fr)_minmax(260px,0.86fr)] gap-3 lg:min-h-0">
              <Card className="min-h-0 py-0">
                <RiskCard
                  transaction={selectedTx}
                  isAuthorized={selectedTx ? actionLog.get(selectedTx.id) === 'authorize' : false}
                />
              </Card>
              <Card className="min-h-0 py-0">
                <ExplanationPanel transaction={selectedTx} />
              </Card>
            </div>

            <div className="grid min-h-[520px] grid-rows-[auto_minmax(260px,1fr)] gap-3 lg:min-h-0 lg:grid-cols-2 xl:grid-cols-1">
              <Card className="py-0">
                <ActionButtons
                  transaction={selectedTx}
                  onAction={handleAction}
                />
              </Card>
              <Card className="min-h-0 py-0">
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
          <CaseLog onViewCase={(c: any, list: any[]) => {
            setSelectedCase(c);
            setCaseList(list);
            setActiveView('case_report');
          }} />
        )}

        {activeView === 'suspicious' && (
          <SuspiciousAddresses />
        )}

        {activeView === 'case_report' && selectedCase && (
          <div className="h-full overflow-y-auto">
            <CaseReport
              caseData={selectedCase}
              caseList={caseList}
              onNavigate={(c: any) => setSelectedCase(c)}
              onBack={() => setActiveView('case_log')}
            />
          </div>
        )}
      </main>

      <footer className="hidden border-t bg-background/88 px-6 py-2 text-[11px] text-muted-foreground backdrop-blur-xl lg:flex lg:items-center lg:justify-between">
        <span className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5" />
          Pipeline: simulation feed to risk engine to analyst queue
        </span>
        <span className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5" />
          {isConnected ? 'Session store online' : 'Session store unavailable'}
          {error ? ` - ${error}` : ''}
        </span>
      </footer>
    </div>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'critical';
}) {
  const toneClass = {
    default: 'text-foreground',
    warning: 'text-amber-300',
    critical: 'text-destructive',
  }[tone];

  return (
    <div className="flex h-9 items-center gap-2 rounded-md border bg-card/70 px-3 shadow-sm">
      <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
      <span className="hidden text-[11px] text-muted-foreground sm:inline">{label}</span>
      <span className={`font-mono text-xs font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

export default App;

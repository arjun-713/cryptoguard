import { useState, useEffect } from 'react';
import type { SuspiciousAddress } from '@/data/types';
import { truncateAddress, formatRuleName } from '@/data/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldAlert, Users, Calendar, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function SuspiciousAddresses() {
    const [addresses, setAddresses] = useState<SuspiciousAddress[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAddresses = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/suspicious-addresses');
            const data = await res.json();
            setAddresses(data);
        } catch (err) {
            console.error('Failed to fetch suspicious addresses:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAddresses();
        const interval = setInterval(fetchAddresses, 30000);
        return () => clearInterval(interval);
    }, []);

    const repeatOffenders = addresses.filter(a => a.times_flagged >= 2).length;

    return (
        <div className="flex flex-col bg-background p-4 gap-4 animate-fade-in overflow-y-auto" style={{ height: 'calc(100vh - 80px)' }}>
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Suspicious Address Tracker</h1>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                            {addresses.length} entities tracked · {repeatOffenders} repeat offenders
                        </p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Database Status</p>
                        <Badge variant="outline" className="text-primary border-primary/30 h-5">REAL-TIME SYNC</Badge>
                    </div>
                </div>
            </div>

            <Card className="flex-1 min-h-0 flex flex-col border-primary/10 bg-card/50 overflow-hidden">
                <div className="grid grid-cols-12 px-6 py-3 bg-muted/30 border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <div className="col-span-3">Address</div>
                    <div className="col-span-1 text-center">Flags</div>
                    <div className="col-span-1 text-center">Score</div>
                    <div className="col-span-2">First Seen</div>
                    <div className="col-span-2">Last Seen</div>
                    <div className="col-span-3">Top Rules</div>
                </div>

                <ScrollArea className="flex-1">
                    {loading && addresses.length === 0 ? (
                        <div className="flex items-center justify-center p-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : addresses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                            <Users className="w-12 h-12 mb-4 opacity-20" />
                            <p>No suspicious addresses recorded yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {addresses.map((addr) => {
                                const isRepeatOffender = addr.times_flagged >= 2;
                                const rules = JSON.parse(addr.triggered_rules || '[]');

                                return (
                                    <div
                                        key={addr.address}
                                        className={`grid grid-cols-12 px-6 py-4 items-center gap-2 hover:bg-accent/10 transition-colors ${isRepeatOffender ? 'bg-destructive/5' : ''}`}
                                    >
                                        <div className="col-span-3 font-mono text-sm flex items-center gap-2">
                                            {isRepeatOffender && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                                            <span className={isRepeatOffender ? 'text-destructive font-bold' : 'text-foreground'}>
                                                {truncateAddress(addr.address)}
                                            </span>
                                        </div>
                                        <div className="col-span-1 text-center font-bold">
                                            <Badge variant={isRepeatOffender ? "destructive" : "secondary"} className="h-6">
                                                {addr.times_flagged}
                                            </Badge>
                                        </div>
                                        <div className="col-span-1 text-center font-mono font-bold text-primary">
                                            {addr.highest_score}
                                        </div>
                                        <div className="col-span-2 text-xs text-muted-foreground flex items-center gap-2">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(addr.first_seen).toLocaleDateString()}
                                        </div>
                                        <div className="col-span-2 text-xs text-muted-foreground flex items-center gap-2">
                                            <Activity className="w-3 h-3" />
                                            {new Date(addr.last_seen).toLocaleTimeString()}
                                        </div>
                                        <div className="col-span-3 flex flex-wrap gap-1">
                                            {rules.slice(0, 2).map((r: string) => (
                                                <span key={r} className="text-[9px] bg-muted px-1.5 py-0.5 rounded uppercase font-mono text-muted-foreground">
                                                    {r.replace('_', ' ')}
                                                </span>
                                            ))}
                                            {rules.length > 2 && <span className="text-[9px] text-muted-foreground">+{rules.length - 2} more</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                <div className="shrink-0 p-4 bg-muted/10 border-t">
                    <p className="text-[10px] text-muted-foreground text-center uppercase tracking-[0.2em]">
                        Reputation Database · Entities with ≥ 2 flags receive +10 risk penalty
                    </p>
                </div>
            </Card>
        </div>
    );
}

const Activity = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);

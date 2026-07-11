import { useState, useEffect } from 'react';
import type { SuspiciousAddress } from '@/data/types';
import { truncateAddress } from '@/data/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, AlertTriangle, Calendar, Database, ShieldAlert, Users } from 'lucide-react';
import { getStoredSuspiciousAddresses, onSessionUpdate } from '@/lib/sessionStore';

export default function SuspiciousAddresses() {
    const [addresses, setAddresses] = useState<SuspiciousAddress[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAddresses = () => {
        setAddresses(getStoredSuspiciousAddresses());
        setLoading(false);
    };

    useEffect(() => {
        fetchAddresses();
        return onSessionUpdate(fetchAddresses);
    }, []);

    const repeatOffenders = addresses.filter(a => a.times_flagged >= 2).length;

    return (
        <div className="flex h-full flex-col gap-3 animate-fade-in">
            <div className="flex shrink-0 flex-col gap-3 rounded-md border bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-background">
                        <ShieldAlert className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">Suspicious Address Tracker</h1>
                        <p className="text-xs text-muted-foreground font-mono">
                            {addresses.length} entities tracked / {repeatOffenders} repeat offenders
                        </p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                        <Database className="h-4 w-4 text-primary" />
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Database</p>
                            <Badge variant="outline" className="h-5 rounded-sm text-primary border-primary/30">Session sync</Badge>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="flex min-h-0 flex-1 py-0">
                <CardHeader className="border-b py-4">
                    <CardTitle className="text-sm">Reputation Database</CardTitle>
                    <CardDescription>Flagged senders derived from the current browser session.</CardDescription>
                </CardHeader>

                <CardContent className="min-h-0 flex-1 p-0">
                    <ScrollArea className="h-full">
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
                                            className={`grid gap-3 px-5 py-4 transition-colors hover:bg-accent/10 md:grid-cols-12 md:items-center ${isRepeatOffender ? 'bg-destructive/5' : ''}`}
                                        >
                                            <div className="font-mono text-sm flex items-center gap-2 md:col-span-3">
                                                {isRepeatOffender && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                                                <span className={isRepeatOffender ? 'text-destructive font-bold' : 'text-foreground'}>
                                                    {truncateAddress(addr.address)}
                                                </span>
                                            </div>
                                            <div className="font-bold md:col-span-1 md:text-center">
                                                <Badge variant={isRepeatOffender ? "destructive" : "secondary"} className="h-6 rounded-sm">
                                                    {addr.times_flagged}
                                                </Badge>
                                            </div>
                                            <div className="font-mono font-bold text-primary md:col-span-1 md:text-center">
                                                {addr.highest_score}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2 md:col-span-2">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(addr.first_seen).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2 md:col-span-2">
                                                <Activity className="w-3 h-3" />
                                                {new Date(addr.last_seen).toLocaleTimeString()}
                                            </div>
                                            <div className="flex flex-wrap gap-1 md:col-span-3">
                                                {rules.slice(0, 2).map((r: string) => (
                                                    <span key={r} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-sm uppercase font-mono text-muted-foreground">
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
                </CardContent>
            </Card>
        </div>
    );
}

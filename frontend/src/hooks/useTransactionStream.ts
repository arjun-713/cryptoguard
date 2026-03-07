import { useState, useEffect, useCallback, useRef } from 'react';
import type { Transaction } from '@/data/types';
import { mockTransactions, playbackConfig } from '@/data/mockData';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/stream';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/transactions/score';

export function useTransactionStream() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const demoIndexRef = useRef(0);

    // --- DEMO MODE LOGIC ---
    const addDemoTransaction = useCallback((tx: Transaction) => {
        const enriched: Transaction = {
            ...tx,
            receivedAt: Date.now(),
            status: 'scored',
        };
        setTransactions(prev => [enriched, ...prev].slice(0, 50));
    }, []);

    const scheduleNextDemo = useCallback(() => {
        if (!isDemoMode) return;

        if (demoIndexRef.current >= mockTransactions.length) {
            if (playbackConfig.loop) {
                demoIndexRef.current = 0;
                demoTimerRef.current = setTimeout(scheduleNextDemo, playbackConfig.loop_delay_seconds * 1000);
            }
            return;
        }

        const currentTx = mockTransactions[demoIndexRef.current];
        const nextTx = mockTransactions[demoIndexRef.current + 1];

        addDemoTransaction(currentTx);
        demoIndexRef.current += 1;

        if (nextTx) {
            const delay = (nextTx.timestamp_offset_seconds - currentTx.timestamp_offset_seconds) * 1000;
            const adjustedDelay = Math.max(800, Math.min(delay, 4000));
            demoTimerRef.current = setTimeout(scheduleNextDemo, adjustedDelay);
        } else if (playbackConfig.loop) {
            demoTimerRef.current = setTimeout(() => {
                demoIndexRef.current = 0;
                scheduleNextDemo();
            }, playbackConfig.loop_delay_seconds * 1000);
        }
    }, [isDemoMode, addDemoTransaction]);

    const startDemo = useCallback(() => {
        demoIndexRef.current = 0;
        setTransactions([]);
        setError('Backend offline — running on demo data');

        // Pre-populate
        const initial = mockTransactions.slice(0, 3).map(tx => ({
            ...tx,
            receivedAt: Date.now() - (90 - tx.timestamp_offset_seconds) * 1000,
            status: 'scored' as const,
        }));
        setTransactions(initial.reverse());
        demoIndexRef.current = 3;

        demoTimerRef.current = setTimeout(scheduleNextDemo, 1500);
    }, [scheduleNextDemo]);

    const stopDemo = useCallback(() => {
        if (demoTimerRef.current) {
            clearTimeout(demoTimerRef.current);
            demoTimerRef.current = null;
        }
    }, []);

    // --- LIVE WEBSOCKET LOGIC ---
    const connectWebSocket = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                setError(null);
            };

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);

                    const newTx: Transaction = {
                        id: data.tx_id,
                        hash: `0x${Math.random().toString(16).slice(2, 66)}`,
                        from: data.from_wallet,
                        to: data.to_wallets?.[0] || 'Unknown',
                        eth_value: data.total_value_usd ? (data.total_value_usd / 2000) : (data.amounts?.[0] || 0),
                        gas_price_gwei: 20 + Math.random() * 10,
                        nonce: Math.floor(Math.random() * 100),
                        risk_score: 0,
                        risk_tier: 'low',
                        action: 'PASS',
                        triggered_rules: [],
                        hop_chain: [],
                        scenario: 'real_time_scoring',
                        timestamp_offset_seconds: 0,
                        ai_explanation: null,
                        receivedAt: Date.now(),
                        status: 'scoring'
                    };

                    setTransactions(prev => [newTx, ...prev].slice(0, 50));

                    // Score it via API
                    try {
                        const res = await fetch(API_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tx_id: data.tx_id })
                        });

                        if (res.ok) {
                            const scoreData = await res.json();

                            setTransactions(prev => prev.map(t => {
                                if (t.id === newTx.id) {
                                    return {
                                        ...t,
                                        risk_score: scoreData.risk_score,
                                        action: scoreData.action,
                                        triggered_rules: Object.entries(scoreData.signals || {})
                                            .filter(([_, val]) => val === true || (typeof val === 'number' && val > 0.8))
                                            .map(([key]) => key.toUpperCase()),
                                        ai_explanation: scoreData.explanation,
                                        status: 'scored'
                                    };
                                }
                                return t;
                            }));
                        } else {
                            throw new Error('Scoring failed');
                        }
                    } catch (err) {
                        setTransactions(prev => prev.map(t =>
                            t.id === newTx.id ? { ...t, status: 'error' } : t
                        ));
                    }

                } catch (e) {
                    console.error("Failed to parse WS message", e);
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                // On disonnect, fallback to demo mode automatically
                if (!isDemoMode) {
                    setIsDemoMode(true);
                }
            };

            ws.onerror = () => {
                setIsConnected(false);
                if (!isDemoMode) {
                    setIsDemoMode(true);
                }
            };
        } catch (e) {
            setIsDemoMode(true);
        }
    }, [isDemoMode]);

    // Handle Demo Mode Toggle
    useEffect(() => {
        if (isDemoMode) {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            setIsConnected(false);
            startDemo();
        } else {
            stopDemo();
            setTransactions([]);
            setError(null);
            connectWebSocket();
        }

        return () => {
            stopDemo();
            if (wsRef.current) wsRef.current.close();
        };
    }, [isDemoMode, startDemo, stopDemo, connectWebSocket]);

    const resetFeed = useCallback(() => {
        setTransactions([]);
        if (isDemoMode) {
            stopDemo();
            startDemo();
        }
    }, [isDemoMode, startDemo, stopDemo]);

    return {
        transactions,
        isConnected,
        isDemoMode,
        setDemoMode: setIsDemoMode,
        resetFeed,
        error
    };
}

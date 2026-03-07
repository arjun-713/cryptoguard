import { useState, useEffect, useCallback, useRef } from 'react';
import type { Transaction } from '@/data/types';

// Connect directly to the Python backend
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
const DEMO_START_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/demo/start` : 'http://localhost:8000/api/demo/start';

export function useTransactionStream() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);

    const startDemo = useCallback(async () => {
        try {
            setTransactions([]);
            await fetch(DEMO_START_URL, { method: 'POST' });
        } catch (e) {
            console.error("Failed to start demo:", e);
            setError("Failed to start demo sequence");
        }
    }, []);

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

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    if (payload.type === 'new_transaction' && payload.data) {
                        const txData = payload.data;

                        // Map Python backend format to Frontend Transaction format
                        const newTx: Transaction = {
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
                            scenario: txData.scenario || 'live',
                            timestamp_offset_seconds: 0,
                            ai_explanation: txData.ai_explanation,
                            receivedAt: Date.now(),
                            status: 'scored'
                        };

                        setTransactions(prev => [newTx, ...prev].slice(0, 50));
                    }
                } catch (e) {
                    console.error("Failed to parse WS message", e);
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
            };

            ws.onerror = () => {
                setIsConnected(false);
                setError("WebSocket connection failed. Ensure backend is running at :8000");
            };
        } catch (e) {
            setIsConnected(false);
            setError("Unable to connect to streaming backend");
        }
    }, []);

    useEffect(() => {
        connectWebSocket();
        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [connectWebSocket]);

    // Handle Demo Mode Toggle
    useEffect(() => {
        if (isDemoMode && isConnected) {
            startDemo();
        }
    }, [isDemoMode, isConnected, startDemo]);

    const resetFeed = useCallback(() => {
        setTransactions([]);
        if (isDemoMode) {
            startDemo();
        }
    }, [isDemoMode, startDemo]);

    return {
        transactions,
        isConnected,
        isDemoMode,
        setDemoMode: setIsDemoMode,
        resetFeed,
        error
    };
}

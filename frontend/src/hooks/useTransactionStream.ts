import { useState, useEffect, useCallback, useRef } from 'react';
import type { Transaction } from '@/data/types';
import { mockTransactions, playbackConfig } from '@/data/mockData';
import {
    appendStoredAction,
    clearStoredTransactions,
    getStoredActions,
    getStoredTransactions,
    mergeTransactions,
    onSessionUpdate,
} from '@/lib/sessionStore';

export function useTransactionStream() {
    const [transactions, setTransactions] = useState<Transaction[]>(() => getStoredTransactions());
    const [isConnected, setIsConnected] = useState(true);
    const [isDemoMode, setIsDemoModeState] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(true);

    const indexRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const syncFromStorage = useCallback(() => {
        setTransactions(getStoredTransactions());
    }, []);

    const stopTimers = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const addTransaction = useCallback((tx: Transaction) => {
        const enriched = {
            ...tx,
            receivedAt: tx.receivedAt ?? Date.now(),
            status: tx.status ?? 'scored',
            auto_held: tx.auto_held ?? tx.risk_score >= 80,
            auto_monitored: tx.auto_monitored ?? (tx.risk_score >= 40 && tx.risk_score < 80),
        };

        const existingActions = getStoredActions();
        const autoAction = existingActions.find(action =>
            action.tx_id === enriched.hash && action.action.startsWith('AUTO_')
        );

        if (!autoAction && (enriched.auto_held || enriched.auto_monitored)) {
            appendStoredAction({
                id: Date.now(),
                tx_id: enriched.hash,
                action: enriched.auto_held ? 'AUTO_HOLD' : 'AUTO_MONITOR',
                analyst_notes: enriched.auto_held ? 'Automatically held by demo risk engine' : 'Automatically flagged for monitoring',
                actioned_at: new Date(enriched.receivedAt).toISOString(),
                actioned_by: 'system',
                tx_details: enriched,
            });
        }

        const stored = mergeTransactions([enriched]);
        setTransactions(stored);
    }, []);

    const scheduleNextRef = useRef<() => void>(() => undefined);

    const seedInitialTransactions = useCallback(() => {
        const current = getStoredTransactions();
        if (current.length > 0) {
            const seen = new Set(current.map(tx => tx.id));
            indexRef.current = mockTransactions.findIndex(tx => !seen.has(tx.id));
            if (indexRef.current < 0) indexRef.current = mockTransactions.length;
            setTransactions(current);
            return;
        }

        const initial = mockTransactions.slice(0, 3).map(tx => ({
            ...tx,
            receivedAt: Date.now() - (90 - tx.timestamp_offset_seconds) * 1000,
        }));
        clearStoredTransactions();
        const stored = mergeTransactions(initial.reverse());
        setTransactions(stored);
        indexRef.current = 3;
    }, []);

    const scheduleNext = useCallback(() => {
        if (!isPlaying || !isDemoMode) {
            return;
        }

        if (indexRef.current >= mockTransactions.length) {
            if (playbackConfig.loop) {
                timerRef.current = setTimeout(() => {
                    clearStoredTransactions();
                    setTransactions([]);
                    indexRef.current = 0;
                    scheduleNextRef.current();
                }, playbackConfig.loop_delay_seconds * 1000);
            }
            return;
        }

        const currentTx = mockTransactions[indexRef.current];
        const nextTx = mockTransactions[indexRef.current + 1];

        addTransaction(currentTx);
        indexRef.current += 1;

        if (!nextTx) {
            scheduleNextRef.current();
            return;
        }

        const delay = (nextTx.timestamp_offset_seconds - currentTx.timestamp_offset_seconds) * 1000;
        const adjustedDelay = Math.max(800, Math.min(delay, 4000));
        timerRef.current = setTimeout(() => scheduleNextRef.current(), adjustedDelay);
    }, [addTransaction, isDemoMode, isPlaying]);

    scheduleNextRef.current = scheduleNext;

    const stop = useCallback(() => {
        setIsPlaying(false);
        stopTimers();
    }, [stopTimers]);

    const start = useCallback(() => {
        setIsPlaying(true);
        setIsConnected(true);
        setError(null);
        stopTimers();
        scheduleNextRef.current();
    }, [stopTimers]);

    const resetFeed = useCallback(() => {
        stop();
        clearStoredTransactions();
        indexRef.current = 0;
        setTransactions([]);
        seedInitialTransactions();
        if (isDemoMode) {
            setTimeout(() => {
                setIsPlaying(true);
                scheduleNextRef.current();
            }, 250);
        }
    }, [isDemoMode, seedInitialTransactions, stop]);

    const setDemoMode = useCallback((next: boolean | ((value: boolean) => boolean)) => {
        setIsDemoModeState(prev => {
            const resolved = typeof next === 'function' ? next(prev) : next;
            if (resolved) {
                setIsPlaying(true);
                setTimeout(() => scheduleNextRef.current(), 50);
            } else {
                stop();
            }
            return resolved;
        });
    }, [stop]);

    useEffect(() => {
        seedInitialTransactions();
        const startDelay = setTimeout(() => {
            if (isDemoMode) {
                scheduleNextRef.current();
            }
        }, 1200);

        return () => {
            clearTimeout(startDelay);
            stopTimers();
        };
    }, [isDemoMode, seedInitialTransactions, stopTimers]);

    useEffect(() => onSessionUpdate(syncFromStorage), [syncFromStorage]);

    return {
        transactions,
        isConnected,
        isDemoMode,
        setDemoMode,
        resetFeed,
        error,
        addTransaction,
        start,
        stop,
    };
}

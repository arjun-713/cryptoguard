import { useState, useEffect, useCallback, useRef } from 'react';
import type { Transaction } from '@/data/types';
import { mockTransactions, playbackConfig } from '@/data/mockData';

export function useTransactionSimulation() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isPlaying, setIsPlaying] = useState(true);
    const indexRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const addTransaction = useCallback((tx: Transaction) => {
        const enriched: Transaction = {
            ...tx,
            receivedAt: Date.now(),
        };
        setTransactions(prev => [enriched, ...prev].slice(0, 50));
    }, []);

    const scheduleNext = useCallback(() => {
        if (indexRef.current >= mockTransactions.length) {
            if (playbackConfig.loop) {
                indexRef.current = 0;
                timerRef.current = setTimeout(() => {
                    scheduleNext();
                }, playbackConfig.loop_delay_seconds * 1000);
            }
            return;
        }

        const currentTx = mockTransactions[indexRef.current];
        const nextTx = mockTransactions[indexRef.current + 1];

        addTransaction(currentTx);
        indexRef.current += 1;

        if (nextTx) {
            const delay = (nextTx.timestamp_offset_seconds - currentTx.timestamp_offset_seconds) * 1000;
            // Speed up for demo: use a minimum of 800ms between transactions
            const adjustedDelay = Math.max(800, Math.min(delay, 4000));
            timerRef.current = setTimeout(scheduleNext, adjustedDelay);
        } else if (playbackConfig.loop) {
            timerRef.current = setTimeout(() => {
                indexRef.current = 0;
                scheduleNext();
            }, playbackConfig.loop_delay_seconds * 1000);
        }
    }, [addTransaction]);

    const start = useCallback(() => {
        setIsPlaying(true);
        scheduleNext();
    }, [scheduleNext]);

    const stop = useCallback(() => {
        setIsPlaying(false);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const reset = useCallback(() => {
        stop();
        indexRef.current = 0;
        setTransactions([]);
    }, [stop]);

    useEffect(() => {
        if (isPlaying) {
            // Add the first 3 transactions immediately for a populated feel
            const initial = mockTransactions.slice(0, 3).map(tx => ({
                ...tx,
                receivedAt: Date.now() - (90 - tx.timestamp_offset_seconds) * 1000,
            }));
            setTransactions(initial.reverse());
            indexRef.current = 3;

            const startDelay = setTimeout(scheduleNext, 1500);
            return () => clearTimeout(startDelay);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return {
        transactions,
        isPlaying,
        totalProcessed: indexRef.current,
        start,
        stop,
        reset,
    };
}

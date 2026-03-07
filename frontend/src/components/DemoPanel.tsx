import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ShieldAlert, Zap, Server } from 'lucide-react';

export default function DemoPanel() {
    const [step1Done, setStep1Done] = useState(false);
    const [step2Done, setStep2Done] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'alert' } | null>(null);

    const showToast = (message: string, type: 'success' | 'alert') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSetupBroker = async () => {
        try {
            await fetch('http://localhost:8000/api/broker/register-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: "0xBROKER_DEMO_ACCOUNT_001",
                    name: "Demo Broker",
                    account_type: "broker"
                })
            });
            setStep1Done(true);
            showToast("Broker account registered", "success");
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddScammer = async () => {
        try {
            await fetch('http://localhost:8000/api/broker/register-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3",
                    name: "Unknown Customer",
                    account_type: "customer"
                })
            });
            setStep2Done(true);
            showToast("Customer wallet registered", "success");
        } catch (e) {
            console.error(e);
        }
    };

    const handleWithdraw = async () => {
        try {
            await fetch('http://localhost:8000/api/broker/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_address: "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3",
                    to_address: "0xBROKER_DEMO_ACCOUNT_001",
                    eth_value: 15.0,
                    wallet_age_days: 2,
                    nonce: 1,
                    hop_chain: ["0xhop1", "0xhop2", "0xhop3"]
                })
            });
            showToast("⚠️ HIGH RISK TRANSACTION INTERCEPTED", "alert");
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Card className="fixed bottom-12 right-12 z-50 p-4 w-72 shadow-2xl border-primary/20 bg-card/95 backdrop-blur">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <Server className="w-4 h-4" /> Demo Control Panel
            </h3>
            <div className="flex flex-col gap-2">
                <Button
                    variant={step1Done ? "outline" : "secondary"}
                    className={`justify-start gap-2 text-xs h-9 ${step1Done ? 'text-green-500 border-green-500/30' : ''}`}
                    onClick={handleSetupBroker}
                    disabled={step1Done}
                >
                    {step1Done ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-current opacity-50 flex items-center justify-center text-[8px]">1</div>}
                    Setup Broker Account
                </Button>

                <Button
                    variant={step2Done ? "outline" : "secondary"}
                    className={`justify-start gap-2 text-xs h-9 ${step2Done ? 'text-green-500 border-green-500/30' : ''}`}
                    onClick={handleAddScammer}
                    disabled={step2Done}
                >
                    {step2Done ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-current opacity-50 flex items-center justify-center text-[8px]">2</div>}
                    Add Scammer Account
                </Button>

                <Button
                    variant="default"
                    className="justify-start gap-2 text-xs h-9 mt-2 font-bold group"
                    onClick={handleWithdraw}
                    disabled={!step1Done || !step2Done}
                >
                    <Zap className="w-4 h-4 group-hover:text-yellow-400 group-hover:animate-pulse" />
                    Initiate Transaction
                </Button>
            </div>

            {toast && (
                <div className={`absolute -top-14 left-0 right-0 p-3 rounded text-xs font-bold shadow-lg animate-in slide-in-from-bottom-2 ${toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500 text-white shadow-red-500/50'}`}>
                    <div className="flex items-center justify-center gap-2">
                        {toast.type === 'success' ? <Check className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                        {toast.message}
                    </div>
                </div>
            )}
        </Card>
    );
}

import { useState, useCallback } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { truncateAddress } from '@/data/types';

interface HashLinkProps {
    hash: string;
    className?: string;
}

export default function HashLink({ hash, className = "" }: HashLinkProps) {
    const [copied, setCopied] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

    const handleCopy = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [hash]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuPos({ x: e.clientX, y: e.clientY });
        setShowMenu(true);
    }, []);

    const closeMenu = useCallback(() => {
        setShowMenu(false);
    }, []);

    if (!hash) return null;

    return (
        <div className={`relative inline-block ${className}`}>
            <button
                onClick={handleCopy}
                onContextMenu={handleContextMenu}
                className="group flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-cyan-500 transition-colors pointer-events-auto"
                title="Click to copy, Right-click for options"
            >
                <span>{truncateAddress(hash)}</span>
                {copied ? (
                    <Check className="w-3 h-3 text-cyan-500" />
                ) : (
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </button>

            {/* Success Toast */}
            {copied && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-cyan-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-bounce">
                    Hash copied!
                </div>
            )}

            {/* Context Menu */}
            {showMenu && (
                <>
                    <div
                        className="fixed inset-0 z-[100]"
                        onClick={closeMenu}
                    />
                    <div
                        className="fixed z-[101] bg-card border rounded-md shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in duration-100"
                        style={{ top: menuPos.y, left: menuPos.x }}
                    >
                        <button
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center justify-between"
                            onClick={(e) => { handleCopy(e); closeMenu(); }}
                        >
                            Copy Transaction Hash <Copy className="w-3 h-3" />
                        </button>
                        <a
                            href={`https://etherscan.io/tx/${hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center justify-between border-t"
                            onClick={closeMenu}
                        >
                            View on Etherscan <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </>
            )}
        </div>
    );
}

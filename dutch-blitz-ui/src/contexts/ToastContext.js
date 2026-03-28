"use client";
import { createContext, useContext, useState } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = (msg) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, msg }]);
        setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* The UI is now handled globally, completely invisible to your page.js */}
            <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
                {toasts.map(t => {
                    const parts = t.msg.split(/( joined the lobby\.| left the lobby\.)/);
                    return (
                        <div key={t.id} className="bg-neutral-800/95 backdrop-blur-md text-neutral-300 text-[11px] md:text-xs px-5 py-2 rounded-full shadow-2xl border border-neutral-700/80 transition-all duration-300 flex items-center gap-1.5 text-center">
                            {parts.length > 1 ? (
                                <>
                                    <span className="font-bold text-white">{parts[0]}</span>
                                    <span>{parts[1]}</span>
                                </>
                            ) : (
                                t.msg
                            )}
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
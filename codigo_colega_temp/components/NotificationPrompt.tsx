import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ShieldAlert } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export const NotificationPrompt = () => {
    const { requestNotificationPermission, user } = useApp();
    const [status, setStatus] = useState<NotificationPermission>(
        typeof window !== 'undefined' ? Notification.permission : 'default'
    );
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!user) return;
        
        const checkStatus = () => {
            const current = Notification.permission;
            setStatus(current);
            if (current !== 'granted') {
                // Show prompt after a small delay if not granted
                const timer = setTimeout(() => setIsVisible(true), 2000);
                return () => clearTimeout(timer);
            } else {
                setIsVisible(false);
            }
        };

        checkStatus();
        
        // Listen for visibility changes (user might enable in settings then return)
        window.addEventListener('focus', checkStatus);
        return () => window.removeEventListener('focus', checkStatus);
    }, [user?.id]);

    const handleRequest = async () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'denied') {
                alert("As notificações estão bloqueadas no teu browser. Para as ativares, tens de ir às definições do browser (ou definições do site) e permitir manualmente.");
                return;
            }
        }
        
        await requestNotificationPermission();
        
        if (typeof window !== 'undefined' && 'Notification' in window) {
            const current = Notification.permission;
            setStatus(current);
            if (current === 'granted') {
                setIsVisible(false);
            } else if (current === 'denied') {
                alert("As notificações não foram permitidas.");
            }
        }
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-primary/10 border-b border-primary/20 overflow-hidden shrink-0"
                >
                    <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                                <Bell className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-main">Ativar Notificações</h4>
                                <p className="text-xs text-muted leading-tight">
                                    Recebe alertas de novos planos, mensagens e atualizações.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleRequest}
                                className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg active:scale-95 transition-transform"
                            >
                                Ativar
                            </button>
                            <button 
                                onClick={() => setIsVisible(false)}
                                className="p-2 text-muted hover:text-main"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};


import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check, MessageSquare, AlertTriangle, User, History } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAlerts?: () => void;
}

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({ isOpen, onClose, onNavigateToAlerts }) => {
  const { alerts, markAlertAsRead, markAllAlertsAsRead } = useApp();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'URGENT':
      case 'WARNING':
        return <AlertTriangle size={18} className="text-red-500" />;
      case 'INFO':
        return <MessageSquare size={18} className="text-blue-500" />;
      case 'SUCCESS':
        return <Check size={18} className="text-green-500" />;
      default:
        return <Bell size={18} className="text-primary" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute top-16 right-0 w-96 mr-6 z-[100]">
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-[#141414]/10 dark:border-white/10 overflow-hidden"
          >
            <div className="p-4 border-b border-[#141414]/5 dark:border-white/5 flex items-center justify-between bg-[#141414]/5 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Notificações</h3>
                {alerts.length > 0 && (
                  <span className="bg-primary text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {alerts.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {alerts.length > 0 && (
                  <button 
                    onClick={() => {
                        markAllAlertsAsRead();
                        onClose();
                    }}
                    className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tight"
                  >
                    Marcar todas como lidas
                  </button>
                )}
                <button onClick={onClose} className="p-1 hover:bg-[#141414]/5 dark:hover:bg-white/5 rounded-full transition-colors">
                  <X size={16} className="text-muted" />
                </button>
              </div>
            </div>

            <div className="max-h-[450px] overflow-y-auto scrollbar-hide py-2">
              {alerts.length === 0 ? (
                <div className="py-12 px-6 text-center space-y-3">
                  <div className="w-16 h-16 bg-[#141414]/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto opacity-50">
                    <Check size={32} className="text-muted" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#141414]/80 dark:text-white/80">Estás em dia!</h4>
                    <p className="text-xs text-muted">Não tens notificações pendentes de momento.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {alerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => markAlertAsRead(alert.id)}
                      className="w-full p-4 flex gap-4 text-left hover:bg-[#141414]/5 dark:hover:bg-white/5 transition-all border-b border-[#141414]/5 dark:border-white/5 group relative"
                    >
                      <div className="relative shrink-0">
                        {alert.studentAvatar ? (
                          <img 
                            src={alert.studentAvatar} 
                            alt={alert.studentName} 
                            className="w-10 h-10 rounded-xl object-cover border border-[#141414]/10 shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-[#141414]/5 dark:bg-white/5 flex items-center justify-center">
                            <User size={20} className="text-muted" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#111827] p-0.5 rounded-full shadow-sm">
                          {getIcon(alert.type || '')}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h4 className="font-bold text-xs text-[#141414] dark:text-white truncate">
                            {alert.studentName}
                          </h4>
                          <span className="text-[9px] font-medium text-muted shrink-0 tabular-nums uppercase">
                            {alert.date}
                          </span>
                        </div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">
                          {alert.title}
                        </p>
                        <p className="text-[11px] text-muted leading-relaxed line-clamp-2 italic">
                          {alert.message}
                        </p>
                      </div>

                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <X size={12} className="text-muted hover:text-red-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-[#141414]/5 dark:bg-white/5 border-t border-[#141414]/5 dark:border-white/5 text-center">
              <button 
                onClick={() => {
                    onNavigateToAlerts?.();
                    onClose();
                }}
                className="text-[10px] font-black text-muted uppercase tracking-widest hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                <History size={12} />
                Histórico de Alertas
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

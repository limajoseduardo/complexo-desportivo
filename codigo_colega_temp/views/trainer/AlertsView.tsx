
import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { AlertType, Screen, SmartAlert, UserRole } from '../../types';

interface AlertsViewProps {
  onBack: () => void;
}

export default function AlertsView({ onBack }: AlertsViewProps) {
  const { alerts, markAlertAsRead, markAllAlertsAsRead, selectStudentForProgress, setScreen, refreshAlerts, user } = useApp();
  const [filter, setFilter] = useState<AlertType | 'ALL'>('ALL');

  useEffect(() => {
      refreshAlerts();
  }, []);

  const getIcon = (alert: SmartAlert) => {
    if (alert.id.startsWith('no-workout-')) return 'assignment_late';
    switch (alert.type) {
      case 'WARNING': return 'warning';
      case 'SUCCESS': return 'emoji_events';
      case 'URGENT': return 'medical_services';
      case 'INFO': return 'info';
      default: return 'notifications';
    }
  };

  const getColors = (type: AlertType) => {
    switch (type) {
      case 'WARNING': return { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' };
      case 'SUCCESS': return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' };
      case 'URGENT': return { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' };
      case 'INFO': return { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' };
      default: return { bg: 'bg-zinc-500/10', text: 'text-muted', border: 'border-zinc-500/30' };
    }
  };

  const filteredAlerts = filter === 'ALL' 
    ? alerts 
    : alerts.filter(a => a.type === filter);

  const hasUnread = alerts.some(a => !a.read);
  const isStudent = user?.role === UserRole.STUDENT;
  const isDesktopAdmin = window.location.pathname.includes('/ptadmin');

  const handleAlertClick = (alert: SmartAlert) => {
      // 2. Action based on role
      if (isStudent) {
          markAlertAsRead(alert.id);
          if (alert.title === 'Nova Mensagem') {
              setScreen(Screen.CHAT_LIST); 
          } else if (alert.title.includes('Treino')) {
              setScreen(Screen.WORKOUT_PLAN);
          } else if (alert.title.includes('Dieta')) {
              setScreen(Screen.DIET_PLAN);
          } else if (alert.title.includes('Peso')) {
              setScreen(Screen.STUDENT_DASHBOARD); 
          }
      } else {
          // For Trainer: Select Student first
          selectStudentForProgress(alert.studentId, alert.studentName, alert.studentAvatar);
          markAlertAsRead(alert.id);
          
          if (alert.title.includes('Dieta')) {
             setScreen(Screen.TRAINER_EDIT_DIET);
          } else {
             setScreen(Screen.TRAINER_STUDENT_DETAIL);
          }
      }
  };

  const handleMarkAsRead = (e: React.MouseEvent, alertId: string) => {
      e.stopPropagation();
      markAlertAsRead(alertId);
  };

  return (
    <div className={`flex flex-col h-full bg-background ${isDesktopAdmin ? '' : ''}`}>
      {!isDesktopAdmin && (
        <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur-sm border-b border-main/5">
          <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg font-bold text-main">{isStudent ? 'Notificações' : 'Alertas Inteligentes'}</h1>
          <button 
              onClick={markAllAlertsAsRead}
              disabled={!hasUnread}
              title="Marcar todos como lidos"
              className={`h-10 w-10 flex items-center justify-center rounded-full transition-colors ${hasUnread ? 'hover:bg-main/10 text-main cursor-pointer' : 'text-zinc-600 cursor-not-allowed'}`}
          >
            <span className="material-symbols-outlined">done_all</span>
          </button>
        </header>
      )}

      <main className={`flex-1 p-4 overflow-y-auto space-y-6 ${isDesktopAdmin ? 'pt-8' : ''} pb-24`}>
        {isDesktopAdmin && (
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Alertas Inteligentes</h2>
              <button 
                  onClick={markAllAlertsAsRead}
                  disabled={!hasUnread}
                  className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${hasUnread ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer' : 'bg-main/5 text-muted cursor-not-allowed'}`}
              >
                <span className="material-symbols-outlined text-lg">done_all</span>
                Marcar tudo como lido
              </button>
           </div>
        )}
        {/* Filter Dropdown - Only show for Trainer */}
        {!isStudent && (
            <div className="relative">
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as AlertType | 'ALL')}
                    className="w-full bg-surface text-main font-bold rounded-xl px-4 py-4 border border-primary outline-none focus:border-primary appearance-none cursor-pointer transition-all shadow-sm text-sm"
                >
                    <option value="ALL">Todas as Categorias</option>
                    <option value="URGENT">🚨 Urgentes</option>
                    <option value="WARNING">⚠️ Atenção</option>
                    <option value="SUCCESS">🏆 Sucesso</option>
                    <option value="INFO">ℹ️ Informativo</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">expand_more</span>
                </div>
            </div>
        )}

        <div className={isDesktopAdmin ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {filteredAlerts.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-20 text-muted ${isDesktopAdmin ? 'col-span-full' : ''}`}>
               <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_off</span>
               <p className="font-bold text-main">Nenhuma notificação.</p>
               <p className="text-sm">Está tudo tranquilo por aqui.</p>
            </div>
          ) : (
            filteredAlerts.map(alert => {
              const colors = getColors(alert.type);
              return (
                <div 
                  key={alert.id} 
                  onClick={() => handleAlertClick(alert)}
                  className={`bg-surface border transition-all relative overflow-hidden cursor-pointer hover:brightness-110 active:scale-[0.98] duration-200 shadow-sm hover:shadow-md group ${alert.read ? 'opacity-70 border-main/5' : 'border-main/10'} ${isDesktopAdmin ? 'rounded-3xl p-6' : 'rounded-2xl p-5'}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon Box */}
                    <div className={`${isDesktopAdmin ? 'h-14 w-14' : 'h-12 w-12'} rounded-2xl flex items-center justify-center flex-shrink-0 ${colors.bg} ${colors.text} border ${colors.border}`}>
                      <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">{getIcon(alert)}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Header Row */}
                      <div className="flex justify-between items-start mb-1">
                        <h3 className={`font-black text-main leading-tight pr-2 break-words ${isDesktopAdmin ? 'text-lg' : 'text-base'}`}>{alert.title}</h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-muted font-bold tracking-wider uppercase">{alert.date}</span>
                            <button 
                                onClick={(e) => handleMarkAsRead(e, alert.id)}
                                className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${alert.read ? 'text-zinc-500 bg-main/5 hover:bg-main/10' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
                            >
                                <span className="material-symbols-outlined text-[18px]">check</span>
                            </button>
                        </div>
                      </div>
                      
                      {/* Message Body */}
                      <p className={`text-muted-foreground leading-snug mb-5 font-medium ${isDesktopAdmin ? 'text-[15px]' : 'text-sm'}`}>
                        {alert.message}
                      </p>
                      
                      {/* Divider */}
                      <div className="h-px w-full bg-main/5 mb-4"></div>

                      {/* Footer: Context Info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`rounded-full flex items-center justify-center overflow-hidden border border-main/10 ${
                                (!alert.studentAvatar || !alert.studentAvatar.startsWith('http')) && alert.studentName !== 'Lembrete' 
                                ? 'bg-primary text-background font-bold shadow-sm' 
                                : 'bg-surface text-muted'
                            } ${isDesktopAdmin ? 'h-12 w-12' : 'h-10 w-10'}`}>
                                {alert.studentAvatar && alert.studentAvatar.startsWith('http') ? (
                                    <img src={alert.studentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : alert.studentName === 'Lembrete' ? (
                                    <span className="material-symbols-outlined text-muted text-xl">scale</span>
                                ) : (
                                    <span className={`uppercase font-black ${isDesktopAdmin ? 'text-sm' : 'text-xs'}`}>
                                        {alert.studentName?.substring(0, 2).toUpperCase() || '??'}
                                    </span>
                                )}
                            </div>
                            <span className="text-sm font-black text-main">{alert.studentName}</span>
                        </div>
                        <span className="material-symbols-outlined text-muted text-lg group-hover:text-primary transition-colors">chevron_right</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

          </div>
  );
}

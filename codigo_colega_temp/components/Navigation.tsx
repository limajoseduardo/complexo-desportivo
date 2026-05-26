import React from 'react';
import { Screen } from '../types';
import { useApp } from '../contexts/AppContext';

interface NavigationProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  role: 'STUDENT' | 'TRAINER';
}

export const Navigation: React.FC<NavigationProps> = ({ activeScreen, onNavigate, role: propRole }) => {
  const { openTrainerChat, chats, activeRole } = useApp();
  const role = activeRole || propRole;

  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-[100] bg-surface/95 backdrop-blur-md border-t border-main/5"
    >
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-around px-2 py-2">
        <button 
          onClick={() => onNavigate(role === 'STUDENT' ? Screen.STUDENT_DASHBOARD : Screen.TRAINER_DASHBOARD)}
          className={`flex flex-col items-center justify-center px-1 py-0.5 gap-0.5 transition-all active:scale-95 ${activeScreen.includes('DASHBOARD') ? 'text-primary' : 'text-muted'}`}
        >
          <span className="material-symbols-outlined !text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {role === 'STUDENT' ? 'home' : 'dashboard'}
          </span>
          <span className="text-[10px] font-bold tracking-tight">{role === 'STUDENT' ? 'Início' : 'Dash'}</span>
        </button>

        {role === 'STUDENT' ? (
          <>
            <button 
              onClick={() => onNavigate(Screen.WORKOUT_PLAN)}
              className={`flex flex-col items-center justify-center px-1 py-0.5 gap-0.5 transition-all active:scale-95 ${activeScreen === Screen.WORKOUT_PLAN ? 'text-primary' : 'text-muted'}`}
            >
              <span className="material-symbols-outlined !text-[24px]">fitness_center</span>
              <span className="text-[10px] font-bold tracking-tight">Treinos</span>
            </button>
            <button 
              onClick={() => onNavigate(Screen.DIET_PLAN)}
              className={`flex flex-col items-center justify-center px-1 py-0.5 gap-0.5 transition-all active:scale-95 ${activeScreen === Screen.DIET_PLAN ? 'text-primary' : 'text-muted'}`}
            >
              <span className="material-symbols-outlined !text-[24px]">restaurant</span>
              <span className="text-[10px] font-bold tracking-tight">Dieta</span>
            </button>
          </>
        ) : (
          <button 
            onClick={() => onNavigate(Screen.STUDENT_LIST)}
            className={`flex flex-col items-center justify-center px-1 py-0.5 gap-0.5 transition-all active:scale-95 ${activeScreen === Screen.STUDENT_LIST ? 'text-primary' : 'text-muted'}`}
          >
            <span className="material-symbols-outlined !text-[24px]">group</span>
            <span className="text-[10px] font-bold tracking-tight">Alunos</span>
          </button>
        )}

        <button 
          onClick={() => onNavigate(Screen.CHAT_LIST)}
          className={`flex flex-col items-center justify-center px-1 py-0.5 gap-0.5 transition-all active:scale-95 ${activeScreen === Screen.CHAT_LIST || activeScreen === Screen.CHAT_DETAIL ? 'text-primary' : 'text-muted'}`}
        >
          <div className="relative">
            <span className="material-symbols-outlined !text-[24px]">chat</span>
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse"></span>
            )}
          </div>
          <span className="text-[10px] font-bold tracking-tight">Chat</span>
        </button>

        <button 
          onClick={() => onNavigate(Screen.PROFILE)}
          className={`flex flex-col items-center justify-center px-1 py-0.5 gap-0.5 transition-all active:scale-95 ${activeScreen === Screen.PROFILE ? 'text-primary' : 'text-muted'}`}
        >
          <span className="material-symbols-outlined !text-[24px]">person</span>
          <span className="text-[10px] font-bold tracking-tight">Perfil</span>
        </button>
      </div>
      </div>
    </nav>
  );
};
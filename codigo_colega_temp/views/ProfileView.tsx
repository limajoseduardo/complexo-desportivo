
import React from 'react';
import { useApp } from '../contexts/AppContext';
import { Screen, UserRole } from '../types';

// Reusable component for profile list items
const ListItem = ({ icon, title, onClick, colorClass = 'text-main', disabled = false }: { icon: string, title: string, onClick: () => void, colorClass?: string, disabled?: boolean }) => (
    <button 
      onClick={disabled ? undefined : onClick} 
      disabled={disabled}
      className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors text-left ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-surface active:scale-[0.98] cursor-pointer'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`h-10 w-10 rounded-lg bg-surface flex items-center justify-center border border-main/5 ${disabled ? 'text-muted' : 'text-primary'}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <span className={`font-bold text-sm ${disabled ? 'text-muted' : colorClass}`}>{title}</span>
      </div>
      {!disabled && <span className="material-symbols-outlined text-zinc-600 text-lg">chevron_right</span>}
    </button>
);

export default function ProfileView() {
  const { user, setScreen, logout, activeRole, theme, toggleTheme } = useApp();

  if (!user) return null;

  const isStudent = activeRole === UserRole.STUDENT;
  const roleLabel = isStudent ? 'ALUNO' : 'PERSONAL TRAINER';
  const roleColor = isStudent ? 'bg-surface text-muted border border-main/10' : 'bg-primary text-background';

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex-none sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm flex items-center gap-3 animate-enter">
        <button 
          onClick={() => setScreen(isStudent ? Screen.STUDENT_DASHBOARD : Screen.TRAINER_DASHBOARD)} 
          className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-main">Perfil e Configurações</h1>
      </header>

      <main className="flex-1 px-4 pb-4 space-y-8 overflow-y-auto min-h-0 pb-24">
        {/* Profile Pic & Info */}
        <div className="flex flex-col items-center pt-2 pb-2 animate-enter delay-100">
          <div className="relative mb-3 group">
            <div 
              className="h-28 w-28 rounded-full bg-cover bg-center border-4 border-surface shadow-2xl animate-scale" 
              style={{ backgroundImage: `url('${user.avatar}')` }}
            ></div>
            <button 
              onClick={() => setScreen(Screen.PROFILE_EDIT)}
              className="absolute bottom-0 right-0 bg-primary text-background h-8 w-8 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg border-2 border-background"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
          </div>
          <h2 className="text-xl font-bold text-main">{user.name}</h2>
          <p className="text-muted text-sm mb-2">{user.email}</p>
          
          <div className="flex items-center gap-2 mb-3">
             <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${roleColor}`}>
                {roleLabel}
             </span>
          </div>

          {/* BIO STATS ROW (Height/Weight/Goal) */}
          <div className="flex flex-col gap-4 animate-enter delay-200">
              <div className="flex gap-4 bg-surface p-2 rounded-xl border border-main/5 shadow-sm justify-center">
                  <div className="flex flex-col items-center px-4">
                      <span className="text-[10px] text-muted uppercase font-bold">Altura</span>
                      <span className="text-sm font-bold text-main">
                          {user.height ? (user.height < 3 ? `${user.height}m` : `${user.height}cm`) : '--'}
                      </span>
                  </div>
                  <div className="w-px h-8 bg-main/10"></div>
                  <div className="flex flex-col items-center px-4">
                      <span className="text-[10px] text-muted uppercase font-bold">Peso</span>
                      <span className="text-sm font-bold text-main">{user.weight ? `${user.weight}kg` : '--'}</span>
                  </div>
                  {user.goal && (
                    <>
                      <div className="w-px h-8 bg-main/10"></div>
                      <div className="flex flex-col items-center px-4">
                          <span className="text-[10px] text-muted uppercase font-bold">Meta</span>
                          <span className="text-sm font-bold text-primary truncate max-w-[80px]">{user.goal}</span>
                      </div>
                    </>
                  )}
              </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          
          {/* Account Section */}
          <section className="animate-enter delay-300">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-3 mb-2">Minha Conta</h3>
            <div className="bg-card rounded-xl border border-main/5 p-2 space-y-1 shadow-lg">
              <ListItem icon="person" title="Editar Dados Pessoais" onClick={() => setScreen(Screen.PROFILE_EDIT)} />
              <ListItem icon="workspace_premium" title="Gerir Subscrição" onClick={() => setScreen(Screen.SUBSCRIPTION)} disabled={true} />
              <ListItem icon="lock" title="Segurança e Senha" onClick={() => setScreen(Screen.PROFILE_SECURITY)} />
            </div>
          </section>

          {/* Preferences Section */}
          <section className="animate-enter delay-400">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-3 mb-2">Preferências</h3>
            <div className="bg-card rounded-xl border border-main/5 p-2 space-y-1 shadow-lg">
              <div className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface transition-colors cursor-pointer text-left active:scale-[0.98]" onClick={toggleTheme}>
                 <div className="flex items-center gap-4">
                   <div className="h-10 w-10 rounded-lg bg-surface flex items-center justify-center text-primary border border-main/5">
                     <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                   </div>
                   <span className="font-bold text-sm text-main">Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                 </div>
                 <div className="w-10 h-6 bg-main/10 rounded-full relative transition-colors shadow-inner flex items-center">
                    <div className={`w-5 h-5 bg-primary rounded-full absolute transition-all shadow-md ${theme === 'dark' ? 'left-4' : 'left-1'}`}></div>
                 </div>
              </div>
              <ListItem icon="notifications" title="Notificações" onClick={() => setScreen(Screen.PROFILE_NOTIFICATIONS)} />
            </div>
          </section>
          
          {/* Support Section */}
          <section className="animate-enter delay-500">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-3 mb-2">Suporte</h3>
            <div className="bg-card rounded-xl border border-main/5 p-2 space-y-1 shadow-lg">
              <ListItem icon="help" title="Ajuda e FAQ" onClick={() => setScreen(Screen.PROFILE_HELP)} />
            </div>
          </section>

          {/* Logout */}
          <div className="p-2 animate-enter delay-500">
            <ListItem icon="logout" title="Sair" onClick={logout} colorClass="text-red-400" />
          </div>
        </div>
      </main>

            
    </div>
  );
}

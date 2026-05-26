
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Calendar, 
  MessageSquare, 
  TrendingUp, 
  Bell, 
  Settings, 
  LogOut, 
  LayoutDashboard,
  Dumbbell,
  Apple,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus
} from 'lucide-react';
import { useApp } from '../../../contexts/AppContext';
import { NotificationPopover } from '../../../components/NotificationPopover';
import { Screen, UserRole } from '../../../types';

interface DesktopTrainerLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const DesktopTrainerLayout: React.FC<DesktopTrainerLayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange 
}) => {
  const { user, logout, theme, toggleTheme, alerts } = useApp();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Alunos', icon: Users },
    { id: 'templates', label: 'Banco de Treinos', icon: FileText },
    { id: 'exercises', label: 'Banco de Exercícios', icon: Dumbbell },
    { id: 'foods', label: 'Banco de Alimentos', icon: Apple },
    { id: 'messages', label: 'Mensagens', icon: MessageSquare },
    { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
    { id: 'bugs', label: 'Erros Reportados', icon: AlertTriangle },
  ];

  return (
    <div className={`flex h-screen bg-[#E4E3E0] dark:bg-[#0a0f1e] text-[#141414] dark:text-white font-sans overflow-hidden transition-colors duration-200`}>
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 280 }}
        className="h-full border-r border-[#141414]/10 dark:border-white/10 flex flex-col bg-white dark:bg-[#111827] relative z-20 shadow-xl"
      >
        <div className="p-6 flex items-center justify-between border-b border-[#141414]/10 dark:border-white/10">
          {!isSidebarCollapsed && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <img src="/icon-192x192.png" alt="Logo" className="w-10 h-10 object-contain" />
              <span className="font-bold text-xl tracking-tight">FitVLR</span>
            </motion.div>
          )}
          {isSidebarCollapsed && (
            <div className="w-full flex justify-center">
                 <img src="/icon-192x192.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                : 'hover:bg-[#141414]/5 dark:hover:bg-white/5 text-[#141414]/60 dark:text-white/60 hover:text-[#141414] dark:hover:text-white'
              }`}
            >
              <item.icon size={22} className={activeTab === item.id ? 'stroke-[3px]' : 'stroke-2'} />
              {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
              {activeTab === item.id && !isSidebarCollapsed && (
                 <motion.div layoutId="active-indicator" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#141414]/10 dark:border-white/10 space-y-2">
           <button 
             type="button"
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#141414]/5 dark:hover:bg-white/5 text-[#141414]/60 dark:text-white/60 transition-colors"
           >
             <Settings size={22} />
             {!isSidebarCollapsed && <span className="font-medium text-sm">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>}
           </button>
          
          <button 
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors"
          >
            <LogOut size={22} />
            {!isSidebarCollapsed && <span className="font-medium text-sm">Sair da Conta</span>}
          </button>

          <div className="mt-4 flex items-center gap-3 px-2">
            <img 
              src={user?.avatar || 'https://ui-avatars.com/api/?name=Trainer'} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full border border-primary/20 object-cover shadow-md"
            />
            {!isSidebarCollapsed && (
               <div className="flex flex-col truncate">
                 <span className="text-sm font-semibold truncate">{user?.name}</span>
                 <span className="text-[10px] uppercase tracking-wider opacity-50">Trainer Elite</span>
               </div>
            )}
          </div>
        </div>

        <button 
          type="button"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute top-1/2 -right-3 w-6 h-6 bg-white dark:bg-[#111827] border border-[#141414]/20 dark:border-white/20 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-lg"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#F1F5FF] dark:bg-[#0a0f1e]/50">
        <header className="h-16 px-8 flex items-center justify-between border-b border-[#141414]/5 dark:border-white/5 bg-white/50 dark:bg-[#111827]/50 backdrop-blur-md z-10">
          <h2 className="text-xl font-bold tracking-tight">
            {menuItems.find(i => i.id === activeTab)?.label}
          </h2>
          
          <div className="flex items-center gap-6 relative">
            <button 
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative p-2 rounded-full hover:bg-[#141414]/5 dark:hover:bg-white/5 transition-colors"
            >
              <Bell size={20} className={isNotificationOpen ? 'text-primary' : 'text-muted'} />
              {alerts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-[#0a0f1e] animate-pulse"></span>
              )}
            </button>
            <NotificationPopover 
              isOpen={isNotificationOpen} 
              onClose={() => setIsNotificationOpen(false)} 
              onNavigateToAlerts={() => onTabChange('alerts')}
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
           {children}
        </div>
      </main>
    </div>
  );
};

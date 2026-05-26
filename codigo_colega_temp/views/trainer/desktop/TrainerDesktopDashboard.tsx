
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  TrendingUp, 
  Activity, 
  CheckCircle2, 
  Clock, 
  MessageSquare,
  ChevronRight,
  Plus,
  ArrowUpRight,
  Calendar,
  Search,
  Dumbbell,
  AlertTriangle,
  LayoutDashboard
} from 'lucide-react';
import { useApp } from '../../../contexts/AppContext';
import { supabase } from '../../../lib/supabaseClient';
import { DesktopTrainerLayout } from './TrainerDesktopLayout';
import DesktopStudentListView from './DesktopStudentListView';
import DesktopStudentDetailView from './DesktopStudentDetailView';
import WorkoutTemplatesView from '../WorkoutTemplatesView';
import ExerciseBankView from '../ExerciseBankView';
import FoodBankView from '../FoodBankView';
import AlertsView from '../AlertsView';
import BugReportsView from '../BugReportsView';
import TrainerEditTemplateView from '../TrainerEditTemplateView';
import ChatListView from '../../ChatListView';
import ChatDetailView from '../../ChatDetailView';
import { Screen, UserRole } from '../../../types';

export default function TrainerDesktopDashboard() {
  const { 
    user, 
    chats, 
    alerts, 
    currentScreen: screen, 
    setScreen, 
    clearViewingStudent, 
    viewingStudent, 
    selectedChatId, 
    selectChat 
  } = useApp();
  const [activeTab, setActiveTab] = useState(() => {
    if (selectedChatId) return 'messages';
    if (viewingStudent) return 'students-detail';
    return 'dashboard';
  });
  const [counts, setCounts] = useState({ students: 0, workouts: 0 });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  
  useEffect(() => {
    if (user?.id && user?.role === 'TRAINER') {
      const fetchDashboardData = async () => {
        try {
          // Fetch student and workout counts
          const [studentsRes, workoutsRes] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'STUDENT').eq('trainer_id', user.id),
            supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('trainer_id', user.id).eq('completed', true)
          ]);
          
          setCounts({
            students: studentsRes.count || 0,
            workouts: workoutsRes.count || 0
          });

          // Fetch different types of recent activities
          const [workoutActivities, weightActivities, reportActivities] = await Promise.all([
            // 1. Completed workouts
            supabase.from('workouts')
              .select('id, title, completed_at, assigned_student_id, profiles!assigned_student_id(name, avatar)')
              .eq('trainer_id', user.id)
              .eq('completed', true)
              .order('completed_at', { ascending: false })
              .limit(10),
            
            // 2. Recent weight entries - Filter by joined profile
            supabase.from('weight_history')
              .select('id, weight, date, user_id, profiles!inner(name, avatar, trainer_id)')
              .eq('profiles.trainer_id', user.id)
              .order('date', { ascending: false })
              .limit(10),
              
            // 3. New student reports/alerts
            supabase.from('student_reports')
              .select('id, title, created_at, student_id, profiles!inner(name, avatar, trainer_id)')
              .eq('profiles.trainer_id', user.id)
              .order('created_at', { ascending: false })
              .limit(10)
          ]);

          // Combine and transform activities
          const combined: any[] = [];
          
          if (workoutActivities.data) {
            workoutActivities.data.forEach((w: any) => {
              combined.push({
                id: `workout-${w.id}`,
                type: 'workout',
                studentName: w.profiles?.name || 'Aluno',
                studentAvatar: w.profiles?.avatar,
                title: `concluiu o ${w.title || 'Treino'}`,
                date: w.completed_at,
                timestamp: new Date(w.completed_at).getTime(),
                studentId: w.assigned_student_id
              });
            });
          }

          if (weightActivities.data) {
            weightActivities.data.forEach((w: any) => {
              combined.push({
                id: `weight-${w.id}`,
                type: 'weight',
                studentName: w.profiles?.name || 'Aluno',
                studentAvatar: w.profiles?.avatar,
                title: `registou o peso: ${w.weight}kg`,
                date: w.date,
                timestamp: new Date(w.date).getTime(),
                studentId: w.user_id
              });
            });
          }

          if (reportActivities.data) {
            reportActivities.data.forEach((r: any) => {
              combined.push({
                id: `report-${r.id}`,
                type: 'report',
                studentName: r.profiles?.name || 'Aluno',
                studentAvatar: r.profiles?.avatar,
                title: `enviou um alerta: ${r.title}`,
                date: r.created_at,
                timestamp: new Date(r.created_at).getTime(),
                studentId: r.student_id
              });
            });
          }

          // Sort combined activities by timestamp DESC
          setRecentActivities(combined.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8));
          
        } catch (e) {
          console.error("Error fetching dashboard data:", e);
        }
      };
      fetchDashboardData();
    }
  }, [user?.id]);
  
  const lastViewedStudentId = useRef<string | null>(null);
  const lastSelectedChatId = useRef<string | null>(null);

  const handleTabChange = (tab: string) => {
    if (tab === 'students') clearViewingStudent();
    if (tab !== 'messages') selectChat('');
    if (screen !== Screen.TRAINER_DESKTOP_ADMIN) setScreen(Screen.TRAINER_DESKTOP_ADMIN);
    setActiveTab(tab);
  };

  // Consolidated navigation trigger for desktop
  useEffect(() => {
    // 1. Detect Chat Selection
    if (selectedChatId && selectedChatId !== lastSelectedChatId.current) {
      setActiveTab('messages');
      lastSelectedChatId.current = selectedChatId;
    } else if (!selectedChatId) {
      lastSelectedChatId.current = null;
    }

    // 2. Detect Student Selection
    if (viewingStudent && viewingStudent.id !== lastViewedStudentId.current) {
      setActiveTab('students-detail');
      lastViewedStudentId.current = viewingStudent.id;
      
      // If we are navigating to profile from a chat, clear the selected chat
      if (selectedChatId) {
        selectChat('');
      }
    } else if (!viewingStudent) {
      lastViewedStudentId.current = null;
    }
  }, [selectedChatId, viewingStudent, screen]);

  const renderContent = () => {
    if (screen === Screen.TRAINER_EDIT_TEMPLATE) {
      return (
        <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-xl shadow-black/5 overflow-hidden border border-black/5 dark:border-white/5 h-full flex flex-col">
          <TrainerEditTemplateView onBack={() => {
            setScreen(Screen.TRAINER_DESKTOP_ADMIN);
            setActiveTab('templates');
          }} />
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview counts={counts} recentActivities={recentActivities} onNavigate={setActiveTab} onSelectChat={selectChat} />;
      case 'students':
        return (
          <div className="h-full flex flex-col">
            <DesktopStudentListView />
          </div>
        );
      case 'students-detail':
        return (
          <div className="h-full flex flex-col">
             <DesktopStudentDetailView onBack={() => { clearViewingStudent(); setActiveTab('students'); }} />
          </div>
        );
      case 'templates':
        return (
           <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-xl shadow-black/5 overflow-hidden border border-black/5 dark:border-white/5 h-full flex flex-col">
             <WorkoutTemplatesView onBack={() => setActiveTab('dashboard')} />
           </div>
        );
      case 'exercises':
        return (
          <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-xl shadow-black/5 overflow-hidden border border-black/5 dark:border-white/5 h-full flex flex-col">
             <ExerciseBankView onBack={() => setActiveTab('dashboard')} />
          </div>
        );
      case 'foods':
        return (
          <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-xl shadow-black/5 overflow-hidden border border-black/5 dark:border-white/5 h-full flex flex-col">
             <FoodBankView onBack={() => setActiveTab('dashboard')} />
          </div>
        );
      case 'messages':
        return (
          <div className="h-full flex overflow-hidden bg-white dark:bg-[#111827] rounded-3xl border border-black/5 dark:border-white/5">
            <div className={`border-r border-black/5 dark:border-white/5 ${selectedChatId ? 'w-[420px]' : 'w-full'} flex flex-col transition-all duration-300`}>
              <ChatListView onSelectChat={(id) => selectChat(id)} onBack={() => setActiveTab('dashboard')} />
            </div>
            
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <AnimatePresence mode="wait">
                {selectedChatId ? (
                  <motion.div
                    key={selectedChatId}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute inset-0 flex flex-col"
                  >
                    <ChatDetailView chatId={selectedChatId} onBack={() => selectChat('')} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center p-12 text-center"
                  >
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-6 ring-4 ring-primary/5">
                      <MessageSquare size={40} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Mensagens</h3>
                    <p className="text-muted max-w-xs mx-auto">Selecione uma conversa ao lado para começar a comunicar com os seus alunos.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      case 'alerts':
        return (
          <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-xl shadow-black/5 overflow-hidden border border-black/5 dark:border-white/5 h-full flex flex-col">
             <AlertsView onBack={() => setActiveTab('dashboard')} />
          </div>
        );
      case 'bugs':
        return (
           <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-xl shadow-black/5 overflow-hidden border border-black/5 dark:border-white/5 h-full flex flex-col">
             <BugReportsView onBack={() => setActiveTab('dashboard')} />
           </div>
        );
      default:
        return <DashboardOverview counts={counts} recentActivities={recentActivities} onNavigate={handleTabChange} onSelectChat={selectChat} />;
    }
  };

  return (
    <DesktopTrainerLayout activeTab={activeTab === 'students-detail' ? 'students' : activeTab} onTabChange={handleTabChange}>
      {renderContent()}
    </DesktopTrainerLayout>
  );
}

function DashboardOverview({ counts, recentActivities, onNavigate, onSelectChat }: { counts: { students: number, workouts: number }, recentActivities: any[], onNavigate: (tab: string) => void, onSelectChat: (chatId: string) => void }) {
  const { alerts, chats } = useApp();
  
  const stats = [
    { label: 'Alunos Ativos', value: counts.students.toString(), trend: 'Total na plataforma', icon: Users, color: 'bg-blue-500' },
    { label: 'Treinos Concluídos', value: counts.workouts.toString(), trend: 'Acumulado total', icon: CheckCircle2, color: 'bg-green-500' },
    { label: 'Novos Alertas', value: alerts.filter(a => !a.read).length.toString(), trend: 'Requer atenção', icon: Activity, color: 'bg-amber-500' },
    { label: 'Mensagens Pendentes', value: chats.reduce((acc, c) => acc + c.unreadCount, 0).toString(), trend: 'Não lidas', icon: MessageSquare, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-[#111827] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`${stat.color} p-3 rounded-2xl text-white shadow-lg`}>
                <stat.icon size={24} />
              </div>
              <ArrowUpRight size={20} className="text-muted group-hover:text-primary transition-colors" />
            </div>
            <div>
              <h4 className="text-muted text-xs font-mono uppercase tracking-widest mb-1">{stat.label}</h4>
              <div className="flex items-baseline gap-2">
                 <span className="text-3xl font-bold">{stat.value}</span>
                 <span className="text-[10px] font-semibold text-green-500">{stat.trend}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="hidden lg:block bg-white dark:bg-[#111827] rounded-3xl p-8 border border-black/5 dark:border-white/5 shadow-sm">
           <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="text-primary" size={20} />
                Atividade Recente
             </h3>
             <button onClick={() => onNavigate('students')} className="text-xs font-bold text-primary hover:underline">Ver Todos</button>
           </div>
           
           <div className="space-y-6">
               {recentActivities.length > 0 ? recentActivities.map((activity) => (
                 <div key={activity.id} className="flex items-center gap-4 group cursor-pointer p-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 text-xs">
                      {activity.studentAvatar ? (
                        <img src={activity.studentAvatar} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        activity.studentName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'JD'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm truncate">
                         <span className="font-bold">{activity.studentName}</span>{' '}
                         <span className="text-muted">{activity.title}</span>
                       </p>
                       <p className="text-[10px] text-muted font-mono uppercase tracking-wider">
                         {new Date(activity.date).toLocaleDateString('pt-PT', { 
                           day: '2-digit', 
                           month: '2-digit',
                           hour: '2-digit', 
                           minute: '2-digit' 
                         })}
                       </p>
                    </div>
                    <div className={`p-2 rounded-xl scale-90 ${
                       activity.type === 'workout' ? 'bg-green-500/10 text-green-500' :
                       activity.type === 'weight' ? 'bg-blue-500/10 text-blue-500' :
                       'bg-amber-500/10 text-amber-500'
                    }`}>
                       {activity.type === 'workout' && <Dumbbell size={16} />}
                       {activity.type === 'weight' && <TrendingUp size={16} />}
                       {activity.type === 'report' && <AlertTriangle size={16} />}
                    </div>
                    <ChevronRight size={18} className="text-muted opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                 </div>
               )) : (
                  <p className="text-center text-muted italic">Nenhuma atividade recente.</p>
               )}
           </div>
        </div>

        {/* Quick Contacts */}
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-8 border border-black/5 dark:border-white/5 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="text-primary" size={20} />
                Mensagens Recentes
              </h3>
              <button onClick={() => onNavigate('messages')} className="text-xs font-bold text-primary hover:underline font-mono">Ir para Inbox</button>
           </div>

           <div className="space-y-6">
              {chats.slice(0, 5).map((chat) => (
                <div key={chat.id} onClick={() => { onSelectChat(chat.id); onNavigate('messages'); }} className="flex items-center gap-4 group cursor-pointer p-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                   <div className="relative">
                     <img src={chat.participantAvatar} className="w-12 h-12 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
                     {chat.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#111827] rounded-full animate-pulse" />}
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-bold text-sm">{chat.participantName}</span>
                        <span className="text-[10px] text-muted font-mono">{chat.lastMessageTime}</span>
                      </div>
                      <p className="text-xs text-muted truncate max-w-[250px]">{chat.lastMessage}</p>
                   </div>
                   {chat.unreadCount > 0 && (
                     <div className="min-w-[20px] h-5 px-1.5 bg-primary rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-primary/20">
                       {chat.unreadCount}
                     </div>
                   )}
                </div>
              ))}
              {chats.length === 0 && (
                <div className="text-center py-12 opacity-50 italic text-sm">
                   Nenhuma conversa ativa no momento.
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden group">
            <div className="relative z-10">
               <h3 className="text-3xl font-bold mb-2">Novo no FitVLR?</h3>
               <p className="text-muted max-w-md mb-6">Comece por adicionar os seus exercícios favoritos e crie bases de treino para poupar tempo no futuro.</p>
               <div className="flex gap-4">
                  <button onClick={() => onNavigate('templates')} className="bg-primary text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
                    <Plus size={20} />
                    Criar Template
                  </button>
                  <button onClick={() => onNavigate('exercises')} className="bg-white/50 backdrop-blur dark:bg-white/10 px-8 py-3 rounded-2xl font-bold hover:bg-white transition-all">
                    Gerir Exercícios
                  </button>
               </div>
            </div>
            <Dumbbell size={200} className="absolute -right-10 -bottom-10 text-primary/5 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
         </div>

         <div className="bg-amber-500 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between">
             <div>
                <AlertTriangle size={32} className="mb-4" />
                <h3 className="text-xl font-bold mb-1">Alertas Inteligentes</h3>
                <p className="text-white/80 text-sm">Tens {alerts.filter(a => !a.read).length} notificações que requerem a tua atenção imediata.</p>
             </div>
             <button onClick={() => onNavigate('alerts')} className="mt-6 w-full bg-white text-amber-600 py-3 rounded-2xl font-bold shadow-lg hover:bg-amber-50 transition-colors">
               Ver Painel de Alertas
             </button>
         </div>
      </div>
    </div>
  );
}

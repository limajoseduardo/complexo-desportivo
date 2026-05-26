
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Screen, User, UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { triggerHaptic } from '../../lib/haptic';
import { TourGuide, TourStep } from '../../components/TourGuide';

interface TrainerDashboardProps {
  onNavigate: (screen: Screen) => void;
}

// Passos do Tour do Treinador
const TRAINER_TOUR_STEPS: TourStep[] = [
    {
        targetId: 'tour-stats',
        title: 'Painel de Controlo',
        content: 'Aqui tem uma visão rápida do número de alunos ativos e notificações pendentes.',
        position: 'bottom'
    },
    {
        targetId: 'tour-students-btn',
        title: 'Gestão de Alunos',
        content: 'Aceda à lista completa para prescrever treinos, dietas e acompanhar a evolução individual de cada aluno.',
        position: 'bottom'
    },
    {
        targetId: 'tour-exercise-btn',
        title: 'Banco de Exercícios',
        content: 'Crie e organize a sua biblioteca de exercícios personalizada para agilizar a criação de treinos.',
        position: 'bottom'
    },
    {
        targetId: 'tour-ranking-btn',
        title: 'Ranking dos Alunos',
        content: 'Acompanhe as tabelas de classificação (PRs e Assiduidade) e envie desafios diretos aos seus alunos para os motivar!',
        position: 'bottom'
    },
    {
        targetId: 'tour-food-btn',
        title: 'Banco de Alimentos',
        content: 'Gere a lista de alimentos disponíveis para facilitar a montagem dos planos alimentares.',
        position: 'bottom'
    },
    {
        targetId: 'tour-invite-btn',
        title: 'Adicionar Aluno',
        content: 'Gere códigos de convite únicos para que novos alunos se registem na tua equipa de forma segura.',
        position: 'top'
    },
    {
        targetId: 'tour-alerts',
        title: 'Central de Notificações',
        content: 'Fique atento aos feedbacks, mensagens urgentes e atualizações de peso dos seus alunos aqui.',
        position: 'top'
    }
];

export default function TrainerDashboard({ onNavigate }: TrainerDashboardProps) {
  const { user, alerts, generateAccessCode, selectStudentForProgress, refreshAlerts, updateUserProfile, switchRole } = useApp();
  const unreadAlerts = alerts.filter(a => !a.read).length;
  
  // State for Modals & Data
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [studentsList, setStudentsList] = useState<User[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [fetchError, setFetchError] = useState<boolean>(false);
  const [showInviteWarning, setShowInviteWarning] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);

  useEffect(() => {
    const fetchUnreadReports = async () => {
      try {
        const { count, error } = await supabase
          .from('student_reports')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'PENDING');
        
        if (error) {
          // If status column is missing, try a simpler count
          const { count: fallbackCount } = await supabase
            .from('student_reports')
            .select('*', { count: 'exact', head: true });
          if (fallbackCount !== null) setUnreadReportsCount(fallbackCount);
        } else if (count !== null) {
          setUnreadReportsCount(count);
        }
      } catch (e) {
        // Silently fail for dashboard
      }
    };
    
    fetchUnreadReports();
    
    // Subscribe to changes
    const reportsChannel = supabase
      .channel('reports_changes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'student_reports' }, () => {
        fetchUnreadReports();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(reportsChannel);
    };
  }, []);

  // Tour State
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Force refresh alerts on mount to sync with local storage
  useEffect(() => {
      refreshAlerts();
  }, []);

  // Logic to handle Tutorial Trigger
  useEffect(() => {
      // 1. Check if tutorial is forced (from Help menu)
      const forceTutorial = localStorage.getItem('force_tutorial');
      if (forceTutorial === 'true') {
          setIsTourOpen(true);
          localStorage.removeItem('force_tutorial');
          return;
      }

      // 2. Check if user has seen tour in DB
      if (user && user.hasSeenTour === false) {
          const timer = setTimeout(() => setIsTourOpen(true), 1000);
          return () => clearTimeout(timer);
      }
  }, [user]);

  const handleTourFinished = async () => {
      setIsTourOpen(false);
      try {
          await updateUserProfile({ hasSeenTour: true });
      } catch (e) {
          console.error("Failed to save tour status", e);
      }
  };

  // Fetch students when modal opens or component mounts
  useEffect(() => {
    const fetchStudents = async () => {
        setIsLoadingStudents(true);
        setFetchError(false);
        try {
            if (!user?.id) return;
            // Buscamos dados reais: Peso e Meta para o cálculo - filtrado por trainer_id
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, email, avatar, role, goal, weight, target_weight')
                .eq('role', 'STUDENT')
                .eq('trainer_id', user.id)
                .order('last_seen', { ascending: false }) // Ordena pelos mais ativos/recentes
                .limit(5); // Pega os top 5 para "Destaque"
            
            if (data) {
                // Mapear para garantir que os campos numéricos venham como números e camelCase
                const mappedUsers: User[] = data.map((p: any) => ({
                    ...p,
                    weight: p.weight ? Number(p.weight) : undefined,
                    targetWeight: p.target_weight ? Number(p.target_weight) : undefined
                }));
                setStudentsList(mappedUsers);
            } else if (error) {
                console.warn("Error fetching students for dashboard:", error);
                setFetchError(true);
            }
        } catch (e) {
            console.error("Erro ao buscar alunos", e);
            setFetchError(true);
        } finally {
            setIsLoadingStudents(false);
        }
    };

    fetchStudents();
  }, []);

  const handleGenerateCode = async () => {
    // Agora o generateAccessCode do Contexto já salva no banco
    const code = await generateAccessCode();
    if (code) {
        setGeneratedCode(code);
    } else {
        alert("Erro ao gerar código. Tente novamente.");
    }
  };

  const copyToClipboard = () => {
      if (generatedCode) {
          navigator.clipboard.writeText(generatedCode);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      }
  };

  // Lógica Real de Cálculo de Progresso
  // Baseada na proximidade do peso atual vs peso alvo
  const calculateRealProgress = (current?: number, target?: number) => {
      if (!current || !target || target === 0) return "0.0";
      
      const diff = Math.abs(current - target);
      const proximity = (1 - (diff / target)) * 10; 
      const visualScore = Math.max(0.1, Math.min(9.9, proximity));
      
      return visualScore.toFixed(1);
  };

  return (
    <div className="flex flex-col h-full relative">
      
      {/* INTERACTIVE TOUR GUIDE */}
      <TourGuide 
        isOpen={isTourOpen} 
        steps={TRAINER_TOUR_STEPS} 
        onClose={handleTourFinished} 
        onComplete={handleTourFinished} 
      />

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-sm p-4 border-b border-main/5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl">bar_chart</span>
          <h1 className="text-xl font-bold text-main">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
            <button 
              onClick={() => switchRole(UserRole.STUDENT)}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-surface border border-main/10 text-primary hover:bg-main/5 hover:text-main transition-all active:scale-95"
              title="Trocar para visão de aluno"
            >
                <span className="material-symbols-outlined text-xl">swap_horiz</span>
            </button>
            <div 
              onClick={() => onNavigate(Screen.PROFILE)}
              className="flex items-center gap-3 cursor-pointer group" 
            >
                <div className="text-right">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-wider leading-none mb-0.5 group-hover:text-primary transition-colors">Treinador</p>
                    <p className="text-xs font-bold text-main leading-none group-hover:text-primary transition-colors">{user?.name}</p>
                </div>
                <div 
                  className="h-10 w-10 rounded-full bg-cover bg-center border border-main/10 group-hover:scale-105 group-hover:border-primary/50 transition-all" 
                  style={{ backgroundImage: `url('${user?.avatar}')` }}
                ></div>
            </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 overflow-y-auto pb-24">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
           <button 
             id="tour-students-btn" // TOUR TARGET
             onClick={() => {
                triggerHaptic('light');
                onNavigate(Screen.STUDENT_LIST);
             }}
             className="col-span-2 bg-primary text-background p-4 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
           >
             <span className="material-symbols-outlined text-3xl">groups</span>
             <span className="font-bold text-lg">Gerir Alunos</span>
           </button>
           
           <button 
             id="tour-exercise-btn" // TOUR TARGET
             onClick={() => onNavigate(Screen.EXERCISE_BANK)}
             className="bg-surface text-main p-4 rounded-xl flex flex-col items-center justify-center gap-2 border border-main/5 hover:bg-main/5 transition-all active:scale-95 disabled:opacity-50"
           >
             <span className="material-symbols-outlined text-3xl text-primary">fitness_center</span>
             <span className="font-bold text-xs text-center">Banco Exercícios</span>
           </button>

           <button 
             id="tour-food-btn" // TOUR TARGET (ADDED)
             onClick={() => onNavigate(Screen.FOOD_BANK)}
             className="bg-surface text-main p-4 rounded-xl flex flex-col items-center justify-center gap-2 border border-main/5 hover:bg-main/5 transition-all active:scale-95"
           >
             <span className="material-symbols-outlined text-3xl text-orange-600 dark:text-orange-400">restaurant</span>
             <span className="font-bold text-xs text-center">Banco Alimentos</span>
           </button>

           <button 
              id="tour-ranking-btn" // TOUR TARGET
              onClick={() => onNavigate(Screen.LEADERBOARD)}
              className="bg-surface text-main p-4 rounded-xl flex flex-col items-center justify-center gap-2 border border-main/5 hover:bg-main/5 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-3xl text-primary">emoji_events</span>
              <span className="font-bold text-xs text-center">Ranking Geral</span>
            </button>

            <button 
                 id="tour-invite-btn" // TOUR TARGET
                 onClick={() => { triggerHaptic('light'); setShowInviteWarning(true); }}
                 className="bg-surface text-main p-4 rounded-xl flex flex-col items-center justify-center gap-2 border border-main/5 hover:bg-main/5 transition-all active:scale-95 disabled:opacity-50"
            >
                 <span className="material-symbols-outlined text-3xl text-orange-600 dark:text-amber-500">key</span>
                 <span className="font-bold text-xs text-center">Gerar Convite</span>
            </button>

            <motion.button 
               whileTap={{ scale: 0.95 }}
               onClick={() => {
                   triggerHaptic('light');
                   onNavigate(Screen.WORKOUT_TEMPLATES);
               }}
               className="col-span-2 bg-surface text-main p-4 rounded-xl flex items-center justify-center gap-3 border border-main/5 hover:bg-main/5 transition-all active:scale-95 shadow-sm"
            >
               <span className="material-symbols-outlined text-3xl text-primary font-black">inventory_2</span>
               <span className="font-bold text-base">Base de Treinos</span>
            </motion.button>
        </div>

        {/* Quick Stats */}
        <div id="tour-stats" className="grid grid-cols-2 gap-4"> {/* TOUR TARGET */}
          <div className="bg-surface p-4 rounded-xl border border-main/5">
            <p className="text-sm text-muted font-medium">Alunos Ativos</p>
            <p className="text-3xl font-bold text-main mt-1">
                {isLoadingStudents ? '...' : (fetchError ? '-' : studentsList.length)}
            </p>
          </div>
          <div 
            id="tour-alerts" // TOUR TARGET
            onClick={() => onNavigate(Screen.ALERTS)}
            className="flex-1 bg-surface p-4 rounded-xl border border-main/5 cursor-pointer hover:bg-main/5 transition-colors relative"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-muted font-black uppercase tracking-wider">Alertas</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-amber-500 mt-1">{unreadAlerts}</p>
              </div>
              <span className="material-symbols-outlined text-orange-600 dark:text-amber-500">notifications_active</span>
            </div>
            {unreadAlerts > 0 && (
                <span className="absolute top-4 right-3 h-3 w-3 rounded-full bg-red-500 animate-pulse border-2 border-surface"></span>
            )}
          </div>
          <div 
            onClick={() => onNavigate(Screen.TRAINER_BUG_REPORTS)}
            className="flex-1 bg-surface p-4 rounded-xl border border-main/5 cursor-pointer hover:bg-main/5 transition-colors relative group"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-muted font-black uppercase tracking-wider">Bugs/Feedback</p>
                <p className="text-xs text-muted font-bold mt-1 group-hover:text-red-500 transition-colors">Relatórios dos Alunos</p>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined text-red-500">bug_report</span>
                {unreadReportsCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-600 border-2 border-surface animate-bounce"></span>
                )}
              </div>
            </div>
            {unreadReportsCount > 0 && (
              <div className="absolute bottom-2 right-4">
                <span className="text-[8px] font-black text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded-full uppercase">Novo!</span>
              </div>
            )}
          </div>
        </div>

        {/* Featured Students (Design Atualizado com Dados Reais) */}
        <section>
          <div className="flex justify-between items-end mb-4 px-1">
            <h2 className="text-xl font-bold text-main">Alunos em Destaque</h2>
            <button 
                onClick={() => onNavigate(Screen.STUDENT_LIST)} 
                className="text-sm text-primary font-bold hover:underline mb-1"
            >
                Ver todos
            </button>
          </div>
          
          <div className="space-y-3">
            {isLoadingStudents ? (
                 <div className="text-center py-4 text-muted text-sm">Carregando alunos...</div>
            ) : fetchError ? (
                 <div className="text-center py-4 text-muted text-sm border border-red-500/10 rounded-xl bg-red-500/5">
                    Erro ao carregar lista.
                 </div>
            ) : studentsList.length === 0 ? (
                 <div className="text-center py-4 text-muted text-sm">Nenhum aluno registado. Gera um convite!</div>
            ) : (
                studentsList.slice(0, 3).map(student => {
                    const progressPercent = calculateRealProgress(student.weight, student.targetWeight);
                    
                    return (
                    <div 
                        key={student.id} 
                        onClick={() => {
                            selectStudentForProgress(student.id, student.name, student.avatar);
                            onNavigate(Screen.TRAINER_STUDENT_DETAIL);
                        }}
                        className="bg-surface p-4 rounded-2xl flex items-center justify-between border border-main/5 cursor-pointer hover:border-main/10 hover:bg-main/5 active:scale-95 transition-all shadow-sm"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-full bg-cover bg-center border border-main/10 flex-shrink-0" style={{ backgroundImage: `url('${student.avatar}')` }}></div>
                            <div className="flex-1 min-w-0 pr-2">
                                <h3 className="font-bold text-main text-base truncate">{student.name}</h3>
                                <p className="text-xs text-muted font-medium truncate">{student.goal || 'Treino Personalizado'}</p>
                            </div>
                        </div>
                        <span className="text-primary font-bold text-sm whitespace-nowrap">+{progressPercent}%</span>
                    </div>
                )})
            )}
          </div>
        </section>
      </main>

      
      {/* CONFIRMATION POPUP FOR INVITE */}
      {showInviteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                 <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl text-primary">add_link</span>
                 </div>
                 <h3 className="text-xl font-bold text-main mb-2">Gerar Novo Convite?</h3>
                 <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    Estás prestes a criar um código de acesso para um novo aluno. Este código é único e servirá para o registo inicial.
                 </p>
                 
                 <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setShowInviteWarning(false)}
                        className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={() => {
                            setShowInviteWarning(false);
                            handleGenerateCode();
                        }}
                        className="flex-1 h-12 rounded-xl bg-primary text-background font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                    >
                        Gerar
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* CODE GENERATION MODAL */}
      {generatedCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-3xl p-6 border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300">
              <button 
                onClick={() => setGeneratedCode(null)}
                className="absolute top-4 right-4 text-muted hover:text-main transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              <div className="flex flex-col items-center text-center">
                 <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl text-primary">vpn_key</span>
                 </div>
                 
                 <h2 className="text-xl font-bold text-main mb-1">Convite Gerado!</h2>
                 <p className="text-sm text-muted mb-6">Partilha este código com o teu aluno.</p>

                 <div className="w-full bg-main/5 border border-dashed border-zinc-400 dark:border-zinc-600 rounded-xl p-4 mb-2 flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-colors" onClick={copyToClipboard}>
                    <span className="font-mono text-2xl font-bold text-primary tracking-wider">{generatedCode}</span>
                    <span className={`material-symbols-outlined transition-colors ${isCopied ? 'text-primary' : 'text-muted group-hover:text-primary'}`}>
                        {isCopied ? 'check' : 'content_copy'}
                    </span>
                 </div>
                 <p className={`text-[10px] mb-6 w-full text-right pr-1 transition-colors ${isCopied ? 'text-primary font-bold' : 'text-muted'}`}>
                    {isCopied ? 'Copiado com sucesso!' : 'Clique para copiar'}
                 </p>

                 <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 w-full flex gap-3 text-left">
                    <span className="material-symbols-outlined text-amber-500 flex-shrink-0">warning</span>
                    <p className="text-xs text-amber-200">
                       <span className="font-bold">Atenção:</span> Este código é de <span className="underline">utilização única</span>. Após o primeiro registo, ele será invalidado.
                    </p>
                 </div>

                 <button 
                   onClick={() => setGeneratedCode(null)}
                   className="mt-6 w-full bg-main/10 hover:bg-main/20 text-main font-bold py-3 rounded-xl transition-colors"
                 >
                   Fechar
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Screen, WorkoutSession, User, UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { triggerHaptic } from '../../lib/haptic';
import { TourGuide, TourStep } from '../../components/TourGuide';

interface StudentDashboardProps {
  onNavigate: (screen: Screen) => void;
}

const TOUR_STEPS: TourStep[] = [
    {
        targetId: 'tour-weight-display',
        title: 'Peso Atual',
        content: 'Aqui vês o teu peso mais recente registado.',
        position: 'bottom'
    },
    {
        targetId: 'tour-goal-card',
        title: 'As tuas Metas',
        content: 'Define e acompanha os teus objetivos de peso e medidas corporais aqui.',
        position: 'bottom'
    },
    {
        targetId: 'tour-performance-btn',
        title: 'Desempenho',
        content: 'Clica aqui para ver gráficos detalhados da tua evolução de carga, recordes pessoais e consistência nos treinos.',
        position: 'bottom'
    },
    {
        targetId: 'tour-ranking-btn',
        title: 'Ranking',
        content: 'Desafia-te e vê como te posicionas em relação aos outros alunos! Analisa os recordes (PRs) e a consistência.',
        position: 'bottom'
    },
    {
        targetId: 'tour-weight-btn',
        title: 'Registar Peso',
        content: 'Botão rápido para registar o teu peso e fotos de progresso regularmente.',
        position: 'bottom'
    },
    {
        targetId: 'tour-goal-card',
        title: 'Meta Principal',
        content: 'Este cartão mostra o teu objetivo atual e quanto falta para lá chegar. Mantém o foco!',
        position: 'top'
    },
    {
        targetId: 'tour-workout-card',
        title: 'Plano de Treino',
        content: 'O teu treino do dia aparece aqui. O sistema ignora metodicamente os teus dias de descanso para te dar sempre o próximo treino programado.',
        position: 'top'
    },
    {
        targetId: 'tour-diet-card',
        title: 'Plano Alimentar',
        content: 'Acede à tua dieta completa, marca as refeições realizadas e controla os teus macros diários.',
        position: 'top'
    },
    {
        targetId: 'tour-profile-btn',
        title: 'As tuas Configurações',
        content: 'No teu Perfil (Editar Dados) podes alterar a tua Frequência de Treinos e Dias de Descanso. O teu PT será notificado das tuas mudanças de disponibilidade!',
        position: 'bottom'
    }
];

export default function StudentDashboard({ onNavigate }: StudentDashboardProps) {
  const { user, dietPlan, addWeightEntry, alerts, updateUserProfile, reloadData, openTrainerChat, switchRole, progress, reportIssue, hasPendingWorkoutChangeRequest, currentScreen } = useApp();
  const [suggestedWorkout, setSuggestedWorkout] = useState<WorkoutSession | null>(null);
  const [loadingWorkout, setLoadingWorkout] = useState(true);
  const [hasAnyWorkout, setHasAnyWorkout] = useState(true); // Default true to avoid flash
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  
  // Helper to check if a date string is from today
  const isToday = useCallback((dateString: string | null) => {
      if (!dateString) return false;
      const date = new Date(dateString);
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
  }, []);
  
  // State for new Weight Modal
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newWeightDate, setNewWeightDate] = useState(new Date().toISOString().split('T')[0]);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('O teu novo peso foi registado com sucesso.');

  // Tour State
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [showRequestChangeModal, setShowRequestChangeModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  // Alerts
  const unreadAlerts = useMemo(() => alerts.filter(a => !a.read).length, [alerts]);
  // Check if there is an active weight reminder
  const hasWeightReminder = useMemo(() => alerts.some(a => a.id.startsWith('weight-reminder') && !a.read), [alerts]);
  
  // Verifica se existe dieta ativa
  const hasDiet = useMemo(() => dietPlan.meals && dietPlan.meals.length > 0, [dietPlan]);

  // RELOAD DATA ON MOUNT
  useEffect(() => {
      reloadData();
  }, []);

  // Check if weight registered today
  const hasRegisteredToday = useMemo(() => progress.some(entry => isToday(entry.date)), [progress, isToday]);
  
  // Logic to handle Tutorial Trigger
  useEffect(() => {
      // 1. Check if user needs onboarding (profile incomplete) - ONLY FOR STUDENTS
      if (user && user.role === 'STUDENT' && (!user.height || user.height === 0 || !user.weight || user.weight === 0 || !user.goal)) {
          onNavigate(Screen.ONBOARDING);
          return;
      }

      // 2. Check if tutorial is forced (from Help menu)
      const forceTutorial = localStorage.getItem('force_tutorial');
      if (forceTutorial === 'true') {
          setIsTourOpen(true);
          localStorage.removeItem('force_tutorial');
          return;
      }

      // 3. Check if user has seen tour in DB
      // We wait for user data to be loaded
      if (user && user.hasSeenTour === false) {
          // Small delay to let animations finish and ensure UI is ready
          const timer = setTimeout(() => setIsTourOpen(true), 1000);
          return () => clearTimeout(timer);
      }
  }, [user, onNavigate]);

  // Handle marking tour as seen (both on skip and complete)
  const handleTourFinished = async () => {
      setIsTourOpen(false);
      try {
          // Update DB
          await updateUserProfile({ hasSeenTour: true });
      } catch (e: any) {
          console.error("Failed to save tour status", e);
      }
  };

  const handleSaveWeight = async () => {
    const weightValue = parseFloat(newWeight.replace(',', '.'));
    if (!isNaN(weightValue) && weightValue > 0) {
        // Appending 'T00:00:00' ensures the date is parsed in the local timezone, avoiding UTC conversion issues.
        const date = new Date(newWeightDate + 'T00:00:00');
        await addWeightEntry(weightValue, date);
        setShowWeightModal(false);
        setNewWeight('');
        setNewWeightDate(new Date().toISOString().split('T')[0]); // Reset for next time
        setSuccessMessage('O teu novo peso foi registado com sucesso.');
        setShowSuccessPopup(true);
    } else {
        alert("Por favor, insira um valor de peso válido.");
    }
  };

  // Logic to determine "Today's Workout" based on Continuous Rotation
  useEffect(() => {
      const loadSuggestedWorkout = async () => {
          if (!user?.id) return;
          
          try {
              // 1. Fetch ALL workouts assigned to the student
              const { data: allWorkouts, error } = await supabase
                  .from('workouts')
                  .select(`
                      id, title, description, created_at, day_label, completed, completed_at,
                      workout_exercises (
                          workout_sets (
                              completed
                          )
                      )
                  `)
                  .eq('assigned_student_id', user.id)
                  .order('day_label', { ascending: true })
                  .order('created_at', { ascending: true }); // Secondary sort for stability

              let workoutsToUse = allWorkouts;

              if (error || !allWorkouts) {
                  // Se houver erro (ex: offline), tentar usar cache
                  const cached = localStorage.getItem(`cached_workouts_${user.id}`);
                  if (cached) {
                      workoutsToUse = JSON.parse(cached);
                  }
              } else {
                  // Guardar cache se obtido com sucesso e tem dados (ou lista vazia confirmada)
                  localStorage.setItem(`cached_workouts_${user.id}`, JSON.stringify(allWorkouts));
              }

              if (!workoutsToUse || workoutsToUse.length === 0) {
                  setHasAnyWorkout(false);
                  setSuggestedWorkout(null);
                  setLoadingWorkout(false);
                  return;
              }
              
              setHasAnyWorkout(true);

              // 2. Continuous Rotation Logic
              let lastCompletedWorkout: any = null;
              let workoutCompletedToday: any = null;
              let inProgressWorkout: any = null;

              const activeWorkouts = workoutsToUse.filter((w: any) => !w.day_label?.startsWith('ARCHIVED_') && !w.day_label?.startsWith('HISTORY_'));

              activeWorkouts.forEach(w => {
                  const inProgress = !w.completed && w.workout_exercises?.some((ex: any) => ex.workout_sets?.some((s: any) => s.completed));
                  if (inProgress) {
                      inProgressWorkout = w;
                  }

                  if (w.completed && w.completed_at) {
                      if (!lastCompletedWorkout || new Date(w.completed_at) > new Date(lastCompletedWorkout.completed_at)) {
                          lastCompletedWorkout = w;
                      }
                      if (isToday(w.completed_at)) {
                          workoutCompletedToday = w;
                      }
                  }
              });

              let targetData = null;
              const today = new Date().getDay();
              const restDays = user?.restDays || [0, 6];

              if (workoutCompletedToday) {
                  targetData = workoutCompletedToday;
              } else if (inProgressWorkout) {
                  targetData = inProgressWorkout;
              } else {
                  // Continuous Rotation Logic:
                  if (!lastCompletedWorkout) {
                      targetData = activeWorkouts[0];
                  } else {
                      const lastIndex = activeWorkouts.findIndex(w => w.day_label === lastCompletedWorkout.day_label);
                      if (lastIndex !== -1) {
                        targetData = activeWorkouts[(lastIndex + 1) % activeWorkouts.length];
                      } else {
                        targetData = activeWorkouts[0];
                      }
                  }
              }

              if (targetData) {
                  const isCompletedToday = targetData.completed && (targetData.completed_at ? isToday(targetData.completed_at) : false);
                  const inProgress = !targetData.completed && targetData.workout_exercises?.some((ex: any) => ex.workout_sets?.some((s: any) => s.completed));
                  const isRestDay = restDays.includes(today) && !isCompletedToday && !inProgress; // It's only a "rest day" if nothing is in progress or completed
                  
                  setSuggestedWorkout({
                      id: targetData.id,
                      title: targetData.title, 
                      description: targetData.description,
                      dayLabel: targetData.day_label || (['A','B','C','D','E','F','G'][workoutsToUse.indexOf(targetData)]) || '...',
                      exercises: Array(targetData.workout_exercises?.length || 0).fill(null),
                      completed: isCompletedToday,
                      durationSeconds: targetData.duration_seconds || 0,
                      plannedDurationMinutes: targetData.planned_duration || 50,
                      inProgress,
                      isRestDay
                  } as any);
              } else {
                  setSuggestedWorkout(null);
              }
          } catch (e) {
              console.error(e);
          } finally {
              setLoadingWorkout(false);
          }
      };

      loadSuggestedWorkout();
      
      const checkPending = async () => {
          if (!user?.id) return;
          const pending = await hasPendingWorkoutChangeRequest(user.id);
          setHasPendingRequest(pending);
      };
      checkPending();

      const handleWorkoutFinished = () => {
          loadSuggestedWorkout();
      };
      window.addEventListener('workoutFinished', handleWorkoutFinished);
      return () => {
          window.removeEventListener('workoutFinished', handleWorkoutFinished);
      };
  }, [user?.id, currentScreen]);

  // --- GOAL CALCULATION LOGIC ---
  const { currentW, targetW, initialW, hasTarget, remaining, diffFromStart, diffLabel, progressPct, isGainGoal, isGoodTrend, trendColor, trendIcon } = useMemo(() => {
      const currentW = user?.weight || 0;
      const targetW = user?.targetWeight || 0;
      const initialW = user?.initialWeight || currentW; 
      const hasTarget = targetW > 0;

      const remaining = Math.abs(targetW - currentW).toFixed(1);
      const diffFromStart = currentW - initialW;
      const diffLabel = (diffFromStart > 0 ? '+' : '') + diffFromStart.toFixed(1) + 'kg';

      let progressPct = 0;
      if (hasTarget && initialW !== targetW) {
          const totalGap = Math.abs(targetW - initialW);
          const currentGap = Math.abs(targetW - currentW);
          progressPct = Math.max(0, Math.min(100, (1 - (currentGap / totalGap)) * 100));
      }

      const goalLower = (user?.goal || '').toLowerCase();
      const isGainGoal = goalLower.includes('hipertrofia') || goalLower.includes('massa') || goalLower.includes('ganhar') || goalLower.includes('força');
      const isGoodTrend = isGainGoal ? diffFromStart >= 0 : diffFromStart <= 0;
      
      const trendColor = isGoodTrend 
          ? 'bg-primary/20 text-primary' 
          : 'bg-red-500/20 text-red-400';
      
      const trendIcon = diffFromStart > 0 ? 'trending_up' : (diffFromStart < 0 ? 'trending_down' : 'remove');
      
      return { currentW, targetW, initialW, hasTarget, remaining, diffFromStart, diffLabel, progressPct, isGainGoal, isGoodTrend, trendColor, trendIcon };
  }, [user]);

  return (
    <div className="flex flex-col h-full">
      
      <TourGuide 
        isOpen={isTourOpen} 
        steps={TOUR_STEPS} 
        onClose={handleTourFinished} 
        onComplete={handleTourFinished} 
      />

      <header className="sticky top-0 z-30 bg-background flex items-center justify-between px-6 py-5 animate-enter">
        <div 
          id="tour-profile-btn"
          onClick={() => onNavigate(Screen.PROFILE)}
          className="flex items-center gap-4 cursor-pointer group"
        >
          <div 
            className="h-12 w-12 rounded-full bg-cover bg-center border-2 border-primary shadow-[0_0_15px_rgba(37,99,235,0.1)] group-hover:scale-105 transition-transform" 
            style={{ backgroundImage: `url('${user?.avatar}')` }}
          ></div>
          <div>
            <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-0.5">Bem-vindo de volta,</p>
            <h1 className="text-xl font-bold text-main group-hover:text-primary transition-colors leading-tight">{user?.name}</h1>
          </div>
        </div>
        <div className="flex gap-3">
          {user?.role === 'TRAINER' && (
            <button 
              onClick={() => switchRole(UserRole.TRAINER)}
              className="h-11 w-11 flex items-center justify-center rounded-full bg-card shadow-sm text-primary hover:bg-main/5 transition-all active:scale-95"
              title="Voltar para Visão de Treinador"
            >
              <span className="material-symbols-outlined">swap_horiz</span>
            </button>
          )}
          <button 
            onClick={() => onNavigate(Screen.PROFILE_REPORT_ISSUE)}
            className="h-11 w-11 flex items-center justify-center rounded-full bg-card shadow-sm text-red-500 hover:bg-red-500/10 transition-all active:scale-95"
            title="Reportar Bug / Feedback"
          >
            <span className="material-symbols-outlined">bug_report</span>
          </button>
          <button 
            onClick={() => onNavigate(Screen.ALERTS)}
            className="h-11 w-11 flex items-center justify-center rounded-full bg-card shadow-sm text-main hover:bg-main/5 relative transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadAlerts > 0 && (
                <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-card animate-pulse"></span>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-7 overflow-y-auto min-h-0 pb-24">
        
        {/* SECTION 1: EVOLUTION GRID (BENTO STYLE) */}
        <section className="animate-enter delay-100">
           <div className="flex items-center justify-between px-1 mb-4">
              <h2 className="text-sm font-black text-main/60 uppercase tracking-[0.1em]">Evolução & Ferramentas</h2>
           </div>
           <div className="grid grid-cols-4 grid-rows-2 gap-3 h-[260px]">
              {/* Weight Card */}
              <div 
                id="tour-weight-display"
                className={`col-span-2 row-span-1 rounded-[1.5rem] p-4 flex flex-col justify-center shadow-lg relative overflow-hidden group cursor-pointer transition-transform active:scale-[0.98] ${hasRegisteredToday ? 'bg-primary' : 'bg-orange-500'}`}
                onClick={() => setShowWeightModal(true)}
              >
                  <div className="absolute -right-2 -bottom-2 opacity-10 transform scale-150 rotate-12 group-hover:rotate-45 transition-transform duration-700">
                     <span className="material-symbols-outlined text-7xl text-white">scale</span>
                  </div>
                  <div className="relative z-10">
                      <div className="flex justify-between items-center mb-1">
                         <p className="text-[9px] font-black text-white/70 uppercase tracking-[0.2em]">
                            {hasRegisteredToday ? 'Peso Atual' : 'Falta Registar'}
                         </p>
                         {hasWeightReminder && <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-black text-white leading-none">{user?.weight}</p>
                        <span className="text-xs font-bold text-white/60">kg</span>
                      </div>
                  </div>
              </div>

              {/* Water Card (Under Weight) */}
              <div 
                className="col-span-2 row-span-1 bg-surface rounded-[1.5rem] p-4 flex flex-col justify-center border border-main/5 shadow-sm relative overflow-hidden group transition-all hover:border-primary/20"
              >
                  <div className="absolute -right-2 -bottom-2 opacity-5 transform rotate-12 group-hover:rotate-45 transition-transform duration-1000">
                     <span className="material-symbols-outlined text-7xl text-blue-500">local_drink</span>
                  </div>
                  <div className="relative z-10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="material-symbols-outlined text-sm text-blue-500">local_drink</span>
                        <p className="text-[9px] font-black text-blue-500/60 uppercase tracking-[0.2em]">Cota de Água</p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-black text-main leading-none">
                            {(((user?.weight || 0) * 40) / 1000).toFixed(1)}
                        </p>
                        <span className="text-xs font-bold text-muted uppercase tracking-widest">Litros</span>
                      </div>
                      <p className="text-[8px] text-muted font-black mt-2 uppercase tracking-wider">
                        Baseado no teu peso de {user?.weight}kg
                      </p>
                  </div>
              </div>

              <button 
                id="tour-performance-btn"
                onClick={() => onNavigate(Screen.PERFORMANCE_HISTORY)}
                className="col-span-2 bg-surface rounded-[1.5rem] p-4 flex flex-col justify-center items-center gap-2 border border-main/5 shadow-sm active:scale-95 group transition-all hover:border-primary/20"
              >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><span className="material-symbols-outlined text-2xl">analytics</span></div>
                  <span className="text-[10px] font-black text-main uppercase tracking-widest leading-none">Recordes</span>
              </button>
              
              <button 
                id="tour-ranking-btn"
                onClick={() => onNavigate(Screen.LEADERBOARD)}
                className="col-span-2 bg-surface rounded-[1.5rem] p-4 flex flex-col justify-center items-center gap-2 border border-main/5 shadow-sm active:scale-95 group transition-all hover:border-primary/20"
              >
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined text-2xl">emoji_events</span></div>
                  <span className="text-[10px] font-black text-main uppercase tracking-widest leading-none">Ranking</span>
              </button>
           </div>
        </section>



        {/* SECTION 2: GOAL CARD */}
        {hasTarget && (
            <section id="tour-goal-card" className="animate-enter delay-200 px-1" onClick={() => onNavigate(Screen.PROGRESS)}>
                <div className="relative rounded-[2rem] bg-surface p-6 border border-main/5 overflow-hidden group cursor-pointer transition-all active:scale-[0.98]">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-5">
                           <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">O Teu Objetivo</p>
                           <span className={`${trendColor} text-[10px] font-black px-3 py-1 rounded-full border border-main/5 flex items-center gap-1`}>
                               <span className="material-symbols-outlined text-xs">{trendIcon}</span> {diffLabel}
                           </span>
                        </div>
                        <h3 className="text-2xl font-black text-main leading-tight mb-3">{user?.goal}</h3>
                        <div className="relative h-2 w-full bg-main/5 rounded-full overflow-hidden mb-3">
                           <div className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.2)]" style={{ width: `${progressPct}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-muted uppercase tracking-wider">
                           <span>Inicial: {initialW}kg</span>
                           <span className="text-primary font-black">{progressPct.toFixed(0)}% Concluído</span>
                           <span>Alvo: {targetW}kg</span>
                        </div>
                    </div>
                </div>
            </section>
        )}

        {/* SECTION 3: TODAY'S MISSION */}
        <section className="animate-enter delay-300">
          <div className="flex items-center justify-between px-1 mb-3">
            <h2 className="text-sm font-black text-main/60 uppercase tracking-[0.1em]">Missão de Hoje</h2>
            {hasAnyWorkout && (
                <button 
                    onClick={(e) => { 
                        e.stopPropagation();
                        if (!hasPendingRequest) setShowRequestChangeModal(true);
                    }}
                    disabled={hasPendingRequest}
                    className={`text-[10px] ${hasPendingRequest ? 'text-muted/50 cursor-not-allowed' : 'text-muted hover:text-primary'} font-bold uppercase tracking-wider flex items-center gap-1 transition-colors bg-surface px-2 py-1 rounded-lg border border-main/5`}
                >
                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                    {hasPendingRequest ? 'Pedido Pendente' : 'Pedir Alteração'}
                </button>
            )}
          </div>
          
          <div className="space-y-4">
            {/* Workout Card */}
            <div 
              id="tour-workout-card"
              className={`relative overflow-hidden rounded-[2rem] ${suggestedWorkout ? 'bg-black' : 'bg-transparent'} group active:scale-[0.98] transition-all shadow-xl shadow-black/20`}
              onClick={() => { triggerHaptic('light'); onNavigate(Screen.WORKOUT_PLAN); }}
            >
              <div className="relative z-10 flex flex-col h-full justify-between min-h-[120px]">
                {loadingWorkout ? (
                    <div className="flex items-center gap-2 p-6 bg-surface/10 backdrop-blur-md">
                        <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span>
                        <span className="text-sm text-white/60">A carregar treino...</span>
                    </div>
                ) : suggestedWorkout ? (
                    <div className="p-6 relative min-h-[180px] flex flex-col justify-end text-white">
                        <div 
                            className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-50 transition-opacity duration-700 group-hover:scale-110 transform" 
                            style={{ backgroundImage: "url('https://www.hussle.com/blog/wp-content/uploads/2020/12/Gym-structure-1080x675.png')" }}
                        ></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-[1]"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="bg-primary text-white text-base font-black px-4 py-1.5 rounded-xl">
                                    {(suggestedWorkout as any)?.dayLabel || 'Geral'}
                                </span>
                                {suggestedWorkout.completed ? (
                                    <span className="text-[10px] bg-blue-500/20 backdrop-blur-md px-2.5 py-1 rounded-lg text-blue-400 border border-blue-500/40 font-black uppercase tracking-widest">CONCLUÍDO</span>
                                ) : (suggestedWorkout as any).isRestDay ? (
                                    <span className="text-[10px] bg-orange-500/20 backdrop-blur-md px-2.5 py-1 rounded-lg text-orange-400 border border-orange-500/40 font-black tracking-widest uppercase">DESCANSO</span>
                                ) : (
                                    <span className="text-[10px] bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg text-white/80 font-black border border-white/20 uppercase tracking-widest">Próximo</span>
                                )}
                            </div>
                            <h3 className="text-3xl font-black text-white leading-tight drop-shadow-xl">{suggestedWorkout.title}</h3>
                            <div className="flex items-center gap-3 mt-2 text-white/60 text-xs font-bold">
                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">fitness_center</span>{suggestedWorkout.exercises.length} Ex</span>
                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span>~{suggestedWorkout.plannedDurationMinutes}m</span>
                            </div>
                            {/* Only show button if NOT a rest day OR if already completed today */}
                            {!((suggestedWorkout as any).isRestDay && !suggestedWorkout.completed) && (
                                <div className="flex justify-center mt-6 w-full">
                                    <button className="bg-white text-black px-10 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-2xl active:scale-95 group-hover:bg-primary group-hover:text-white transition-all w-full max-w-[200px]">
                                        {suggestedWorkout.completed ? 'Ver Sumário' : 'Começar!'}
                                        <span className="material-symbols-outlined text-xl">play_arrow</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : !hasAnyWorkout ? (
                    <div className="bg-surface py-8 flex flex-col items-center justify-center rounded-[2rem] border border-main/5 px-6 text-center">
                        <span className="material-symbols-outlined text-muted text-4xl mb-2">content_paste_off</span>
                        <p className="text-main font-bold mb-1">Sem Plano Ativo</p>
                        <p className="text-xs text-muted mb-4">Aguardando plano do PT.</p>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (!hasPendingRequest) setShowRequestChangeModal(true);
                            }}
                            disabled={hasPendingRequest}
                            className={`bg-primary/20 ${hasPendingRequest ? 'text-primary/50 cursor-not-allowed' : 'text-primary hover:bg-primary/30'} px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors`}
                        >
                            {hasPendingRequest ? 'Pedido Pendente' : 'Pedir Plano'}
                        </button>
                    </div>
                ) : (
                    <div className="bg-surface h-40 flex items-center justify-center rounded-[2rem] border border-main/5 px-6 text-center">
                        <div className="flex flex-col items-center">
                            <span className="material-symbols-outlined text-muted text-4xl mb-2">bedtime</span>
                            <p className="text-xs text-muted font-bold">Dia de descanso programado.</p>
                        </div>
                    </div>
                )}
              </div>
            </div>

            {/* Diet Card */}
            <div 
              id="tour-diet-card" 
              className="relative overflow-hidden rounded-[2rem] bg-black p-6 cursor-pointer group active:scale-[0.98] transition-all shadow-xl shadow-black/20"
              onClick={() => { triggerHaptic('light'); onNavigate(Screen.DIET_PLAN); }}
            >
              <div className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-40 transition-all duration-700 group-hover:scale-110 transform" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200&auto=format&fit=crop')" }}></div>
              <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/40 to-transparent z-[1]"></div>
              <div className="relative z-10 text-white">
                <div className="flex justify-between items-start mb-6">
                   <div>
                       <p className="text-[10px] font-black text-primary mb-1 uppercase tracking-[0.2em]">Nutrição</p>
                       <h3 className="text-2xl font-black text-white leading-none">Plano Alimentar</h3>
                       <p className="text-xs text-white/50 mt-1 font-bold">Combustível para os teus ganhos.</p>
                   </div>
                   <div className="h-12 w-12 rounded-2xl bg-white/5 backdrop-blur-xl flex items-center justify-center border border-white/10 group-hover:bg-primary transition-colors">
                       <span className="material-symbols-outlined text-white text-xl">restaurant</span>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white/5 rounded-2xl p-4 backdrop-blur-xl border border-white/10 flex items-center justify-between">
                    {hasDiet ? (
                        <>
                            <div>
                                <p className="text-[10px] font-black text-white/40 uppercase mb-1">Calorias</p>
                                <p className="text-2xl font-black text-white">{dietPlan.targetCalories}</p>
                            </div>
                            <div className="h-8 w-px bg-white/10 mx-2"></div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-white/40 uppercase mb-1">Refeições</p>
                                <p className="text-2xl font-black text-white">{dietPlan.meals.length}</p>
                            </div>
                        </>
                    ) : (
                        <p className="text-xs font-black text-white/60 uppercase tracking-wider">Regista o teu diário alimentar.</p>
                    )}
                  </div>
                  <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20 group-hover:scale-105 transition-all">
                     <span className="material-symbols-outlined text-white text-2xl">arrow_forward</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ADD WEIGHT MODAL */}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-enter">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-scale">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-main">Registar Novo Peso</h3>
                  <button onClick={() => setShowWeightModal(false)} className="text-muted hover:text-main">
                      <span className="material-symbols-outlined">close</span>
                  </button>
              </div>

              <div className="space-y-6">
                  <div>
                      <label className="text-sm font-bold text-muted mb-2 block">Data do Registo</label>
                      <input 
                          type="date"
                          value={newWeightDate}
                          onChange={(e) => setNewWeightDate(e.target.value)}
                          className="w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-all font-bold text-center"
                      />
                  </div>
                  <div>
                      <label className="text-sm font-bold text-muted mb-2 block">Peso Atual (kg)</label>
                      <div className="relative">
                        <input 
                            type="text" 
                            inputMode="decimal"
                            value={newWeight}
                            onChange={(e) => {
                                let val = e.target.value.replace(/[^0-9.,]/g, "").replace(/\./g, ",");
                                const commaCount = (val.match(/,/g) || []).length;
                                if (commaCount > 1) {
                                  const parts = val.split(",");
                                  val = parts[0] + "," + parts.slice(1).join("");
                                }
                                setNewWeight(val);
                            }}
                            className="w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-all font-bold text-2xl text-center"
                            placeholder={(user?.weight || 0).toString().replace('.', ',')}
                            autoFocus
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-bold">kg</span>
                      </div>
                  </div>

                  <button 
                      onClick={handleSaveWeight}
                      disabled={!newWeight}
                      className="w-full bg-primary text-background font-bold h-12 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                  >
                      Guardar Registo
                  </button>
              </div>
           </div>
        </div>
      )}

      {showSuccessPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-enter">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-primary/20 shadow-2xl relative animate-scale">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary animate-pulse">
                 <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <h3 className="text-xl font-bold text-main mb-2">Sucesso!</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                {successMessage}
              </p>
              <button 
                onClick={() => setShowSuccessPopup(false)}
                className="w-full h-12 rounded-xl bg-primary text-background hover:brightness-110 font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequestChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-3xl border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl">edit_note</span>
              </div>
              <button
                onClick={() => setShowRequestChangeModal(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-main/5 hover:bg-main/10 text-muted hover:text-main transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            
            <h2 className="text-xl font-bold text-main mb-2 tracking-tight">Pedir Alteração</h2>
            <p className="text-sm text-muted mb-4 leading-relaxed">
              Tens a certeza que queres pedir ao teu personal trainer para alterar o teu plano de treinos? Indica abaixo o que gostarias de alterar.
            </p>
            
            <textarea
              className="w-full bg-main/5 rounded-xl p-3 text-sm text-main border border-main/10 focus:border-primary outline-none mb-6 min-h-[100px]"
              placeholder="O que gostarias de alterar?"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowRequestChangeModal(false);
                  setRequestMessage('');
                }}
                className="flex-1 bg-main/5 text-main font-bold h-12 rounded-xl hover:bg-main/10 transition-colors flex items-center justify-center"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const baseMessage = hasAnyWorkout ? 'O aluno pediu uma alteração no seu plano de treinos.' : 'O aluno pediu um plano de treinos (não tem plano ativo).';
                  const fullMessage = requestMessage ? `${baseMessage}\n\nDetalhes: ${requestMessage}` : baseMessage;
                  reportIssue('Pedido de Alteração de Treino', fullMessage, true);
                  setShowRequestChangeModal(false);
                  setRequestMessage('');
                  setHasPendingRequest(true);
                  setSuccessMessage('O teu pedido foi enviado com sucesso ao teu PT.');
                  setShowSuccessPopup(true);
                }}
                className="flex-1 bg-primary text-background font-bold h-12 rounded-xl hover:brightness-110 transition-all shadow-md shadow-primary/20 active:scale-95 flex items-center justify-center gap-2"
              >
                Sim, Pedir
              </button>
            </div>
          </div>
        </div>
      )}

          </div>
  );
}

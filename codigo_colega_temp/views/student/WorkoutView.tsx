
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../contexts/AppContext';
import { Screen, WorkoutSession, Exercise } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { triggerHaptic } from '../../lib/haptic';

import { TourGuide, TourStep } from '../../components/TourGuide';

interface WorkoutViewProps {
  onBack: () => void;
}

const TOUR_STEPS: TourStep[] = [
    {
        targetId: 'tour-tabs',
        title: 'Teus Treinos',
        content: 'Aqui encontras os teus treinos divididos por letras (A, B, C...). O sistema sugere automaticamente o próximo treino da tua rotação.',
        position: 'bottom'
    },
    {
        targetId: 'tour-start-workout',
        title: 'Começar Agora',
        content: 'Clica aqui para iniciar a sessão. Podes ver o resumo dos exercícios antes de começar.',
        position: 'top'
    },
    {
        targetId: 'tour-consistency',
        title: 'Consistência',
        content: 'Acompanha os dias que treinaste nesta semana. Mantém a regularidade para atingires os teus objetivos!',
        position: 'top'
    },
    {
        targetId: 'tour-prs',
        title: 'Recordes (PRs)',
        content: 'Vê as tuas maiores cargas registadas e clica para ver o histórico detalhado de evolução.',
        position: 'top'
    }
];

const SESSION_TOUR_STEPS: TourStep[] = [
    {
        targetId: 'tour-exercise-card',
        title: 'Execução do Exercício',
        content: 'Aqui vês o nome do exercício, séries e tempo de descanso. Se tiveres dúvida, o vídeo de demonstração ajuda-te!',
        position: 'bottom'
    },
    {
        targetId: 'tour-weight-input',
        title: 'Carga e Reps',
        content: 'Regista o peso e as repetições feitas. O sistema mostra o que fizeste no treino anterior para te ajudar a progredir!',
        position: 'bottom'
    },
    {
        targetId: 'tour-check-set',
        title: 'Concluir Série',
        content: 'Clica no check após cada série para ativar o cronómetro de descanso automático.',
        position: 'bottom'
    }
];

export default function WorkoutView({ onBack }: WorkoutViewProps) {
  const { activeWorkout, updateSet, finishWorkout, resetWorkout, setScreen, user, setActiveWorkout, reportIssue, openTrainerChat, updateUserProfile } = useApp();
  const [viewMode, setViewMode] = useState<'REGISTRY' | 'SESSION'>(() => {
    // If there is an active session in context, we start in SESSION mode if it matches
    // But we need safe access to AppContext which is not here yet.
    // So we'll handle this in an effect instead or check localStorage directly.
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('active_workout_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const startTime = localStorage.getItem(`workout_start_time_${parsed.id}`);
                // Ensure we only enter SESSION mode if there's a valid, uncompleted start time
                if (parsed.id && parsed.id !== 'default' && startTime) return 'SESSION';
            } catch (e) {}
        }
    }
    return 'REGISTRY';
  });
  
  // Tour State
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isSessionTourOpen, setIsSessionTourOpen] = useState(false);
  
  useEffect(() => {
    if (user && viewMode === 'REGISTRY' && !user.hasSeenWorkoutTour) {
        const timer = setTimeout(() => setIsTourOpen(true), 1000);
        return () => clearTimeout(timer);
    }
    if (user && viewMode === 'SESSION' && !user.hasSeenSessionTour) {
        const timer = setTimeout(() => setIsSessionTourOpen(true), 1000);
        return () => clearTimeout(timer);
    }
  }, [user, viewMode]);

  const handleTourFinished = async (type: 'registry' | 'session') => {
      if (type === 'registry') {
          setIsTourOpen(false);
          await updateUserProfile({ hasSeenWorkoutTour: true });
      } else {
          setIsSessionTourOpen(false);
          await updateUserProfile({ hasSeenSessionTour: true });
      }
  };
  
  // Helper to check if a date string is from today
  const isToday = (dateString: string | null) => {
      if (!dateString) return false;
      const date = new Date(dateString);
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
  };

  // Helper to parse rest time (e.g. "60s", "1m", "1:30")
  const parseRestTime = (timeStr: string | null | undefined): number => {
    if (!timeStr) return 60;
    const clean = timeStr.trim().toLowerCase();
    
    if (clean.includes(':')) {
        const parts = clean.split(':');
        const m = parseInt(parts[0]) || 0;
        const s = parseInt(parts[1]) || 0;
        return (m * 60) + s;
    }
    
    const numMatch = clean.match(/\d+/);
    if (!numMatch) return 60;
    const num = parseInt(numMatch[0]);
    
    if (clean.includes('m') && !clean.includes('s')) {
        return num * 60;
    }
    
    return num;
  };

  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [tabWorkouts, setTabWorkouts] = useState<any[]>([]); // Summary list of workouts
  const [isLoading, setIsLoading] = useState(true);

  // Preview State (Exercises list for the selected tab)
  const [previewExercises, setPreviewExercises] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Session State
  const [restTimer, setRestTimer] = useState(60); // Default placeholder
  const [isRestRunning, setIsRestRunning] = useState(false);
  const [restEndTime, setRestEndTime] = useState<number | null>(() => {
      const saved = localStorage.getItem('active_rest_end_time');
      if (saved) {
          const endTime = parseInt(saved);
          return endTime > Date.now() ? endTime : null;
      }
      return null;
  });
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('active_workout_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const startTime = localStorage.getItem(`workout_start_time_${parsed.id}`);
                return startTime ? parseInt(startTime) : null;
            } catch (e) {}
        }
    }
    return null;
  });
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('active_workout_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const acc = localStorage.getItem(`workout_accumulated_${parsed.id}`);
                return acc ? parseInt(acc) : 0;
            } catch (e) {}
        }
    }
    return 0;
  });
  const [liveDuration, setLiveDuration] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('active_workout_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const startTimeStr = localStorage.getItem(`workout_start_time_${parsed.id}`);
                const accStr = localStorage.getItem(`workout_accumulated_${parsed.id}`);
                if (startTimeStr && accStr) {
                    const startTime = parseInt(startTimeStr);
                    const acc = parseInt(accStr);
                    return acc + Math.floor((Date.now() - startTime) / 1000);
                }
            } catch (e) {}
        }
    }
    return 0;
  });
  
  useEffect(() => {
    if (restEndTime) {
        setIsRestRunning(true);
    }
  }, [restEndTime]);
  
  const displayedTabs = useMemo(() => {
    return tabWorkouts.map((w: any) => w.day_label).sort((a: string, b: string) => a.localeCompare(b));
  }, [tabWorkouts]);

  // 153.1: Handle browser back button during session
  useEffect(() => {
    if (viewMode !== 'SESSION') return;

    const handlePopState = (e: PopStateEvent) => {
        // Prevent default back behavior by pushing state back
        window.history.pushState(null, '', window.location.href);
        setShowCancelModal(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewMode]);

  // Cancel/Exit Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Summary Modal State
  const [showSummary, setShowSummary] = useState(false);
  const [workoutStats, setWorkoutStats] = useState({ duration: '00:00', volume: 0, sets: 0, exercises: 0, durationSeconds: 0 });
  const [sessionPRs, setSessionPRs] = useState<{ name: string; record: string }[]>([]);
  
  // Incomplete Exercise Confirmation
  const [showIncompleteConfirmModal, setShowIncompleteConfirmModal] = useState(false);
  const [incompleteActionType, setIncompleteActionType] = useState<'SKIP' | 'FINISH' | null>(null);
  const [completedHistory, setCompletedHistory] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
        const savedSession = localStorage.getItem('active_workout_session');
        if (savedSession) {
            try {
                const parsedSession = JSON.parse(savedSession);
                if (parsedSession.id && parsedSession.id !== 'default') {
                    const savedHistory = localStorage.getItem(`workout_completed_history_${parsedSession.id}`);
                    if (savedHistory) {
                        return JSON.parse(savedHistory);
                    }
                }
            } catch (e) {}
        }
    }
    return [];
  });

  // Track changes to completedHistory and save to localStorage
  useEffect(() => {
     if (completedHistory.length >= 0 && activeWorkout && activeWorkout.id && activeWorkout.id !== 'default') {
         localStorage.setItem(`workout_completed_history_${activeWorkout.id}`, JSON.stringify(completedHistory));
     }
  }, [completedHistory, activeWorkout?.id]);

  // Video & Exercise Details State
  const [activeExerciseDetails, setActiveExerciseDetails] = useState<{ video_url: string | null, primary_muscle: string | null }>({ video_url: null, primary_muscle: null });

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [reportType, setReportType] = useState<'DOR' | 'QUESTAO' | 'OUTRO' | 'BUG'>('DOR');
  const [reportMessage, setReportMessage] = useState('');
  const [isUrgent, setIsUrgent] = useState(true);

  // Empty State Modal
  const [showEmptyPlanModal, setShowEmptyPlanModal] = useState(false);
  
  // Superserie Finish Notification
  const [showSupersetFinished, setShowSupersetFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Substitute Exercise Modal State
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [alternativeExercises, setAlternativeExercises] = useState<Exercise[]>([]);

  // PREVIEW VIDEO MODAL
  const [previewVideoModal, setPreviewVideoModal] = useState<{ 
      isOpen: boolean; 
      videoUrl: string | null; 
      exerciseName: string | null;
  }>({ 
      isOpen: false, 
      videoUrl: null, 
      exerciseName: null 
  });

  // Personal Records State
  const [personalRecords, setPersonalRecords] = useState<{ name: string; record: string }[]>([]);
  const [allPersonalRecords, setAllPersonalRecords] = useState<{ name: string; record: number }[]>([]);
  const [isLoadingPRs, setIsLoadingPRs] = useState(true);

  // Find current workout by DAY LABEL (A, B, C...)
  // Calculated early so it's available to all handlers
  const currentWorkout = useMemo(() => tabWorkouts.find((w: any) => w.day_label === selectedTab), [tabWorkouts, selectedTab]);

  // State for new dashboard sections
  const [weeklyConsistency, setWeeklyConsistency] = useState<{ completed: number; planned: number; completedDays: number[] }>({ completed: 0, planned: 0, completedDays: [] });
  const [loadingStats, setLoadingStats] = useState(true);

  // Helper to check for Rest Day
  const isRestDay = useMemo(() => {
    const baseRestDay = user?.restDays ? user.restDays.includes(new Date().getDay()) : (new Date().getDay() === 0 || new Date().getDay() === 6);
    return baseRestDay && !tabWorkouts.some(w => w.isCompletedToday || w.inProgress);
  }, [user?.restDays, tabWorkouts]);

  // Fetch PRs
  const fetchPRs = async () => {
      if (!user?.id) return;
      setIsLoadingPRs(true);
      try {
        const { data: performanceData, error: perfError } = await supabase
          .from('workouts')
          .select(`workout_exercises (name, workout_sets (weight, completed))`)
          .eq('assigned_student_id', user.id)
          .eq('completed', true);
          // Note: .eq('workout_exercises.workout_sets.completed', true) works for filtering parent rows, 
          // but we must also filter the children array in JS to be safe.

        if (perfError) {
          console.error("Error fetching PRs:", perfError);
          setPersonalRecords([]);
          return;
        }

        const prs: { [key: string]: number } = {};
        if (performanceData) {
          performanceData.forEach((workout: any) => {
            (workout.workout_exercises || []).forEach((ex: any) => {
              (ex.workout_sets || []).forEach((set: any) => {
                // Ensure strictly completed sets count
                if (set.completed && (!prs[ex.name] || set.weight > prs[ex.name]) && set.weight > 0) {
                  prs[ex.name] = set.weight;
                }
              });
            });
          });
        }
        
        const allPrs = Object.entries(prs)
            .filter(([, record]) => record > 0)
            .map(([name, record]) => ({ name, record }));

        setAllPersonalRecords(allPrs);

      } catch (error) {
        console.error("Failed to load PR stats", error);
      } finally {
        setIsLoadingPRs(false);
      }
  };

  useEffect(() => {
    fetchPRs();
    const handleFinished = () => {
        fetchPRs();
    };
    window.addEventListener('workoutFinished', handleFinished);
    return () => window.removeEventListener('workoutFinished', handleFinished);
  }, [user?.id]);

  // Update filtered PRs whenever selected workout exercises change
  useEffect(() => {
    if (previewExercises.length > 0) {
        const exerciseNames = new Set(previewExercises.filter(ex => !ex.isHeader).map(ex => ex.name));
        const filtered = allPersonalRecords.filter(pr => exerciseNames.has(pr.name));
        
        // Sort by weight
        filtered.sort((a, b) => b.record - a.record);
        
        setPersonalRecords(filtered.map(pr => ({ name: pr.name, record: `${pr.record}kg` })));
    } else {
        // Fallback to top priority global PRs if no workout selected or exercises empty
        const priorityLifts = ['Supino Reto', 'Agachamento', 'Agachamento Livre', 'Peso Morto', 'Levantamento Terra'];
        const copy = [...allPersonalRecords];
        copy.sort((a, b) => {
            const aIsPrio = priorityLifts.includes(a.name);
            const bIsPrio = priorityLifts.includes(b.name);
            if (aIsPrio && !bIsPrio) return -1;
            if (!aIsPrio && bIsPrio) return 1;
            return b.record - a.record;
        });
        setPersonalRecords(copy.slice(0, 3).map(pr => ({ name: pr.name, record: `${pr.record}kg` })));
    }
  }, [allPersonalRecords, previewExercises]);

  
  // Logic for Dashboard Stats (Consistency)
  useEffect(() => {
    const fetchDashboardStats = async () => {
      if (!user?.id) return;
      setLoadingStats(true);

      try {
        // Fetch Weekly Consistency data
        const today = new Date();
        const firstDayOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
        firstDayOfWeek.setHours(0, 0, 0, 0);
        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
        lastDayOfWeek.setHours(23, 59, 59, 999);

        const { data: weeklyData, error: weeklyError } = await supabase
            .from('workouts')
            .select(`completed_at, completed`)
            .eq('assigned_student_id', user.id)
            .eq('completed', true)
            .gte('completed_at', firstDayOfWeek.toISOString())
            .lte('completed_at', lastDayOfWeek.toISOString());
            
        if(weeklyError) console.error("Error fetching consistency:", weeklyError);

        const completedDays = new Set<number>();
        if (weeklyData) {
            weeklyData.forEach((workout: any) => {
                if (workout.completed && workout.completed_at) {
                    completedDays.add(new Date(workout.completed_at).getDay());
                }
            });
        }
        
        const { count: plannedCount } = await supabase
            .from('workouts')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_student_id', user.id);

        setWeeklyConsistency({
            completed: completedDays.size,
            planned: plannedCount || 0,
            completedDays: Array.from(completedDays)
        });

      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchDashboardStats();
  }, [user?.id]);


  // 1. Fetch Student Workouts
  const fetchWorkouts = useCallback(async () => {
      if (!user?.id) return;
      setIsLoading(true);
      try {
          // Fetch basic info matching Trainer's logic (explicit day_label)
          const { data, error } = await supabase
              .from('workouts')
              .select(`
                  id, title, description, duration_seconds, completed, day_label, completed_at,
                  workout_exercises (
                    workout_sets (
                      completed
                    )
                  )
              `)
              .eq('assigned_student_id', user.id)
              .order('created_at', { ascending: true });

          let workoutsToUse = data;

          if (error || !data) {
              const cached = localStorage.getItem(`cached_workouts_${user.id}`);
              if (cached) {
                  workoutsToUse = JSON.parse(cached);
              }
          } else {
              localStorage.setItem(`cached_workouts_${user.id}`, JSON.stringify(data));
          }

          if (workoutsToUse) {
              const activeData = workoutsToUse.filter((w: any) => !w.day_label?.startsWith('ARCHIVED_') && !w.day_label?.startsWith('HISTORY_'));
              const sortedData = activeData.sort((a: any, b: any) => (a.day_label || '').localeCompare(b.day_label || ''));
              
              const formattedData = sortedData.map((w: any, idx: number) => ({
                  ...w,
                  day_label: w.day_label || (['A','B','C','D','E','F','G'][idx] || `W${idx+1}`),
                  isCompletedToday: w.completed && (w.completed_at ? isToday(w.completed_at) : false),
                  inProgress: !w.completed && w.workout_exercises?.some((ex: any) => ex.workout_sets?.some((s: any) => s.completed))
              }));
              setTabWorkouts(formattedData);
              
              // Continuous Rotation to Auto-select Tab
              if (formattedData.length > 0) {
                  setSelectedTab(prev => {
                      const currentTabExists = formattedData.some((w: any) => w.day_label === prev);
                      if (!currentTabExists || !prev) {
                          let lastCompletedWorkout: any = null;
                          let workoutCompletedToday: any = null;
                          let inProgressWorkout: any = null;

                          formattedData.forEach((w: any) => {
                              if (w.inProgress) inProgressWorkout = w;
                              if (w.completed && w.completed_at) {
                                  if (!lastCompletedWorkout || new Date(w.completed_at) > new Date(lastCompletedWorkout.completed_at)) {
                                      lastCompletedWorkout = w;
                                  }
                                  if (w.isCompletedToday) workoutCompletedToday = w;
                              }
                          });

                          let targetTab = null;
                          if (workoutCompletedToday) {
                              targetTab = workoutCompletedToday.day_label;
                          } else if (inProgressWorkout) {
                              targetTab = (inProgressWorkout as any).day_label;
                          } else if (!lastCompletedWorkout) {
                              targetTab = formattedData[0].day_label;
                          } else {
                              const lastIndex = formattedData.findIndex((w: any) => w.day_label === lastCompletedWorkout.day_label);
                              targetTab = formattedData[(lastIndex + 1) % formattedData.length].day_label;
                          }
                          return targetTab;
                      }
                      return prev;
                  });
              }

              // Show empty modal if NO workouts exist at all
              if (workoutsToUse.length === 0 && !error) {
                  setShowEmptyPlanModal(true);
              }
          }
      } catch (e) {
          console.error("Error fetching workouts", e);
      } finally {
          setIsLoading(false);
      }
  }, [user?.id]);

  useEffect(() => {
      fetchWorkouts();
  }, [fetchWorkouts]);

  // 2. Fetch Preview Exercises when Tab/Workout changes
  useEffect(() => {
      const fetchPreview = async () => {
          // Find workout by LABEL, not index
          const currentWorkout = tabWorkouts.find((w: any) => w.day_label === selectedTab);

          if (!currentWorkout) {
              setPreviewExercises([]);
              return;
          }

          setIsLoadingPreview(true);
          try {
              const { data, error } = await supabase
                  .from('workout_exercises')
                  .select('*, workout_sets(id, weight, reps, time, intensity, completed, created_at)')
                  .eq('workout_id', currentWorkout.id)
                  .order('order_index', { ascending: true })
                  .order('created_at', { ascending: true });
              
              let previewToUse = data;

              if (error || !data) {
                  const cached = localStorage.getItem(`cached_preview_${currentWorkout.id}`);
                  if (cached) {
                      previewToUse = JSON.parse(cached);
                  }
              } else {
                  localStorage.setItem(`cached_preview_${currentWorkout.id}`, JSON.stringify(data));
              }

              if (previewToUse) {
                  setPreviewExercises(previewToUse);
              }
          } catch (e) {
              console.error("Error fetching preview", e);
          } finally {
              setIsLoadingPreview(false);
          }
      };

      if (tabWorkouts.length > 0) {
          fetchPreview();
      } else {
          setPreviewExercises([]);
      }
  }, [selectedTab, tabWorkouts]);


  // Workout Timer - Always running
  useEffect(() => {
    if (viewMode !== 'SESSION' || !sessionStartTime) return;
    
    const interval = setInterval(() => {
        const currentSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
        setLiveDuration(accumulatedSeconds + currentSeconds);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [viewMode, sessionStartTime, accumulatedSeconds]);

  // Periodic Auto-save of duration to DB
  useEffect(() => {
    if (viewMode !== 'SESSION' || !activeWorkout.id || activeWorkout.id === 'default') return;

    const autoSaveInterval = setInterval(async () => {
        try {
            await supabase
                .from('workouts')
                .update({ duration_seconds: liveDuration })
                .eq('id', activeWorkout.id);
        } catch (e) {
            console.warn("Silent failure on auto-save duration:", e);
        }
    }, 10000); // Every 10 seconds

    return () => clearInterval(autoSaveInterval);
  }, [viewMode, liveDuration, activeWorkout.id]);

  // Handle Visibility Change - Force DB sync when backgrounding
  useEffect(() => {
    const handleVisibilityChange = async () => {
        if (document.visibilityState === 'hidden' && viewMode === 'SESSION' && activeWorkout.id !== 'default' && sessionStartTime) {
            const currentSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
            const total = accumulatedSeconds + currentSeconds;
            
            // Try to save current progress to DB before the process is suspended
            try {
                await supabase
                    .from('workouts')
                    .update({ duration_seconds: total })
                    .eq('id', activeWorkout.id);
            } catch (e) {
                console.warn("Background persistence failed:", e);
            }
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [viewMode, activeWorkout.id, sessionStartTime, accumulatedSeconds]);

  // Timer Effect (Rest Timer)
  useEffect(() => {
    let interval: any;
    if (viewMode === 'SESSION' && isRestRunning && restEndTime) {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((restEndTime - Date.now()) / 1000));
        setRestTimer(remaining);
        
        if (remaining === 0) {
            // Keep isRestRunning true so the overlay stays visible
            // setIsRestRunning(false); 
            setRestEndTime(null);
            playTimerSound();
            clearInterval(interval);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [viewMode, isRestRunning, restEndTime]);

  const playTimerSound = () => {
    try {
        // Use a sound that is likely to be CORS-friendly
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.volume = 1.0;
        audio.play().catch(() => {});
    } catch (e) {
        console.error("Erro ao tocar áudio:", e);
    }
  };

  const startRest = (seconds: number, origin: string = 'unknown') => {
      const endTime = Date.now() + seconds * 1000;
      setRestTimer(seconds);
      setRestEndTime(endTime);
      setIsRestRunning(true);
      localStorage.setItem('active_rest_end_time', endTime.toString());
  };

  // Fetch video & muscle group when active exercise changes
  useEffect(() => {
      const fetchDetails = async () => {
          if (!activeWorkout?.exercises?.[0]) return;
          const currentEx = activeWorkout.exercises[0];
          
          if (currentEx.isHeader) {
              setActiveExerciseDetails({ video_url: null, primary_muscle: null });
              return;
          }

          setActiveExerciseDetails({ video_url: null, primary_muscle: null });

          try {
              const { data } = await supabase
                  .from('exercise_library')
                  .select('video_url, primary_muscle')
                  .eq('name', currentEx.name)
                  .maybeSingle();
              
              if (data) {
                  setActiveExerciseDetails({
                      video_url: data.video_url,
                      primary_muscle: data.primary_muscle
                  });
              }
          } catch (e) {
              console.error("Error fetching exercise details", e);
          }
      };
      
      if (viewMode === 'SESSION') {
          fetchDetails();
      }
  }, [activeWorkout.exercises[0]?.id, viewMode]);

  const openVideoPreview = async (exerciseName: string) => {
      try {
          const { data } = await supabase
              .from('exercise_library')
              .select('video_url')
              .eq('name', exerciseName)
              .maybeSingle(); // Better than single() to avoid crash if not found
          
          if (data?.video_url) {
              setPreviewVideoModal({
                  isOpen: true,
                  videoUrl: data.video_url,
                  exerciseName: exerciseName
              });
          } else {
              alert("Vídeo não disponível para este exercício.");
          }
      } catch (e) {
          console.error("Error fetching preview video", e);
      }
  };

  const startSession = async () => {
      // PREVENT STARTING ON REST DAYS
      if (isRestDay) {
          alert("Hoje é o seu dia de descanso configurado! Aproveita para recuperar.");
          return;
      }

      const targetWorkout = tabWorkouts.find((w: any) => w.day_label === selectedTab);

      if (!targetWorkout) return;

      // Fetch full details for the selected workout
      try {
          const { data: exs, error: exsError } = await supabase
            .from('workout_exercises')
            .select('*, workout_sets(*)')
            .eq('workout_id', targetWorkout.id)
            .order('order_index', { ascending: true })
            .order('created_at', { ascending: true })
            .order('created_at', { foreignTable: 'workout_sets', ascending: true });

          let exsToUse = exs;

          if (exsError || !exs) {
              const cached = localStorage.getItem(`cached_preview_${targetWorkout.id}`);
              if (cached) {
                  exsToUse = JSON.parse(cached);
              }
          }

          if (exsToUse) {
              // Only allow starting if not completed TODAY
              if (targetWorkout.isCompletedToday) return;

              // We are either starting fresh or resuming. 
              // If it's completed but not today, it means we are starting a NEW session for today, so we ignore DB completed status.
              const isResuming = targetWorkout.inProgress;
              const isNewDaySession = targetWorkout.completed && !targetWorkout.isCompletedToday;

              // --- GET RECENT HISTORY TO AUTO-FILL WEIGHTS ---
              let recentSets: { [exerciseName: string]: any[] } = {};
              try {
                  // Fetch recent completed workouts to find the last weights lifted
                  const { data: historyData, error: historyError } = await supabase
                      .from('workouts')
                      .select('completed_at, workout_exercises(name, workout_sets(weight, reps, time, completed, created_at))')
                      .eq('assigned_student_id', user.id)
                      .eq('completed', true)
                      .order('completed_at', { ascending: false })
                      .limit(20); // Check last 20 workouts
                  
                  let historyToUse = historyData;
                  if (historyError || !historyData) {
                      const cachedHistory = localStorage.getItem(`cached_history_${user.id}`);
                      if (cachedHistory) historyToUse = JSON.parse(cachedHistory);
                  } else {
                      localStorage.setItem(`cached_history_${user.id}`, JSON.stringify(historyData));
                  }

                  if (historyToUse) {
                      // Sort history descending by completed_at to be safe
                      const sortedHistory = historyToUse.sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
                      
                      sortedHistory.forEach((w: any) => {
                          (w.workout_exercises || []).forEach((ex: any) => {
                              if (!ex.name) return;
                              // Pick the latest workout that had this exercise!
                              if (!recentSets[ex.name]) {
                                  // Sort sets by created_at ascending to match set indices (1, 2, 3...)
                                  const sortedSets = (ex.workout_sets || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                  recentSets[ex.name] = sortedSets.map((s: any) => ({
                                      weight: s.weight,
                                      reps: s.reps,
                                      time: s.time
                                  }));
                              }
                          });
                      });
                  }
              } catch (err) {
                  console.error("Error fetching historical weights", err);
              }
              // -----------------------------------------------
              

              const allFormattedExs: Exercise[] = exs.map((ex: any) => {
                  let trackingMode: 'reps' | 'seconds' = 'reps';
                  let cleanNotes = ex.notes || '';
                  if (cleanNotes.includes('[TIME_BASED]')) {
                      trackingMode = 'seconds';
                      cleanNotes = cleanNotes.replace('[TIME_BASED]', '').trim();
                  } else if (cleanNotes.includes('[REPS_BASED]')) {
                      trackingMode = 'reps';
                      cleanNotes = cleanNotes.replace('[REPS_BASED]', '').trim();
                  } else if (ex.name?.toLowerCase().includes('prancha')) {
                      trackingMode = 'seconds';
                  }

                  return {
                      id: ex.id,
                      name: ex.name,
                      type: ex.type || 'STRENGTH',
                      notes: cleanNotes,
                      isSuperset: ex.is_superset || false,
                      restTime: ex.rest_time,
                      isHeader: ex.is_header,
                      trackingMode,
                      parent_exercise_id: ex.parent_exercise_id,
                      sets: (ex.workout_sets || []).map((s: any, idx: number) => {
                          // If resuming, only keep the weight the user already typed today for completed sets
                          const reps = s.reps ?? 0;
                          const time = ex.type === 'CARDIO' ? (s.time || '') : '';
                          const isCompleted = isNewDaySession ? false : (isResuming ? s.completed : false);
                          const weight = isCompleted ? (s.weight || 0) : 0; 

                          return {
                              id: s.id,
                              reps,
                              weight,
                              time,
                              intensity: s.intensity,
                              notes: s.notes || '',
                              completed: isCompleted
                          };
                      })
                  };
              });

              // Group alternatives
              const formattedExs = allFormattedExs
                .filter(ex => !ex.parent_exercise_id)
                .map(main => ({
                  ...main,
                  alternatives: allFormattedExs.filter(alt => alt.parent_exercise_id === main.id)
                }));

              const allOriginalExs: Exercise[] = exs.map((ex: any) => {
                  let trackingMode: 'reps' | 'seconds' = 'reps';
                  let cleanNotes = ex.notes || '';
                  if (cleanNotes.includes('[TIME_BASED]')) {
                      trackingMode = 'seconds';
                      cleanNotes = cleanNotes.replace('[TIME_BASED]', '').trim();
                  } else if (cleanNotes.includes('[REPS_BASED]')) {
                      trackingMode = 'reps';
                      cleanNotes = cleanNotes.replace('[REPS_BASED]', '').trim();
                  } else if (ex.name?.toLowerCase().includes('prancha')) {
                      trackingMode = 'seconds';
                  }

                  return {
                      id: ex.id,
                      name: ex.name,
                      type: ex.type || 'STRENGTH',
                      notes: cleanNotes,
                      isSuperset: ex.is_superset || false,
                      restTime: ex.rest_time,
                      isHeader: ex.is_header,
                      trackingMode,
                      parent_exercise_id: ex.parent_exercise_id,
                      sets: (ex.workout_sets || []).map((s: any, idx: number) => {
                          const historicalSet = (recentSets[ex.name] && recentSets[ex.name][idx]) ? recentSets[ex.name][idx] : null;

                          const reps = historicalSet?.reps ?? s.reps ?? 0;
                          const weight = historicalSet?.weight || 0;
                          const time = historicalSet?.time || '';

                          return {
                              id: s.id,
                              reps,
                              weight,
                              time,
                              intensity: s.intensity,
                              notes: s.notes || '',
                              completed: false
                          };
                      })
                  };
              });

              const originalExs = allOriginalExs
                .filter(ex => !ex.parent_exercise_id)
                .map(main => ({
                  ...main,
                  alternatives: allOriginalExs.filter(alt => alt.parent_exercise_id === main.id)
                }));

              const newSession: WorkoutSession = {
                  id: targetWorkout.id,
                  title: targetWorkout.title,
                  description: targetWorkout.description || '',
                  exercises: formattedExs,
                  // IMPORTANT: Create a Deep Copy of original exercises (we pass unmodified targeting)
                  originalExercises: originalExs, 
                  completed: false,
                  durationSeconds: 0
              };

              if (isResuming) {
                  // Find the first non-header exercise that is not fully completed
                  const firstIncompleteIdx = formattedExs.findIndex(ex => {
                      if (ex.isHeader) return false;
                      return ex.sets.some(s => !s.completed);
                  });

                  if (firstIncompleteIdx !== -1) {
                      let resumeIdx = firstIncompleteIdx;
                      
                      // Check if there is a header immediately before it that should be shown
                      // Logic: If 0 sets are completed in the first incomplete exercise, and it's preceded by a header,
                      // we start from the header.
                      const targetEx = formattedExs[firstIncompleteIdx];
                      const setsDoneInTarget = targetEx.sets.filter(s => s.completed).length;
                      
                      if (setsDoneInTarget === 0 && firstIncompleteIdx > 0 && formattedExs[firstIncompleteIdx - 1].isHeader) {
                          resumeIdx = firstIncompleteIdx - 1;
                      }
                      
                      if (resumeIdx > 0) {
                          newSession.exercises = formattedExs.slice(resumeIdx);
                          setCompletedHistory(formattedExs.slice(0, resumeIdx));
                      }
                  } else if (formattedExs.length > 0) {
                      // Special case: All exercises completed but session not officially finished.
                      // We land on the last exercise.
                      newSession.exercises = [formattedExs[formattedExs.length - 1]];
                      setCompletedHistory(formattedExs.slice(0, formattedExs.length - 1));
                  }
              }

              setActiveWorkout(newSession);
              
              // CLEAR any old rest timer from previous sessions
              localStorage.removeItem('active_rest_end_time');
              setRestEndTime(null);
              setIsRestRunning(false);
              
              // PERSISTENCE LOGIC:
              // Try to find if we have a valid start time for THIS workout in localStorage
              const savedStart = localStorage.getItem(`workout_start_time_${targetWorkout.id}`);
              const savedAccumulated = localStorage.getItem(`workout_accumulated_${targetWorkout.id}`);
              
              let startTime = Date.now();
              let acc = isResuming ? (targetWorkout.duration_seconds || 0) : 0;

              if (isResuming && savedStart && savedAccumulated) {
                  startTime = parseInt(savedStart);
                  acc = parseInt(savedAccumulated);
                  // If for some reason the DB has more time than our restored state, follow DB
                  if ((targetWorkout.duration_seconds || 0) > acc) {
                      acc = targetWorkout.duration_seconds || 0;
                      startTime = Date.now(); // Reset start reference for the new delta
                      localStorage.setItem(`workout_start_time_${targetWorkout.id}`, startTime.toString());
                      localStorage.setItem(`workout_accumulated_${targetWorkout.id}`, acc.toString());
                  }
              } else {
                  // Fresh start or fresh resume without local cache
                  localStorage.setItem(`workout_start_time_${targetWorkout.id}`, startTime.toString());
                  localStorage.setItem(`workout_accumulated_${targetWorkout.id}`, acc.toString());
                  setCompletedHistory([]); // RESET HISTORY ON FRESH START
              }

              setSessionStartTime(startTime);
              setAccumulatedSeconds(acc);
              setLiveDuration(acc + Math.floor((Date.now() - startTime) / 1000));
              setViewMode('SESSION');
              
              // Refresh tabWorkouts to reflect the updated 'completed' status in local list
              if (!isResuming) {
                  setTabWorkouts(prev => prev.map(w => w.id === targetWorkout.id ? { ...w, completed: false } : w));
              }
          }
      } catch (e) {
          console.error("Error starting session", e);
      }
  };

  const cancelSession = async () => {
      const workoutId = activeWorkout.id;
      if (workoutId && workoutId !== 'default') {
          localStorage.removeItem(`workout_start_time_${workoutId}`);
          localStorage.removeItem(`workout_accumulated_${workoutId}`);
          localStorage.removeItem(`workout_completed_history_${workoutId}`);
          localStorage.removeItem('active_workout_session');
          localStorage.removeItem('active_rest_end_time');
          await resetWorkout(workoutId);
          await fetchWorkouts();

          setRestEndTime(null);
          setIsRestRunning(false);
          
          // Clear shared context state
          setActiveWorkout({
              id: 'default',
              title: '',
              description: '',
              exercises: [],
              originalExercises: [],
              completed: false,
              durationSeconds: 0,
              plannedDurationMinutes: 50
          });
      }
      setCompletedHistory([]);
      setViewMode('REGISTRY');
      setShowCancelModal(false);
  };

  const formatRestTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [cardioNotes, setCardioNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchCardioNotes = async () => {
      try {
        // Fetch all columns to be robust against schema differences
        const { data, error } = await supabase
          .from('student_cardio_notes')
          .select('*')
          .eq('student_id', user?.id);
        
        if (!error && data) {
          const notesMap: Record<string, string> = {};
          data.forEach((row: any) => {
            // Priority list of column names for the exercise name
            const exerciseKey = row.exercise_name !== undefined ? 'exercise_name' : 
                               (row.exercise !== undefined ? 'exercise' : 
                               Object.keys(row).find(k => !['id', 'student_id', 'note', 'updated_at', 'created_at'].includes(k)));
            
            if (exerciseKey && row[exerciseKey]) {
                notesMap[row[exerciseKey]] = row.note;
            }
          });
          setCardioNotes(notesMap);
        }
      } catch (e) {
        console.error('Error fetching cardio notes:', e);
      }
    };
    if (user?.id) fetchCardioNotes();
  }, [user?.id]);

  const cardioNoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveCardioNote = (exerciseName: string, note: string) => {
    setCardioNotes(prev => ({ ...prev, [exerciseName]: note }));
    
    if (cardioNoteTimeoutRef.current) {
        clearTimeout(cardioNoteTimeoutRef.current);
    }
    
    cardioNoteTimeoutRef.current = setTimeout(async () => {
        try {
            // First fetch the specific record or existing structure
            const { data } = await supabase
              .from('student_cardio_notes')
              .select('*')
              .eq('student_id', user?.id);
              
            let exerciseKey = 'exercise_name';
            let existingRecord = null;
            
            if (data && data.length > 0) {
              const sampleRow = data[0];
              exerciseKey = sampleRow.exercise_name !== undefined ? 'exercise_name' : 
                           (sampleRow.exercise !== undefined ? 'exercise' : 
                           Object.keys(sampleRow).find(k => !['id', 'student_id', 'note', 'updated_at', 'created_at'].includes(k)) || 'exercise_name');
                           
              existingRecord = data.find((row) => row[exerciseKey] === exerciseName);
            }
            
            if (existingRecord && existingRecord.id) {
               await supabase
                .from('student_cardio_notes')
                .update({ note: note, updated_at: new Date().toISOString() })
                .eq('id', existingRecord.id);
            } else {
               // Record either doesn't exist or we didn't find its ID
               const onConflictStr = `student_id,${exerciseKey}`;
               const { error } = await supabase
                .from('student_cardio_notes')
                .upsert({
                  student_id: user?.id,
                  [exerciseKey]: exerciseName,
                  note: note,
                  updated_at: new Date().toISOString()
                }, { onConflict: onConflictStr });
                
               // If there's STILL a conflict (e.g. wrong onConflict string), delete and insert
               if (error && error.code === '23505') {
                   await supabase
                    .from('student_cardio_notes')
                    .delete()
                    .eq('student_id', user?.id)
                    .eq(exerciseKey, exerciseName);
                    
                   await supabase
                    .from('student_cardio_notes')
                    .insert({
                      student_id: user?.id,
                      [exerciseKey]: exerciseName,
                      note: note,
                      updated_at: new Date().toISOString()
                    });
               } else if (error && error.code === 'PGRST100') {
                   // Fallback if the first try on empty table used wrong column name (400 Bad Request)
                   if (exerciseKey === 'exercise_name') {
                       await supabase
                        .from('student_cardio_notes')
                        .upsert({
                          student_id: user?.id,
                          exercise: exerciseName,
                          note: note,
                          updated_at: new Date().toISOString()
                        }, { onConflict: 'student_id,exercise' });
                   }
               }
            }
        } catch (e) {
            console.error('Error saving cardio note:', e);
        }
    }, 1000); // 1s debounce to avoid spamming the database
  };

  const handleSetUpdate = (exerciseId: string, setId: string, field: 'weight' | 'reps' | 'time' | 'intensity' | 'notes', value: string) => {
    let allowedValue = value;
    if (field === "weight" || field === "reps" || field === "intensity") {
      allowedValue = value.replace(/[^0-9.,]/g, "");
      allowedValue = allowedValue.replace(/\./g, ",");
      const commaCount = (allowedValue.match(/,/g) || []).length;
      if (commaCount > 1) {
          const parts = allowedValue.split(",");
          allowedValue = parts[0] + "," + parts.slice(1).join("");
      }
    }

    const val = (field === 'time' || field === 'notes') ? value : allowedValue;
    updateSet(exerciseId, setId, { [field]: val }, liveDuration);
  };

  const toggleSetComplete = (exerciseId: string, setId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    if (newStatus) {
        triggerHaptic('medium');
    } else {
        triggerHaptic('light');
    }
    
    updateSet(exerciseId, setId, { completed: newStatus }, liveDuration);
    
    // Handle rotation and rest logic for supersets immediately
    if (newStatus) {
        const currentEx = activeWorkout.exercises[0];
        if (!currentEx) return;

        // Find this exercise in the original plan to understand its "block context"
        const originalIdx = activeWorkout.originalExercises?.findIndex(e => e.id === currentEx.id) ?? -1;
        
        // Find the start and end of the contiguous superset block in the ORIGINAL plan
        let blockStart = originalIdx;
        let blockEnd = originalIdx;
        
        if (originalIdx !== -1) {
            // Enhanced block detection: walk backwards/forwards skipping headers to find the full circuit
            while (blockStart > 0) {
                const prev = activeWorkout.originalExercises[blockStart - 1];
                if (prev.isHeader) {
                    blockStart--;
                    continue;
                }
                if (prev.isSuperset || (prev as any).is_superset) {
                    blockStart--;
                } else {
                    break;
                }
            }
            while (blockEnd < activeWorkout.originalExercises.length - 1) {
                const next = activeWorkout.originalExercises[blockEnd + 1];
                if (next.isHeader) {
                    // Only include trailing header if followed by a superset exercise
                    let hasNextSuperset = false;
                    for (let i = blockEnd + 2; i < activeWorkout.originalExercises.length; i++) {
                        const future = activeWorkout.originalExercises[i];
                        if (!future.isHeader) {
                            if (future.isSuperset || (future as any).is_superset) hasNextSuperset = true;
                            break;
                        }
                    }
                    if (hasNextSuperset) { blockEnd++; continue; }
                    else break;
                }
                if (next.isSuperset || (next as any).is_superset) {
                    blockEnd++;
                } else {
                    break;
                }
            }
        }

        const originalBlockExercises = (originalIdx !== -1)
            ? activeWorkout.originalExercises.slice(blockStart, blockEnd + 1)
            : [];
        
        const originalBlockIds = originalBlockExercises.map(e => e.id);
        const exerciseCountInBlock = originalBlockExercises.filter(e => !e.isHeader).length;
            
        const nextExs = activeWorkout.exercises.slice(1);
        
        // Find how many of these block exercises are currently at the front of our queue
        let currentBlockInQueue = [currentEx];
        for (const ex of nextExs) {
            if (originalBlockIds.includes(ex.id)) {
                currentBlockInQueue.push(ex);
            } else {
                break;
            }
        }

        // Robust superset detection: either by expansion in original plan (at least 2 EXERCISES) or by current flag
        const isPartOfSuperset = (
                                (originalIdx !== -1 && exerciseCountInBlock > 1) || 
                                currentEx.isSuperset || 
                                (currentEx as any).is_superset
        );

        if (isPartOfSuperset) {
            // Check if ALL exercises in this full block are now fully completed (across all sets)
            const isBlockFinished = currentBlockInQueue.every(ex => {
                if (ex.isHeader) return true;
                if (ex.id === currentEx.id) {
                    return ex.sets.every(s => (s.id === setId ? newStatus : s.completed));
                }
                return ex.sets.every(s => s.completed);
            });

            if (isBlockFinished) {
                // If entire block is done, advance past the block
                if (currentBlockInQueue.length > 1) {
                    setShowSupersetFinished(true);
                    setTimeout(() => setShowSupersetFinished(false), 4000);
                }
                
                setCompletedHistory(prev => [...prev, ...currentBlockInQueue]);
                const outsideBlockExs = nextExs.slice(currentBlockInQueue.length - 1);
                
                if (outsideBlockExs.length > 0) {
                     if (!outsideBlockExs[0].isHeader) {
                         const restSeconds = parseRestTime(currentEx.restTime);
                         startRest(restSeconds || 60, 'block_finished');
                     }
                     setActiveWorkout(prev => ({ ...prev, exercises: outsideBlockExs }));
                } else {
                    actualHandleFinishClick();
                }
                return;
            }

            // ROTATION WITHIN BLOCK
            // Trigger rest ONLY if currentEx is the TAIL of the block in the ORIGINAL plan
            // Look for the last non-header exercise index in the block
            let lastExIdx = blockEnd;
            while (lastExIdx > blockStart && activeWorkout.originalExercises[lastExIdx].isHeader) {
                lastExIdx--;
            }
            const isOriginalTail = originalIdx !== -1 && originalIdx === lastExIdx;

            if (isOriginalTail) {
                const restSeconds = parseRestTime(currentEx.restTime);
                startRest(restSeconds || 60, 'superset_tail');
            }

            // Move current to the end of the block in the CURRENT queue
            const updatedCurrentEx = {
                ...currentEx,
                sets: currentEx.sets.map(s => s.id === setId ? { ...s, completed: newStatus } : s)
            };

            const rotatedExercises = [
                ...nextExs.slice(0, currentBlockInQueue.length - 1),
                updatedCurrentEx,
                ...nextExs.slice(currentBlockInQueue.length - 1)
            ];

            setActiveWorkout(prev => ({
                ...prev,
                exercises: rotatedExercises
            }));
            return; // Exit toggleSetComplete after superset handling
        } else if (currentEx) {
            // Standard rest for normal exercises ONLY if we didn't just rotate/finish a superset
            if (activeWorkout.exercises.length > 1 && !activeWorkout.exercises[1].isHeader) {
                 const restSeconds = parseRestTime(currentEx.restTime);
                 startRest(restSeconds || 60, 'standard_set');
            } else if (activeWorkout.exercises.length === 1) {
                 const restSeconds = parseRestTime(currentEx.restTime);
                 startRest(restSeconds || 60, 'standard_set');
            }
        }
    }
  };

  // Derived Data for Session
  const activeExercise = (viewMode === 'SESSION' && activeWorkout.exercises.length > 0) ? activeWorkout.exercises[0] : null;
  const allSetsCompleted = activeExercise 
    ? (activeExercise.isHeader ? true : activeExercise.sets.every(set => set.completed)) 
    : false;
  const nextExercises = (viewMode === 'SESSION' && activeWorkout.exercises.length > 0) ? activeWorkout.exercises.slice(1) : [];

  const actualSkipExercise = () => {
      const currentEx = activeWorkout.exercises[0];
      const nextExs = activeWorkout.exercises.slice(1);
      
      const originalIdx = activeWorkout.originalExercises?.findIndex(e => e.id === currentEx.id) ?? -1;
      
      // Find the start and end of the contiguous superset block in the ORIGINAL plan
      let blockStart = originalIdx;
      let blockEnd = originalIdx;
      if (originalIdx !== -1) {
          while (blockStart > 0) {
              const prev = activeWorkout.originalExercises[blockStart - 1];
              if (prev.isHeader) { blockStart--; continue; }
              if (prev.isSuperset || (prev as any).is_superset) { blockStart--; }
              else break;
          }
          while (blockEnd < activeWorkout.originalExercises.length - 1) {
              const next = activeWorkout.originalExercises[blockEnd + 1];
              if (next.isHeader) {
                  let hasNextSuperset = false;
                  for (let i = blockEnd + 2; i < activeWorkout.originalExercises.length; i++) {
                      const future = activeWorkout.originalExercises[i];
                      if (!future.isHeader) {
                          if (future.isSuperset || (future as any).is_superset) hasNextSuperset = true;
                          break;
                      }
                  }
                  if (hasNextSuperset) { blockEnd++; continue; }
                  else break;
              }
              if (next.isSuperset || (next as any).is_superset) {
                  blockEnd++;
              } else {
                  break;
              }
          }
      }
      const originalBlockExercises = (originalIdx !== -1) ? activeWorkout.originalExercises.slice(blockStart, blockEnd + 1) : [];
      const originalBlockIds = originalBlockExercises.map(e => e.id);
      const exerciseCountInBlock = originalBlockExercises.filter(e => !e.isHeader).length;

      // Robust superset detection
      const isPartOfSuperset = (
                               (originalIdx !== -1 && exerciseCountInBlock > 1) || 
                               currentEx.isSuperset || 
                               (currentEx as any).is_superset
      );
      
      // SUPERSET ROTATION LOGIC
      if (isPartOfSuperset) {
          // Identify the contiguous superset block starting from the front of the queue
          let currentBlockInQueue = [currentEx];
          for (const ex of nextExs) {
              if (originalBlockIds.includes(ex.id)) currentBlockInQueue.push(ex);
              else break;
          }

          // Check if the entire block is completed (all sets of every exercise in block)
          const isBlockFinished = currentBlockInQueue.every(ex => {
              if (ex.isHeader) return true;
              return ex.sets.every(s => s.completed);
          });

          if (isBlockFinished) {
              // Finish the whole block
              if (currentBlockInQueue.length > 1) {
                  setShowSupersetFinished(true);
                  setTimeout(() => setShowSupersetFinished(false), 4000);
              }
              
              setCompletedHistory(prev => [...prev, ...currentBlockInQueue]);
              const remainingExs = nextExs.slice(currentBlockInQueue.length - 1);
              
              if (remainingExs.length > 0) {
                   setActiveWorkout(prev => ({ ...prev, exercises: remainingExs }));
              } else {
                  actualHandleFinishClick();
              }
              return;
          }

          if (currentBlockInQueue.length > 1) {
              // Start rest only at the end of the rotation cycle (logical tail)
              let lastExIdx = blockEnd;
              while (lastExIdx > blockStart && activeWorkout.originalExercises[lastExIdx].isHeader) lastExIdx--;
              
              const isBlockTail = originalIdx !== -1 && originalIdx === lastExIdx;

              const rotatedExercises = [
                  ...nextExs.slice(0, currentBlockInQueue.length - 1),
                  currentEx,
                  ...nextExs.slice(currentBlockInQueue.length - 1)
              ];

              setActiveWorkout(prev => ({
                  ...prev,
                  exercises: rotatedExercises
              }));
              return;
          }
      }

      // Normal completion logic
      setCompletedHistory(prev => [...prev, currentEx]);
      
      if (nextExs.length > 0) {
           // We rest if the current is not a header and we are NOT jumping into the middle of a superset
           const nextIsPartOfSuperset = !nextExs[0].isHeader && (
                                        nextExs[0].isSuperset || 
                                        (nextExs[0] as any).is_superset || 
                                        (originalIdx !== -1 && (activeWorkout.originalExercises[originalIdx].isSuperset || (activeWorkout.originalExercises[originalIdx] as any).is_superset))
           );
           
           setActiveWorkout(prev => ({
               ...prev,
               exercises: nextExs
           }));
      } else {
          actualHandleFinishClick();
      }
  };

  const skipExercise = () => {
      const isSuperset = activeExercise?.isSuperset || (activeExercise as any)?.is_superset;
      if (!allSetsCompleted && !isSuperset) {
          setIncompleteActionType('SKIP');
          setShowIncompleteConfirmModal(true);
      } else {
          actualSkipExercise();
      }
  };

  const confirmIncompleteAction = () => {
      setShowIncompleteConfirmModal(false);
      if (incompleteActionType === 'SKIP') {
          actualSkipExercise();
      } else if (incompleteActionType === 'FINISH') {
          actualHandleFinishClick();
      }
      setIncompleteActionType(null);
  };

  // Determine current active exercise for reporting
  const activeExerciseName = (viewMode === 'SESSION' && activeWorkout.exercises.length > 0) 
      ? activeWorkout.exercises[0].name 
      : null;

  const handleReportIssue = async () => {
      if (!reportMessage) return;
      
      let title = reportType === 'BUG' ? '🐞 BUG' : (reportType === 'DOR' ? 'Dor Relatada' : (reportType === 'QUESTAO' ? 'Dúvida' : 'Relato'));
      
      // AUTO-TAG EXERCISE TO TITLE IF AVAILABLE
      if (activeExerciseName) {
          title += ` - ${activeExerciseName}`;
      }

      try {
          await reportIssue(title, reportMessage, isUrgent);
          
          setReportMessage('');
          setShowReportModal(false);
          setShowSuccessPopup(true); // Show Success Popup instead of alert
          
          // Auto-close success popup after 3 seconds
          setTimeout(() => setShowSuccessPopup(false), 3000);
      } catch (error) {
          console.error("Error reporting issue:", error);
          alert("Erro ao enviar relato. Tenta novamente.");
      }
  };

  // Calculate stats and show summary
  const actualHandleFinishClick = () => {
        const totalSeconds = liveDuration;
        
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const durationStr = `${minutes}m ${seconds}s`;

        let vol = 0;
        let sets = 0;
        let completedExercises = new Set<string>();
        let brokenRecords: { name: string; record: string }[] = [];
        
        // Ensure we don't count the same exercise instance twice (Set handles exercise count, but we need it for vol/sets)
        const allSessionData = [...completedHistory, ...activeWorkout.exercises];
        const uniqueExercisesMap = new Map<string, Exercise>();
        allSessionData.forEach(ex => {
            if (!uniqueExercisesMap.has(ex.id)) {
                uniqueExercisesMap.set(ex.id, ex);
            }
        });

        uniqueExercisesMap.forEach(ex => {
            if(!ex.isHeader) {
                let exerciseHasSet = false;
                let maxWeight = 0;
                ex.sets.forEach(s => {
                    if(s.completed) {
                        vol += (s.weight * s.reps);
                        sets++;
                        exerciseHasSet = true;
                        if (s.weight > maxWeight) maxWeight = s.weight;
                    }
                });
                if(exerciseHasSet) {
                    completedExercises.add(ex.id);
                    brokenRecords.push({ name: ex.name, record: `${maxWeight}kg` });
                }
            }
        });

        // Sort by weight/relevance if needed, but for now just take top 3 from this session
        setSessionPRs(brokenRecords.slice(0, 3));

        setWorkoutStats({
            duration: durationStr,
            volume: vol,
            sets: sets,
            exercises: completedExercises.size,
            durationSeconds: totalSeconds
        });
        
        localStorage.removeItem('active_rest_end_time');
        setRestEndTime(null);
        setIsRestRunning(false);
        
        setShowSummary(true);
        triggerHaptic('success');
  };

  const handleFinishClick = () => {
    if (!allSetsCompleted) {
        setIncompleteActionType('FINISH');
        setShowIncompleteConfirmModal(true);
    } else {
        actualHandleFinishClick();
    }
  };
  
  const handleOpenSubstituteModal = () => {
      if (!activeWorkout.exercises || activeWorkout.exercises.length <= 1 || !activeExerciseName) return;

      setShowSubstituteModal(true);
      
      // Only offer exercises that are currently in the remaining queue (slice(1))
      const alternatives = activeWorkout.exercises.slice(1).filter(ex => {
          // Check if any set in the exercise is marked as completed (already started)
          const isCompleted = ex.sets.some(set => set.completed);
          
          return !ex.isHeader && !isCompleted;
      });
      
      setAlternativeExercises(alternatives);
  };

  const handleSelectAlternative = (newExerciseName: string) => {
      const currentExercises = activeWorkout.exercises;
      if (currentExercises.length === 0 || !activeWorkout.originalExercises) return;

      const swappedOutExercise = currentExercises[0];

      // Find the full exercise object from the original list to be the new active one
      const newExerciseTemplate = activeWorkout.originalExercises.find(ex => ex.name === newExerciseName);
      if (!newExerciseTemplate) return;

      const swappedInExercise = {
          ...newExerciseTemplate,
          // Reset sets to ensure user performs them for the new exercise
          sets: newExerciseTemplate.sets.map(set => ({ 
              ...set, 
              completed: false, 
              weight: 0, 
              reps: set.reps || 0,
              time: (set as any).time || '',
              intensity: (set as any).intensity || 0
          }))
      };
      
      // The rest of the queue, EXCLUDING the one we just moved to the front to avoid duplication
      const restOfTheQueue = currentExercises
          .slice(1)
          .filter(ex => ex.id !== newExerciseTemplate.id);

      // Construct the new list: new exercise, then the one just swapped out, then the rest
      const newExercisesList = [
          swappedInExercise,
          swappedOutExercise, // Keeps its completed status
          ...restOfTheQueue
      ];

      setActiveWorkout({
          ...activeWorkout,
          exercises: newExercisesList
      });

      setShowSubstituteModal(false);
  };

  const handleSwitchToAlternative = (alt: Exercise) => {
      if (!activeWorkout || !activeWorkout.exercises || activeWorkout.exercises.length === 0) return;
      
      triggerHaptic('success');
      
      const currentEx = activeWorkout.exercises[0];
      
      // Store current as alternative for the new one so we can toggle back
      const originalAsAlternative = { 
          ...currentEx, 
          alternatives: undefined // prevent circular
      };
      
      // Filter out 'alt' from its own alternatives to avoid dupes if already there
      const otherAlts = (alt.alternatives || []).filter(a => a.id !== originalAsAlternative.id);

      const swappedIn: Exercise = {
          ...alt,
          alternatives: [...otherAlts, originalAsAlternative]
      };

      setActiveWorkout(prev => {
          if (!prev) return null;
          const newExercises = [swappedIn, ...prev.exercises.slice(1)];
          return { ...prev, exercises: newExercises };
      });
  };

  const weekDaysShort = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const todayIndex = new Date().getDay();

  // ----------------------------------------------------------------------
  // VIEW: SESSION TRACKER
  // ----------------------------------------------------------------------
  if (viewMode === 'SESSION') {
    // Session markers 
    const videoUrl = activeExerciseDetails.video_url;

    const isHeaderActive = activeExercise && activeExercise.isHeader;
    const headerName = isHeaderActive ? activeExercise.name.toUpperCase() : '';
    const headerIcon = headerName.includes('CÁRDIO') || headerName.includes('CARDIO') ? 'directions_run' : 
                     headerName.includes('ALONGAMENTO') ? 'accessibility_new' : 
                     headerName.includes('AQUECIMENTO') ? 'home_health' : 'fitness_center';

    return (
      <div className="flex flex-col h-full bg-background relative overflow-hidden">
        {isHeaderActive ? (
            <div className="flex-1 flex flex-col justify-center items-center p-6 text-center animate-enter relative z-10">
                 <button onClick={() => setShowCancelModal(true)} className="absolute top-4 left-4 h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
                     <span className="material-symbols-outlined">close</span>
                 </button>
                 <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mb-6 animate-pulse">
                    <span className="material-symbols-outlined text-4xl text-primary">{headerIcon}</span>
                 </div>
                 <h2 className="text-muted text-sm uppercase tracking-widest mb-2">Próximo Grupo Muscular</h2>
                 <h1 className="text-4xl font-black text-main mb-8">{activeExercise.name}</h1>
                 <button 
                    onClick={skipExercise}
                    className="w-full h-16 rounded-2xl bg-primary text-background font-bold text-xl hover:brightness-110 shadow-lg shadow-primary/20"
                 >
                    Continuar
                 </button>
            </div>
        ) : (
            <>
                <header className="flex-none sticky top-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 animate-enter">
                    <button onClick={() => setShowCancelModal(true)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                    <div className="text-center">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Tempo Total</span>
                            <h2 className="text-xl font-black text-main leading-none tabular-nums">
                                {Math.floor(liveDuration / 60).toString().padStart(2, '0')}:{(liveDuration % 60).toString().padStart(2, '0')}
                            </h2>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => {
                                setReportType('BUG');
                                setShowReportModal(true);
                            }}
                            className="h-10 px-4 rounded-xl bg-red-500 text-white flex items-center justify-center gap-1.5 hover:brightness-110 transition-all shadow-lg shadow-red-500/20 active:scale-95 group font-black"
                        >
                            <span className="material-symbols-outlined text-lg group-hover:animate-spin-slow">bug_report</span>
                            <span className="text-[12px] uppercase tracking-tight">Relatar Bug</span>
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-4 space-y-6 overflow-y-auto pb-48">
                <AnimatePresence mode="wait">
                    {activeExercise ? (
                    <motion.div 
                        key={activeExercise.id}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        id="tour-exercise-card" 
                        className="bg-surface border border-primary/30 rounded-2xl p-5 shadow-lg relative overflow-hidden"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-xl font-bold text-main leading-tight">{activeExercise.name}</h2>
                                    {activeExercise.isSuperset && (
                                        <div className="bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 shrink-0 animate-pulse">
                                            <span className="material-symbols-outlined text-xs">link</span>
                                            SUPERSÉRIE
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-main/80 font-bold">{activeExercise.sets.length} séries • Descanso: {activeExercise.restTime || '60s'}</p>
                            </div>
                        </div>
                        
                        {activeWorkout.exercises.length > 1 && (
                            <button 
                                onClick={handleOpenSubstituteModal}
                                className="flex items-center gap-1.5 text-muted text-xs font-bold hover:text-main transition-all bg-main/5 px-2 py-1 rounded-md border border-main/10 mb-4"
                            >
                                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                                Trocar Exercício
                            </button>
                        )}

                        {/* Alternatives Toggle */}
                        {activeExercise.alternatives && activeExercise.alternatives.length > 0 && (
                            <div className="flex flex-col gap-2 mb-4 bg-orange-500/5 p-3 rounded-xl border border-orange-500/20">
                                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">alt_route</span>
                                    Variação Sugerida (caso a máquina esteja ocupada)
                                </p>
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                    {activeExercise.alternatives.map(alt => (
                                        <button
                                            key={alt.id}
                                            onClick={() => handleSwitchToAlternative(alt)}
                                            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">swap_calls</span>
                                            Trocar para: {alt.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeExercise.notes && activeExercise.sets.length <= 1 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4 flex gap-3 items-start animate-enter">
                                <span className="material-symbols-outlined text-yellow-500 text-lg flex-shrink-0 mt-0.5">lightbulb</span>
                                <div>
                                    <p className="text-[10px] font-bold text-yellow-500 uppercase mb-0.5">Observação</p>
                                    <p className="text-sm text-main leading-snug">{activeExercise.notes}</p>
                                </div>
                            </div>
                        )}

                        {videoUrl && (
                            <div className="mb-4">
                                <button 
                                    onClick={() => setPreviewVideoModal({ isOpen: true, videoUrl: videoUrl, exerciseName: activeExercise.name })}
                                    className="flex items-center gap-3 text-primary text-sm font-bold hover:brightness-110 transition-all bg-primary/10 px-4 py-3 rounded-xl border border-primary/20 w-full justify-center group"
                                >
                                    <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">play_circle</span>
                                    Abrir Vídeo de Demonstração
                                    <span className="material-symbols-outlined text-sm ml-auto opacity-70">open_in_new</span>
                                </button>
                            </div>
                        )}

                        <div className="space-y-3">
                        {activeExercise.sets.map((set, index) => {
                            // FIND ORIGINAL TARGET
                            const originalEx = activeWorkout.originalExercises?.find(e => e.id === activeExercise.id);
                            const originalSet = originalEx?.sets.find(s => s.id === set.id);
                            const targetReps = originalSet?.reps;

                            return (
                            <div 
                            key={set.id} 
                            className={`flex items-center gap-3 p-3 ${originalSet && originalSet.weight > 0 ? 'pb-6' : ''} rounded-xl border transition-all duration-300 ${set.completed ? 'bg-primary/10 border-primary/20 scale-[1.02]' : 'bg-main/5 border-main/5'}`}
                            >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${set.completed ? 'bg-primary text-background' : 'bg-main/5 text-muted'}`}>
                                {index + 1}
                            </div>
                            <div className="flex-1 flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-3">
                                {activeExercise.type === 'CARDIO' ? (
                                    <>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={set.time || ''}
                                                disabled={true}
                                                className="w-full bg-main/5 rounded-lg py-2 pl-2 pr-12 text-center text-main font-bold outline-none cursor-not-allowed opacity-80"
                                                placeholder="00:00"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted uppercase font-black">Tempo</span>
                                        </div>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                inputMode="numeric"
                                                value={set.intensity || ''}
                                                disabled={true}
                                                className="w-full bg-main/5 rounded-lg py-2 pl-2 pr-8 text-center text-main font-bold outline-none cursor-not-allowed opacity-60"
                                                placeholder="1-5"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted uppercase font-black">Int.</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div id="tour-weight-input" className="flex-1 relative">
                                            <div className="relative h-10">
                                                <input 
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={set.weight === 0 ? '' : (set.weight || '')}
                                                    onChange={(e) => handleSetUpdate(activeExercise.id, set.id, 'weight', e.target.value)}
                                                    className="w-full h-full bg-main/5 rounded-xl px-3 pr-8 text-center text-main font-bold focus:ring-1 focus:ring-primary outline-none"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted uppercase leading-none pointer-events-none">kg</span>
                                            </div>
                                            {/* PREVIOUS WEIGHT HINT (Antes) */}
                                            {originalSet && originalSet.weight > 0 && (
                                                <div className="absolute -bottom-[20px] left-1/2 -translate-x-1/2 flex justify-center w-[120%] pointer-events-none z-10">
                                                    <span className="text-[9px] text-white font-black whitespace-nowrap bg-blue-600 px-2 h-[16px] rounded-full border border-blue-400 shadow-sm leading-none flex items-center justify-center gap-1 pointer-events-auto">
                                                        <span className="opacity-70 font-normal">Ant:</span>
                                                        {originalSet.weight}kg
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex-1 relative">
                                            <div className="relative h-10">
                                                <input 
                                                    type="number" 
                                                    value={(set.reps) || ''} 
                                                    disabled={true}
                                                    className="w-full h-full bg-main/5 rounded-xl px-3 pr-12 text-center text-main font-bold focus:ring-1 focus:ring-primary outline-none cursor-not-allowed"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted uppercase leading-none pointer-events-none">
                                                    {activeExercise.trackingMode === 'seconds' ? 'seg' : 'reps'}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}
                                </div>
                            </div>
                            <button 
                                id="tour-check-set"
                                onClick={() => toggleSetComplete(activeExercise.id, set.id, set.completed)}
                                className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${set.completed ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'bg-main/10 text-muted hover:bg-main/20'}`}
                            >
                                <span className="material-symbols-outlined">check</span>
                            </button>
                            </div>
                        )})}
                        </div>

                        {activeExercise.notes && activeExercise.sets.length > 1 && (
                            <div className="mt-4 mb-4 animate-enter px-2">
                                <div className="bg-amber-500/[0.03] dark:bg-amber-500/[0.01] border border-amber-500/20 rounded-2xl p-4 relative overflow-hidden">
                                    <div className="flex items-start gap-3 relative z-10">
                                        <div className="h-8 w-8 shrink-0 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                                            <span className="material-symbols-outlined text-xl">tips_and_updates</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Nota do Treinador</h4>
                                                <div className="h-px flex-1 bg-amber-500/10"></div>
                                            </div>
                                            <p className="text-sm text-main/90 leading-relaxed italic font-medium">
                                                "{activeExercise.notes}"
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeExercise.type === 'CARDIO' && (
                            <div className="mt-8 pt-6 border-t border-main/10">
                                <div className="bg-surface border border-main/5 rounded-[1.5rem] p-6 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4 px-1">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <span className="material-symbols-outlined text-xl">sticky_note_2</span>
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-bold text-main">Feedback do Cárdio</h5>
                                            <p className="text-[9px] text-muted font-medium">Regista a tua percepção do esforço</p>
                                        </div>
                                    </div>
                                    
                                    <div className="relative group">
                                        <textarea 
                                            value={cardioNotes[activeExercise.name] || ''}
                                            onChange={(e) => saveCardioNote(activeExercise.name, e.target.value)}
                                            rows={3}
                                            className="w-full bg-main/[0.03] hover:bg-main/[0.06] focus:bg-background border border-transparent focus:border-primary/30 rounded-2xl p-4 text-[11px] text-main outline-none transition-all resize-none shadow-inner leading-relaxed"
                                            placeholder="Ex: FC média 145bpm, senti-me bem..."
                                        />
                                        <div className="absolute bottom-3 right-3 opacity-20 group-focus-within:opacity-100 transition-opacity">
                                            <span className="material-symbols-outlined text-sm text-muted">edit_note</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-3 px-1 flex items-center gap-2">
                                        <div className="h-1 w-1 rounded-full bg-green-500"></div>
                                        <p className="text-[8px] text-muted font-medium">Auto-guardado: Estas notas são privadas e permanentes para ti.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {activeWorkout.exercises.length === 1 && (
                            <button 
                                onClick={handleFinishClick}
                                className="mt-6 w-full py-3 bg-primary hover:brightness-110 rounded-xl text-background text-sm font-bold transition-all shadow-lg shadow-[#2563EB]/20 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                                Finalizar Treino
                            </button>
                        )}
                        {activeWorkout.exercises.length > 1 && !(activeExercise.isSuperset || (activeExercise as any).is_superset) && (
                            <button 
                                onClick={skipExercise}
                                className="mt-6 w-full py-3 bg-primary hover:brightness-110 rounded-xl text-background text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95"
                            >
                                <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                Próximo Exercício
                            </button>
                        )}
                    </motion.div>
                    ) : (
                        <motion.div 
                            key="events-finished"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-10 text-muted"
                        >
                            <span className="material-symbols-outlined text-4xl mb-2">emoji_events</span>
                            <p>Treino Finalizado!</p>
                        </motion.div>
                    )}
                </AnimatePresence>

            {nextExercises.length > 0 && (
                <div className="space-y-3">
                <h3 className="text-sm font-black text-main uppercase tracking-wider px-1 opacity-70">Próximos</h3>
                
                {nextExercises.map((ex, i) => {
                    if (ex.isHeader) {
                        return (
                            <div key={ex.id} className="py-2 border-b border-main/5 animate-enter" style={{animationDelay: `${i*100}ms`}}>
                                <span className="text-primary font-bold text-sm uppercase tracking-widest">{ex.name}</span>
                            </div>
                        );
                    }
                    return (
                        <div key={ex.id} className="bg-surface/50 rounded-xl p-4 flex items-center gap-4 opacity-75 relative animate-enter" style={{animationDelay: `${i*100}ms`}}>
                        <div className="h-12 w-12 rounded-lg bg-main/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-muted">fitness_center</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-main">{ex.name}</h4>
                            <p className="text-xs text-muted">{ex.sets.length} séries</p>
                        </div>
                        {ex.notes && (
                            <span className="absolute top-2 right-2 text-yellow-500" title="Tem observação">
                                <span className="material-symbols-outlined text-sm">sticky_note_2</span>
                            </span>
                        )}
                        <span className="material-symbols-outlined text-zinc-600">drag_handle</span>
                        </div>
                    );
                })}
                </div>
            )}
        </main>
      </>
      )}

        {/* ... (rest of modals including CANCEL, SUBSTITUTE, TIMER, SUMMARY, REPORT, SUCCESS, SQL, EMPTY PLAN) ... */}
        {/* All modal code maintained from previous version */}
        {/* INCOMPLETE EXERCISE CONFIRMATION MODAL */}
        {showIncompleteConfirmModal && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center bg-background/90 backdrop-blur-md p-6 animate-enter">
                <div className="bg-surface w-full max-w-sm rounded-[2rem] p-8 border border-main/5 shadow-2xl relative animate-scale text-center">
                    <div className="h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4 text-yellow-500">
                        <span className="material-symbols-outlined text-4xl">pending_actions</span>
                    </div>
                    <h3 className="text-xl font-black text-main mb-2 uppercase tracking-tight">Séries em falta!</h3>
                    <p className="text-muted text-sm mb-6 leading-relaxed">
                        Ainda não marcaste todas as séries. Se avançares agora, <span className="text-main font-bold underline decoration-yellow-500/50">não poderás voltar</span> a este exercício nesta sessão.
                    </p>
                    
                    <div className="bg-main/5 rounded-xl p-4 mb-6 border border-main/5 text-left">
                        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase mb-1">
                            <span className="material-symbols-outlined text-sm">lightbulb</span>
                            Dica
                        </div>
                        <p className="text-[11px] text-muted leading-snug">
                            Se a máquina estiver ocupada ou não houver pesos, clica abaixo para <span className="text-main font-medium">Trocar Exercício</span> e fazer outro primeiro.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <button 
                            onClick={confirmIncompleteAction}
                            className="w-full h-12 rounded-xl bg-primary text-background font-black text-sm uppercase shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                        >
                            Sim, Ignorar e Avançar
                        </button>
                        
                        {activeWorkout.exercises.length > 1 && (
                            <button 
                                onClick={() => {
                                    setShowIncompleteConfirmModal(false);
                                    setIncompleteActionType(null);
                                    handleOpenSubstituteModal();
                                }}
                                className="w-full h-12 rounded-xl bg-main/10 text-main font-bold text-sm border border-main/10 hover:bg-main/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                                Trocar Exercício
                            </button>
                        )}

                        <button 
                            onClick={() => {
                                setShowIncompleteConfirmModal(false);
                                setIncompleteActionType(null);
                            }}
                            className="w-full h-12 rounded-xl text-muted font-bold text-xs hover:text-main transition-all"
                        >
                            Cancelar e Voltar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* CANCEL SESSION MODAL */}
        {showCancelModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 backdrop-blur-md p-6 animate-enter">
                <div className="bg-surface w-full max-w-sm rounded-3xl p-6 border border-main/10 shadow-2xl relative animate-scale text-center">
                    <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500">
                        <span className="material-symbols-outlined text-4xl">warning</span>
                    </div>
                    <h3 className="text-xl font-bold text-main mb-2">Cancelar Treino?</h3>
                    <p className="text-muted text-sm mb-6 leading-relaxed">
                        Se saíres agora, o progresso desta sessão será perdido e não será registado no histórico.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={() => setShowCancelModal(false)}
                            className="w-full h-12 rounded-xl bg-main/5 text-main font-bold hover:bg-main/10 transition-colors"
                        >
                            Continuar Treino
                        </button>
                        <button 
                            onClick={cancelSession}
                            className="w-full h-12 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        >
                            Sair e Perder Progresso
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* SUBSTITUTE EXERCISE MODAL */}
        {showSubstituteModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 animate-enter">
               <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-primary/20 shadow-2xl relative animate-scale flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-start mb-4">
                      <div>
                          <h3 className="text-xl font-bold text-main">Trocar Exercício</h3>
                          <p className="text-muted text-xs">Escolhe outro exercício do teu treino de hoje.</p>
                      </div>
                      <button onClick={() => setShowSubstituteModal(false)} className="text-muted hover:text-main">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                     {alternativeExercises.length === 0 ? (
                        <div className="text-center py-10 text-muted">
                            <span className="material-symbols-outlined text-3xl mb-2">sentiment_dissatisfied</span>
                            <p className="text-sm">Nenhum outro exercício disponível neste treino.</p>
                        </div>
                     ) : (
                        alternativeExercises.map(ex => (
                            <button
                                key={ex.id}
                                onClick={() => handleSelectAlternative(ex.name)}
                                className="w-full flex items-center gap-4 p-4 bg-main/5 hover:bg-main/10 border border-main/10 rounded-xl transition-colors text-left"
                            >
                                <span className="material-symbols-outlined text-primary text-xl">fitness_center</span>
                                <span className="font-bold text-main text-sm">{ex.name}</span>
                            </button>
                        ))
                     )}
                  </div>
               </div>
            </div>
        )}

        {/* WORKOUT SUMMARY MODAL */}
        {showSummary && (
            <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-md flex items-center justify-center animate-enter p-4">
                <div 
                    className="relative w-full max-w-sm bg-surface rounded-[40px] overflow-hidden shadow-2xl border border-main/5 animate-scale"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?q=80&w=600&auto=format&fit=crop')", backgroundSize: 'cover', backgroundPosition: 'center' }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40"></div>
                    <div className="relative z-10 flex flex-col items-center text-center p-8 h-full">
                        <div className="mb-6 mt-4">
                            <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.5)] animate-bounce">
                                <span className="material-symbols-outlined text-6xl text-background font-bold">check</span>
                            </div>
                        </div>
                        <h2 className="text-3xl font-black text-main mb-2 uppercase tracking-tight drop-shadow-lg">Treino Concluído!</h2>
                        <p className="text-muted-foreground text-sm mb-8 font-medium">Superaste os teus limites hoje.</p>
                        <div className="w-full grid grid-cols-2 gap-3 mb-8">
                            <div className="bg-main/10 backdrop-blur-md p-4 rounded-2xl border border-main/10 col-span-2 flex flex-col items-center justify-center relative overflow-hidden">
                                <span className="material-symbols-outlined absolute -right-2 -top-2 text-main/5 text-6xl">timer</span>
                                <p className="text-[10px] text-muted uppercase font-black mb-1 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">timer</span>
                                    Duração Total
                                </p>
                                <p className="text-4xl font-black text-main leading-none">{workoutStats.duration}</p>
                            </div>
                            <div className="bg-main/10 backdrop-blur-md p-5 rounded-2xl border border-main/10 flex flex-col items-center justify-center gap-1">
                                <p className="text-[10px] text-muted uppercase font-black flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">fitness_center</span>
                                    Exercícios
                                </p>
                                <p className="text-3xl font-black text-main leading-none">{workoutStats.exercises}</p>
                            </div>
                            <div className="bg-main/10 backdrop-blur-md p-5 rounded-2xl border border-main/10 flex flex-col items-center justify-center gap-1">
                                <p className="text-[10px] text-muted uppercase font-black flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">reorder</span>
                                    Séries
                                </p>
                                <p className="text-3xl font-black text-main leading-none">{workoutStats.sets}</p>
                            </div>
                        </div>

                        {/* SESSION PRs */}
                        {sessionPRs.length > 0 && (
                            <div className="w-full mb-8">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <div className="h-px flex-1 bg-main/10"></div>
                                    <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Recordes da Sessão</h3>
                                    <div className="h-px flex-1 bg-main/10"></div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {sessionPRs.map((pr, i) => (
                                        <div key={i} className="bg-main/5 border border-main/5 rounded-xl p-3 flex flex-col items-center justify-center animate-enter" style={{ animationDelay: `${500 + i * 100}ms` }}>
                                            <span className="material-symbols-outlined text-amber-400 text-lg mb-1">military_tech</span>
                                            <p className="text-[9px] text-muted font-bold truncate w-full uppercase mb-0.5">{pr.name}</p>
                                            <p className="text-sm font-black text-main leading-none">{pr.record}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="w-full space-y-3 mt-auto">
                            <button 
                                onClick={async () => {
                                    if (isSaving) return;
                                    setIsSaving(true);
                                    try {
                                        localStorage.removeItem(`workout_start_time_${activeWorkout.id}`);
                                        localStorage.removeItem(`workout_accumulated_${activeWorkout.id}`);
                                        localStorage.removeItem(`workout_completed_history_${activeWorkout.id}`);
                                        localStorage.removeItem('active_rest_end_time');
                                        await finishWorkout(workoutStats.durationSeconds);
                                        setShowSummary(false);
                                        setViewMode('REGISTRY');
                                    } catch (e) {
                                        console.error("Save error:", e);
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                disabled={isSaving}
                                className="w-full h-14 rounded-2xl bg-primary text-background font-black text-lg hover:brightness-110 shadow-lg shadow-[#2563EB]/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                                        Guardando...
                                    </>
                                ) : (
                                    'Guardar e Sair'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* REPORT MODAL & SUCCESS POPUP & SQL MODAL */}
        {showReportModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-enter">
               <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-red-500/20 shadow-2xl relative animate-scale">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                           <span className="material-symbols-outlined text-xl">{reportType === 'BUG' ? 'bug_report' : 'campaign'}</span>
                        </div>
                        <div>
                           <h3 className="text-lg font-bold text-main">{reportType === 'BUG' ? 'Relatar Bug' : 'Relatar Problema'}</h3>
                           <p className="text-muted text-[10px] font-bold uppercase tracking-tight">O teu PT será notificado</p>
                        </div>
                      </div>
                      <button onClick={() => setShowReportModal(false)} className="text-muted hover:text-main">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>
                  {activeExerciseName && (
                      <div className="bg-main/5 border border-main/10 rounded-lg p-3 mb-4 flex items-center gap-3">
                          <span className="material-symbols-outlined text-primary">fitness_center</span>
                          <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted uppercase font-bold">Referente a</p>
                              <p className="text-sm font-bold text-main truncate">{activeExerciseName}</p>
                          </div>
                      </div>
                  )}
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setReportType('BUG')}
                            className={`py-2 rounded-lg text-xs font-bold border transition-all ${reportType === 'BUG' ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20' : 'border-main/10 text-muted'}`}
                          >
                              Bug / App
                          </button>
                          <button 
                            onClick={() => setReportType('DOR')}
                            className={`py-2 rounded-lg text-xs font-bold border transition-all ${reportType === 'DOR' ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20' : 'border-main/10 text-muted'}`}
                          >
                              Dor / Lesão
                          </button>
                          <button 
                            onClick={() => setReportType('QUESTAO')}
                            className={`py-2 rounded-lg text-xs font-bold border transition-all ${reportType === 'QUESTAO' ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : 'border-main/10 text-muted'}`}
                          >
                              Dúvida
                          </button>
                          <button 
                            onClick={() => setReportType('OUTRO')}
                            className={`py-2 rounded-lg text-xs font-bold border transition-all ${reportType === 'OUTRO' ? 'bg-zinc-600 text-white border-zinc-600 shadow-md shadow-zinc-600/20' : 'border-main/10 text-muted'}`}
                          >
                              Outro
                          </button>
                      </div>
                      <textarea 
                          className="w-full bg-main/5 rounded-xl p-3 text-main border border-main/10 outline-none text-sm h-24 resize-none placeholder:text-zinc-600"
                          placeholder={reportType === 'BUG' ? "Descreve o bug ou problema técnico..." : "Descreve o que estás a sentir..."}
                          value={reportMessage}
                          onChange={(e) => setReportMessage(e.target.value)}
                      />
                      <button 
                          onClick={handleReportIssue}
                          disabled={!reportMessage.trim()}
                          className="w-full h-12 rounded-xl bg-primary text-background font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95"
                      >
                          Enviar {reportType === 'BUG' ? 'Bug Report' : 'Relato'}
                      </button>
                  </div>
               </div>
            </div>
        )}

        {showSuccessPopup && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-enter">
                <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-primary/20 shadow-2xl relative animate-scale">
                    <div className="flex flex-col items-center text-center">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary animate-pulse">
                            <span className="material-symbols-outlined text-4xl">check_circle</span>
                        </div>
                        <h3 className="text-xl font-bold text-main mb-2">Relato Enviado!</h3>
                        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                            O teu PT foi notificado e vai entrar em contato contigo brevemente.
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

      {/* REST TIMER OVERLAY */}
      {isRestRunning && (
        <div className="fixed inset-0 z-[300] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-enter">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent opacity-50"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center w-full max-w-sm">
                <span className="material-symbols-outlined text-6xl text-primary animate-pulse mb-4">timer</span>
                <h2 className="text-muted text-sm font-black uppercase tracking-widest mb-2">Tempo de Descanso</h2>
                
                <div className="text-8xl font-black text-main tabular-nums mb-8 drop-shadow-[0_0_30px_rgba(37,99,235,0.3)]">
                    {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full mb-12">
                    <button 
                        onClick={() => {
                            if (restEndTime) {
                                setRestEndTime(prev => (prev || Date.now()) + 30000);
                                setRestTimer(prev => prev + 30);
                            }
                        }}
                        className="h-16 rounded-2xl bg-main/5 border border-main/10 text-main font-bold flex flex-col items-center justify-center hover:bg-main/10 active:scale-95 transition-all text-xs uppercase tracking-tight"
                    >
                        <span className="material-symbols-outlined text-primary mb-1 text-lg">add</span>
                        +30s
                    </button>
                    <button 
                         onClick={() => {
                             setIsRestRunning(false);
                             setRestEndTime(null);
                             setRestTimer(parseRestTime(activeExercise?.restTime));
                         }}
                         className="h-16 rounded-2xl bg-primary text-background font-black flex flex-col items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20 text-xs uppercase tracking-tight"
                    >
                        <span className="material-symbols-outlined mb-1 text-lg">
                            {restTimer === 0 ? 'play_arrow' : 'skip_next'}
                        </span>
                        {restTimer === 0 ? 'Pronto' : 'Pular'}
                    </button>
                </div>
                
                <p className="text-muted text-[10px] font-medium max-w-[200px]">
                    Aproveita para respirar, hidratar e preparar a próxima série.
                </p>
            </div>
        </div>
      )}

      {/* PREVIEW VIDEO MODAL IN SESSION */}
      {previewVideoModal.isOpen && (
        <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl p-0 sm:p-4 animate-enter">
            <div className="bg-surface w-full sm:max-w-[420px] h-full sm:h-[90dvh] sm:rounded-[3rem] overflow-hidden shadow-2xl relative flex flex-col animate-scale">
                
                {/* Video Area - Aspect 9:16 (Reels/Shorts) */}
                <div className="flex-1 w-full bg-black relative flex items-center justify-center">
                    {previewVideoModal.videoUrl && (
                         <iframe 
                             src={`${previewVideoModal.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/').replace('youtube.com/shorts/', 'youtube.com/embed/')}?autoplay=1&modestbranding=1&rel=0`} 
                             className="w-full h-full"
                             allowFullScreen
                             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                         ></iframe>
                    )}
                </div>

                {/* Bottom Info Area */}
                <div className="bg-surface/80 backdrop-blur-xl p-6 pb-10 sm:pb-6 border-t border-main/5 flex flex-col gap-4">
                    <div className="flex flex-col">
                        <span className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-1">Vídeo de Execução</span>
                        <h3 className="text-2xl font-black text-main leading-tight">
                            {previewVideoModal.exerciseName}
                        </h3>
                    </div>
                    
                    <button 
                         onClick={() => setPreviewVideoModal(prev => ({ ...prev, isOpen: false }))}
                         className="w-full h-14 rounded-2xl bg-primary text-background font-black text-lg hover:brightness-110 shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        RETORNAR AO TREINO
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* SUPERSET FINISHED NOTIFICATION */}
      <AnimatePresence>
        {showSupersetFinished && (
            <motion.div 
                initial={{ opacity: 0, y: -100, x: "-50%", scale: 0.9 }}
                animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
                exit={{ opacity: 0, y: -100, x: "-50%", scale: 0.9 }}
                className="fixed top-24 left-1/2 z-[9999] bg-orange-600 text-white px-8 py-4 rounded-full shadow-[0_0_50px_rgba(234,88,12,0.4)] flex items-center gap-4 border-2 border-orange-400/50 backdrop-blur-xl w-[min(90vw,360px)]"
            >
                <div className="h-12 w-12 min-w-[48px] rounded-full bg-white/30 flex items-center justify-center animate-pulse">
                    <span className="material-symbols-outlined text-2xl">celebration</span>
                </div>
                <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 leading-none mb-1 text-white/80">Bloco de Treino</p>
                    <h4 className="font-black text-sm uppercase tracking-tight leading-tight">Supersérie Terminada!</h4>
                </div>
                <div className="h-8 w-8 rounded-full bg-black/10 flex items-center justify-center">
                   <span className="material-symbols-outlined text-sm">check</span>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      </div>
    );
  }

  // ----------------------------------------------------------------------
  // VIEW: REGISTRY (With Dynamic Tabs)
  // ----------------------------------------------------------------------
  
  // Use pure alphabetical workouts instead of strictly associating with days of week
  // The system is generic: A, B, C...

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <TourGuide 
        isOpen={isTourOpen} 
        steps={TOUR_STEPS} 
        onClose={() => handleTourFinished('registry')} 
        onComplete={() => handleTourFinished('registry')} 
      />
      <TourGuide 
        isOpen={isSessionTourOpen} 
        steps={SESSION_TOUR_STEPS} 
        onClose={() => handleTourFinished('session')} 
        onComplete={() => handleTourFinished('session')} 
      />

      {/* Header */}
      <header className="flex-none sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 animate-enter">
        <div className="flex items-center justify-between mb-4">
            <button onClick={() => setScreen(Screen.STUDENT_DASHBOARD)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
            </button>
            <h1 className="text-lg font-bold text-main">Meus Treinos</h1>
            <div className="w-10"></div>
        </div>

        {/* TAB SELECTOR - SIMPLE ROTATION */}
        <div id="tour-tabs" className="flex gap-2 justify-between bg-main/5 p-1.5 rounded-xl overflow-x-auto no-scrollbar w-full">
            {displayedTabs.map(tab => {
                const hasWorkout = true; // since derived from tabWorkouts directly
                
                return (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        className={`flex-1 min-w-[3rem] py-2.5 rounded-lg font-black transition-all whitespace-nowrap px-2 relative flex flex-col items-center justify-center
                            ${selectedTab === tab ? 'bg-primary text-background shadow-lg shadow-primary/20 scale-[1.02]' : 'text-muted hover:bg-main/5 hover:text-muted-foreground'}
                        `}
                    >
                        <span className="text-xl leading-none">{tab}</span>
                        {hasWorkout && selectedTab !== tab && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary/40 rounded-full"></span>
                        )}
                    </button>
                );
            })}
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 overflow-y-auto pb-24">
        {/* Workout Card for Selected Tab */}
        <div className="relative bg-card rounded-2xl p-5 border border-main/5 transition-all duration-300 animate-enter delay-100 shadow-xl overflow-hidden">
            {/* Added Background Image as requested */}
            {currentWorkout && (
                <>
                    <div 
                        className="absolute inset-0 bg-cover bg-center opacity-20" 
                        style={{ backgroundImage: "url('https://www.hussle.com/blog/wp-content/uploads/2020/12/Gym-structure-1080x675.png')" }}
                    ></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/60"></div>
                </>
            )}

            {isLoading ? (
                <div className="py-8 text-center relative z-10">
                    <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block"></span>
                </div>
            ) : currentWorkout ? (
                <div className="relative z-10 animate-enter-right">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <span className="bg-primary/20 text-primary text-base font-black px-4 py-1.5 rounded border border-primary/20 mb-2 inline-block">
                                {selectedTab}
                            </span>
                            <h2 className="text-main font-bold text-xl leading-tight drop-shadow-md">{currentWorkout.title}</h2>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-main/10 backdrop-blur-sm flex items-center justify-center border border-main/10">
                            <span className="material-symbols-outlined text-muted-foreground">fitness_center</span>
                        </div>
                    </div>
                    
                    <p className="text-muted text-sm mb-6 leading-relaxed">
                        {currentWorkout.description || 'Treino focado em resultados.'}
                    </p>
                    
                    <button 
                        id="tour-start-workout"
                        onClick={() => {
                            if (currentWorkout?.isCompletedToday) {
                                // Reconstruct stats from previewExercises
                                const totalSeconds = currentWorkout.duration_seconds || 0;
                                const minutes = Math.floor(totalSeconds / 60);
                                const seconds = totalSeconds % 60;
                                const durationStr = `${minutes}m ${seconds}s`;

                                const stats = {
                                    durationSeconds: totalSeconds,
                                    duration: durationStr,
                                    exercises: previewExercises.length,
                                    sets: previewExercises.reduce((acc: number, ex: any) => acc + (ex.workout_sets?.length || 0), 0)
                                };
                                setWorkoutStats(stats as any);
                                setSessionPRs([]); // We don't have session PRs historical data easily available here
                                setShowSummary(true);
                            } else {
                                startSession();
                            }
                        }}
                        disabled={isRestDay && !currentWorkout?.isCompletedToday && !currentWorkout?.inProgress}
                        className={`w-full h-12 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 mb-6 active:scale-95 group ${(isRestDay && !currentWorkout?.isCompletedToday && !currentWorkout?.inProgress) ? 'bg-zinc-300 dark:bg-zinc-700 text-muted cursor-not-allowed shadow-none' : 'bg-primary text-background hover:brightness-110 shadow-primary/20'}`}
                    >
                        {currentWorkout?.isCompletedToday ? (
                            <>
                                <span className="material-symbols-outlined text-lg">analytics</span>
                                Ver Sumário do Treino
                            </>
                        ) : isRestDay && !currentWorkout?.inProgress ? (
                            <>
                                <span className="material-symbols-outlined text-lg">bedtime</span>
                                Dia de Descanso
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                                    play_arrow
                                </span>
                                {currentWorkout?.inProgress ? 'Retomar Treino' : 'Começar Agora'}
                            </>
                        )}
                    </button>

                    {/* PREVIEW EXERCISES LIST */}
                    <div>
                        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Resumo do Treino</h3>
                        {isLoadingPreview ? (
                            <div className="space-y-2">
                                <div className="h-10 bg-main/5 rounded-lg animate-pulse"></div>
                                <div className="h-10 bg-main/5 rounded-lg animate-pulse"></div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {previewExercises.map((ex, i) => {
                                    if (ex.is_header) {
                                        return (
                                            <div key={ex.id} className="pt-2 pb-1 border-b border-main/5 animate-enter" style={{animationDelay: `${i * 50}ms`}}>
                                                <span className="text-primary font-bold text-[10px] uppercase tracking-widest">{ex.name}</span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <button 
                                            key={ex.id} 
                                            onClick={() => openVideoPreview(ex.name)}
                                            className="w-full text-left bg-main/5 backdrop-blur-sm rounded-lg p-3 border border-main/5 flex flex-col gap-1 hover:bg-main/10 transition-all active:scale-[0.98] animate-enter relative group" 
                                            style={{animationDelay: `${i * 50}ms`}}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-main group-hover:text-primary transition-colors">{ex.name}</span>
                                                <div className="flex items-center gap-2">
                                                    {/* Corrected Set Count Display */}
                                                    <span className="text-xs text-muted">{ex.workout_sets?.length || 0} séries</span>
                                                    <span className="material-symbols-outlined text-muted text-sm group-hover:text-primary group-hover:scale-110 transition-all">play_circle</span>
                                                </div>
                                            </div>
                                            {/* NOTE DISPLAY IN PREVIEW */}
                                            {(() => {
                                                const displayNotes = ex.notes?.replace(/\[(TIME|REPS)_BASED\]/g, '').trim();
                                                if (!displayNotes) return null;
                                                return (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className="material-symbols-outlined text-[10px] text-yellow-500">info</span>
                                                        <p className="text-[9px] text-yellow-500 font-medium leading-tight">
                                                            {displayNotes}
                                                        </p>
                                                    </div>
                                                );
                                            })()}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="py-10 text-center animate-enter flex flex-col items-center relative z-10">
                    <span className="material-symbols-outlined text-4xl text-zinc-600 mb-2">bedtime</span>
                    <p className="text-main font-bold">Descanso</p>
                    <p className="text-muted text-xs mt-1">
                        {selectedTab
                            ? `Nenhum treino encontrado para a letra ${selectedTab}.`
                            : "Hoje é dia de descanso."
                        }
                    </p>
                </div>
            )}
        </div>

        {/* Consistência Semanal */}
        <section id="tour-consistency" className="animate-enter delay-200">
          <h3 className="font-bold text-main text-base mb-3 px-1">Consistência Semanal</h3>
          <div className="bg-surface p-4 rounded-xl border border-main/5">
            {loadingStats ? (
                <div className="h-20 flex items-center justify-center">
                    <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                </div>
            ) : (
              <>
                <div className="flex justify-around items-center">
                  {weekDaysShort.map((day, index) => (
                    <div key={index} className="flex flex-col items-center gap-2">
                      <p className={`text-xs font-bold ${index === todayIndex ? 'text-primary' : 'text-muted'}`}>{day}</p>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${index === todayIndex ? 'border-primary scale-110' : 'border-transparent'}`}>
                        <div className={`w-full h-full rounded-full flex items-center justify-center transition-colors ${weeklyConsistency.completedDays.includes(index) ? 'bg-primary' : 'bg-main/5'}`}>
                          {weeklyConsistency.completedDays.includes(index) && <span className="material-symbols-outlined text-background text-base leading-6 animate-scale">check</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center border-t border-main/5 pt-3">
                  <p className="text-sm font-bold text-main">
                    Completaste <span className="text-primary">{weeklyConsistency.completed}</span> de <span className="text-main">{weeklyConsistency.planned}</span> treinos planeados.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Meus Recordes (PR) */}
        <section id="tour-prs" className="animate-enter delay-300">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="font-bold text-main text-base">Meus Recordes (PR)</h3>
            <button
              onClick={() => setScreen(Screen.PERFORMANCE_HISTORY)}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              Ver detalhes <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
          {isLoadingPRs ? (
            <div className="grid grid-cols-2 gap-3">
                {[...Array(3)].map((_, i) => <div key={i} className="bg-surface h-24 rounded-xl border border-main/5 animate-pulse"></div>)}
            </div>
          ) : personalRecords.length === 0 ? (
            <div className="bg-surface p-4 rounded-xl border border-main/5 text-center text-muted text-sm">
                Nenhum recorde encontrado ainda.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
                {personalRecords.map((pr, i) => (
                <div key={pr.name} className="bg-surface p-4 rounded-xl border border-main/5 text-center flex flex-col items-center justify-center gap-1 animate-enter" style={{animationDelay: `${i * 100}ms`}}>
                    <span className="material-symbols-outlined text-amber-400 text-2xl drop-shadow-md">military_tech</span>
                    <p className="text-xs text-muted font-medium truncate w-full">{pr.name}</p>
                    <p className="text-lg font-bold text-main">{pr.record}</p>
                </div>
                ))}
            </div>
          )}
        </section>
      </main>

      

      {/* EMPTY PLAN MODAL */}
      {showEmptyPlanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md p-6 animate-enter">
           <div className="bg-surface w-full max-w-sm rounded-3xl p-8 border border-primary/20 shadow-2xl relative animate-scale">
              <div className="flex flex-col items-center text-center">
                 <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary shadow-lg shadow-primary/10 animate-pulse">
                    <span className="material-symbols-outlined text-4xl">fitness_center</span>
                 </div>
                 
                 <h2 className="text-2xl font-bold text-main mb-3">Sem Treino Definido</h2>
                 <p className="text-muted text-sm mb-8 leading-relaxed">
                    Ainda não possuis um plano de treino registado. Solicita a criação do teu treino ao teu PT.
                 </p>
                 
                 <div className="w-full space-y-3">
                    <button 
                        onClick={openTrainerChat}
                        className="w-full h-14 rounded-xl bg-primary text-background font-bold text-lg hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95"
                    >
                        <span className="material-symbols-outlined">chat</span>
                        Falar com o PT
                    </button>
                    
                    <button 
                        onClick={onBack}
                        className="w-full h-12 rounded-xl bg-main/5 text-muted font-bold hover:bg-main/10 hover:text-main transition-colors"
                    >
                        Voltar ao Início
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* PREVIEW VIDEO MODAL */}
      {previewVideoModal.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-enter">
            <div className="bg-surface w-full max-w-[380px] h-[85vh] max-h-[750px] rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-main/10 animate-scale relative flex flex-col">
                {/* Status Bar Decor */}
                <div className="h-6 w-full flex justify-center items-end pb-1">
                    <div className="w-20 h-1 rounded-full bg-main/10"></div>
                </div>
                
                <div className="flex-1 flex flex-col p-6 pt-2 overflow-hidden">
                    <div className="mb-4">
                        <h3 className="text-xl font-black text-main flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">fitness_center</span>
                            {previewVideoModal.exerciseName}
                        </h3>
                        <p className="text-muted text-[10px] uppercase font-black tracking-[0.2em] mt-0.5 ml-8">Modo Reels / Mobile</p>
                    </div>
                    
                    <div className="flex-1 w-full bg-black rounded-3xl overflow-hidden border border-main/10 relative shadow-2xl group">
                        {previewVideoModal.videoUrl && (
                             <iframe 
                                 src={previewVideoModal.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/').replace('youtube.com/shorts/', 'youtube.com/embed/')} 
                                 className="w-full h-full object-cover"
                                 allowFullScreen
                                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                             ></iframe>
                        )}
                        {!previewVideoModal.videoUrl && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted/50 bg-main/5">
                                <span className="material-symbols-outlined text-5xl animate-pulse">videocam_off</span>
                                <p className="text-sm font-bold uppercase tracking-widest text-center px-4">Vídeo indisponível ou em carregamento</p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 mt-6">
                        <button 
                             onClick={() => setPreviewVideoModal(prev => ({ ...prev, isOpen: false }))}
                             className="w-full h-14 rounded-2xl bg-primary text-background font-black text-lg hover:brightness-110 shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <span className="material-symbols-outlined">play_circle</span>
                            FECHAR
                        </button>
                        
                        {previewVideoModal.videoUrl && !previewVideoModal.videoUrl.includes('youtube') && (
                            <a 
                                href={previewVideoModal.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-10 flex items-center justify-center gap-2 text-primary text-xs font-bold hover:bg-primary/5 rounded-xl transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                VER LINK ORIGINAL
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

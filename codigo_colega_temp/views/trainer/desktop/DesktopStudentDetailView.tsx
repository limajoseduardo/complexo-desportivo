
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight,
  Dumbbell, 
  TrendingUp, 
  MessageSquare, 
  Settings, 
  Calendar,
  Clock,
  Activity,
  Droplets,
  MoreHorizontal,
  Plus,
  ArrowRight,
  Target,
  AlertTriangle,
  Check,
  Ruler,
  Scale,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApp } from '../../../contexts/AppContext';
import { Screen, UserRole } from '../../../types';
import { supabase } from '../../../lib/supabaseClient';
import { motion } from 'motion/react';
import WorkoutCreatorView from '../WorkoutCreatorView';
import DietCreatorView from '../DietCreatorView';
import TrainerEditWorkoutView from '../TrainerEditWorkoutView';
import TrainerEditDietView from '../TrainerEditDietView';
import TrainerEditStudentView from '../TrainerEditStudentView';

export default function DesktopStudentDetailView({ onBack }: { onBack: () => void }) {
  const { viewingStudent, setScreen, startChat, clearViewingStudent, sendPushNotification } = useApp();
  const [activeSegment, setActiveSegment] = useState<'overview' | 'workouts' | 'diet' | 'progress'>('overview');
  const [isCreatingWorkout, setIsCreatingWorkout] = useState(false);
  const [isCreatingDiet, setIsCreatingDiet] = useState(false);
  const [isEditingWorkout, setIsEditingWorkout] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [lastWorkoutDate, setLastWorkoutDate] = useState<string | null>(null);
  const [weightHistory, setWeightHistory] = useState<any[]>([]);

  // Performance Data State
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(true);
  const [allPerformanceData, setAllPerformanceData] = useState<any[]>([]);
  const [allWorkoutsHistory, setAllWorkoutsHistory] = useState<any[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<Record<string, string>>({});
  const [timeRange, setTimeRange] = useState('1m');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<'weight' | 'est1rm'>('weight');

  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  const calculateAge = (birthdate: string) => {
    if (!birthdate || birthdate.length < 10) return 25;
    try {
        const parts = birthdate.split('/');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        const today = new Date();
        let age = today.getFullYear() - year;
        const m = today.getMonth() - (month - 1);
        if (m < 0 || (m === 0 && today.getDate() < day)) {
            age--;
        }
        return age || 25;
    } catch (e) {
        return 25;
    }
  };

  const calculatedMacros = useMemo(() => {
    const p = studentProfile || viewingStudent;
    if (!p || !p.weight || !p.height) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    // Simple BMR + TDEE estimation for fallback
    const weight = parseFloat(p.weight);
    const height = parseFloat(p.height) < 3 ? parseFloat(p.height) * 100 : parseFloat(p.height);
    const age = calculateAge(p.birthdate || '');
    const gender = p.gender || 'MALE';
    
    let bmr = gender === 'FEMALE' 
        ? Math.round(655 + (9.6 * weight) + (1.8 * height) - (4.7 * age))
        : Math.round(66 + (13.7 * weight) + (5 * height) - (6.8 * age));
        
    const tdee = Math.round(bmr * 1.55); // Assumed active
    const protein = Math.round(weight * 2.2);
    const fat = Math.round(weight * 1);
    const carbs = Math.max(0, Math.round((tdee - (protein * 4) - (fat * 9)) / 4));
    
    return { calories: tdee, protein, carbs, fat };
  }, [studentProfile, viewingStudent]);

  const fetchProfile = useCallback(async () => {
      if (!viewingStudent?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', viewingStudent.id)
        .single();
      if (data) {
          setStudentProfile(data);
      }
  }, [viewingStudent?.id]);

  useEffect(() => {
    if (!viewingStudent?.id) return;
    
    
    // Fetch last completed workout date
    const fetchLastWorkout = async () => {
      const { data } = await supabase
        .from('workouts')
        .select('completed_at')
        .eq('assigned_student_id', viewingStudent.id)
        .eq('completed', true)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setLastWorkoutDate(data.completed_at);
    };

    // Fetch weight history
    const fetchWeight = async () => {
      const { data } = await supabase
        .from('weight_history')
        .select('*')
        .eq('user_id', viewingStudent.id)
        .order('date', { ascending: false });
      if (data) setWeightHistory(data || []);
    };

    fetchProfile();
    fetchLastWorkout();
    fetchWeight();
    
    // Fetch workouts with exercise and set counts
    const fetchWorkouts = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_exercises (
            id,
            name,
            workout_sets (id)
          )
        `)
        .eq('assigned_student_id', viewingStudent.id)
        .order('created_at', { ascending: false });

      if (data) {
        // Filter out history and archived workouts
        const activeData = data.filter((w: any) => 
          w.day_label && 
          !w.day_label.startsWith('ARCHIVED_') && 
          !w.day_label.startsWith('HISTORY_')
        );

        // Group by day_label and keep the most recent ONE for each label
        const uniqueWorkoutsMap = new Map();
        activeData.forEach(w => {
          const label = w.day_label || 'A';
          if (!uniqueWorkoutsMap.has(label)) {
            uniqueWorkoutsMap.set(label, w);
          }
        });
        
        const latestUniqueWorkouts = Array.from(uniqueWorkoutsMap.values())
          .sort((a, b) => (a.day_label || '').localeCompare(b.day_label || ''));

        const enrichedWorkouts = latestUniqueWorkouts.map(w => {
          const exerciseNames = w.workout_exercises?.map((ex: any) => ex.name) || [];
          const exerciseCount = w.workout_exercises?.length || 0;
          const totalSets = w.workout_exercises?.reduce((acc: number, ex: any) => acc + (ex.workout_sets?.length || 0), 0) || 0;
          return { ...w, exerciseCount, totalSets, exerciseNames };
        });
        setWorkouts(enrichedWorkouts);
      }
    };

    fetchWorkouts();
      
    // Fetch performance history data
    const fetchPerformance = async () => {
      if (!viewingStudent?.id) return;
      setIsLoadingPerformance(true);
      try {
        const { data: libraryData } = await supabase.from('exercise_library').select('name, primary_muscle');
        const libMap: Record<string, string> = {};
        if (libraryData) {
          libraryData.forEach((item: any) => {
            if (item.name && item.primary_muscle) {
              libMap[item.name] = item.primary_muscle.split(',')[0].trim();
            }
          });
        }
        setExerciseLibrary(libMap);

        const { data } = await supabase
          .from('workouts')
          .select(`
            id,
            day_label,
            created_at,
            completed_at,
            completed,
            duration_seconds,
            workout_exercises (
              name,
              workout_sets (
                reps,
                weight,
                time,
                intensity,
                notes,
                completed
              )
            )
          `)
          .eq('assigned_student_id', viewingStudent.id)
          .eq('completed', true);

        if (data) {
          const uniqueDataMap = new Map();
          data.forEach(w => {
            const dateKey = w.completed_at || w.created_at;
            if (!uniqueDataMap.has(dateKey) || (w.day_label && w.day_label.startsWith('HISTORY_'))) {
              uniqueDataMap.set(dateKey, w);
            }
          });
          const uniqueData = Array.from(uniqueDataMap.values());
          
          const flattenedData = uniqueData.flatMap(workout => 
            workout.workout_exercises.flatMap((exercise: any) => {
              const sessionSets = exercise.workout_sets?.filter((s: any) => s.completed).length || 0;
              return (exercise.workout_sets || [])
                .filter((s: any) => s.completed === true)
                .map((set: any) => {
                  const weight = set.weight || 0;
                  const reps = set.reps || 0;
                  return {
                    date: workout.completed_at || workout.created_at,
                    name: exercise.name,
                    reps,
                    weight,
                    time: set.time,
                    intensity: set.intensity,
                    notes: set.notes,
                    est1rm: weight > 0 ? (reps === 1 ? weight : weight * (1 + 0.0333 * reps)) : 0,
                    sets: sessionSets
                  }
                })
            })
          );

          const workoutsList = uniqueData.map(w => ({
            date: w.completed_at || w.created_at,
            duration: w.duration_seconds || (45 * 60)
          })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          setAllPerformanceData(flattenedData);
          setAllWorkoutsHistory(workoutsList);
        }
      } catch (e) {
        console.error("Perf fetch failed", e);
      } finally {
        setIsLoadingPerformance(false);
      }
    };

    fetchPerformance();
  }, [viewingStudent?.id, isCreatingWorkout, isCreatingDiet, isEditingWorkout]);

  useEffect(() => {
    // Profiling macros handled by TrainerEditDietView
  }, [studentProfile]);

  const getTimeRanges = useCallback(() => {
    const endCurrent = new Date();
    let startCurrent = new Date();
    let endPrev = new Date();
    let startPrev = new Date();

    if (timeRange === 'Tudo') {
      startCurrent = new Date(2000, 0, 1);
      startPrev = new Date(1990, 0, 1);
      endPrev = new Date(1999, 11, 31);
    } else {
      switch(timeRange) {
        case '1s': 
          startCurrent.setDate(endCurrent.getDate() - 7); 
          endPrev = new Date(startCurrent);
          startPrev.setDate(startCurrent.getDate() - 7);
          break;
        case '1m': 
          startCurrent.setMonth(endCurrent.getMonth() - 1); 
          endPrev = new Date(startCurrent);
          startPrev.setMonth(startCurrent.getMonth() - 1);
          break;
        case '3M': 
          startCurrent.setMonth(endCurrent.getMonth() - 3); 
          endPrev = new Date(startCurrent);
          startPrev.setMonth(startCurrent.getMonth() - 3);
          break;
        case '6m': 
          startCurrent.setMonth(endCurrent.getMonth() - 6); 
          endPrev = new Date(startCurrent);
          startPrev.setMonth(startCurrent.getMonth() - 6);
          break;
        case '1ano': 
          startCurrent.setFullYear(endCurrent.getFullYear() - 1); 
          endPrev = new Date(startCurrent);
          startPrev.setFullYear(startCurrent.getFullYear() - 1);
          break;
        default:
          startCurrent.setMonth(endCurrent.getMonth() - 1);
          endPrev = new Date(startCurrent);
          startPrev.setMonth(startCurrent.getMonth() - 1);
      }
    }
    return { startCurrent, endCurrent, startPrev, endPrev };
  }, [timeRange]);

  const workoutsInTimeRange = useMemo(() => {
    const { startCurrent, endCurrent } = getTimeRanges();
    return allWorkoutsHistory.filter(w => new Date(w.date) >= startCurrent && new Date(w.date) <= endCurrent);
  }, [allWorkoutsHistory, getTimeRanges]);

  const workoutsInPrevRange = useMemo(() => {
    const { startPrev, endPrev } = getTimeRanges();
    return allWorkoutsHistory.filter(w => new Date(w.date) >= startPrev && new Date(w.date) <= endPrev);
  }, [allWorkoutsHistory, getTimeRanges]);

  const kpis = useMemo(() => {
    const currentWorkoutsCount = workoutsInTimeRange.length;
    const prevWorkoutsCount = workoutsInPrevRange.length;
    
    const currentDuration = workoutsInTimeRange.reduce((acc, curr) => acc + curr.duration, 0);
    const prevDuration = workoutsInPrevRange.reduce((acc, curr) => acc + curr.duration, 0);

    const calcGrowth = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? '+100%' : '0%';
        const g = ((curr - prev) / prev) * 100;
        return `${g > 0 ? '+' : ''}${Math.round(g)}%`;
    };

    return { 
        workoutsCompleted: currentWorkoutsCount,
        workoutsGrowth: calcGrowth(currentWorkoutsCount, prevWorkoutsCount),
        durationHours: Math.round(currentDuration / 3600),
        durationGrowth: calcGrowth(currentDuration, prevDuration),
    };
  }, [workoutsInTimeRange, workoutsInPrevRange]);

  const dataInTimeRange = useMemo(() => {
    const { startCurrent, endCurrent } = getTimeRanges();
    return allPerformanceData.filter(d => new Date(d.date) >= startCurrent && new Date(d.date) <= endCurrent);
  }, [allPerformanceData, getTimeRanges]);

  const exerciseList = useMemo(() => {
    const exerciseMap = new Map<string, { record: number, allLifts: any[] }>();
    dataInTimeRange.forEach(item => {
      if (!exerciseMap.has(item.name)) {
        exerciseMap.set(item.name, { record: 0, allLifts: [] });
      }
      const existing = exerciseMap.get(item.name)!;
      if (item.weight > existing.record) existing.record = item.weight;
      existing.allLifts.push({ date: item.date, weight: item.weight });
    });

    return Array.from(exerciseMap.entries()).map(([name, data]) => {
      const sortedLifts = [...data.allLifts].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const uniqueWeights = [...new Set(sortedLifts.map(l => l.weight))];
      let change = 0;
      if (uniqueWeights.length > 1) {
        change = uniqueWeights[uniqueWeights.length - 1] - uniqueWeights[uniqueWeights.length - 2];
      }
      return {
        name,
        muscleGroup: exerciseLibrary[name] || 'Outros',
        record: `${data.record}kg`,
        change: `${change >= 0 ? '+' : ''}${change.toFixed(1)}kg`
      }
    }).sort((a, b) => parseFloat(b.record) - parseFloat(a.record));
  }, [dataInTimeRange, exerciseLibrary]);

  const allTimeExerciseRecords = useMemo(() => {
    const exerciseMap = new Map<string, { record: number }>();
    allPerformanceData.forEach(item => {
      if (!exerciseMap.has(item.name)) {
        exerciseMap.set(item.name, { record: 0 });
      }
      const existing = exerciseMap.get(item.name)!;
      if (item.weight > existing.record) {
        existing.record = item.weight;
      }
    });

    return Array.from(exerciseMap.entries()).map(([name, data]) => ({
      name,
      record: `${data.record}kg`,
      value: data.record
    })).sort((a, b) => b.value - a.value);
  }, [allPerformanceData]);

  const topRecords = useMemo(() => {
    if (allTimeExerciseRecords.length === 0) return [];
    
    const priorityLifts = ['Supino Reto', 'Agachamento', 'Agachamento Livre', 'Peso Morto', 'Levantamento Terra'];
    
    const sorted = [...allTimeExerciseRecords].sort((a, b) => {
        const aIsPrio = priorityLifts.includes(a.name);
        const bIsPrio = priorityLifts.includes(b.name);
        if (aIsPrio && !bIsPrio) return -1;
        if (!aIsPrio && bIsPrio) return 1;
        return b.value - a.value;
    });
    
    return sorted.slice(0, 3);
  }, [allTimeExerciseRecords]);

  const muscleDistribution = useMemo(() => {
     const map = new Map<string, number>();
     let total = 0;
     dataInTimeRange.forEach(d => {
        const m = exerciseLibrary[d.name] || 'Outros';
        const cur = map.get(m) || 0;
        map.set(m, cur + 1);
        total += 1;
     });
     const sorted = Array.from(map.entries()).sort((a,b) => b[1] - a[1]);
     return { sorted, total };
  }, [dataInTimeRange, exerciseLibrary]);

  const groupedExercises: Record<string, any[]> = useMemo(() => {
    const groups: Record<string, any[]> = {};
    exerciseList.forEach(ex => {
      if (!groups[ex.muscleGroup]) groups[ex.muscleGroup] = [];
      groups[ex.muscleGroup].push(ex);
    });
    return groups;
  }, [exerciseList]);

  useEffect(() => {
    if (!selectedExercise && exerciseList.length > 0) {
      setSelectedExercise(exerciseList[0].name);
    }
  }, [exerciseList, selectedExercise]);

  const { chartData, historyData, exerciseStats } = useMemo<{ chartData: any[], historyData: any[], exerciseStats: any }>(() => {
    if (!selectedExercise) return { chartData: [], historyData: [], exerciseStats: null };
    const exerciseData = dataInTimeRange
      .filter(item => item.name === selectedExercise)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const dailyStatsMap = new Map<string, { weight: number, est1rm: number }>();
    [...exerciseData].reverse().forEach(item => {
      const dateKey = new Date(item.date).toLocaleDateString('pt-BR');
      if (!dailyStatsMap.has(dateKey)) dailyStatsMap.set(dateKey, { weight: 0, est1rm: 0 });
      const stats = dailyStatsMap.get(dateKey)!;
      stats.weight = Math.max(stats.weight, item.weight);
      stats.est1rm = Math.max(stats.est1rm, item.est1rm);
    });

    const chart = Array.from(dailyStatsMap.entries())
      .map(([date, stats], index) => ({ date, ...stats, index: index + 1 }));

    const historyMap = new Map<string, any>();
    exerciseData.forEach(item => {
      // Usar apenas a data (dia) como chave para evitar duplicatas do mesmo treino
      const dateKey = new Date(item.date).toLocaleDateString('pt-BR');
      if (!historyMap.has(dateKey) || item.weight > historyMap.get(dateKey).weight) {
        historyMap.set(dateKey, item);
      }
    });

    const history = Array.from(historyMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map(item => ({
        date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        reps: item.reps,
        sets: item.sets,
        load: `${item.weight} kg`,
        time: item.time,
        intensity: item.intensity,
        notes: item.notes,
        est1rm: `${item.est1rm.toFixed(1)} kg`
      }));

    let maxWeight = 0;
    exerciseData.forEach(item => { if (item.weight > maxWeight) maxWeight = item.weight; });

    return { chartData: chart, historyData: history, exerciseStats: { maxWeight } };
  }, [selectedExercise, dataInTimeRange]);

  const weightChartData = useMemo(() => {
    const { startCurrent, endCurrent } = getTimeRanges();
    return weightHistory
      .filter(item => new Date(item.date) >= startCurrent && new Date(item.date) <= endCurrent)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        weight: item.weight
      }));
  }, [weightHistory, getTimeRanges]);

  const studentData = useMemo(() => {
    if (!studentProfile) return viewingStudent;
    return {
      ...viewingStudent,
      ...(studentProfile || {}),
      trainingFrequency: studentProfile.training_frequency || viewingStudent?.trainingFrequency,
      restDays: studentProfile.rest_days || viewingStudent?.restDays
    } as any;
  }, [viewingStudent, studentProfile]);


  if (!viewingStudent) return null;

  const currentHeight = studentProfile?.height || viewingStudent.height;
  const h = parseFloat(currentHeight || 0);
  const hInCm = h < 3 ? h * 100 : h;                
  const currentWeight = weightHistory.length > 0 ? weightHistory[0].weight : (studentProfile?.weight || viewingStudent.weight);
  const initialWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : (studentProfile?.initial_weight || studentProfile?.weight || viewingStudent.weight);

  const stats = [
    { label: 'Peso Inicial', value: `${initialWeight || '--'}kg`, icon: History, color: 'text-blue-400' },
    { label: 'Altura', value: `${hInCm || '--'}cm`, icon: Ruler, color: 'text-emerald-400' },
    { label: 'Peso Atual', value: `${currentWeight || '--'}kg`, icon: Scale, color: 'text-amber-400' },
    { label: 'Peso Ideal', value: `${hInCm ? (hInCm - 100).toFixed(1) : '--'}kg`, icon: Target, color: 'text-rose-400' },
  ];

  const formatLastWorkout = (dateStr: string | null) => {
    if (!dateStr) return 'Sem treinos registados';
    const date = new Date(dateStr);
    const now = new Date();
    
    // Set both to midnight to compare calendar days
    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Treinou hoje';
    if (diffDays === 1) return 'Último treino ontem';
    return `Último treino há ${diffDays} dias`;
  };

  const formatEnrollment = (dateStr: string | null) => {
    if (!dateStr) return 'Inscrito recentemente';
    const date = new Date(dateStr);
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `Inscrito em ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    return (new Date().getTime() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
  };

  const getAlert = () => {
    const alerts = [];
    
    // Workout Alert
    if (lastWorkoutDate) {
      const daysSinceWorkout = Math.floor((new Date().getTime() - new Date(lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceWorkout > 7) {
        alerts.push({
          type: 'training',
          title: 'Treino em Atraso',
          message: `${viewingStudent.name} não treina há ${daysSinceWorkout} dias. É importante verificar o que se passa.`,
          color: 'bg-red-500',
          shadow: 'shadow-red-500/20'
        });
      }
    } else {
      alerts.push({
        type: 'training',
        title: 'Sem Treinos',
        message: `${viewingStudent.name} ainda não registou nenhum treino na plataforma.`,
        color: 'bg-amber-500',
        shadow: 'shadow-amber-500/20'
      });
    }

    // Weight Alert
    if (weightHistory.length > 0) {
      const lastEntryDate = new Date(weightHistory[0].date);
      const daysSinceWeight = Math.floor((new Date().getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceWeight > 2) {
        alerts.push({
          type: 'weight',
          title: 'Registo de Peso em Falta',
          message: `${viewingStudent.name} não regista alterações de peso há ${daysSinceWeight} dias.`,
          color: 'bg-amber-600',
          shadow: 'shadow-amber-600/20'
        });
      } else if (weightHistory.length >= 3) {
        // Results stagnation check
        const recent = weightHistory.slice(0, 3);
        const diff = recent[0].weight - recent[2].weight;
        const absDiff = Math.abs(diff);

        if (absDiff < 0.2) {
           alerts.push({
            type: 'results',
            title: 'Alerta de Estagnação',
            message: `O peso do ${viewingStudent.name.split(' ')[0]} não variou significativamente nas últimas 3 pesagens. Talvez seja altura de ajustar as macros.`,
            color: 'bg-amber-500',
            shadow: 'shadow-amber-500/20'
          });
        }
      }
    } else {
      alerts.push({
        type: 'weight',
        title: 'Sem Registo de Peso',
        message: `${viewingStudent.name} ainda não registou o peso na plataforma.`,
        color: 'bg-amber-600',
        shadow: 'shadow-amber-600/20'
      });
    }

    // Retorna o alerta de peso com prioridade se existir
    return alerts.find(a => a.type === 'weight') || alerts[0] || null;
  };

  const activeAlert = getAlert();


  if (isCreatingWorkout) {
    return (
       <div className="bg-white dark:bg-[#111827] rounded-3xl h-full overflow-hidden border border-black/5 dark:border-white/5 flex flex-col pt-4">
          <div className="px-6 pb-2 border-b border-black/5 dark:border-white/5 flex items-center gap-4">
             <button onClick={() => setIsCreatingWorkout(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"><ChevronLeft/></button>
             <h2 className="font-bold">Criar Novo Treino para {viewingStudent.name}</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
             <WorkoutCreatorView onBack={() => setIsCreatingWorkout(false)} />
          </div>
       </div>
    );
  }

  if (isCreatingDiet) {
    return (
        <div className="bg-white dark:bg-[#111827] rounded-3xl h-full overflow-hidden border border-black/5 dark:border-white/5 flex flex-col pt-4">
          <div className="px-6 pb-2 border-b border-black/5 dark:border-white/5 flex items-center gap-4">
             <button onClick={() => setIsCreatingDiet(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"><ChevronLeft/></button>
             <h2 className="font-bold">Criar Nova Dieta para {viewingStudent.name}</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
             <DietCreatorView onBack={() => setIsCreatingDiet(false)} />
          </div>
        </div>
    );
  }

  if (isEditingWorkout) {
    return (
       <div className="bg-white dark:bg-[#111827] rounded-3xl h-full overflow-hidden border border-black/5 dark:border-white/5 flex flex-col pt-0">
          <div className="flex-1 overflow-y-auto w-full h-full relative">
             <TrainerEditWorkoutView 
               onBack={() => { setIsEditingWorkout(false); setSelectedWorkoutId(null); }} 
               initialWorkoutId={selectedWorkoutId}
             />
          </div>
       </div>
    );
  }

  if (!viewingStudent) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>
  );

  const avatarUrl = studentData?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingStudent?.name || 'Aluno')}&background=random`;
  const studentGoal = studentData?.goal || 'Sem objetivo definido';

  if (isEditingStudent) {
    return (
       <div className="bg-white dark:bg-[#111827] rounded-3xl h-full overflow-hidden border border-black/5 dark:border-white/5 flex flex-col pt-0">
          <div className="flex-1 overflow-y-auto w-full h-full relative">
             <TrainerEditStudentView 
                student={studentData} 
                onBack={() => setIsEditingStudent(false)} 
                onUpdate={() => fetchProfile()} 
                onDelete={onBack}
             />
          </div>
       </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 rounded-2xl bg-white dark:bg-[#111827] border border-black/5 dark:border-white/5 hover:bg-primary hover:text-white transition-all group"
          >
            <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          
          <div className="flex items-center gap-4">
              <div className="relative">
                 <img src={avatarUrl} className="w-20 h-20 rounded-[2rem] object-cover shadow-2xl border-4 border-white dark:border-[#1F2937]" alt="" />
                 {isOnline(studentProfile?.last_seen) ? (
                   <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white dark:border-[#111827] shadow-lg" />
                 ) : studentProfile?.last_seen && (
                   <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-400 rounded-full border-4 border-white dark:border-[#111827] shadow-lg" />
                 )}
              </div>
              <div>
                 <h1 className="text-3xl font-bold tracking-tight">{viewingStudent.name}</h1>
                 <div className="flex items-center gap-3 mt-1">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-wider">{studentGoal}</span>
                    <span className="text-[10px] text-muted font-bold flex items-center gap-1.5 opacity-70">
                       <Calendar size={12} className="text-primary"/> 
                       {formatEnrollment(studentProfile?.created_at)}
                    </span>
                    <span className="text-[10px] text-muted font-bold flex items-center gap-1.5 opacity-70">
                       <Clock size={12} className="text-primary"/> 
                       {formatLastWorkout(lastWorkoutDate)}
                    </span>
                 </div>
              </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => {
              if (viewingStudent) {
                startChat(viewingStudent.id, viewingStudent.name, viewingStudent.avatar);
              }
            }}
            className="px-6 py-3 bg-white dark:bg-[#111827] border border-black/5 dark:border-white/5 rounded-2xl font-bold flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all">
             <MessageSquare size={18} />
             Conversar
          </button>
          <button 
            onClick={() => setIsEditingStudent(true)}
            className="px-6 py-3 bg-white dark:bg-[#111827] border border-black/5 dark:border-white/5 rounded-2xl font-bold flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
          >
             <Settings size={18} />
             Ajustar Perfil
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-white dark:bg-[#111827] border border-black/5 dark:border-white/5 rounded-[2rem] w-fit shadow-sm overflow-hidden scrollbar-hide">
         {['overview', 'workouts', 'diet', 'progress'].map((tab) => (
           <button
             key={tab}
             onClick={() => setActiveSegment(tab as any)}
             className={`px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
               activeSegment === tab 
               ? 'bg-primary text-white shadow-lg shadow-primary/20' 
               : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
             }`}
           >
             {tab === 'overview' ? 'Geral' : 
              tab === 'workouts' ? 'Treinos' : 
              tab === 'diet' ? 'Dieta' : 'Evolução'}
           </button>
         ))}
      </div>

      <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
         {/* Left Col - Stats & Info */}
         <div className={`col-span-12 ${activeSegment === 'overview' || activeSegment === 'progress' ? 'lg:col-span-8' : 'lg:col-span-12'} ${activeSegment === 'diet' ? 'h-full flex flex-col' : 'space-y-8 overflow-y-auto pr-4 scrollbar-hide'}`}>
            
            {activeSegment === 'overview' && (
               <div className="space-y-8">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">
                    {stats.map((stat) => (
                      <div key={stat.label} className="bg-white dark:bg-[#111827] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                         <div className={`${stat.color} mb-3 group-hover:scale-110 transition-transform`}><stat.icon size={20}/></div>
                         <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                         <p className="text-2xl font-bold">{stat.value}</p>
                      </div>
                    ))}
                  </div>


                  {/* Placeholder for Recent Records */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="bg-white dark:bg-[#111827] p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Target className="text-red-500"/> Recordes Pessoais</h3>
                        <div className="space-y-4">
                           {topRecords.length > 0 ? (
                               topRecords.map((pr, i) => (
                                   <div key={i} className="flex justify-between items-center p-4 bg-[#F1F5FF] dark:bg-white/5 rounded-2xl">
                                       <span className="font-bold text-sm">{pr.name}</span>
                                       <span className="font-mono text-primary font-bold">{pr.record}</span>
                                   </div>
                               ))
                           ) : (
                               <div className="text-center py-8 text-muted text-sm border-2 border-dashed border-black/5 dark:border-white/5 rounded-2xl">
                                   Nenhum recorde registado
                               </div>
                           )}
                        </div>
                     </div>
                     <div className="bg-white dark:bg-[#111827] p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Calendar className="text-blue-500"/> Agenda de Treinos</h3>
                        <div className="flex gap-2 mb-8">
                           {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => {
                               const isRestDay = studentData.restDays?.includes(i);
                               return (
                               <div key={i} className={`flex-1 aspect-square rounded-xl flex items-center justify-center font-bold text-xs ${isRestDay ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                                  {d}
                               </div>
                               );
                           })}
                        </div>
                        <div className="space-y-4 pt-6 border-t border-black/5 dark:border-white/5">
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-muted font-medium">Dias de Treino</span>
                              <span className="font-bold text-main">{(studentData.trainingFrequency || 0)} Dias</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-muted font-medium">Descanso habitual</span>
                              <span className="font-bold text-amber-500">
                                 {studentData.restDays && studentData.restDays.length > 0 
                                    ? studentData.restDays.map((val: number) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][val]).join(', ')
                                    : 'Indefinido'}
                              </span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            <div className={`space-y-6 ${activeSegment === 'workouts' ? 'block' : 'hidden'}`}>
                  <div className="flex justify-between items-center">
                     <h3 className="text-2xl font-bold">Planos de Treino</h3>
                     <button 
                      onClick={() => setIsCreatingWorkout(true)}
                      className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                     >
                        <Plus size={18}/> Novo Plano
                     </button>
                  </div>
                  
                  {workouts.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
                       {workouts.map((w) => (
                          <div 
                            key={w.id} 
                            className="bg-white dark:bg-[#111827] rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm group hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden flex flex-col"
                          >
                             <div className="p-7 flex-1">
                                <div className="flex justify-between items-start mb-5">
                                   <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 relative group-hover:scale-105 transition-transform duration-500">
                                         <span className="text-xl font-black">{w.day_label || 'A'}</span>
                                      </div>
                                      <div>
                                         <h4 className="text-lg font-bold tracking-tight text-main group-hover:text-primary transition-colors">{w.title}</h4>
                                         <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1 opacity-60">
                                            {w.exerciseCount} EXERCÍCIOS • {w.planned_duration || 60} MIN
                                         </p>
                                      </div>
                                   </div>
                                   <button className="p-2 text-muted hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all">
                                      <MoreHorizontal size={18}/>
                                   </button>
                                </div>
                                
                                <div className="space-y-2 mb-6">
                                   {w.exerciseNames && w.exerciseNames.length > 0 ? (
                                     <>
                                       {w.exerciseNames.slice(0, 3).map((name: string, i: number) => (
                                         <div key={i} className="flex items-center gap-2 text-xs text-muted/80">
                                            <div className="w-1 h-1 rounded-full bg-primary/40" />
                                            <span className="truncate">{name}</span>
                                         </div>
                                       ))}
                                       {w.exerciseNames.length > 3 && (
                                         <p className="text-[10px] text-primary/60 font-bold pl-3 mt-1">
                                            + {w.exerciseNames.length - 3} OUTROS
                                         </p>
                                       )}
                                     </>
                                   ) : (
                                     <p className="text-xs text-muted italic">Nenhum exercício programado</p>
                                   )}
                                </div>
                             </div>
                             
                             <div className="px-7 pb-7">
                                <button 
                                  onClick={() => { setSelectedWorkoutId(w.id); setIsEditingWorkout(true); }}
                                  className="w-full py-4 rounded-2xl bg-black/5 dark:bg-white/5 text-main font-bold text-xs hover:bg-primary hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group/btn"
                                >
                                   Configurar Treino 
                                   <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                </button>
                             </div>
                          </div>
                       ))}
                    </div>
                  ) : (
                    <div className="text-center p-12 bg-white dark:bg-[#111827] rounded-3xl border border-black/5 dark:border-white/5 shadow-sm">
                      <p className="text-muted italic">Este aluno ainda não tem treinos definidos.</p>
                      <button onClick={() => setIsCreatingWorkout(true)} className="mt-4 text-primary font-bold underline">Criar agora</button>
                    </div>
                  )}
               </div>

            <div className={`flex-1 h-full overflow-hidden ${activeSegment === 'diet' ? 'block' : 'hidden'}`}>
               <TrainerEditDietView onBack={() => setActiveSegment('overview')} hideHeader={true} />
            </div>

             {activeSegment === 'progress' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
                    <div className="flex justify-between items-center">
                       <div>
                          <h3 className="text-2xl font-bold">Evolução do Aluno</h3>
                          <p className="text-xs text-muted font-bold uppercase tracking-widest mt-1 opacity-60">Análise de Performance e Antropometria</p>
                       </div>
                    </div>

                    {/* Performance KPIs */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white dark:bg-[#111827] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                          <div className="flex justify-between items-start mb-4">
                             <div className="p-3 bg-primary/10 text-primary rounded-2xl group-hover:scale-110 transition-transform"><Check size={20}/></div>
                             <span className="text-[10px] font-black text-primary">{kpis.workoutsGrowth}</span>
                          </div>
                          <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Treinos</p>
                          <p className="text-3xl font-black">{kpis.workoutsCompleted}</p>
                       </div>

                       <div className="bg-white dark:bg-[#111827] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                          <div className="flex justify-between items-start mb-4">
                             <div className="p-3 bg-primary/10 text-primary rounded-2xl group-hover:scale-110 transition-transform"><Clock size={20}/></div>
                             <span className="text-[10px] font-black text-primary">{kpis.durationGrowth}</span>
                          </div>
                          <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Tempo</p>
                          <p className="text-3xl font-black">{kpis.durationHours}h</p>
                       </div>
                    </div>

                    {/* Weight Evolution Card (New) */}
                   <div className="grid grid-cols-12 gap-8">
                      <div className="col-span-12 xl:col-span-12">
                         <div className="bg-white dark:bg-[#111827] rounded-[2rem] p-8 border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8">
                               <Scale size={120} className="text-primary/5 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                            </div>
                            <div className="relative z-10">
                               <div className="flex justify-between items-start mb-8">
                                  <div>
                                     <h4 className="text-xl font-bold text-main">Evolução do Peso</h4>
                                     <div className="flex gap-1 mt-2">
                                        {['1s', '1m', '6m', '1ano', 'Tudo'].map(range => (
                                          <button 
                                            key={range}
                                            onClick={() => setTimeRange(range)}
                                            className={`px-3 py-1 rounded-lg text-[9px] font-bold tracking-widest transition-all ${timeRange === range ? 'bg-primary text-white shadow-lg' : 'bg-black/5 dark:bg-white/5 text-muted hover:bg-black/10 dark:hover:bg-white/10'}`}
                                          >
                                            {range}
                                          </button>
                                        ))}
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">ÚLTIMO REGISTO</p>
                                     <p className="text-5xl font-black text-main flex items-baseline justify-end leading-none">
                                        {weightHistory.length > 0 ? weightHistory[0].weight : (viewingStudent.weight || '--')}
                                        <span className="text-2xl ml-1 text-primary font-black">kg</span>
                                     </p>
                                  </div>
                               </div>

                               <div className="h-32 w-full">
                                  {weightChartData.length > 1 ? (
                                     <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={weightChartData} margin={{ bottom: 0 }}>
                                           <XAxis 
                                              dataKey="date" 
                                              axisLine={false} 
                                              tickLine={false} 
                                              tick={{ fontSize: 9, fontWeight: 'bold', fill: 'rgba(156, 163, 175, 0.5)' }}
                                              interval="preserveStartEnd"
                                              height={20}
                                           />
                                           <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                                           <Tooltip 
                                              contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '12px' }}
                                              itemStyle={{ color: '#fff', fontSize: '10px' }}
                                              labelStyle={{ color: '#aaa', fontSize: '9px' }}
                                           />
                                           <Line 
                                              type="monotone" 
                                              dataKey="weight" 
                                              stroke="rgb(var(--color-primary))" 
                                              strokeWidth={4} 
                                              dot={{ r: 6, fill: "rgb(var(--color-primary))", strokeWidth: 3, stroke: "#fff" }}
                                              activeDot={{ r: 8, strokeWidth: 0 }}
                                           />
                                        </LineChart>
                                     </ResponsiveContainer>
                                  ) : (
                                     <div className="flex flex-col items-center justify-center h-full text-muted italic text-sm border-2 border-dashed border-black/5 dark:border-white/5 rounded-3xl">
                                        <History size={24} className="mb-2 opacity-20" />
                                        Dados insuficientes para gráfico de peso
                                     </div>
                                  )}
                               </div>
                               
                               <div className="grid grid-cols-4 gap-4 mt-8">
                                  <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl">
                                     <p className="text-[9px] text-muted font-bold uppercase tracking-widest mb-1 opacity-60">INICIAL</p>
                                     <p className="font-bold text-main">{weightHistory.length > 0 ? weightHistory[weightHistory.length-1].weight : '--'}kg</p>
                                  </div>
                                  <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl">
                                     <p className="text-[9px] text-muted font-bold uppercase tracking-widest mb-1 opacity-60">MÍNIMO</p>
                                     <p className="font-bold text-main">{weightHistory.length > 0 ? Math.min(...weightHistory.map(w => w.weight)) : '--'}kg</p>
                                  </div>
                                  <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl">
                                     <p className="text-[9px] text-muted font-bold uppercase tracking-widest mb-1 opacity-60">MÁXIMO</p>
                                     <p className="font-bold text-main">{weightHistory.length > 0 ? Math.max(...weightHistory.map(w => w.weight)) : '--'}kg</p>
                                  </div>
                                  <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20">
                                     <p className="text-[9px] text-primary font-bold uppercase tracking-widest mb-1">VARIAÇÃO</p>
                                     <p className="font-bold text-primary">
                                        {weightHistory.length > 1 ? (weightHistory[0].weight - weightHistory[weightHistory.length-1].weight).toFixed(1) : '0.0'}kg
                                     </p>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Performance Analysis (Existing with Refined Layout) */}
                   <div className="grid grid-cols-12 gap-8">
                      {/* Detailed Chart & History (Left) */}
                      <div className="col-span-12 xl:col-span-8 space-y-6">
                         {selectedExercise ? (
                           <div ref={chartRef} className="bg-white dark:bg-[#111827] rounded-[2rem] p-8 border border-black/5 dark:border-white/5 shadow-sm">
                              <div className="flex justify-between items-start mb-8">
                                 <div>
                                    <h4 className="text-2xl font-bold text-main">{selectedExercise}</h4>
                                    <div className="flex gap-2 mt-2">
                                       <button onClick={() => setChartMetric('weight')} className={`px-4 py-1 rounded-full text-[10px] font-bold border transition-all ${chartMetric === 'weight' ? 'bg-primary/10 border-primary/20 text-primary' : 'border-black/5 dark:border-white/5 text-muted hover:text-main'}`}>CARGA MÁXIMA</button>
                                       <button onClick={() => setChartMetric('est1rm')} className={`px-4 py-1 rounded-full text-[10px] font-bold border transition-all ${chartMetric === 'est1rm' ? 'bg-primary/10 border-primary/20 text-primary' : 'border-black/5 dark:border-white/5 text-muted hover:text-main'}`}>1RM ESTIMADO</button>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1 opacity-60">RECORDE ATUAL</p>
                                    <p className="text-2xl font-black text-primary">{exerciseStats?.maxWeight}kg</p>
                                 </div>
                              </div>

                              <div className="h-36 w-full mb-6">
                                 {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                       <LineChart data={chartData} margin={{ bottom: 0 }}>
                                          <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.03)" />
                                          <XAxis 
                                             dataKey="date" 
                                             axisLine={false} 
                                             tickLine={false} 
                                             tick={{ fontSize: 9, fontWeight: 'bold', fill: 'rgba(var(--color-primary), 0.4)' }}
                                             interval="preserveStartEnd"
                                             height={20}
                                          />
                                          <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                          <Tooltip 
                                             contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                             itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                             labelStyle={{ display: 'none' }}
                                          />
                                          <Line 
                                             type="monotone" 
                                             dataKey={chartMetric} 
                                             stroke="rgb(var(--color-primary))" 
                                             strokeWidth={3} 
                                             dot={{ r: 4, fill: "rgb(var(--color-primary))", strokeWidth: 2, stroke: "#fff" }}
                                             activeDot={{ r: 6, strokeWidth: 0 }}
                                          />
                                       </LineChart>
                                    </ResponsiveContainer>
                                 ) : (
                                    <div className="flex items-center justify-center h-full text-muted italic text-sm">Sem dados suficientes para gerar gráfico</div>
                                 )}
                              </div>

                              <h5 className="font-bold mb-4 text-xs uppercase tracking-widest opacity-60">Histórico de Cargas</h5>
                              <div className="space-y-4">
                                 {historyData.map((row: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 group hover:bg-white dark:hover:bg-[#1F2937] hover:shadow-xl transition-all duration-300">
                                       <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-xs">{row.date}</div>
                                          <div>
                                             <p className="text-[10px] text-muted font-bold tracking-widest uppercase mb-0.5">{row.sets} Séries</p>
                                             <p className="font-bold text-sm">{row.reps} Repetições</p>
                                          </div>
                                       </div>
                                       <div className="text-right">
                                          <p className="text-xl font-black text-main">{row.load}</p>
                                          <p className="text-[9px] text-primary font-bold uppercase tracking-widest">1RM: {row.est1rm}</p>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                         ) : (
                           <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-[#111827] rounded-[2rem] p-20 border border-dashed border-black/10 dark:border-white/10 text-center">
                              <TrendingUp size={48} className="text-primary/20 mb-4" />
                              <p className="text-muted italic max-w-xs">Seleciona um exercício da lista para ver a evolução detalhada.</p>
                           </div>
                         )}
                      </div>

                      {/* Exercise List & KPIs (Right) */}
                      <div className="col-span-12 xl:col-span-4 space-y-6">
                         {/* Consistency Heatmap */}
                         <div className="bg-white dark:bg-[#111827] p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                               <h4 className="font-bold text-xs uppercase tracking-widest opacity-60">Consistência</h4>
                               <div className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-black underline">Últimas 12 Semanas</div>
                            </div>
                            <div className="flex gap-3">
                               {/* Labels dos dias da semana */}
                               <div className="flex flex-col justify-between py-1 text-[7px] font-black text-muted opacity-40 uppercase">
                                  <span>Seg</span>
                                  <span>Qua</span>
                                  <span>Sex</span>
                                  <span>Dom</span>
                               </div>
                               <div className="flex gap-1.5 flex-1">
                                  {Array.from({ length: 12 }).map((_, weekIndex) => (
                                     <div key={weekIndex} className="flex flex-col gap-1.5 flex-1">
                                        {Array.from({ length: 7 }).map((_, dayIndex) => {
                                           const date = new Date();
                                           date.setDate(date.getDate() - (11 - weekIndex) * 7 - (6 - dayIndex));
                                           const dStr = date.toLocaleDateString('pt-BR');
                                           // Simple lookup in workouts history
                                           const hasWorkout = allWorkoutsHistory.some(w => new Date(w.date).toLocaleDateString('pt-BR') === dStr);
                                           const isFuture = date > new Date();
                                           return (
                                              <div 
                                                 key={dayIndex} 
                                                 title={`${dStr}${hasWorkout ? ' - Treino realizado' : ''}`}
                                                 className={`aspect-square rounded-sm cursor-pointer transition-all ${hasWorkout ? 'bg-primary shadow-lg shadow-primary/20 scale-105' : (isFuture ? 'bg-transparent border border-black/5 dark:border-white/5 opacity-20' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10')}`}
                                              />
                                           );
                                        })}
                                     </div>
                                  ))}
                               </div>
                            </div>
                            <div className="flex justify-between mt-4 text-[9px] font-bold text-muted uppercase tracking-tighter opacity-40">
                               <span>{new Date(new Date().setDate(new Date().getDate() - 12 * 7)).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                               <span>Hoje</span>
                            </div>
                         </div>

                         {/* Exercise Selection List */}
                         <div className="bg-white dark:bg-[#111827] rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden flex flex-col max-h-[600px]">
                            <div className="p-6 border-b border-black/5 dark:border-white/5">
                               <h4 className="font-bold text-xs uppercase tracking-widest opacity-60">Exercícios Registados</h4>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                               {Object.entries(groupedExercises).map(([muscle, items]) => (
                                 <div key={muscle} className="space-y-1">
                                    <button 
                                      onClick={() => setExpandedGroups(prev => prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle])}
                                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all"
                                    >
                                       <span className="text-[10px] font-black text-primary uppercase tracking-widest">{muscle}</span>
                                       {expandedGroups.includes(muscle) ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                    </button>
                                    
                                    {expandedGroups.includes(muscle) && (
                                       <div className="space-y-1 mt-1">
                                          {items.map((ex) => (
                                             <button
                                               key={ex.name}
                                               onClick={() => setSelectedExercise(ex.name)}
                                               className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${selectedExercise === ex.name ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                                             >
                                                <div className="text-left">
                                                   <p className="font-bold text-sm leading-none mb-1">{ex.name}</p>
                                                   <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${selectedExercise === ex.name ? 'text-white/70' : 'text-primary'}`}>Recorde: {ex.record}</p>
                                                </div>
                                                {parseFloat(ex.change) > 0 && (
                                                   <div className={`px-2 py-0.5 rounded text-[10px] font-black ${selectedExercise === ex.name ? 'bg-white/20 text-white' : 'bg-green-500/10 text-green-500'}`}>
                                                      {ex.change}
                                                   </div>
                                                )}
                                             </button>
                                          ))}
                                       </div>
                                    )}
                                 </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                   
                   {/* Photos Section */}
                   <div className="space-y-6">
                      <div className="flex justify-between items-center">
                         <h3 className="text-xl font-bold">Histórico Visual (Forma Física)</h3>
                         <button className="text-xs font-bold text-primary">Ver Todas as Fotos</button>
                      </div>
                      <div className="grid grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(p => (
                           <div key={p} className="group relative aspect-[3/4] bg-white dark:bg-[#111827] rounded-[2rem] overflow-hidden border-4 border-white dark:border-[#1F2937] shadow-xl hover:-translate-y-2 transition-all duration-500 cursor-pointer">
                              <img src={`https://images.unsplash.com/photo-1541534741688-6078c64b52d3?w=400&q=80`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt="" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                                 <p className="text-white text-xs font-bold">12 Abr 2026</p>
                                 <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest mt-0.5">Peso: 68.2kg</p>
                              </div>
                           </div>
                        ))}
                      </div>
                   </div>
                </div>
            )}
         </div>

         {/* Right Col - Secondary Info */}
         {(activeSegment === 'overview' || activeSegment === 'progress') && (
            <div className="col-span-12 lg:col-span-4 space-y-8 overflow-y-auto pr-4 scrollbar-hide flex flex-col">
            {/* Muscle Distribution */}
            {activeSegment === 'progress' && (
               <div className="bg-white dark:bg-[#111827] p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden relative">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xs font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Distribuição Muscular
                     </h3>
                     <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-1 rounded-lg">Performance</span>
                  </div>
                  
                  {muscleDistribution.total > 0 ? (
                     <div className="space-y-4">
                        {muscleDistribution.sorted.map(([muscle, vol]) => (
                           <div key={muscle} className="group">
                              <div className="flex justify-between text-[11px] mb-1.5">
                                 <span className="text-main font-black uppercase tracking-wider group-hover:text-primary transition-colors">{muscle}</span>
                                 <span className="text-primary font-mono font-bold">{((vol / muscleDistribution.total) * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 relative overflow-hidden">
                                 <div 
                                    className="bg-primary h-full rounded-full transition-all duration-1000 ease-out group-hover:brightness-110" 
                                    style={{ width: `${(vol / muscleDistribution.total) * 100}%` }} 
                                 />
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center py-16 text-muted text-xs italic">
                        <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mb-4"><Activity size={24} className="opacity-20"/></div>
                        Sem dados de distribuição muscular
                     </div>
                  )}
               </div>
            )}

            {/* Notes Section */}
            {activeSegment === 'overview' && (
               <div className="bg-white dark:bg-[#111827] p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm flex-1 flex flex-col min-h-0">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText size={18} className="text-primary"/> Notas Privadas</h3>
                  <textarea 
                     placeholder="Escreve aqui notas sobre a evolução, limitações ou feedback deste aluno..." 
                     className="flex-1 bg-[#141414]/5 dark:bg-white/5 p-6 rounded-2xl resize-none text-sm outline-none focus:ring-1 ring-primary"
                  />
                  <button className="mt-4 bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20">Guardar Notas</button>
               </div>
            )}

            {/* Quick Actions / Alerts */}
            {activeAlert && (
               <div className={`${activeAlert.color} text-white p-8 rounded-[2rem] shadow-xl ${activeAlert.shadow} animate-in fade-in slide-in-from-right-4 duration-500`}>
                  <div className="flex items-center gap-2 mb-2">
                     <AlertTriangle size={18}/>
                     <span className="font-bold text-sm">{activeAlert.title}</span>
                  </div>
                  <p className="text-xs text-white/80 leading-relaxed">
                     {activeAlert.message}
                  </p>
                  <button 
                    onClick={() => startChat(viewingStudent.id, viewingStudent.name, viewingStudent.avatar)}
                    className="mt-4 w-full bg-white/20 hover:bg-white text-white hover:text-main py-3 rounded-xl font-bold text-xs transition-all"
                  >
                     Enviar Mensagem de Apoio
                  </button>
               </div>
            )}
         </div>
      )}
    </div>
  </div>
  );
}

function FileText(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { Screen } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { TourGuide, TourStep } from '../components/TourGuide';

interface Props {
  onBack: () => void;
}

interface PerformanceDataItem {
  date: string;
  name: string;
  reps: number;
  weight: number;
  time?: string;
  intensity?: number;
  notes?: string;
  est1rm: number;
  sets?: number;
}

interface PerformanceSummaryItem {
  name: string;
  muscleGroup: string;
  record: string;
  change: string;
}

const PERFORMANCE_TOUR_STEPS: TourStep[] = [
    {
        targetId: 'tour-history-header',
        title: 'Histórico de Desempenho',
        content: 'Nesta tela podes analisar a tua evolução detalhada em cada exercício e o teu empenho geral.',
        position: 'bottom'
    },
    {
        targetId: 'tour-kpis',
        title: 'Indicadores Rápidos',
        content: 'Vê o total de treinos, volume levantado e tempo investido no período selecionado.',
        position: 'bottom'
    },
    {
        targetId: 'tour-exercise-list',
        title: 'Evolução por Exercício',
        content: 'Clica num exercício para expandir o gráfico de evolução de carga e o teu 1RM estimado.',
        position: 'top'
    }
];

export default function PerformanceHistoryView({ onBack }: Props) {
  const { user, viewingStudent, setScreen, updateUserProfile } = useApp();
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('1M');
  const [chartMetric, setChartMetric] = useState<'weight' | 'est1rm'>('weight');
  const [showStats, setShowStats] = useState(false);
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(null);
  
  // Real Data State
  const [isLoading, setIsLoading] = useState(true);
  const [allPerformanceData, setAllPerformanceData] = useState<PerformanceDataItem[]>([]);
  const [programmedExercises, setProgrammedExercises] = useState<string[]>([]);
  const [allWorkouts, setAllWorkouts] = useState<{date: string, duration: number}[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<Record<string, string>>({}); // name -> muscle group
  const [totalCompletedWorkouts, setTotalCompletedWorkouts] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [fetchedTrainingFrequency, setFetchedTrainingFrequency] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  
  const targetUser = viewingStudent || user;
  const userWeight = targetUser?.weight || 0;

  // Tour State
  const [isTourOpen, setIsTourOpen] = useState(false);

  useEffect(() => {
    if (user && user.role === 'STUDENT' && !user.hasSeenPerformanceTour && !viewingStudent) {
        const timer = setTimeout(() => setIsTourOpen(true), 1000);
        return () => clearTimeout(timer);
    }
  }, [user, viewingStudent]);

  const handleTourFinished = async () => {
    setIsTourOpen(false);
    try {
        await updateUserProfile({ hasSeenPerformanceTour: true });
    } catch (e) {
        console.error("Error updating performance tour status", e);
    }
  };

  // Fetch all historic performance data for the user on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!targetUser?.id) return;
      setIsLoading(true);

      try {
        // Fetch library for muscle group mapping
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
        
        // Fetch target user's profile to get training frequency accurately
        const { data: profile } = await supabase
            .from('profiles')
            .select('training_frequency')
            .eq('id', targetUser.id)
            .single();
        
        if (profile) {
            setFetchedTrainingFrequency(profile.training_frequency || 3); // Default to 3 if null
        } else {
            setFetchedTrainingFrequency(3); // Default fallback
        }

        const { data, error } = await supabase
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
          .eq('assigned_student_id', targetUser.id)
          .eq('completed', true);
        
        if (error) {
          if (error.code !== '42P01') {
              console.error("Error fetching performance history:", error);
          }
          setAllPerformanceData([]);
          return;
        }

        // De-duplicate workouts with identical completed_at (to prevent double counting cloned history rows)
        const uniqueDataMap = new Map();
        data.forEach(w => {
            const dateKey = w.completed_at || w.created_at;
            // Prefer HISTORY_ rows if there's a collision
            if (!uniqueDataMap.has(dateKey) || (w.day_label && w.day_label.startsWith('HISTORY_'))) {
                uniqueDataMap.set(dateKey, w);
            }
        });
        const uniqueData = Array.from(uniqueDataMap.values());
        
        const flattenedData: PerformanceDataItem[] = uniqueData.flatMap(workout => 
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
                  reps: reps,
                  weight: weight,
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
            duration: w.duration_seconds || (45 * 60) // fallback to 45 mins if not tracked
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const completedWorkoutsCount = uniqueData.filter(w => w.completed).length;
        
        // Fetch all assigned exercises to ensure they show up in the ranking even if no history exists
        const { data: assignedData } = await supabase
          .from('workouts')
          .select(`workout_exercises(name)`)
          .eq('assigned_student_id', targetUser.id);
          
        const progEx = new Set<string>();
        if (assignedData) {
           assignedData.forEach(w => {
               w.workout_exercises?.forEach((ex: any) => {
                   if (ex.name) progEx.add(ex.name);
               });
           });
        }
        
        // Ensure all historically performed exercises also show up in the ranking
        flattenedData.forEach(d => {
            if (d.name) progEx.add(d.name);
        });

        setProgrammedExercises(Array.from(progEx));

        setAllPerformanceData(flattenedData);
        setAllWorkouts(workoutsList);
        setTotalCompletedWorkouts(completedWorkoutsCount);
      } catch (e) {
        console.error("Fetch failed", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [targetUser]);
  
  // Time logic helpers
  const getTimeRanges = () => {
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
          case '1M': 
            startCurrent.setMonth(endCurrent.getMonth() - 1); 
            endPrev = new Date(startCurrent);
            startPrev.setMonth(startCurrent.getMonth() - 1);
            break;
          case '3M': 
            startCurrent.setMonth(endCurrent.getMonth() - 3); 
            endPrev = new Date(startCurrent);
            startPrev.setMonth(startCurrent.getMonth() - 3);
            break;
          case '6M': 
            startCurrent.setMonth(endCurrent.getMonth() - 6); 
            endPrev = new Date(startCurrent);
            startPrev.setMonth(startCurrent.getMonth() - 6);
            break;
          case '1A': 
            startCurrent.setFullYear(endCurrent.getFullYear() - 1); 
            endPrev = new Date(startCurrent);
            startPrev.setFullYear(startCurrent.getFullYear() - 1);
            break;
        }
    }
    return { startCurrent, endCurrent, startPrev, endPrev };
  };

  // Memoize filtered data based on time range
  const dataInTimeRange = useMemo(() => {
    const { startCurrent, endCurrent } = getTimeRanges();
    return allPerformanceData.filter(d => new Date(d.date) >= startCurrent && new Date(d.date) <= endCurrent);
  }, [allPerformanceData, timeRange]);

  const dataInPrevRange = useMemo(() => {
    const { startPrev, endPrev } = getTimeRanges();
    return allPerformanceData.filter(d => new Date(d.date) >= startPrev && new Date(d.date) <= endPrev);
  }, [allPerformanceData, timeRange]);

  const workoutsInTimeRange = useMemo(() => {
      const { startCurrent, endCurrent } = getTimeRanges();
      return allWorkouts.filter(w => new Date(w.date) >= startCurrent && new Date(w.date) <= endCurrent);
  }, [allWorkouts, timeRange]);

  const workoutsInPrevRange = useMemo(() => {
      const { startPrev, endPrev } = getTimeRanges();
      return allWorkouts.filter(w => new Date(w.date) >= startPrev && new Date(w.date) <= endPrev);
  }, [allWorkouts, timeRange]);

  // Memoize the list of exercises and their PRs
  const exerciseList = useMemo<PerformanceSummaryItem[]>(() => {
    const exerciseMap = new Map<string, { record: number, allLifts: {date: string, weight: number}[] }>();
    
    // Ensure all programmed exercises are shown
    programmedExercises.forEach(name => {
        exerciseMap.set(name, { record: 0, allLifts: [] });
    });

    dataInTimeRange.forEach(item => {
      if (!exerciseMap.has(item.name)) {
        exerciseMap.set(item.name, { record: 0, allLifts: [] });
      }
      const existing = exerciseMap.get(item.name)!;
      if (item.weight > existing.record) {
        existing.record = item.weight;
      }
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
  }, [dataInTimeRange, exerciseLibrary, programmedExercises]);

  const groupedExercises = useMemo(() => {
      const groups: Record<string, PerformanceSummaryItem[]> = {};
      exerciseList.forEach(ex => {
          if (!groups[ex.muscleGroup]) groups[ex.muscleGroup] = [];
          groups[ex.muscleGroup].push(ex);
      });
      
      const sortedKeys = Object.keys(groups).sort((a, b) => {
          if (a === 'Outros') return 1;
          if (b === 'Outros') return -1;
          return a.localeCompare(b);
      });

      const sortedGroups: Record<string, PerformanceSummaryItem[]> = {};
      sortedKeys.forEach(key => {
          sortedGroups[key] = groups[key];
      });

      return sortedGroups;
  }, [exerciseList]);
  
  // Set default selected exercise
  useEffect(() => {
      if (!selectedExercise && exerciseList.length > 0) {
          setSelectedExercise(exerciseList[0].name);
      }
  }, [exerciseList, selectedExercise]);

  const selectExercise = (name: string, shouldScroll: boolean = true) => {
    if (selectedExercise === name) {
        setSelectedExercise(null); // Toggle off if clicked again
        return;
    }
    setSelectedExercise(name);
    if (shouldScroll) {
        setTimeout(() => {
            if (chartRef.current) {
                chartRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
    }
  };

  useEffect(() => {
      // Remover expansão do primeiro grupo por defeito para poupar espaço
      // const keys = Object.keys(groupedExercises);
      // if (keys.length > 0 && expandedGroups.length === 0) { ...
  }, []);

  const toggleGroup = (group: string) => {
      setExpandedGroups(prev => 
          prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
      );
  };

  // Detailed selected exercise states
  const { chartData, historyData, exerciseStats } = useMemo(() => {
    if (!selectedExercise) return { chartData: [], historyData: [], exerciseStats: null };

    const exerciseData = dataInTimeRange
      .filter(item => item.name === selectedExercise)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const dailyMap = new Map<string, any>();
    
    [...exerciseData].reverse().forEach(item => { // traverse oldest to newest
      const dateKey = new Date(item.date).toLocaleDateString('pt-BR');
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, item);
      } else {
        const stats = dailyMap.get(dateKey)!;
        const currentEst1rm = stats.est1rm || 0;
        const itemEst1rm = item.est1rm || 0;
        // Keep the best set of the day
        if (itemEst1rm > currentEst1rm || (itemEst1rm === 0 && item.weight > stats.weight)) {
          dailyMap.set(dateKey, item);
        }
      }
    });

    const chart = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, weight: stats.weight, est1rm: stats.est1rm }));

    const history = Array.from(dailyMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15)
      .map(item => ({
        date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        reps: item.reps,
        sets: item.sets,
        load: `${item.weight} kg`,
        time: item.time,
        intensity: item.intensity,
        notes: item.notes,
        est1rm: `${(item.est1rm || 0).toFixed(1)} kg`,
        weightNum: item.weight
      }));

    let max1RM = 0;
    let maxWeight = 0;
    exerciseData.forEach(item => {
        if (item.est1rm > max1RM) max1RM = item.est1rm;
        if (item.weight > maxWeight) maxWeight = item.weight;
    });

    return { chartData: chart, historyData: history, exerciseStats: { max1RM, maxWeight } };
  }, [selectedExercise, dataInTimeRange]);
  
  const kpis = useMemo(() => {
      const prCount = exerciseList.filter(ex => parseFloat(ex.change) > 0).length;
      
      // Calculate previous PR count to compare
      const prevExerciseMap = new Map<string, number>();
      dataInPrevRange.forEach(item => {
        prevExerciseMap.set(item.name, Math.max(prevExerciseMap.get(item.name) || 0, item.weight));
      });
      const currentExerciseMap = new Map<string, number>();
      dataInTimeRange.forEach(item => {
        currentExerciseMap.set(item.name, Math.max(currentExerciseMap.get(item.name) || 0, item.weight));
      });
      let prevPrCount = 0;
      currentExerciseMap.forEach((weight, name) => {
         const prevWeight = prevExerciseMap.get(name) || 0;
         if (weight > prevWeight && prevWeight > 0) prevPrCount++; // crude estimate of PRs hit vs prev period
      });

      const currentWorkoutsCount = workoutsInTimeRange.length;
      const prevWorkoutsCount = workoutsInPrevRange.length;
      
      const currentDuration = workoutsInTimeRange.reduce((acc, curr) => acc + curr.duration, 0);
      const prevDuration = workoutsInPrevRange.reduce((acc, curr) => acc + curr.duration, 0);

      const calcGrowth = (curr: number, prev: number) => {
          if (prev === 0) return curr > 0 ? '+100%' : '0%';
          const g = ((curr - prev) / prev) * 100;
          return `${g > 0 ? '+' : ''}${Math.round(g)}%`;
      };
      const cmpColor = (curr: number, prev: number) => {
          if (curr > prev) return 'text-primary';
          if (curr < prev) return 'text-red-500';
          return 'text-muted';
      }

      return { 
          prCount, 
          prevPrCount,
          prGrowth: calcGrowth(prCount, prevPrCount),
          prColor: cmpColor(prCount, prevPrCount),
          workoutsCompleted: currentWorkoutsCount,
          workoutsGrowth: calcGrowth(currentWorkoutsCount, prevWorkoutsCount),
          workoutsColor: cmpColor(currentWorkoutsCount, prevWorkoutsCount),
          durationHours: Math.round(currentDuration / 3600),
          durationGrowth: calcGrowth(currentDuration, prevDuration),
          durationColor: cmpColor(currentDuration, prevDuration)
      };
  }, [exerciseList, dataInPrevRange, dataInTimeRange, workoutsInTimeRange, workoutsInPrevRange]);

  const streaks = useMemo(() => {
    if (allWorkouts.length === 0) return { current: 0, best: 0, showBanner: false };
    
    // Group by iso week string "YYYY-WW"
    const getISOWeek = (date: Date) => {
        const d = new Date(date.valueOf());
        const dayNum = d.getDay() || 7;
        d.setDate(d.getDate() + 4 - dayNum);
        const yearStart = new Date(d.getFullYear(),0,1);
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        return `${d.getFullYear()}-${weekNo < 10 ? '0' : ''}${weekNo}`;
    };

    const targetFrequency = fetchedTrainingFrequency || targetUser?.trainingFrequency || 3; // Use fetched, then user, then default 3

    // Count workouts per week
    const weekCounts: Record<string, number> = {};
    allWorkouts.forEach(w => {
        const wStr = getISOWeek(new Date(w.date));
        weekCounts[wStr] = (weekCounts[wStr] || 0) + 1;
    });

    // Qualified weeks are weeks where they hit the training frequency
    const qualifiedWeeks = Object.keys(weekCounts)
        .filter(week => weekCounts[week] >= targetFrequency)
        .sort()
        .reverse();

    const currentWeekStr = getISOWeek(new Date());
    
    let currentStreak = 0;
    
    // Start counting back from current week or previous week
    let checkWeekDate = new Date();
    let hasCurrentWeekQualified = qualifiedWeeks.includes(currentWeekStr);
    
    if (!hasCurrentWeekQualified) {
        checkWeekDate.setDate(checkWeekDate.getDate() - 7); // give grace period of 1 week, they might hit the goal later this week
    }

    for (let i = 0; i < 520; i++) { // Max 10 years
        const wStr = getISOWeek(checkWeekDate);
        if (qualifiedWeeks.includes(wStr)) {
            currentStreak++;
            checkWeekDate.setDate(checkWeekDate.getDate() - 7);
        } else {
            break;
        }
    }

    // Now calculate best streak
    let best = 0;
    let localStreak = 0;
    if (qualifiedWeeks.length > 0) {
       localStreak = 1;
       best = 1;
       let prevDate = (() => {
           const parts = qualifiedWeeks[qualifiedWeeks.length - 1].split('-');
           const d = new Date(parseInt(parts[0]), 0, 1 + (parseInt(parts[1]) - 1) * 7);
           return d;
       })();

       for (let i = qualifiedWeeks.length - 2; i >= 0; i--) {
           const parts = qualifiedWeeks[i].split('-');
           const currDate = new Date(parseInt(parts[0]), 0, 1 + (parseInt(parts[1]) - 1) * 7);
           const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
           
           if (diffDays <= 12) { // approx 1 week distance
               localStreak++;
               if (localStreak > best) best = localStreak;
           } else {
               localStreak = 1;
           }
           prevDate = currDate;
       }
    }

    return { current: currentStreak, best, showBanner: currentStreak > 1 };
  }, [allWorkouts, fetchedTrainingFrequency, targetUser?.trainingFrequency]);

  // Muscle Distribution Widget
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

  const renderMuscleDistribution = () => {
    if (muscleDistribution.total === 0) return null;

    return (
       <div className="bg-surface p-4 rounded-2xl border border-main/5">
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-main text-sm">Distribuição Muscular</h3>
              <span className="material-symbols-outlined text-muted opacity-50 text-base">pie_chart</span>
          </div>
          <div className="space-y-3">
             {muscleDistribution.sorted.slice(0, 5).map(([muscle, vol]) => (
                <div key={muscle}>
                   <div className="flex justify-between text-xs mb-1">
                      <span className="text-main font-medium">{muscle}</span>
                      <span className="text-muted">{((vol / muscleDistribution.total) * 100).toFixed(1)}%</span>
                   </div>
                   <div className="w-full bg-main/5 rounded-full h-1.5 border border-main/10 shadow-inner">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(vol / muscleDistribution.total) * 100}%` }}></div>
                   </div>
                </div>
             ))}
          </div>
       </div>
    );
  };

  // Heatmap Widget
  const renderHeatmap = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Encontrar a segunda-feira da semana atual (1 = segunda, 0 = domingo)
    // No JS: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - diffToMonday);
    
    // Iniciar 11 semanas antes da segunda atual (total 12 semanas)
    const startDate = new Date(currentMonday);
    startDate.setDate(currentMonday.getDate() - (11 * 7));

    // Gerar os 84 dias (12 semanas * 7 dias)
    const days = Array.from({ length: 84 }).map((_, i) => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        return d.toLocaleDateString('pt-BR');
    });
    
    // Count days with workouts
    const workoutCountPerDay: Record<string, number> = {};
    days.forEach(day => {
        workoutCountPerDay[day] = 0;
    });
    
    // Get unique dates safely from ALL data (not filtered by timeRange, to give a real historic view of consistence)
    const uniqueDates = Array.from(new Set(allPerformanceData.map(d => new Date(d.date).toLocaleDateString('pt-BR'))));
    uniqueDates.forEach((d: string) => {
        if (workoutCountPerDay[d] !== undefined) workoutCountPerDay[d] = 1;
    });

    const weeks = [];
    for(let i=0; i<days.length; i+=7) {
        weeks.push(days.slice(i, i+7));
    }

    const dayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

    return (
        <div className="bg-surface p-4 rounded-2xl border border-main/5">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-main text-sm">Consistência</h3>
                <span className="text-xs text-muted font-medium bg-main/5 px-2 py-1 rounded-full">Últimas 12 sem.</span>
            </div>
            <div className="flex gap-2">
                <div className="flex flex-col justify-around text-[9px] font-black text-muted/40 pb-1">
                    {dayLabels.map((l, i) => <span key={i} className="h-full flex items-center">{l}</span>)}
                </div>
                <div className="flex flex-1 justify-between gap-1 pb-1">
                    {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-1 w-full">
                            {week.map((date) => {
                                const isFuture = (() => {
                                    const [d, m, y] = date.split('/');
                                    return new Date(parseInt(y), parseInt(m)-1, parseInt(d)) > today;
                                })();
                                
                                return (
                                    <div 
                                        key={date} 
                                        onClick={() => workoutCountPerDay[date] ? setSelectedHeatmapDate(date) : setSelectedHeatmapDate(null)}
                                        className={`w-full aspect-square rounded-[2px] sm:rounded-sm transition-all cursor-pointer 
                                            ${workoutCountPerDay[date] ? 'bg-primary shadow-[0_0_8px_rgba(37,99,235,0.2)]' : (isFuture ? 'bg-transparent border border-main/5' : 'bg-main/5')}
                                            ${selectedHeatmapDate === date ? 'ring-2 ring-white ring-offset-2 ring-offset-surface' : ''}
                                        `}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-4 text-center">
                <p className={`text-xs font-bold ${selectedHeatmapDate ? 'text-main' : 'text-muted'}`}>
                    {selectedHeatmapDate ? `Treino em: ${selectedHeatmapDate}` : 'Clica num dia de treino'}
                </p>
            </div>
        </div>
    );
  };

  const renderChart = () => {
    if (!selectedExercise) return null;
    return (
        <div ref={chartRef} className="bg-surface rounded-2xl p-4 sm:p-5 border border-primary/20 shadow-md mt-2 mb-4 scroll-mt-24 animate-in slide-in-from-top-2 relative z-10 before:absolute before:-top-2 before:left-8 before:w-4 before:h-4 before:bg-surface before:border-l before:border-t before:border-primary/20 before:rotate-45">
            <div className="flex justify-between items-start mb-4 relative z-20">
                <div>
                    <h3 className="font-bold text-main text-lg">{selectedExercise}</h3>
                    {userWeight > 0 && exerciseStats?.maxWeight && (
                        <div className="mt-2 bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20 text-xs font-bold inline-flex items-center gap-1 shadow-sm">
                            <span className="material-symbols-outlined text-[14px]">fitness_center</span>
                            {(exerciseStats.maxWeight / userWeight).toFixed(1)}x Peso Corp.
                        </div>
                    )}
                </div>
                <span className="material-symbols-outlined text-muted">insights</span>
            </div>

            <div className="flex gap-1 mb-2 bg-background p-1 rounded-lg items-center border border-main/5 relative z-20">
                <button onClick={() => setChartMetric('weight')} className={`flex-1 text-[11px] py-1.5 rounded-md font-bold transition-all ${chartMetric === 'weight' ? 'bg-surface border border-main/10 shadow-sm text-main' : 'text-muted hover:text-main'}`}>Carga Max</button>
                <button onClick={() => setChartMetric('est1rm')} className={`flex-1 text-[11px] py-1.5 rounded-md font-bold transition-all flex items-center justify-center gap-1 ${chartMetric === 'est1rm' ? 'bg-surface border border-main/10 shadow-sm text-main' : 'text-muted hover:text-main'}`} title="1 Repetição Máxima (Fórmula de Epley)">1RM Est.</button>
            </div>
            
            {chartMetric === 'est1rm' ? (
                <p className="text-[10px] text-muted mb-4 px-1 leading-tight animate-in fade-in relative z-20">
                    *<strong className="text-main/70">1RM (Uma Repetição Máxima):</strong> Peso teórico máximo para uma única repetição calculado com base na carga e reps que suportou.
                </p>
            ) : (
                <div className="mb-4"></div>
            )}

            <div className="h-48 w-full bg-background rounded-xl p-2 mb-6 border border-main/5 relative z-20">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid vertical={false} stroke="rgba(var(--color-main), 0.05)" />
                        <XAxis dataKey="date" hide />
                        <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1A3824', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', zIndex: 100 }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                            labelStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '4px' }}
                            cursor={{ stroke: "rgba(var(--color-main), 0.1)" }}
                            formatter={(value: number) => {
                                if (chartMetric === 'est1rm') return [`${value.toFixed(1)} kg`, '1RM Estimado'];
                                return [`${value} kg`, 'Carga Máxima'];
                            }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey={chartMetric} 
                            stroke="rgb(var(--color-primary))" 
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: "rgb(var(--color-primary))", stroke: "rgb(var(--color-background))", strokeWidth: 2 }} 
                            activeDot={{ r: 6, stroke: "rgb(var(--color-background))", strokeWidth: 2 }}
                        />
                    </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted text-sm">Sem dados para o gráfico.</div>
                )}
            </div>

            <div className="relative z-20">
                <h4 className="font-bold text-main mb-4 text-sm flex items-center justify-between">
                    Histórico Recente
                    <span className="text-xs font-normal text-muted bg-main/5 px-2 py-0.5 rounded-full">Ord. Recente</span>
                </h4>
                <div className="space-y-3">
                    {historyData.length > 0 ? historyData.map((row: any, i) => (
                        <div key={i} className="bg-main/5 rounded-xl p-3 border border-main/5">
                            <div className="flex justify-between items-center mb-2 border-b border-main/5 pb-2">
                                <span className="text-xs font-bold text-main opacity-80">{row.date}</span>
                                <div className="flex gap-2">
                                    {row.time ? (
                                        <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded text-[10px] font-bold text-primary">
                                            <span className="material-symbols-outlined text-xs">timer</span>
                                            {row.time}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded text-[10px] font-bold text-primary">
                                            {row.load}
                                        </div>
                                    )}
                                    {row.intensity && (
                                        <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] font-bold text-amber-500">
                                            <span className="material-symbols-outlined text-xs">bolt</span>
                                            Int: {row.intensity}
                                        </div>
                                    )}
                                    {row.reps > 0 && !row.time && (
                                        <div className="flex items-center gap-1.5 bg-main/10 px-2 py-0.5 rounded text-[10px] font-bold text-muted">
                                            {row.reps} reps
                                        </div>
                                    )}
                                </div>
                            </div>
                            {row.notes && (
                                <div className="mt-2 flex gap-2 items-start bg-yellow-500/5 p-2 rounded border border-yellow-500/10">
                                    <span className="material-symbols-outlined text-xs text-yellow-500 mt-0.5">sticky_note_2</span>
                                    <p className="text-[11px] text-main/80 italic leading-snug">"{row.notes}"</p>
                                </div>
                            )}
                        </div>
                    )) : <p className="text-center text-muted text-sm py-4">Sem histórico detalhado.</p>}
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <TourGuide 
        isOpen={isTourOpen} 
        steps={PERFORMANCE_TOUR_STEPS} 
        onClose={handleTourFinished} 
        onComplete={handleTourFinished} 
      />
      <header id="tour-history-header" className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm flex items-center justify-between border-b border-main/5">
        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-main">Histórico de Desempenho</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 p-4 space-y-6 overflow-y-auto pb-24">
        
        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
                <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                <p className="mt-4 text-sm">Analisando seu desempenho...</p>
            </div>
        ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                
                <div className="flex justify-between items-center bg-surface rounded-full p-1 border border-main/5 overflow-x-auto hide-scrollbar">
                    {['1M', '3M', '6M', '1A', 'Tudo'].map(range => (
                        <button 
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${timeRange === range ? 'bg-primary text-background' : 'text-muted hover:text-main'}`}
                        >
                            {range}
                        </button>
                    ))}
                </div>

                <div id="tour-kpis" className="grid grid-cols-2 gap-2">
                    <div className="bg-surface p-3 rounded-2xl border border-main/5 flex flex-col justify-between">
                        <p className="text-[10px] text-muted font-bold uppercase mb-1 flex items-center justify-between gap-1 w-full">
                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">check_circle</span> Treinos</span>
                            {timeRange !== 'Tudo' && <span className={`text-[9px] ${kpis.workoutsColor}`}>{kpis.workoutsGrowth}</span>}
                        </p>
                        <p className="text-xl font-bold text-main">{kpis.workoutsCompleted}</p>
                    </div>
                    <div className="bg-surface p-3 rounded-2xl border border-main/5 flex flex-col justify-between">
                        <p className="text-[10px] text-muted font-bold uppercase mb-1 flex items-center justify-between gap-1 w-full">
                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">timer</span> Tempo</span>
                            {timeRange !== 'Tudo' && <span className={`text-[9px] ${kpis.durationColor}`}>{kpis.durationGrowth}</span>}
                        </p>
                        <p className="text-xl font-bold text-main">{kpis.durationHours}h</p>
                    </div>
                </div>

                {streaks.showBanner && (
                    <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 p-4 rounded-2xl flex items-center gap-4">
                        <div className="h-10 w-10 bg-orange-500/20 rounded-full flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-orange-500">local_fire_department</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-orange-500 text-sm">Sequência: {streaks.current} {streaks.current === 1 ? 'semana seguida!' : 'semanas seguidas!'}</h3>
                            <p className="text-xs text-main/70">O teu recorde histórico é de {streaks.best} {streaks.best === 1 ? 'semana consecutiva' : 'semanas consecutivas'}. Continua o bom trabalho.</p>
                        </div>
                    </div>
                )}

                <div className="bg-surface/40 rounded-2xl border border-main/5 overflow-hidden">
                    <button 
                        onClick={() => setShowStats(!showStats)}
                        className="w-full flex items-center justify-between p-4 hover:bg-main/5 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary">query_stats</span>
                            <h3 className="text-sm font-bold text-main uppercase tracking-wider">Estatísticas Gerais</h3>
                        </div>
                        <span className={`material-symbols-outlined text-muted transition-transform duration-300 ${showStats ? 'rotate-180' : ''}`}>
                            expand_more
                        </span>
                    </button>
                    {showStats && (
                        <div className="p-4 pt-1 space-y-4 shadow-inner bg-main/[0.02]">
                            {renderHeatmap()}
                            {renderMuscleDistribution()}
                        </div>
                    )}
                </div>

                <div id="tour-exercise-list">
                    <h2 className="font-bold text-main mb-3 text-lg px-1">Progresso por Exercício</h2>
                    <div className="space-y-4">
                        {Object.keys(groupedExercises).length === 0 ? (
                            <p className="text-center text-muted text-sm py-4">Nenhum dado neste período.</p>
                        ) : (
                            Object.entries(groupedExercises).map(([muscle, items]) => {
                                const isExpanded = expandedGroups.includes(muscle);
                                return (
                                    <div key={muscle} className="bg-surface/40 rounded-2xl border border-main/5 overflow-hidden">
                                        <button 
                                            onClick={() => toggleGroup(muscle)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-main/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-2 w-2 bg-primary rounded-full shadow-[0_0_8px_rgba(37,99,235,0.5)]"></div>
                                                <h3 className="text-sm font-bold text-main uppercase tracking-wider">{muscle}</h3>
                                            </div>
                                            <span className={`material-symbols-outlined text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                expand_more
                                            </span>
                                        </button>
                                        
                                        {isExpanded && (
                                            <div className="p-3 pt-0 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                                {(items as PerformanceSummaryItem[]).map((ex) => (
                                                    <div key={ex.name} className="flex flex-col gap-1">
                                                        <div 
                                                            onClick={() => selectExercise(ex.name)}
                                                            className={`p-4 rounded-xl flex items-center justify-between border transition-all cursor-pointer ${selectedExercise === ex.name ? 'bg-surface border-primary/30 shadow-sm' : 'bg-surface/50 border-main/5 hover:border-main/10'}`}
                                                        >
                                                            <div>
                                                                <h4 className="font-bold text-main text-sm">{ex.name}</h4>
                                                                <p className="text-[10px] text-muted mt-0.5">Recorde ABS: {ex.record}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`text-xs font-bold ${ex.change.includes('+0.0') ? 'text-muted' : 'text-primary'}`}>{ex.change}</span>
                                                                <span className={`material-symbols-outlined text-zinc-600 text-sm transition-transform duration-200 ${selectedExercise === ex.name ? 'rotate-90 text-primary' : ''}`}>chevron_right</span>
                                                            </div>
                                                        </div>
                                                        {selectedExercise === ex.name && renderChart()}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        )}
      </main>

          </div>
  );
}

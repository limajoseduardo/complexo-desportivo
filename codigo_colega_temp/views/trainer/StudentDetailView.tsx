
import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Screen, UserRole } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface StudentDetailViewProps {
  onBack: () => void;
}

export default function StudentDetailView({ onBack }: StudentDetailViewProps) {
  const { setScreen, viewingStudent, startChat, user, chats, alerts, selectStudentForProgress, refreshAlerts } = useApp();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'WORKOUT' | 'DIET' | 'CHAT'>('OVERVIEW');
  const [dietDetails, setDietDetails] = useState<{name: string, calories: number} | null>(null);
  const [workoutDetails, setWorkoutDetails] = useState<{id: string, title: string, description?: string} | null>(null);
  
  // Reports State
  const [studentReports, setStudentReports] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // Bio Data State
  const [studentBio, setStudentBio] = useState<{
      height?: number;
      weight?: number;
      birthdate?: string;
      goal?: string;
      avatar?: string;
  }>({});

  // Recent Progress State
  const [recentActivity, setRecentActivity] = useState<{
      hasActivity: boolean;
      workoutsCount: number;
      lastWeight: number | null;
      lastWeightDate: string | null;
      weightDiff: number;
      hasNewPhotos: boolean;
      weightUpdated: boolean;
  }>({ hasActivity: false, workoutsCount: 0, lastWeight: null, lastWeightDate: null, weightDiff: 0, hasNewPhotos: false, weightUpdated: false });
  
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  // Copy Modal State
  const [copyModal, setCopyModal] = useState<{ isOpen: boolean; type: 'WORKOUT' | 'DIET' | null }>({ isOpen: false, type: null });
  const [copySearch, setCopySearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isCopying, setIsCopying] = useState(false); // NEW STATE FOR LOADING
  
  // Real Data State for Copy Modal
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Calculate Real Notifications (Chats + Alerts)
  const unreadMessages = viewingStudent ? (chats.find(c => c.participantId === viewingStudent.id)?.unreadCount || 0) : 0;
  const unreadAlertsCount = viewingStudent ? alerts.filter(a => a.studentId === viewingStudent.id && !a.read).length : 0;
  const totalNotifications = unreadMessages + unreadAlertsCount;

  // Helper to calculate age
  const calculateAge = (birthdate?: string) => {
      if (!birthdate) return null;
      // Expecting DD/MM/YYYY based on input mask
      const parts = birthdate.split('/');
      if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const today = new Date();
          let age = today.getFullYear() - year;
          const m = today.getMonth() - month;
          if (m < 0 || (m === 0 && today.getDate() < day)) {
              age--;
          }
          return isNaN(age) ? null : age;
      }
      return null;
  };

  // Fetch Data (Diet + Workout + Bio + Recent Progress + REPORTS)
  useEffect(() => {
    const fetchDetails = async () => {
        if (!viewingStudent?.id) return;
        setIsLoadingActivity(true);
        
        try {
            // 1. Fetch Profile Info (Diet, Bio)
            const { data: profile } = await supabase
                .from('profiles')
                .select('diet_plan_name, target_calories, height, weight, birthdate, goal, avatar, training_frequency, rest_days')
                .eq('id', viewingStudent.id)
                .single();
            
            if (profile) {
                setDietDetails({
                    name: profile.diet_plan_name || 'Sem plano definido',
                    calories: profile.target_calories || 0
                });
                setStudentBio({
                    height: profile.height,
                    weight: profile.weight,
                    birthdate: profile.birthdate,
                    goal: profile.goal,
                    avatar: profile.avatar,
                    trainingFrequency: profile.training_frequency,
                    restDays: profile.rest_days
                });
            }

            // 2. Fetch Workout Info
            const { data: workouts } = await supabase
                .from('workouts')
                .select('id, title, description')
                .eq('assigned_student_id', viewingStudent.id)
                .limit(1);

            if (workouts && workouts.length > 0) {
                setWorkoutDetails(workouts[0]);
            } else {
                setWorkoutDetails(null);
            }

            // 3. Fetch Recent Progress (Last 7 Days)
            const today = new Date();
            const lastWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7).toISOString();

            const { count: workoutsCount } = await supabase
                .from('workouts')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_student_id', viewingStudent.id)
                .eq('completed', true)
                .gte('completed_at', lastWeekDate);

            const { data: weights } = await supabase
                .from('weight_history')
                .select('weight, date, photo_front, photo_side, photo_back')
                .eq('user_id', viewingStudent.id)
                .order('date', { ascending: false })
                .limit(10);

            let lastWeight = null;
            let weightDiff = 0;
            let hasWeightActivity = false;
            let hasNewPhotos = false;

            if (weights && weights.length > 0) {
                lastWeight = weights[0].weight;
                const isRecent = new Date(weights[0].date) >= new Date(lastWeekDate);
                
                if (isRecent) {
                    hasWeightActivity = true;
                    if (weights.length > 1) {
                        weightDiff = weights[0].weight - weights[1].weight;
                    }

                    // Check for photos in ANY entry within last week
                    const recentEntries = weights.filter(w => new Date(w.date) >= new Date(lastWeekDate));
                    hasNewPhotos = recentEntries.some(w => w.photo_front || w.photo_side || w.photo_back);
                }
                
                // Format for chart: ascending dates
                const chartData = [...weights]
                    .reverse()
                    .map(w => ({
                        date: new Date(w.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                        weight: w.weight
                    }));
                setWeightHistory(chartData);
            }

            setRecentActivity({
                hasActivity: (workoutsCount || 0) > 0 || hasWeightActivity || hasNewPhotos,
                workoutsCount: workoutsCount || 0,
                lastWeight,
                lastWeightDate: weights && weights.length > 0 ? weights[0].date : null,
                weightDiff,
                hasNewPhotos,
                weightUpdated: hasWeightActivity
            });

            // 4. Fetch Reports (Issues)
            const { data: reportsData } = await supabase
                .from('student_reports')
                .select('*')
                .eq('student_id', viewingStudent.id)
                .order('created_at', { ascending: false });
            
            if (reportsData) {
                setStudentReports(reportsData);
            }

        } catch (e) {
            console.error("Erro ao buscar detalhes", e);
        } finally {
            setIsLoadingActivity(false);
        }
    };
    fetchDetails();
  }, [viewingStudent]);

  // Fetch Available Students for Copy
  useEffect(() => {
      if (copyModal.isOpen && viewingStudent?.id) {
          const fetchStudents = async () => {
              setIsLoadingList(true);
              try {
                  const { data, error } = await supabase
                    .from('profiles')
                    .select('id, name, avatar')
                    .in('role', ['STUDENT', 'TRAINER'])
                    .neq('id', viewingStudent.id)
                    .order('name');
                  
                  if (data) {
                      setAvailableStudents(data);
                  }
              } catch (e) {
                  console.error("Erro ao buscar alunos para cópia", e);
              } finally {
                  setIsLoadingList(false);
              }
          };
          fetchStudents();
      }
  }, [copyModal.isOpen, viewingStudent]);

  if (!viewingStudent) {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-background">
              <p>Nenhum aluno selecionado</p>
              <button onClick={onBack} className="text-primary mt-4">Voltar</button>
          </div>
      );
  }

  const handleResolveReport = async (reportId: string) => {
      // Optimistic update
      setStudentReports(prev => prev.filter(r => r.id !== reportId));
      
      try {
          await supabase.from('student_reports').delete().eq('id', reportId);
          // Also refresh global alerts to clear the notification dot
          refreshAlerts();
      } catch (e) {
          console.error("Error resolving report", e);
          alert("Erro ao resolver relato.");
      }
  };

  const displayAvatar = studentBio.avatar || viewingStudent.avatar;
  const avatarUrl = displayAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingStudent.name)}&background=13ec5b&color=102216`;
  const age = calculateAge(studentBio.birthdate);

  // Logic to handle workout navigation
  const handleWorkoutNavigation = () => {
      if (workoutDetails) {
          setScreen(Screen.TRAINER_EDIT_WORKOUT);
      } else {
          setScreen(Screen.WORKOUT_CREATOR);
      }
  };

  // Logic to handle diet navigation
  const handleDietNavigation = () => {
      if (dietDetails && dietDetails.name !== 'Sem plano definido') {
          setScreen(Screen.TRAINER_EDIT_DIET);
      } else {
          setScreen(Screen.DIET_CREATOR);
      }
  };

  const handleTabClick = (tab: 'OVERVIEW' | 'WORKOUT' | 'DIET' | 'CHAT') => {
      setActiveTab(tab);
      if (tab === 'CHAT') {
          startChat(viewingStudent.id, viewingStudent.name, avatarUrl);
      } else if (tab === 'WORKOUT') {
          handleWorkoutNavigation();
      } else if (tab === 'DIET') {
          handleDietNavigation();
      }
  };

  const openCopyModal = (type: 'WORKOUT' | 'DIET') => {
      setCopyModal({ isOpen: true, type });
      setCopySearch('');
      setSelectedStudents([]);
  };

  const toggleStudent = (id: string) => {
      if (selectedStudents.includes(id)) {
          setSelectedStudents(prev => prev.filter(s => s !== id));
      } else {
          setSelectedStudents(prev => [...prev, id]);
      }
  };

  const performCopy = async () => {
      if (selectedStudents.length === 0 || !viewingStudent || !user) return;
      setIsCopying(true);

      try {
          if (copyModal.type === 'WORKOUT') {
              // 1. Check Source Data
              const { data: sourceWorkouts } = await supabase
                  .from('workouts')
                  .select('*')
                  .eq('assigned_student_id', viewingStudent.id);
              
              if (!sourceWorkouts || sourceWorkouts.length === 0) {
                  throw new Error("O aluno de origem não possui treinos registados.");
              }

              // Loop through selected students
              for (const targetId of selectedStudents) {
                  // A. Clean uncompleted workouts and archive completed ones
                  await supabase.from('workouts').delete().eq('assigned_student_id', targetId).eq('completed', false);
                  await supabase.from('workouts').update({ day_label: 'ARCHIVED_' + Date.now() }).eq('assigned_student_id', targetId).eq('completed', true);

                  // B. Re-create structure
                  for (const srcW of sourceWorkouts) {
                      const { data: newW, error: wError } = await supabase.from('workouts').insert({
                          title: srcW.title,
                          description: srcW.description,
                          day_label: srcW.day_label,
                          trainer_id: user.id,
                          assigned_student_id: targetId,
                          created_at: new Date().toISOString()
                      }).select('id').single();

                      if (wError || !newW) continue;

                      // Exercises
                      const { data: srcExs } = await supabase
                          .from('workout_exercises')
                          .select('*')
                          .eq('workout_id', srcW.id);
                      
                      if (!srcExs) continue;

                      for (const srcEx of srcExs) {
                          const { data: newEx, error: exError } = await supabase.from('workout_exercises').insert({
                              workout_id: newW.id,
                              name: srcEx.name,
                              notes: srcEx.notes,
                              rest_time: srcEx.rest_time,
                              is_header: srcEx.is_header,
                              exercise_library_id: srcEx.exercise_library_id,
                              type: srcEx.type || 'STRENGTH',
                              order_index: srcEx.order_index,
                              created_at: new Date().toISOString()
                          }).select('id').single();

                          if (exError || !newEx) continue;

                          // Sets
                          const { data: srcSets } = await supabase
                              .from('workout_sets')
                              .select('*')
                              .eq('exercise_id', srcEx.id);
                          
                          if (srcSets && srcSets.length > 0) {
                              const setsPayload = srcSets.map(s => ({
                                  exercise_id: newEx.id,
                                  reps: s.reps,
                                  weight: s.weight,
                                  time: s.time,
                                  intensity: s.intensity,
                                  created_at: new Date().toISOString()
                              }));
                              await supabase.from('workout_sets').insert(setsPayload);
                          }
                      }
                  }
              }
          } else if (copyModal.type === 'DIET') {
              // 1. Fetch Source Diet Config
              const { data: srcProfile } = await supabase
                  .from('profiles')
                  .select('diet_plan_name, target_calories, target_protein, target_carbs, target_fat')
                  .eq('id', viewingStudent.id)
                  .single();
              
              // 2. Fetch Source Meals with Items
              const { data: srcMeals } = await supabase
                  .from('diet_meals')
                  .select('*, diet_items(*)')
                  .eq('student_id', viewingStudent.id);

              if (!srcMeals || srcMeals.length === 0) {
                  throw new Error("O aluno de origem não possui dieta registada.");
              }

              for (const targetId of selectedStudents) {
                  // A. Update Profile Macros
                  if (srcProfile) {
                      await supabase.from('profiles').update({
                          diet_plan_name: srcProfile.diet_plan_name,
                          target_calories: srcProfile.target_calories,
                          target_protein: srcProfile.target_protein,
                          target_carbs: srcProfile.target_carbs,
                          target_fat: srcProfile.target_fat
                      }).eq('id', targetId);
                  }

                  // B. Wipe existing Meals
                  await supabase.from('diet_meals').delete().eq('student_id', targetId);

                  // C. Create New Meals & Items
                  for (const meal of srcMeals) {
                      const { data: newMeal, error: mError } = await supabase.from('diet_meals').insert({
                          student_id: targetId,
                          name: meal.name,
                          order_index: meal.order_index,
                          day_of_week: meal.day_of_week
                      }).select('id').single();

                      if (mError || !newMeal) continue;

                      if (meal.diet_items && meal.diet_items.length > 0) {
                          const itemsPayload = meal.diet_items.map((item: any) => ({
                              meal_id: newMeal.id,
                              name: item.name,
                              quantity: item.quantity,
                              image: item.image,
                              is_extra: false // Copied plan is always base, not extra
                          }));
                          await supabase.from('diet_items').insert(itemsPayload);
                      }
                  }
              }
          }

          // Redirect Logic: Switch context to the (first) target student
          if (selectedStudents.length > 0) {
              const targetId = selectedStudents[0];
              const targetStudent = availableStudents.find(s => s.id === targetId);
              if (targetStudent) {
                  alert(`${copyModal.type === 'WORKOUT' ? 'Treinos' : 'Dieta'} copiados! Redirecionando para ${targetStudent.name}...`);
                  selectStudentForProgress(targetId, targetStudent.name);
                  setActiveTab(copyModal.type === 'WORKOUT' ? 'WORKOUT' : 'DIET');
                  // Trigger navigation explicitly if activeTab effect doesn't handle it immediately (it handles layout, but navigation might be needed if user was on 'OVERVIEW')
                  if (copyModal.type === 'WORKOUT') {
                      // Small timeout to allow state propagation before navigation logic runs
                      setTimeout(() => setScreen(Screen.TRAINER_EDIT_WORKOUT), 100);
                  } else {
                      setTimeout(() => setScreen(Screen.TRAINER_EDIT_DIET), 100);
                  }
              }
          } else {
              alert("Copiado com sucesso!");
          }

          setCopyModal({ ...copyModal, isOpen: false });
          setSelectedStudents([]);

      } catch (e: any) {
          console.error(e);
          alert(`Erro ao copiar: ${e.message}`);
      } finally {
          setIsCopying(false);
      }
  };

  const filteredStudents = availableStudents.filter(s => s.name.toLowerCase().includes(copySearch.toLowerCase()));

  const getRestDaysStr = (days: number[] | undefined) => {
      if (!days || days.length === 0) return 'Nenhum';
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return days.map(d => dayNames[d]).join(', ');
  };

  const renderStatusBadge = () => {
      if (isLoadingActivity) {
          return (
              <div className="flex items-center gap-2 mt-1 opacity-50">
                  <span className="w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin"></span>
                  <span className="text-xs text-muted">Calculando...</span>
              </div>
          );
      }
      if (!recentActivity.hasActivity) {
          return (
              <div className="flex items-center gap-2 mt-1 bg-red-500/10 px-2 py-0.5 rounded w-fit border border-red-500/20">
                  <span className="material-symbols-outlined text-red-500 text-sm">person_off</span>
                  <span className="text-xs text-red-400 font-bold">Inativo (7d)</span>
              </div>
          );
      }
      if (recentActivity.workoutsCount < 2) {
          return (
              <div className="flex items-center gap-2 mt-1 bg-amber-500/10 px-2 py-0.5 rounded w-fit border border-amber-500/20">
                  <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>
                  <span className="text-xs text-amber-500 font-bold">Baixo progresso</span>
              </div>
          );
      }
      return (
          <div className="flex items-center gap-2 mt-1 bg-primary/10 px-2 py-0.5 rounded w-fit border border-primary/20">
              <span className="material-symbols-outlined text-primary text-sm">trending_up</span>
              <span className="text-xs text-primary font-bold">Bom progresso</span>
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <header className="pt-6 pb-2 px-6 bg-background sticky top-0 z-10">
          {/* Header Content */}
          <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                  <div 
                    className="h-16 w-16 rounded-full bg-cover bg-center border border-main/10" 
                    style={{ backgroundImage: `url('${avatarUrl}')` }}
                  ></div>
                  {totalNotifications > 0 && (
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-background">
                        {totalNotifications > 9 ? '9+' : totalNotifications}
                    </div>
                  )}
              </div>
              
              <div className="flex-1">
                  <h1 className="text-xl font-bold text-main leading-none">{viewingStudent.name}</h1>
                  {/* BIO STATS ROW - Shows Height, Weight, Age */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                      {studentBio.height && (
                          <div className="flex items-center gap-1 bg-main/5 px-2 py-1 rounded border border-main/5">
                              <span className="material-symbols-outlined text-[10px] text-muted">straighten</span>
                              <span className="text-[10px] font-bold text-main">
                                  {studentBio.height < 3 ? `${studentBio.height}m` : `${studentBio.height}cm`}
                              </span>
                          </div>
                      )}
                      {studentBio.weight && (
                          <div className="flex items-center gap-1 bg-main/5 px-2 py-1 rounded border border-main/5">
                              <span className="material-symbols-outlined text-[10px] text-muted">scale</span>
                              <span className="text-[10px] font-bold text-main">{studentBio.weight}kg</span>
                          </div>
                      )}
                      {age !== null && (
                          <div className="flex items-center gap-1 bg-main/5 px-2 py-1 rounded border border-main/5">
                              <span className="material-symbols-outlined text-[10px] text-muted">cake</span>
                              <span className="text-[10px] font-bold text-main">{age} anos</span>
                          </div>
                      )}
                  </div>
                  {renderStatusBadge()}
          </div>

          <button 
            onClick={onBack}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-surface text-main hover:bg-main/10"
          >
              <span className="material-symbols-outlined">close</span>
          </button>
      </div>

      {/* Alert Card (Dynamic) */}
      {(() => {
          if (isLoadingActivity) return null;
          const workoutAlert = recentActivity.workoutsCount === 0;
          const weightAlert = recentActivity.lastWeightDate 
            ? (new Date().getTime() - new Date(recentActivity.lastWeightDate).getTime()) > 2 * 24 * 60 * 60 * 1000 
            : true;
          const stagnation = weightHistory.length >= 3 && Math.abs(weightHistory[weightHistory.length-1].weight - weightHistory[weightHistory.length-3].weight) < 0.2;

          if (workoutAlert || weightAlert || stagnation) {
            let title = 'Alerta';
            let msg = '';
            let color = 'bg-amber-500';

            if (weightAlert) {
                title = 'Registo de Peso';
                msg = recentActivity.lastWeightDate 
                  ? 'O aluno não regista o peso há mais de 2 dias.' 
                  : 'O aluno ainda não registou o peso na plataforma.';
                color = 'bg-amber-600';
            } else if (stagnation) {
                title = 'Alerta de Estagnação';
                msg = 'O peso não variou significativamente nas últimas pesagens. Talvez seja altura de ajustar as macros.';
                color = 'bg-orange-500';
            } else if (workoutAlert) {
                title = 'Inatividade';
                msg = 'O aluno ainda não treinou esta semana.';
                color = 'bg-red-500';
            }

            return (
                <div className={`mx-4 mt-2 ${color} text-white p-4 rounded-2xl shadow-lg animate-in slide-in-from-top-4 duration-500`}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
                    </div>
                    <p className="text-[11px] text-white/90 leading-snug">{msg}</p>
                </div>
            );
          }
          return null;
      })()}

      {/* Tabs */}
          <div className="flex items-center border-b border-main/10 mt-2">
             <button 
                onClick={() => handleTabClick('OVERVIEW')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'OVERVIEW' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-muted-foreground'}`}
             >
                 Visão Geral
             </button>
             <button 
                onClick={() => handleTabClick('WORKOUT')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'WORKOUT' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-muted-foreground'}`}
             >
                 Treino
             </button>
             <button 
                onClick={() => handleTabClick('DIET')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'DIET' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-muted-foreground'}`}
             >
                 Dieta
             </button>
             <button 
                onClick={() => handleTabClick('CHAT')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'CHAT' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-muted-foreground'}`}
             >
                 Chat
             </button>
          </div>
      </header>

      <main className="p-4 space-y-4 overflow-y-auto pb-24">
          {/* --- REPORTS SECTION (NEW) --- */}
          {studentReports.length > 0 && (
              <div className="bg-surface rounded-xl p-5 border border-red-500/20 shadow-lg animate-enter">
                  <h2 className="text-lg font-bold text-main mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-500">campaign</span>
                      Relatos Pendentes
                  </h2>
                  <div className="space-y-3">
                      {studentReports.map(report => (
                          <div key={report.id} className="bg-main/5 rounded-lg p-3 border border-main/5 relative">
                              <div className="flex justify-between items-start mb-1">
                                  <h3 className={`text-sm font-bold ${report.is_urgent ? 'text-red-400' : 'text-amber-400'}`}>
                                      {report.title || 'Relato'}
                                  </h3>
                                  <span className="text-[10px] text-muted">
                                      {new Date(report.created_at).toLocaleDateString('pt-BR')}
                                  </span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                                  {report.message}
                              </p>
                              <div className="flex justify-end">
                                  <button 
                                      onClick={() => handleResolveReport(report.id)}
                                      className="flex items-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                                  >
                                      <span className="material-symbols-outlined text-sm">check</span>
                                      Marcar como Resolvido
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* Card: Plano Atual */}
          <div className="bg-surface rounded-xl p-5 border border-main/5 shadow-lg">
              <h2 className="text-lg font-bold text-main mb-4">Plano Atual</h2>
              
              <div className="space-y-4">
                  <div className="flex justify-between items-start border-b border-main/5 pb-4">
                      <div className="flex-1">
                          <p className="text-xs text-muted font-bold mb-1">Objetivo do Aluno</p>
                          <div className="flex items-center gap-2 mb-3">
                              <span className="material-symbols-outlined text-primary text-sm">track_changes</span>
                              <p className="text-base font-bold text-main uppercase tracking-tight">
                                  {studentBio.goal || <span className="text-muted font-normal italic">Não definido</span>}
                              </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-2">
                              <div>
                                  <p className="text-[10px] text-muted font-bold mb-0.5 uppercase tracking-wider">Disponibilidade</p>
                                  <div className="flex items-center gap-1.5 text-main">
                                    <span className="material-symbols-outlined text-[14px] text-primary">fitness_center</span>
                                    <span className="text-xs font-bold">{studentBio.trainingFrequency ? `${studentBio.trainingFrequency}x p/ Semana` : 'Não def.'}</span>
                                  </div>
                              </div>
                              <div>
                                  <p className="text-[10px] text-muted font-bold mb-0.5 uppercase tracking-wider">Descanso</p>
                                  <div className="flex items-center gap-1.5 text-main">
                                    <span className="material-symbols-outlined text-[14px] text-blue-400">bed</span>
                                    <span className="text-xs font-bold leading-tight">{getRestDaysStr(studentBio.restDays)}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-between items-center border-b border-main/5 pb-4">
                      <div>
                          <p className="text-xs text-muted font-bold mb-1">Plano de Treino</p>
                          <p className="text-base font-bold text-main">
                              {workoutDetails 
                                ? (workoutDetails.description || workoutDetails.title) 
                                : <span className="text-muted italic">Sem treino definido</span>}
                          </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                            onClick={() => openCopyModal('WORKOUT')}
                            title="Copiar este treino para outros alunos"
                            className={`h-10 w-10 bg-main/5 rounded-lg flex items-center justify-center transition-colors border border-transparent ${workoutDetails ? 'text-muted hover:text-primary hover:border-primary/20' : 'text-zinc-500 opacity-30 cursor-not-allowed'}`}
                            disabled={!workoutDetails}
                        >
                            <span className="material-symbols-outlined text-[20px]">content_copy</span>
                        </button>
                        <button 
                            onClick={handleWorkoutNavigation}
                            className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${workoutDetails ? 'bg-main/5 hover:bg-main/10 text-muted hover:text-main' : 'bg-primary text-background hover:brightness-110 shadow-lg shadow-primary/20'}`}
                        >
                            <span className="material-symbols-outlined">{workoutDetails ? 'edit' : 'add'}</span>
                        </button>
                      </div>
                  </div>

                  <div className="flex justify-between items-center">
                      <div>
                          <p className="text-xs text-muted font-bold mb-1">Dieta</p>
                          <p className="text-base font-bold text-main">
                              {dietDetails 
                                ? (dietDetails.name === 'Sem plano definido' 
                                    ? <span className="text-muted italic">Sem plano definido</span> 
                                    : `${dietDetails.name} - ${dietDetails.calories}kcal`) 
                                : <span className="animate-pulse bg-main/10 h-5 w-32 rounded inline-block"></span>
                              }
                          </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                            onClick={() => openCopyModal('DIET')}
                            title="Copiar esta dieta para outros alunos"
                            className={`h-10 w-10 bg-main/5 rounded-lg flex items-center justify-center transition-colors border border-transparent ${dietDetails && dietDetails.name !== 'Sem plano definido' ? 'text-muted hover:text-primary hover:border-primary/20' : 'text-zinc-500 opacity-30 cursor-not-allowed'}`}
                            disabled={!dietDetails || dietDetails.name === 'Sem plano definido'}
                        >
                            <span className="material-symbols-outlined text-[20px]">content_copy</span>
                        </button>
                        <button 
                            onClick={handleDietNavigation}
                            className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${dietDetails && dietDetails.name !== 'Sem plano definido' ? 'bg-main/5 hover:bg-main/10 text-muted hover:text-main' : 'bg-primary text-background hover:brightness-110 shadow-lg shadow-primary/20'}`}
                        >
                            <span className="material-symbols-outlined">{dietDetails && dietDetails.name !== 'Sem plano definido' ? 'edit' : 'add'}</span>
                        </button>
                      </div>
                  </div>
              </div>
          </div>

          {/* Card: Evolução de Peso */}
          <div className="bg-surface rounded-xl p-4 border border-main/5 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-bold text-main">Evolução de Peso</h2>
                  <button 
                    onClick={() => setScreen(Screen.PROGRESS)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                  >
                        <span className="material-symbols-outlined text-sm">history</span>
                        Ver Histórico
                  </button>
              </div>

              {weightHistory.length > 1 ? (
                  <div className="h-24 w-full mb-3">
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={weightHistory} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                              <XAxis 
                                  dataKey="date" 
                                  hide 
                              />
                              <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                              <Tooltip 
                                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #2563EB', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                  itemStyle={{ color: '#2563EB' }}
                                  labelStyle={{ color: '#999' }}
                                  cursor={{ stroke: "rgba(var(--color-main), 0.1)", strokeWidth: 1 }}
                              />
                              <Line 
                                  type="monotone" 
                                  dataKey="weight" 
                                  stroke="rgb(var(--color-primary))" 
                                  strokeWidth={3} 
                                  dot={{ r: 4, fill: "rgb(var(--color-primary))", strokeWidth: 0 }} 
                                  activeDot={{ r: 6, stroke: '#1e293b', strokeWidth: 2 }}
                                  animationDuration={500}
                              />
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              ) : (
                  <div className="h-24 flex flex-col items-center justify-center text-muted border border-dashed border-main/10 rounded-xl mb-3 bg-main/5">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-30">show_chart</span>
                      <p className="text-sm">Registros insuficientes para exibir o gráfico</p>
                  </div>
              )}

              <div className="bg-main/5 p-3 rounded-lg border border-main/5">
                  <p className="text-[10px] text-muted font-bold uppercase mb-1">Último Peso</p>
                  <div className="flex items-baseline gap-2">
                      <p className="text-lg font-bold text-main">
                          {recentActivity.lastWeight ? `${recentActivity.lastWeight}kg` : '--'}
                      </p>
                      {recentActivity.weightDiff !== 0 && (
                          <span className={`text-xs font-bold ${recentActivity.weightDiff < 0 ? 'text-blue-400' : 'text-red-400'}`}>
                              {recentActivity.weightDiff > 0 ? '+' : ''}{recentActivity.weightDiff.toFixed(1)}kg
                          </span>
                      )}
                  </div>
              </div>
          </div>

          {/* Card: Atividade e Fotos */}
          <div className="bg-surface rounded-xl p-5 border border-main/5 shadow-lg">
              <h2 className="text-lg font-bold text-main mb-3">Atividade e Fotos</h2>
              
              {recentActivity.hasActivity ? (
                  <div className="mb-5 space-y-3">
                      {recentActivity.workoutsCount > 0 && (
                          <div className="flex items-start gap-3 bg-main/5 p-3 rounded-lg border border-main/5">
                              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
                                  <span className="material-symbols-outlined text-lg">fitness_center</span>
                              </div>
                              <div>
                                  <p className="text-main font-bold text-sm">{recentActivity.workoutsCount} treinos</p>
                                  <p className="text-xs text-muted">Realizados na última semana.</p>
                              </div>
                          </div>
                      )}

                      {recentActivity.weightUpdated && (
                          <div className="flex items-start gap-3 bg-main/5 p-3 rounded-lg border border-main/5">
                              <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-500">
                                  <span className="material-symbols-outlined text-lg">monitor_weight</span>
                              </div>
                              <div>
                                  <p className="text-main font-bold text-sm">Peso Atualizado</p>
                                  <p className="text-xs text-muted">O aluno registou o seu peso recentemente.</p>
                              </div>
                          </div>
                      )}

                      {recentActivity.hasNewPhotos && (
                          <div className="flex items-start gap-3 bg-main/5 p-3 rounded-lg border border-main/5">
                              <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-500">
                                  <span className="material-symbols-outlined text-lg">photo_library</span>
                              </div>
                              <div>
                                  <p className="text-main font-bold text-sm">Novas Fotos</p>
                                  <p className="text-xs text-muted">Há novos registos fotográficos para análise.</p>
                              </div>
                          </div>
                      )}
                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center py-4 mb-2 text-muted">
                      <span className="material-symbols-outlined text-3xl mb-1 opacity-50">history_toggle_off</span>
                      <p className="text-sm text-center">Nenhum treino registado<br/>na última semana.</p>
                  </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setScreen(Screen.PERFORMANCE_HISTORY)}
                    className="bg-main/5 hover:bg-main/5 border border-primary/20 text-primary hover:text-main font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs"
                  >
                      <span className="material-symbols-outlined text-sm">show_chart</span>
                      Cargas
                  </button>
                  <button 
                    onClick={() => setScreen(Screen.PROGRESS)}
                    className="bg-main/5 hover:bg-main/5 border border-primary/20 text-primary hover:text-main font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs"
                  >
                      <span className="material-symbols-outlined text-sm">photo_camera</span>
                      Fotos & Medidas
                  </button>
              </div>
          </div>
      </main>

      {/* Copy Modal */}
      {copyModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center">
             <div className="w-full max-w-sm bg-surface sm:rounded-3xl rounded-t-3xl p-6 border-t border-main/10 sm:border shadow-2xl animate-in slide-in-from-bottom-10 duration-300 relative flex flex-col max-h-[85vh]">
                 <div className="w-12 h-1.5 bg-main/20 rounded-full mx-auto mb-6"></div>
                 <h3 className="text-xl font-bold text-main text-center mb-6">{copyModal.type === 'WORKOUT' ? 'Copiar Treino para...' : 'Copiar Dieta para...'}</h3>
                 <div className="bg-main/5 rounded-xl flex items-center px-4 h-12 border border-main/5 focus-within:border-main/20 transition-colors mb-4">
                    <span className="material-symbols-outlined text-muted mr-3">search</span>
                    <input type="text" placeholder="Buscar aluno..." value={copySearch} onChange={e => setCopySearch(e.target.value)} className="bg-transparent text-main w-full outline-none placeholder:text-zinc-600 text-sm font-medium" />
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-2 mb-6 pr-1 no-scrollbar min-h-[200px]">
                    {isLoadingList ? <div className="flex justify-center py-10"><span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></span></div> : filteredStudents.length === 0 ? <div className="text-center text-muted py-10 text-sm">Nenhum aluno encontrado.</div> : filteredStudents.map(student => {
                            const isSelected = selectedStudents.includes(student.id);
                            return (
                                <div key={student.id} onClick={() => toggleStudent(student.id)} className="flex items-center justify-between p-3 hover:bg-main/5 rounded-xl cursor-pointer transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-cover bg-center border border-main/5" style={{ backgroundImage: `url('${student.avatar}')` }}></div>
                                        <span className="font-bold text-main text-sm">{student.name}</span>
                                    </div>
                                    <div className={`h-6 w-6 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-zinc-400 dark:border-zinc-600 group-hover:border-zinc-400 bg-transparent'}`}>{isSelected && <span className="material-symbols-outlined text-background text-sm font-bold">check</span>}</div>
                                </div>
                            );
                        })}
                 </div>
                 <div className="flex gap-3 mt-auto">
                     <button 
                        onClick={() => setCopyModal({ ...copyModal, isOpen: false })} 
                        className="flex-1 h-12 rounded-xl border border-main/10 text-main font-bold text-sm hover:bg-main/5 transition-colors"
                        disabled={isCopying}
                     >
                        Cancelar
                     </button>
                     <button 
                        onClick={performCopy} 
                        disabled={selectedStudents.length === 0 || isCopying} 
                        className={`flex-[2] h-12 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${selectedStudents.length > 0 ? 'bg-primary text-background hover:brightness-110 shadow-primary/20' : 'bg-zinc-300 dark:bg-zinc-800 text-muted cursor-not-allowed'}`}
                     >
                        {isCopying ? <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin"></span> : 'Copiar e Ajustar'}
                     </button>
                 </div>
             </div>
        </div>
      )}

          </div>
  );
}

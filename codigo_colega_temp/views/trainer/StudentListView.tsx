
import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Screen, User } from '../../types';
import { supabase } from '../../lib/supabaseClient';

interface StudentListViewProps {
  onBack: () => void;
}

// Helper component for the Progress Circles
const ProgressRing = ({ 
    percentage, 
    label, 
    subLabel, 
    subLabelColor, 
    color 
}: { 
    percentage: number, 
    label: string, 
    subLabel: string, 
    subLabelColor: string, 
    color: string 
}) => {
    const radius = 28;
    const stroke = 4;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <p className="text-[10px] text-muted mb-2 font-medium">{label}</p>
            <div className="relative flex items-center justify-center mb-1">
                <svg
                    height={radius * 2}
                    width={radius * 2}
                    className="rotate-[-90deg]"
                >
                    <circle
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth={stroke}
                        fill="transparent"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                    <circle
                        stroke={color}
                        strokeWidth={stroke}
                        strokeDasharray={circumference + ' ' + circumference}
                        style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                        strokeLinecap="round"
                        fill="transparent"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                </svg>
                <div className="absolute flex items-center justify-center inset-0">
                    <span className="text-xs font-bold text-main">{Math.round(percentage)}%</span>
                </div>
            </div>
            <p className={`text-[10px] font-bold ${subLabelColor}`}>{subLabel}</p>
        </div>
    );
};

export default function StudentListView({ onBack }: StudentListViewProps) {
  const { setScreen, user, selectStudentForProgress, generateAccessCode } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for Invite Code Modal
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [showInviteWarning, setShowInviteWarning] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // State for Remove Confirmation Modal
  const [studentToRemove, setStudentToRemove] = useState<string | null>(null);
  const [removePassword, setRemovePassword] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // State for Real Data
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch Real Students
  useEffect(() => {
    const fetchStudents = async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .or(`role.eq.STUDENT,id.eq.${user?.id}`)
                .order('name');
            
            if (error) {
                console.warn("Supabase Fetch Error:", error);
                setFetchError("Não foi possível carregar a lista.");
            } else if (profiles) {
                // Fetch stats for each student concurrently
                const enrichedData = await Promise.all(profiles.map(async (p) => {
                    // --- 1. Real Weight Stats ---
                    let weightPct = 0;
                    let weightLabel = "0.0kg";
                    let weightTextColor = "text-muted";
                    let weightColor = "#ef4444"; // default red if low progress

                    try {
                        const { data: history } = await supabase
                            .from('weight_history')
                            .select('weight')
                            .eq('user_id', p.id)
                            .order('date', { ascending: true });

                        if (history && history.length > 0) {
                            const start = history[0].weight;
                            const current = history[history.length - 1].weight;
                            const target = p.target_weight || start; // Avoid division by zero
                            const previous = history.length > 1 ? history[history.length - 2].weight : start;

                            // Progress % towards target
                            // If target is diff from start
                            if (Math.abs(start - target) > 0.1) {
                                const totalDist = Math.abs(start - target);
                                const coveredDist = Math.abs(start - current);
                                weightPct = Math.min(100, (coveredDist / totalDist) * 100);
                            } else {
                                // Maintenance or no target set, use stability as 100%? Or 0?
                                // Let's use 0 if no clear goal movement
                                weightPct = 0;
                            }

                            // Label: Change since last weigh-in
                            const diff = current - previous;
                            weightLabel = (diff > 0 ? '+' : '') + diff.toFixed(1) + 'kg';
                            
                            // Color Logic
                            const isHipertrophy = p.goal?.toLowerCase().includes('hipertrofia') || p.goal?.toLowerCase().includes('massa');
                            // Good if gained and hypertrophy OR lost and not hypertrophy
                            const isGood = isHipertrophy ? diff >= 0 : diff <= 0;
                            
                            weightTextColor = isGood ? 'text-primary' : 'text-red-400';
                            weightColor = weightPct > 70 ? '#2563EB' : (weightPct > 30 ? '#fbbf24' : '#ef4444');
                        }
                    } catch (e) { console.error('Weight stats error', e); }

                    // --- 2. Real Frequency Stats (Previously Diet) ---
                    let freqPct = 0;
                    let freqLabel = "0/sem";
                    let freqColor = "#ef4444";
                    let freqTextColor = "text-muted";

                    try {
                        const today = new Date();
                        const lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7).toISOString();
                        
                        // Count completed workouts in last 7 days
                        const { count: freqCount } = await supabase
                            .from('workouts')
                            .select('*', { count: 'exact', head: true })
                            .eq('assigned_student_id', p.id)
                            .eq('completed', true)
                            .gte('completed_at', lastWeek);
                        
                        const count = freqCount || 0;
                        const weeklyGoal = 3; // Baseline goal for 100% circle
                        
                        freqPct = Math.min(100, Math.round((count / weeklyGoal) * 100));
                        freqLabel = `${count}/sem`;
                        
                        if (count >= 3) {
                            freqColor = '#2563EB'; // Green
                            freqTextColor = 'text-primary';
                        } else if (count >= 1) {
                            freqColor = '#fbbf24'; // Yellow
                            freqTextColor = 'text-amber-400';
                        } else {
                            freqColor = '#ef4444'; // Red
                            freqTextColor = 'text-red-400';
                        }

                    } catch (e) { console.error('Freq stats error', e); }

                    // --- 3. Real Workout Stats (Adherence) ---
                    let workoutPct = 0;
                    let workoutLabel = "0%";
                    let workoutColor = "#ef4444";

                    try {
                        const { count: totalWorkouts } = await supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('assigned_student_id', p.id);
                        const { count: completedWorkouts } = await supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('assigned_student_id', p.id).eq('completed', true);
                        
                        if (totalWorkouts && totalWorkouts > 0) {
                            workoutPct = Math.round(((completedWorkouts || 0) / totalWorkouts) * 100);
                            workoutLabel = workoutPct + "%";
                            workoutColor = workoutPct >= 80 ? '#2563EB' : (workoutPct >= 50 ? '#fbbf24' : '#ef4444');
                        }
                    } catch (e) { console.error('Workout stats error', e); }

                    return {
                        id: p.id,
                        name: p.name,
                        avatar: p.avatar,
                        last_seen: p.last_seen,
                        created_at: p.created_at,
                        goal: p.goal || 'Definir Meta',
                        stats: {
                            weight: { pct: weightPct, label: weightLabel, color: weightColor, textColor: weightTextColor },
                            frequency: { pct: freqPct, label: freqLabel, color: freqColor, textColor: freqTextColor },
                            workout: { pct: workoutPct, label: workoutLabel, color: workoutColor, textColor: workoutPct > 50 ? 'text-primary' : 'text-muted' }
                        },
                        notifCount: 0 
                    };
                }));
                
                // Sort by activity: frequency percentage descending, then name ascending
                enrichedData.sort((a, b) => {
                    if (b.stats.frequency.pct !== a.stats.frequency.pct) {
                        return b.stats.frequency.pct - a.stats.frequency.pct;
                    }
                    return a.name.localeCompare(b.name);
                });
                
                setStudentsList(enrichedData);
            }
        } catch (e) {
            console.error("Erro ao buscar alunos", e);
            setFetchError("Erro de conexão ao buscar alunos.");
        } finally {
            setIsLoading(false);
        }
    };

    fetchStudents();
  }, []);

  const handleGenerateClick = () => {
    setShowInviteWarning(true);
  };

  const handleConfirmGenerate = async () => {
    setShowInviteWarning(false);
    const code = await generateAccessCode();
    if (code) {
        setGeneratedCode(code);
    } else {
        setFetchError("Erro ao salvar código.");
    }
  };

  const copyToClipboard = () => {
      if (generatedCode) {
          navigator.clipboard.writeText(generatedCode);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      }
  };

  const handleNavigateToDetail = (studentId: string, name: string, avatar?: string) => {
    selectStudentForProgress(studentId, name, avatar);
    setScreen(Screen.TRAINER_STUDENT_DETAIL);
  };

  const handleRequestRemove = (studentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setStudentToRemove(studentId); 
    setRemovePassword('');
    setRemoveError(null);
  };

  const confirmRemoval = async () => {
    if (!studentToRemove || !user?.email) return;
    
    if (!removePassword) {
        setRemoveError("A palavra-passe é obrigatória.");
        return;
    }

    setIsRemoving(true);
    setRemoveError(null);

    try {
        // 1. Verify password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: removePassword,
        });

        if (signInError) {
            setRemoveError("Palavra-passe incorreta.");
            setIsRemoving(false);
            return;
        }

    // 2. Delete all related data manually since we don't have CASCADE set up
    const deleteOps = [
        // Workouts
        async () => {
            const { data: workouts } = await supabase.from('workouts').select('id').eq('assigned_student_id', studentToRemove);
            if (workouts && workouts.length > 0) {
                const workoutIds = workouts.map(w => w.id);
                const { data: exercises } = await supabase.from('workout_exercises').select('id').in('workout_id', workoutIds);
                if (exercises && exercises.length > 0) {
                    const exerciseIds = exercises.map(e => e.id);
                    await supabase.from('workout_sets').delete().in('exercise_id', exerciseIds);
                }
                await supabase.from('workout_exercises').delete().in('workout_id', workoutIds);
                await supabase.from('workouts').delete().eq('assigned_student_id', studentToRemove);
            }
        },
        // Diets
        async () => {
            const { data: meals } = await supabase.from('diet_meals').select('id').eq('student_id', studentToRemove);
            if (meals && meals.length > 0) {
                const mealIds = meals.map(m => m.id);
                await supabase.from('diet_items').delete().in('meal_id', mealIds);
                await supabase.from('diet_meals').delete().eq('student_id', studentToRemove);
            }
        },
        // Messages & Chats
        async () => {
             await supabase.from('messages').delete().or(`sender_id.eq.${studentToRemove},receiver_id.eq.${studentToRemove}`);
             await supabase.from('chats').delete().or(`participant1_id.eq.${studentToRemove},participant2_id.eq.${studentToRemove}`);
        },
        // Metrics and Reports
        async () => await supabase.from('weight_history').delete().eq('user_id', studentToRemove),
        async () => await supabase.from('progress_photos').delete().eq('user_id', studentToRemove),
        async () => await supabase.from('student_reports').delete().eq('student_id', studentToRemove),
        async () => await supabase.from('student_cardio_notes').delete().eq('student_id', studentToRemove),
        
        // Notifications and Access
        async () => await supabase.from('read_notifications').delete().eq('user_id', studentToRemove),
        async () => await supabase.from('notifications').delete().eq('user_id', studentToRemove),
        async () => await supabase.from('invite_codes').delete().eq('student_id', studentToRemove),
    ];

    // Execute all deletion steps, swallowing errors for non-existent tables or minor issues
    for (const op of deleteOps) {
        try {
            await op();
        } catch (e) {
            console.warn("Sub-deletion failed, continuing...", e);
        }
    }

    // Finally, delete the profile - this is the only one that must succeed for UI to update
    const { error: profileError } = await supabase.from('profiles').delete().eq('id', studentToRemove);
    
    if (profileError) throw profileError;
        
        setStudentsList(prev => prev.filter(s => s.id !== studentToRemove));
        setStudentToRemove(null);
    } catch (e) {
        console.error("Erro ao remover", e);
        setRemoveError("Erro ao remover aluno. Tente novamente.");
    } finally {
        setIsRemoving(false);
    }
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    return (new Date().getTime() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
  };

  const filteredStudents = studentsList.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background relative">
      <header className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5">
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-main">Gestão de Alunos</h1>
            <div className="flex gap-2">
                <button 
                  onClick={handleGenerateClick}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-primary text-background hover:brightness-110 shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg font-bold">add</span>
                </button>
            </div>
        </div>

        <div className="bg-surface rounded-xl flex items-center px-3 h-10 border border-main/5 focus-within:border-primary/50 transition-colors mb-2">
          <span className="material-symbols-outlined text-muted mr-2 text-lg">search</span>
          <input 
            type="text" 
            placeholder="Procurar aluno..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent text-main w-full outline-none placeholder:text-muted text-sm"
          />
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 overflow-y-auto pb-24">
        {isLoading ? (
             <div className="flex justify-center py-10">
                 <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
             </div>
        ) : fetchError ? (
            <div className="text-center py-10 text-red-400 text-sm p-4 border border-red-500/20 rounded-xl bg-red-500/10">
                <span className="material-symbols-outlined text-3xl mb-2">error</span>
                <p>{fetchError}</p>
            </div>
        ) : filteredStudents.length === 0 ? (
            <div className="text-center text-muted py-10 flex flex-col items-center">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">person_off</span>
                <p>Nenhum aluno encontrado.</p>
                <button onClick={handleGenerateClick} className="mt-4 text-primary text-sm font-bold">
                    Convidar primeiro aluno
                </button>
            </div>
        ) : (
            <div className="space-y-4">
                {filteredStudents.map((student: any) => (
                    <div 
                        key={student.id}
                        className="rounded-2xl p-5 transition-all duration-300 relative overflow-hidden bg-card border border-main/5 hover:border-main/10"
                    >
                        <div 
                            onClick={() => handleNavigateToDetail(student.id, student.name, student.avatar)}
                            className="cursor-pointer"
                        >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="h-12 w-12 rounded-full bg-cover bg-center border-2 border-main/10" style={{ backgroundImage: `url('${student.avatar}')` }}></div>
                                            {isOnline(student.last_seen) && (
                                                <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-surface shadow-sm"></div>
                                            )}
                                            {student.notifCount > 0 && !isOnline(student.last_seen) && (
                                                <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-surface">
                                                    {student.notifCount}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-main text-base leading-tight">
                                                {student.name}
                                                {student.id === user?.id && <span className="ml-2 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Tu</span>}
                                            </h3>
                                            <p className="text-xs text-muted font-medium mt-0.5 opacity-80">Meta: {student.goal}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={(e) => handleRequestRemove(student.id, e)}
                                            className="h-8 w-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                        <span className="material-symbols-outlined text-zinc-600">chevron_right</span>
                                    </div>
                                </div>

                                <div className="flex justify-around items-center mb-1 mt-2 bg-main/5 p-2 rounded-xl border border-main/5">
                                    <ProgressRing 
                                        percentage={student.stats.weight.pct} 
                                        label="Peso" 
                                        subLabel={student.stats.weight.label} 
                                        subLabelColor={student.stats.weight.textColor}
                                        color={student.stats.weight.color} 
                                    />
                                    <div className="w-px h-12 bg-main/10"></div>
                                    <ProgressRing 
                                        percentage={student.stats.frequency.pct} 
                                        label="Frequência" 
                                        subLabel={student.stats.frequency.label} 
                                        subLabelColor={student.stats.frequency.textColor}
                                        color={student.stats.frequency.color} 
                                    />
                                    <div className="w-px h-12 bg-main/10"></div>
                                    <ProgressRing 
                                        percentage={student.stats.workout.pct} 
                                        label="Treino" 
                                        subLabel={student.stats.workout.label} 
                                        subLabelColor={student.stats.workout.textColor}
                                        color={student.stats.workout.color} 
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
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
                        onClick={handleConfirmGenerate}
                        className="flex-1 h-12 rounded-xl bg-primary text-background font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                    >
                        Gerar
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* REMOVE STUDENT CONFIRMATION MODAL */}
      {studentToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                 <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                    <span className="material-symbols-outlined text-3xl">warning</span>
                 </div>
                 <h3 className="text-xl font-bold text-main mb-2">Remover Aluno?</h3>
                 <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                    Tens a certeza que desejas remover este aluno? Esta ação <span className="font-bold text-red-400">apagará todos os dados</span> (treinos, dieta, histórico, chat) e não poderá ser desfeita.
                 </p>
                 
                 <div className="w-full mb-6">
                    <label className="block text-left text-xs font-bold text-muted mb-1">Confirma a tua palavra-passe para continuar:</label>
                    <input 
                        type="password" 
                        value={removePassword}
                        onChange={(e) => setRemovePassword(e.target.value)}
                        placeholder="A tua palavra-passe de treinador"
                        className="w-full bg-main/5 border border-main/10 rounded-xl px-4 py-3 text-main placeholder:text-zinc-600 focus:border-red-500 focus:outline-none transition-colors"
                    />
                    {removeError && (
                        <p className="text-red-400 text-xs mt-2 text-left">{removeError}</p>
                    )}
                 </div>

                 <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => {
                            setStudentToRemove(null);
                            setRemovePassword('');
                            setRemoveError(null);
                        }}
                        disabled={isRemoving}
                        className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmRemoval}
                        disabled={isRemoving || !removePassword}
                        className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center"
                    >
                        {isRemoving ? <span className="w-5 h-5 border-2 border-main border-t-transparent rounded-full animate-spin"></span> : 'Remover Tudo'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* INVITE CODE MODAL */}
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

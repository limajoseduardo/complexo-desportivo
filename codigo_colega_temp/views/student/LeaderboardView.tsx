
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../contexts/AppContext';
import { Screen, UserRole } from '../../types';
import { TourGuide, TourStep } from '../../components/TourGuide';

interface LeaderboardEntry {
    userId: string;
    userName: string;
    userAvatar: string;
    score: number;
    rank: number;
    trend: 'up' | 'down' | 'stable';
    detail: string;
}

const CATEGORIES = [
    { id: 'prs', name: 'Duelos PR', icon: 'military_tech', unit: 'kg' },
    { id: 'consistency', name: 'Consistência', icon: 'calendar_month', unit: 'dias' }
];

const LEADERBOARD_TOUR_STEPS: TourStep[] = [
    {
        targetId: 'tour-ranking-header',
        title: 'Ranking Pro',
        content: 'Bem-vindo ao Ranking Pro! Aqui podes ver onde te situas em relação aos outros alunos e desafiá-los para duelos saudáveis.',
        position: 'bottom'
    },
    {
        targetId: 'tour-ranking-tabs',
        title: 'Categorias de Competição',
        content: 'Alterna entre Consistência (dias treinados no mês) e Duelos de PR (maiores cargas em exercícios específicos).',
        position: 'bottom'
    },
    {
        targetId: 'tour-duel-selectors',
        title: 'Configurar Duelo',
        content: 'Escolhe um exercício e um rival específico para veres a diferença de carga entre vocês em tempo real!',
        position: 'bottom'
    },
    {
        targetId: 'tour-ranking-list',
        title: 'Lista de Ranking',
        content: 'Vê o pódio e a lista completa. Clica em qualquer aluno para o definires como teu rival direto no topo.',
        position: 'top'
    }
];

export default function LeaderboardView({ onBack }: { onBack: () => void }) {
    const { user, sendMessage, selectChat, setScreen, updateUserProfile } = useApp();
    const [activeTab, setActiveTab] = useState('prs');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [availableExercises, setAvailableExercises] = useState<any[]>([]);
    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
    const [selectedRivalId, setSelectedRivalId] = useState<string | null>(null);
    const [isSendingChallenge, setIsSendingChallenge] = useState(false);
    const [challengeSent, setChallengeSent] = useState(false);

    // Tour State
    const [isTourOpen, setIsTourOpen] = useState(false);

    useEffect(() => {
        if (user && user.role === UserRole.STUDENT && !user.hasSeenLeaderboardTour) {
            const timer = setTimeout(() => setIsTourOpen(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [user]);

    const handleTourFinished = async () => {
        setIsTourOpen(false);
        try {
            await updateUserProfile({ hasSeenLeaderboardTour: true });
        } catch (e) {
            console.error("Error updating leaderboard tour status", e);
        }
    };

    const fetchExercises = async () => {
        try {
            let query = supabase
                .from('exercise_library')
                .select('id, name')
                .order('name');

            const { data: libraryData, error: libError } = await query;
            if (libError) throw libError;

            let finalExercises = [...(libraryData || [])];

            // Fetch custom exercises created manually (without library entry)
            const { data: allWorkoutExs, error: allExsError } = await supabase
                .from('workout_exercises')
                .select('name, exercise_library_id, workouts!inner(assigned_student_id)');

            if (!allExsError && allWorkoutExs) {
                // Determine which exercises to keep
                let allowedNames = new Set<string>();
                let allowedIds = new Set<string>();

                if (user?.role === UserRole.STUDENT) {
                    // Only keep exercises assigned to this student
                    const studentExs = allWorkoutExs.filter((ex: any) => ex.workouts?.assigned_student_id === user.id);
                    studentExs.forEach((ex: any) => {
                        if (ex.exercise_library_id) allowedIds.add(ex.exercise_library_id);
                        if (ex.name) allowedNames.add(ex.name);
                    });

                    // Filter library data to only those assigned
                    finalExercises = finalExercises.filter(ex => allowedIds.has(ex.id) || allowedNames.has(ex.name));
                } else {
                    // For PTs, allow all
                    allWorkoutExs.forEach((ex: any) => {
                        if (ex.name) allowedNames.add(ex.name);
                    });
                }

                // Add custom exercises that don't exist in the library
                const existingNames = new Set(finalExercises.map(ex => ex.name.toLowerCase()));
                allowedNames.forEach(name => {
                    if (!existingNames.has(name.toLowerCase())) {
                        finalExercises.push({ id: `custom-${name}`, name });
                        existingNames.add(name.toLowerCase()); // prevent duplicates
                    }
                });
            }

            if (finalExercises.length > 0) {
                // Re-sort alphabetically
                finalExercises.sort((a, b) => a.name.localeCompare(b.name));
                setAvailableExercises(finalExercises);
                // Try to find a popular exercise as default or take the first
                const benchMatch = finalExercises.find(ex => ex.name.toLowerCase().includes('supino') || ex.name.toLowerCase().includes('reto'));
                setSelectedExerciseId(benchMatch?.id || finalExercises[0].id);
            } else {
                setAvailableExercises([]);
                setSelectedExerciseId(null);
            }
        } catch (e) {
            console.error("Error fetching exercises", e);
        }
    };

    useEffect(() => {
        fetchExercises();
    }, []);

    const fetchLeaderboard = async (category: string, exerciseId: string | null) => {
        setIsLoading(true);
        try {
            const { data: students, error: studentsError } = await supabase
                .from('profiles')
                .select('id, name, avatar, weight')
                .eq('role', UserRole.STUDENT);

            if (studentsError) throw studentsError;

            // Date filtering based on selected month/year
            const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
            const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).toISOString();

            let query = supabase
                .from('workouts')
                .select(`
                    assigned_student_id,
                    completed_at,
                    workout_exercises (
                        exercise_library_id,
                        name,
                        workout_sets (
                            weight, reps, completed
                        )
                    )
                `)
                .eq('completed', true)
                .limit(5000); // Increased limit to ensure no workouts are missed
            
            if (category !== 'prs') {
                query = query.gte('completed_at', startDate).lte('completed_at', endDate);
            }

            const { data: workoutData, error: workoutError } = await query;
            if (workoutError) throw workoutError;

            // 3. Optional: Get list of students who have done this exercise, but don't strictly exclude others
            let studentsWithRecords: Set<string> | null = null;
            if (activeTab === 'prs' && selectedExerciseId) {
                const targetEx = availableExercises.find(ex => ex.id === selectedExerciseId);
                const isCustomId = selectedExerciseId.startsWith('custom-');
                
                let orFilter = '';
                if (isCustomId && targetEx) {
                    orFilter = `name.eq."${targetEx.name}"`;
                } else {
                    orFilter = `exercise_library_id.eq.${selectedExerciseId}${targetEx ? `,name.eq."${targetEx.name}"` : ''}`;
                }

                const { data: eligibilityData } = await supabase
                    .from('workout_exercises')
                    .select('workouts(assigned_student_id)')
                    .or(orFilter);
                
                studentsWithRecords = new Set(eligibilityData?.filter(item => item.workouts).map((item: any) => item.workouts.assigned_student_id) || []);
            }

            const scores: Record<string, number> = {};
            const details: Record<string, string> = {};

            // Initialize all students with 0 score to ensure they appear in lists/rivalry
            students?.forEach(student => {
                scores[student.id] = 0;
                details[student.id] = category === 'prs' ? 'Sem registo' : '0 dias';
            });

            students?.forEach(student => {
                // For PRs, we might want to still show students even if they don't have it in plan
                // but for now let's respect the "eligible" logic if it's set
                if (studentsWithRecords && !studentsWithRecords.has(student.id)) return;

                const studentWorkouts = workoutData?.filter(w => w.assigned_student_id === student.id) || [];
                
                let score = 0;
                if (category === 'prs') {
                    if (exerciseId) {
                        const targetEx = availableExercises.find(ex => ex.id === exerciseId);
                        let maxScore = 0;
                        let bestSet = { weight: 0, reps: 0, sets: 0 };

                        studentWorkouts.forEach(w => {
                            w.workout_exercises?.forEach((ex: any) => {
                                // Robust comparison: trim, lowerCase, check if one contains the other
                                const nameA = ex.name?.trim().toLowerCase() || "";
                                const nameB = targetEx?.name?.trim().toLowerCase() || "";
                                
                                const matchByName = nameA && nameB && (nameA.includes(nameB) || nameB.includes(nameA));
                                
                                // Also include a check for exact match after trim/lower
                                const exactMatch = nameA === nameB;
                                
                                if (ex.exercise_library_id === exerciseId || matchByName || exactMatch) {
                                    // Count completed sets for this exercise in this session
                                    const sessionSets = ex.workout_sets?.filter((s: any) => s.completed).length || 0;
                                    
                                    ex.workout_sets?.forEach((s: any) => {
                                        // Calculate estimated 1RM: weight * (1 + reps / 30)
                                        if (s.weight && typeof s.weight === 'number' && s.weight > 0 && s.reps && s.completed) {
                                            const estimated1RM = s.weight * (1 + (s.reps / 30));
                                            if (estimated1RM > maxScore) {
                                                maxScore = estimated1RM;
                                                bestSet = { weight: s.weight, reps: s.reps, sets: sessionSets };
                                            }
                                        }
                                    });
                                }
                            });
                        });
                        score = maxScore;
                        details[student.id] = bestSet.weight > 0 ? `${bestSet.weight.toFixed(1)}kg x ${bestSet.reps} reps (${bestSet.sets} séries)` : 'Sem registo';
                    } else {
                        details[student.id] = `Escolha um exercício`;
                    }
                } else if (category === 'consistency') {
                    const validWorkouts = studentWorkouts.filter(w => w.completed_at);
                    const days = new Set(validWorkouts.map(w => new Date(w.completed_at).toDateString()));
                    score = days.size;
                    details[student.id] = `${score} dias ativos`;
                }
                scores[student.id] = score;
            });

            const sorted = students
                ?.filter(s => !studentsWithRecords || studentsWithRecords.has(s.id))
                .map(s => ({
                  userId: s.id,
                  userName: s.name,
                  userAvatar: s.avatar,
                  score: scores[s.id] || 0,
                  detail: details[s.id] || '0',
                }))
                .sort((a, b) => b.score - a.score)
                .map((entry, index) => ({
                    ...entry,
                    rank: index + 1,
                    trend: 'stable' as const // For visualization
                })) || [];

            setLeaderboard(sorted);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard(activeTab, selectedExerciseId);
        const handleFinished = () => {
            fetchLeaderboard(activeTab, selectedExerciseId);
        };
        window.addEventListener('workoutFinished', handleFinished);
        return () => window.removeEventListener('workoutFinished', handleFinished);
    }, [activeTab, selectedExerciseId, selectedMonth, selectedYear]);

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const handlePrevMonth = () => {
        if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear(selectedYear - 1);
        } else {
            setSelectedMonth(selectedMonth - 1);
        }
    };

    const handleNextMonth = () => {
        const now = new Date();
        if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth()) return;
        
        if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear(selectedYear + 1);
        } else {
            setSelectedMonth(selectedMonth + 1);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background custom-scrollbar overflow-hidden relative">
            <TourGuide 
                isOpen={isTourOpen} 
                steps={LEADERBOARD_TOUR_STEPS} 
                onClose={handleTourFinished} 
                onComplete={handleTourFinished} 
            />
            <div className="flex-1 flex flex-col overflow-y-auto animate-enter pb-24">
                {/* Header */}
                <header id="tour-ranking-header" className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-main/5 p-4 flex items-center gap-4">
                    <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-black text-main uppercase tracking-tight">Ranking Pro</h1>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Compete com a comunidade</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                        <span className="material-symbols-outlined">military_tech</span>
                    </div>
                </header>

                <main className="flex-1 p-4 space-y-6">
                {/* Month Navigator (Only for Consistency) */}
                {activeTab === 'consistency' && (
                    <div className="flex items-center justify-between bg-surface p-2 rounded-2xl border border-main/5 shadow-sm">
                        <button 
                            onClick={handlePrevMonth}
                            className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-main/5 text-muted transition-colors"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-black text-main uppercase tracking-tight">{months[selectedMonth]}</span>
                            <span className="text-[9px] text-muted font-bold tracking-widest">{selectedYear}</span>
                        </div>
                        <button 
                            onClick={handleNextMonth}
                            disabled={selectedYear === new Date().getFullYear() && selectedMonth === new Date().getMonth()}
                            className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-main/5 text-muted disabled:opacity-20 transition-colors"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div id="tour-ranking-tabs" className="flex gap-2 p-1 bg-surface rounded-2xl border border-main/5">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={`flex-1 flex flex-col items-center py-3 rounded-xl transition-all duration-300 ${activeTab === cat.id ? 'bg-main/10 text-primary shadow-inner scale-[1.02]' : 'text-muted hover:text-muted-foreground'}`}
                        >
                            <span className="material-symbols-outlined mb-1">{cat.icon}</span>
                            <span className="text-[10px] font-black uppercase tracking-tighter text-center px-1 leading-none">{cat.name}</span>
                        </button>
                    ))}
                </div>

                {/* Exercise & Rival Selector (Only for Recordes/PRs) */}
                {activeTab === 'prs' && (
                    <div id="tour-duel-selectors" className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Exercise Choice */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">1. Escolhe o Exercício</h3>
                                <span className="material-symbols-outlined text-primary text-sm animate-pulse">fitness_center</span>
                            </div>
                            <div className="relative">
                                {availableExercises.length > 0 ? (
                                    <>
                                        <select
                                            value={selectedExerciseId || ''}
                                            onChange={(e) => setSelectedExerciseId(e.target.value)}
                                            className="w-full bg-surface text-main font-bold text-sm px-4 py-3 rounded-xl border border-main/5 outline-none appearance-none focus:border-primary/50 transition-all shadow-lg"
                                        >
                                            {availableExercises.map(ex => (
                                                <option key={ex.id} value={ex.id} className="bg-surface">
                                                    {ex.name}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                                            arrow_drop_down
                                        </span>
                                    </>
                                ) : (
                                    <div className="p-4 bg-surface rounded-xl border border-main/5 text-center">
                                        <p className="text-xs text-muted italic">Nenhum exercício receitado para duelos ainda.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Rival Choice */}
                        {availableExercises.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">2. Escolhe o teu Rival (1vs1)</h3>
                                    <span className="material-symbols-outlined text-primary text-sm animate-pulse">target</span>
                                </div>
                                <div className="relative">
                                    <select
                                        value={selectedRivalId || ''}
                                        onChange={(e) => setSelectedRivalId(e.target.value || null)}
                                        className="w-full bg-surface text-main font-bold text-sm px-4 py-3 rounded-xl border border-main/5 outline-none appearance-none focus:border-primary/50 transition-all shadow-lg"
                                    >
                                        <option value="">Ranking Global (Todos)</option>
                                        {/* Show all valid students as rivals */}
                                        {leaderboard.filter(e => e.userId !== user?.id).map(entry => (
                                            <option key={entry.userId} value={entry.userId}>
                                                Contra: {entry.userName}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                                        compare_arrows
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Direct Duel Card (If Rival Selected) */}
                        {selectedRivalId && (
                            <div className="bg-gradient-to-br from-primary/20 to-background p-1 rounded-2xl border border-primary/30 shadow-[0_10px_40px_rgba(255,183,0,0.15)] animate-in zoom-in-95 duration-500">
                                <div className="bg-background/80 backdrop-blur-md rounded-xl p-4 flex flex-col items-center gap-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2">
                                        <button onClick={() => setSelectedRivalId(null)} className="text-muted hover:text-main transition-colors">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                    
                                    <div className="text-[10px] font-black uppercase text-primary tracking-[0.3em] mb-2">Duelo Direto</div>

                                    <div className="flex items-center justify-between w-full gap-4">
                                        {/* ME */}
                                        <div className="flex-1 flex flex-col items-center">
                                            <div className="relative mb-3">
                                                <img 
                                                    src={user?.avatar || 'https://picsum.photos/seed/me/100/100'} 
                                                    className="w-16 h-16 rounded-full border-2 border-primary object-cover" 
                                                    referrerPolicy="no-referrer"
                                                />
                                                <div className="absolute -bottom-1 -right-1 bg-primary text-background text-[8px] font-black px-2 py-0.5 rounded-full uppercase">TU</div>
                                            </div>
                                            <div className="text-sm font-black text-main truncate max-w-[100px]">
                                                {leaderboard.find(e => e.userId === user?.id)?.detail.split(' ')[0] || '0kg'}
                                                <div className="text-[9px] text-muted font-bold tracking-tighter -mt-1">
                                                    {leaderboard.find(e => e.userId === user?.id)?.detail.includes('x') ? leaderboard.find(e => e.userId === user?.id)?.detail.split('x')[1].trim() : '1 rep'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* VERSUS */}
                                        <div className="flex flex-col items-center">
                                            <div className="text-2xl font-black italic text-zinc-700 select-none">VS</div>
                                            <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-800 my-2"></div>
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-primary text-sm">bolt</span>
                                            </div>
                                        </div>

                                        {/* RIVAL */}
                                        <div className="flex-1 flex flex-col items-center">
                                            <div className="relative mb-3">
                                                <img 
                                                    src={leaderboard.find(e => e.userId === selectedRivalId)?.userAvatar || 'https://picsum.photos/seed/rival/100/100'} 
                                                    className="w-16 h-16 rounded-full border-2 border-zinc-700 object-cover opacity-80" 
                                                    referrerPolicy="no-referrer"
                                                />
                                                <div className="absolute -bottom-1 -right-1 bg-zinc-300 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">RIVAL</div>
                                            </div>
                                            <div className="text-sm font-black text-main truncate max-w-[100px]">
                                                {leaderboard.find(e => e.userId === selectedRivalId)?.detail.split(' ')[0] || '0kg'}
                                                <div className="text-[9px] text-muted font-bold tracking-tighter -mt-1">
                                                    {leaderboard.find(e => e.userId === selectedRivalId)?.detail.includes('x') ? leaderboard.find(e => e.userId === selectedRivalId)?.detail.split('x')[1].trim() : '1 rep'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Diff Indicator */}
                                    {(() => {
                                        const myScore = leaderboard.find(e => e.userId === user?.id)?.score || 0;
                                        const rivalScore = leaderboard.find(e => e.userId === selectedRivalId)?.score || 0;
                                        const diff = myScore - rivalScore;
                                        const rivalData = leaderboard.find(e => e.userId === selectedRivalId);
                                        const exerciseName = availableExercises.find(ex => ex.id === selectedExerciseId)?.name || 'Exercício';

                                        const handleChallenge = async () => {
                                            if (!selectedRivalId || !rivalData) return;
                                            setIsSendingChallenge(true);
                                            
                                            let message = '';
                                            if (diff === 0) {
                                                message = `🔥 ACABEI DE TE DESAFIAR! Ficámos empatados no duelo de ${exerciseName} com ${myScore.toFixed(1)}kg! Quero ver quem bate este PR primeiro hoje! 🚀`;
                                            } else if (diff > 0) {
                                                message = `💪 ACABEI DE TE PASSAR! No duelo de ${exerciseName} estou agora com ${myScore.toFixed(1)}kg e tu estás com ${rivalScore.toFixed(1)}kg. Consegues recuperar os ${diff.toFixed(1)}kg que nos separam? ⚡`;
                                            } else {
                                                message = `🔥 ESTOU QUASE A APANHAR-TE! No duelo de ${exerciseName} estás com ${rivalScore.toFixed(1)}kg e eu com ${myScore.toFixed(1)}kg. Só nos separam ${Math.abs(diff).toFixed(1)}kg! Prepara-te que vou passar por ti! 🚀`;
                                            }

                                            try {
                                                // Using selectedRivalId as chatId based on AppContext logic
                                                await sendMessage(selectedRivalId, message);
                                                setChallengeSent(true);
                                                // Redirect to chat
                                                selectChat(selectedRivalId);
                                            } catch (e) {
                                                console.error(e);
                                            } finally {
                                                setIsSendingChallenge(false);
                                            }
                                        };

                                        return (
                                                <div className="flex flex-col items-center gap-3 mt-2 w-full">
                                                    <div className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full ${diff >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {diff === 0 ? 'Empatados!' : (diff > 0 ? `Estás ${diff.toFixed(1)}kg à frente` : `Estás ${Math.abs(diff).toFixed(1)}kg atrás`)}
                                                    </div>

                                                    <button 
                                                        onClick={handleChallenge}
                                                        disabled={isSendingChallenge || challengeSent}
                                                        className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${challengeSent ? 'bg-emerald-500 text-background' : 'bg-primary text-background hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20'}`}
                                                    >
                                                        {isSendingChallenge ? (
                                                            <span className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
                                                        ) : challengeSent ? (
                                                            <>
                                                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                                                Desafio Enviado!
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="material-symbols-outlined text-sm">bolt</span>
                                                                {diff === 0 ? 'Desafiar no Chat' : (diff > 0 ? 'Provocar no Chat' : 'Desafiar no Chat')}
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                        {/* Podium for Top 3 */}
                        {!isLoading && leaderboard.length > 0 && (
                            <div className="flex items-end justify-center gap-2 pt-14 pb-0 h-80 relative">
                                {/* 2nd Place */}
                        <div className={`flex flex-col items-center animate-enter-bottom delay-100 ${leaderboard.length < 2 ? 'opacity-30' : ''}`}>
                            <div className="relative mb-2">
                                {leaderboard[1] ? (
                                    <>
                                        <img src={leaderboard[1].userAvatar} className="w-16 h-16 rounded-2xl border-2 border-zinc-400 object-cover" referrerPolicy="no-referrer" />
                                        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-zinc-400 rounded-lg flex items-center justify-center text-background font-black text-xs">2</div>
                                    </>
                                ) : (
                                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-zinc-500/30 flex items-center justify-center bg-main/5">
                                        <span className="material-symbols-outlined text-zinc-600">person</span>
                                    </div>
                                )}
                            </div>
                            <div className="h-24 w-20 bg-gradient-to-t from-zinc-400/20 to-zinc-400/50 rounded-t-2xl flex flex-col items-center justify-end p-2 border-t border-x border-zinc-400/30">
                                <span className="text-[10px] text-main font-black truncate w-full text-center">
                                    {leaderboard[1] ? leaderboard[1].userName.split(' ')[0] : '-'}
                                </span>
                                {leaderboard[1] && (
                                    <span className="text-[9px] text-zinc-500 font-bold leading-tight text-center">
                                        {activeTab === 'prs' ? (
                                            <>
                                                {leaderboard[1].detail.split('(')[0]}
                                                {leaderboard[1].detail.includes('(') && (
                                                    <span className="block text-[7px] opacity-70 italic">({leaderboard[1].detail.split('(')[1]}</span>
                                                )}
                                            </>
                                        ) : (
                                            `${leaderboard[1].detail.split(' ')[0]} ${activeTab === 'consistency' ? 'dias' : 'pts'}`
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 1st Place */}
                        <div className="flex flex-col items-center animate-enter-bottom">
                            <div className="relative mb-3">
                                <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none">
                                    <span className="material-symbols-outlined text-primary text-4xl animate-bounce">emoji_events</span>
                                </div>
                                {leaderboard[0] ? (
                                    <>
                                        <img src={leaderboard[0].userAvatar} className="w-24 h-24 rounded-3xl border-4 border-primary object-cover shadow-[0_0_30px_rgba(255,255,0,0.2)]" referrerPolicy="no-referrer" />
                                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-background font-black text-sm shadow-lg">1</div>
                                    </>
                                ) : (
                                    <div className="w-24 h-24 rounded-3xl border-4 border-dashed border-primary/30 flex items-center justify-center bg-main/5">
                                        <span className="material-symbols-outlined text-zinc-600 text-3xl">emoji_events</span>
                                    </div>
                                )}
                            </div>
                            <div className="h-36 w-28 bg-gradient-to-t from-primary/20 to-primary/50 rounded-t-3xl flex flex-col items-center justify-end p-3 border-t border-x border-primary/30">
                                <span className="text-xs text-main font-black truncate w-full text-center">
                                    {leaderboard[0] ? leaderboard[0].userName.split(' ')[0] : 'Vazio'}
                                </span>
                                {leaderboard[0] && (
                                    <span className="text-[10px] text-primary/80 font-bold leading-tight">
                                        {activeTab === 'prs' ? (
                                            <>
                                                {leaderboard[0].detail.split('(')[0]}
                                                <br/>
                                                <span className="text-[8px] opacity-70 italic">
                                                    {leaderboard[0].detail.includes('(') ? `(${leaderboard[0].detail.split('(')[1]}` : ''}
                                                </span>
                                            </>
                                        ) : (
                                            `${leaderboard[0].detail.split(' ')[0]} ${activeTab === 'consistency' ? 'dias' : 'pts'}`
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 3rd Place */}
                        <div className={`flex flex-col items-center animate-enter-bottom delay-200 ${leaderboard.length < 3 ? 'opacity-30' : ''}`}>
                            <div className="relative mb-2">
                                {leaderboard[2] ? (
                                    <>
                                        <img src={leaderboard[2].userAvatar} className="w-14 h-14 rounded-2xl border-2 border-orange-700 object-cover" referrerPolicy="no-referrer" />
                                        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-orange-700 rounded-lg flex items-center justify-center text-background font-black text-xs">3</div>
                                    </>
                                ) : (
                                    <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-orange-700/30 flex items-center justify-center bg-main/5">
                                        <span className="material-symbols-outlined text-zinc-600 text-sm">person</span>
                                    </div>
                                )}
                            </div>
                            <div className="h-16 w-20 bg-gradient-to-t from-orange-700/20 to-orange-700/50 rounded-t-2xl flex flex-col items-center justify-end p-2 border-t border-x border-orange-700/30">
                                <span className="text-[10px] text-main font-black truncate w-full text-center">
                                    {leaderboard[2] ? leaderboard[2].userName.split(' ')[0] : '-'}
                                </span>
                                {leaderboard[2] && (
                                    <span className="text-[9px] text-orange-900/50 font-bold leading-tight text-center">
                                        {activeTab === 'prs' ? (
                                            <>
                                                {leaderboard[2].detail.split('(')[0]}
                                                {leaderboard[2].detail.includes('(') && (
                                                    <span className="block text-[7px] opacity-70 italic">({leaderboard[2].detail.split('(')[1]}</span>
                                                )}
                                            </>
                                        ) : (
                                            `${leaderboard[2].detail.split(' ')[0]} ${activeTab === 'consistency' ? 'dias' : 'pts'}`
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Leaderboard List */}
                <div id="tour-ranking-list" className="space-y-2 !mt-0">
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => (
                            <div key={i} className="h-16 bg-surface rounded-2xl animate-pulse border border-main/5" />
                        ))
                    ) : (
                        leaderboard.map((entry, index) => {
                            const isMe = entry.userId === user?.id;
                            return (
                                <div
                                    key={entry.userId}
                                    onClick={() => {
                                        if (activeTab === 'prs' && !isMe) {
                                            setSelectedRivalId(entry.userId);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                    }}
                                    className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${isMe ? 'bg-primary/10 border-primary/30' : (selectedRivalId === entry.userId ? 'bg-zinc-300 dark:bg-zinc-800 border-primary' : 'bg-surface border-main/5 hover:border-main/20')} ${activeTab === 'prs' && !isMe ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                                >
                                    <div className="w-8 flex justify-center font-black text-muted italic">
                                        #{entry.rank}
                                    </div>
                                    <div className="relative">
                                        <img src={entry.userAvatar} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                                        {isMe && <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`text-sm font-bold truncate ${isMe ? 'text-primary' : (selectedRivalId === entry.userId ? 'text-primary' : 'text-main')}`}>{entry.userName}</h4>
                                            {activeTab === 'prs' && !isMe && (
                                                <span className={`shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${selectedRivalId === entry.userId ? 'bg-primary text-background' : 'bg-main/5 text-muted group-hover:bg-primary/20 group-hover:text-primary transition-colors'}`}>
                                                    {selectedRivalId === entry.userId ? 'Ativo' : 'Duelo'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest flex flex-wrap gap-1">
                                                <span>{entry.detail.split('(')[0]}</span>
                                                {entry.detail.includes('(') && (
                                                    <span className="text-primary/70">{`(${entry.detail.split('(')[1]}`}</span>
                                                )}
                                            </p>
                                            {activeTab === 'prs' && (
                                                <div className="flex items-center gap-0.5 bg-main/5 px-1.5 py-0.5 rounded text-[8px] font-bold text-muted-foreground border border-main/5">
                                                    <span className="material-symbols-outlined text-[10px]">bolt</span>
                                                    {Math.round(entry.score)}kg (Est. 1RM)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="flex items-center gap-1 text-muted group-hover:text-primary transition-colors">
                                            <span className="text-sm font-black italic">{activeTab === 'prs' ? entry.detail.split('x')[0].replace('kg', '') : Math.round(entry.score)}</span>
                                            <span className="text-[10px] font-bold">{activeTab === 'prs' ? 'kg' : ''}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </main>
        </div>

            </div>
    );
}

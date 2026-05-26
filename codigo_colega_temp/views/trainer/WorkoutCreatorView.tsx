
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../contexts/AppContext';
import { Screen, User, WorkoutTemplate } from '../../types';
import { supabase } from '../../lib/supabaseClient';

interface WorkoutCreatorViewProps {
  onBack: () => void;
}

const SPLIT_OPTIONS = [
    { count: 1, label: 'A', desc: 'Treino Único (Full Body)', letters: ['A'] },
    { count: 2, label: 'A - B', desc: 'Divisão em 2 dias (ex: Superior/Inferior)', letters: ['A', 'B'] },
    { count: 3, label: 'A - B - C', desc: 'Divisão em 3 dias (ex: Push/Pull/Legs)', letters: ['A', 'B', 'C'] },
    { count: 4, label: 'A - B - C - D', desc: 'Divisão em 4 dias', letters: ['A', 'B', 'C', 'D'] },
    { count: 5, label: 'A - B - C - D - E', desc: 'Divisão em 5 dias (Split completo)', letters: ['A', 'B', 'C', 'D', 'E'] },
    { count: 6, label: 'A - B - C - D - E - F', desc: 'Divisão em 6 dias', letters: ['A', 'B', 'C', 'D', 'E', 'F'] }
];

export default function WorkoutCreatorView({ onBack }: WorkoutCreatorViewProps) {
  const { viewingStudent, user, setScreen, sendPushNotification } = useApp();
  const [planName, setPlanName] = useState('');
  const [selectedSplit, setSelectedSplit] = useState<number>(3); // Default ABC
  const [isSaving, setIsSaving] = useState(false);
  
  // Templates State
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Real Student Data State
  const [studentDetails, setStudentDetails] = useState<User | null>(null);
  const [isLoadingStudent, setIsLoadingStudent] = useState(true);

   // Fetch full student details when component mounts
   useEffect(() => {
     const fetchStudentDetails = async () => {
         if (!viewingStudent?.id) {
             setIsLoadingStudent(false);
             return;
         }

         try {
             const { data, error } = await supabase
                 .from('profiles')
                 .select('*')
                 .eq('id', viewingStudent.id)
                 .single();
             
             if (data) {
                 const mapped: User = {
                    id: data.id,
                    name: data.name,
                    email: data.email,
                    avatar: data.avatar,
                    role: data.role,
                    goal: data.goal,
                    restDays: data.rest_days,
                    trainingFrequency: data.training_frequency
                 };
                 setStudentDetails(mapped);
                 // Prefill split based on student's preference
                 if (data.training_frequency) {
                     setSelectedSplit(Math.min(6, Math.max(1, data.training_frequency)));
                 }
             } else {
                 // Fallback basic data
                 setStudentDetails({
                     id: viewingStudent.id,
                     name: viewingStudent.name,
                     email: '',
                     role: 'STUDENT' as any,
                     avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingStudent.name)}&background=13ec5b&color=102216`,
                     goal: 'Não definido'
                 });
             }
         } catch (e) {
             console.error("Error fetching student details", e);
         } finally {
             setIsLoadingStudent(false);
         }
     };

     fetchStudentDetails();
   }, [viewingStudent]);

  // Fetch Templates
  useEffect(() => {
    const fetchTemplates = async () => {
        if (!user?.id) return;
        try {
            const { data } = await supabase
                .from('workout_templates')
                .select('*')
                .eq('trainer_id', user.id)
                .order('name', { ascending: true });
            if (data) setTemplates(data);
        } catch (e) {
            console.error("Error loading templates", e);
        }
    };
    fetchTemplates();
  }, [user]);

  const handleSelectTemplate = (template: WorkoutTemplate) => {
      setSelectedTemplateId(template.id);
      setPlanName(template.name);
      setSelectedSplit(template.split_count);
      setShowTemplates(false);
  };

  const handleCreatePlan = async () => {
    if (!planName.trim()) {
      alert("Por favor, digite um nome para o plano.");
      return;
    }

    if (!user || !viewingStudent) return;

    setIsSaving(true);

    try {
        // 1. Opcional: Limpar treinos antigos desse aluno para começar do zero (mantendo histórico de concluídos)
        await supabase.from('workouts').delete().eq('assigned_student_id', viewingStudent.id).eq('completed', false);
        await supabase.from('workouts').update({ day_label: 'ARCHIVED_' + Date.now() }).eq('assigned_student_id', viewingStudent.id).eq('completed', true);

        const template = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : null;

        // 2. Criar os treinos baseados na divisão escolhida ou template
        if (template && template.data.sessions) {
            // LOGICA PARA TEMPLATE (Deep Copy)
            for (const session of template.data.sessions) {
                const workoutId = crypto.randomUUID();
                
                // Insere Workout
                const { error: wErr } = await supabase.from('workouts').insert({
                    id: workoutId,
                    title: session.title,
                    description: planName,
                    trainer_id: user.id,
                    assigned_student_id: viewingStudent.id,
                    day_label: session.day_label,
                    created_at: new Date().toISOString()
                });
                if (wErr) throw wErr;

                // Insere Exercises e Sets
                if (session.exercises) {
                    for (let i = 0; i < session.exercises.length; i++) {
                        const ex = session.exercises[i];
                        const { data: exData, error: exErr } = await supabase.from('workout_exercises').insert({
                            workout_id: workoutId,
                            name: ex.name,
                            type: ex.type,
                            is_header: ex.isHeader || false,
                            is_superset: ex.isSuperset || false,
                            notes: ex.notes || '',
                            rest_time: ex.restTime || '',
                            order_index: (i + 1) * 10000,
                            created_at: new Date().toISOString()
                        }).select().single();
                        if (exErr) throw exErr;

                        // Insere Sets
                        if (ex.sets) {
                            const setsPayload = ex.sets.map(s => ({
                                exercise_id: exData.id,
                                reps: s.reps,
                                weight: 0,
                                time: s.time,
                                intensity: s.intensity,
                                created_at: new Date().toISOString()
                            }));
                            const { error: sErr } = await supabase.from('workout_sets').insert(setsPayload);
                            if (sErr) throw sErr;
                        }
                    }
                }
            }
        } else {
            // LOGICA PADRÃO (Apenas estrutura vazia)
            const splitConfig = SPLIT_OPTIONS.find(s => s.count === selectedSplit);
            if (!splitConfig) return;

            const workoutsToCreate = splitConfig.letters.map(letter => ({
                id: crypto.randomUUID(),
                title: `Treino ${letter}`, 
                description: planName, 
                trainer_id: user.id,
                assigned_student_id: viewingStudent.id,
                day_label: letter,
                created_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('workouts').insert(workoutsToCreate);
            if (error) throw error;
        }

        // Update student profile with training frequency based on selected split or template split
        const finalFrequency = template ? template.split_count : selectedSplit;
        await supabase
            .from('profiles')
            .update({ training_frequency: finalFrequency })
            .eq('id', viewingStudent.id);

        // 3. Notify Student
        const pushTitle = 'Novo Plano de Treino';
        const pushMessage = `Seu personal criou um novo plano: ${planName}`;

        await supabase.from('notifications').insert({
            user_id: viewingStudent.id,
            title: pushTitle,
            message: pushMessage,
            type: 'SUCCESS'
        });

        sendPushNotification(viewingStudent.id, pushTitle, pushMessage);

        // 4. Redirecionar para a tela de Edição (onde tem as abas A, B, C...)
        const isDesktopAdmin = window.location.pathname.includes('/ptadmin');
        if (isDesktopAdmin) {
            onBack();
        } else {
            setScreen(Screen.TRAINER_EDIT_WORKOUT);
        }

    } catch (e: any) {
        console.error("Erro ao criar plano", e);
        alert("Erro ao criar estrutura do plano: " + e.message);
    } finally {
        setIsSaving(false);
    }
  };

  const avatarUrl = studentDetails?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingStudent?.name || 'User')}&background=13ec5b&color=102216`;
  const isDesktopAdmin = window.location.pathname.includes('/ptadmin');

  return (
    <div className={`flex flex-col h-full bg-background pb-8 ${isDesktopAdmin ? 'pt-0' : ''}`}>
        {/* Header */}
        {!isDesktopAdmin && (
          <header className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 flex items-center gap-3">
              <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
              <span className="material-symbols-outlined">arrow_back_ios_new</span>
              </button>
              <h1 className="text-lg font-bold text-main">Novo Plano de Treino</h1>
          </header>
        )}

        <main className="flex-1 p-6 space-y-8 overflow-y-auto">
            {/* Student Card */}
            <div className="flex flex-col items-center justify-center pt-4">
                <div className="relative mb-3">
                    <div 
                        className="h-24 w-24 rounded-full bg-cover bg-center border-4 border-surface shadow-2xl" 
                        style={{ backgroundImage: `url('${avatarUrl}')` }}
                    ></div>
                    <div className="absolute -bottom-2 -right-2 bg-primary text-background p-2 rounded-full shadow-lg">
                        <span className="material-symbols-outlined text-xl font-bold">fitness_center</span>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-main">{viewingStudent?.name}</h2>
                <p className="text-muted text-sm">Configurando novo ciclo</p>

                {studentDetails && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                         <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full flex items-center gap-1">
                             <span className="material-symbols-outlined text-xs text-primary">target</span>
                             <span className="text-[10px] font-bold text-primary uppercase">{studentDetails.goal}</span>
                         </div>
                         <div className="px-3 py-1 bg-main/5 border border-main/10 rounded-full flex items-center gap-1">
                             <span className="material-symbols-outlined text-xs text-muted">calendar_today</span>
                             <span className="text-[10px] font-bold text-muted uppercase">Preferencia: {studentDetails.trainingFrequency}x</span>
                         </div>
                         {studentDetails.restDays && studentDetails.restDays.length > 0 && (
                             <div className="px-3 py-1 bg-main/5 border border-main/10 rounded-full flex items-center gap-1">
                                 <span className="material-symbols-outlined text-xs text-muted">bedtime</span>
                                 <span className="text-[10px] font-bold text-muted uppercase">
                                     Folgas: {studentDetails.restDays.map(d => ['D','S','T','Q','Q','S','S'][d]).join(',')}
                                 </span>
                             </div>
                         )}
                    </div>
                )}
            </div>

            {/* Step 1: Name */}
            <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 delay-100">
                <div className="flex justify-between items-center px-1">
                    <label className="text-sm font-bold text-primary uppercase tracking-wider">Nome do Plano</label>
                    {templates.length > 0 && (
                        <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowTemplates(!showTemplates)}
                            className="text-xs font-bold text-primary flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10 hover:bg-primary/10 transition-all"
                        >
                            <span className="material-symbols-outlined text-sm">{showTemplates ? 'close' : 'inventory_2'}</span>
                            {showTemplates ? 'Cancelar' : 'Usar da Base'}
                        </motion.button>
                    )}
                </div>

                {showTemplates && templates.length > 0 ? (
                    <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        {templates.map(t => (
                            <motion.button
                                key={t.id}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSelectTemplate(t)}
                                className={`p-4 rounded-xl border text-left transition-all flex justify-between items-center ${
                                    selectedTemplateId === t.id 
                                    ? 'bg-primary/5 border-primary' 
                                    : 'bg-surface border-main/10 hover:border-main/20'
                                }`}
                            >
                                <div>
                                    <p className="font-bold text-main uppercase italic">{t.name}</p>
                                    <p className="text-[10px] text-muted font-medium uppercase mt-0.5">Split {t.split_count} Dias • {t.category || 'Geral'}</p>
                                </div>
                                <span className="material-symbols-outlined text-muted text-sm italic">arrow_forward</span>
                            </motion.button>
                        ))}
                    </div>
                ) : (
                    <input 
                        type="text" 
                        value={planName}
                        onChange={(e) => {
                            setPlanName(e.target.value);
                            if (selectedTemplateId) setSelectedTemplateId(null);
                        }}
                        placeholder="Ex: Hipertrofia Fase 1, Adaptação..." 
                        className="w-full h-14 bg-surface rounded-2xl px-4 text-main border border-main/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium text-lg placeholder:text-zinc-600"
                        autoFocus
                    />
                )}
            </div>

            {/* Step 2: Split Selection */}
            <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 delay-200">
                <label className="text-sm font-bold text-primary ml-1 uppercase tracking-wider">Divisão Semanal</label>
                <div className="grid gap-3">
                    {SPLIT_OPTIONS.map((option) => (
                        <button
                            key={option.count}
                            onClick={() => setSelectedSplit(option.count)}
                            className={`relative p-4 rounded-xl border-2 text-left transition-all group ${
                                selectedSplit === option.count 
                                ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(37,99,235,0.15)]' 
                                : 'bg-surface border-transparent hover:border-main/10'
                            }`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-lg font-black tracking-wider ${selectedSplit === option.count ? 'text-primary' : 'text-main'}`}>
                                    {option.label}
                                </span>
                                {selectedSplit === option.count && (
                                    <span className="material-symbols-outlined text-primary">check_circle</span>
                                )}
                            </div>
                            <p className={`text-xs ${selectedSplit === option.count ? 'text-muted-foreground' : 'text-muted'}`}>
                                {option.desc}
                            </p>
                        </button>
                    ))}
                </div>
            </div>
        </main>

        <footer className="sticky bottom-0 bg-background p-6 border-t border-main/5">
            <button 
                onClick={handleCreatePlan}
                disabled={isSaving || !planName.trim()}
                className="w-full h-14 rounded-xl bg-primary text-background font-black text-lg shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSaving ? (
                    <>
                        <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                        Configurando...
                    </>
                ) : (
                    <>
                        <span>Criar e Editar</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </>
                )}
            </button>
        </footer>
    </div>
  );
}

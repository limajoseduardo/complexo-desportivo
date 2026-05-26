
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../contexts/AppContext';
import { Screen, WorkoutTemplate } from '../../types';
import { supabase } from '../../lib/supabaseClient';

interface WorkoutTemplatesViewProps {
  onBack: () => void;
}

let cachedTemplates: WorkoutTemplate[] | null = null;

export default function WorkoutTemplatesView({ onBack }: WorkoutTemplatesViewProps) {
  const { user, setScreen, setEditingTemplateId } = useApp();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(cachedTemplates || []);
  const [isLoading, setIsLoading] = useState(!cachedTemplates);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [selectedTemplateForView, setSelectedTemplateForView] = useState<WorkoutTemplate | null>(null);
  const [isRenamingTemplate, setIsRenamingTemplate] = useState<WorkoutTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateSplitCount, setNewTemplateSplitCount] = useState(3);
  const [newTemplateCategory, setNewTemplateCategory] = useState('');

  // Apply Modal State
  const [applyingTemplate, setApplyingTemplate] = useState<WorkoutTemplate | null>(null);
  const [applyStep, setApplyStep] = useState<'SELECT_STUDENT' | 'SELECT_MODE' | 'APPLY_DAY'>('SELECT_STUDENT');
  const [trainerStudents, setTrainerStudents] = useState<any[]>([]);
  const [selectedStudentForApply, setSelectedStudentForApply] = useState<any | null>(null);
  const [studentCurrentWorkouts, setStudentCurrentWorkouts] = useState<any[]>([]);
  
  const [selectedTemplateSession, setSelectedTemplateSession] = useState<any | null>(null);
  const [selectedTargetDayLabel, setSelectedTargetDayLabel] = useState<string>('A');
  const [isApplying, setIsApplying] = useState(false);
  const [applyStudentSearch, setApplyStudentSearch] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    if (!user) return;
    if (!cachedTemplates) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
          cachedTemplates = data;
          setTemplates(data || []);
      }
    } catch (e) {
      console.error("Error fetching templates:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTemplates(prev => prev.filter(t => t.id !== id));
      setIsDeletingId(null);
    } catch (e) {
      console.error("Error deleting template:", e);
    }
  };

  const updateTemplate = async () => {
    if (!isRenamingTemplate || !newName.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('workout_templates')
        .update({ 
            name: newName.trim(),
            description: newDesc.trim()
        })
        .eq('id', isRenamingTemplate.id);

      if (error) throw error;
      setTemplates(prev => prev.map(t => t.id === isRenamingTemplate.id ? { ...t, name: newName.trim(), description: newDesc.trim() } : t));
      setIsRenamingTemplate(null);
      setNewDesc('');
    } catch (e) {
      console.error("Error updating", e);
    } finally {
      setIsSaving(false);
    }
  };

  const createTemplate = async () => {
    if (!user || !newTemplateName.trim()) return;
    
    // Dismiss keyboard immediately to prevent iOS ghosting/white screen issues
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    setIsSaving(true);
    try {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].slice(0, newTemplateSplitCount);
      const sessions = letters.map(letter => ({
        day_label: letter,
        title: `Treino ${letter}`,
        exercises: []
      }));

      const newTemplateData = { sessions };
      
      const { data, error } = await supabase
        .from('workout_templates')
        .insert({
          trainer_id: user.id,
          name: newTemplateName.trim(),
          description: newTemplateDescription.trim(),
          split_count: newTemplateSplitCount,
          category: newTemplateCategory.trim() || 'Geral',
          data: newTemplateData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      setTemplates(prev => [data, ...prev]);
      
      setIsCreatingTemplate(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      setNewTemplateCategory('');
      
      // Delay navigation slightly to allow keyboard to close fully
      setTimeout(() => {
        // Navigate to Editor
        setEditingTemplateId(data.id);
        setScreen(Screen.TRAINER_EDIT_TEMPLATE);
      }, 300);
    } catch (e) {
      console.error("Error creating template", e);
      setIsSaving(false);
    } 
    // removed finally to avoid setting isSaving(false) before screen transition 
  };

  useEffect(() => {
     if (applyingTemplate && user) {
        const fetchStudents = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, avatar')
                .or(`role.eq.STUDENT,id.eq.${user?.id}`)
                .order('name');
            
            if (data && !error) {
                setTrainerStudents(data);
            }
        };
        fetchStudents();
     }
  }, [applyingTemplate, user]);

  const handleSelectApplyStudent = async (student: any) => {
      setSelectedStudentForApply(student);
      setApplyStep('SELECT_MODE');
      
      const { data } = await supabase
          .from('workouts')
          .select('id, day_label, title')
          .eq('assigned_student_id', student.id)
          .order('day_label', { ascending: true });
          
      if (data) setStudentCurrentWorkouts(data);
  };

  const insertExercisesForWorkout = async (exercises: any[], workoutId: string) => {
      for (let i = 0; i < exercises.length; i++) {
          const ex = exercises[i];
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

          if (ex.sets && ex.sets.length > 0) {
              const setsPayload = ex.sets.map((s: any) => ({
                  exercise_id: exData.id,
                  reps: s.reps,
                  weight: s.weight,
                  time: s.time,
                  intensity: s.intensity,
                  created_at: new Date().toISOString()
              }));
              await supabase.from('workout_sets').insert(setsPayload);
          }
      }
  };

  const handleApplyFullPlan = async () => {
      if (!applyingTemplate || !selectedStudentForApply || !user) return;
      setIsApplying(true);
      try {
          // Filtrar sessões válidas (que têm exercícios)
          const validSessions = applyingTemplate.data.sessions.filter((s: any) => s.exercises && s.exercises.length > 0);
          
          if (validSessions.length === 0) {
              alert("O plano não possui nenhum treino com exercícios.");
              setIsApplying(false);
              return;
          }

          await supabase.from('workouts').delete().eq('assigned_student_id', selectedStudentForApply.id).eq('completed', false);
          await supabase.from('workouts').update({ day_label: 'ARCHIVED_' + Date.now() }).eq('assigned_student_id', selectedStudentForApply.id).eq('completed', true);
          
          let maxDayIndex = 0;

          for (const session of validSessions) {
              const dayIndex = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].indexOf(session.day_label) + 1;
              if (dayIndex > maxDayIndex) maxDayIndex = dayIndex;

              const workoutId = crypto.randomUUID();
              await supabase.from('workouts').insert({
                  id: workoutId,
                  title: session.title,
                  description: applyingTemplate.name,
                  trainer_id: user.id,
                  assigned_student_id: selectedStudentForApply.id,
                  day_label: session.day_label,
                  created_at: new Date().toISOString()
              });
              
              await insertExercisesForWorkout(session.exercises, workoutId);
          }
          
          // Atualiza a frequência de treino para o maximo do index (ex: se tem só dia C, o index é 3)
          await supabase.from('profiles').update({ training_frequency: Math.max(maxDayIndex, validSessions.length) }).eq('id', selectedStudentForApply.id);
            
          alert(`Plano '${applyingTemplate.name}' aplicado ao aluno ${selectedStudentForApply.name}!`);
          closeApplyModal();
      } catch (e: any) {
          console.error(e);
          alert("Erro ao aplicar plano: " + e.message);
      } finally {
          setIsApplying(false);
      }
  };

  const handleApplySingleDay = async () => {
      if (!applyingTemplate || !selectedStudentForApply || !selectedTemplateSession || !selectedTargetDayLabel || !user) return;
      setIsApplying(true);
      try {
          let workout = studentCurrentWorkouts.find(w => w.day_label === selectedTargetDayLabel);
          let workoutId = workout?.id;
          
          if (workoutId) {
              await supabase.from('workout_exercises').delete().eq('workout_id', workoutId);
              await supabase.from('workouts').update({ title: selectedTemplateSession.title }).eq('id', workoutId);
          } else {
              workoutId = crypto.randomUUID();
              await supabase.from('workouts').insert({
                  id: workoutId,
                  title: selectedTemplateSession.title,
                  description: 'Plano Personalizado',
                  trainer_id: user.id,
                  assigned_student_id: selectedStudentForApply.id,
                  day_label: selectedTargetDayLabel,
                  created_at: new Date().toISOString()
              });
          }
          
          if (selectedTemplateSession.exercises && selectedTemplateSession.exercises.length > 0) {
              await insertExercisesForWorkout(selectedTemplateSession.exercises, workoutId);
          }
          
          alert(`Treino substituído no Dia ${selectedTargetDayLabel}!`);
          closeApplyModal();
      } catch (e: any) {
           console.error(e);
          alert("Erro ao aplicar dia: " + e.message);
      } finally {
          setIsApplying(false);
      }
  };

  const closeApplyModal = () => {
      setApplyingTemplate(null);
      setApplyStep('SELECT_STUDENT');
      setSelectedStudentForApply(null);
      setStudentCurrentWorkouts([]);
      setSelectedTemplateSession(null);
      setApplyStudentSearch('');
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const isDesktopAdmin = window.location.pathname.includes('/ptadmin');

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden pb-20">
      {/* Header */}
      <div className={`px-6 pb-6 bg-background/95 backdrop-blur-md border-b border-main/5 sticky top-0 z-20 ${isDesktopAdmin ? 'pt-8' : 'pt-12'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isDesktopAdmin && (
              <button 
                onClick={onBack}
                className="w-10 h-10 rounded-full bg-main/5 flex items-center justify-center hover:bg-main/10 transition-colors"
              >
                <span className="material-symbols-outlined text-main">arrow_back</span>
              </button>
            )}
            <div>
              <h1 className={`${isDesktopAdmin ? 'text-4xl font-black' : 'text-2xl font-black'} text-main tracking-tight uppercase italic`}>BANCO DE TREINOS</h1>
              <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em] leading-none mt-1.5 opacity-70">Gere e aplique o seu arsenal de treinos</p>
            </div>
          </div>
          <button 
            onClick={() => setIsCreatingTemplate(true)}
            className={`${isDesktopAdmin ? 'px-5 py-2.5 rounded-2xl gap-2 font-bold text-sm' : 'w-10 h-10 rounded-full'} bg-primary flex items-center justify-center text-background shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all`}
          >
            <span className="material-symbols-outlined text-lg">add</span>
            {isDesktopAdmin && 'Nova Base'}
          </button>
        </div>

        {/* Search Bar */}
        <div className={`bg-surface/50 rounded-2xl flex items-center pr-2 border-2 border-main/5 focus-within:border-primary/50 transition-colors shadow-inner overflow-hidden ${isDesktopAdmin ? 'h-14' : 'h-12'}`}>
          <span className="material-symbols-outlined text-muted ml-5 mr-3">search</span>
          <input 
            type="text" 
            placeholder="Pesquisar treinos..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-main w-full py-4 outline-none placeholder:text-zinc-500 text-sm font-bold"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {isLoading ? (
          <div className={`flex flex-col items-center justify-center py-20 gap-4 opacity-50 ${isDesktopAdmin ? 'mt-10' : ''}`}>
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-sm font-bold uppercase tracking-widest text-muted">A carregar biblioteca...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-20 px-6 text-center opacity-40 ${isDesktopAdmin ? 'mt-10' : ''}`}>
            <div className="w-24 h-24 bg-main/5 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-5xl">inventory_2</span>
            </div>
            <h3 className="text-xl font-black text-main uppercase italic mb-2">Sem treinos ainda</h3>
            <p className="text-sm font-medium text-muted max-w-xs mx-auto">
              Guarde os seus melhores treinos como base para aplicar a novos alunos em segundos.
            </p>
          </div>
        ) : (
          <div className={isDesktopAdmin ? "flex flex-col gap-4 max-w-6xl mx-auto" : "grid grid-cols-1 gap-4"}>
            {filteredTemplates.map((template) => (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedTemplateForView(template)}
                className={`group relative bg-surface/40 backdrop-blur-xl border border-main/10 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.1)] hover:border-primary/20 transition-all duration-500 cursor-pointer flex ${isDesktopAdmin ? 'flex-row items-center rounded-3xl p-6' : 'flex-col rounded-2xl p-4'}`}
              >
                {/* Desktop Layout: Horizontal Bento Style */}
                <div className={`flex items-center min-w-0 ${isDesktopAdmin ? 'flex-1 gap-8' : 'flex-col items-start gap-4 mb-6 relative'}`}>
                   {/* Days Badge - Large on Desktop */}
                   <div className={`${isDesktopAdmin ? 'w-24 h-24 rounded-2xl' : 'w-12 h-12 rounded-xl'} bg-main/5 border border-main/10 flex flex-col items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors duration-500`}>
                      <span className={`${isDesktopAdmin ? 'text-3xl' : 'text-xl'} font-black text-main group-hover:text-primary transition-colors`}>{template.split_count}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted">Dias</span>
                   </div>

                   {/* Template Info */}
                   <div className={`flex-1 min-w-0 ${isDesktopAdmin ? 'grid grid-cols-12 gap-8 items-center' : 'w-full'}`}>
                      <div className="col-span-5">
                         <h4 className={`font-black text-main truncate leading-tight tracking-tight uppercase italic ${isDesktopAdmin ? 'text-2xl' : 'text-base'}`}>{template.name}</h4>
                         <div className="flex items-center gap-2 mt-2">
                           <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                             <span className="text-[10px] font-black uppercase tracking-widest text-primary font-mono">
                               {template.split_count}D
                             </span>
                           </div>
                           <div className="bg-main/5 px-3 py-1 rounded-full border border-main/5 font-mono">
                             <span className="text-[9px] font-black uppercase tracking-widest text-muted">
                               {template.category?.toUpperCase() || 'GERAL'}
                             </span>
                           </div>
                         </div>
                      </div>

                      {isDesktopAdmin && (
                        <div className="col-span-7 px-8 border-l border-main/10">
                           <p className="text-xs text-muted font-bold uppercase tracking-wider line-clamp-2 leading-relaxed opacity-60 font-mono">
                             {template.description || "DADOS_DO_PLANO: SEM_DESCRIÇÃO_DISPONÍVEL"}
                           </p>
                        </div>
                      )}
                   </div>
                </div>

                {/* Actions - Static on Desktop, Hidden on Mobile until Hover */}
                <div className={`flex items-center gap-3 ${isDesktopAdmin ? 'pl-8 ml-auto border-l border-main/10' : 'pt-6 mt-4 border-t border-main/5'}`}>
                   <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditingTemplateId(template.id);
                        setScreen(Screen.TRAINER_EDIT_TEMPLATE);
                    }}
                    className={`${isDesktopAdmin ? 'h-14 px-8 rounded-2xl text-sm' : 'flex-1 h-12 rounded-xl text-xs'} bg-main text-background font-black uppercase tracking-widest hover:bg-primary transition-all duration-300 flex items-center justify-center gap-3 group/edit active:scale-95 shadow-lg shadow-black/10`}
                   >
                     <span className="material-symbols-outlined text-[24px] group-hover/edit:rotate-12 transition-transform">edit_note</span>
                     Editar
                   </button>

                   <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setApplyingTemplate(template);
                        setApplyStep('SELECT_STUDENT');
                    }}
                    className={`${isDesktopAdmin ? 'h-14 w-14 rounded-2xl' : 'h-12 w-12 rounded-xl'} bg-primary/10 text-primary hover:bg-primary hover:text-background transition-all duration-300 flex items-center justify-center shrink-0 shadow-inner group/apply`}
                    title="Aplicar a Aluno"
                   >
                     <span className="material-symbols-outlined text-[24px] group-hover/apply:scale-110 transition-transform">person_add</span>
                   </button>

                   {isDesktopAdmin && (
                     <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsRenamingTemplate(template);
                            setNewName(template.name);
                            setNewDesc(template.description || '');
                          }}
                          className="w-10 h-10 text-muted hover:text-main transition-colors flex items-center justify-center"
                          title="Renomear"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsDeletingId(template.id);
                          }}
                          className="w-10 h-10 text-muted hover:text-red-500 transition-colors flex items-center justify-center"
                          title="Apagar"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                     </div>
                   )}
                </div>

                {!isDesktopAdmin && template.description && (
                  <p className="text-xs text-muted font-medium line-clamp-2 mt-4 px-1 italic">
                    {template.description}
                  </p>
                )}

                
                {/* Delete Confirmation Overlay */}
                <AnimatePresence>
                  {isDeletingId === template.id && (
                    <motion.div 
                      onClick={(e) => e.stopPropagation()}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-surface/95 backdrop-blur-sm rounded-[2rem] p-6 flex flex-col items-center justify-center z-10"
                    >
                      <p className="text-sm font-black text-main uppercase italic mb-4">Confirmar eliminação?</p>
                      <div className="flex gap-3 w-full">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsDeletingId(null);
                          }}
                          className="flex-1 h-10 bg-main/5 rounded-xl text-[10px] font-black text-main uppercase"
                        >
                          Não
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTemplate(template.id);
                          }}
                          className="flex-1 h-10 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-red-500/20"
                        >
                          Sim, Apagar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      {/* Apply Template Modal */}
      <AnimatePresence>
        {applyingTemplate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-surface rounded-3xl p-6 w-full max-w-sm sm:max-w-md border border-main/10 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-4">
                  <div>
                      <h3 className="text-xl font-black text-main uppercase italic">Aplicar Plano</h3>
                      <p className="text-xs text-muted font-bold">{applyingTemplate.name}</p>
                  </div>
                  <button onClick={closeApplyModal} className="text-muted hover:text-main p-1">
                      <span className="material-symbols-outlined">close</span>
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                  {applyStep === 'SELECT_STUDENT' && (
                      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Escolher Aluno</p>
                          
                          <div className="relative mb-4">
                              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">search</span>
                              <input 
                                  type="text" 
                                  placeholder="Pesquisar aluno..." 
                                  value={applyStudentSearch}
                                  onChange={(e) => setApplyStudentSearch(e.target.value)}
                                  className="w-full h-10 bg-main/5 rounded-xl pl-9 pr-4 text-main text-sm outline-none border border-transparent focus:border-primary/30 transition-all font-medium"
                              />
                          </div>
                          
                          {trainerStudents.length === 0 ? (
                              <p className="text-sm text-center text-muted font-medium py-10">Não tem alunos ativos.</p>
                          ) : trainerStudents.filter(s => s.name.toLowerCase().includes(applyStudentSearch.toLowerCase())).length === 0 ? (
                              <p className="text-sm text-center text-muted font-medium py-10">Nenhum aluno encontrado.</p>
                          ) : (
                              <div className="space-y-2">
                                  {trainerStudents
                                      .filter(s => s.name.toLowerCase().includes(applyStudentSearch.toLowerCase()))
                                      .map(student => (
                                      <button 
                                          key={student.id}
                                          onClick={() => handleSelectApplyStudent(student)}
                                          className="w-full bg-main/5 hover:bg-main/10 p-3 rounded-xl flex items-center gap-3 transition-colors text-left"
                                      >
                                          <div className="w-10 h-10 rounded-full bg-cover bg-center border-2 border-surface" style={{ backgroundImage: `url('${student.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}`}')` }}></div>
                                          <span className="font-bold text-main">{student.name}</span>
                                          <span className="material-symbols-outlined ml-auto text-muted text-sm">chevron_right</span>
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}

                  {applyStep === 'SELECT_MODE' && selectedStudentForApply && (
                      <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                          <button onClick={() => setApplyStep('SELECT_STUDENT')} className="text-[10px] font-bold text-primary uppercase flex items-center gap-1 hover:underline">
                              <span className="material-symbols-outlined text-[10px]">arrow_back</span> Voltar à lista de alunos
                          </button>
                          
                          <p className="text-sm font-medium text-main text-center">Como quer aplicar a base <span className="font-bold text-primary">{applyingTemplate.name}</span> ao aluno <span className="font-bold">{selectedStudentForApply.name}</span>?</p>
                          
                          <button 
                              onClick={handleApplyFullPlan}
                              disabled={isApplying}
                              className="w-full bg-primary/10 hover:bg-primary/20 border border-primary/20 p-5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group disabled:opacity-50"
                          >
                              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-background shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                                  <span className="material-symbols-outlined">library_add</span>
                              </div>
                              <div>
                                  <span className="font-black text-main uppercase block">Substituir Plano Inteiro</span>
                                  <span className="text-xs text-muted font-bold">Apaga os {studentCurrentWorkouts.length} treinos atuais do aluno criando a divisão completa ({applyingTemplate.split_count} dias).</span>
                              </div>
                          </button>

                          <div className="relative py-2 flex items-center justify-center">
                              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-main/10"></div></div>
                              <span className="relative bg-surface px-4 text-xs font-bold text-muted uppercase">OU</span>
                          </div>

                          <button 
                              onClick={() => setApplyStep('APPLY_DAY')}
                              className="w-full bg-main/5 hover:bg-main/10 border border-main/5 p-5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group"
                          >
                              <div className="w-12 h-12 rounded-full bg-main/10 flex items-center justify-center text-main group-hover:scale-110 transition-transform">
                                  <span className="material-symbols-outlined">content_paste</span>
                              </div>
                              <div>
                                  <span className="font-black text-main uppercase block">Substituir Apenas 1 Dia</span>
                                  <span className="text-xs text-muted font-bold">Ex: Pegar no plano de pernas desta base e substituir apenas o Dia C do aluno.</span>
                              </div>
                          </button>
                      </div>
                  )}

                  {applyStep === 'APPLY_DAY' && selectedStudentForApply && (
                      <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                          <button onClick={() => setApplyStep('SELECT_MODE')} className="text-[10px] font-bold text-primary uppercase flex items-center gap-1 hover:underline">
                              <span className="material-symbols-outlined text-[10px]">arrow_back</span> Voltar
                          </button>

                          <div className="space-y-4">
                              <div>
                                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">1. Que rotina quer colar?</label>
                                  <div className="relative">
                                      <select 
                                          className="w-full h-12 bg-main/5 rounded-xl px-4 text-main font-bold appearance-none outline-none border border-transparent focus:border-primary/50 cursor-pointer"
                                          value={selectedTemplateSession?.title || ''}
                                          onChange={(e) => {
                                              const sess = applyingTemplate.data.sessions.find((s: any) => s.title === e.target.value);
                                              setSelectedTemplateSession(sess || null);
                                          }}
                                      >
                                          <option value="" disabled>Escolha um treino da base...</option>
                                          {applyingTemplate.data.sessions.map((session: any, idx: number) => {
                                              const hasExercises = session.exercises && session.exercises.length > 0;
                                              return (
                                                  <option key={idx} value={session.title} disabled={!hasExercises}>
                                                      Dia {session.day_label} - {session.title || 'Sem título'} {!hasExercises ? '(Vazio)' : ''}
                                                  </option>
                                              );
                                          })}
                                      </select>
                                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted">expand_more</span>
                                  </div>
                              </div>

                              <div>
                                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">2. Em qual dia do aluno?</label>
                                  <div className="relative">
                                      <select 
                                          className="w-full h-12 bg-main/5 rounded-xl px-4 text-main font-bold appearance-none outline-none border border-transparent focus:border-primary/50 cursor-pointer"
                                          value={selectedTargetDayLabel}
                                          onChange={(e) => setSelectedTargetDayLabel(e.target.value)}
                                      >
                                          {studentCurrentWorkouts.map((w: any) => (
                                              <option key={w.id} value={w.day_label}>Dia {w.day_label} ({w.title || 'Sem título'})</option>
                                          ))}
                                          {/* Options for letters up to 7 in case we are adding a new day */}
                                          {['A','B','C','D','E','F','G'].filter(l => !studentCurrentWorkouts.some((w: any)=>w.day_label === l)).map(l => (
                                              <option key={l} value={l}>Adicionar novo: Dia {l}</option>
                                          ))}
                                      </select>
                                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted">expand_more</span>
                                  </div>
                              </div>
                              
                              <button 
                                  onClick={handleApplySingleDay}
                                  disabled={!selectedTemplateSession || isApplying}
                                  className="w-full h-14 bg-primary text-background font-black uppercase text-sm rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                              >
                                  {isApplying ? <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></span> : 'Substituir / Adicionar Dia'}
                              </button>
                          </div>
                      </div>
                  )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Template Modal */}
      <AnimatePresence>
        {isCreatingTemplate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-surface rounded-3xl p-6 w-full max-w-sm sm:max-w-md border border-main/10 shadow-2xl space-y-6"
            >
              <h3 className="text-xl font-black text-main uppercase italic">Criar Base de Treino</h3>
              
              <div className="space-y-4">
                  <div>
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">Nome da Base de Treino</label>
                      <input 
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="w-full h-12 bg-main/5 border border-main/10 rounded-xl px-4 text-main font-bold outline-none focus:border-primary/30 transition-all text-sm mb-2"
                        placeholder="Ex: Emagrecimento 3x"
                        autoFocus
                      />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">Dias de Treino (Split)</label>
                      <div className="flex gap-2">
                          {[2,3,4,5,6].map(num => (
                              <button
                                  key={num}
                                  onClick={() => setNewTemplateSplitCount(num)}
                                  className={`flex-1 h-10 rounded-lg font-bold text-xs transition-all border ${newTemplateSplitCount === num ? 'bg-primary border-primary text-background' : 'bg-main/5 border-main/10 text-muted'}`}
                              >
                                  {num}
                              </button>
                          ))}
                      </div>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">Categoria (Opcional)</label>
                      <input 
                        type="text"
                        value={newTemplateCategory}
                        onChange={(e) => setNewTemplateCategory(e.target.value)}
                        className="w-full h-12 bg-main/5 border border-main/10 rounded-xl px-4 text-main font-bold outline-none focus:border-primary/30 transition-all text-sm mb-4"
                        placeholder="Ex: Hipertrofia, Iniciante..."
                      />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">Descrição (Opcional)</label>
                      <textarea
                        value={newTemplateDescription}
                        onChange={(e) => setNewTemplateDescription(e.target.value)}
                        className="w-full h-24 bg-main/5 border border-main/10 rounded-xl px-4 py-3 text-main font-bold outline-none focus:border-primary/30 transition-all text-sm resize-none"
                        placeholder="Descreva esta base de treino..."
                      />
                  </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsCreatingTemplate(false)} className="flex-1 h-12 bg-main/5 rounded-xl font-bold text-main">Cancelar</button>
                <button 
                  onClick={createTemplate} 
                  disabled={isSaving || !newTemplateName.trim()}
                  className="flex-1 h-12 bg-primary rounded-xl font-bold text-background disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                  {isSaving ? 'A criar...' : 'Criar e Editar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {isRenamingTemplate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-surface rounded-3xl p-6 w-full max-w-sm sm:max-w-md border border-main/10 shadow-2xl"
            >
              <h3 className="text-xl font-black text-main uppercase italic mb-4">Atualizar Base</h3>
              <div className="space-y-4">
                  <p className="text-xs text-muted font-medium">Nome</p>
                  <input 
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full h-12 bg-main/5 border border-main/10 rounded-xl px-4 text-main font-bold outline-none focus:border-primary/30 transition-all text-sm"
                    placeholder="Ex: Novo Nome do Treino"
                    autoFocus
                  />
                  <p className="text-xs text-muted font-medium">Descrição</p>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full h-24 bg-main/5 border border-main/10 rounded-xl px-4 py-3 text-main font-bold outline-none focus:border-primary/30 transition-all text-sm resize-none"
                    placeholder="Descrição da base..."
                  />
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setIsRenamingTemplate(null)} className="flex-1 h-12 bg-main/5 rounded-xl font-bold text-main">Cancelar</button>
                    <button 
                      onClick={updateTemplate} 
                      disabled={isSaving || !newName.trim()}
                      className="flex-1 h-12 bg-primary rounded-xl font-bold text-background disabled:opacity-50 shadow-lg shadow-primary/20"
                    >
                      {isSaving ? 'A guardar...' : 'Confirmar'}
                    </button>
                  </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Template Details Modal */}
      <AnimatePresence>
        {selectedTemplateForView && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTemplateForView(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-surface rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
            >
              <div className="p-6 border-b border-main/5 flex justify-between items-center bg-surface sticky top-0 z-10">
                <div>
                   <h3 className="text-xl font-black text-main uppercase italic">{selectedTemplateForView.name}</h3>
                   <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{selectedTemplateForView.split_count} Dias • {selectedTemplateForView.category || 'Geral'}</p>
                </div>
                <button 
                  onClick={() => setSelectedTemplateForView(null)}
                  className="w-10 h-10 rounded-full bg-main/5 flex items-center justify-center text-muted hover:text-main transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {selectedTemplateForView.data.sessions.map((session, sIdx) => (
                  <div key={sIdx} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-background font-black italic">
                        {session.day_label}
                      </div>
                      <h4 className="font-black text-main uppercase italic">{session.title}</h4>
                    </div>

                    <div className="space-y-3 pl-4 border-l-2 border-main/5 ml-4">
                      {session.exercises.map((ex, eIdx) => (
                        <div key={eIdx} className="bg-main/5 rounded-2xl p-4">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-2">
                               <p className="font-bold text-main text-sm uppercase">{ex.name}</p>
                               {ex.isSuperset && (
                                 <span className="bg-orange-500/10 text-orange-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Bi-Série</span>
                               )}
                             </div>
                             <p className="text-[10px] font-black text-primary uppercase">{ex.sets.length} Séries</p>
                          </div>
                          
                          {ex.notes && (
                            <p className="text-[10px] text-muted font-medium mb-3 italic">"{ex.notes}"</p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {ex.sets.map((set, setIdx) => (
                              <div key={setIdx} className="px-2 py-1 bg-surface border border-main/5 rounded-lg text-[10px] font-black text-muted uppercase">
                                {ex.type === 'CARDIO' ? `${set.time} / I${set.intensity}` : `${set.reps}x / ${set.weight}kg`}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-surface border-t border-main/5">
                <button 
                  onClick={() => setSelectedTemplateForView(null)}
                  className="w-full h-12 bg-main text-background font-black uppercase rounded-2xl shadow-lg shadow-main/20 active:scale-95 transition-all"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

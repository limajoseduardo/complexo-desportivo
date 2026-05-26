import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { User } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  student: User;
  onBack: () => void;
  onUpdate: () => void;
  onDelete?: () => void;
}

const GOAL_OPTIONS = ['Hipertrofia', 'Emagrecimento', 'Força', 'Resistência', 'Manutenção', 'Saúde'];

export default function TrainerEditStudentView({ student, onBack, onUpdate, onDelete }: Props) {
  const { user, selectStudentForProgress } = useApp();
  const [formData, setFormData] = useState({
    goal: student.goal || '',
    trainingFrequency: student.trainingFrequency?.toString() || '3',
    restDays: student.restDays || [],
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Deletion State
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [removePassword, setRemovePassword] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      goal: student.goal || '',
      trainingFrequency: (student.trainingFrequency || 3).toString(),
      restDays: student.restDays || [],
    });
  }, [student]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: any = {
        goal: formData.goal,
        training_frequency: parseInt(formData.trainingFrequency) || 0,
        rest_days: formData.restDays,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', student.id);

      if (error) throw error;
      onUpdate();
      onBack();
    } catch (e) {
      console.error("Erro ao salvar:", e);
      alert("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRestDay = (day: number) => {
    setFormData(prev => {
      const restDays = prev.restDays.includes(day)
        ? prev.restDays.filter(d => d !== day)
        : [...prev.restDays, day];
      return { ...prev, restDays };
    });
  };

  const confirmRemoval = async () => {
    if (!student.id || !user?.email) return;
    
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

        // 2. Delete all related data manually
        const deleteOps = [
            // Workouts
            async () => {
                const { data: workouts } = await supabase.from('workouts').select('id').eq('assigned_student_id', student.id);
                if (workouts && workouts.length > 0) {
                    const workoutIds = workouts.map(w => w.id);
                    const { data: exercises } = await supabase.from('workout_exercises').select('id').in('workout_id', workoutIds);
                    if (exercises && exercises.length > 0) {
                        const exerciseIds = exercises.map(e => e.id);
                        await supabase.from('workout_sets').delete().in('exercise_id', exerciseIds);
                    }
                    await supabase.from('workout_exercises').delete().in('workout_id', workoutIds);
                    await supabase.from('workouts').delete().eq('assigned_student_id', student.id);
                }
            },
            // Diets
            async () => {
                const { data: meals } = await supabase.from('diet_meals').select('id').eq('student_id', student.id);
                if (meals && meals.length > 0) {
                    const mealIds = meals.map(m => m.id);
                    await supabase.from('diet_items').delete().in('meal_id', mealIds);
                    await supabase.from('diet_meals').delete().eq('student_id', student.id);
                }
            },
            // Messages & Chats
            async () => {
                 await supabase.from('messages').delete().or(`sender_id.eq.${student.id},receiver_id.eq.${student.id}`);
                 await supabase.from('chats').delete().or(`participant1_id.eq.${student.id},participant2_id.eq.${student.id}`);
            },
            // Metrics and Reports
            async () => await supabase.from('weight_history').delete().eq('user_id', student.id),
            async () => await supabase.from('progress_photos').delete().eq('user_id', student.id),
            async () => await supabase.from('student_reports').delete().eq('student_id', student.id),
            async () => await supabase.from('student_cardio_notes').delete().eq('student_id', student.id),
            
            // Notifications and Access
            async () => await supabase.from('read_notifications').delete().eq('user_id', student.id),
            async () => await supabase.from('notifications').delete().eq('user_id', student.id),
            async () => await supabase.from('invite_codes').delete().eq('student_id', student.id),
        ];

        for (const op of deleteOps) {
            try {
                await op();
            } catch (e) {
                console.warn("Sub-deletion failed, continuing...", e);
            }
        }

        // 3. Delete profile
        const { error: profileError } = await supabase.from('profiles').delete().eq('id', student.id);
        if (profileError) throw profileError;
        
        onUpdate();
        if (onDelete) {
            onDelete();
        } else {
            onBack();
        }
    } catch (e) {
        console.error("Erro ao remover", e);
        setRemoveError("Erro ao remover aluno. Tente novamente.");
    } finally {
        setIsRemoving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111827] rounded-3xl h-full overflow-hidden border border-black/5 dark:border-white/5 flex flex-col pt-4">
      <div className="px-6 pb-2 border-b border-black/5 dark:border-white/5 flex items-center gap-4">
         <button onClick={onBack} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">arrow_back</span></button>
         <h2 className="font-bold">Editar Perfil de {student.name}</h2>
      </div>
      <div className="p-6 space-y-4 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted">Objetivo</label>
            <select 
              value={formData.goal}
              onChange={e => setFormData({...formData, goal: e.target.value})}
              className="w-full bg-surface rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-colors"
            >
              {GOAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted">Treinos/Semana</label>
            <input 
              type="number" 
              value={formData.trainingFrequency}
              onChange={e => setFormData({...formData, trainingFrequency: e.target.value})}
              className="w-full bg-surface rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-2">
           <label className="text-sm font-bold text-muted">Dias de Descanso</label>
           <div className="flex gap-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                <button 
                  key={day}
                  onClick={() => toggleRestDay(index)}
                  className={`flex-1 p-3 rounded-lg text-xs font-bold border transition-colors ${formData.restDays.includes(index) ? 'bg-primary text-white border-primary' : 'bg-surface border-main/5'}`}
                >
                  {day}
                </button>
              ))}
           </div>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={isSaving || isRemoving}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl mt-4 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
          {isSaving ? 'A guardar...' : 'Guardar Alterações'}
        </button>

        <div className="pt-6 mt-6 border-t border-main/5">
          <p className="text-xs text-muted mb-4 font-medium italic">Zona de Perigo: Esta ação não pode ser desfeita.</p>
          <button 
            onClick={() => setShowConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold py-4 rounded-xl transition-all"
          >
            <Trash2 size={18} />
            Remover Aluno Totalmente
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showConfirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] w-full max-w-md rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative"
            >
              <button 
                onClick={() => {
                  setShowConfirmDelete(false);
                  setRemovePassword('');
                  setRemoveError(null);
                }}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                disabled={isRemoving}
              >
                <X size={20} />
              </button>

              <div className="text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-red-500">
                  <AlertTriangle size={40} />
                </div>
                
                <h2 className="text-2xl font-bold mb-4">Remover Aluno?</h2>
                <div className="bg-red-500/5 rounded-2xl p-4 mb-6 text-left">
                  <p className="text-sm text-red-500/90 leading-relaxed font-medium">
                    Tens a certeza que desejas remover o aluno <span className="font-bold">{student.name}</span>? 
                    Esta ação <span className="underline">apagará permanentemente</span> todos os treinos, dietas, chats e histórico de progresso.
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="text-left">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Confirmar Palavra-passe</label>
                    <input 
                      type="password"
                      value={removePassword}
                      onChange={(e) => setRemovePassword(e.target.value)}
                      placeholder="Introduza a sua password"
                      className="w-full bg-[#141414]/5 dark:bg-white/5 border border-main/10 rounded-2xl px-5 py-4 outline-none focus:ring-2 ring-red-500/50 transition-all font-medium"
                    />
                    {removeError && (
                      <p className="text-red-500 text-xs mt-2 font-bold flex items-center gap-1">
                        <AlertTriangle size={12} /> {removeError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setShowConfirmDelete(false);
                      setRemovePassword('');
                      setRemoveError(null);
                    }}
                    className="flex-1 py-4 rounded-2xl font-bold text-muted hover:bg-black/5 dark:hover:bg-white/10 transition-all"
                    disabled={isRemoving}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmRemoval}
                    disabled={isRemoving || !removePassword}
                    className="flex-[2] bg-red-500 text-white py-4 rounded-2xl font-bold shadow-xl shadow-red-500/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isRemoving ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Trash2 size={18} />
                        Remover Agora
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

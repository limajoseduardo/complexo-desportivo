
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ChevronRight, 
  MoreVertical,
  Activity,
  Dumbbell,
  Scale,
  Calendar,
  MessageSquare,
  AlertTriangle,
  UserPlus,
  Ruler
} from 'lucide-react';
import { useApp } from '../../../contexts/AppContext';
import { Screen, User } from '../../../types';
import { supabase } from '../../../lib/supabaseClient';
import { motion, AnimatePresence } from 'motion/react';

let cachedStudents: any[] | null = null;

export default function DesktopStudentListView() {
  const { setScreen, user, selectStudentForProgress, generateAccessCode, clearViewingStudent } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('Todos os Objetivos');
  const [sortBy, setSortBy] = useState('Mais Recentes');
  const [students, setStudents] = useState<any[]>(cachedStudents || []);
  const [isLoading, setIsLoading] = useState(!cachedStudents);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, [user?.id]);

  const fetchStudents = async () => {
    if (!user) return;
    if (!cachedStudents) {
      setIsLoading(true);
    }
    try {
      // 1. Fetch profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .or(`role.eq.STUDENT,id.eq.${user.id}`)
        .order('name');
      
      if (profiles) {
        // 2. Fetch last activities for all students to show alerts
        const enrichedStudents = await Promise.all(profiles.map(async (student) => {
          // Last workout
          const { data: lastWorkout } = await supabase
            .from('workouts')
            .select('completed_at')
            .eq('assigned_student_id', student.id)
            .eq('completed', true)
            .order('completed_at', { ascending: false })
            .limit(1)
            .single();

          // Last weight entries
          const { data: weightLogs } = await supabase
            .from('weight_history')
            .select('*')
            .eq('user_id', student.id)
            .order('date', { ascending: false })
            .limit(3);
          
          return {
            ...student,
            last_workout_at: lastWorkout?.completed_at || null,
            weight_history: weightLogs || []
          };
        }));
        
        cachedStudents = enrichedStudents;
        setStudents(enrichedStudents);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueGoals = useMemo(() => {
    const goals = new Set<string>();
    students.forEach(s => {
      if (s.goal) goals.add(s.goal);
    });
    return Array.from(goals).sort();
  }, [students]);

  const filteredStudents = students
    .filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGoal = selectedGoal === 'Todos os Objetivos' || s.goal === selectedGoal;
      return matchesSearch && matchesGoal;
    })
    .sort((a, b) => {
      if (sortBy === 'Nome (A-Z)') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'Mais Recentes') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'Inativos') {
        // Sort by last activity (workout or last seen)
        const activityA = a.last_workout_at ? new Date(a.last_workout_at).getTime() : 0;
        const activityB = b.last_workout_at ? new Date(b.last_workout_at).getTime() : 0;
        return activityA - activityB;
      }
      return 0;
    });

  const handleSelectStudent = (student: any) => {
    selectStudentForProgress(student.id, student.name, student.avatar);
    // On desktop, we handle sub-navigation differently via the dashboard state
    // But since we are re-using the context, it will set context state
  };

  const handleGenerateCode = async () => {
    const code = await generateAccessCode();
    setGeneratedCode(code);
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

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Alunos</h1>
          <p className="text-muted text-sm mt-1">Tens {students.length} alunos sob a tua supervisão.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleGenerateCode}
            className="bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <UserPlus size={18} />
            Convidar Aluno
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111827] rounded-3xl p-4 border border-black/5 dark:border-white/5 shadow-sm flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
          <input 
            type="text" 
            placeholder="Procurar por nome ou objetivo..." 
            className="w-full bg-[#141414]/5 dark:bg-white/5 border-none rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 ring-primary/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
            className="bg-[#141414]/5 dark:bg-white/5 border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none cursor-pointer hover:bg-[#141414]/10 dark:hover:bg-white/10 transition-colors"
          >
            <option>Todos os Objetivos</option>
            {uniqueGoals.map(goal => (
              <option key={goal} value={goal}>{goal}</option>
            ))}
          </select>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#141414]/5 dark:bg-white/5 border-none rounded-2xl px-4 py-3 text-sm font-semibold outline-none cursor-pointer hover:bg-[#141414]/10 dark:hover:bg-white/10 transition-colors"
          >
            <option>Mais Recentes</option>
            <option>Nome (A-Z)</option>
            <option>Inativos</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {isLoading ? (
             Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-[220px] bg-white dark:bg-[#111827] rounded-3xl animate-pulse border border-black/5 dark:border-white/5" />
             ))
          ) : filteredStudents.map((student, i) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleSelectStudent(student)}
              className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-black/5 dark:border-white/5 shadow-sm hover:shadow-2xl hover:border-primary/20 transition-all cursor-pointer group relative"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                   <div className="relative">
                      <img src={student.avatar} className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white dark:border-[#1F2937]" alt="" />
                      <div className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-4 border-white dark:border-[#111827] shadow-sm ${isOnline(student.last_seen) ? 'bg-green-500' : 'bg-gray-400'}`} />
                   </div>
                   <div>
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{student.name}</h3>
                      <span className="text-xs font-mono uppercase tracking-widest text-muted">{student.goal || 'Sem objetivo'}</span>
                   </div>
                </div>
                <button className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-muted">
                  <MoreVertical size={20} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                 <div className="bg-[#F1F5FF] dark:bg-white/5 p-3 rounded-2xl">
                    <p className="text-[10px] text-muted font-bold uppercase mb-1">Peso</p>
                    <div className="flex items-center gap-1.5">
                       <Scale size={14} className="text-primary" />
                       <span className="font-bold text-sm">{student.weight || '--'}kg</span>
                    </div>
                 </div>
                 <div className="bg-[#F1F5FF] dark:bg-white/5 p-3 rounded-2xl">
                    <p className="text-[10px] text-muted font-bold uppercase mb-1">Altura</p>
                    <div className="flex items-center gap-1.5">
                       <Ruler size={14} className="text-primary" />
                       <span className="font-bold text-sm">{student.height || '--'}cm</span>
                    </div>
                 </div>
                 <div className="bg-[#F1F5FF] dark:bg-white/5 p-3 rounded-2xl">
                    <p className="text-[10px] text-muted font-bold uppercase mb-1">Treinos</p>
                    <div className="flex items-center gap-1.5">
                       <Dumbbell size={14} className="text-primary" />
                       <span className="font-bold text-sm">{student.training_frequency || '0'}/sem</span>
                    </div>
                 </div>
              </div>

                  <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                 <div className="flex items-center gap-2 text-xs text-muted">
                    <Calendar size={14} />
                    <span>{formatEnrollment(student.created_at)}</span>
                 </div>
                 <div className="flex gap-2">
                    <button className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all">
                       <MessageSquare size={16} />
                    </button>
                    {(() => {
                      const workoutAlert = student.last_workout_at ? (new Date().getTime() - new Date(student.last_workout_at).getTime()) > 7 * 24 * 60 * 60 * 1000 : true;
                      const weightAlert = student.weight_history?.length > 0 
                        ? (new Date().getTime() - new Date(student.weight_history[0].date).getTime()) > 10 * 24 * 60 * 60 * 1000 
                        : true;
                      
                      const stagnation = student.weight_history?.length >= 3 && Math.abs(student.weight_history[0].weight - student.weight_history[2].weight) < 0.2;

                      if (workoutAlert || weightAlert || stagnation) {
                        let label = 'Alerta';
                        if (stagnation) label = 'Estagnado: Peso não varia';
                        else if (weightAlert) label = 'Falta registo de peso';
                        else if (workoutAlert) label = 'Falta treinar (+7 dias)';

                        return (
                          <button className="p-2 bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all group/alert relative">
                             <AlertTriangle size={16} />
                             <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-amber-600 text-white text-[10px] rounded-lg opacity-0 group-hover/alert:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl z-20">
                                {label}
                             </div>
                          </button>
                        );
                      }
                      return null;
                    })()}
                 </div>
              </div>

              <div className="absolute top-0 right-0 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-3xl">VER PERFIL</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {generatedCode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#111827] w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl relative"
           >
              <div className="text-center">
                 <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserPlus size={32} className="text-primary" />
                 </div>
                 <h2 className="text-2xl font-bold mb-2">Novo Aluno</h2>
                 <p className="text-muted text-sm mb-8">Envia este código ao teu novo aluno para ele se registar na plataforma.</p>
                 
                 <div className="bg-[#141414]/5 dark:bg-white/5 border-2 border-dashed border-primary/30 rounded-2xl p-6 mb-8">
                    <span className="text-4xl font-mono font-bold tracking-[0.2em] text-primary">{generatedCode}</span>
                 </div>

                 <button 
                  onClick={() => setGeneratedCode(null)}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                 >
                   Concluído
                 </button>
              </div>
           </motion.div>
        </div>
      )}
    </div>
  );
}

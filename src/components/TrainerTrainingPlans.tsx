import React, { useState, useEffect } from 'react';
import { Dumbbell, Plus, Search, BookOpen, X, Edit, Trash2, Check, Copy, ChevronDown } from 'lucide-react';
import { motion } from "framer-motion";
import { Edit2, Play, Users, Save, Eye, MoreVertical } from "lucide-react";
import { db } from '../lib/firebase';
import { APP_ID } from '../App';
import { collection, onSnapshot, query, doc, addDoc, updateDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { UserProfile, Exercise, WorkoutTemplate, WorkoutSession, WorkoutSet } from '../types';
import { AdvancedTemplateEditor } from "./AdvancedTemplateEditor";

export function TrainerTrainingModule({ user }: { user: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'exercicios' | 'templates'>('exercicios');

  return (
    <div className="space-y-6 animate-in fade-in pb-24 text-left font-sans">
      <div className="bg-white rounded-[2.5rem] p-4 flex gap-2 border-4 border-[#004D71]/5 sticky top-0 z-10">
        <button
          onClick={() => setActiveTab('exercicios')}
          className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'exercicios' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Dumbbell size={18}/> Banco Exercícios
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'templates' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <BookOpen size={18}/> Modelos (Templates)
        </button>
      </div>

      {activeTab === 'exercicios' && <ExerciseBankTab />}
      {activeTab === 'templates' && <WorkoutTemplatesTab user={user} />}
    </div>
  );
}

// ==========================================
// BANCO DE EXERCÍCIOS TAB
// ==========================================

const MUSCLE_GROUPS = [
  { key: 'PEITO',      label: 'Peito',      color: '#3B82F6', muscles: ['Peito', 'Peito Superior', 'Peitoral'] },
  { key: 'COSTAS',     label: 'Costas',     color: '#6366F1', muscles: ['Costas', 'Costas Inferior', 'Latíssimo do Dorso', 'Grande Dorsal'] },
  { key: 'PERNAS',     label: 'Pernas',     color: '#F59E0B', muscles: ['Quadríceps', 'Isquiotibiais', 'Gémeos (Panturrilha)', 'Panturrilha', 'Femoral'] },
  { key: 'OMBROS',     label: 'Ombros',     color: '#8B5CF6', muscles: ['Deltoides', 'Deltoides Medial', 'Deltoides Anterior', 'Deltoides Posterior'] },
  { key: 'BICEPS',     label: 'Bíceps',     color: '#10B981', muscles: ['Bíceps', 'Braquial'] },
  { key: 'TRICEPS',    label: 'Tríceps',    color: '#14B8A6', muscles: ['Tríceps'] },
  { key: 'ABDOMINAIS', label: 'Abdominais', color: '#EF4444', muscles: ['Core (Abdómen)', 'Core', 'Reto Abdominal', 'Abdómen Inferior', 'Oblíquos'] },
  { key: 'GLUTEOS',    label: 'Glúteos',    color: '#F97316', muscles: ['Glúteos', 'Glúteo Médio'] },
  { key: 'CARDIO',     label: 'Cardio',     color: '#EC4899', muscles: ['Sistema Cardiovascular'] },
  { key: 'FUNCIONAL',  label: 'Funcional',  color: '#64748B', muscles: ['Corpo Inteiro', 'Funcional'] },
];

const getMuscleGroup = (muscle: string): string => {
  if (!muscle) return 'FUNCIONAL';
  const lower = muscle.toLowerCase();
  for (const g of MUSCLE_GROUPS) {
    if (g.muscles.some(m => m.toLowerCase() === lower || lower.includes(m.toLowerCase()) || m.toLowerCase().includes(lower))) {
      return g.key;
    }
  }
  return 'FUNCIONAL';
};

const emptyExForm = {
  name: '', type: 'STRENGTH', primary_muscle: '', musculos_secundarios: '',
  equipamento: '', dificuldade: 'iniciante', descricao: '', instrucoes: '', video_url: ''
};

function ExerciseBankTab() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyExForm });

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/exercise_library`;
    const unsub = onSnapshot(collection(db, path), (snap) => {
      setExercises(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData({ ...emptyExForm });
    setShowModal(true);
  };

  const openEdit = (ex: any) => {
    setEditingId(ex.id);
    setFormData({
      name: ex.name || '',
      type: ex.type || 'STRENGTH',
      primary_muscle: ex.primary_muscle || '',
      musculos_secundarios: Array.isArray(ex.musculos_secundarios) ? ex.musculos_secundarios.join(', ') : (ex.musculos_secundarios || ''),
      equipamento: ex.equipamento || '',
      dificuldade: ex.dificuldade || 'iniciante',
      descricao: ex.descricao || '',
      instrucoes: ex.instrucoes || '',
      video_url: ex.video_url || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    const path = `artifacts/${APP_ID}/public/data/exercise_library`;
    const data = {
      ...formData,
      name: formData.name.trim(),
      musculos_secundarios: formData.musculos_secundarios.split(',').map((s: string) => s.trim()).filter(Boolean)
    };
    if (editingId) {
      await updateDoc(doc(db, path, editingId), data);
    } else {
      await addDoc(collection(db, path), data);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Remover exercício?")) {
      await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/exercise_library`, id));
    }
  };

  const filtered = search
    ? exercises.filter(e =>
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.primary_muscle?.toLowerCase().includes(search.toLowerCase()) ||
        e.equipamento?.toLowerCase().includes(search.toLowerCase())
      )
    : exercises;

  const grouped = MUSCLE_GROUPS.map(g => ({
    ...g,
    exercises: filtered.filter(e => getMuscleGroup(e.primary_muscle) === g.key)
  })).filter(g => g.exercises.length > 0);

  const getYouTubeId = (url: string) => {
    const m = url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const getDiffClass = (v: string) => {
    if (formData.dificuldade !== v) return 'border-slate-100 bg-white text-slate-400';
    if (v === 'iniciante') return 'border-emerald-500 bg-emerald-500 text-white';
    if (v === 'intermédio') return 'border-amber-500 bg-amber-500 text-white';
    return 'border-red-500 bg-red-500 text-white';
  };

  const ytId = getYouTubeId(formData.video_url);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Banco de Exercícios</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{exercises.length} exercícios · por grupo muscular</p>
        </div>
        <button onClick={openAdd} className="bg-[#004D71] text-[#F7B500] p-3 rounded-2xl shadow-lg active:scale-95 transition-all">
          <Plus size={20}/>
        </button>
      </div>

      <div className="bg-white rounded-3xl p-2 border-4 border-[#004D71]/5 flex items-center pr-4 shadow-sm focus-within:border-[#F7B500]/50 transition-colors">
        <div className="w-12 h-12 flex items-center justify-center text-slate-300"><Search size={20}/></div>
        <input
          type="text"
          placeholder="Procurar exercício ou músculo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none font-black text-[#004D71] uppercase text-xs placeholder:text-slate-300"
        />
        {search && <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500"><X size={16}/></button>}
      </div>

      <div className="space-y-2">
        {grouped.map(group => (
          <div key={group.key} className="bg-white rounded-[2rem] border-4 border-[#004D71]/5 overflow-hidden">
            <button
              onClick={() => setOpenGroup(prev => prev === group.key ? null : group.key)}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: group.color + '20' }}>
                  <span className="font-black text-base" style={{ color: group.color }}>{group.label[0]}</span>
                </div>
                <div className="text-left">
                  <h3 className="font-black text-[#004D71] uppercase text-sm">{group.label}</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{group.exercises.length} exercício{group.exercises.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <ChevronDown size={18} className={`text-slate-300 transition-transform duration-200 shrink-0 ${openGroup === group.key ? 'rotate-180' : ''}`}/>
            </button>

            {openGroup === group.key && (
              <div className="border-t-2 border-slate-50 divide-y-2 divide-slate-50">
                {group.exercises.map(ex => (
                  <div key={ex.id} className="flex items-center gap-3 px-5 py-3.5 group hover:bg-slate-50/50 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: group.color + '15' }}>
                      <Dumbbell size={13} style={{ color: group.color }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-[#004D71] uppercase text-xs leading-tight truncate">{ex.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {ex.dificuldade && (
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${ex.dificuldade === 'iniciante' ? 'bg-emerald-50 text-emerald-600' : ex.dificuldade === 'intermédio' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                            {ex.dificuldade}
                          </span>
                        )}
                        {ex.equipamento && <span className="text-[8px] font-bold text-slate-400">· {ex.equipamento}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {ex.video_url && (
                        <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-red-50 text-red-500 hover:text-red-600 rounded-xl">
                          <Play size={13}/>
                        </a>
                      )}
                      <button onClick={() => openEdit(ex)} className="p-2 bg-slate-50 text-slate-400 hover:text-[#004D71] rounded-xl"><Edit size={13}/></button>
                      <button onClick={() => handleDelete(ex.id)} className="p-2 bg-red-50 text-red-400 hover:text-red-600 rounded-xl"><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="text-center py-20 text-slate-200">
            <Dumbbell size={48} className="mx-auto mb-4"/>
            <p className="font-black uppercase text-xs tracking-widest text-slate-400">Nenhum exercício encontrado</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/90 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[92vh]">

            <div className="flex items-center justify-between p-6 pb-4 border-b-2 border-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-[#004D71] uppercase text-xl leading-none">{editingId ? 'Editar Exercício' : 'Novo Exercício'}</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Preenche para uma enciclopédia completa</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Nome do Exercício *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-xs uppercase text-[#004D71] outline-none focus:border-[#F7B500]/50 transition-colors" placeholder="Ex: Supino com Barra" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Tipo</label>
                  <div className="flex flex-col gap-2" style={{height:'calc(100% - 1.5rem)'}}>
                    {[{v:'STRENGTH',l:'🏋️ Força'},{v:'CARDIO',l:'❤️ Cardio'}].map(t => (
                      <button key={t.v} onClick={() => setFormData({...formData, type: t.v})}
                        className={`flex-1 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${formData.type === t.v ? 'bg-[#004D71] text-[#F7B500] border-[#004D71]' : 'bg-white text-slate-400 border-slate-100 hover:border-[#004D71]/20'}`}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Músculo Principal</label>
                  <select value={formData.primary_muscle} onChange={e => setFormData({...formData, primary_muscle: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-xs text-[#004D71] outline-none focus:border-[#F7B500]/50 appearance-none">
                    <option value="">Selecionar...</option>
                    {MUSCLE_GROUPS.map(g => (
                      <optgroup key={g.key} label={`── ${g.label.toUpperCase()} ──`}>
                        {g.muscles.map(m => <option key={m} value={m}>{m}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Dificuldade</label>
                  <div className="flex gap-1.5">
                    {[{v:'iniciante',l:'Inic.'},{v:'intermédio',l:'Inter.'},{v:'avançado',l:'Avanç.'}].map(d => (
                      <button key={d.v} onClick={() => setFormData({...formData, dificuldade: d.v})} className={`flex-1 py-4 rounded-xl font-black text-[9px] uppercase border-2 transition-all ${getDiffClass(d.v)}`}>
                        {d.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Músculos Secundários</label>
                  <input type="text" value={formData.musculos_secundarios} onChange={e => setFormData({...formData, musculos_secundarios: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-medium text-[10px] text-[#004D71] outline-none focus:border-[#F7B500]/50" placeholder="Tríceps, Core (vírgula)" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Equipamento</label>
                  <input type="text" value={formData.equipamento} onChange={e => setFormData({...formData, equipamento: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-medium text-[10px] text-[#004D71] outline-none focus:border-[#F7B500]/50" placeholder="Ex: Barra, Banco" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Descrição</label>
                <textarea rows={2} value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-medium text-xs text-[#004D71] outline-none focus:border-[#F7B500]/50 resize-none" placeholder="Descreve brevemente o exercício e os seus benefícios..." />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Instruções Passo-a-Passo</label>
                <textarea rows={5} value={formData.instrucoes} onChange={e => setFormData({...formData, instrucoes: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-medium text-xs text-[#004D71] outline-none focus:border-[#F7B500]/50 resize-none leading-relaxed" placeholder={"1. Primeiro passo...\n2. Segundo passo...\n3. Terceiro passo..."} />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1.5">Vídeo YouTube (URL)</label>
                <input type="url" value={formData.video_url} onChange={e => setFormData({...formData, video_url: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-medium text-[10px] text-[#004D71] outline-none focus:border-[#F7B500]/50" placeholder="https://youtube.com/watch?v=..." />
                {ytId && (
                  <div className="mt-3 rounded-2xl overflow-hidden" style={{aspectRatio:'16/9'}}>
                    <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} allowFullScreen title="Pré-visualização" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 pt-4 border-t-2 border-slate-50 shrink-0 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-50 text-slate-500 p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!formData.name.trim()} className="flex-[2] bg-[#004D71] text-[#F7B500] p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg disabled:opacity-50 active:scale-[0.98] transition-all">
                {editingId ? 'Guardar Alterações' : 'Adicionar Exercício'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// TEMPLATES TAB
// ==========================================
function WorkoutTemplatesTab({ user }: { user: UserProfile }) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', category: '', split: 3 });

  // For Editing a Template Session
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);

  // For Applying to Student
  const [applyingTemplate, setApplyingTemplate] = useState<WorkoutTemplate | null>(null);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/users`;
    // Buscar todos os utentes (ou alunos)
    const unsub = onSnapshot(query(collection(db, path)), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/workout_templates`;
    const unsub = onSnapshot(collection(db, path), (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutTemplate)));
    });
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!newTemplate.name) return;
    const path = `artifacts/${APP_ID}/public/data/workout_templates`;

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].slice(0, newTemplate.split);
    const sessions = letters.map(l => ({ day_label: l, title: `Treino ${l}`, exercises: [] }));

    const templateData: Partial<WorkoutTemplate> = {
       trainer_id: user.id,
       name: newTemplate.name,
       category: newTemplate.category || 'Geral',
       split_count: newTemplate.split,
       data: { sessions },
       created_at: new Date().toISOString()
    };

    await addDoc(collection(db, path), templateData);
    setShowModal(false);
    setNewTemplate({ name: '', category: '', split: 3 });
  };

  const handleDelete = async (id: string) => {
    if(confirm("Apagar template?")) {
        await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/workout_templates`, id));
    }
  };

  const handleApplyToStudent = async () => {
    if (!applyingTemplate || !selectedStudent) return;
    const path = `artifacts/${APP_ID}/public/data/treinos_assigned`;

    // Create a workout session for each day in the template
    for (const session of applyingTemplate.data.sessions) {
      if (session.exercises.length === 0) continue;

      const workoutSession: Partial<WorkoutSession> = {
         title: session.title,
         description: applyingTemplate.name,
         exercises: session.exercises as Exercise[],
         completed: false,
         durationSeconds: 0,
         assignedStudentId: selectedStudent,
         date: new Date().toISOString() // Or day_label handling
      };
      await addDoc(collection(db, path), workoutSession);
    }
    setApplyingTemplate(null);
    setSelectedStudent('');
    alert("Treino aplicado com sucesso ao Aluno!");
  };

  if (editingTemplate) {
    return <AdvancedTemplateEditor template={editingTemplate} onBack={() => setEditingTemplate(null)} />;
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center px-2">
         <div>
            <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Modelos de Treino</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Crie bases reutilizáveis</p>
         </div>
         <button onClick={() => setShowModal(true)} className="bg-[#004D71] text-[#F7B500] p-3 rounded-2xl shadow-lg active:scale-95 transition-all">
            <Plus size={20}/>
         </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
         {templates.map(t => (
            <div key={t.id} className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 flex flex-col gap-4">
               <div className="flex justify-between items-start">
                  <div>
                     <h3 className="font-black text-[#004D71] uppercase text-lg">{t.name}</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t.category} • DIVISÃO DE {t.split_count} DIAS</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-[#004D71] font-black border-2 border-slate-100">{t.split_count}</div>
               </div>

               <div className="flex gap-2 mt-2">
                  <button onClick={() => setEditingTemplate(t)} className="flex-1 bg-slate-50 text-[#004D71] p-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 flex items-center justify-center gap-2">
                     <Edit size={14}/> Editar Modelo
                  </button>
                  <button onClick={() => setApplyingTemplate(t)} className="flex-1 bg-[#004D71]/5 text-[#004D71] p-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#004D71]/10 flex items-center justify-center gap-2">
                     <Check size={14}/> Aplicar a Aluno
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="w-12 h-12 bg-red-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-100">
                     <Trash2 size={16}/>
                  </button>
               </div>
            </div>
         ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative shadow-2xl">
              <button onClick={() => setShowModal(false)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl"><X size={20}/></button>
              <h3 className="font-black text-[#004D71] uppercase text-xl mb-6">Nova Base</h3>

              <div className="space-y-4 mb-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Nome do Plano</label>
                    <input type="text" value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-xs uppercase text-[#004D71] outline-none focus:border-[#F7B500]/50" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Categoria</label>
                    <input type="text" value={newTemplate.category} onChange={e => setNewTemplate({...newTemplate, category: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-xs uppercase text-[#004D71] outline-none focus:border-[#F7B500]/50" placeholder="Ex: Hipertrofia" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Divisão (Dias por Semana)</label>
                    <div className="flex gap-2">
                       {[2,3,4,5,6].map(num => (
                          <button key={num} onClick={() => setNewTemplate({...newTemplate, split: num})} className={`flex-1 h-12 rounded-xl font-black text-sm border-2 transition-all ${newTemplate.split === num ? 'bg-[#004D71] text-[#F7B500] border-[#004D71]' : 'bg-white text-slate-400 border-slate-100 hover:border-[#004D71]/20'}`}>
                             {num}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              <button onClick={handleCreate} className="w-full bg-[#004D71] text-[#F7B500] p-5 rounded-2xl font-black uppercase tracking-widest shadow-lg flex justify-center">
                 Criar Base
              </button>
           </div>
        </div>
      )}

      {/* MODAL DE APLICAR A ALUNO */}
      {applyingTemplate && (
         <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative shadow-2xl">
              <button onClick={() => setApplyingTemplate(null)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl"><X size={20}/></button>
              <h3 className="font-black text-[#004D71] uppercase text-xl mb-2">Aplicar Plano</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{applyingTemplate.name}</p>

              <div className="space-y-4 mb-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Escolher Aluno</label>
                    <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-xs uppercase text-[#004D71] outline-none focus:border-[#F7B500]/50 appearance-none">
                       <option value="">Selecione um aluno...</option>
                       {students.map(s => (
                          <option key={s.id} value={s.id}>{s.nome || s.n}</option>
                       ))}
                    </select>
                 </div>
              </div>

              <button onClick={handleApplyToStudent} disabled={!selectedStudent} className="w-full bg-[#F7B500] text-[#004D71] p-5 rounded-2xl font-black uppercase tracking-widest shadow-lg flex justify-center disabled:opacity-50">
                 Confirmar Aplicação
              </button>
           </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// TEMPLATE EDITOR (INNER VIEW)
// ==========================================
function TemplateEditor({ template, onBack }: { template: WorkoutTemplate, onBack: () => void }) {
   const [tData, setTData] = useState(template.data);
   const [saving, setSaving] = useState(false);
   const [exercisesLib, setExercisesLib] = useState<any[]>([]);

   // Selection Modal State
   const [addingToDay, setAddingToDay] = useState<number | null>(null);

   useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/exercise_library`;
    const unsub = onSnapshot(collection(db, path), (snap) => {
      setExercisesLib(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

   const saveChanges = async () => {
      setSaving(true);
      await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/workout_templates`, template.id), {
          data: tData
      });
      setSaving(false);
      onBack();
   };

   const addExerciseToSession = (sessionIndex: number, exLib: any) => {
       const newEx = {
           id: crypto.randomUUID(),
           name: exLib.name,
           type: exLib.type || 'STRENGTH',
           sets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }]
       };
       const newData = {...tData};
       newData.sessions[sessionIndex].exercises.push(newEx as any);
       setTData(newData);
       setAddingToDay(null);
   };

   const updateSet = (sessionIdx: number, exIdx: number, setIdx: number, field: string, val: number) => {
       const newData = {...tData};
       (newData.sessions[sessionIdx].exercises[exIdx].sets[setIdx] as any)[field] = val;
       setTData(newData);
   };

   const addSet = (sessionIdx: number, exIdx: number) => {
       const newData = {...tData};
       newData.sessions[sessionIdx].exercises[exIdx].sets.push({ reps: 10, weight: 0 });
       setTData(newData);
   };

   const removeSet = (sessionIdx: number, exIdx: number, setIdx: number) => {
       const newData = {...tData};
       newData.sessions[sessionIdx].exercises[exIdx].sets.splice(setIdx, 1);
       setTData(newData);
   };

   const removeEx = (sessionIdx: number, exIdx: number) => {
       if(!confirm("Remover exercício?")) return;
       const newData = {...tData};
       newData.sessions[sessionIdx].exercises.splice(exIdx, 1);
       setTData(newData);
   }

   return (
      <div className="space-y-6">
         <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-3">
               <button onClick={onBack} className="w-10 h-10 bg-white border-2 border-[#004D71]/10 rounded-xl flex items-center justify-center text-[#004D71] active:scale-95"><X size={20}/></button>
               <div>
                  <h2 className="text-xl font-black text-[#004D71] uppercase tracking-tighter line-clamp-1">{template.name}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Editando Modelo</p>
               </div>
            </div>
            <button onClick={saveChanges} disabled={saving} className="bg-[#F7B500] text-[#004D71] px-6 py-3 rounded-2xl shadow-lg active:scale-95 transition-all font-black uppercase tracking-widest text-[10px]">
               {saving ? 'A Guardar...' : 'Guardar'}
            </button>
         </div>

         <div className="space-y-6 pb-12">
            {tData.sessions.map((session, sIdx) => (
               <div key={sIdx} className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-slate-50 pb-4">
                     <h3 className="font-black text-[#004D71] uppercase text-lg">DIA {session.day_label}</h3>
                     <button onClick={() => setAddingToDay(sIdx)} className="bg-blue-50 text-[#004D71] px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 flex gap-2 items-center">
                        <Plus size={14}/> Exercício
                     </button>
                  </div>

                  {session.exercises.length === 0 ? (
                     <div className="text-center py-6 text-slate-300">
                        <Dumbbell size={32} className="mx-auto mb-2 opacity-50"/>
                        <p className="font-black uppercase text-[10px] tracking-widest">Sem exercícios</p>
                     </div>
                  ) : (
                     <div className="space-y-4 mt-4">
                        {session.exercises.map((ex, eIdx) => (
                           <div key={eIdx} className="bg-slate-50 rounded-[1.5rem] p-4 border-2 border-slate-100 relative group">
                              <button onClick={() => removeEx(sIdx, eIdx)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"><X size={16}/></button>
                              <h4 className="font-black text-[#004D71] uppercase text-sm mb-4 pr-6">{ex.name}</h4>

                              <div className="space-y-2">
                                 {ex.sets.map((set, setIdx) => (
                                    <div key={setIdx} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border-2 border-slate-100">
                                       <span className="w-5 text-[9px] font-black text-slate-300 text-center">#{setIdx + 1}</span>
                                       <div className="flex-1 flex gap-2">
                                          <div className="flex-1 flex items-center bg-slate-50 rounded-lg px-3">
                                             <input type="number" value={set.reps || 0} onChange={e => updateSet(sIdx, eIdx, setIdx, 'reps', parseInt(e.target.value))} className="w-full bg-transparent text-center font-black text-[#004D71] text-xs py-2 outline-none" />
                                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Reps</span>
                                          </div>
                                          <div className="flex-1 flex items-center bg-slate-50 rounded-lg px-3">
                                             <input type="number" value={set.weight || 0} onChange={e => updateSet(sIdx, eIdx, setIdx, 'weight', parseInt(e.target.value))} className="w-full bg-transparent text-center font-black text-[#004D71] text-xs py-2 outline-none" />
                                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kg</span>
                                          </div>
                                       </div>
                                       <button onClick={() => removeSet(sIdx, eIdx, setIdx)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 rounded-lg bg-slate-50"><Trash2 size={14}/></button>
                                    </div>
                                 ))}
                              </div>
                              <button onClick={() => addSet(sIdx, eIdx)} className="w-full mt-3 bg-white border-2 border-dashed border-slate-200 text-slate-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-[#004D71] hover:border-[#004D71]/20 transition-all flex justify-center items-center gap-2">
                                 <Plus size={14}/> Adicionar Série
                              </button>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            ))}
         </div>

         {/* Selection Modal */}
         {addingToDay !== null && (
            <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-sm h-[80vh] flex flex-col rounded-[2.5rem] p-6 relative shadow-2xl">
                  <button onClick={() => setAddingToDay(null)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl"><X size={20}/></button>
                  <h3 className="font-black text-[#004D71] uppercase text-xl mb-4">Escolher Exercício</h3>

                  <div className="bg-slate-50 rounded-[1.5rem] p-2 border-2 border-[#004D71]/5 flex items-center pr-4 shadow-inner mb-4 shrink-0">
                     <div className="w-10 h-10 flex items-center justify-center text-slate-400"><Search size={18}/></div>
                     <input
                        type="text"
                        placeholder="Pesquisar..."
                        className="flex-1 bg-transparent border-none outline-none font-black text-[#004D71] uppercase text-[10px] placeholder:text-slate-300"
                     />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                     {exercisesLib.map(ex => (
                        <button key={ex.id} onClick={() => addExerciseToSession(addingToDay, ex)} className="w-full bg-slate-50 hover:bg-blue-50 border-2 border-slate-100 hover:border-blue-100 rounded-2xl p-4 flex items-center justify-between transition-all group text-left">
                           <div>
                              <h4 className="font-black text-[#004D71] uppercase text-[11px] leading-tight">{ex.name}</h4>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{ex.primary_muscle || 'Geral'}</p>
                           </div>
                           <Plus size={16} className="text-slate-300 group-hover:text-[#004D71]"/>
                        </button>
                     ))}
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}

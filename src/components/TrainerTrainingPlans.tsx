import React, { useState, useEffect } from 'react';
import { Dumbbell, Plus, Search, BookOpen, X, Edit, Trash2, Check, Copy } from 'lucide-react';
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
function ExerciseBankTab() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'STRENGTH', primary_muscle: '', video_url: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/exercise_library`;
    const unsub = onSnapshot(collection(db, path), (snap) => {
      setExercises(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!formData.name) return;
    const path = `artifacts/${APP_ID}/public/data/exercise_library`;
    if (editingId) {
      await updateDoc(doc(db, path, editingId), formData);
    } else {
      await addDoc(collection(db, path), formData);
    }
    setShowModal(false);
    setFormData({ name: '', type: 'STRENGTH', primary_muscle: '', video_url: '' });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Remover exercício?")) {
      await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/exercise_library`, id));
    }
  };

  const filtered = exercises.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-2">
         <div>
            <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Banco de Exercícios</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gerir catálogo base</p>
         </div>
         <button onClick={() => {setEditingId(null); setFormData({name:'', type:'STRENGTH', primary_muscle:'', video_url:''}); setShowModal(true);}} className="bg-[#004D71] text-[#F7B500] p-3 rounded-2xl shadow-lg active:scale-95 transition-all">
            <Plus size={20}/>
         </button>
      </div>

      <div className="bg-white rounded-3xl p-2 border-4 border-[#004D71]/5 flex items-center pr-4 shadow-sm focus-within:border-[#F7B500]/50 transition-colors">
         <div className="w-12 h-12 flex items-center justify-center text-slate-300"><Search size={20}/></div>
         <input 
            type="text" 
            placeholder="Procurar exercício..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none font-black text-[#004D71] uppercase text-xs placeholder:text-slate-300"
         />
      </div>

      <div className="grid grid-cols-1 gap-3">
         {filtered.map(ex => (
            <div key={ex.id} className="bg-white rounded-[2rem] p-5 border-4 border-[#004D71]/5 flex items-center justify-between group">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-[#004D71] flex items-center justify-center shrink-0 border-2 border-slate-100">
                     <Dumbbell size={20}/>
                  </div>
                  <div>
                     <h4 className="font-black text-[#004D71] uppercase text-sm leading-tight">{ex.name}</h4>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{ex.primary_muscle || 'Geral'}</span>
                  </div>
               </div>
               <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => {setEditingId(ex.id); setFormData(ex); setShowModal(true);}} className="p-3 bg-slate-50 text-slate-400 hover:text-[#004D71] rounded-xl"><Edit size={16}/></button>
                  <button onClick={() => handleDelete(ex.id)} className="p-3 bg-red-50 text-red-400 hover:text-red-600 rounded-xl"><Trash2 size={16}/></button>
               </div>
            </div>
         ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative shadow-2xl">
              <button onClick={() => setShowModal(false)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl"><X size={20}/></button>
              <h3 className="font-black text-[#004D71] uppercase text-xl mb-6">{editingId ? 'Editar Exercício' : 'Novo Exercício'}</h3>
              
              <div className="space-y-4 mb-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Nome</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-xs uppercase text-[#004D71] outline-none focus:border-[#F7B500]/50" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Músculo Principal</label>
                    <input type="text" value={formData.primary_muscle} onChange={e => setFormData({...formData, primary_muscle: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-xs uppercase text-[#004D71] outline-none focus:border-[#F7B500]/50" placeholder="Ex: Peitoral" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Vídeo Link (YouTube)</label>
                    <input type="text" value={formData.video_url} onChange={e => setFormData({...formData, video_url: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-[10px] text-[#004D71] outline-none focus:border-[#F7B500]/50 lowercase" placeholder="https://..." />
                 </div>
              </div>

              <button onClick={handleSave} className="w-full bg-[#004D71] text-[#F7B500] p-5 rounded-2xl font-black uppercase tracking-widest shadow-lg flex justify-center">
                 Gravar
              </button>
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

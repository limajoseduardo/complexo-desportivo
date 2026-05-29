import React, { useState, useEffect } from 'react';
import { Dumbbell, Plus, Search, BookOpen, X, Edit, Trash2, Check, Copy, ChevronDown, ExternalLink, GraduationCap, Target, Zap, RefreshCw, TrendingUp, Clock, BarChart2, AlertCircle, ChevronRight } from 'lucide-react';
import { motion } from "framer-motion";
import { Edit2, Play, Users, Save, Eye, MoreVertical } from "lucide-react";
import { db } from '../lib/firebase';
import { APP_ID } from '../App';
import { collection, onSnapshot, query, doc, addDoc, updateDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { UserProfile, Exercise, WorkoutTemplate, WorkoutSession, WorkoutSet } from '../types';
import { AdvancedTemplateEditor } from "./AdvancedTemplateEditor";

export function TrainerTrainingModule({ user }: { user: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'exercicios' | 'templates' | 'enciclopedia'>('exercicios');

  return (
    <div className="space-y-6 animate-in fade-in pb-24 text-left font-sans">
      <div className="bg-white rounded-[2.5rem] p-3 flex gap-2 border-4 border-[#004D71]/5 sticky top-0 z-10 overflow-x-auto">
        <button
          onClick={() => setActiveTab('exercicios')}
          className={`flex-1 min-w-max py-3.5 px-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${activeTab === 'exercicios' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Dumbbell size={16}/> Exercícios
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 min-w-max py-3.5 px-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${activeTab === 'templates' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <BookOpen size={16}/> Modelos
        </button>
        <button
          onClick={() => setActiveTab('enciclopedia')}
          className={`flex-1 min-w-max py-3.5 px-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${activeTab === 'enciclopedia' ? 'bg-[#F7B500] text-[#004D71] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <GraduationCap size={16}/> Enciclopédia
        </button>
      </div>

      {activeTab === 'exercicios' && <ExerciseBankTab />}
      {activeTab === 'templates' && <WorkoutTemplatesTab user={user} />}
      {activeTab === 'enciclopedia' && <EnciclopediaTab />}
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

export function ExerciseBankTab({ readOnly = false }: { readOnly?: boolean }) {
  const [exercises, setExercises] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyExForm });
  const [selectedExercise, setSelectedExercise] = useState<any | null>(null);

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
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">{readOnly ? 'Biblioteca' : 'Banco de Exercícios'}</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{exercises.length} exercícios · por grupo muscular</p>
        </div>
        {!readOnly && (
          <button onClick={openAdd} className="bg-[#004D71] text-[#F7B500] p-3 rounded-2xl shadow-lg active:scale-95 transition-all">
            <Plus size={20}/>
          </button>
        )}
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
                  <div key={ex.id} className={`flex items-center gap-3 px-5 py-3.5 group hover:bg-slate-50/50 transition-colors ${readOnly ? 'cursor-pointer' : ''}`} onClick={readOnly ? () => setSelectedExercise(ex) : undefined}>
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
                        <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-red-50 text-red-500 hover:text-red-600 rounded-xl" onClick={e => e.stopPropagation()}>
                          <Play size={13}/>
                        </a>
                      )}
                      {!readOnly && <button onClick={() => openEdit(ex)} className="p-2 bg-slate-50 text-slate-400 hover:text-[#004D71] rounded-xl"><Edit size={13}/></button>}
                      {!readOnly && <button onClick={() => handleDelete(ex.id)} className="p-2 bg-red-50 text-red-400 hover:text-red-600 rounded-xl"><Trash2 size={13}/></button>}
                      {readOnly && <ChevronDown size={14} className="-rotate-90 text-slate-300 shrink-0"/>}
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

      {/* DETAIL VIEW — Read-Only (Utentes) */}
      {selectedExercise && readOnly && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/90 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-xl sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between p-6 border-b-2 border-slate-50 shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="font-black text-[#004D71] uppercase text-xl leading-tight">{selectedExercise.name}</h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selectedExercise.dificuldade && (
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${selectedExercise.dificuldade === 'iniciante' ? 'bg-emerald-50 text-emerald-600' : selectedExercise.dificuldade === 'intermédio' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>{selectedExercise.dificuldade}</span>
                  )}
                  {selectedExercise.primary_muscle && (
                    <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-[#004D71]/10 text-[#004D71]">{selectedExercise.primary_muscle}</span>
                  )}
                  <span className="text-[9px] font-black text-slate-400 uppercase">{selectedExercise.type === 'CARDIO' ? '❤️ Cardio' : '🏋️ Força'}</span>
                </div>
              </div>
              <button onClick={() => setSelectedExercise(null)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 shrink-0"><X size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {selectedExercise.equipamento && (
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Equipamento</p>
                  <p className="text-sm font-bold text-[#004D71]">{selectedExercise.equipamento}</p>
                </div>
              )}
              {Array.isArray(selectedExercise.musculos_secundarios) && selectedExercise.musculos_secundarios.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Músculos Secundários</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedExercise.musculos_secundarios.filter(Boolean).map((m: string, i: number) => (
                      <span key={i} className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-100">{m}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedExercise.descricao && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Descrição</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedExercise.descricao}</p>
                </div>
              )}
              {selectedExercise.instrucoes && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Como Executar</p>
                  <div className="space-y-2">
                    {selectedExercise.instrucoes.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                      <p key={i} className="text-sm text-slate-600 leading-relaxed">{line}</p>
                    ))}
                  </div>
                </div>
              )}
              {getYouTubeId(selectedExercise.video_url) && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Vídeo Tutorial</p>
                  <div className="rounded-2xl overflow-hidden" style={{aspectRatio:'16/9'}}>
                    <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${getYouTubeId(selectedExercise.video_url)}`} allowFullScreen title="Tutorial" />
                  </div>
                </div>
              )}
              {!selectedExercise.instrucoes && !selectedExercise.descricao && !selectedExercise.video_url && (
                <div className="text-center py-8 text-slate-300">
                  <Dumbbell size={36} className="mx-auto mb-3"/>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Detalhes em breve</p>
                  <p className="text-[10px] text-slate-400 mt-1">O professor ainda não adicionou descrição</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

// ==========================================
// ENCICLOPÉDIA DE TREINO
// ==========================================

const PRINCIPIOS = [
  {
    icon: <TrendingUp size={18}/>, color: '#3B82F6', title: 'Sobrecarga Progressiva',
    body: 'O principal motor de adaptação. Aumenta gradualmente o estímulo — mais peso, mais reps, menos descanso ou maior amplitude. Sem progressão não há evolução. Regra prática: quando um utente completa todas as séries com boa técnica, é hora de progredir (≈2,5–5 kg ou +1 rep por série).'
  },
  {
    icon: <Target size={18}/>, color: '#8B5CF6', title: 'Especificidade',
    body: 'O corpo adapta-se ao estímulo que recebe. Quem quer força treina com cargas pesadas (1–5 reps). Quem quer resistência muscular usa cargas leves (15–25 reps). Quem quer hipertrofia foca 6–12 reps. Escolhe exercícios que recrutam os músculos do objetivo.'
  },
  {
    icon: <RefreshCw size={18}/>, color: '#10B981', title: 'Recuperação',
    body: 'O crescimento acontece no descanso, não no treino. Músculos grandes (pernas, costas) precisam de 48–72h de recuperação. Músculos pequenos (bíceps, tríceps) 24–48h. Sono de 7–9h é obrigatório. Planeamento insuficiente de recuperação = lesões e estagnação.'
  },
  {
    icon: <Zap size={18}/>, color: '#F59E0B', title: 'Variação',
    body: 'O corpo adapta-se e estagna. Muda um variável a cada 4–8 semanas: ordem dos exercícios, equipamento (halteres vs barra), ângulo (inclinado vs plano), técnica de intensidade (drop sets, supersets). Nunca mudes tudo ao mesmo tempo — impossível identificar o que resultou.'
  },
  {
    icon: <AlertCircle size={18}/>, color: '#EF4444', title: 'Individualidade',
    body: 'Cada pessoa responde de forma diferente. Fatores: genética, historial de treino, alimentação, sono, stress. O mesmo plano produz resultados diferentes em pessoas diferentes. Monitoriza, ajusta e personaliza sempre que possível.'
  },
];

const TABELA_OBJETIVOS = [
  { objetivo: 'Força Máxima',    series: '3–6',  reps: '1–5',   carga: '85–100%', descanso: '3–5 min', freq: '2–4×/sem' },
  { objetivo: 'Hipertrofia',     series: '3–5',  reps: '6–12',  carga: '67–85%',  descanso: '60–90s',  freq: '3–5×/sem' },
  { objetivo: 'Resistência Musc.', series: '2–4', reps: '13–25', carga: '50–67%', descanso: '30–60s',  freq: '2–4×/sem' },
  { objetivo: 'Potência',        series: '3–5',  reps: '1–5',   carga: '75–90%',  descanso: '2–4 min', freq: '2–3×/sem' },
  { objetivo: 'Emagrecimento',   series: '3–4',  reps: '12–20', carga: '60–75%',  descanso: '30–45s',  freq: '3–5×/sem' },
];

const PASSOS_PLANO = [
  { n: '1', titulo: 'Define o Objetivo', desc: 'Força? Hipertrofia? Resistência? Perda de peso? O objetivo determina tudo o resto. Sê específico: "ganhar massa no tronco" é melhor que "ficar mais forte".' },
  { n: '2', titulo: 'Avalia o Nível', desc: 'Iniciante (< 6 meses): 2–3 treinos/semana, full-body, padrões básicos. Intermédio (6–24 meses): 3–4 treinos, divisão push/pull/legs ou upper/lower. Avançado (> 2 anos): 4–6 treinos, periodização.' },
  { n: '3', titulo: 'Escolhe a Divisão', desc: 'Full-body (2–3×/sem) para iniciantes. Upper/Lower (4×/sem) para intermédios. Push/Pull/Legs (5–6×/sem) para avançados. A melhor divisão é a que o utente consegue cumprir.' },
  { n: '4', titulo: 'Seleciona Exercícios', desc: 'Começa por compostos (agachamento, supino, peso morto, press militar, remada) — recrutam mais músculo por exercício. Adiciona isolados no fim. Regra: 2–3 compostos + 2–3 isolados por sessão.' },
  { n: '5', titulo: 'Define Volume e Carga', desc: 'Usa a tabela de referência. Para hipertrofia: 10–20 séries por grupo muscular por semana. Distribui equitativamente pelos dias. Começa no mínimo eficaz e aumenta progressivamente.' },
  { n: '6', titulo: 'Planeia a Progressão', desc: 'Define o mecanismo de progressão desde o início: dupla progressão (mais reps primeiro, depois mais peso), progressão linear simples, periodização ondulante. Documenta tudo para ajustar.' },
];

const PERIODIZACAO = [
  { tipo: 'Linear', desc: 'Aumenta carga progressivamente semana a semana. Ideal para iniciantes. Ex: semana 1 → 3×10, semana 2 → 3×10+2,5kg.', ideal: 'Iniciantes' },
  { tipo: 'Ondulante (DUP)', desc: 'Varia volume e intensidade dentro da mesma semana. Ex: seg → força (5×5), qua → hipertrofia (4×10), sex → resistência (3×15). Maior variedade, menos adaptação.', ideal: 'Intermédio / Avançado' },
  { tipo: 'Bloco', desc: 'Divide o macrociclo em blocos de 3–6 semanas com foco diferente: Acumulação (volume alto) → Intensificação (carga alta) → Realização (pico de performance).', ideal: 'Avançado / Competição' },
];

function AccordionSection({ icon, color, title, body }: { icon: React.ReactNode; color: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '18', color }}>
          {icon}
        </div>
        <span className="flex-1 font-black text-[#004D71] uppercase text-sm">{title}</span>
        <ChevronDown size={16} className={`text-slate-300 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}/>
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t-2 border-slate-50 pt-4">
          {body}
        </div>
      )}
    </div>
  );
}

export function EnciclopediaTab() {
  const [section, setSection] = useState<'principios' | 'como' | 'tabela' | 'periodizacao' | 'builder'>('principios');

  const NAV = [
    { key: 'principios' as const,    label: 'Princípios',    icon: <Zap size={13}/> },
    { key: 'como' as const,          label: 'Como Criar',    icon: <Target size={13}/> },
    { key: 'tabela' as const,        label: 'Referência',    icon: <BarChart2 size={13}/> },
    { key: 'periodizacao' as const,  label: 'Periodização',  icon: <Clock size={13}/> },
    { key: 'builder' as const,       label: 'workout.cool',  icon: <ExternalLink size={13}/> },
  ];

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Sub-nav */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {NAV.map(n => (
          <button
            key={n.key}
            onClick={() => setSection(n.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${section === n.key ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'bg-white text-slate-400 border-2 border-slate-100 hover:border-[#004D71]/20'}`}
          >
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {/* Princípios */}
      {section === 'principios' && (
        <div className="space-y-3">
          <div className="px-1">
            <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">5 Princípios</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Base científica do treino eficaz</p>
          </div>
          {PRINCIPIOS.map(p => (
            <AccordionSection key={p.title} icon={p.icon} color={p.color} title={p.title} body={p.body}/>
          ))}
        </div>
      )}

      {/* Como Criar */}
      {section === 'como' && (
        <div className="space-y-3">
          <div className="px-1">
            <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Como Criar um Plano</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">6 passos do zero ao treino completo</p>
          </div>
          {PASSOS_PLANO.map(p => (
            <div key={p.n} className="bg-white rounded-[1.5rem] p-5 border-2 border-slate-100 flex gap-4">
              <div className="w-9 h-9 rounded-xl bg-[#004D71] text-[#F7B500] flex items-center justify-center font-black text-lg shrink-0">{p.n}</div>
              <div>
                <h4 className="font-black text-[#004D71] uppercase text-sm">{p.titulo}</h4>
                <p className="text-sm text-slate-600 leading-relaxed mt-1">{p.desc}</p>
              </div>
            </div>
          ))}
          {/* Dica extra */}
          <div className="bg-[#004D71]/5 rounded-[1.5rem] p-5 border-2 border-[#004D71]/10">
            <p className="text-[9px] font-black text-[#004D71] uppercase tracking-widest mb-2">Dica de ouro</p>
            <p className="text-sm text-[#004D71] leading-relaxed font-medium">A ordem dos exercícios importa: compostos multiarticulares primeiro (quando o sistema nervoso está fresco), isolados no fim. Nunca faças leg press antes do agachamento.</p>
          </div>
        </div>
      )}

      {/* Tabela de Referência */}
      {section === 'tabela' && (
        <div className="space-y-4">
          <div className="px-1">
            <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Tabela de Referência</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Séries · Repetições · Descanso por objetivo</p>
          </div>
          <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden">
            {TABELA_OBJETIVOS.map((row, i) => (
              <div key={row.objetivo} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 ${i !== TABELA_OBJETIVOS.length - 1 ? 'border-b-2 border-slate-50' : ''}`}>
                <div className="w-full sm:w-36 shrink-0">
                  <span className="font-black text-[#004D71] uppercase text-xs">{row.objetivo}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className="bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full font-black text-slate-600"><span className="text-slate-400">Séries</span> {row.series}</span>
                  <span className="bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full font-black text-slate-600"><span className="text-slate-400">Reps</span> {row.reps}</span>
                  <span className="bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full font-black text-slate-600"><span className="text-slate-400">Carga</span> {row.carga}</span>
                  <span className="bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full font-black text-amber-700"><span className="text-amber-400">Descanso</span> {row.descanso}</span>
                  <span className="bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full font-black text-blue-700"><span className="text-blue-400">Freq.</span> {row.freq}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Regras rápidas */}
          <div className="space-y-2">
            {[
              { cor: '#10B981', texto: 'Volume semanal mínimo por grupo muscular: 10 séries (iniciante) a 20+ séries (avançado).' },
              { cor: '#3B82F6', texto: 'Aquecimento: 5–10 min cardio leve + mobilidade articular + 1–2 séries de ativação com carga baixa.' },
              { cor: '#F59E0B', texto: 'Arrefecimento: alongamentos estáticos (30s/músculo), especialmente dos grupos trabalhados.' },
              { cor: '#8B5CF6', texto: 'Regra 2/3: se um utente completar 2 séries acima do mínimo de reps por 3 sessões consecutivas → aumenta a carga.' },
            ].map(r => (
              <div key={r.texto} className="bg-white rounded-2xl p-4 border-2 border-slate-100 flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: r.cor }}/>
                <p className="text-sm text-slate-600 leading-relaxed">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Periodização */}
      {section === 'periodizacao' && (
        <div className="space-y-4">
          <div className="px-1">
            <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Periodização</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Como estruturar o treino a longo prazo</p>
          </div>
          {PERIODIZACAO.map(p => (
            <div key={p.tipo} className="bg-white rounded-[1.5rem] p-5 border-2 border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-[#004D71] uppercase text-sm">{p.tipo}</h4>
                <span className="text-[9px] font-black bg-[#004D71]/8 text-[#004D71] px-2.5 py-1 rounded-full uppercase tracking-widest">{p.ideal}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
            </div>
          ))}
          {/* Macrociclo visual */}
          <div className="bg-white rounded-[1.5rem] p-5 border-2 border-slate-100 space-y-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estrutura Temporal</p>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Microciclo', dur: '1 semana', desc: 'Unidade básica de treino (ex: seg/qua/sex)' },
                { label: 'Mesociclo', dur: '3–6 semanas', desc: 'Bloco com foco definido (ex: hipertrofia)' },
                { label: 'Macrociclo', dur: '3–12 meses', desc: 'Ciclo completo até ao objetivo final' },
              ].map(t => (
                <div key={t.label} className="flex items-start gap-3">
                  <div className="w-24 shrink-0">
                    <span className="font-black text-[#004D71] text-xs uppercase">{t.label}</span>
                    <p className="text-[9px] font-bold text-[#F7B500] uppercase">{t.dur}</p>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed pt-0.5">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#004D71] rounded-[1.5rem] p-5 text-white space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#F7B500]">Deload</p>
            <p className="text-sm leading-relaxed opacity-90">Após cada mesociclo, inclui 1 semana de deload: reduz volume em 40–50% mas mantém intensidade. Permite recuperação completa e prepara para o próximo bloco mais pesado.</p>
          </div>
        </div>
      )}

      {/* workout.cool */}
      {section === 'builder' && (
        <div className="space-y-4">
          <div className="px-1">
            <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">workout.cool</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Construtor de treinos e biblioteca de exercícios</p>
          </div>

          {/* Feature cards */}
          {[
            {
              title: 'Construtor de Treinos',
              desc: 'Cria planos personalizados selecionando equipamento disponível e grupos musculares. Gera treinos estruturados automaticamente.',
              url: 'https://www.workout.cool',
              color: '#004D71',
              tag: 'Para Professores',
            },
            {
              title: 'Biblioteca de Exercícios',
              desc: 'Centenas de exercícios com vídeos, instruções detalhadas e músculos trabalhados. Filtra por equipamento, grupo muscular ou dificuldade.',
              url: 'https://www.workout.cool',
              color: '#3B82F6',
              tag: 'Para Todos',
            },
            {
              title: 'Programas Pré-feitos',
              desc: 'Programas de treino completos com periodização definida para diferentes objetivos: força, hipertrofia, resistência.',
              url: 'https://www.workout.cool/programs',
              color: '#8B5CF6',
              tag: 'Para Professores',
            },
          ].map(card => (
            <a
              key={card.title}
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white rounded-[1.5rem] p-5 border-2 border-slate-100 hover:border-blue-200 transition-all group active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: card.color + '15', color: card.color }}>{card.tag}</span>
                  </div>
                  <h4 className="font-black text-[#004D71] uppercase text-sm">{card.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed mt-1">{card.desc}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ background: card.color + '15' }}>
                  <ExternalLink size={18} style={{ color: card.color }}/>
                </div>
              </div>
            </a>
          ))}

          {/* Open source note */}
          <div className="bg-slate-50 rounded-[1.5rem] p-5 border-2 border-slate-100 flex gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 shrink-0"/>
            <div>
              <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Projeto Open-Source</p>
              <p className="text-sm text-slate-500 leading-relaxed mt-1">workout.cool é gratuito e de código aberto. Suporta Português, Inglês, Francês, Espanhol e mais. Disponível sem necessidade de conta para uso básico.</p>
              <a href="https://github.com/Snouzy/workout-cool" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 hover:underline">
                Ver código-fonte <ExternalLink size={10}/>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// BIBLIOTECA DE EXERCÍCIOS (Utentes - Só Leitura)
// ==========================================
export function ExerciseLibraryView() {
  return (
    <div className="space-y-6 animate-in fade-in pb-24 text-left font-sans">
      <ExerciseBankTab readOnly />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, Plus, X, Search, Youtube, Activity, 
  ChevronRight, Save, Info, Languages, Layers
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, addDoc, onSnapshot, query, where, orderBy 
} from 'firebase/firestore';
import { Exercicio, UserProfile } from '../types';
import { FormInput } from './Common';

const APP_ID = 'cpx-vila-rei-main';

const MUSCLE_GROUPS = [
  "Peito", "Costas", "Pernas", "Ombros", "Bicep", "Tricep", 
  "Abdominais", "Cardio", "Mobilidade", "Alongamentos"
];

const MUSCLES_LIST = [
  "Peitoral Maior", "Peitoral Menor", "Grande Dorsal", "Trapézios", 
  "Lombares", "Rombóides", "Quadriceps", "Isquiotibiais", 
  "Glúteos", "Adutores", "Abdutores", "Gémeos", "Deltoide Anterior", 
  "Deltoide Lateral", "Deltoide Posterior", "Bicep Branquial", "Braquial", 
  "Tricep Branquial", "Reto Abdominal", "Oblíquos", "Transverso", "Coração/Vascular"
];

export function ExerciseGallery({ user }: { user: UserProfile }) {
  const [exercises, setExercises] = useState<Exercicio[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    nomePT: '',
    nomeEN: '',
    grupo: MUSCLE_GROUPS[0],
    primaryMuscles: [] as string[],
    secondaryMuscles: [] as string[],
    desc: '',
    link: ''
  });

  const isProfessor = user.role === 'professor' || user.role === 'admin';

  useEffect(() => {
    const exPath = `artifacts/${APP_ID}/public/data/exercicios`;
    const q = query(collection(db, exPath));
    
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercicio));
      setExercises(list);
      setLoading(false);
    }, (err) => {
      console.warn("Exercise sync err:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const saveExercise = async () => {
    if (!formData.nomePT || !formData.link) {
      alert("Preencha o nome e o link!");
      return;
    }

    try {
      const exPath = `artifacts/${APP_ID}/public/data/exercicios`;
      await addDoc(collection(db, exPath), {
        ...formData,
        createdBy: user.id,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setFormData({
        nomePT: '', nomeEN: '', grupo: MUSCLE_GROUPS[0],
        primaryMuscles: [], secondaryMuscles: [], desc: '', link: ''
      });
    } catch (e) {
      console.error(e);
      alert("Erro ao gravar exercício.");
    }
  };

  const filtered = exercises.filter(ex => {
    const matchGroup = activeGroup === "Todos" || ex.grupo === activeGroup;
    const matchSearch = ex.nomePT.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        ex.nomeEN.toLowerCase().includes(searchTerm.toLowerCase());
    return matchGroup && matchSearch;
  });

  const toggleMuscle = (muscle: string, isPrimary: boolean) => {
    if (isPrimary) {
      setFormData(prev => ({
        ...prev,
        primaryMuscles: prev.primaryMuscles.includes(muscle) 
          ? prev.primaryMuscles.filter(m => m !== muscle)
          : [...prev.primaryMuscles, muscle]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        secondaryMuscles: prev.secondaryMuscles.includes(muscle) 
          ? prev.secondaryMuscles.filter(m => m !== muscle)
          : [...prev.secondaryMuscles, muscle]
      }));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24 text-left font-sans">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
            <Dumbbell className="text-[#F7B500]"/> Biblioteca Exercícios
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            Gestão Municipal Vila de Rei
          </p>
        </div>
        {isProfessor && (
          <button 
            onClick={() => setShowAddModal(true)} 
            className="bg-[#004D71] text-[#F7B500] p-4 rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            <Plus size={24}/>
          </button>
        )}
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <Search size={18}/>
        </span>
        <input 
          type="text" 
          placeholder="PESQUISAR EXERCÍCIO..." 
          className="w-full bg-white border-4 border-[#004D71]/5 rounded-3xl py-4 pl-12 pr-4 font-black text-xs text-[#004D71] outline-none focus:border-[#004D71]/20 transition-all placeholder:text-slate-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-2 pb-6">
        <button 
          onClick={() => setActiveGroup("Todos")}
          className={`w-full px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-left flex items-center justify-between ${activeGroup === "Todos" ? 'bg-[#004D71] text-[#F7B500] shadow-lg ring-2 ring-[#004D71]/20' : 'bg-white text-slate-400 border-2 border-slate-100'}`}
        >
          <span>Todos os Exercícios</span>
          {activeGroup === "Todos" && <div className="w-2 h-2 rounded-full bg-[#F7B500] animate-pulse" />}
        </button>
        <div className="grid grid-cols-1 gap-2">
          {MUSCLE_GROUPS.map(g => (
            <button 
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-left flex items-center justify-between ${activeGroup === g ? 'bg-[#004D71] text-[#F7B500] shadow-lg ring-2 ring-[#004D71]/20' : 'bg-white text-slate-400 border-2 border-slate-100'}`}
            >
              <span>{g}</span>
              {activeGroup === g && <div className="w-2 h-2 rounded-full bg-[#F7B500] animate-pulse" />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map(ex => (
          <div key={ex.id} className="bg-white rounded-3xl p-4 border-2 border-slate-100 flex items-center justify-between group active:bg-slate-50 transition-all">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#004D71]">
                <Dumbbell size={20}/>
              </div>
              <div>
                <h3 className="font-black text-xs text-[#004D71] uppercase leading-tight">{ex.nomePT}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{ex.grupo}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-200"/>
                  <span className="text-[8px] font-bold text-slate-300 uppercase italic line-clamp-1">{ex.nomeEN}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <a href={ex.link} target="_blank" rel="noopener noreferrer" className="p-3 bg-red-50 text-red-600 rounded-xl">
                <Youtube size={16}/>
              </a>
              <div className="text-slate-200">
                <ChevronRight size={16}/>
              </div>
            </div>
          </div>
        ))}
        
        {loading && <div className="py-20 text-center animate-pulse"><Dumbbell className="mx-auto text-slate-200" size={40}/></div>}
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center text-slate-300 uppercase font-black text-xs tracking-widest">
            Sem exercícios nesta categoria
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[10000] bg-white flex flex-col font-sans animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#004D71] p-6 pt-12 flex items-center justify-between text-white border-b-4 border-[#F7B500]">
             <div>
                <h3 className="text-xl font-black uppercase">Novo Exercício</h3>
                <p className="text-[9px] font-black text-[#F7B500] uppercase tracking-[0.2em] mt-1">Base de Dados Picoto</p>
             </div>
             <button onClick={() => setShowAddModal(false)} className="p-3 bg-white/10 rounded-2xl active:scale-90"><X size={24}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <FormInput 
                  label="Nome Português" 
                  icon={<Languages size={14}/>}
                  value={formData.nomePT} 
                  onChange={v => setFormData({...formData, nomePT: v})} 
                />
                <FormInput 
                  label="Nome em Inglês" 
                  icon={<Languages size={14}/>}
                  value={formData.nomeEN} 
                  onChange={v => setFormData({...formData, nomeEN: v})} 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[#004D71] ml-1 flex items-center gap-2">
                  <Activity size={12}/> Grupo Muscular Principal
                </label>
                <div className="flex flex-wrap gap-2">
                  {MUSCLE_GROUPS.map(g => (
                    <button 
                      key={g}
                      onClick={() => setFormData({...formData, grupo: g})}
                      className={`px-4 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${formData.grupo === g ? 'bg-[#004D71] text-[#F7B500] shadow-md scale-105' : 'bg-white text-slate-400 border border-slate-200'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-[#004D71] ml-1 flex items-center gap-2">
                    <Layers size={12}/> Músculos Primários (Seleção Múltipla)
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-4 bg-white rounded-3xl border-2 border-slate-100 max-h-40 overflow-y-auto shadow-inner">
                    {MUSCLES_LIST.map(m => (
                      <button 
                        key={m}
                        onClick={() => toggleMuscle(m, true)}
                        className={`text-left px-3 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${formData.primaryMuscles.includes(m) ? 'bg-green-500 text-white shadow-sm' : 'bg-slate-50 text-slate-400'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-[#004D71] ml-1 flex items-center gap-2">
                    <Layers size={12}/> Músculos Secundários
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-4 bg-white rounded-3xl border-2 border-slate-100 max-h-40 overflow-y-auto shadow-inner">
                    {MUSCLES_LIST.map(m => (
                      <button 
                        key={m}
                        onClick={() => toggleMuscle(m, false)}
                        className={`text-left px-3 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${formData.secondaryMuscles.includes(m) ? 'bg-[#F7B500] text-[#004D71] shadow-sm' : 'bg-slate-50 text-slate-400'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <FormInput 
                label="Descrição Técnica / Execução" 
                icon={<Info size={14}/>}
                multiline
                value={formData.desc}
                onChange={v => setFormData({...formData, desc: v})}
              />

              <FormInput 
                label="Link Vídeo (YouTube/Vimeo)" 
                icon={<Youtube size={14}/>}
                placeholder="https://youtube.com/watch?v=..."
                value={formData.link}
                onChange={v => setFormData({...formData, link: v})}
              />
            </div>
          </div>

          <div className="p-6 bg-white border-t border-slate-100 pb-10">
            <button 
              onClick={saveExercise}
              className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
            >
              <Save size={20}/> Publicar Exercício Oficial
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

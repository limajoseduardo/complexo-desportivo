import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { WorkoutTemplate } from "../types";
import { db } from "../lib/firebase";
import { APP_ID } from "../App";
import { doc, updateDoc, collection, onSnapshot } from "firebase/firestore";
import { X, Save, ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, View, Search, ChevronDown, Check, Edit2, Link, Link2Off } from "lucide-react";

const MUSCLE_GROUPS = [
  "Peitoral", "Costas", "Ombros", "Trapézio", "Bíceps", "Tríceps", "Antebraços",
  "Abdómen / Core", "Lombar", "Quadríceps", "Posterior da coxa / Isquiotibiais",
  "Glúteos", "Adutores", "Abdutores", "Gémeos", "Corpo inteiro / Compostos",
  "Cárdio", "Mobilidade / Alongamentos",
];

interface Props {
  template: WorkoutTemplate;
  onBack: () => void;
}

export function AdvancedTemplateEditor({ template, onBack }: Props) {
  const [tData, setTData] = useState<any>(template.data || { sessions: [] });
  const [activeTab, setActiveTab] = useState<string>(
    template.data?.sessions?.[0]?.day_label || "A"
  );
  
  const [isSaving, setIsSaving] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [bankExercises, setBankExercises] = useState<any[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("Todos");
  const [draggedExerciseIndex, setDraggedExerciseIndex] = useState<number | null>(null);

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/exercise_library`;
    const unsub = onSnapshot(collection(db, path), (snap) => {
      setBankExercises(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/workout_templates`, template.id), {
        data: tData
      });
      setTimeout(() => onBack(), 500);
    } catch (e) {
      console.error("Error saving", e);
      alert("Erro ao guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const activeSession = tData.sessions?.find((s: any) => s.day_label === activeTab);
  const sessionIndex = tData.sessions?.findIndex((s: any) => s.day_label === activeTab);

  const addExercise = (name: string, type: "STRENGTH" | "CARDIO" = "STRENGTH", libraryId?: string) => {
    if (!activeSession || sessionIndex === -1) return;
    const newEx = {
      name,
      type,
      sets: [{ reps: 10, weight: 0 }],
      id: crypto.randomUUID(),
      library_id: libraryId,
      isHeader: false,
      isSuperset: false
    };

    const newData = { ...tData };
    if (!newData.sessions[sessionIndex].exercises) {
      newData.sessions[sessionIndex].exercises = [];
    }
    newData.sessions[sessionIndex].exercises.push(newEx);
    setTData(newData);
    setShowBankModal(false);
  };

  const addHeader = (groupName: string) => {
    if (!activeSession || sessionIndex === -1) return;
    const newEx = {
      name: groupName,
      type: "STRENGTH" as const,
      isHeader: true,
      sets: [],
      id: crypto.randomUUID(),
    };
    const newData = { ...tData };
    if (!newData.sessions[sessionIndex].exercises) {
      newData.sessions[sessionIndex].exercises = [];
    }
    newData.sessions[sessionIndex].exercises.push(newEx);
    setTData(newData);
    setShowGroupModal(false);
  };

  const moveExercise = (index: number, direction: "up" | "down") => {
    if (!activeSession || sessionIndex === -1 || !activeSession.exercises) return;
    const exercises = [...activeSession.exercises];

    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === exercises.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const [movedExercise] = exercises.splice(index, 1);
    exercises.splice(targetIndex, 0, movedExercise);

    const newData = { ...tData };
    newData.sessions[sessionIndex].exercises = exercises;
    setTData(newData);
  };

  const removeExercise = (exIndex: number) => {
    if (!activeSession || sessionIndex === -1 || !activeSession.exercises) return;
    const exercises = [...activeSession.exercises];
    exercises.splice(exIndex, 1);
    const newData = { ...tData };
    newData.sessions[sessionIndex].exercises = exercises;
    setTData(newData);
  };

  const updateExercise = (exIndex: number, updates: any) => {
    if (!activeSession || sessionIndex === -1 || !activeSession.exercises) return;
    const exercises = [...activeSession.exercises];
    exercises[exIndex] = { ...exercises[exIndex], ...updates };
    const newData = { ...tData };
    newData.sessions[sessionIndex].exercises = exercises;
    setTData(newData);
  };

  const addSet = (exIndex: number) => {
    if (!activeSession || sessionIndex === -1 || !activeSession.exercises) return;
    const exercises = [...activeSession.exercises];
    const ex = exercises[exIndex];
    const newSet = ex.sets?.length > 0
        ? { ...ex.sets[ex.sets.length - 1], weight: 0 }
        : { reps: 10, weight: 0 };

    exercises[exIndex] = { ...ex, sets: [...(ex.sets || []), newSet] };
    const newData = { ...tData };
    newData.sessions[sessionIndex].exercises = exercises;
    setTData(newData);
  };

  const updateSet = (exIndex: number, setIndex: number, updates: any) => {
    if (!activeSession || sessionIndex === -1 || !activeSession.exercises) return;
    const exercises = [...activeSession.exercises];
    const ex = exercises[exIndex];
    if (!ex.sets) return;
    
    const updatedSets = [...ex.sets];
    updatedSets[setIndex] = { ...updatedSets[setIndex], ...updates };
    exercises[exIndex] = { ...ex, sets: updatedSets };
    
    const newData = { ...tData };
    newData.sessions[sessionIndex].exercises = exercises;
    setTData(newData);
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    if (!activeSession || sessionIndex === -1 || !activeSession.exercises) return;
    const exercises = [...activeSession.exercises];
    const ex = exercises[exIndex];
    if (!ex.sets || ex.sets.length <= 1) return;
    
    const updatedSets = [...ex.sets];
    updatedSets.splice(setIndex, 1);
    exercises[exIndex] = { ...ex, sets: updatedSets };
    
    const newData = { ...tData };
    newData.sessions[sessionIndex].exercises = exercises;
    setTData(newData);
  };

  const filteredBank = bankExercises.filter((ex) => {
    const matchesSearch = ex.name?.toLowerCase().includes(bankSearch.toLowerCase()) || 
                          ex.primary_muscle?.toLowerCase().includes(bankSearch.toLowerCase());
    const matchesFilter = bankFilter === "Todos" || ex.primary_muscle === bankFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col bg-slate-50 min-h-screen rounded-[2.5rem] overflow-hidden border-4 border-[#004D71]/5 pb-32">
      {/* Header */}
      <div className="px-6 py-6 flex flex-col md:flex-row md:items-center justify-between border-b-4 border-[#004D71]/5 bg-white z-20 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors text-[#004D71]">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-[#004D71] uppercase truncate max-w-xs md:max-w-md">
              {template.name}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Editor Avançado de Template
            </p>
          </div>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="h-14 px-8 rounded-2xl bg-[#004D71] text-[#F7B500] font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={18} />
          {isSaving ? "A Guardar..." : "Guardar Plano"}
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4 bg-white border-b-4 border-[#004D71]/5 overflow-x-auto custom-scrollbar flex gap-2">
        {tData.sessions?.map((session: any, idx: number) => {
          const isActive = activeTab === session.day_label;
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(session.day_label)}
              className={`h-12 min-w-[4rem] px-6 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                isActive ? "bg-[#F7B500] text-[#004D71] shadow-lg shadow-[#F7B500]/20 scale-105" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-[#004D71]"
              }`}
            >
              {session.day_label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {activeSession && (
          <div className="max-w-3xl mx-auto w-full">
            <div className="bg-white rounded-[2rem] p-6 border-4 border-[#004D71]/5 mb-6">
               <input
                 type="text"
                 value={activeSession.title || ''}
                 onChange={(e) => {
                    const newData = {...tData};
                    newData.sessions[sessionIndex].title = e.target.value;
                    setTData(newData);
                 }}
                 className="w-full text-xl font-black text-[#004D71] uppercase bg-transparent border-none outline-none placeholder:text-slate-300"
                 placeholder="Nome do Treino (ex: Dorsal e Bíceps)"
               />
            </div>

            {(!activeSession.exercises || activeSession.exercises.length === 0) && (
              <div className="text-center py-16 px-6 border-4 border-dashed border-[#004D71]/10 rounded-[2.5rem] bg-white">
                <div className="w-16 h-16 mx-auto bg-slate-50 text-[#004D71] rounded-2xl flex items-center justify-center mb-4">
                  <Plus size={32} />
                </div>
                <h3 className="text-lg font-black text-[#004D71] uppercase mb-1">Dia Vazio</h3>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Adicione exercícios ou grupos musculares.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {activeSession.exercises?.map((ex: any, exIndex: number) => (
                <div key={exIndex} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {ex.isHeader ? (
                    <div className="flex items-center justify-between mt-8 border-b-4 border-[#004D71] pb-2 gap-2">
                      <div className="flex flex-col -space-y-2 mr-2">
                        <button onClick={() => moveExercise(exIndex, "up")} className="text-slate-300 hover:text-[#004D71] transition-colors"><ArrowUp size={20}/></button>
                        <button onClick={() => moveExercise(exIndex, "down")} className="text-slate-300 hover:text-[#004D71] transition-colors"><ArrowDown size={20}/></button>
                      </div>
                      <input
                        type="text"
                        value={ex.name}
                        onChange={(e) => updateExercise(exIndex, { name: e.target.value.toUpperCase() })}
                        className="w-full bg-transparent text-[#004D71] font-black text-lg uppercase tracking-widest outline-none"
                      />
                      <button onClick={() => removeExercise(exIndex)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className={`bg-white rounded-[2rem] p-5 relative border-4 transition-all ${ex.isSuperset ? "border-[#F7B500] shadow-xl mb-8" : "border-[#004D71]/5"}`}>
                      {ex.isSuperset && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                          <div className="h-4 w-1 bg-[#F7B500]"></div>
                          <div className="px-3 py-1 rounded-xl bg-[#F7B500] text-[#004D71] text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                            <Link size={12} /> Supersérie
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 mb-6">
                        <div className="flex flex-col -space-y-2 shrink-0">
                          <button onClick={() => moveExercise(exIndex, "up")} className="text-slate-300 hover:text-[#004D71] transition-colors"><ArrowUp size={20}/></button>
                          <button onClick={() => moveExercise(exIndex, "down")} className="text-slate-300 hover:text-[#004D71] transition-colors"><ArrowDown size={20}/></button>
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={ex.name}
                            onChange={(e) => updateExercise(exIndex, { name: e.target.value })}
                            className="w-full font-black text-[#004D71] text-base uppercase bg-transparent outline-none truncate"
                            placeholder="Nome do Exercício"
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                           <button onClick={() => updateExercise(exIndex, { isSuperset: !ex.isSuperset })} className={`p-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all ${ex.isSuperset ? 'bg-[#F7B500] text-[#004D71]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                              <Link size={14}/> SS
                           </button>
                           <button onClick={() => removeExercise(exIndex)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                              <Trash2 size={18} />
                           </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {ex.sets?.map((set: any, setIndex: number) => (
                          <div key={setIndex} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border-2 border-slate-100">
                            <span className="w-6 text-center text-[10px] font-black text-slate-400 uppercase">{setIndex + 1}</span>
                            <div className="flex-1 flex gap-2">
                              <div className="flex-1 h-10 bg-white rounded-lg flex items-center px-3 gap-2 shadow-sm">
                                <input
                                  type="number"
                                  value={set.reps || ''}
                                  onChange={(e) => updateSet(exIndex, setIndex, { reps: parseInt(e.target.value) })}
                                  className="w-full bg-transparent font-black text-[#004D71] text-sm outline-none text-center"
                                  placeholder="0"
                                />
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Reps</span>
                              </div>
                              <div className="flex-1 h-10 bg-white rounded-lg flex items-center px-3 gap-2 shadow-sm">
                                <input
                                  type="number"
                                  value={set.weight || ''}
                                  onChange={(e) => updateSet(exIndex, setIndex, { weight: parseFloat(e.target.value) })}
                                  className="w-full bg-transparent font-black text-[#004D71] text-sm outline-none text-center"
                                  placeholder="0"
                                />
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kg</span>
                              </div>
                            </div>
                            <button onClick={() => removeSet(exIndex, setIndex)} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <button onClick={() => addSet(exIndex)} className="w-full mt-4 h-12 border-2 border-dashed border-[#004D71]/20 rounded-xl text-[10px] font-black text-[#004D71]/50 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#004D71]/5 transition-colors">
                        <Plus size={16} /> Adicionar Série
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FIXED ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent z-30 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="flex gap-2 bg-white p-2 rounded-[2rem] border-4 border-[#004D71]/5 shadow-2xl">
            <button onClick={() => setShowGroupModal(true)} className="flex-1 h-14 bg-slate-50 text-[#004D71] rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 flex items-center justify-center gap-2 transition-colors">
              <View size={18} /> Grupo
            </button>
            <button onClick={() => setShowBankModal(true)} className="flex-[2] h-14 bg-[#004D71] text-[#F7B500] rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 transition-all">
              <Plus size={18} /> Exercício
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: ADD EXERCISE */}
      {showBankModal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-[#004D71]/80 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md h-[85vh] md:h-[80vh] rounded-[2.5rem] p-6 shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-8">
            <button onClick={() => setShowBankModal(false)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 hover:text-[#004D71] rounded-2xl shadow-xl z-10"><X size={20}/></button>
            
            <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter mb-4">Catálogo</h2>
            
            <div className="space-y-3 mb-4 shrink-0">
              <div className="relative">
                <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="w-full bg-slate-50 text-[#004D71] text-xs font-black uppercase tracking-widest py-4 px-4 rounded-2xl border-4 border-[#004D71]/5 focus:border-[#F7B500]/50 outline-none appearance-none">
                  <option value="Todos">TODOS OS GRUPOS</option>
                  {MUSCLE_GROUPS.map((group) => <option key={group} value={group}>{group.toUpperCase()}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#004D71]/50 pointer-events-none" size={18} />
              </div>

              <div className="bg-slate-50 rounded-2xl flex items-center px-4 h-14 border-4 border-[#004D71]/5 focus-within:border-[#F7B500]/50 transition-colors">
                <Search className="text-[#004D71]/50 mr-3" size={20} />
                <input
                  type="text"
                  placeholder="Procurar Exercício..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="bg-transparent text-[#004D71] w-full outline-none font-black uppercase text-xs placeholder:text-[#004D71]/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar pb-20">
              {filteredBank.map((ex) => (
                <button key={ex.id} onClick={() => addExercise(ex.name, ex.type === "CARDIO" ? "CARDIO" : "STRENGTH", ex.id)} className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 rounded-2xl border-2 border-slate-100 group transition-all text-left">
                  <div>
                    <h3 className="font-black text-[#004D71] text-sm uppercase leading-tight">{ex.name}</h3>
                    <div className="flex gap-2 mt-2">
                       <span className="text-[9px] bg-slate-100 text-slate-500 font-black px-2 py-1 uppercase tracking-widest rounded-lg">
                         {ex.primary_muscle || (ex.type === "CARDIO" ? "Cárdio" : "Força")}
                       </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 text-[#004D71] flex items-center justify-center group-hover:bg-[#004D71] group-hover:text-[#F7B500] transition-colors">
                     <Plus size={18} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD GROUP */}
      {showGroupModal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-[#004D71]/80 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-8">
            <button onClick={() => setShowGroupModal(false)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 hover:text-[#004D71] rounded-2xl shadow-xl z-10"><X size={20}/></button>
            <h2 className="text-xl font-black text-[#004D71] uppercase tracking-tighter mb-6">Grupo Muscular</h2>
            <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pb-8 pr-2">
              {MUSCLE_GROUPS.map((group) => (
                <button key={group} onClick={() => addHeader(group.toUpperCase())} className="py-4 px-2 bg-slate-50 hover:bg-[#004D71] hover:text-[#F7B500] rounded-xl text-[10px] font-black text-[#004D71] uppercase tracking-widest transition-all text-center">
                  {group}
                </button>
              ))}
              <button onClick={() => addHeader("NOVO GRUPO")} className="py-4 px-2 bg-white border-2 border-dashed border-[#004D71]/20 rounded-xl text-[10px] font-black text-[#004D71]/50 uppercase tracking-widest hover:border-[#004D71]/50 hover:text-[#004D71] transition-all text-center">
                Outro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

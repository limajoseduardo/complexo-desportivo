import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, ChevronRight, Bookmark, Search, Filter, BookOpen, X, Plus, Check } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { collection, onSnapshot, query, where, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, Exercicio, WorkoutSession } from '../types';
import { ExerciseGallery } from './Exercises';

export function UtenteTrainingModule({ user }: { user: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'plano' | 'biblioteca'>('plano');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selectedSessionIdx, setSelectedSessionIdx] = useState<number>(0);
  const [exercises, setExercises] = useState<Exercicio[]>([]);
  const [showRequest, setShowRequest] = useState(false);
  const [professors, setProfessors] = useState<UserProfile[]>([]);
  const [selectedProf, setSelectedProf] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [trainingLogs, setTrainingLogs] = useState<Record<string, {weight: number, reps: number, done: boolean}[]>>(user.treino_logs || {});

  const saveTrainingLogs = async (newLogs: typeof trainingLogs) => {
    try {
      await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, user.id), {
        treino_logs: newLogs
      });
    } catch (e) {
      console.error('Failed to save training log:', e);
    }
  };

  const updateLog = (exId: string, seriesIdx: number, field: string, value: any, targetReps: number) => {
    setTrainingLogs(prev => {
      const next = { ...prev };
      if (!next[exId]) {
        // Inicializa se vazio, adivinhando num de séries baseadas em targetReps (mock seguro)
        next[exId] = Array(10).fill(null).map(() => ({ weight: 0, reps: targetReps, done: false }));
      }
      const currentArr = [...next[exId]];
      currentArr[seriesIdx] = { ...currentArr[seriesIdx], [field]: value };
      next[exId] = currentArr;
      
      // Auto-save
      saveTrainingLogs(next);
      return next;
    });
  };

  useEffect(() => {
    const treinosPath = `artifacts/${APP_ID}/public/data/treinos_assigned`;
    const unsub = onSnapshot(query(collection(db, treinosPath), where('assignedStudentId', '==', user.id)), (snap) => {
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutSession));
      // Sort sessions by title alphabetically (e.g. Treino A, Treino B)
      loaded.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
      setSessions(loaded);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, treinosPath);
    });

    const usersPath = `artifacts/${APP_ID}/public/data/users`;
    const unsubProfs = onSnapshot(query(collection(db, usersPath), where('role', '==', 'professor')), (snap) => {
      setProfessors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, usersPath);
    });

    const exPath = `artifacts/${APP_ID}/public/data/exercicios`;
    const unsubEx = onSnapshot(collection(db, exPath), (snap) => {
      setExercises(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercicio)));
    }, (error) => {
      console.warn("Error fetching exercises:", error);
    });

    return () => { unsub(); unsubProfs(); unsubEx(); };
  }, [user.id]);

  const handleRequestPlan = async () => {
    if (!selectedProf) return;
    setLoading(true);
    try {
      // Find the professor profile
      const prof = professors.find(p => p.id === selectedProf);
      if (!prof) return;

      const chatId = [user.id, prof.id].sort().join('_');
      const chatPath = `artifacts/${APP_ID}/public/data/conversas/${chatId}/messages`;
      
      await addDoc(collection(db, chatPath), {
        senderId: user.id,
        senderEmail: user.email,
        receiverId: prof.id,
        receiverEmail: prof.email,
        participants: [user.id, prof.id],
        participantEmails: [user.email, prof.email],
        text: `🏋️‍♂️ [PEDIDO DE PLANO]: Olá Professor! Gostaria de solicitar um novo plano de treino personalizado. Quando puder, por favor verifique o meu perfil.`,
        createdAt: Timestamp.now(),
        read: false
      });
      setShowRequest(false);
      alert("Pedido enviado com sucesso para o Professor!");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24 text-left font-sans">
      <div className="bg-white rounded-[2.5rem] p-4 flex gap-2 border-4 border-[#004D71]/5 sticky top-0 z-10">
        <button 
          onClick={() => setActiveTab('plano')}
          className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'plano' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Dumbbell size={18}/> O Meu Plano
        </button>
        <button 
          onClick={() => setActiveTab('biblioteca')}
          className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'biblioteca' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <BookOpen size={18}/> Biblioteca
        </button>
      </div>

      {activeTab === 'plano' && (
        <div className="space-y-6">
          <div className="px-1 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Missão de Hoje</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Siga o seu plano prescrito pelos professores</p>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-white rounded-[3rem] p-12 text-center border-4 border-[#004D71]/5 shadow-sm">
              <div className="w-20 h-20 bg-[#004D71]/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Dumbbell size={40} className="text-[#004D71]/20" />
              </div>
              <h3 className="font-black text-[#004D71] uppercase text-xl mb-4">Sem plano ativo</h3>
              <p className="text-xs text-slate-400 mb-8 font-medium">Você ainda não tem um plano de treino prescrito. Escolha um professor para começar!</p>
              <button 
                onClick={() => setShowRequest(true)}
                className="bg-[#004D71] text-[#F7B500] px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 mx-auto active:scale-95 transition-all hover:shadow-2xl hover:-translate-y-1"
              >
                Solicitar Plano Agora
              </button>
            </div>
          ) : (
            <div className="space-y-4">
               {/* Seletor de Sessões (ex: Treino A, Treino B) */}
               <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                 {sessions.map((session, sIdx) => (
                    <button 
                       key={sIdx}
                       onClick={() => setSelectedSessionIdx(sIdx)}
                       className={`px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap shrink-0 border-2 ${selectedSessionIdx === sIdx ? 'bg-[#004D71] text-[#F7B500] border-[#004D71] shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-[#004D71]/20'}`}
                    >
                       {session.title || `Treino ${sIdx + 1}`}
                    </button>
                 ))}
               </div>

               {sessions[selectedSessionIdx]?.exercises?.map((ex: any, idx: number) => {
                 // Try to match with existing library to get video/group
                 const matchedEx = exercises.find(e => e.nomePT?.toLowerCase() === ex.name?.toLowerCase() || e.id === ex.name);
                 const name = ex.name;
                 const desc = matchedEx ? matchedEx.desc : '';
                 const link = matchedEx ? matchedEx.link : '';
                 
                 const numSeries = ex.sets?.length || 1;
                 const targetReps = ex.sets?.[0]?.reps || 0;
                 const seriesArray = ex.sets || [];
                 // Save logs using session ID + exercise index to avoid collisions
                 const logKey = `${sessions[selectedSessionIdx].id}_${idx}`;
                 const exLogs = trainingLogs[logKey] || Array(numSeries).fill({ weight: 0, reps: targetReps, done: false });

                 return (
                   <div key={idx} className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm group hover:border-[#F7B500]/20 transition-all">
                      <div className="flex items-start gap-5">
                         <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 text-[#004D71] font-black text-xl border-2 border-slate-100 self-center">{idx + 1}</div>
                         <div className="flex-1 min-w-0">
                            <h4 className="font-black text-[#004D71] uppercase text-sm truncate">{name}</h4>
                            {matchedEx && (
                              <p className="text-[8px] font-black text-[#F7B500] uppercase tracking-wider mb-1">{matchedEx.grupo}</p>
                            )}
                            {desc && (
                              <p className="text-[10px] text-slate-400 font-medium mb-3 leading-relaxed line-clamp-2">{desc}</p>
                            )}
                            <div className="flex gap-3 overflow-x-auto pb-1">
                               <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shrink-0">
                                  <span className="text-[8px] font-black text-slate-400 block uppercase mb-0.5">Séries</span>
                                  <span className="text-xs font-black text-[#004D71]">{numSeries}</span>
                               </div>
                            </div>
                         </div>
                         {link ? (
                           <a 
                             href={link} 
                             target="_blank" 
                             rel="noopener noreferrer" 
                             className="p-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl transition-all shrink-0 flex items-center justify-center self-center"
                             title="Ver Execução no YouTube"
                           >
                             <Play size={20} fill="currentColor" />
                           </a>
                         ) : (
                           <button 
                             disabled 
                             className="p-4 bg-slate-50 rounded-2xl text-slate-200 shrink-0 cursor-not-allowed self-center"
                             title="Sem vídeo disponível"
                           >
                             <Play size={20} />
                           </button>
                         )}
                       </div>

                       {/* INTERACTIVE SERIES DIARY */}
                       <div className="mt-5 space-y-2 border-t-2 border-slate-50 pt-4">
                         {seriesArray.map((setInfo: any, sIdx: number) => {
                           const currentLog = exLogs[sIdx] || { weight: setInfo.weight || 0, reps: setInfo.reps || 0, done: false };
                           return (
                             <div key={sIdx} className={`flex items-center gap-3 p-3 rounded-[1.2rem] border-2 transition-all ${currentLog.done ? 'bg-green-50/50 border-green-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-[#004D71]/20'}`}>
                                <div className={`w-6 font-black text-[10px] ${currentLog.done ? 'text-green-600' : 'text-slate-400'}`}>#{sIdx + 1}</div>
                                <div className="flex-1 flex items-center gap-2">
                                   <input 
                                      type="number" 
                                      value={currentLog.weight || ''} 
                                      onChange={e => updateLog(logKey, sIdx, 'weight', Number(e.target.value), setInfo.reps)}
                                      className="w-12 bg-white border-2 border-slate-200/50 rounded-xl px-2 py-2 text-[11px] font-black text-[#004D71] text-center focus:border-[#F7B500] outline-none transition-colors placeholder:text-slate-200"
                                      placeholder="-"
                                   />
                                   <span className="text-[9px] font-black text-slate-400 uppercase">Kg</span>
                                   
                                   <input 
                                      type="number" 
                                      value={currentLog.reps || ''} 
                                      onChange={e => updateLog(logKey, sIdx, 'reps', Number(e.target.value), setInfo.reps)}
                                      className="w-12 bg-white border-2 border-slate-200/50 rounded-xl px-2 py-2 text-[11px] font-black text-[#004D71] text-center focus:border-[#F7B500] outline-none transition-colors placeholder:text-slate-200 ml-2"
                                      placeholder="-"
                                   />
                                   <span className="text-[9px] font-black text-slate-400 uppercase">Reps</span>
                                </div>
                                <button 
                                  onClick={() => updateLog(logKey, sIdx, 'done', !currentLog.done, setInfo.reps)}
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90 ${currentLog.done ? 'bg-green-500 text-white shadow-md shadow-green-500/20 scale-105' : 'bg-white border-2 border-slate-200 text-slate-300 hover:text-slate-400'}`}>
                                  <Check size={18} strokeWidth={currentLog.done ? 3 : 2} />
                                </button>
                             </div>
                           );
                         })}
                       </div>

                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'biblioteca' && (
        <ExerciseGallery user={user} />
      )}

      {showRequest && (
        <div className="fixed inset-0 z-[100000] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative">
              <button onClick={() => setShowRequest(false)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl active:scale-90"><X size={20}/></button>
              
              <div className="text-center mb-8">
                 <div className="w-20 h-20 bg-blue-50 text-[#004D71] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Dumbbell size={40}/>
                 </div>
                 <h3 className="text-xl font-black text-[#004D71] uppercase leading-none">Pedir Novo Plano</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Escolha o seu professor favorito</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Escolha o Professor</label>
                  <select 
                    value={selectedProf}
                    onChange={(e) => setSelectedProf(e.target.value)}
                    className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-6 py-4 font-black text-xs uppercase text-[#004D71] outline-none appearance-none cursor-pointer focus:border-[#F7B500]/30 transition-all"
                  >
                    <option value="">Selecione um professor...</option>
                    {professors.map(p => (
                      <option key={p.id} value={p.id}>{p.n || p.nome} ({p.cargo || 'Professor'})</option>
                    ))}
                  </select>
                </div>

                {selectedProf && (
                  <div className="bg-[#004D71]/5 p-4 rounded-2xl border-2 border-dashed border-[#004D71]/10 animate-in fade-in slide-in-from-top-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Mensagem a enviar:</p>
                    <p className="text-[11px] font-black text-[#004D71] italic leading-relaxed">
                      "Olá Professor! Gostaria de solicitar um novo plano de treino personalizado. Quando puder, por favor verifique o meu perfil."
                    </p>
                  </div>
                )}
              </div>

              <button 
                onClick={handleRequestPlan}
                disabled={loading || !selectedProf}
                className="w-full bg-[#004D71] text-[#F7B500] rounded-2xl py-5 font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'A Enviar...' : 'Confirmar Pedido'}
              </button>
           </div>
        </div>
      )}

       {/* Floating Button for QR Scanner */}
       <div className="fixed bottom-24 right-4 z-[90]">
         <button onClick={() => setShowQRScanner(true)} className="bg-[#004D71] text-[#F7B500] w-14 h-14 rounded-[1.5rem] shadow-2xl flex items-center justify-center active:scale-90 transition-all border-4 border-white/20 backdrop-blur-md hover:bg-[#003855] group">
           <Search size={22} className="group-hover:scale-110 transition-transform"/>
         </button>
       </div>

       {/* Mock QR Scanner Modal */}
       {showQRScanner && (
         <div className="fixed inset-0 z-[100000] bg-[#004D71]/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative">
              <button onClick={() => setShowQRScanner(false)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl active:scale-90"><X size={20}/></button>
              
              <div className="text-center mb-6">
                 <div className="w-24 h-24 bg-slate-50 border-4 border-dashed border-slate-200 text-slate-300 rounded-[2rem] flex items-center justify-center mx-auto mb-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[#F7B500]/10 animate-pulse"></div>
                    <Search size={32}/>
                 </div>
                 <h3 className="text-xl font-black text-[#004D71] uppercase leading-none">Simulador de QR Code</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 leading-relaxed">
                   Imagine que leu o QR Code físico da máquina do ginásio. Insira o nome abaixo.
                 </p>
              </div>

              <input 
                type="text" 
                value={scannedCode}
                onChange={e => setScannedCode(e.target.value)}
                placeholder="Ex: Leg Press"
                className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 text-center font-black uppercase text-sm focus:border-[#F7B500] outline-none mb-4"
              />

              <button 
                onClick={() => {
                  alert(`Redirecionando para as instruções de: ${scannedCode || 'Desconhecido'}`);
                  setShowQRScanner(false);
                }}
                className="w-full bg-[#F7B500] text-[#004D71] p-5 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                Simular Leitura
              </button>
           </div>
         </div>
       )}
    </div>
  );
}

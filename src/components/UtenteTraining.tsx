import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, ChevronRight, Bookmark, Search, Filter, BookOpen, X, Plus } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { collection, onSnapshot, query, where, addDoc, Timestamp } from 'firebase/firestore';
import { UserProfile, TreinoPlano, Exercicio } from '../types';
import { ExerciseGallery } from './Exercises';

export function UtenteTrainingModule({ user }: { user: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'plano' | 'biblioteca'>('plano');
  const [plan, setPlan] = useState<TreinoPlano | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [professors, setProfessors] = useState<UserProfile[]>([]);
  const [selectedProf, setSelectedProf] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const treinosPath = `artifacts/${APP_ID}/public/data/treinos`;
    const unsub = onSnapshot(query(collection(db, treinosPath), where('userId', '==', user.id)), (snap) => {
      if (!snap.empty) {
        setPlan({ id: snap.docs[0].id, ...snap.docs[0].data() } as TreinoPlano);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, treinosPath);
    });

    const usersPath = `artifacts/${APP_ID}/public/data/users`;
    const unsubProfs = onSnapshot(query(collection(db, usersPath), where('role', '==', 'professor')), (snap) => {
      setProfessors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, usersPath);
    });

    return () => { unsub(); unsubProfs(); };
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

          {!plan ? (
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
               {plan.exercicios.map((ex, idx) => (
                 <div key={idx} className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm group hover:border-[#F7B500]/20 transition-all">
                    <div className="flex items-center gap-5">
                       <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 text-[#004D71] font-black text-xl border-2 border-slate-100">{idx + 1}</div>
                       <div className="flex-1 min-w-0">
                          <h4 className="font-black text-[#004D71] uppercase text-sm mb-2 truncate">{ex.exercicioId}</h4>
                          <div className="flex gap-3 overflow-x-auto pb-1">
                             <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shrink-0">
                                <span className="text-[8px] font-black text-slate-400 block uppercase mb-0.5">Séries</span>
                                <span className="text-xs font-black text-[#004D71]">{ex.series}</span>
                             </div>
                             <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shrink-0">
                                <span className="text-[8px] font-black text-slate-400 block uppercase mb-0.5">Reps</span>
                                <span className="text-xs font-black text-[#004D71]">{ex.reps}</span>
                             </div>
                             <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shrink-0">
                                <span className="text-[8px] font-black text-slate-400 block uppercase mb-0.5">Pause</span>
                                <span className="text-xs font-black text-[#F7B500]">{ex.descanso}</span>
                             </div>
                          </div>
                       </div>
                       <button className="p-4 bg-slate-50 rounded-2xl text-slate-300 group-hover:bg-[#F7B500] group-hover:text-[#004D71] transition-all shrink-0">
                          <Play size={20} />
                       </button>
                    </div>
                 </div>
               ))}
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
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Plus, MessageSquare, CheckCircle2, ChevronRight, Apple, History, Scale } from 'lucide-react';
import { db } from '../lib/firebase';
import { APP_ID } from '../App';
import { collection, onSnapshot, query, where, addDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { UserProfile, Refeicao } from '../types';

export function NutritionModule({ user }: { user: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'plano' | 'registo' | 'historico'>('plano');
  const [meals, setMeals] = useState<Refeicao[]>([]);
  const [newMeal, setNewMeal] = useState({ nome: '', alimentos: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, `artifacts/${APP_ID}/public/data/refeicoes`), 
      where('userId', '==', user.id),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMeals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Refeicao)));
    });
    return () => unsub();
  }, [user.id]);

  const handleLogMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeal.nome || !newMeal.alimentos) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `artifacts/${APP_ID}/public/data/refeicoes`), {
        userId: user.id,
        nome: newMeal.nome,
        alimentos: newMeal.alimentos,
        timestamp: Timestamp.now()
      });
      setNewMeal({ nome: '', alimentos: '' });
      setActiveTab('historico');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24 text-left font-sans">
      <div className="bg-white rounded-[2.5rem] p-4 flex gap-2 border-4 border-[#004D71]/5 sticky top-0 z-10 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab('plano')}
          className={`px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'plano' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Apple size={18}/> Plano Alimentar
        </button>
        <button 
          onClick={() => setActiveTab('registo')}
          className={`px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'registo' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Plus size={18}/> Registar Refeição
        </button>
        <button 
          onClick={() => setActiveTab('historico')}
          className={`px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'historico' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <History size={18}/> Diário de Bordo
        </button>
      </div>

      {activeTab === 'plano' && (
        <div className="space-y-6">
           <div className="px-1 text-center py-12 bg-white rounded-[3rem] border-4 border-[#004D71]/5">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <UtensilsCrossed size={40} className="text-[#F7B500]" />
              </div>
              <h3 className="font-black text-[#004D71] uppercase text-xl mb-2">Plano de Nutrição</h3>
              <p className="text-slate-400 text-sm font-bold uppercase text-[10px] tracking-widest max-w-[250px] mx-auto leading-relaxed">
                O seu plano alimentar oficial, prescrito pela nutricionista municipal, aparecerá aqui.
              </p>
           </div>
        </div>
      )}

      {activeTab === 'registo' && (
        <form onSubmit={handleLogMeal} className="bg-white rounded-[3rem] p-8 border-4 border-[#004D71]/5 shadow-sm space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Momento da Refeição</label>
            <select 
              value={newMeal.nome}
              onChange={e => setNewMeal({...newMeal, nome: e.target.value})}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-xs text-[#004D71] outline-none focus:border-[#F7B500]"
            >
              <option value="">Selecione...</option>
              <option value="Pequeno-Almoço">Pequeno-Almoço</option>
              <option value="Meio da Manhã">Meio da Manhã</option>
              <option value="Almoço">Almoço</option>
              <option value="Lanche">Lanche</option>
              <option value="Jantar">Jantar</option>
              <option value="Ceia">Ceia</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">O que comeu?</label>
            <textarea 
              value={newMeal.alimentos}
              onChange={e => setNewMeal({...newMeal, alimentos: e.target.value})}
              placeholder="Ex: 2 ovos mexidos, 1 torrada de pão integral, café sem açúcar..."
              rows={4}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-xs text-[#004D71] outline-none focus:border-[#F7B500] resize-none"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#004D71] text-[#F7B500] rounded-2xl py-4 font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {loading ? 'A registar...' : <><Plus size={18}/> Submeter para Parecer</>}
          </button>
          <p className="text-[8px] font-black text-slate-400 uppercase text-center leading-relaxed px-4">
            Após submeter, os seus professores receberão uma notificação para analisar a sua refeição e dar feedback.
          </p>
        </form>
      )}

      {activeTab === 'historico' && (
        <div className="space-y-4">
           {meals.map(m => (
             <div key={m.id} className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm overflow-hidden relative">
                <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-xl text-[#004D71]">
                        <UtensilsCrossed size={16}/>
                      </div>
                      <div>
                        <h4 className="font-black text-[#004D71] uppercase text-xs">{m.nome}</h4>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{m.timestamp?.toDate().toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                   </div>
                   {m.feedback ? (
                     <div className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-[8px] font-black uppercase flex items-center gap-1.5 ring-1 ring-green-100">
                        <CheckCircle2 size={10}/> Parecer Recebido
                     </div>
                   ) : (
                     <div className="bg-slate-50 text-slate-400 px-3 py-1 rounded-full text-[8px] font-black uppercase ring-1 ring-slate-100">
                        Em análise...
                     </div>
                   )}
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
                   <p className="text-[10px] font-medium text-[#004D71] leading-relaxed italic">"{m.alimentos}"</p>
                </div>
                
                {m.feedback && (
                  <div className="bg-[#004D71] text-white p-5 rounded-2xl relative overflow-hidden">
                     <MessageSquare size={40} className="absolute -right-4 -bottom-4 opacity-10 rotate-12" />
                     <p className="text-[8px] font-black text-[#F7B500] uppercase tracking-widest mb-2 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-[#F7B500] rounded-full" /> Feedback do Professor
                     </p>
                     <p className="text-[10px] font-black leading-relaxed">{m.feedback}</p>
                     <p className="text-[7px] font-bold text-white/40 uppercase mt-2">Prof. {m.feedbackBy || 'Técnico Vila de Rei'}</p>
                  </div>
                )}
             </div>
           ))}
           {meals.length === 0 && (
             <div className="py-20 text-center text-slate-300">
                <History className="mx-auto mb-4 opacity-10" size={48} />
                <p className="uppercase font-black text-[10px] tracking-widest">Ainda sem registos no diário</p>
             </div>
           )}
        </div>
      )}
    </div>
  );
}

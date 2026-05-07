import React, { useState, useMemo } from 'react';
import { ClipboardList, Plus, X, Save, FileText } from 'lucide-react';
import { Timestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { FormInput } from './Common';

const APP_ID = 'cpx-vila-rei-main';

export function MapsManager({ user, logs }: { user: UserProfile, logs: any[] }) {
  const [activePool, setActivePool] = useState<'coberta' | 'descoberta'>('coberta'); 
  const [mode, setMode] = useState<'list' | 'form'>('list'); 
  const canAdd = ['staff', 'admin', 'professor'].includes(user?.role);
  const canView = user?.role === 'staff' || user?.role === 'admin' || user?.role === 'chefia' || user?.role === 'professor';

  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tecnico: user?.nome || user?.n || '',
    tempAgua: '', ph: '', clLivre: '', utaHum: ''
  });

  const saveEntry = async () => {
    if (!canAdd) {
      alert("Apenas Staff pode adicionar registos oficiais.");
      return;
    }
    try {
      const path = activePool === 'coberta' ? 'mapas_coberta' : 'mapas_descoberta';
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', path), {
        ...formData,
        timestamp: Timestamp.now(),
        tipo: activePool,
        tecnico: user?.nome || user?.n || ''
      });
      alert("Leitura registada com sucesso!");
      setMode('list');
    } catch (e) { console.error(e); }
  };

  const poolLogs = useMemo(() => logs.filter(l => l.tipo === activePool), [logs, activePool]);

  return (
    <div className="space-y-6 animate-in fade-in pb-24 px-2 text-left">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
          <ClipboardList className="text-[#F7B500]"/> Mapas Oficiais
        </h2>
        {canAdd && mode === 'list' && (
          <button onClick={() => setMode('form')} className="bg-[#004D71] text-[#F7B500] p-3 rounded-2xl shadow-lg active:scale-95">
            <Plus size={20}/>
          </button>
        )}
        {mode === 'form' && (
          <button onClick={() => setMode('list')} className="bg-slate-100 text-[#004D71] p-3 rounded-2xl active:scale-95">
            <X size={20}/>
          </button>
        )}
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
        <button onClick={() => setActivePool('coberta')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activePool === 'coberta' ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'text-slate-400'}`}>Coberta (UTA)</button>
        <button onClick={() => setActivePool('descoberta')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activePool === 'descoberta' ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'text-slate-400'}`}>Descoberta</button>
      </div>

      {mode === 'form' ? (
        <div className="bg-white rounded-[2.5rem] p-6 border-2 border-slate-50 shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <FormInput label="Data" type="date" value={formData.data} onChange={v => setFormData({...formData, data: v})} />
             <FormInput label="Hora" type="time" value={formData.hora} onChange={v => setFormData({...formData, hora: v})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <FormInput label="Cloro Livre" value={formData.clLivre} onChange={v => setFormData({...formData, clLivre: v})} />
             <FormInput label="Valor pH" value={formData.ph} onChange={v => setFormData({...formData, ph: v})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <FormInput label="Água (ºC)" value={formData.tempAgua} onChange={v => setFormData({...formData, tempAgua: v})} />
             <FormInput label="Humidade (%)" value={formData.utaHum} onChange={v => setFormData({...formData, utaHum: v})} />
          </div>
          <button onClick={saveEntry} className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
            <Save size={20}/> Gravar Registo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {poolLogs.map((log, i) => (
            <div key={i} className="bg-white rounded-[2rem] p-5 border-2 border-slate-50 shadow-sm">
               <div className="flex justify-between items-center mb-3 text-left">
                  <div className="text-left">
                    <p className="text-xs font-black text-[#004D71] uppercase">{log.data}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{log.hora} • {log.tecnico}</p>
                  </div>
                  <div className="bg-blue-50 text-[#004D71] px-3 py-1 rounded-full text-[8px] font-black uppercase">Validado</div>
               </div>
               <div className="grid grid-cols-4 gap-2 text-center border-t border-slate-50 pt-3">
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">Cloro</p><p className="text-xs font-black text-[#004D71]">{log.clLivre || '--'}</p></div>
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">pH</p><p className="text-xs font-black text-orange-600">{log.ph || '--'}</p></div>
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">Água</p><p className="text-xs font-black text-[#004D71]">{log.tempAgua || '--'}º</p></div>
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">UTA</p><p className="text-xs font-black text-[#004D71]">{log.utaHum || '--'}%</p></div>
               </div>
            </div>
          ))}
          {poolLogs.length === 0 && (
             <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/50">
                <FileText size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="font-black text-slate-300 uppercase text-[10px] tracking-widest">Aguardar registos</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}

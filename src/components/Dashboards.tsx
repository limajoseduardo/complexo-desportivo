import React, { useState, useEffect } from 'react';
import {
  Dumbbell, Waves, Sun, Flame, Users2,
  Droplets, ChevronRight, X,
  Scale, Activity, Plus, Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { PicotoIcon, AvatarImage } from './Common';
import { UserProfile, OperationalLog } from '../types';
import { APP_ID } from '../App';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { isUserInZone } from '../lib/logic';
import { collection, addDoc, query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp } from 'firebase/firestore';

export const ModalitiesDashboard = React.memo(({ onUserClick, logs, utentes }: { onUserClick: (u: UserProfile) => void, logs: OperationalLog[], utentes: UserProfile[] }) => {
  const latestCoberta = logs.find(l => l.tipo === 'coberta') || {} as OperationalLog;
  const latestDescoberta = logs.find(l => l.tipo === 'descoberta') || {} as OperationalLog;

  const [selected, setSelected] = useState<{label: string, target: string} | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const zones = React.useMemo(() => [
    { id: 'gym', label: "Ginásio", icon: <Dumbbell size={14}/>, target: "Ginásio" },
    { id: 'pool_in', label: "Piscina Coberta", icon: <Waves size={14}/>, target: "Coberta" },
    { id: 'pool_out', label: "Piscina Exterior", icon: <Sun size={14}/>, target: "Exterior" },
    { id: 'sauna', label: "Sauna", icon: <Flame size={14}/>, target: "Sauna" },
    { id: 'fit', label: "Aulas Grupo", icon: <Users2 size={14}/>, target: "Aula" }
  ], []);

  const zonesUsers = React.useMemo(() => {
    return zones.map(z => {
      const count = utentes.filter(u => isUserInZone(u, z.id)).length;
      return { ...z, count };
    });
  }, [utentes, zones]);

  const selectedUtentes = React.useMemo(() => {
    if (!selected) return [];
    const z = zones.find(zf => zf.label === selected.label);
    if (!z) return [];
    
    return utentes.filter(u => isUserInZone(u, z.id));
  }, [utentes, selected, zones]);

  const [showLogModal, setShowLogModal] = useState<'coberta' | 'descoberta' | null>(null);
  const [logForm, setLogForm] = useState({ tempAgua: '', ph: '', clLivre: '' });
  const [isSaving, setIsSaving] = useState(false);

  const saveOperationalLog = async () => {
    if (!showLogModal || !logForm.tempAgua) return;
    setIsSaving(true);
    try {
      const path = `artifacts/${APP_ID}/public/data/mapas_${showLogModal}`;
      const now = new Date();
      await addDoc(collection(db, path), {
        tempAgua: logForm.tempAgua,
        ph: logForm.ph,
        clLivre: logForm.clLivre,
        hora: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: now.toISOString().split('T')[0],
        timestamp: serverTimestamp()
      });
      setShowLogModal(null);
      setLogForm({ tempAgua: '', ph: '', clLivre: '' });
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, 'operational_logs');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24 px-2 text-left relative font-sans">
      <div className="bg-white p-5 rounded-[2.5rem] shadow-sm flex items-center justify-between overflow-hidden relative border-2 border-slate-100">
         <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Complexo Vila de Rei</p><h2 className="text-base font-black text-[#004D71] uppercase">{time.toLocaleDateString()}</h2></div>
         <div className="text-right font-mono font-black text-xl text-[#004D71]">{time.toLocaleTimeString()}</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
         {zonesUsers.map(m => (
           <button key={m.id} onClick={() => setSelected({label: m.label, target: m.target})} className="bg-white rounded-3xl p-4 border-2 border-[#004D71]/5 shadow-sm relative text-left active:scale-95 transition-all outline-none">
              <div className="flex items-center justify-between mb-3">
                 <div className="p-2.5 bg-[#004D71]/5 text-[#004D71] rounded-xl">{m.icon}</div>
                 <div className={`w-2 h-2 rounded-full ${m.count > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-200'}`} />
              </div>
              <h4 className="font-black text-[9px] text-slate-400 uppercase tracking-widest mb-0.5 line-clamp-1">{m.label}</h4>
              <p className="text-lg font-black text-[#004D71]">{m.count} <span className="text-[9px] opacity-40 uppercase">Presentes</span></p>
           </button>
         ))}
      </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border-2 border-[#004D71]/5 p-6 font-sans">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Droplets size={14} className="text-[#F7B500]"/> Monitorização em Tempo Real
              </h3>
              <div className="flex items-center gap-2">
                 <div className="text-[9px] font-black text-[#004D71] bg-slate-100 px-3 py-1 rounded-full uppercase">OFICIAL</div>
              </div>
           </div>
           
           <div className="space-y-6">
             {/* Piscina Coberta */}
             <div className="space-y-2">
               <div className="flex items-center justify-between px-1">
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                   <p className="text-[9px] font-black text-[#004D71] uppercase tracking-widest">Piscina de Dentro (Coberta)</p>
                 </div>
                 <div className="flex items-center gap-3">
                   {latestCoberta.hora && <span className="text-[8px] font-bold text-slate-400 uppercase">{latestCoberta.hora}</span>}
                   <button onClick={() => setShowLogModal('coberta')} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><Plus size={12}/></button>
                 </div>
               </div>
             <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col items-center">
                  <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Água</span>
                  <span className="text-[12px] font-black text-[#004D71]">{latestCoberta.tempAgua ? `${latestCoberta.tempAgua}ºC` : '---'}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col items-center">
                  <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">pH</span>
                  <span className="text-[12px] font-black text-orange-600">{latestCoberta.ph || '---'}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col items-center">
                  <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Cloro</span>
                  <span className="text-[12px] font-black text-blue-600">{latestCoberta.clLivre || '---'}</span>
                </div>
             </div>
           </div>

            {/* Piscina Exterior */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                  <p className="text-[9px] font-black text-[#004D71] uppercase tracking-widest">Piscina de Fora (Exterior)</p>
                </div>
                <div className="flex items-center gap-3">
                  {latestDescoberta.hora && <span className="text-[8px] font-bold text-slate-400 uppercase">{latestDescoberta.hora}</span>}
                  <button onClick={() => setShowLogModal('descoberta')} className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"><Plus size={12}/></button>
                </div>
              </div>
             <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col items-center">
                  <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Água</span>
                  <span className="text-[12px] font-black text-[#004D71]">{latestDescoberta.tempAgua ? `${latestDescoberta.tempAgua}ºC` : '---'}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col items-center">
                  <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">pH</span>
                  <span className="text-[12px] font-black text-orange-600">{latestDescoberta.ph || '---'}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col items-center">
                  <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Cloro</span>
                  <span className="text-[12px] font-black text-blue-600">{latestDescoberta.clLivre || '---'}</span>
                </div>
             </div>
           </div>
         </div>
      </div>

      {showLogModal && (
        <div className="fixed inset-0 z-[10001] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative">
              <button onClick={() => setShowLogModal(null)} className="absolute top-6 right-6 p-3 bg-slate-50 text-slate-400 rounded-xl active:scale-90"><X size={20}/></button>
              
              <div className="mb-8 text-center">
                 <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 ${showLogModal === 'coberta' ? 'bg-blue-50 text-blue-500' : 'bg-amber-50 text-amber-500'}`}>
                    <Droplets size={32} />
                 </div>
                 <h3 className="text-xl font-black text-[#004D71] uppercase">Novo Registo</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Piscina {showLogModal === 'coberta' ? 'Coberta' : 'Exterior'}</p>
              </div>

              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Temp. Água (ºC)</label>
                       <input 
                         type="number" 
                         step="0.1"
                         className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none focus:border-[#F7B500]/20 transition-all text-xs"
                         value={logForm.tempAgua}
                         onChange={e => setLogForm({...logForm, tempAgua: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-2">pH</label>
                       <input 
                         type="number" 
                         step="0.1"
                         className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none focus:border-[#F7B500]/20 transition-all text-xs"
                         value={logForm.ph}
                         onChange={e => setLogForm({...logForm, ph: e.target.value})}
                       />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Cloro Livre (mg/l)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none focus:border-[#F7B500]/20 transition-all text-xs"
                      value={logForm.clLivre}
                      onChange={e => setLogForm({...logForm, clLivre: e.target.value})}
                    />
                 </div>
                 
                 <button 
                   onClick={saveOperationalLog}
                   disabled={isSaving || !logForm.tempAgua}
                   className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {isSaving ? 'A Guardar...' : <><Check size={18}/> Guardar Registo</>}
                 </button>
              </div>
           </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-100">
                 <div>
                    <h3 className="text-xl font-black text-[#004D71] uppercase">{selected.label}</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Lista de Utentes Presentes</p>
                 </div>
                 <button onClick={() => setSelected(null)} className="p-3 bg-slate-100 rounded-2xl active:scale-90 text-slate-400"><X size={20}/></button>
              </div>
              <div className="space-y-3 max-h-[50dvh] overflow-y-auto pr-2 hide-scrollbar">
                 {selectedUtentes.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                       <div className="flex items-center gap-4">
                          <div className="relative">
                            <AvatarImage src={u.img} alt={u.n || u.nome} className={`w-12 h-12 rounded-xl border-2 shadow-sm ${u.isInside ? 'border-green-500' : 'border-white'}`} />
                            {u.isInside && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm" />}
                          </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-black text-[#004D71] text-sm uppercase leading-none">{u.n || u.nome}</p>
                                {u.isInside && <span className="bg-green-100 text-green-700 text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase">{u.location}</span>}
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{u.modalidade || 'Acesso Livre'}</p>
                            </div>
                       </div>
                       <button onClick={() => { onUserClick(u); setSelected(null); }} className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-[#F7B500] hover:scale-110 transition-transform">
                          <ChevronRight size={16}/>
                       </button>
                    </div>
                 ))}
                 {selectedUtentes.length === 0 && (
                    <div className="py-20 text-center text-slate-300">
                       <PicotoIcon className="mx-auto mb-4 opacity-10" size={60} />
                       <p className="uppercase font-black text-[10px] tracking-widest">Vazio de momento</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
});

const MODALITIES = [
  { id: 'pool_in',  label: 'Coberta',   icon: <Waves size={20}/>,    dest: 'Piscina Coberta' },
  { id: 'gym',      label: 'Ginásio',   icon: <Dumbbell size={20}/>, dest: 'Ginásio' },
  { id: 'fit',      label: 'Fitness',   icon: <Activity size={20}/>, dest: 'Aulas Fitness' },
  { id: 'sauna',    label: 'Sauna',     icon: <Flame size={20}/>,    dest: 'Sauna' },
  { id: 'pool_out', label: 'Exterior',  icon: <Sun size={20}/>,      dest: 'Piscina Exterior' },
];

export const UtenteDashboard = React.memo(({ user, utentes = [] }: { user: UserProfile, utentes?: UserProfile[] }) => {
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const [metrics, setMetrics] = useState<any[]>([]);
  const [activeMetric, setActiveMetric] = useState<'peso' | 'glicemia' | null>(null);
  const [historyType, setHistoryType] = useState<'peso' | 'glicemia' | null>(null);
  const [val, setVal] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/saude`;
    const q = query(collection(db, path), where('userId', '==', user.id), limit(100));
    const unsub = onSnapshot(q, snap => {
      const sorted = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setMetrics(sorted);
    }, error => handleFirestoreError(error, OperationType.GET, path));
    return () => unsub();
  }, [user.id]);

  const handleSave = async (type: 'peso' | 'glicemia') => {
    if (!val) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `artifacts/${APP_ID}/public/data/saude`), {
        userId: user.id, type, value: parseFloat(val.replace(',', '.')),
        timestamp: Timestamp.now(), unit: type === 'peso' ? 'kg' : 'mg/dL'
      });
      setVal(''); setActiveMetric(null);
    } catch (e: any) { alert(`Erro: ${e?.message}`); } finally { setLoading(false); }
  };

  const currentWeight = metrics.find(m => m.type === 'peso')?.value || '--';
  const currentGly = metrics.find(m => m.type === 'glicemia')?.value || '--';

  const getChartData = (type: 'peso' | 'glicemia') =>
    metrics.filter(m => m.type === type).slice(0, 10).reverse().map(m => ({
      d: m.timestamp?.toDate().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
      m: m.value
    }));

  const qrValue = selectedDest
    ? JSON.stringify({ id: user.id, dest: selectedDest })
    : JSON.stringify({ id: user.id });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-left px-1 mb-8 pt-2">

      {/* ── Destino: Botoes detalhados com afluencia ── */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Para onde vou?</p>
        <div className="grid grid-cols-2 gap-3">
          {MODALITIES.map(m => {
            const count = utentes.filter(u => isUserInZone(u, m.id)).length;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedDest(prev => prev === m.dest ? null : m.dest)}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 font-black transition-all active:scale-95 text-left ${
                  selectedDest === m.dest
                    ? 'bg-[#004D71] border-[#004D71] text-[#F7B500] shadow-lg'
                    : 'bg-white border-slate-100 text-slate-400'
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${selectedDest === m.dest ? 'bg-white/10 text-[#F7B500]' : 'bg-slate-50 text-[#004D71]'}`}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[9px] uppercase tracking-widest leading-tight truncate ${selectedDest === m.dest ? 'text-[#F7B500]' : 'text-slate-500'}`}>{m.dest}</p>
                  <p className={`text-sm font-black mt-0.5 ${selectedDest === m.dest ? 'text-white' : 'text-[#004D71]'}`}>
                    {count} <span className="text-[8px] opacity-60 uppercase font-bold">Pessoas</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cartão de Sócio (portrait, mobile-first) ── */}
      <div className="bg-gradient-to-br from-[#004D71] to-[#002f47] rounded-[2.5rem] overflow-hidden shadow-2xl">
        {/* topo do cartão */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/10">
          <div>
            <p className="text-[7px] font-black text-[#F7B500]/60 uppercase tracking-[0.2em]">Complexo Desportivo</p>
            <p className="text-sm font-black text-white uppercase leading-tight">Vila de Rei</p>
          </div>
          <div className="bg-[#F7B500] rounded-lg px-2.5 py-1">
            <p className="text-[7px] font-black text-[#004D71] uppercase tracking-widest">Sócio Activo</p>
          </div>
        </div>

        {/* perfil */}
        <div className="px-6 py-4 flex items-center gap-4">
          <AvatarImage
            src={user.img}
            alt={user.n || user.nome}
            className="w-16 h-16 rounded-2xl border-2 border-white/20 shadow-lg object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-white uppercase leading-tight line-clamp-2">{user.n || user.nome}</h3>
            <p className="text-[9px] font-bold text-[#F7B500] uppercase tracking-widest mt-1">{user.cargo || 'Utente'}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {user.data_nasc && (
                <p className="text-[8px] font-bold text-white/40 uppercase">
                  {new Date().getFullYear() - new Date(user.data_nasc).getFullYear()} anos
                </p>
              )}
              {user.num_utente && (
                <p className="text-[8px] font-bold text-white/40 uppercase font-mono">Nº {user.num_utente}</p>
              )}
            </div>
          </div>
        </div>

        {/* destino selecionado */}
        {selectedDest && (
          <div className="mx-6 mb-4 bg-[#F7B500]/15 border border-[#F7B500]/30 rounded-xl px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#F7B500] animate-pulse shrink-0" />
            <p className="text-[10px] font-black text-[#F7B500] uppercase tracking-widest">
              Destino: {selectedDest}
            </p>
          </div>
        )}

        {/* QR Code centrado e grande */}
        <div
          className="mx-auto mb-6 mt-2 w-fit cursor-pointer active:scale-95 transition-transform"
          onClick={() => setShowQR(true)}
        >
          <div className="bg-white rounded-[1.5rem] p-4 shadow-xl">
            <QRCodeSVG value={qrValue} size={180} bgColor="#ffffff" fgColor="#004D71" level="M" />
          </div>
          <p className="text-center text-[8px] font-black text-white/40 uppercase tracking-widest mt-2">
            Toque para ampliar
          </p>
        </div>
      </div>

      {/* ── Modal QR Code Grande ── */}
      {showQR && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-[3rem] p-8 shadow-2xl flex flex-col items-center gap-6 max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Código de Entrada</p>
              <h3 className="text-lg font-black text-[#004D71] uppercase mt-1">{user.n || user.nome}</h3>
              {selectedDest && <p className="text-xs font-bold text-[#F7B500] uppercase mt-0.5">→ {selectedDest}</p>}
            </div>
            <div className="p-4 bg-white rounded-3xl shadow-inner border-4 border-slate-50">
              <QRCodeSVG value={qrValue} size={220} bgColor="#ffffff" fgColor="#004D71" level="M" />
            </div>
            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest text-center">Apresente este código na entrada</p>
            <button onClick={() => setShowQR(false)} className="w-full bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-xs">Fechar</button>
          </div>
        </div>
      )}

      {/* ── Saúde ── */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setActiveMetric(prev => prev === 'peso' ? null : 'peso')} className={`p-6 rounded-[2.5rem] border-4 transition-all text-left shadow-md ${activeMetric === 'peso' ? 'bg-[#004D71] border-[#F7B500] text-white' : 'bg-white border-[#004D71]/5 text-[#004D71]'}`}>
          <div className={`p-3 rounded-2xl mb-4 w-fit ${activeMetric === 'peso' ? 'bg-white/10 text-[#F7B500]' : 'bg-blue-50 text-[#004D71]'}`}><Scale size={20}/></div>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${activeMetric === 'peso' ? 'text-[#F7B500]/60' : 'text-slate-400'}`}>Peso</p>
          <p className="text-2xl font-black">{currentWeight}<span className="text-xs opacity-40 ml-1">kg</span></p>
        </button>
        <button onClick={() => setActiveMetric(prev => prev === 'glicemia' ? null : 'glicemia')} className={`p-6 rounded-[2.5rem] border-4 transition-all text-left shadow-md ${activeMetric === 'glicemia' ? 'bg-red-500 border-red-200 text-white' : 'bg-white border-[#004D71]/5 text-[#004D71]'}`}>
          <div className={`p-3 rounded-2xl mb-4 w-fit ${activeMetric === 'glicemia' ? 'bg-white/10 text-white' : 'bg-red-50 text-red-500'}`}><Activity size={20}/></div>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${activeMetric === 'glicemia' ? 'text-white/60' : 'text-slate-400'}`}>Glicemia</p>
          <p className="text-2xl font-black">{currentGly}<span className="text-xs opacity-40 ml-1 font-mono">mg/dL</span></p>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setHistoryType('peso')} className="bg-white text-[#004D71] p-4 rounded-[2rem] border-2 border-[#004D71]/5 flex items-center gap-3 active:scale-95 transition-all shadow-sm">
          <div className="p-2.5 bg-blue-50 text-[#004D71] rounded-xl"><Scale size={18}/></div>
          <p className="text-[9px] font-black uppercase tracking-wider text-left">Gráfico<br/>de Peso</p>
        </button>
        <button onClick={() => setHistoryType('glicemia')} className="bg-white text-[#004D71] p-4 rounded-[2rem] border-2 border-[#004D71]/5 flex items-center gap-3 active:scale-95 transition-all shadow-sm">
          <div className="p-2.5 bg-red-50 text-red-500 rounded-xl"><Activity size={18}/></div>
          <p className="text-[9px] font-black uppercase tracking-wider text-left">Gráfico<br/>de Glicemia</p>
        </button>
      </div>

      {historyType && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative">
            <button onClick={() => setHistoryType(null)} className="absolute top-6 right-6 p-4 bg-slate-50 text-slate-400 rounded-full active:scale-90"><X size={24}/></button>
            <div className="mb-8 text-center">
              <h3 className="text-xl font-black text-[#004D71] uppercase">Histórico de {historyType === 'peso' ? 'Peso' : 'Glicemia'}</h3>
            </div>
            <div className="h-[250px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getChartData(historyType)}>
                  <defs>
                    <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={historyType === 'peso' ? '#004D71' : '#ef4444'} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={historyType === 'peso' ? '#004D71' : '#ef4444'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold'}} />
                  <Area type="monotone" dataKey="m" stroke={historyType === 'peso' ? '#004D71' : '#ef4444'} strokeWidth={5} fillOpacity={1} fill="url(#colorHistory)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Mínimo</p>
                <p className={`text-lg font-black ${historyType === 'peso' ? 'text-[#004D71]' : 'text-red-600'}`}>
                  {getChartData(historyType).length > 0 ? Math.min(...getChartData(historyType).map(d => d.m)) : '--'}
                  <small className="text-[10px] opacity-40 ml-1">{historyType === 'peso' ? 'kg' : 'mg/dL'}</small>
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Máximo</p>
                <p className={`text-lg font-black ${historyType === 'peso' ? 'text-orange-600' : 'text-red-700'}`}>
                  {getChartData(historyType).length > 0 ? Math.max(...getChartData(historyType).map(d => d.m)) : '--'}
                  <small className="text-[10px] opacity-40 ml-1">{historyType === 'peso' ? 'kg' : 'mg/dL'}</small>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeMetric && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          <div className="bg-white rounded-[2.8rem] p-8 shadow-xl border-4 border-slate-50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black text-[#004D71] uppercase">Novo Registo — {activeMetric}</h3>
              <button onClick={() => setActiveMetric(null)} className="p-3 bg-slate-50 text-slate-300 rounded-2xl"><X size={18}/></button>
            </div>
            <div className="flex gap-2">
              <input
                type="number" placeholder="Valor..."
                value={val} onChange={e => setVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave(activeMetric!)}
                className="flex-1 bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-lg text-[#004D71] outline-none"
              />
              <button
                onClick={() => handleSave(activeMetric)}
                disabled={loading || !val}
                className="bg-[#004D71] text-[#F7B500] px-8 rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 disabled:opacity-50"
              >
                {loading ? '...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
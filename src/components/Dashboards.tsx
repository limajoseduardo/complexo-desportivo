import React, { useState, useEffect } from 'react';
import {
  Dumbbell, Waves, Sun, Flame, Users2,
  Droplets, ChevronRight, X, ArrowLeft,
  Activity, Plus, Check, Star, Shield
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PicotoIcon, AvatarImage } from './Common';
import { UserProfile, OperationalLog } from '../types';
import { APP_ID } from '../App';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { isUserInZone } from '../lib/logic';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
  { id: 'livre',    label: 'Piscina Regime Livre', icon: <Star size={18}/>,     dest: 'Piscina Regime Livre' },
  { id: 'pool_out', label: 'Piscina Exterior',     icon: <Sun size={18}/>,      dest: 'Piscina Exterior'     },
  { id: 'nat1',     label: 'Natação Nível 1',      icon: <Waves size={18}/>,    dest: 'Natação Nível 1'      },
  { id: 'nat2',     label: 'Natação Nível 2',      icon: <Waves size={18}/>,    dest: 'Natação Nível 2'      },
  { id: 'nat3',     label: 'Natação Nível 3',      icon: <Waves size={18}/>,    dest: 'Natação Nível 3'      },
  { id: 'hidro',    label: 'Hidroginástica',        icon: <Droplets size={18}/>, dest: 'Hidroginástica'       },
  { id: 'bebes',    label: 'Bebés / AMA',           icon: <Users2 size={18}/>,   dest: 'Bebés/AMA'            },
  { id: 'fit',      label: 'Aula Fitness',          icon: <Activity size={18}/>, dest: 'Aulas Fitness'        },
  { id: 'gym',      label: 'Ginásio',               icon: <Dumbbell size={18}/>, dest: 'Ginásio'              },
  { id: 'sauna',    label: 'Sauna',                 icon: <Flame size={18}/>,    dest: 'Sauna'                },
];

export const UtenteDashboard = React.memo(({ user, utentes = [] }: { user: UserProfile, utentes?: UserProfile[] }) => {
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const termsOk = !!(user.termo_imagens && user.termo_responsabilidade);

  const qrValue = selectedDest
    ? JSON.stringify({ id: user.id, dest: selectedDest })
    : JSON.stringify({ id: user.id });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-left px-1 mb-8 pt-2">

      {/* ── Cartão de Utente com seletor de destino integrado ── */}
      <div className="bg-gradient-to-br from-[#004D71] to-[#002f47] rounded-[2.5rem] overflow-hidden shadow-2xl">

        {/* topo do cartão */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/10">
          <div>
            <p className="text-[7px] font-black text-[#F7B500]/60 uppercase tracking-[0.2em]">Complexo Desportivo</p>
            <p className="text-sm font-black text-white uppercase leading-tight">Vila de Rei</p>
          </div>
          {termsOk ? (
            <div className="bg-[#F7B500] rounded-lg px-2.5 py-1">
              <p className="text-[7px] font-black text-[#004D71] uppercase tracking-widest">Utente Activo</p>
            </div>
          ) : (
            <div className="bg-red-500/20 border border-red-400/30 rounded-lg px-2.5 py-1">
              <p className="text-[7px] font-black text-red-300 uppercase tracking-widest">Termos Pendentes</p>
            </div>
          )}
        </div>

        {/* seletor de destino */}
        <div className="px-6 pt-4 pb-6">
          {termsOk ? (
            <>
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Para onde vou?</p>
                <p className="text-[9px] font-black text-white/70 uppercase tracking-wide">
                  Neste momento tem{' '}
                  <span className="text-[#F7B500] text-sm font-black">{utentes.filter(u => u.isInside).length}</span>
                  {' '}{utentes.filter(u => u.isInside).length === 1 ? 'utente' : 'utentes'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {MODALITIES.map(m => {
                  const count = utentes.filter(u => isUserInZone(u, m.id)).length;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedDest(m.dest); setShowQR(true); }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl border-2 bg-white/5 border-white/10 hover:bg-white/10 transition-all active:scale-95 text-left"
                    >
                      <div className="p-2 rounded-xl shrink-0 bg-white/10 text-white/80">
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase leading-tight line-clamp-2 text-white/90">
                          {m.label}
                        </p>
                        <p className="text-[9px] font-bold text-white/50 mt-1 leading-none">
                          tem{' '}
                          <span className="text-white font-black text-xs">{count}</span>
                          {' '}{count === 1 ? 'utente' : 'utentes'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-400/20 flex items-center justify-center">
                <Shield size={26} className="text-red-300"/>
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase tracking-wide mb-1">Termos não aceites</p>
                <p className="text-[10px] text-white/50 leading-relaxed max-w-[260px]">
                  Para gerar o QR de acesso é necessário aceitar os dois termos de responsabilidade.<br/>
                  Aceda ao separador <span className="text-[#F7B500] font-black">Perfil → Termos</span>.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── QR Full Screen ── */}
      {showQR && (
        <div className="fixed inset-0 z-[10000] bg-gradient-to-br from-[#004D71] to-[#002f47] flex flex-col animate-in fade-in duration-200">
          {/* Topo */}
          <div className="flex items-center gap-4 px-6 pt-10 pb-4">
            <button
              onClick={() => { setShowQR(false); setSelectedDest(null); }}
              className="p-3 bg-white/10 text-white rounded-2xl active:scale-90 transition-all shrink-0"
            >
              <ArrowLeft size={22}/>
            </button>
            <div className="min-w-0">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Destino selecionado</p>
              <p className="text-sm font-black text-[#F7B500] uppercase truncate">{selectedDest}</p>
            </div>
          </div>

          {/* QR Code centrado */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
            <div className="bg-white rounded-[2rem] p-6 shadow-2xl">
              <QRCodeSVG value={qrValue} size={240} bgColor="#ffffff" fgColor="#004D71" level="M" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-white uppercase">{user.n || user.nome}</h3>
              <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1">
                Apresente este código na entrada
              </p>
            </div>
          </div>

          {/* Botão de retroceder */}
          <div className="px-6 pb-12">
            <button
              onClick={() => { setShowQR(false); setSelectedDest(null); }}
              className="w-full bg-white/10 border border-white/15 text-white py-5 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <ArrowLeft size={18}/> Voltar
            </button>
          </div>
        </div>
      )}

    </div>
  );
});
import React, { useState, useEffect } from 'react';
import {
  Dumbbell, Waves, Sun, Flame, Users2,
  Droplets, ChevronRight, X, ArrowLeft,
  Activity, Plus, Check, Star, Shield, Target, Building2, Download, FileText
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QRCodeSVG } from 'qrcode.react';
import { PicotoIcon, AvatarImage } from './Common';
import { UserProfile, OperationalLog, AccessLog, Aula } from '../types';
import { APP_ID } from '../App';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { isUserInZone } from '../lib/logic';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { SwimmingStudentPortal } from './SwimmingModule';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const ModalitiesDashboard = React.memo(({ onUserClick, logs, utentes }: { onUserClick: (u: UserProfile) => void, logs: OperationalLog[], utentes: UserProfile[] }) => {
  const latestCoberta = logs.find(l => l.tipo === 'coberta') || {} as OperationalLog;
  const latestDescoberta = logs.find(l => l.tipo === 'descoberta') || {} as OperationalLog;

  const [selected, setSelected] = useState<{label: string, target: string} | null>(null);

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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
         {zonesUsers.map(m => (
           <button key={m.id} onClick={() => setSelected({label: m.label, target: m.target})} className="bg-white rounded-3xl p-5 border-2 border-[#004D71]/5 shadow-sm relative text-left active:scale-95 transition-all outline-none">
              <div className="flex items-center justify-between mb-3">
                 <div className="p-2.5 bg-[#004D71]/5 text-[#004D71] rounded-xl">{m.icon}</div>
                 <div className={`w-2 h-2 rounded-full ${m.count > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-200'}`} />
              </div>
              <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1 line-clamp-1">{m.label}</h4>
              <p className="text-xl font-black text-[#004D71]">{m.count} <span className="text-[10px] opacity-40 uppercase">Presentes</span></p>
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

const normalizeModality = (m: string) => {
  if (m?.startsWith('Natação Nível')) return 'Natação';
  return m || '';
};

const timeToMin = (t: string) => {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
};

const normStr = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const MODALITIES = [
  { id: 'livre',    label: 'Piscina Regime Livre', icon: <Star size={18}/>,     dest: 'Piscina Regime Livre' },
  { id: 'pool_out', label: 'Piscina Exterior',     icon: <Sun size={18}/>,      dest: 'Piscina Exterior'     },
  { id: 'nat',      label: 'Natação Nível 1-2-3',  icon: <Waves size={18}/>,    dest: 'Natação'              },
  { id: 'hidro',    label: 'Hidroginástica',        icon: <Droplets size={18}/>, dest: 'Hidroginástica'       },
  { id: 'bebes',    label: 'Bebés / AMA',           icon: <Users2 size={18}/>,   dest: 'Bebés/AMA'            },
  { id: 'fit',      label: 'Aula Fitness',          icon: <Activity size={18}/>, dest: 'Aulas Fitness'        },
  { id: 'gym',      label: 'Ginásio',               icon: <Dumbbell size={18}/>, dest: 'Ginásio'              },
  { id: 'padel',    label: 'Padel',                 icon: <Target size={18}/>,   dest: 'Padel'                },
  { id: 'pavilhao', label: 'Pavilhão',              icon: <Building2 size={18}/>, dest: 'Pavilhão'             },
  { id: 'sauna',    label: 'Sauna',                 icon: <Flame size={18}/>,    dest: 'Sauna'                },
];

export const StaffDashboard = React.memo(({ user, utentes = [], onUserClick, onLogout }: {
  user: UserProfile;
  utentes?: UserProfile[];
  onUserClick: (u: UserProfile) => void;
  onLogout?: () => void;
}) => {
  const [selectedMod, setSelectedMod] = useState<{ id: string; label: string; icon: React.ReactNode; dest: string } | null>(null);
  const [leaderboard, setLeaderboard] = useState<{user: UserProfile, count: number}[]>([]);
  const [modalData, setModalData] = useState<{ totalMonth: number; weeklyData: { week: string; count: number }[]; top5: { user: UserProfile; count: number }[] } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState<{
    byModality: Record<string, number>;
    byUser: Record<string, { count: number; modalities: string[] }>;
    total: number;
    monthKey: string;
  } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const totalInside = utentes.filter(u => u.isInside).length;

  useEffect(() => {
    if (utentes.length === 0 || leaderboard.length > 0) return;
    const fetchTop = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const q = query(
          collection(db, `artifacts/${APP_ID}/public/data/logs_acesso`),
          where('date', '>=', thirtyDaysAgo.toISOString().split('T')[0])
        );
        const snap = await getDocs(q);
        const counts: Record<string, number> = {};
        snap.forEach(d => {
          const userId = d.data().userId;
          if (userId) counts[userId] = (counts[userId] || 0) + 1;
        });
        
        const top = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id, count]) => {
            const u = utentes.find(u => u.id === id);
            return u ? { user: u, count } : null;
          })
          .filter(Boolean) as {user: UserProfile, count: number}[];
          
        setLeaderboard(top);
      } catch (e) {
        console.error(e);
      }
    };
    fetchTop();
  }, [utentes.length]);

  // Real-time monthly totals — auto-resets when month changes
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

    const unsub = onSnapshot(
      query(collection(db, `artifacts/${APP_ID}/public/data/logs_acesso`),
        where('date', '>=', firstDay), where('date', '<=', lastDay)),
      snap => {
        const byModality: Record<string, number> = {};
        const byUserMap: Record<string, { count: number; mods: Set<string> }> = {};
        snap.forEach(d => {
          const { modalidade, userId } = d.data();
          const mod = normalizeModality(modalidade || '') || 'Outros';
          byModality[mod] = (byModality[mod] || 0) + 1;
          if (userId) {
            if (!byUserMap[userId]) byUserMap[userId] = { count: 0, mods: new Set() };
            byUserMap[userId].count++;
            byUserMap[userId].mods.add(mod);
          }
        });
        const byUser: Record<string, { count: number; modalities: string[] }> = {};
        Object.entries(byUserMap).forEach(([id, v]) => {
          byUser[id] = { count: v.count, modalities: Array.from(v.mods) };
        });
        setMonthlyStats({ byModality, byUser, total: snap.size, monthKey });
      },
      console.error
    );
    return () => unsub();
  }, []);

  const generateMonthlyPDF = async () => {
    setPdfLoading(true);
    try {
      const now = new Date();
      const monthName = now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.width;
      const stats = monthlyStats || { byModality: {}, byUser: {}, total: 0, monthKey: '' };

      // ── Header ───────────────────────────────────────────────
      doc.setFillColor(0, 77, 113);
      doc.rect(0, 0, pageW, 42, 'F');
      doc.setFillColor(247, 181, 0);
      doc.rect(0, 38, pageW, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(247, 181, 0);
      doc.text('COMPLEXO DESPORTIVO VILA DE REI', pageW / 2, 13, { align: 'center' });
      doc.setFontSize(17);
      doc.setTextColor(255, 255, 255);
      doc.text('RELATÓRIO MENSAL DE AFLUÊNCIA', pageW / 2, 24, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(monthName.toUpperCase(), pageW / 2, 33, { align: 'center' });

      // ── Summary boxes ────────────────────────────────────────
      const totalEntradas   = stats.total;
      const modsAtivas      = Object.values(stats.byModality).filter(v => v > 0).length;
      const utentesUnicos   = Object.keys(stats.byUser).length;
      const boxes = [
        { label: 'Total de Entradas',   value: totalEntradas.toString() },
        { label: 'Modalidades Ativas',  value: modsAtivas.toString()    },
        { label: 'Utentes Distintos',   value: utentesUnicos.toString() },
      ];
      boxes.forEach((box, i) => {
        const x = 14 + i * 60;
        doc.setFillColor(240, 245, 250);
        doc.roundedRect(x, 48, 56, 22, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(0, 77, 113);
        doc.text(box.value, x + 28, 60, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(box.label.toUpperCase(), x + 28, 66, { align: 'center' });
      });

      // ── Modalities table ─────────────────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 77, 113);
      doc.text('AFLUÊNCIA POR MODALIDADE', 14, 80);

      const modalRows = MODALITIES
        .map(m => ({ label: m.label, count: stats.byModality[m.dest] || 0 }))
        .sort((a, b) => b.count - a.count);

      autoTable(doc, {
        startY: 83,
        head: [['Modalidade', 'Entradas', '% do Total']],
        body: modalRows.map(r => [
          r.label,
          r.count,
          totalEntradas > 0 ? `${((r.count / totalEntradas) * 100).toFixed(1)} %` : '—',
        ]),
        headStyles:          { fillColor: [0, 77, 113], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        bodyStyles:          { fontSize: 8, textColor: [30, 30, 30] },
        alternateRowStyles:  { fillColor: [245, 248, 252] },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'center', cellWidth: 28 }, 2: { halign: 'center', cellWidth: 28 } },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1 && Number(data.cell.raw) === 0) {
            data.cell.styles.textColor = [180, 180, 180];
          }
        },
      });

      // ── Utentes table ────────────────────────────────────────
      const afterMods = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 77, 113);
      doc.text('PRESENÇAS POR UTENTE', 14, afterMods);

      const utenteRows = Object.entries(stats.byUser)
        .map(([id, data]) => {
          const u = utentes.find(u => u.id === id);
          return { name: (u?.n || u?.nome || `Utente #${id.slice(-4)}`).toUpperCase(), count: data.count, mods: data.modalities.join(', ') };
        })
        .sort((a, b) => b.count - a.count);

      autoTable(doc, {
        startY: afterMods + 3,
        head: [['#', 'Utente', 'Presenças', 'Modalidades Frequentadas']],
        body: utenteRows.map((r, i) => [i + 1, r.name, r.count, r.mods]),
        headStyles:          { fillColor: [0, 77, 113], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        bodyStyles:          { fontSize: 7.5, textColor: [30, 30, 30] },
        alternateRowStyles:  { fillColor: [245, 248, 252] },
        columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'center', cellWidth: 25 }, 3: { cellWidth: 80 } },
        margin: { left: 14, right: 14 },
      });

      // ── Footer on every page ─────────────────────────────────
      const pages = doc.getNumberOfPages();
      const genText = `Gerado em ${now.toLocaleDateString('pt-PT')} às ${now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} • Complexo Desportivo Vila de Rei`;
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(160);
        doc.text(genText, pageW / 2, doc.internal.pageSize.height - 8, { align: 'center' });
        doc.text(`${i} / ${pages}`, pageW - 14, doc.internal.pageSize.height - 8, { align: 'right' });
      }

      doc.save(`relatorio-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedMod) { setModalData(null); return; }
    setModalLoading(true);
    setModalData(null);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const dest = selectedMod.dest;

    getDocs(query(
      collection(db, `artifacts/${APP_ID}/public/data/logs_acesso`),
      where('date', '>=', firstDay),
      where('date', '<=', today)
    )).then(snap => {
      const logs = snap.docs
        .map(d => d.data() as AccessLog)
        .filter(l => {
          const m = normalizeModality(l.modalidade || '');
          return m === dest || normalizeModality(dest) === m;
        });

      const weeks: Record<number, number> = {};
      logs.forEach(l => {
        const day = parseInt(l.date?.split('-')[2] || '1');
        const w = Math.min(Math.ceil(day / 7), 5);
        weeks[w] = (weeks[w] || 0) + 1;
      });
      const maxWeek = Math.ceil(now.getDate() / 7);
      const weeklyData = Array.from({ length: maxWeek }, (_, i) => ({ week: `S${i + 1}`, count: weeks[i + 1] || 0 }));

      const counts: Record<string, number> = {};
      logs.forEach(l => { if (l.userId) counts[l.userId] = (counts[l.userId] || 0) + 1; });
      const top5 = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => { const u = utentes.find(u => u.id === id); return u ? { user: u, count } : null; })
        .filter(Boolean) as { user: UserProfile; count: number }[];

      setModalData({ totalMonth: logs.length, weeklyData, top5 });
    }).catch(console.error).finally(() => setModalLoading(false));
  }, [selectedMod?.id]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-left px-1 mb-8 pt-2">

      <div className="bg-[#004D71] rounded-[2.5rem] overflow-hidden shadow-2xl">

        {/* ── Cabeçalho ── */}
        <div className="px-6 pt-6 pb-5 flex items-center justify-between border-b border-white/10">
          <div>
            <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Complexo Desportivo · Vila de Rei</p>
            <p className="text-lg font-black text-white uppercase mt-0.5">
              {monthlyStats?.total ?? '—'} <span className="text-[#F7B500]">entradas</span> em {new Date().toLocaleDateString('pt-PT', { month: 'long' })}
            </p>
            {totalInside > 0 && (
              <p className="text-[9px] font-bold text-green-400 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>
                {totalInside} {totalInside === 1 ? 'utente presente' : 'utentes presentes'} agora
              </p>
            )}
          </div>
          <button
            onClick={generateMonthlyPDF}
            disabled={pdfLoading || !monthlyStats}
            className="flex items-center gap-2 bg-[#F7B500] text-[#004D71] px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 shadow-lg shrink-0"
          >
            {pdfLoading ? <div className="w-3 h-3 border-2 border-[#004D71]/30 border-t-[#004D71] rounded-full animate-spin"/> : <Download size={13}/>}
            PDF
          </button>
        </div>

        {/* ── Cards de modalidade ── */}
        <div className="p-4">
          {(() => {
            const modList = MODALITIES.map(m => ({
              ...m,
              liveCount: utentes.filter(u => isUserInZone(u, m.id)).length,
              monthCount: monthlyStats?.byModality[m.dest] || 0,
            })).sort((a, b) => b.monthCount - a.monthCount);

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {modList.map(m => (
                  <button key={m.id} onClick={() => setSelectedMod(m)}
                    className="bg-white rounded-2xl p-4 text-left active:scale-95 transition-all shadow-sm hover:shadow-md flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-[#004D71]/8 text-[#004D71] rounded-xl">{m.icon}</div>
                      {m.liveCount > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse block"/>
                          <span className="text-[9px] font-black text-green-600">{m.liveCount}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide leading-tight line-clamp-2">{m.label}</p>
                    <div>
                      <p className="text-2xl font-black text-[#004D71] leading-none tabular-nums">{m.monthCount}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">entradas este mês</p>
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* PÓDIO DE ASSIDUIDADE */}
        {leaderboard.length > 0 && (
          <div className="mx-6 mb-6 bg-white/5 rounded-3xl p-6 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Star size={100} />
            </div>
            <h3 className="text-[10px] font-black text-[#F7B500] uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
              <Target size={14}/> Top Assiduidade (Últimos 30 Dias)
            </h3>
            <div className="flex gap-4 relative z-10 overflow-x-auto hide-scrollbar pb-2">
              {leaderboard.map((item, idx) => (
                <button key={item.user.id} onClick={() => onUserClick(item.user)} className="bg-black/20 hover:bg-black/40 transition-all rounded-2xl p-4 flex flex-col items-center min-w-[120px] max-w-[140px] active:scale-95 border border-white/5">
                  <div className="relative mb-3">
                    <AvatarImage src={item.user.img} alt={item.user.nome} className="w-16 h-16 rounded-full border-2 border-[#F7B500] object-cover" />
                    <div className="absolute -top-2 -right-2 w-7 h-7 bg-[#F7B500] text-[#004D71] rounded-full flex items-center justify-center font-black text-xs shadow-lg">
                      #{idx + 1}
                    </div>
                  </div>
                  <p className="font-black text-white text-[11px] uppercase text-center line-clamp-1 w-full">{item.user.n || item.user.nome}</p>
                  <p className="text-[9px] font-bold text-white/50 uppercase mt-1">{item.count} presenças</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedMod && (() => {
        const currentUsers = utentes.filter(u => isUserInZone(u, selectedMod.id));
        return (
          <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedMod(null)}>
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-10 flex flex-col max-h-[92dvh]" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex justify-between items-center px-8 pt-8 pb-5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#004D71]/5 text-[#004D71] rounded-xl shrink-0">{selectedMod.icon}</div>
                  <div>
                    <h3 className="text-base font-black text-[#004D71] uppercase leading-tight">{selectedMod.label}</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Estatísticas do mês corrente</p>
                  </div>
                </div>
                <button onClick={() => setSelectedMod(null)} className="p-3 bg-slate-100 rounded-2xl active:scale-90 text-slate-400 shrink-0"><X size={20}/></button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6 hide-scrollbar">

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#004D71]/5 rounded-2xl p-4 text-center">
                    {modalLoading ? (
                      <div className="h-8 flex items-center justify-center"><div className="w-5 h-5 border-2 border-[#004D71]/20 border-t-[#004D71] rounded-full animate-spin"/></div>
                    ) : (
                      <p className="text-3xl font-black text-[#004D71]">{modalData?.totalMonth ?? '—'}</p>
                    )}
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Entradas este mês</p>
                  </div>
                  <div className="bg-green-50 rounded-2xl p-4 text-center">
                    <p className="text-3xl font-black text-green-600">{currentUsers.length}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Presentes agora</p>
                  </div>
                </div>

                {/* Weekly chart */}
                {modalData && modalData.weeklyData.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Entradas por semana</p>
                    <div className="h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={modalData.weeklyData} barSize={28} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="week" tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            formatter={(v: any) => [`${v} entradas`, '']}
                            contentStyle={{ fontSize: 11, fontWeight: 900, borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '8px 14px' }}
                            cursor={{ fill: '#004D71', opacity: 0.04 }}
                          />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                            {modalData.weeklyData.map((entry, i) => (
                              <Cell key={i} fill={entry.count === Math.max(...modalData.weeklyData.map(w => w.count)) && entry.count > 0 ? '#F7B500' : '#004D71'} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Top 5 */}
                {modalData && modalData.top5.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black text-[#F7B500] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Star size={11}/> Top 5 utentes este mês
                    </p>
                    <div className="space-y-2">
                      {modalData.top5.map((item, idx) => (
                        <button key={item.user.id} onClick={() => { onUserClick(item.user); setSelectedMod(null); }}
                          className="w-full flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-[#004D71]/20 active:scale-95 transition-all text-left">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[9px] shrink-0 ${idx === 0 ? 'bg-[#F7B500] text-[#004D71]' : 'bg-[#004D71]/10 text-[#004D71]'}`}>
                            {idx + 1}
                          </div>
                          <AvatarImage src={item.user.img} alt={item.user.n || item.user.nome} className="w-9 h-9 rounded-xl shrink-0 border border-slate-200"/>
                          <p className="flex-1 font-black text-[#004D71] text-xs uppercase truncate">{item.user.n || item.user.nome}</p>
                          <span className="text-[10px] font-black text-slate-400 shrink-0 bg-slate-100 px-2.5 py-1 rounded-full">{item.count}×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Currently present */}
                {currentUsers.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black text-green-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"/> Presentes agora
                    </p>
                    <div className="space-y-2">
                      {currentUsers.map(u => (
                        <button key={u.id} onClick={() => { onUserClick(u); setSelectedMod(null); }}
                          className="w-full flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-green-200 active:scale-95 transition-all text-left">
                          <AvatarImage src={u.img} alt={u.n || u.nome} className="w-10 h-10 rounded-xl border-2 border-green-400 shadow-sm shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-[#004D71] text-xs uppercase truncate">{u.n || u.nome}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{u.location || selectedMod.label}</p>
                          </div>
                          <ChevronRight size={15} className="text-[#F7B500] shrink-0"/>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!modalLoading && modalData?.totalMonth === 0 && currentUsers.length === 0 && (
                  <div className="py-16 text-center">
                    <PicotoIcon className="mx-auto mb-4 opacity-10" size={50}/>
                    <p className="uppercase font-black text-[10px] tracking-widest text-slate-300">Sem dados para este mês</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
});

export const ProfessorDashboard = React.memo(({ user, utentes = [], onUserClick, logs }: {
  user: UserProfile;
  utentes?: UserProfile[];
  onUserClick: (u: UserProfile) => void;
  logs: OperationalLog[];
}) => {
  const latestCoberta = logs.find(l => l.tipo === 'coberta') || {} as OperationalLog;
  const latestDescoberta = logs.find(l => l.tipo === 'descoberta') || {} as OperationalLog;

  const todayDow = new Date().getDay() || 7;
  const todayStr = new Date().toISOString().split('T')[0];
  const nowMin = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();

  const [todayAulas, setTodayAulas] = useState<Aula[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<{ label: string; id: string } | null>(null);

  const zones = React.useMemo(() => [
    { id: 'gym',      label: 'Ginásio',          icon: <Dumbbell size={14}/> },
    { id: 'pool_in',  label: 'Piscina Coberta',   icon: <Waves size={14}/>   },
    { id: 'pool_out', label: 'Piscina Exterior',  icon: <Sun size={14}/>     },
    { id: 'sauna',    label: 'Sauna',             icon: <Flame size={14}/>   },
    { id: 'fit',      label: 'Aulas Grupo',        icon: <Users2 size={14}/> },
  ], []);

  const zonesUsers = React.useMemo(() =>
    zones.map(z => ({ ...z, count: utentes.filter(u => isUserInZone(u, z.id)).length }))
  , [utentes, zones]);

  // Today's classes for this professor
  useEffect(() => {
    const profNorm = normStr(user.n || user.nome || '');
    const q = query(collection(db, `artifacts/${APP_ID}/public/data/agenda`), where('diaSemana', '==', todayDow));
    return onSnapshot(q, snap => {
      const aulas = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Aula))
        .filter(a => {
          if (a.cancelada) return false;
          const ap = normStr(a.professor || '');
          const ap2 = normStr(a.professor2 || '');
          const parts = profNorm.split(' ').filter(p => p.length > 2);
          return parts.some(p => ap.includes(p) || ap2.includes(p));
        })
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
      setTodayAulas(aulas);
    }, () => {});
  }, [user.id, todayDow]);

  // Today's attendance per modality from access logs
  useEffect(() => {
    getDocs(query(
      collection(db, `artifacts/${APP_ID}/public/data/logs_acesso`),
      where('date', '==', todayStr)
    )).then(snap => {
      const counts: Record<string, number> = {};
      snap.forEach(d => {
        const m = normalizeModality(d.data().modalidade || '');
        if (m) counts[m] = (counts[m] || 0) + 1;
      });
      setTodayAttendance(counts);
    }).catch(() => {});
  }, [todayStr]);

  const getAulaStatus = (aula: Aula) => {
    const s = timeToMin(aula.horaInicio);
    const e = timeToMin(aula.horaFim);
    if (nowMin >= s && nowMin <= e) return 'decorrer';
    if (nowMin < s && s - nowMin <= 60) return 'proxima';
    if (nowMin < s) return 'futura';
    return 'passada';
  };

  const selectedUtentes = React.useMemo(() => {
    if (!selected) return [];
    return utentes.filter(u => isUserInZone(u, selected.id));
  }, [utentes, selected]);

  const dayNames = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const today = new Date();
  const todayLabel = `${dayNames[todayDow]}, ${today.getDate()} ${monthNames[today.getMonth()]}`;

  return (
    <div className="space-y-6 animate-in fade-in pb-24 px-2 text-left relative font-sans">

      {/* ── MINHAS AULAS HOJE ── */}
      <div className="bg-gradient-to-br from-[#004D71] to-[#002f47] rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/10">
          <div>
            <p className="text-[7px] font-black text-[#F7B500]/60 uppercase tracking-[0.2em]">As Minhas Aulas</p>
            <p className="text-sm font-black text-white uppercase leading-tight">{todayLabel}</p>
          </div>
          <div className="bg-[#F7B500] rounded-lg px-2.5 py-1">
            <p className="text-[7px] font-black text-[#004D71] uppercase tracking-widest">Professor</p>
          </div>
        </div>

        <div className="px-6 py-5">
          {todayAulas.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-white/30 font-black text-[10px] uppercase tracking-widest">Sem aulas agendadas para hoje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAulas.map(aula => {
                const status = getAulaStatus(aula);
                const attendance = todayAttendance[normalizeModality(aula.modalidade)] || 0;
                const presentNow = utentes.filter(u => u.isInside && normalizeModality(u.modalidade || '') === normalizeModality(aula.modalidade)).length;
                return (
                  <div key={aula.id} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    status === 'decorrer' ? 'bg-[#F7B500]/15 border-[#F7B500]/50' :
                    status === 'proxima'  ? 'bg-white/10 border-white/25' :
                    status === 'passada'  ? 'bg-white/3 border-white/5 opacity-50' :
                    'bg-white/5 border-white/10'
                  }`}>
                    <div className="text-center shrink-0 w-16">
                      <p className="text-[11px] font-black text-white/70">{aula.horaInicio}</p>
                      <p className="text-[9px] font-black text-white/30">{aula.horaFim}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-white text-sm uppercase leading-tight truncate">{aula.modalidade}</p>
                        {status === 'decorrer' && <span className="bg-[#F7B500] text-[#004D71] text-[7px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">Em curso</span>}
                        {status === 'proxima' && <span className="bg-white/20 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">A seguir</span>}
                      </div>
                      {aula.sala && <p className="text-[8px] text-white/30 font-black uppercase mt-0.5">{aula.sala}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      {(status === 'decorrer' || status === 'passada') ? (
                        <>
                          <p className="text-white font-black text-xl leading-none">{attendance}</p>
                          <p className="text-[7px] text-white/40 font-black uppercase">presenças</p>
                          {status === 'decorrer' && presentNow > 0 && (
                            <p className="text-[7px] text-[#F7B500] font-black uppercase">{presentNow} agora</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-white font-black text-xl leading-none">{aula.vagas ?? '—'}</p>
                          <p className="text-[7px] text-white/40 font-black uppercase">vagas</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── ZONE OCCUPANCY ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {zonesUsers.map(m => (
          <button key={m.id} onClick={() => setSelected({ label: m.label, id: m.id })}
            className="bg-white rounded-3xl p-5 border-2 border-[#004D71]/5 shadow-sm relative text-left active:scale-95 transition-all outline-none">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-[#004D71]/5 text-[#004D71] rounded-xl">{m.icon}</div>
              <div className={`w-2 h-2 rounded-full ${m.count > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-200'}`}/>
            </div>
            <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1 line-clamp-1">{m.label}</h4>
            <p className="text-xl font-black text-[#004D71]">{m.count} <span className="text-[10px] opacity-40 uppercase">Presentes</span></p>
          </button>
        ))}
      </div>

      {/* ── POOL MONITORING (read-only) ── */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border-2 border-[#004D71]/5 p-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
          <Droplets size={14} className="text-[#F7B500]"/> Monitorização Piscinas
        </h3>
        <div className="space-y-6">
          {[
            { label: 'Piscina Coberta', color: 'bg-blue-500', data: latestCoberta },
            { label: 'Piscina Exterior', color: 'bg-amber-500', data: latestDescoberta },
          ].map(({ label, color, data }) => (
            <div key={label} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className={`w-1.5 h-1.5 rounded-full ${color}`}/>
                <p className="text-[9px] font-black text-[#004D71] uppercase tracking-widest">{label}</p>
                {data.hora && <span className="text-[8px] font-bold text-slate-400 uppercase ml-auto">{data.hora}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                {[
                  { key: 'Água', val: data.tempAgua ? `${data.tempAgua}ºC` : '---', cls: 'text-[#004D71]' },
                  { key: 'pH',   val: data.ph || '---',      cls: 'text-orange-600' },
                  { key: 'Cloro', val: data.clLivre || '---', cls: 'text-blue-600'   },
                ].map(({ key, val, cls }) => (
                  <div key={key} className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col items-center">
                    <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">{key}</span>
                    <span className={`text-[12px] font-black ${cls}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ZONE USERS MODAL ── */}
      {selected && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-100">
              <div>
                <h3 className="text-xl font-black text-[#004D71] uppercase">{selected.label}</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Utentes Presentes Agora</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-3 bg-slate-100 rounded-2xl active:scale-90 text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-3 max-h-[50dvh] overflow-y-auto pr-2 hide-scrollbar">
              {selectedUtentes.map(u => (
                <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <AvatarImage src={u.img} alt={u.n || u.nome} className="w-12 h-12 rounded-xl border-2 border-green-400 shadow-sm"/>
                    <div>
                      <p className="font-black text-[#004D71] text-sm uppercase">{u.n || u.nome}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{u.location || selected.label}</p>
                    </div>
                  </div>
                  <button onClick={() => { onUserClick(u); setSelected(null); }} className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-[#F7B500]">
                    <ChevronRight size={16}/>
                  </button>
                </div>
              ))}
              {selectedUtentes.length === 0 && (
                <div className="py-20 text-center text-slate-300">
                  <PicotoIcon className="mx-auto mb-4 opacity-10" size={60}/>
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

export const UtenteDashboard = React.memo(({ user, utentes = [] }: { user: UserProfile, utentes?: UserProfile[] }) => {
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [insideUsers, setInsideUsers] = useState<UserProfile[]>([]);
  const [todayLogs, setTodayLogs] = useState<{ modalidade?: string }[]>([]);

  const termsOk = !!(user.termo_imagens && user.termo_responsabilidade);

  // Live: who is inside right now
  useEffect(() => {
    const q = query(
      collection(db, `artifacts/${APP_ID}/public/data/users`),
      where('isInside', '==', true)
    );
    return onSnapshot(q, snap => {
      setInsideUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    }, () => {});
  }, []);

  // Today's access logs (for per-zone totals)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, `artifacts/${APP_ID}/public/data/logs_acesso`),
      where('date', '==', today)
    );
    return onSnapshot(q, snap => {
      setTodayLogs(snap.docs.map(d => d.data() as { modalidade?: string }));
    }, () => {});
  }, []);

  const totalInside = insideUsers.length;
  const todayTotal  = todayLogs.length;

  const normMod = (m: string) => (m?.startsWith('Natação Nível') ? 'Natação' : m || '');
  const countToday = (dest: string) => todayLogs.filter(l => normMod(l.modalidade || '') === dest).length;

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
                <div className="flex items-center gap-3">
                  <p className="text-[9px] font-black text-white/50 uppercase tracking-wide">
                    Hoje: <span className="text-[#F7B500] font-black">{todayTotal}</span> entradas
                  </p>
                  <p className="text-[9px] font-black text-white/70 uppercase tracking-wide">
                    Agora: <span className="text-[#F7B500] text-sm font-black">{totalInside}</span> dentro
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {React.useMemo(() =>
                  MODALITIES.map(m => ({
                    ...m,
                    liveCount:  insideUsers.filter(u => isUserInZone(u, m.id)).length,
                    todayCount: countToday(m.dest),
                  })).sort((a, b) => b.todayCount - a.todayCount),
                [insideUsers, todayLogs]).map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedDest(m.dest); setShowQR(true); }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl border-2 bg-white/5 border-white/10 hover:bg-white/10 transition-all active:scale-95 text-left"
                    >
                      <div className="p-2 rounded-xl shrink-0 bg-white/10 text-white/80">
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase leading-tight line-clamp-2 text-white/90 mb-1.5">
                          {m.label}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 bg-white/10 rounded-md px-1.5 py-0.5">
                            <span className="text-[8px] text-white/50 uppercase font-bold">Hoje</span>
                            <span className="text-[#F7B500] font-black text-xs">{m.todayCount}</span>
                          </span>
                          <span className="flex items-center gap-1 bg-white/10 rounded-md px-1.5 py-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${m.liveCount > 0 ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`}/>
                            <span className="text-white font-black text-xs">{m.liveCount}</span>
                            <span className="text-[8px] text-white/50 uppercase font-bold">agora</span>
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
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

import React, { useState, useMemo } from 'react';
import { ClipboardList, Plus, X, Save, FileText, Edit2, Download, Calendar } from 'lucide-react';
import { Timestamp, addDoc, updateDoc, collection, doc } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';
import { UserProfile } from '../types';
import { FormInput } from './Common';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyForm = (user: UserProfile) => ({
  data: new Date().toISOString().split('T')[0],
  hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  tecnico: user?.nome || user?.n || '',
  tempAgua: '', ph: '', clLivre: '', utaHum: '',
  tempAr: '', clTotal: '', clComb: '', acidoCianurico: '', banhistas: '', obs: ''
});

export function MapsManager({ user, logs }: { user: UserProfile, logs: any[] }) {
  const [activePool, setActivePool] = useState<'coberta' | 'descoberta'>('coberta');
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm(user));
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFrom, setPdfFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [pdfTo, setPdfTo] = useState(new Date().toISOString().split('T')[0]);

  const canAdd  = ['staff', 'admin', 'professor'].includes(user?.role);
  const canEdit = ['staff', 'admin'].includes(user?.role);

  const openNew = () => {
    setEditingId(null);
    setFormData(emptyForm(user));
    setMode('form');
  };

  const openEdit = (log: any) => {
    setEditingId(log.id);
    setFormData({
      data:     log.data     || '',
      hora:     log.hora     || '',
      tecnico:  log.tecnico  || '',
      tempAgua: log.tempAgua || '',
      ph:       log.ph       || '',
      clLivre:  log.clLivre  || '',
      utaHum:   log.utaHum   || '',
      tempAr:   log.tempAr   || '',
      clTotal:  log.clTotal  || '',
      clComb:   log.clComb   || '',
      acidoCianurico: log.acidoCianurico || '',
      banhistas: log.banhistas || '',
      obs:      log.obs      || ''
    });
    setMode('form');
  };

  const saveEntry = async () => {
    try {
      const path = activePool === 'coberta' ? 'mapas_coberta' : 'mapas_descoberta';
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', path, editingId), {
          ...formData,
          editedAt: Timestamp.now(),
          editedBy: user?.nome || user?.n || '',
        });
      } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', path), {
          ...formData,
          timestamp: Timestamp.now(),
          tipo: activePool,
          tecnico: user?.nome || user?.n || '',
        });
      }
      setMode('list');
      setEditingId(null);
    } catch (e) { console.error(e); }
  };

  const poolLogs = useMemo(() => logs.filter(l => l.tipo === activePool), [logs, activePool]);

  const exportPdf = () => {
    const filterRange = (tipo: 'coberta' | 'descoberta') =>
      logs
        .filter(l => l.tipo === tipo)
        .filter(l => {
          const d = l.data || (l.timestamp?.toDate?.()?.toISOString().split('T')[0] ?? '');
          return d >= pdfFrom && d <= pdfTo;
        })
        .sort((a, b) => ((a.data || '') < (b.data || '') ? -1 : 1));

    const coberta    = filterRange('coberta');
    const descoberta = filterRange('descoberta');
    const fmtDate    = (iso: string) => iso.split('-').reverse().join('/');

    const pdf = new jsPDF({ orientation: 'landscape' });

    pdf.setFontSize(16);
    pdf.setTextColor(0, 77, 113);
    pdf.text('Mapas Oficiais — Complexo Desportivo de Vila de Rei', 14, 16);

    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`Período: ${fmtDate(pdfFrom)} a ${fmtDate(pdfTo)}`, 14, 23);
    pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}  |  Por: ${user.nome || user.n || ''}`, 14, 28);

    let y = 34;

    const addSection = (title: string, rows: any[]) => {
      pdf.setFontSize(11);
      pdf.setTextColor(0, 77, 113);
      pdf.text(title, 14, y);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`${rows.length} registo(s)`, 14, y + 5);
      y += 9;

      if (rows.length === 0) {
        pdf.setFontSize(8);
        pdf.setTextColor(180);
        pdf.text('Sem registos no período selecionado.', 14, y + 4);
        y += 12;
        return;
      }

      autoTable(pdf, {
        startY: y,
        head: [['Data', 'Hora', 'Técnico', 'pH', 'C.Livre', 'C.Total', 'C.Comb', 'Água', 'Ar', 'Hum.', 'Banh.', 'Obs']],
        body: rows.map(l => {
          const { data, hora } = fmtDateTime(l.timestamp, l.data, l.hora);
          return [data, hora, l.tecnico || '—', l.ph || '—', l.clLivre || '—', l.clTotal || '—', l.clComb || '—',
            l.tempAgua ? `${l.tempAgua}°C` : '—', l.tempAr ? `${l.tempAr}°C` : '—', l.utaHum ? `${l.utaHum}%` : '—',
            l.banhistas || '—', l.obs || '—'];
        }),
        headStyles: { fillColor: [0, 77, 113], textColor: [247, 181, 0], fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      });
      y = (pdf as any).lastAutoTable.finalY + 14;
    };

    addSection('Piscina Coberta (UTA)', coberta);
    addSection('Piscina Descoberta', descoberta);

    pdf.save(`mapas_${pdfFrom}_a_${pdfTo}.pdf`);
    setShowPdfModal(false);
  };

  const fmtDateTime = (ts: any, fallbackData: string, fallbackHora: string) => {
    if (ts?.toDate) {
      const d = ts.toDate() as Date;
      const data = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hora = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return { data, hora };
    }
    return { data: fallbackData, hora: fallbackHora };
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24 px-2 text-left">

      {/* PDF modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPdfModal(false)}>
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#004D71] uppercase tracking-tight">Exportar PDF</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Selecionar período</p>
              </div>
              <button onClick={() => setShowPdfModal(false)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100">
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">De</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input type="date" value={pdfFrom} onChange={e => setPdfFrom(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-[#004D71] outline-none focus:border-[#004D71]/20"/>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Até</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input type="date" value={pdfTo} onChange={e => setPdfTo(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-[#004D71] outline-none focus:border-[#004D71]/20"/>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl px-4 py-3 text-[9px] font-bold text-slate-400 uppercase">
              Inclui registos de ambas as piscinas (Coberta + Descoberta) no período selecionado.
            </div>

            <button onClick={exportPdf}
              className="w-full bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg">
              <Download size={18}/> Gerar e Guardar PDF
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
          <ClipboardList className="text-[#F7B500]"/> Mapas Oficiais
        </h2>
        <div className="flex items-center gap-2">
          {mode === 'list' && (
            <button onClick={() => setShowPdfModal(true)} className="bg-slate-100 text-[#004D71] p-3 rounded-2xl active:scale-95 hover:bg-slate-200 transition-colors" title="Exportar PDF">
              <FileText size={20}/>
            </button>
          )}
          {canAdd && mode === 'list' && (
            <button onClick={openNew} className="bg-[#004D71] text-[#F7B500] p-3 rounded-2xl shadow-lg active:scale-95">
              <Plus size={20}/>
            </button>
          )}
          {mode === 'form' && (
            <button onClick={() => { setMode('list'); setEditingId(null); }} className="bg-slate-100 text-[#004D71] p-3 rounded-2xl active:scale-95">
              <X size={20}/>
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
        <button onClick={() => setActivePool('coberta')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activePool === 'coberta' ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'text-slate-400'}`}>Coberta (UTA)</button>
        <button onClick={() => setActivePool('descoberta')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activePool === 'descoberta' ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'text-slate-400'}`}>Descoberta</button>
      </div>

      {mode === 'form' ? (
        <div className="bg-white rounded-[2.5rem] p-6 border-2 border-slate-50 shadow-sm space-y-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {editingId ? 'Corrigir registo' : 'Novo registo'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Data" type="date" value={formData.data} onChange={v => setFormData({...formData, data: v})} />
            <FormInput label="Hora" type="time" value={formData.hora} onChange={v => setFormData({...formData, hora: v})} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormInput label="Temp. Água (ºC)" value={formData.tempAgua} onChange={v => setFormData({...formData, tempAgua: v})} />
            <FormInput label="Temp. Ar (ºC)" value={formData.tempAr} onChange={v => setFormData({...formData, tempAr: v})} />
            <FormInput label="Humidade (UTA %)" value={formData.utaHum} onChange={v => setFormData({...formData, utaHum: v})} />
            <FormInput label="Nº Banhistas" type="number" value={formData.banhistas} onChange={v => setFormData({...formData, banhistas: v})} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormInput label="Valor pH" value={formData.ph} onChange={v => setFormData({...formData, ph: v})} />
            <FormInput label="Cloro Livre" value={formData.clLivre} onChange={v => setFormData({...formData, clLivre: v})} />
            <FormInput label="Cloro Total" value={formData.clTotal} onChange={v => setFormData({...formData, clTotal: v})} />
            <FormInput label="Cloro Combinado" value={formData.clComb} onChange={v => setFormData({...formData, clComb: v})} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Ácido Cianúrico" value={formData.acidoCianurico} onChange={v => setFormData({...formData, acidoCianurico: v})} />
          </div>
          <FormInput label="Observações / Anomalias" multiline value={formData.obs} onChange={v => setFormData({...formData, obs: v})} />
          <button onClick={saveEntry} className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
            <Save size={20}/> {editingId ? 'Guardar Correção' : 'Gravar Registo'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {poolLogs.map((log, i) => {
            const { data, hora } = fmtDateTime(log.timestamp, log.data, log.hora);
            return (
              <div key={i} className="flex items-center gap-3 bg-white rounded-[1.5rem] px-4 py-3 border-2 border-slate-50 shadow-sm">
                {/* Meta: data + hora + técnico */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-[#004D71] tabular-nums whitespace-nowrap">{data} {hora}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{log.tecnico}</span>
                    {log.editedBy && (
                      <span className="text-[8px] text-orange-400 font-bold uppercase">✎ {log.editedBy}</span>
                    )}
                  </div>
                </div>
                {/* Valores inline */}
                <div className="flex items-center gap-4 shrink-0 overflow-x-auto hide-scrollbar">
                  <div className="flex flex-col items-center">
                    <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Cl</span>
                    <span className="text-sm font-black text-[#004D71] tabular-nums">{log.clLivre || '—'}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">pH</span>
                    <span className="text-sm font-black text-orange-600 tabular-nums">{log.ph || '—'}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Água</span>
                    <span className="text-sm font-black text-[#004D71] tabular-nums">{log.tempAgua ? `${log.tempAgua}°` : '—'}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Ar</span>
                    <span className="text-sm font-black text-[#004D71] tabular-nums">{log.tempAr ? `${log.tempAr}°` : '—'}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">UTA</span>
                    <span className="text-sm font-black text-[#004D71] tabular-nums">{log.utaHum ? `${log.utaHum}%` : '—'}</span>
                  </div>
                  {canEdit && (
                    <button onClick={() => openEdit(log)} className="p-2 text-slate-300 hover:text-[#004D71] hover:bg-slate-50 rounded-xl transition-colors" title="Corrigir">
                      <Edit2 size={14}/>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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

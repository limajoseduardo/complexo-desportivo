import React, { useState, useMemo } from 'react';
import { ClipboardList, Plus, X, Save, FileText, Edit2, Trash2, Download, Calendar, Waves, Sun, Thermometer } from 'lucide-react';
import { Timestamp, addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';
import { UserProfile } from '../types';
import { FormInput } from './Common';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type Area = 'interior' | 'exterior' | 'eletricidade';
type Pool = 'coberta' | 'descoberta';
type Section = 'analises' | 'temperaturas' | 'sondas' | 'equipamentos' | 'tratamentos';
type Zona = 'adulto' | 'infantil';

const SECTIONS_INTERIOR: { id: Section; label: string }[] = [
  { id: 'analises', label: 'Análises' },
  { id: 'temperaturas', label: 'Temperaturas' },
  { id: 'sondas', label: 'Sondas' },
  { id: 'equipamentos', label: 'Equipamentos' },
  { id: 'tratamentos', label: 'Tratamentos' },
];
const SECTIONS_EXTERIOR: { id: Section; label: string }[] = [
  { id: 'analises', label: 'Análises' },
  { id: 'temperaturas', label: 'Temperaturas' },
  { id: 'equipamentos', label: 'Equipamentos' },
  { id: 'tratamentos', label: 'Tratamentos' },
];

// new Date().toISOString() converte para UTC — perto da meia-noite em horário de
// verão (UTC+1) isso devolvia a data de ontem. Construímos a data a partir dos
// componentes locais para corresponder sempre ao dia em que o técnico está.
const localDateStr = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const emptyAnaliseForm = (user: UserProfile) => ({
  data: localDateStr(),
  hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  tecnico: user?.nome || user?.n || '',
  ph: '', clLivre: '', clTotal: '', clComb: '', acidoCianurico: '', banhistas: '', obs: ''
});

const emptyTempInteriorForm = (user: UserProfile) => ({
  data: localDateStr(),
  hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  tecnico: user?.nome || user?.n || '',
  naveTemp: '', naveHumidade: '', balneariosTemp: '', aguaPiscinaTemp: '', aqsTemp: '', quadroTemp: '', depositoTemp: ''
});

const emptyTempExteriorForm = (user: UserProfile) => ({
  data: localDateStr(),
  hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  tecnico: user?.nome || user?.n || '',
  temp: ''
});

const fmtDateTime = (ts: any, fallbackData: string, fallbackHora: string) => {
  if (ts?.toDate) {
    const d = ts.toDate() as Date;
    const data = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return { data, hora };
  }
  return { data: fallbackData, hora: fallbackHora };
};

type FieldDef = { key: string; label: string; type?: string };

// Secção genérica de registos independentes (Sondas, Equipamentos, Tratamentos, Eletricidade):
// cada uma grava na sua própria coleção, com o mesmo padrão de formulário/lista das restantes secções.
function SimpleLogSection({ user, path, records, fields, listFields, canAdd, canEdit, title }: {
  user: UserProfile;
  path: string;
  records: any[];
  fields: FieldDef[];
  listFields: FieldDef[];
  canAdd: boolean;
  canEdit: boolean;
  title: string;
}) {
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = () => {
    const base: any = {
      data: localDateStr(),
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    fields.forEach(f => { base[f.key] = ''; });
    return base;
  };
  const [form, setForm] = useState(emptyForm());

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setMode('form'); };
  const openEdit = (log: any) => {
    setEditingId(log.id);
    const next: any = { data: log.data || '', hora: log.hora || '' };
    fields.forEach(f => { next[f.key] = log[f.key] ?? ''; });
    setForm(next);
    setMode('form');
  };

  const fullPath = `artifacts/${APP_ID}/public/data/${path}`;

  const save = async () => {
    try {
      if (editingId) {
        await updateDoc(doc(db, fullPath, editingId), {
          ...form,
          editedAt: Timestamp.now(),
          editedBy: user?.nome || user?.n || '',
        });
      } else {
        await addDoc(collection(db, fullPath), {
          ...form,
          tecnico: user?.nome || user?.n || '',
          timestamp: Timestamp.now(),
        });
      }
      setMode('list');
      setEditingId(null);
    } catch (e) { console.error(e); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Apagar este registo definitivamente?')) return;
    try { await deleteDoc(doc(db, fullPath, id)); } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        {mode === 'list' && canAdd && (
          <button onClick={openNew} className="bg-[#004D71] text-[#F7B500] p-2.5 rounded-xl shadow active:scale-95">
            <Plus size={16}/>
          </button>
        )}
        {mode === 'form' && (
          <button onClick={() => { setMode('list'); setEditingId(null); }} className="bg-slate-100 text-[#004D71] p-2.5 rounded-xl active:scale-95">
            <X size={16}/>
          </button>
        )}
      </div>

      {mode === 'form' ? (
        <div className="bg-white rounded-[2.5rem] p-6 border-2 border-slate-50 shadow-sm space-y-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {editingId ? 'Corrigir registo' : 'Novo registo'} · {title}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Data" type="date" value={form.data} onChange={v => setForm({ ...form, data: v })} />
            <FormInput label="Hora" type="time" value={form.hora} onChange={v => setForm({ ...form, hora: v })} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {fields.map(f => (
              <FormInput key={f.key} label={f.label} type={f.type || 'text'} value={form[f.key]} onChange={v => setForm({ ...form, [f.key]: v })} />
            ))}
          </div>
          <button onClick={save} className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
            <Save size={20}/> {editingId ? 'Guardar Correção' : 'Gravar Registo'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((log, i) => {
            const { data, hora } = fmtDateTime(log.timestamp, log.data, log.hora);
            return (
              <div key={i} className="flex items-center gap-3 bg-white rounded-[1.5rem] px-4 py-3 border-2 border-slate-50 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-[#004D71] tabular-nums whitespace-nowrap">{data} {hora}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{log.tecnico}</span>
                    {log.editedBy && <span className="text-[8px] text-orange-400 font-bold uppercase">✎ {log.editedBy}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 overflow-x-auto hide-scrollbar">
                  {listFields.map(f => (
                    <div key={f.key} className="flex flex-col items-center">
                      <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">{f.label}</span>
                      <span className="text-sm font-black text-[#004D71] tabular-nums">{log[f.key] || '—'}</span>
                    </div>
                  ))}
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(log)} className="p-2 text-slate-300 hover:text-[#004D71] hover:bg-slate-50 rounded-xl transition-colors" title="Corrigir">
                        <Edit2 size={14}/>
                      </button>
                      <button onClick={() => remove(log.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Apagar">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {records.length === 0 && (
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

const SONDAS_FIELDS: FieldDef[] = [
  { key: 'cloro', label: 'Cloro' }, { key: 'ph', label: 'PH' },
];

const EQUIP_INTERIOR_FIELDS: FieldDef[] = [
  { key: 'vevsBombaServico', label: 'VEVs · Bomba Serviço' }, { key: 'vevsFrequencia', label: 'VEVs · Frequência %' },
  { key: 'f1Entrada', label: 'Filtro1 · Entrada bar' }, { key: 'f1Saida', label: 'Filtro1 · Saída bar' },
  { key: 'f1Lavagem', label: 'Filtro1 · Lavagem min' }, { key: 'f1Risagem', label: 'Filtro1 · Risagem min' },
  { key: 'f2Entrada', label: 'Filtro2 · Entrada bar' }, { key: 'f2Saida', label: 'Filtro2 · Saída bar' },
  { key: 'f2Lavagem', label: 'Filtro2 · Lavagem min' }, { key: 'f2Risagem', label: 'Filtro2 · Risagem min' },
  { key: 'cald1Estado', label: 'Caldeira1 · Estado' }, { key: 'cald1Temp', label: 'Caldeira1 · Temp ºC' },
  { key: 'cald1Pressao', label: 'Caldeira1 · Pressão' }, { key: 'cald1Chama', label: 'Caldeira1 · Chama H' },
  { key: 'cald2Estado', label: 'Caldeira2 · Estado' }, { key: 'cald2Temp', label: 'Caldeira2 · Temp ºC' },
  { key: 'cald2Pressao', label: 'Caldeira2 · Pressão' }, { key: 'cald2Chama', label: 'Caldeira2 · Chama H' },
  { key: 'gas', label: 'Gás m³' }, { key: 'aguaPiscina', label: 'Água Piscina m³' }, { key: 'aguaGeral', label: 'Água Geral m³' },
];
const EQUIP_INTERIOR_LIST: FieldDef[] = [
  { key: 'vevsFrequencia', label: 'VEVs %' }, { key: 'gas', label: 'Gás m³' }, { key: 'aguaPiscina', label: 'Água Pisc. m³' },
];

const EQUIP_EXTERIOR_FIELDS: FieldDef[] = [
  { key: 'vevsBombaServico', label: 'VEVs · Bomba Serviço' }, { key: 'vevsFrequencia', label: 'VEVs · Frequência %' },
  { key: 'f1Entrada', label: 'Filtro1 · Entrada bar' }, { key: 'f1Saida', label: 'Filtro1 · Saída bar' },
  { key: 'f1Lavagem', label: 'Filtro1 · Lavagem min' }, { key: 'f1Risagem', label: 'Filtro1 · Risagem min' },
  { key: 'f2Entrada', label: 'Filtro2 · Entrada bar' }, { key: 'f2Saida', label: 'Filtro2 · Saída bar' },
  { key: 'f2Lavagem', label: 'Filtro2 · Lavagem min' }, { key: 'f2Risagem', label: 'Filtro2 · Risagem min' },
  { key: 'vigCloro', label: 'Vigilante · Cloro' }, { key: 'vigCloroTotal', label: 'Vigilante · Cloro Total' },
  { key: 'vigPh', label: 'Vigilante · PH' }, { key: 'vigTemp', label: 'Vigilante · Temp' },
  { key: 'uvHorasTot', label: 'Ultravioleta · Horas TOT' }, { key: 'uvVidaUtil', label: 'Ultravioleta · Vida Útil Lâmp.' },
  { key: 'aguaPiscina', label: 'Água Piscina m³' }, { key: 'aguaGeralCais', label: 'Água Geral/Cais m³' }, { key: 'aguaPolidesportivo', label: 'Água Polidesportivo m³' },
];
const EQUIP_EXTERIOR_LIST: FieldDef[] = [
  { key: 'vigCloro', label: 'Vig. Cloro' }, { key: 'vigPh', label: 'Vig. PH' }, { key: 'uvHorasTot', label: 'UV Horas' },
];

const TRATAMENTOS_FIELDS: FieldDef[] = [
  { key: 'g60', label: '60G (gr)' }, { key: 'g90', label: '90G (gr)' },
  { key: 'alg', label: 'ALG (lt)' }, { key: 'floc', label: 'FLOC (lt)' },
  { key: 'ppm', label: 'Tratamento (ppm)', type: 'number' },
  { key: 'tanqueCompensacao', label: 'Tanque Compensação', type: 'datetime-local' },
  { key: 'preFiltros', label: 'Pré-Filtros', type: 'datetime-local' },
  { key: 'transbordo', label: 'Transbordo', type: 'datetime-local' },
  { key: 'germicida', label: 'Germicida', type: 'datetime-local' },
];
const TRATAMENTOS_LIST: FieldDef[] = [
  { key: 'g60', label: '60G' }, { key: 'g90', label: '90G' }, { key: 'alg', label: 'ALG' }, { key: 'floc', label: 'FLOC' },
  { key: 'ppm', label: 'PPM' },
];

const ELETRICIDADE_FIELDS: FieldDef[] = [
  { key: 'vazio', label: 'Vazio KWh' }, { key: 'ponta', label: 'Ponta KWh' },
  { key: 'cheio', label: 'Cheio KWh' }, { key: 'superVazio', label: 'Super Vazio KWh' },
];

// Parâmetros de referência para águas de piscinas de uso público — usados só
// para dar um indicador visual rápido nos cartões de leituras, não substituem
// o registo oficial. CYA fica de fora: o intervalo ideal varia muito por
// instalação (UV, exterior vs interior) e não há um valor único confiável.
const PH_RANGE = { min: 7.0, max: 7.6 };
const CL_LIVRE_RANGE = { min: 1.0, max: 3.0 };
const CL_TOTAL_RANGE = { min: 1.0, max: 4.0 };

function dentroDoIntervalo(valor: string | number | undefined, range: { min: number; max: number }): 'bom' | 'mau' | 'sem-dados' {
  const num = valor !== undefined && valor !== '' ? Number(valor) : NaN;
  if (Number.isNaN(num)) return 'sem-dados';
  return num >= range.min && num <= range.max ? 'bom' : 'mau';
}

function avaliarParametros(ph?: string | number, clLivre?: string | number, clTotal?: string | number): 'bom' | 'mau' | 'sem-dados' {
  const estados = [dentroDoIntervalo(ph, PH_RANGE), dentroDoIntervalo(clLivre, CL_LIVRE_RANGE), dentroDoIntervalo(clTotal, CL_TOTAL_RANGE)];
  if (estados.every(e => e === 'sem-dados')) return 'sem-dados';
  return estados.some(e => e === 'mau') ? 'mau' : 'bom';
}

function valorClass(estado: 'bom' | 'mau' | 'sem-dados'): string {
  if (estado === 'bom') return 'text-emerald-700';
  if (estado === 'mau') return 'text-red-600';
  return 'text-[#004D71]';
}

function ParametrosBadge({ estado }: { estado: 'bom' | 'mau' | 'sem-dados' }) {
  const cfg = estado === 'sem-dados'
    ? { wrap: 'bg-slate-100 text-slate-400', dot: 'bg-slate-400', short: 'S/dados', full: 'Sem dados' }
    : estado === 'bom'
    ? { wrap: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', short: 'OK', full: 'Dentro dos parâmetros' }
    : { wrap: 'bg-red-100 text-red-700 animate-pulse', dot: 'bg-red-500', short: 'Alerta', full: 'Fora dos parâmetros' };
  return (
    <span className={`flex items-center gap-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap ${cfg.wrap}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      <span className="sm:hidden">{cfg.short}</span>
      <span className="hidden sm:inline">{cfg.full}</span>
    </span>
  );
}

function LeituraCard({ titulo, icon, wrapClass, iconClass, titleClass, temp, analise }: {
  titulo: string; icon: React.ReactNode; wrapClass: string; iconClass: string; titleClass: string;
  temp?: string | number; analise?: { ph?: string; clLivre?: string; clTotal?: string; acidoCianurico?: string };
}) {
  const estado = avaliarParametros(analise?.ph, analise?.clLivre, analise?.clTotal);
  return (
    <div className={`${wrapClass} rounded-xl pl-2.5 pr-2.5 py-2 flex items-center gap-1.5 sm:gap-3`}>
      <span className={`${iconClass} shrink-0`}>{icon}</span>
      <p className={`text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-tight leading-tight shrink-0 w-12 sm:w-28 ${titleClass}`}>{titulo}</p>

      <span className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black text-[#004D71] shrink-0">
        <Thermometer size={10} className="text-blue-500" /> {temp ? `${temp}°` : '—'}
      </span>
      <span className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold shrink-0">
        <span className="text-[6px] font-black text-orange-600 bg-orange-50 px-1 rounded border border-orange-100 leading-none py-0.5">pH</span>
        <span className={valorClass(dentroDoIntervalo(analise?.ph, PH_RANGE))}>{analise?.ph || '—'}</span>
      </span>
      <span className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold shrink-0">
        <span className="text-[6px] font-black text-slate-400 uppercase">CL</span>
        <span className={valorClass(dentroDoIntervalo(analise?.clLivre, CL_LIVRE_RANGE))}>{analise?.clLivre || '—'}</span>
      </span>
      <span className="hidden sm:flex items-center gap-0.5 text-[11px] font-bold shrink-0">
        <span className="text-[6px] font-black text-slate-400 uppercase">CT</span>
        <span className={valorClass(dentroDoIntervalo(analise?.clTotal, CL_TOTAL_RANGE))}>{analise?.clTotal || '—'}</span>
      </span>
      <span className="hidden sm:flex items-center gap-0.5 text-[11px] font-bold shrink-0">
        <span className="text-[6px] font-black text-slate-400 uppercase">CYA</span>
        <span className="text-[#004D71]">{analise?.acidoCianurico || '—'}</span>
      </span>

      <div className="shrink-0 ml-auto">
        <ParametrosBadge estado={estado} />
      </div>
    </div>
  );
}

export function MapsManager({ user, logs, tempLogs, sondasLogs = [], equipLogs = [], tratamentosLogs = [], eletricidadeLogs = [] }: {
  user: UserProfile, logs: any[], tempLogs: any[], sondasLogs?: any[], equipLogs?: any[], tratamentosLogs?: any[], eletricidadeLogs?: any[]
}) {
  const [activeArea, setActiveArea] = useState<Area>('interior');
  const [activeSection, setActiveSection] = useState<Section>('analises');
  const [activeZona, setActiveZona] = useState<Zona>('adulto');
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [analiseForm, setAnaliseForm] = useState(emptyAnaliseForm(user));
  const [tempInteriorForm, setTempInteriorForm] = useState(emptyTempInteriorForm(user));
  const [tempExteriorForm, setTempExteriorForm] = useState(emptyTempExteriorForm(user));
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFrom, setPdfFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return localDateStr(d);
  });
  const [pdfTo, setPdfTo] = useState(localDateStr());

  const activePool: Pool = activeArea === 'exterior' ? 'descoberta' : 'coberta';
  const canAdd  = ['staff', 'admin', 'professor'].includes(user?.role);
  const canEdit = ['staff', 'admin'].includes(user?.role);

  // Leituras mais recentes — vieram do cabeçalho para aqui, e a Piscina Exterior
  // passa a separar Adultos de Crianças (são tanques diferentes).
  const latestCoberta = logs.find(l => l.tipo === 'coberta');
  const latestDescobertaAdulto = logs.find(l => l.tipo === 'descoberta' && (l.zona || 'adulto') === 'adulto');
  const latestDescobertaInfantil = logs.find(l => l.tipo === 'descoberta' && l.zona === 'infantil');
  const latestTempInterior = tempLogs.find(l => l.scope === 'interior');
  const latestTempExteriorAdulto = tempLogs.find(l => l.scope === 'exterior' && (l.zona || 'adulto') === 'adulto');
  const latestTempExteriorInfantil = tempLogs.find(l => l.scope === 'exterior' && l.zona === 'infantil');

  const openNew = () => {
    setEditingId(null);
    if (activeSection === 'analises') setAnaliseForm(emptyAnaliseForm(user));
    else if (activePool === 'coberta') setTempInteriorForm(emptyTempInteriorForm(user));
    else setTempExteriorForm(emptyTempExteriorForm(user));
    setMode('form');
  };

  const openEditAnalise = (log: any) => {
    setEditingId(log.id);
    setAnaliseForm({
      data: log.data || '', hora: log.hora || '', tecnico: log.tecnico || '',
      ph: log.ph || '', clLivre: log.clLivre || '', clTotal: log.clTotal || '',
      clComb: log.clComb || '', acidoCianurico: log.acidoCianurico || '',
      banhistas: log.banhistas || '', obs: log.obs || ''
    });
    setMode('form');
  };

  const openEditTempInterior = (log: any) => {
    setEditingId(log.id);
    setTempInteriorForm({
      data: log.data || '', hora: log.hora || '', tecnico: log.tecnico || '',
      naveTemp: log.naveTemp || '', naveHumidade: log.naveHumidade || '',
      balneariosTemp: log.balneariosTemp || '', aguaPiscinaTemp: log.aguaPiscinaTemp || '',
      aqsTemp: log.aqsTemp || '', quadroTemp: log.quadroTemp || '', depositoTemp: log.depositoTemp || ''
    });
    setMode('form');
  };

  const openEditTempExterior = (log: any) => {
    setEditingId(log.id);
    setTempExteriorForm({
      data: log.data || '', hora: log.hora || '', tecnico: log.tecnico || '', temp: log.temp || ''
    });
    setMode('form');
  };

  const saveAnalise = async () => {
    try {
      const path = activePool === 'coberta' ? 'mapas_coberta' : 'mapas_descoberta';
      const extra = activePool === 'descoberta' ? { zona: activeZona } : {};
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', path, editingId), {
          ...analiseForm, ...extra,
          editedAt: Timestamp.now(),
          editedBy: user?.nome || user?.n || '',
        });
      } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', path), {
          ...analiseForm, ...extra,
          timestamp: Timestamp.now(),
          tipo: activePool,
          tecnico: user?.nome || user?.n || '',
        });
      }
      setMode('list');
      setEditingId(null);
    } catch (e) { console.error(e); }
  };

  const deleteAnalise = async (log: any) => {
    if (!window.confirm('Apagar este registo definitivamente?')) return;
    try {
      const path = log.tipo === 'coberta' ? 'mapas_coberta' : 'mapas_descoberta';
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', path, log.id));
    } catch (e) { console.error(e); }
  };

  const saveTemperatura = async () => {
    try {
      const isInterior = activePool === 'coberta';
      const path = isInterior ? 'mapas_interior_temperaturas' : 'mapas_exterior_temperaturas';
      const form = isInterior ? tempInteriorForm : tempExteriorForm;
      const extra = isInterior ? {} : { zona: activeZona };
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', path, editingId), {
          ...form, ...extra,
          editedAt: Timestamp.now(),
          editedBy: user?.nome || user?.n || '',
        });
      } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', path), {
          ...form, ...extra,
          timestamp: Timestamp.now(),
          tecnico: user?.nome || user?.n || '',
        });
      }
      setMode('list');
      setEditingId(null);
    } catch (e) { console.error(e); }
  };

  const deleteTemperatura = async (log: any, isInterior: boolean) => {
    if (!window.confirm('Apagar este registo definitivamente?')) return;
    try {
      const path = isInterior ? 'mapas_interior_temperaturas' : 'mapas_exterior_temperaturas';
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', path, log.id));
    } catch (e) { console.error(e); }
  };

  const poolAnalises = useMemo(() => {
    const filtered = logs.filter(l => l.tipo === activePool);
    return activePool === 'descoberta' ? filtered.filter(l => (l.zona || 'adulto') === activeZona) : filtered;
  }, [logs, activePool, activeZona]);

  const poolTemperaturas = useMemo(() => {
    if (activePool === 'coberta') return tempLogs.filter(l => l.scope === 'interior');
    return tempLogs.filter(l => l.scope === 'exterior' && (l.zona || 'adulto') === activeZona);
  }, [tempLogs, activePool, activeZona]);

  const equipRecords = useMemo(() => equipLogs.filter(l => l.scope === activeArea), [equipLogs, activeArea]);
  const tratamentosRecords = useMemo(() => tratamentosLogs.filter(l => l.scope === activeArea), [tratamentosLogs, activeArea]);

  const exportPdf = () => {
    const inRange = (d: string) => d >= pdfFrom && d <= pdfTo;
    const fmtDate = (iso: string) => iso.split('-').reverse().join('/');
    const byDateAsc = (a: any, b: any) => ((a.data || '') < (b.data || '') ? -1 : 1);

    const analisesInterior = logs.filter(l => l.tipo === 'coberta' && inRange(l.data || '')).sort(byDateAsc);
    const analisesExteriorAdulto = logs.filter(l => l.tipo === 'descoberta' && (l.zona || 'adulto') === 'adulto' && inRange(l.data || '')).sort(byDateAsc);
    const analisesExteriorInfantil = logs.filter(l => l.tipo === 'descoberta' && l.zona === 'infantil' && inRange(l.data || '')).sort(byDateAsc);
    const tempInterior = tempLogs.filter(l => l.scope === 'interior' && inRange(l.data || '')).sort(byDateAsc);
    const tempExteriorAdulto = tempLogs.filter(l => l.scope === 'exterior' && (l.zona || 'adulto') === 'adulto' && inRange(l.data || '')).sort(byDateAsc);
    const tempExteriorInfantil = tempLogs.filter(l => l.scope === 'exterior' && l.zona === 'infantil' && inRange(l.data || '')).sort(byDateAsc);
    const sondas = sondasLogs.filter(l => inRange(l.data || '')).sort(byDateAsc);
    const equipInterior = equipLogs.filter(l => l.scope === 'interior' && inRange(l.data || '')).sort(byDateAsc);
    const equipExterior = equipLogs.filter(l => l.scope === 'exterior' && inRange(l.data || '')).sort(byDateAsc);
    const tratInterior = tratamentosLogs.filter(l => l.scope === 'interior' && inRange(l.data || '')).sort(byDateAsc);
    const tratExterior = tratamentosLogs.filter(l => l.scope === 'exterior' && inRange(l.data || '')).sort(byDateAsc);
    const eletricidade = eletricidadeLogs.filter(l => inRange(l.data || '')).sort(byDateAsc);

    const pdf = new jsPDF({ orientation: 'landscape' });

    pdf.setFontSize(16);
    pdf.setTextColor(0, 77, 113);
    pdf.text('Mapas Oficiais — Complexo Desportivo de Vila de Rei', 14, 16);

    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`Período: ${fmtDate(pdfFrom)} a ${fmtDate(pdfTo)}`, 14, 23);
    pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}  |  Por: ${user.nome || user.n || ''}`, 14, 28);

    let y = 34;

    const addSection = (title: string, head: string[], rows: any[][]) => {
      if (y > 170) { pdf.addPage(); y = 18; }
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
        head: [head],
        body: rows,
        headStyles: { fillColor: [0, 77, 113], textColor: [247, 181, 0], fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      });
      y = (pdf as any).lastAutoTable.finalY + 14;
    };

    const analiseRows = (rows: any[]) => rows.map(l => {
      const { data, hora } = fmtDateTime(l.timestamp, l.data, l.hora);
      return [data, hora, l.tecnico || '—', l.ph || '—', l.clLivre || '—', l.clTotal || '—', l.clComb || '—',
        l.acidoCianurico || '—', l.banhistas || '—', l.obs || '—'];
    });
    const analiseHead = ['Data', 'Hora', 'Técnico', 'pH', 'Cloro', 'Cloro Total', 'Cloro Comb.', 'CYA', 'Banh.', 'Obs'];

    addSection('Piscina Interior — Análises', analiseHead, analiseRows(analisesInterior));
    addSection('Piscina Exterior — Análises (Adulto)', analiseHead, analiseRows(analisesExteriorAdulto));
    addSection('Piscina Exterior — Análises (Infantil)', analiseHead, analiseRows(analisesExteriorInfantil));

    addSection('Piscina Interior — Temperaturas', ['Data', 'Hora', 'Técnico', 'Nave', 'Hum. Nave', 'Balneários', 'Água Piscina', 'AQS', 'Quadro', 'Depósito'],
      tempInterior.map(l => {
        const { data, hora } = fmtDateTime(l.timestamp, l.data, l.hora);
        return [data, hora, l.tecnico || '—', l.naveTemp ? `${l.naveTemp}°C` : '—', l.naveHumidade ? `${l.naveHumidade}%` : '—',
          l.balneariosTemp ? `${l.balneariosTemp}°C` : '—', l.aguaPiscinaTemp ? `${l.aguaPiscinaTemp}°C` : '—',
          l.aqsTemp ? `${l.aqsTemp}°C` : '—', l.quadroTemp ? `${l.quadroTemp}°C` : '—', l.depositoTemp ? `${l.depositoTemp}°C` : '—'];
      }));

    const tempZonaRows = (rows: any[]) => rows.map(l => {
      const { data, hora } = fmtDateTime(l.timestamp, l.data, l.hora);
      return [data, hora, l.tecnico || '—', l.temp ? `${l.temp}°C` : '—'];
    });
    addSection('Piscina Exterior — Temperaturas (Adulto)', ['Data', 'Hora', 'Técnico', 'Temp.'], tempZonaRows(tempExteriorAdulto));
    addSection('Piscina Exterior — Temperaturas (Infantil)', ['Data', 'Hora', 'Técnico', 'Temp.'], tempZonaRows(tempExteriorInfantil));

    addSection('Piscina Interior — Sondas', ['Data', 'Hora', 'Técnico', 'Cloro', 'PH'], sondas.map(l => {
      const { data, hora } = fmtDateTime(l.timestamp, l.data, l.hora);
      return [data, hora, l.tecnico || '—', l.cloro || '—', l.ph || '—'];
    }));

    const equipHeadInterior = ['Data', 'Hora', 'Técnico', 'VEVs %', 'Filtro1 E/S', 'Filtro2 E/S', 'Caldeira1', 'Caldeira2', 'Gás m³', 'Água Pisc.', 'Água Geral'];
    addSection('Piscina Interior — Equipamentos', equipHeadInterior, equipInterior.map(l => {
      const { data, hora } = fmtDateTime(l.timestamp, l.data, l.hora);
      return [data, hora, l.tecnico || '—', l.vevsFrequencia || '—',
        `${l.f1Entrada || '—'}/${l.f1Saida || '—'}`, `${l.f2Entrada || '—'}/${l.f2Saida || '—'}`,
        l.cald1Temp ? `${l.cald1Estado || ''} ${l.cald1Temp}°C` : '—', l.cald2Temp ? `${l.cald2Estado || ''} ${l.cald2Temp}°C` : '—',
        l.gas || '—', l.aguaPiscina || '—', l.aguaGeral || '—'];
    }));

    const equipHeadExterior = ['Data', 'Hora', 'Técnico', 'VEVs %', 'Filtro1 E/S', 'Filtro2 E/S', 'Vigilante Cl/pH', 'UV Horas', 'Água Pisc.', 'Água Geral/Cais', 'Água Polidesp.'];
    addSection('Piscina Exterior — Equipamentos', equipHeadExterior, equipExterior.map(l => {
      const { data, hora } = fmtDateTime(l.timestamp, l.data, l.hora);
      return [data, hora, l.tecnico || '—', l.vevsFrequencia || '—',
        `${l.f1Entrada || '—'}/${l.f1Saida || '—'}`, `${l.f2Entrada || '—'}/${l.f2Saida || '—'}`,
        `${l.vigCloro || '—'}/${l.vigPh || '—'}`, l.uvHorasTot || '—', l.aguaPiscina || '—', l.aguaGeralCais || '—', l.aguaPolidesportivo || '—'];
    }));

    const tratHead = ['Data', 'Hora', 'Técnico', '60G', '90G', 'ALG', 'FLOC', 'PPM', 'Tanque Comp.', 'Pré-Filtros', 'Transbordo', 'Germicida'];
    const tratRows = (rows: any[]) => rows.map(l => {
      const { data, hora } = fmtDateTime(l.timestamp, l.data, l.hora);
      return [data, hora, l.tecnico || '—', l.g60 || '—', l.g90 || '—', l.alg || '—', l.floc || '—', l.ppm || '—',
        l.tanqueCompensacao || '—', l.preFiltros || '—', l.transbordo || '—', l.germicida || '—'];
    });
    addSection('Piscina Interior — Tratamentos', tratHead, tratRows(tratInterior));
    addSection('Piscina Exterior — Tratamentos', tratHead, tratRows(tratExterior));

    addSection('Eletricidade', ['Data', 'Hora', 'Técnico', 'Vazio KWh', 'Ponta KWh', 'Cheio KWh', 'Super Vazio KWh'], eletricidade.map(l => {
      const { data, hora } = fmtDateTime(l.timestamp, l.data, l.hora);
      return [data, hora, l.tecnico || '—', l.vazio || '—', l.ponta || '—', l.cheio || '—', l.superVazio || '—'];
    }));

    pdf.save(`mapas_${pdfFrom}_a_${pdfTo}.pdf`);
    setShowPdfModal(false);
  };

  const sections = activeArea === 'interior' ? SECTIONS_INTERIOR : SECTIONS_EXTERIOR;

  return (
    <div className="space-y-6 animate-in fade-in pb-24 px-2 text-left">

      {/* Leituras atuais — Coberta / Exterior Adultos / Exterior Crianças */}
      <div className="flex flex-col gap-2">
        <LeituraCard
          titulo="Coberta"
          icon={<Waves size={18} />}
          wrapClass="bg-blue-50 border border-blue-100"
          iconClass="text-[#004D71]"
          titleClass="text-[#004D71]"
          temp={latestTempInterior?.aguaPiscinaTemp}
          analise={latestCoberta}
        />
        <LeituraCard
          titulo="Ext. Adultos"
          icon={<Sun size={18} />}
          wrapClass="bg-amber-50 border border-amber-100"
          iconClass="text-[#F7B500]"
          titleClass="text-amber-800"
          temp={latestTempExteriorAdulto?.temp}
          analise={latestDescobertaAdulto}
        />
        <LeituraCard
          titulo="Ext. Crianças"
          icon={<Sun size={18} />}
          wrapClass="bg-cyan-50 border border-cyan-100"
          iconClass="text-cyan-500"
          titleClass="text-cyan-800"
          temp={latestTempExteriorInfantil?.temp}
          analise={latestDescobertaInfantil}
        />
      </div>

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
              Inclui todas as secções de Mapas (ambas as piscinas + eletricidade) no período selecionado.
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
          <button onClick={() => setShowPdfModal(true)} className="bg-slate-100 text-[#004D71] p-3 rounded-2xl active:scale-95 hover:bg-slate-200 transition-colors" title="Exportar PDF">
            <FileText size={20}/>
          </button>
          {canAdd && activeArea !== 'eletricidade' && (activeSection === 'analises' || activeSection === 'temperaturas') && mode === 'list' && (
            <button onClick={openNew} className="bg-[#004D71] text-[#F7B500] p-3 rounded-2xl shadow-lg active:scale-95">
              <Plus size={20}/>
            </button>
          )}
          {activeArea !== 'eletricidade' && (activeSection === 'analises' || activeSection === 'temperaturas') && mode === 'form' && (
            <button onClick={() => { setMode('list'); setEditingId(null); }} className="bg-slate-100 text-[#004D71] p-3 rounded-2xl active:scale-95">
              <X size={20}/>
            </button>
          )}
        </div>
      </div>

      {/* Separador principal: Piscina Interior / Exterior / Eletricidade */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
        <button onClick={() => { setActiveArea('interior'); setActiveSection('analises'); setMode('list'); }} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeArea === 'interior' ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'text-slate-400'}`}>Piscina Interior</button>
        <button onClick={() => { setActiveArea('exterior'); setActiveSection('analises'); setMode('list'); }} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeArea === 'exterior' ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'text-slate-400'}`}>Piscina Exterior</button>
        <button onClick={() => { setActiveArea('eletricidade'); setMode('list'); }} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeArea === 'eletricidade' ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'text-slate-400'}`}>Eletricidade</button>
      </div>

      {activeArea !== 'eletricidade' && (
        <>
          {/* Separador para preenchimento: secções */}
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
            {sections.map(sec => (
              <button key={sec.id} onClick={() => { setActiveSection(sec.id); setMode('list'); }}
                className={`shrink-0 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${activeSection === sec.id ? 'bg-[#F7B500] text-[#004D71] shadow' : 'bg-slate-50 text-slate-400'}`}>
                {sec.label}
              </button>
            ))}
          </div>

          {/* Zona: Adulto / Infantil (só exterior, só Análises/Temperaturas) */}
          {activeArea === 'exterior' && (activeSection === 'analises' || activeSection === 'temperaturas') && (
            <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
              <button onClick={() => { setActiveZona('adulto'); setMode('list'); }} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${activeZona === 'adulto' ? 'bg-white text-[#004D71] shadow' : 'text-slate-400'}`}>Adulto</button>
              <button onClick={() => { setActiveZona('infantil'); setMode('list'); }} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${activeZona === 'infantil' ? 'bg-white text-[#004D71] shadow' : 'text-slate-400'}`}>Infantil</button>
            </div>
          )}
        </>
      )}

      {activeArea === 'eletricidade' ? (
        <SimpleLogSection user={user} path="mapas_eletricidade" records={eletricidadeLogs} fields={ELETRICIDADE_FIELDS} listFields={ELETRICIDADE_FIELDS} canAdd={canAdd} canEdit={canEdit} title="Eletricidade" />
      ) : activeSection === 'sondas' ? (
        <SimpleLogSection user={user} path="mapas_interior_sondas" records={sondasLogs} fields={SONDAS_FIELDS} listFields={SONDAS_FIELDS} canAdd={canAdd} canEdit={canEdit} title="Sondas" />
      ) : activeSection === 'equipamentos' ? (
        <SimpleLogSection user={user} path={`mapas_${activeArea}_equipamentos`} records={equipRecords}
          fields={activeArea === 'interior' ? EQUIP_INTERIOR_FIELDS : EQUIP_EXTERIOR_FIELDS}
          listFields={activeArea === 'interior' ? EQUIP_INTERIOR_LIST : EQUIP_EXTERIOR_LIST}
          canAdd={canAdd} canEdit={canEdit} title="Equipamentos" />
      ) : activeSection === 'tratamentos' ? (
        <SimpleLogSection user={user} path={`mapas_${activeArea}_tratamentos`} records={tratamentosRecords}
          fields={TRATAMENTOS_FIELDS} listFields={TRATAMENTOS_LIST} canAdd={canAdd} canEdit={canEdit} title="Tratamentos" />
      ) : activeSection === 'analises' ? (
        mode === 'form' ? (
          <div className="bg-white rounded-[2.5rem] p-6 border-2 border-slate-50 shadow-sm space-y-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {editingId ? 'Corrigir registo' : 'Novo registo'} · Análises
            </p>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Data" type="date" value={analiseForm.data} onChange={v => setAnaliseForm({...analiseForm, data: v})} />
              <FormInput label="Hora" type="time" value={analiseForm.hora} onChange={v => setAnaliseForm({...analiseForm, hora: v})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Cloro" value={analiseForm.clLivre} onChange={v => setAnaliseForm({...analiseForm, clLivre: v})} />
              <FormInput label="Valor pH" value={analiseForm.ph} onChange={v => setAnaliseForm({...analiseForm, ph: v})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Cloro Total" value={analiseForm.clTotal} onChange={v => setAnaliseForm({...analiseForm, clTotal: v})} />
              <FormInput label="CYA" value={analiseForm.acidoCianurico} onChange={v => setAnaliseForm({...analiseForm, acidoCianurico: v})} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t-2 border-slate-50">
              <FormInput label="Cloro Combinado" value={analiseForm.clComb} onChange={v => setAnaliseForm({...analiseForm, clComb: v})} />
              <FormInput label="Nº Banhistas" type="number" value={analiseForm.banhistas} onChange={v => setAnaliseForm({...analiseForm, banhistas: v})} />
            </div>
            <FormInput label="Observações / Anomalias" multiline value={analiseForm.obs} onChange={v => setAnaliseForm({...analiseForm, obs: v})} />
            <button onClick={saveAnalise} className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
              <Save size={20}/> {editingId ? 'Guardar Correção' : 'Gravar Registo'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {poolAnalises.map((log, i) => {
              const { data, hora } = fmtDateTime(log.timestamp, log.data, log.hora);
              return (
                <div key={i} className="flex items-center gap-3 bg-white rounded-[1.5rem] px-4 py-3 border-2 border-slate-50 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black text-[#004D71] tabular-nums whitespace-nowrap">{data} {hora}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{log.tecnico}</span>
                      {log.editedBy && (
                        <span className="text-[8px] text-orange-400 font-bold uppercase">✎ {log.editedBy}</span>
                      )}
                    </div>
                  </div>
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
                      <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Cl Tot.</span>
                      <span className="text-sm font-black text-[#004D71] tabular-nums">{log.clTotal || '—'}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">CYA</span>
                      <span className="text-sm font-black text-[#004D71] tabular-nums">{log.acidoCianurico || '—'}</span>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditAnalise(log)} className="p-2 text-slate-300 hover:text-[#004D71] hover:bg-slate-50 rounded-xl transition-colors" title="Corrigir">
                          <Edit2 size={14}/>
                        </button>
                        <button onClick={() => deleteAnalise(log)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Apagar">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {poolAnalises.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/50">
                <FileText size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="font-black text-slate-300 uppercase text-[10px] tracking-widest">Aguardar registos</p>
              </div>
            )}
          </div>
        )
      ) : (
        mode === 'form' ? (
          activePool === 'coberta' ? (
            <div className="bg-white rounded-[2.5rem] p-6 border-2 border-slate-50 shadow-sm space-y-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {editingId ? 'Corrigir registo' : 'Novo registo'} · Temperaturas
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Data" type="date" value={tempInteriorForm.data} onChange={v => setTempInteriorForm({...tempInteriorForm, data: v})} />
                <FormInput label="Hora" type="time" value={tempInteriorForm.hora} onChange={v => setTempInteriorForm({...tempInteriorForm, hora: v})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Nave (ºC)" value={tempInteriorForm.naveTemp} onChange={v => setTempInteriorForm({...tempInteriorForm, naveTemp: v})} />
                <FormInput label="Nave (Humidade %)" value={tempInteriorForm.naveHumidade} onChange={v => setTempInteriorForm({...tempInteriorForm, naveHumidade: v})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Balneários (ºC)" value={tempInteriorForm.balneariosTemp} onChange={v => setTempInteriorForm({...tempInteriorForm, balneariosTemp: v})} />
                <FormInput label="Água Piscina (ºC)" value={tempInteriorForm.aguaPiscinaTemp} onChange={v => setTempInteriorForm({...tempInteriorForm, aguaPiscinaTemp: v})} />
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t-2 border-slate-50">
                <FormInput label="AQS (ºC)" value={tempInteriorForm.aqsTemp} onChange={v => setTempInteriorForm({...tempInteriorForm, aqsTemp: v})} />
                <FormInput label="Quadro (ºC)" value={tempInteriorForm.quadroTemp} onChange={v => setTempInteriorForm({...tempInteriorForm, quadroTemp: v})} />
                <FormInput label="Depósito (ºC)" value={tempInteriorForm.depositoTemp} onChange={v => setTempInteriorForm({...tempInteriorForm, depositoTemp: v})} />
              </div>
              <button onClick={saveTemperatura} className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                <Save size={20}/> {editingId ? 'Guardar Correção' : 'Gravar Registo'}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] p-6 border-2 border-slate-50 shadow-sm space-y-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {editingId ? 'Corrigir registo' : 'Novo registo'} · Temperaturas ({activeZona === 'adulto' ? 'Adulto' : 'Infantil'})
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Data" type="date" value={tempExteriorForm.data} onChange={v => setTempExteriorForm({...tempExteriorForm, data: v})} />
                <FormInput label="Hora" type="time" value={tempExteriorForm.hora} onChange={v => setTempExteriorForm({...tempExteriorForm, hora: v})} />
              </div>
              <FormInput label="Temperatura (ºC)" value={tempExteriorForm.temp} onChange={v => setTempExteriorForm({...tempExteriorForm, temp: v})} />
              <button onClick={saveTemperatura} className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                <Save size={20}/> {editingId ? 'Guardar Correção' : 'Gravar Registo'}
              </button>
            </div>
          )
        ) : (
          <div className="space-y-2">
            {poolTemperaturas.map((log, i) => {
              const { data, hora } = fmtDateTime(log.timestamp, log.data, log.hora);
              return (
                <div key={i} className="flex items-center gap-3 bg-white rounded-[1.5rem] px-4 py-3 border-2 border-slate-50 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black text-[#004D71] tabular-nums whitespace-nowrap">{data} {hora}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{log.tecnico}</span>
                      {log.editedBy && (
                        <span className="text-[8px] text-orange-400 font-bold uppercase">✎ {log.editedBy}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 overflow-x-auto hide-scrollbar">
                    {activePool === 'coberta' ? (
                      <>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Nave</span>
                          <span className="text-sm font-black text-[#004D71] tabular-nums">{log.naveTemp ? `${log.naveTemp}°` : '—'}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Balneários</span>
                          <span className="text-sm font-black text-[#004D71] tabular-nums">{log.balneariosTemp ? `${log.balneariosTemp}°` : '—'}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Água</span>
                          <span className="text-sm font-black text-orange-600 tabular-nums">{log.aguaPiscinaTemp ? `${log.aguaPiscinaTemp}°` : '—'}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Temp.</span>
                        <span className="text-sm font-black text-orange-600 tabular-nums">{log.temp ? `${log.temp}°` : '—'}</span>
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => activePool === 'coberta' ? openEditTempInterior(log) : openEditTempExterior(log)} className="p-2 text-slate-300 hover:text-[#004D71] hover:bg-slate-50 rounded-xl transition-colors" title="Corrigir">
                          <Edit2 size={14}/>
                        </button>
                        <button onClick={() => deleteTemperatura(log, activePool === 'coberta')} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Apagar">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {poolTemperaturas.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/50">
                <FileText size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="font-black text-slate-300 uppercase text-[10px] tracking-widest">Aguardar registos</p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

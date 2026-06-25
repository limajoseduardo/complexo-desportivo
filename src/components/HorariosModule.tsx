import React, { useEffect, useState } from 'react';
import { Clock, Sun, Snowflake, Save, Loader, Plus, Trash2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';

type Periodo = { abertura: string; fecho: string };
// Cada dia pode ter mais do que um período (ex.: manhã + tarde, com intervalo
// de almoço pelo meio) — "fechado" só é verdadeiro quando não há nenhum período.
type DiaHorario = { periodos: Periodo[]; fechado: boolean };
type Temporada = Record<string, DiaHorario>;
interface Horarios {
  temporadaAtiva: 'verao' | 'inverno';
  verao: Temporada;
  inverno: Temporada;
}

const DIAS = [
  { id: '1', label: 'Segunda' },
  { id: '2', label: 'Terça' },
  { id: '3', label: 'Quarta' },
  { id: '4', label: 'Quinta' },
  { id: '5', label: 'Sexta' },
  { id: '6', label: 'Sábado' },
  { id: '7', label: 'Domingo' },
];

const PERIODO_VAZIO: Periodo = { abertura: '08:00', fecho: '21:00' };
const DIA_VAZIO: DiaHorario = { periodos: [{ ...PERIODO_VAZIO }], fechado: false };

const horariosPath = () => `artifacts/${APP_ID}/public/data/config`;

function defaultHorarios(): Horarios {
  const semana: Temporada = {};
  DIAS.forEach(d => { semana[d.id] = { periodos: [{ ...PERIODO_VAZIO }], fechado: false }; });
  return { temporadaAtiva: 'verao', verao: { ...semana }, inverno: { ...semana } };
}

// Compatibilidade com o formato antigo (um único {abertura, fecho, fechado} por
// dia, sem array de períodos), para não rebentar com dados já guardados.
function normalizeDia(raw: any): DiaHorario {
  if (!raw) return { ...DIA_VAZIO };
  if (Array.isArray(raw.periodos)) return { periodos: raw.periodos, fechado: !!raw.fechado };
  if (raw.abertura && raw.fecho) return { periodos: [{ abertura: raw.abertura, fecho: raw.fecho }], fechado: !!raw.fechado };
  return { ...DIA_VAZIO, fechado: !!raw.fechado };
}

function normalizeHorarios(data: any): Horarios {
  const normSemana = (semana: any): Temporada => {
    const out: Temporada = {};
    DIAS.forEach(d => { out[d.id] = normalizeDia(semana?.[d.id]); });
    return out;
  };
  return {
    temporadaAtiva: data?.temporadaAtiva === 'inverno' ? 'inverno' : 'verao',
    verao: normSemana(data?.verao),
    inverno: normSemana(data?.inverno),
  };
}

function useHorarios() {
  const [horarios, setHorarios] = useState<Horarios | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, horariosPath(), 'horarios'))
      .then(snap => setHorarios(snap.exists() ? normalizeHorarios(snap.data()) : defaultHorarios()))
      .catch(() => setHorarios(defaultHorarios()))
      .finally(() => setLoading(false));
  }, []);

  return { horarios, setHorarios, loading };
}

const todayDiaId = () => {
  const js = new Date().getDay(); // 0=domingo
  return js === 0 ? '7' : String(js);
};

function periodosLabel(dia: DiaHorario): string {
  if (dia.fechado || dia.periodos.length === 0) return 'Fechado';
  return dia.periodos.map(p => `${p.abertura} – ${p.fecho}`).join(' / ');
}

export function HorariosCard() {
  const { horarios, loading } = useHorarios();
  if (loading || !horarios) return null;

  const temporada = horarios[horarios.temporadaAtiva] || {};
  const hoje = temporada[todayDiaId()];

  return (
    <div className="bg-white rounded-[2rem] border-2 border-slate-50 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2">
          <Clock size={15} className="text-[#F7B500]" /> Horário do Complexo
        </h3>
        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-400">
          {horarios.temporadaAtiva === 'verao' ? <Sun size={12} className="text-amber-500" /> : <Snowflake size={12} className="text-sky-500" />}
          {horarios.temporadaAtiva === 'verao' ? 'Verão' : 'Inverno'}
        </span>
      </div>

      {hoje && (
        <p className="text-[11px] font-bold text-slate-500 mb-3">
          Hoje: {hoje.fechado ? <span className="text-red-500 font-black">Fechado</span> : <span className="text-emerald-600 font-black">{periodosLabel(hoje)}</span>}
        </p>
      )}

      <div className="space-y-1">
        {DIAS.map(d => {
          const h = temporada[d.id];
          const isToday = d.id === todayDiaId();
          return (
            <div key={d.id} className={`flex items-center justify-between px-3 py-1.5 rounded-xl ${isToday ? 'bg-[#004D71]/5' : ''}`}>
              <span className={`text-[10px] font-black uppercase ${isToday ? 'text-[#004D71]' : 'text-slate-400'}`}>{d.label}</span>
              <span className={`text-[10px] font-bold tabular-nums ${h?.fechado ? 'text-red-400' : 'text-slate-600'}`}>
                {h ? periodosLabel(h) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HorariosManager() {
  const { horarios, setHorarios, loading } = useHorarios();
  const [temporadaEdit, setTemporadaEdit] = useState<'verao' | 'inverno'>('verao');
  const [saving, setSaving] = useState(false);

  if (loading || !horarios) {
    return <div className="p-8 text-center text-slate-400 text-xs font-black uppercase">A carregar...</div>;
  }

  const setDiaFechado = (diaId: string, fechado: boolean) => {
    setHorarios(prev => prev && ({
      ...prev,
      [temporadaEdit]: { ...prev[temporadaEdit], [diaId]: { ...prev[temporadaEdit][diaId], fechado } },
    }));
  };

  const setPeriodo = (diaId: string, index: number, field: keyof Periodo, value: string) => {
    setHorarios(prev => {
      if (!prev) return prev;
      const dia = prev[temporadaEdit][diaId];
      const periodos = dia.periodos.map((p, i) => i === index ? { ...p, [field]: value } : p);
      return { ...prev, [temporadaEdit]: { ...prev[temporadaEdit], [diaId]: { ...dia, periodos } } };
    });
  };

  const addPeriodo = (diaId: string) => {
    setHorarios(prev => {
      if (!prev) return prev;
      const dia = prev[temporadaEdit][diaId];
      const last = dia.periodos[dia.periodos.length - 1];
      const novo: Periodo = { abertura: last?.fecho || '14:00', fecho: '21:00' };
      return { ...prev, [temporadaEdit]: { ...prev[temporadaEdit], [diaId]: { ...dia, periodos: [...dia.periodos, novo] } } };
    });
  };

  const removePeriodo = (diaId: string, index: number) => {
    setHorarios(prev => {
      if (!prev) return prev;
      const dia = prev[temporadaEdit][diaId];
      if (dia.periodos.length <= 1) return prev;
      return { ...prev, [temporadaEdit]: { ...prev[temporadaEdit], [diaId]: { ...dia, periodos: dia.periodos.filter((_, i) => i !== index) } } };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, horariosPath(), 'horarios'), horarios);
    } catch (e) {
      console.error('Erro ao guardar horários:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24 px-2">
      <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
        <Clock className="text-[#F7B500]" /> Horários do Complexo
      </h2>

      <div className="bg-white rounded-2xl p-4 border-2 border-slate-50 shadow-sm flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temporada ativa (vista pelos utentes)</p>
        <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
          <button onClick={() => setHorarios(prev => prev && ({ ...prev, temporadaAtiva: 'verao' }))}
            className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase flex items-center gap-1.5 ${horarios.temporadaAtiva === 'verao' ? 'bg-[#004D71] text-[#F7B500] shadow' : 'text-slate-400'}`}>
            <Sun size={12} /> Verão
          </button>
          <button onClick={() => setHorarios(prev => prev && ({ ...prev, temporadaAtiva: 'inverno' }))}
            className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase flex items-center gap-1.5 ${horarios.temporadaAtiva === 'inverno' ? 'bg-[#004D71] text-[#F7B500] shadow' : 'text-slate-400'}`}>
            <Snowflake size={12} /> Inverno
          </button>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
        <button onClick={() => setTemporadaEdit('verao')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${temporadaEdit === 'verao' ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'text-slate-400'}`}>Editar Verão</button>
        <button onClick={() => setTemporadaEdit('inverno')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${temporadaEdit === 'inverno' ? 'bg-[#004D71] text-[#F7B500] shadow-md' : 'text-slate-400'}`}>Editar Inverno</button>
      </div>

      <div className="bg-white rounded-[2rem] border-2 border-slate-50 shadow-sm p-5 space-y-3">
        {DIAS.map(d => {
          const dia = horarios[temporadaEdit][d.id] || DIA_VAZIO;
          return (
            <div key={d.id} className="flex flex-col sm:flex-row sm:items-start gap-2 py-2 border-b border-slate-50 last:border-0">
              <span className="w-20 shrink-0 text-[10px] font-black text-[#004D71] uppercase pt-2">{d.label}</span>

              {dia.fechado ? (
                <span className="flex-1 text-[10px] font-black text-red-400 uppercase pt-2">Fechado</span>
              ) : (
                <div className="flex-1 space-y-1.5">
                  {dia.periodos.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="time" value={p.abertura} onChange={e => setPeriodo(d.id, i, 'abertura', e.target.value)}
                        className="px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-black text-[#004D71] outline-none focus:border-[#004D71]/30" />
                      <span className="text-slate-300 text-[10px]">–</span>
                      <input type="time" value={p.fecho} onChange={e => setPeriodo(d.id, i, 'fecho', e.target.value)}
                        className="px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-black text-[#004D71] outline-none focus:border-[#004D71]/30" />
                      {i === dia.periodos.length - 1 ? (
                        <button type="button" onClick={() => addPeriodo(d.id)} title="Adicionar período (ex.: separar para o intervalo de almoço)"
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                          <Plus size={13} />
                        </button>
                      ) : null}
                      {dia.periodos.length > 1 && (
                        <button type="button" onClick={() => removePeriodo(d.id, i)} title="Remover período"
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  {dia.periodos.length > 1 && (
                    <p className="text-[8px] font-bold text-slate-300 uppercase">Com intervalo entre {dia.periodos[0].fecho} e {dia.periodos[1].abertura}</p>
                  )}
                </div>
              )}

              <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase cursor-pointer shrink-0 pt-2">
                <input type="checkbox" checked={dia.fechado} onChange={e => setDiaFechado(d.id, e.target.checked)} className="w-3.5 h-3.5" />
                Fechado
              </label>
            </div>
          );
        })}
      </div>

      <button onClick={save} disabled={saving}
        className="w-full bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50">
        {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />} Guardar Horários
      </button>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Users2, Dumbbell, Waves, Flame, Droplet, Activity } from 'lucide-react';
import { collection, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Aula, UserProfile } from '../types';
import { isUserInZone } from '../lib/logic';

interface EntranceDashboardProps {
  appId: string;
  onBack?: () => void;
}

const formatTime = (date: Date) => date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const formatDate = (date: Date) => date.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const getTodayNumber = (date: Date) => date.getDay() === 0 ? 7 : date.getDay();
const EXCLUDE_MODALITIES = ['ginásio livre', 'ginasio livre', 'piscina livre'];

export const EntranceDashboard = React.memo(({ appId, onBack }: EntranceDashboardProps) => {
  const [now, setNow] = useState(new Date());
  const [utentesInside, setUtentesInside] = useState<UserProfile[]>([]);
  const [cobertaLogs, setCobertaLogs] = useState<any[]>([]);
  const [descobertaLogs, setDescobertaLogs] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<Aula[]>([]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const usersPath = `artifacts/${appId}/public/data/users`;
    const qInside = query(collection(db, usersPath), where('isInside', '==', true));
    let fallbackUnsub: (() => void) | null = null;
    const unsub = onSnapshot(qInside, (snap) => {
      setUtentesInside(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    }, () => {
      const qFallback = query(collection(db, usersPath), limit(500));
      fallbackUnsub = onSnapshot(qFallback, (snap) => {
        setUtentesInside(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)).filter(u => u.isInside));
      });
    });
    return () => { unsub(); fallbackUnsub?.(); };
  }, [appId]);

  useEffect(() => {
    const path = `artifacts/${appId}/public/data/mapas_coberta`;
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(3));
    return onSnapshot(q, (snap) => { setCobertaLogs(snap.docs.map(d => d.data())); });
  }, [appId]);

  useEffect(() => {
    const path = `artifacts/${appId}/public/data/mapas_descoberta`;
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(3));
    return onSnapshot(q, (snap) => { setDescobertaLogs(snap.docs.map(d => d.data())); });
  }, [appId]);

  useEffect(() => {
    const path = `artifacts/${appId}/public/data/agenda`;
    const q = query(collection(db, path), orderBy('horaInicio', 'asc'));
    return onSnapshot(q, (snap) => {
      setAgenda(snap.docs.map(d => ({ id: d.id, ...d.data() } as Aula)));
    });
  }, [appId]);

  const todayNumber = getTodayNumber(now);

  const zones = useMemo(() => [
    { id: 'pool_in',  label: 'Piscina Coberta',  icon: <Waves size={28} />,    color: 'text-sky-400',    bg: 'bg-sky-400/10' },
    { id: 'gym',      label: 'Ginásio',          icon: <Dumbbell size={28} />, color: 'text-[#F7B500]',  bg: 'bg-[#F7B500]/10' },
    { id: 'fit',      label: 'Aulas Fitness',    icon: <Activity size={28} />, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { id: 'sauna',    label: 'Sauna',            icon: <Flame size={28} />,    color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { id: 'pool_out', label: 'Piscina Exterior', icon: <Waves size={28} />,    color: 'text-emerald-400',bg: 'bg-emerald-400/10' },
  ], []);

  const zoneCounts = useMemo(() =>
    zones.map(z => ({ ...z, count: utentesInside.filter(u => isUserInZone(u, z.id)).length })),
    [utentesInside, zones]
  );

  const total = utentesInside.length;

  const todayClasses = useMemo(() =>
    agenda
      .filter(a => a.diaSemana === todayNumber)
      .filter(a => !EXCLUDE_MODALITIES.includes((a.modalidade || '').toLowerCase().trim()))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [agenda, todayNumber]
  );

  return (
    <div className="fixed inset-0 bg-[#003a55] text-white font-sans overflow-hidden flex flex-col">

      {/* HEADER — relógio, data e botão voltar */}
      <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 md:gap-6">
          {onBack && (
            <button onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl md:rounded-2xl px-3 md:px-5 py-2 md:py-2.5 font-black text-xs md:text-base uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95">
              ← Voltar
            </button>
          )}
          <div>
            <p className="text-[8px] md:text-xs font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5 md:mb-1">Complexo Desportivo · Vila de Rei</p>
            <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight text-white leading-none">VILA VIDA</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl md:text-4xl lg:text-6xl font-black tracking-tight text-[#F7B500] tabular-nums leading-none">{formatTime(now)}</p>
          <p className="text-[9px] md:text-sm font-bold text-slate-300 uppercase tracking-widest mt-1 capitalize hidden sm:block">{formatDate(now)}</p>
        </div>
      </div>

      {/* BODY — preenche o resto da altura */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden p-4 md:p-6 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-4 lg:h-full">

          {/* Coluna 1 — Afluência por zona */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between px-1 shrink-0">
              <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400">Afluência em tempo real</p>
              <div className="flex items-center gap-1.5">
                <Users2 size={18} className="text-[#F7B500] hidden sm:block" />
                <span className="text-sm md:text-base font-black text-white tabular-nums">{total} total</span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-5 gap-3 min-h-0">
              {zoneCounts.map(z => (
                <div key={z.id} className="bg-white/5 border border-white/10 rounded-[1.2rem] md:rounded-[1.5rem] px-4 md:px-5 py-3 md:py-0 flex flex-col md:flex-row items-center justify-center md:justify-between gap-1 md:gap-3 text-center md:text-left">
                  <div className={`p-2 md:p-2.5 rounded-xl ${z.bg} ${z.color} shrink-0`}>{React.cloneElement(z.icon, { className: "w-6 h-6 md:w-7 md:h-7" })}</div>
                  <p className="text-xs md:text-2xl lg:text-3xl font-black uppercase tracking-wide text-slate-200 flex-1 leading-tight">{z.label}</p>
                  <p className="text-3xl md:text-6xl lg:text-8xl xl:text-9xl font-black text-white tabular-nums leading-none">{z.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 2 — Qualidade da água */}
          <div className="flex flex-col gap-3 min-h-0">
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 px-1 shrink-0">Qualidade da água</p>
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {/* Piscina Coberta */}
              <div className="flex-1 bg-sky-400/10 border border-sky-400/20 rounded-[1.5rem] p-4 flex flex-col gap-2 min-h-[200px] lg:min-h-0 overflow-hidden">
                <div className="flex items-center gap-2 shrink-0 mb-1">
                  <Droplet size={14} className="text-sky-400" />
                  <p className="text-xs md:text-sm font-black uppercase tracking-widest text-sky-300">Piscina Coberta</p>
                </div>
                <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto lg:overflow-hidden pr-1 lg:pr-0">
                  {cobertaLogs.length ? cobertaLogs.map((log, i) => (
                    <div key={i} className="flex-none lg:flex-1 bg-white/5 rounded-xl p-3 md:px-4 py-3 flex items-center justify-between gap-2 md:gap-3 min-h-[70px] lg:min-h-0">
                      <span className="text-xl md:text-3xl lg:text-4xl font-black text-slate-300 tabular-nums shrink-0">{log.hora}</span>
                      <div className="text-center">
                        <p className="text-[8px] md:text-[10px] uppercase text-slate-500">pH</p>
                        <p className="text-xl md:text-3xl lg:text-4xl font-black text-white tabular-nums leading-none">{log.ph ?? '--'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] md:text-[10px] uppercase text-slate-500">Cloro</p>
                        <p className="text-xl md:text-3xl lg:text-4xl font-black text-sky-300 tabular-nums leading-none">{log.clLivre ?? '--'}</p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="text-[8px] md:text-[10px] uppercase text-slate-500">Temp.</p>
                        <p className="text-xl md:text-3xl lg:text-4xl font-black text-slate-200 tabular-nums leading-none">{log.tempAgua ? `${log.tempAgua}°` : '--'}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="flex-1 flex items-center justify-center"><p className="text-[9px] text-slate-500 uppercase">Sem registos</p></div>
                  )}
                </div>
              </div>
              {/* Piscina Exterior */}
              <div className="flex-1 bg-emerald-400/10 border border-emerald-400/20 rounded-[1.5rem] p-4 flex flex-col gap-2 min-h-[200px] lg:min-h-0 overflow-hidden">
                <div className="flex items-center gap-2 shrink-0 mb-1">
                  <Waves size={14} className="text-emerald-400" />
                  <p className="text-xs md:text-sm font-black uppercase tracking-widest text-emerald-300">Piscina Exterior</p>
                </div>
                <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto lg:overflow-hidden pr-1 lg:pr-0">
                  {descobertaLogs.length ? descobertaLogs.map((log, i) => (
                    <div key={i} className="flex-none lg:flex-1 bg-white/5 rounded-xl p-3 md:px-4 py-3 flex items-center justify-between gap-2 md:gap-3 min-h-[70px] lg:min-h-0">
                      <span className="text-xl md:text-3xl lg:text-4xl font-black text-slate-300 tabular-nums shrink-0">{log.hora}</span>
                      <div className="text-center">
                        <p className="text-[8px] md:text-[10px] uppercase text-slate-500">pH</p>
                        <p className="text-xl md:text-3xl lg:text-4xl font-black text-white tabular-nums leading-none">{log.ph ?? '--'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] md:text-[10px] uppercase text-slate-500">Cloro</p>
                        <p className="text-xl md:text-3xl lg:text-4xl font-black text-emerald-300 tabular-nums leading-none">{log.clLivre ?? '--'}</p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="text-[8px] md:text-[10px] uppercase text-slate-500">Temp.</p>
                        <p className="text-xl md:text-3xl lg:text-4xl font-black text-slate-200 tabular-nums leading-none">{log.tempAgua ? `${log.tempAgua}°` : '--'}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="flex-1 flex items-center justify-center"><p className="text-[9px] text-slate-500 uppercase">Sem registos</p></div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 3 — Aulas do dia */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between px-1 shrink-0">
              <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400">Programa de hoje</p>
              <span className="text-[10px] md:text-xs font-black text-[#F7B500] uppercase">{todayClasses.length} aulas</span>
            </div>
            <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto lg:overflow-hidden pr-1 lg:pr-0">
              {todayClasses.length ? todayClasses.map((aula) => (
                <div key={aula.id} className="flex-none lg:flex-1 bg-white/5 border border-white/10 rounded-[1.2rem] p-3 md:px-5 md:py-0 flex items-center gap-3 md:gap-4 min-h-[90px] lg:min-h-0">
                  <div className="bg-[#F7B500]/10 border border-[#F7B500]/20 rounded-xl p-3 md:px-5 md:py-4 text-center shrink-0 min-w-[80px] md:min-w-[140px]">
                    <p className="text-2xl md:text-4xl lg:text-5xl font-black text-[#F7B500] tabular-nums leading-none">{aula.horaInicio}</p>
                    <p className="text-[8px] md:text-base font-bold text-slate-400 uppercase mt-1">até {aula.horaFim}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-400 leading-none mb-1 truncate">{aula.sala || aula.categoria || 'Geral'}</p>
                    <h3 className="text-lg md:text-2xl lg:text-3xl font-black text-white uppercase leading-tight truncate">{aula.modalidade}</h3>
                    <p className="text-xs md:text-base text-slate-400 truncate">{aula.professor || 'Professor a definir'}</p>
                  </div>
                </div>
              )) : (
                <div className="flex-1 flex items-center justify-center rounded-[1.5rem] bg-white/5 border border-white/10 min-h-[100px]">
                  <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest">Sem aulas hoje</p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
});

export default EntranceDashboard;

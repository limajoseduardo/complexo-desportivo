import React, { useEffect, useMemo, useState } from 'react';
import {
  Users2, Dumbbell, Waves, Flame, Droplet, Activity,
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Gauge, Star, Target, Building2
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Aula, UserProfile } from '../types';
import { isUserInZone } from '../lib/logic';
import { useWeather } from '../lib/weather';

interface EntranceDashboardProps {
  appId: string;
  onBack?: () => void;
}

const formatTime = (date: Date) => date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const formatDate = (date: Date) => date.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const getTodayNumber = (date: Date) => date.getDay() === 0 ? 7 : date.getDay();
const EXCLUDE_MODALITIES = ['ginásio livre', 'ginasio livre', 'piscina livre'];

const normalizeModality = (m: string): string => {
  const norm = (m || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (norm.startsWith('natacao') || norm.startsWith('natacao nivel') || norm.startsWith('natacao nivel')) {
    return 'natacao';
  }
  if (norm.includes('bebe') || norm.includes('ama')) {
    return 'bebes/ama';
  }
  if (norm.includes('piscina regime livre') || norm.includes('piscina livre') || norm.includes('regime livre')) {
    return 'livre';
  }
  if (norm.includes('piscina exterior') || norm.includes('exterior') || norm.includes('descoberta')) {
    return 'exterior';
  }
  if (norm.includes('hidro')) {
    return 'hidroginastica';
  }
  if (norm.includes('fit') || norm.includes('fitness') || norm.includes('aulas fit') || norm.includes('aula fit')) {
    return 'fitness';
  }
  if (norm.includes('ginasio')) {
    return 'ginasio';
  }
  if (norm.includes('padel')) {
    return 'padel';
  }
  if (norm.includes('pavilhao')) {
    return 'pavilhao';
  }
  if (norm.includes('sauna') || norm.includes('turco')) {
    return 'sauna';
  }
  return norm;
};

function WeatherIcon({ code, size = 32 }: { code: number; size?: number }) {
  if (code === 0)          return <Sun size={size} className="text-[#F7B500]" />;
  if (code <= 2)           return <Sun size={size} className="text-yellow-300" />;
  if (code === 3)          return <Cloud size={size} className="text-slate-300" />;
  if (code <= 48)          return <Wind size={size} className="text-slate-400" />;
  if (code <= 67)          return <CloudRain size={size} className="text-sky-300" />;
  if (code <= 77)          return <CloudSnow size={size} className="text-blue-200" />;
  if (code <= 82)          return <CloudRain size={size} className="text-sky-400" />;
  return                          <CloudLightning size={size} className="text-yellow-300" />;
}

function weatherLabel(code: number): string {
  if (code === 0)   return 'Céu Limpo';
  if (code <= 2)    return 'Pouco Nublado';
  if (code === 3)   return 'Nublado';
  if (code <= 48)   return 'Nevoeiro';
  if (code <= 55)   return 'Chuvisco';
  if (code <= 67)   return 'Chuva';
  if (code <= 77)   return 'Neve';
  if (code <= 82)   return 'Aguaceiros';
  return                   'Trovoada';
}

function aqiLabel(aqi: number): { label: string; color: string } {
  if (aqi <= 20)  return { label: 'Boa',           color: 'text-emerald-400' };
  if (aqi <= 40)  return { label: 'Razoável',      color: 'text-lime-400'    };
  if (aqi <= 60)  return { label: 'Moderada',      color: 'text-yellow-400'  };
  if (aqi <= 80)  return { label: 'Fraca',         color: 'text-orange-400'  };
  if (aqi <= 100) return { label: 'Muito Fraca',   color: 'text-red-400'     };
  return                 { label: 'Crítica',        color: 'text-purple-400'  };
}

export const EntranceDashboard = React.memo(({ appId, onBack }: EntranceDashboardProps) => {
  const [now, setNow] = useState(new Date());
  const [utentesInside, setUtentesInside] = useState<UserProfile[]>([]);
  const [cobertaLogs, setCobertaLogs] = useState<any[]>([]);
  const [descobertaLogs, setDescobertaLogs] = useState<any[]>([]);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<Aula[]>([]);
  const { weather, aqi } = useWeather();

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const path = `artifacts/${appId}/public/data/logs_acesso`;
    const q = query(collection(db, path), where('date', '==', today));
    const unsub = onSnapshot(q, (snap) => {
      setTodayLogs(snap.docs.map(d => d.data()));
    }, (error) => {
      console.error("Error loading daily logs for EntranceDashboard:", error);
    });
    return unsub;
  }, [appId]);

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
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(30));
    return onSnapshot(q, (snap) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const logs = snap.docs.map(d => d.data());
      const todayLogs = logs.filter(l => l.data === todayStr).slice(0, 3);
      setCobertaLogs(todayLogs);
    });
  }, [appId]);

  useEffect(() => {
    const path = `artifacts/${appId}/public/data/mapas_descoberta`;
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(30));
    return onSnapshot(q, (snap) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const logs = snap.docs.map(d => d.data());
      const todayLogs = logs.filter(l => l.data === todayStr).slice(0, 3);
      setDescobertaLogs(todayLogs);
    });
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
    { id: 'livre',    label: 'Piscina Regime Livre', icon: <Star size={28}/>,      color: 'text-sky-400',     bg: 'bg-sky-400/10' },
    { id: 'pool_out', label: 'Piscina Exterior',     icon: <Sun size={28}/>,       color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { id: 'nat',      label: 'Natação Nível 1-2-3',  icon: <Waves size={28}/>,     color: 'text-blue-400',    bg: 'bg-blue-400/10' },
    { id: 'hidro',    label: 'Hidroginástica',       icon: <Droplets size={28}/>,  color: 'text-teal-400',    bg: 'bg-teal-400/10' },
    { id: 'bebes',    label: 'Bebés / AMA',          icon: <Users2 size={28}/>,    color: 'text-indigo-400',  bg: 'bg-indigo-400/10' },
    { id: 'fit',      label: 'Aulas Fitness',        icon: <Activity size={28}/>,  color: 'text-purple-400',  bg: 'bg-purple-400/10' },
    { id: 'gym',      label: 'Ginásio',              icon: <Dumbbell size={28}/>,  color: 'text-[#F7B500]',   bg: 'bg-[#F7B500]/10' },
    { id: 'padel',    label: 'Padel',                icon: <Target size={28}/>,    color: 'text-cyan-300',    bg: 'bg-cyan-300/10' },
    { id: 'pavilhao', label: 'Pavilhão',             icon: <Building2 size={28}/>, color: 'text-indigo-300',  bg: 'bg-indigo-300/10' },
    { id: 'sauna',    label: 'Sauna',                icon: <Flame size={28}/>,     color: 'text-orange-400',  bg: 'bg-orange-400/10' },
  ], []);

  const zoneCounts = useMemo(() =>
    zones.map(z => {
      const liveCount = utentesInside.filter(u => isUserInZone(u, z.id)).length;
      const todayCount = todayLogs.filter(l => {
        const normLog = normalizeModality(l.modalidade || '');
        const normZone = normalizeModality(z.label || '');
        return normLog === normZone;
      }).length;
      return { ...z, liveCount, todayCount };
    })
    .sort((a, b) => b.todayCount - a.todayCount || b.liveCount - a.liveCount),
    [utentesInside, todayLogs, zones]
  );

  const total = utentesInside.length;

  const todayClasses = useMemo(() =>
    agenda
      .filter(a => a.diaSemana === todayNumber)
      .filter(a => !EXCLUDE_MODALITIES.includes((a.modalidade || '').toLowerCase().trim()))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [agenda, todayNumber]
  );

  const aqiInfo = aqi !== null ? aqiLabel(aqi) : null;

  return (
    <div className="fixed inset-0 bg-[#003a55] text-white font-sans overflow-hidden flex flex-col select-none">

      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-white/10">

        {/* Esquerda: back + título */}
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 sm:px-4 py-2 font-black text-xs sm:text-sm uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shrink-0"
            >
              ← Voltar
            </button>
          )}
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5 truncate">
              Complexo Desportivo · Vila de Rei
            </p>
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-white leading-none">
              VILA VIDA
            </h1>
          </div>
        </div>

        {/* Direita: meteorologia + relógio */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">

          {/* Meteorologia */}
          {weather && (
            <div className="flex items-center gap-3 sm:gap-4 border-r border-white/10 pr-3 sm:pr-5">
              {/* Ícone + temperatura (sempre visível) */}
              <div className="flex flex-col items-center gap-0.5">
                <WeatherIcon code={weather.weatherCode} size={28} />
                <p className="text-[8px] sm:text-[9px] font-black text-white/40 uppercase text-center leading-none hidden sm:block">
                  {weatherLabel(weather.weatherCode)}
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                {/* Temperatura grande */}
                <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#F7B500] tabular-nums leading-none">
                  {weather.temperature}°<span className="text-base sm:text-xl opacity-60">C</span>
                </p>
                {/* Sensação térmica (md+) */}
                <p className="text-[8px] sm:text-[9px] font-bold text-white/40 uppercase hidden sm:block">
                  Sensação {weather.apparentTemp}°C
                </p>
              </div>
              {/* Humidade + qualidade do ar (sm+) */}
              <div className="hidden sm:flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Droplets size={12} className="text-sky-300 shrink-0" />
                  <span className="text-xs font-black text-white tabular-nums">{weather.humidity}%</span>
                  <span className="text-[8px] font-bold text-white/40 uppercase">Humidade</span>
                </div>
                {aqiInfo && (
                  <div className="flex items-center gap-1.5">
                    <Gauge size={12} className={`${aqiInfo.color} shrink-0`} />
                    <span className={`text-xs font-black tabular-nums ${aqiInfo.color}`}>{aqi}</span>
                    <span className={`text-[8px] font-bold uppercase ${aqiInfo.color}`}>{aqiInfo.label}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Wind size={12} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-black text-white tabular-nums">{weather.windSpeed}</span>
                  <span className="text-[8px] font-bold text-white/40 uppercase">km/h</span>
                </div>
              </div>
            </div>
          )}

          {/* Relógio */}
          <div className="text-right">
            <p className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#F7B500] tabular-nums leading-none">
              {formatTime(now)}
            </p>
            <p className="text-[8px] sm:text-[10px] font-bold text-slate-300 uppercase tracking-wide mt-1 capitalize hidden sm:block">
              {formatDate(now)}
            </p>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-4 lg:h-full">

          {/* Coluna 1 — Afluência por zona */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between px-1 shrink-0">
              <p className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-slate-400">
                Afluência em Tempo Real
              </p>
              <div className="flex items-center gap-1.5">
                <Users2 size={16} className="text-[#F7B500]" />
                <span className="text-sm sm:text-base font-black text-white tabular-nums">{total} total</span>
              </div>
            </div>
            {/* Grelha de 2 colunas para as 10 modalidades */}
            <div className="grid grid-cols-2 gap-2 lg:gap-3 min-h-0 overflow-y-auto pb-2 custom-scrollbar">
              {zoneCounts.map(z => (
                <div
                  key={z.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-3 lg:p-4 flex flex-col justify-between gap-2 lg:gap-3"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={`p-2 lg:p-2.5 rounded-xl ${z.bg} ${z.color} shrink-0`}>
                      {React.cloneElement(z.icon, { size: 22 })}
                    </div>
                    {/* Counts Container */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {/* Agora (Occupancy) */}
                      <div className="text-right">
                        <p className="text-[7px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Agora</p>
                        <div className="flex items-center gap-1 justify-end leading-none">
                          {z.liveCount > 0 && (
                            <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                          )}
                          <p className={`text-base sm:text-lg font-black tabular-nums leading-none ${z.liveCount > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                            {z.liveCount}
                          </p>
                        </div>
                      </div>
                      
                      {/* Separator */}
                      <div className="h-5 sm:h-6 w-[1px] bg-white/10" />

                      {/* Hoje (Today's entries) */}
                      <div className="text-right">
                        <p className="text-[7px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Hoje</p>
                        <p className="text-lg sm:text-xl font-black text-white tabular-nums leading-none">
                          {z.todayCount}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs lg:text-sm font-black uppercase tracking-widest text-slate-300 w-full text-left leading-tight truncate">
                    {z.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 2 — Qualidade da água */}
          <div className="flex flex-col gap-3 min-h-0">
            <p className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-slate-400 px-1 shrink-0">
              Qualidade da Água
            </p>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 flex-1 min-h-0">
              {/* Piscina Coberta */}
              <div className="flex-1 bg-sky-400/10 border border-sky-400/20 rounded-2xl p-3 sm:p-4 flex flex-col gap-2 min-h-[160px] sm:min-h-0 overflow-hidden">
                <div className="flex items-center gap-2 shrink-0">
                  <Droplet size={13} className="text-sky-400" />
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-sky-300">Piscina Coberta</p>
                </div>
                <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto lg:overflow-hidden">
                  {cobertaLogs.length ? cobertaLogs.map((log, i) => (
                    <div key={i} className="flex-none lg:flex-1 bg-white/5 rounded-xl px-3 py-2.5 lg:py-0 flex items-center justify-between gap-2 min-h-[56px] lg:min-h-0">
                      <span className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-300 tabular-nums shrink-0">{log.hora}</span>
                      <div className="text-center">
                        <p className="text-[7px] sm:text-[9px] uppercase text-slate-500">pH</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">{log.ph ?? '--'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[7px] sm:text-[9px] uppercase text-slate-500">Cloro</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-sky-300 tabular-nums leading-none">{log.clLivre ?? '--'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[7px] sm:text-[9px] uppercase text-slate-500">Temp.</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-200 tabular-nums leading-none">{log.tempAgua ? `${log.tempAgua}°` : '--'}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-[9px] text-slate-500 uppercase">Sem registos</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Piscina Exterior */}
              <div className="flex-1 bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-3 sm:p-4 flex flex-col gap-2 min-h-[160px] sm:min-h-0 overflow-hidden">
                <div className="flex items-center gap-2 shrink-0">
                  <Waves size={13} className="text-emerald-400" />
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-300">Piscina Exterior</p>
                </div>
                <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto lg:overflow-hidden">
                  {descobertaLogs.length ? descobertaLogs.map((log, i) => (
                    <div key={i} className="flex-none lg:flex-1 bg-white/5 rounded-xl px-3 py-2.5 lg:py-0 flex items-center justify-between gap-2 min-h-[56px] lg:min-h-0">
                      <span className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-300 tabular-nums shrink-0">{log.hora}</span>
                      <div className="text-center">
                        <p className="text-[7px] sm:text-[9px] uppercase text-slate-500">pH</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">{log.ph ?? '--'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[7px] sm:text-[9px] uppercase text-slate-500">Cloro</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-300 tabular-nums leading-none">{log.clLivre ?? '--'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[7px] sm:text-[9px] uppercase text-slate-500">Temp.</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-200 tabular-nums leading-none">{log.tempAgua ? `${log.tempAgua}°` : '--'}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-[9px] text-slate-500 uppercase">Sem registos</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 3 — Aulas do dia */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between px-1 shrink-0">
              <p className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-slate-400">Programa de Hoje</p>
              <span className="text-[9px] sm:text-xs font-black text-[#F7B500] uppercase">{todayClasses.length} aulas</span>
            </div>
            <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
              {todayClasses.length ? todayClasses.map((aula) => (
                <div
                  key={aula.id}
                  className="flex-none lg:flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 lg:py-0 flex items-center gap-3 min-h-[80px] sm:min-h-[90px] lg:min-h-0"
                >
                  <div className="bg-[#F7B500]/10 border border-[#F7B500]/20 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-center shrink-0 min-w-[72px] sm:min-w-[110px] lg:min-w-[130px]">
                    <p className="text-xl sm:text-3xl lg:text-4xl font-black text-[#F7B500] tabular-nums leading-none">{aula.horaInicio}</p>
                    <p className="text-[7px] sm:text-xs font-bold text-slate-400 uppercase mt-1">até {aula.horaFim}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1 truncate">
                      {aula.sala || aula.categoria || 'Geral'}
                    </p>
                    <h3 className="text-base sm:text-xl lg:text-2xl font-black text-white uppercase leading-tight truncate">
                      {aula.modalidade}
                    </h3>
                    <p className="text-[10px] sm:text-sm text-slate-400 truncate">{aula.professor || 'Professor a definir'}</p>
                  </div>
                </div>
              )) : (
                <div className="flex-1 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 min-h-[100px]">
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest">Sem aulas hoje</p>
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

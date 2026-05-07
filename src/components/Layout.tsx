import React, { useState, useEffect } from 'react';
import {
  Home, Users, Dumbbell, MessageSquare, User, Calendar, LogOut,
  Shield, Briefcase, Settings, AlertTriangle, ClipboardList,
  Activity, Bug, ChevronRight, Monitor,
  Sun, Cloud, CloudRain, CloudSnow, Wind, Thermometer
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { PicotoIcon, AvatarImage } from './Common';


export const LoginScreen = ({ onLogin, error, onPublicDashboard }: { onLogin: (e: string, p: string) => void, error: string, onPublicDashboard?: () => void }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <div className="min-h-screen w-full login-bg flex items-center justify-center p-6">
       <div className="absolute inset-0 login-overlay"></div>
       <div className="bg-white/95 backdrop-blur-xl rounded-[4rem] p-8 lg:p-12 shadow-2xl relative w-full max-w-[460px] border-4 border-white/20">
          <div className="text-center mb-10">
             <div className="w-24 h-24 bg-[#004D71] rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl border-4 border-[#F7B500]">
                <PicotoIcon size={48} className="text-[#F7B500]"/>
             </div>
             <h2 className="text-3xl font-black text-[#004D71] uppercase tracking-tighter leading-none">Vila de Rei</h2>
             <p className="text-[11px] font-black text-[#F7B500] uppercase mt-3 tracking-widest font-black">Sistema de Gestão Desportiva</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-bold mb-6 flex items-center gap-3 border border-red-100">
              <AlertTriangle size={18} className="shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); onLogin(email, password); }} className="space-y-4">
             <div>
                <label className="text-[10px] font-black text-[#004D71] uppercase tracking-widest ml-2 mb-1 block text-left">Email de Acesso</label>
                <input type="email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-black outline-none focus:border-[#F7B500] text-[#004D71]" placeholder="O seu email..." />
             </div>
             <div>
                <label className="text-[10px] font-black text-[#004D71] uppercase tracking-widest ml-2 mb-1 block text-left">Palavra-passe</label>
                <input type="password" required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-black outline-none focus:border-[#F7B500] text-[#004D71]" placeholder="••••••" />
             </div>
             <button type="submit" className="w-full bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all mt-2">
                Iniciar Sessão
             </button>
          </form>

          {onPublicDashboard && (
            <button
              type="button"
              onClick={onPublicDashboard}
              className="w-full mt-4 bg-slate-100 text-[#004D71] py-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-[#004D71]/20"
            >
              <Monitor size={16} /> Ecrã Público
            </button>
          )}

          <p className="text-center text-[9px] text-slate-400 mt-8 font-bold uppercase tracking-widest leading-relaxed">
            Consola Municipal • Provedoria de Dados<br/>
            Vila de Rei v.3.3
          </p>
       </div>
    </div>
  );
};

export const ModePicker = ({ onSelect }: { onSelect: (role: string) => void }) => {
  const modes = [
    { role: 'admin',     label: 'Admin',     desc: 'Acesso total ao sistema',         icon: <Shield size={28}/>,   color: 'bg-slate-800 text-white' },
    { role: 'chefia',    label: 'Chefia',    desc: 'Direção Municipal',               icon: <Settings size={28}/>, color: 'bg-[#004D71] text-white' },
    { role: 'staff',     label: 'Staff',     desc: 'Receção / Bilheteira',            icon: <Briefcase size={28}/>,color: 'bg-[#F7B500] text-[#004D71]' },
    { role: 'professor', label: 'Professor', desc: 'Gestão de alunos e treinos',      icon: <Users size={28}/>,    color: 'bg-emerald-600 text-white' },
    { role: 'utente',    label: 'Utente',    desc: 'Vista do utente / sócio',         icon: <User size={28}/>,     color: 'bg-blue-500 text-white' },
  ];
  return (
    <div className="min-h-screen w-full login-bg flex items-center justify-center p-6">
      <div className="absolute inset-0 login-overlay" />
      <div className="bg-white/95 backdrop-blur-xl rounded-[4rem] p-8 lg:p-12 shadow-2xl relative w-full max-w-lg border-4 border-white/20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-xl border-4 border-[#F7B500]">
            <Shield size={40} className="text-[#F7B500]"/>
          </div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Modo de Acesso</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Conta Informática — Selecione o modo a testar</p>
        </div>
        <div className="space-y-3">
          {modes.map(m => (
            <button
              key={m.role}
              onClick={() => onSelect(m.role)}
              className="w-full flex items-center gap-5 p-5 rounded-[2rem] border-2 border-slate-100 hover:border-[#F7B500] hover:shadow-xl transition-all active:scale-[0.98] text-left group"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${m.color}`}>
                {m.icon}
              </div>
              <div className="flex-1">
                <p className="font-black text-[#004D71] uppercase text-sm tracking-wide">{m.label}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{m.desc}</p>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-[#F7B500] transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const WMO: Record<number, { label: string; icon: React.ReactNode }> = {
  0:  { label: 'Sol',        icon: <Sun size={15} className="text-yellow-400 shrink-0"/> },
  1:  { label: 'Sol',        icon: <Sun size={15} className="text-yellow-300 shrink-0"/> },
  2:  { label: 'Nublado',    icon: <Cloud size={15} className="text-slate-400 shrink-0"/> },
  3:  { label: 'Nublado',    icon: <Cloud size={15} className="text-slate-500 shrink-0"/> },
  45: { label: 'Névoa',      icon: <Wind size={15} className="text-slate-400 shrink-0"/> },
  48: { label: 'Névoa',      icon: <Wind size={15} className="text-slate-400 shrink-0"/> },
  51: { label: 'Chuvisco',   icon: <CloudRain size={15} className="text-blue-400 shrink-0"/> },
  53: { label: 'Chuvisco',   icon: <CloudRain size={15} className="text-blue-400 shrink-0"/> },
  61: { label: 'Chuva',      icon: <CloudRain size={15} className="text-blue-500 shrink-0"/> },
  63: { label: 'Chuva',      icon: <CloudRain size={15} className="text-blue-600 shrink-0"/> },
  71: { label: 'Neve',       icon: <CloudSnow size={15} className="text-sky-300 shrink-0"/> },
  80: { label: 'Aguaceiros', icon: <CloudRain size={15} className="text-blue-500 shrink-0"/> },
  95: { label: 'Trovoada',   icon: <CloudRain size={15} className="text-purple-500 shrink-0"/> },
};
const wmoLookup = (code: number) =>
  WMO[code] ?? { label: '---', icon: <Thermometer size={15} className="text-slate-400 shrink-0"/> };

export function Header({ user, onReportBug, unreadCount = 0 }: { user: UserProfile, onReportBug?: () => void, unreadCount?: number }) {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: number; feels: number; wind: number; code: number } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=39.69&longitude=-8.14&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m&timezone=Europe/Lisbon')
      .then(r => r.json())
      .then(d => setWeather({
        temp:   Math.round(d.current.temperature_2m),
        feels:  Math.round(d.current.apparent_temperature),
        wind:   Math.round(d.current.windspeed_10m),
        code:   d.current.weathercode
      }))
      .catch(() => {});
  }, []);

  const w = weather ? wmoLookup(weather.code) : null;

  const dateStr = time.toLocaleDateString('pt-PT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const timeStr = time.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="bg-white px-4 py-3 border-b-4 border-slate-100 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Foto */}
        <div className="w-12 h-12 rounded-2xl border-2 border-slate-200 overflow-hidden shadow-lg shrink-0">
          <AvatarImage src={user.img} alt={user.n || user.nome} className="w-full h-full" />
        </div>

        {/* Nome + data + meteo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-sm font-black text-[#004D71] uppercase leading-none truncate">{user.nome || user.n}</h2>
            <span className="text-[9px] font-black text-[#F7B500] uppercase tracking-widest leading-none shrink-0">{user.cargo || 'Membro'}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[9px] font-bold text-slate-400 capitalize truncate">{dateStr}</span>
            <span className="text-[9px] font-black text-[#004D71] tabular-nums shrink-0">• {timeStr}</span>
            {w && weather && (
              <span className="flex items-center gap-1 shrink-0">
                {w.icon}
                <span className="text-[9px] font-black text-[#004D71]">{weather.temp}°</span>
                <span className="text-[9px] font-bold text-slate-400">{w.label}</span>
                <span className="text-[9px] font-bold text-slate-300 hidden sm:inline">· Sens. {weather.feels}° · Vento {weather.wind} km/h</span>
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <div className="relative">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
              <div className="relative bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-full shadow-lg">{unreadCount}</div>
            </div>
          )}
          <button
            onClick={onReportBug}
            className="p-2.5 bg-red-50 text-red-400 rounded-xl active:scale-90 transition-all"
            title="Reportar Erro"
          >
            <Bug size={16}/>
          </button>
        </div>
      </div>

      {/* Linha extra com detalhes meteo em mobile (só quando há dados) */}
      {w && weather && (
        <div className="sm:hidden mt-2 flex items-center gap-3 px-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Sensação {weather.feels}°C</span>
          <span>·</span>
          <span>Vento {weather.wind} km/h</span>
          <span>·</span>
          <span>Vila de Rei</span>
        </div>
      )}
    </header>
  );
}

export const DesktopSidebar = ({ activeTab, setActiveTab, onLogout, user, unreadCount = 0 }: { activeTab: string, setActiveTab: (t: string) => void, onLogout: () => void, user: UserProfile, unreadCount?: number }) => {
  const menu = [
    { id: 'inicio', icon: <Home />, label: 'Início', roles: ['admin', 'staff', 'chefia', 'professor', 'utente'] },
    { id: 'utentes', icon: <Users />, label: 'Utentes', roles: ['admin', 'staff', 'chefia'] },
    { id: 'acessos', icon: <ClipboardList />, label: 'Acessos', roles: ['admin', 'staff', 'chefia'] },
    { id: 'alunos', icon: <Users />, label: 'Alunos', roles: ['professor'] },
    { id: 'exercicios', icon: <Dumbbell />, label: 'Exercícios', roles: ['admin', 'professor', 'chefia'] },
    { id: 'treino', icon: <Dumbbell />, label: 'Treino', roles: ['utente'] },
    { id: 'mensagens', icon: <MessageSquare />, label: 'Chat', roles: ['admin', 'staff', 'professor', 'utente'], badge: unreadCount },
    { id: 'afluencia', icon: <Activity />, label: 'Afluência', roles: ['utente'] },
    { id: 'mapas', icon: <ClipboardList />, label: 'Mapas', roles: ['admin', 'staff', 'chefia', 'professor'] },
    { id: 'agenda', icon: <Calendar />, label: 'Agenda', roles: ['utente', 'staff', 'admin', 'chefia', 'professor'] },
    { id: 'perfil', icon: <User />, label: 'Perfil', roles: ['admin', 'staff', 'chefia', 'professor', 'utente'] },
  ].filter(item => item.roles.includes(user.role));

  return (
    <aside className="hidden lg:flex flex-col w-80 bg-[#004D71] p-8 text-white relative shrink-0">
      <div className="mb-14 px-2 text-left">
         <h1 className="text-2xl font-black tracking-[0.2em] uppercase border-b-2 border-[#F7B500] pb-2 inline-block">PORTAL</h1>
      </div>
      <nav className="flex-1 space-y-2">
        {menu.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center justify-between px-6 py-4 rounded-[1.5rem] font-black transition-all ${activeTab === item.id ? 'bg-[#F7B500] text-[#004D71] shadow-xl translate-x-2' : 'text-blue-100/40 hover:bg-white/5 hover:text-white'}`}>
            <div className="flex items-center gap-4">
              {React.cloneElement(item.icon as React.ReactElement, { size: 20 })} <span className="uppercase text-[11px] tracking-widest">{item.label}</span>
            </div>
            {item.badge ? (
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
                <span className="relative bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-red-600/40">
                  {item.badge}
                </span>
              </div>
            ) : null}
          </button>
        ))}
      </nav>
      <button onClick={onLogout} className="mt-auto flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-blue-300 hover:text-red-400 transition-all uppercase text-xs tracking-widest"><LogOut size={20}/> SAIR</button>
    </aside>
  );
};

export const MobileNav = ({ role, activeTab, setActiveTab, unreadCount = 0 }: { role: UserRole, activeTab: string, setActiveTab: (t: string) => void, unreadCount?: number }) => {
  const tabs = [
    { id: 'inicio', icon: <Home />, label: 'INICIO', roles: ['admin', 'staff', 'chefia', 'professor', 'utente'] },
    { id: 'utentes', icon: <Users />, label: 'UTENTES', roles: ['admin', 'staff', 'chefia'] },
    { id: 'acessos', icon: <ClipboardList />, label: 'ACESSOS', roles: ['admin', 'staff', 'chefia'] },
    { id: 'alunos', icon: <Users />, label: 'ALUNOS', roles: ['professor'] },
    { id: 'treino', icon: <Dumbbell />, label: 'TREINO', roles: ['utente'] },
    { id: 'mensagens', icon: <MessageSquare />, label: 'CHAT', roles: ['professor', 'staff', 'admin', 'utente'], badge: unreadCount },
    { id: 'agenda', icon: <Calendar />, label: 'AGENDA', roles: ['utente', 'staff', 'admin', 'chefia', 'professor'] },
    { id: 'afluencia', icon: <Activity />, label: 'AFLUENCIA', roles: ['utente'] },
    { id: 'perfil', icon: <User />, label: 'EU', roles: ['admin', 'staff', 'chefia', 'professor', 'utente'] },
  ].filter(tab => tab.roles.includes(role));

  return (
    <nav className="lg:hidden bg-[#004D71] fixed bottom-0 w-full px-2 pt-3 pb-safe flex justify-around items-center z-50 rounded-t-[2.5rem] border-t-2 border-white/10 shadow-[0_-15px_50px_rgba(0,0,0,0.4)]">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex flex-col items-center w-full py-2 relative">
          {tab.badge ? (
            <div className="absolute top-1 right-1/4 z-10">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
              <div className="relative w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-[8px] font-black text-white border-2 border-[#004D71] z-10">
                {tab.badge}
              </div>
            </div>
          ) : null}
          <div className={`${activeTab === tab.id ? 'text-[#F7B500]' : 'text-white'}`}>
            {React.cloneElement(tab.icon as React.ReactElement, { size: 24 })}
          </div>
          <span className={`text-[8px] font-black mt-1 uppercase tracking-widest ${activeTab === tab.id ? 'text-[#F7B500]' : 'text-white/60'}`}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

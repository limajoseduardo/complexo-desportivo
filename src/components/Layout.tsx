import React from 'react';
import {
  Home, Users, Dumbbell, MessageSquare, User, Calendar, LogOut,
  Shield, Briefcase, Settings, AlertTriangle, ClipboardList,
  ChevronRight, Monitor, UserPlus, Loader,
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Thermometer, Gauge
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { PicotoIcon, AvatarImage } from './Common';


export const LoginScreen = ({ onLogin, onRegister, error, onPublicDashboard }: { onLogin: (e: string, p: string) => void, onRegister?: (nome: string, email: string, pass: string, code: string) => Promise<void>, error: string, onPublicDashboard?: () => void }) => {
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [nome, setNome] = React.useState('');
  const [inviteCode, setInviteCode] = React.useState('');
  const [regError, setRegError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  return (
    <div className="min-h-screen w-full login-bg flex items-center justify-center p-4 sm:p-6">
       <div className="absolute inset-0 login-overlay"></div>
       <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-8 lg:p-12 shadow-2xl relative w-full max-w-[460px] border-4 border-white/20">
          <div className="text-center mb-8 md:mb-10">
             <div className="w-20 h-20 md:w-24 md:h-24 bg-[#004D71] rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl border-4 border-[#F7B500]">
                <PicotoIcon className="text-[#F7B500] w-10 h-10 md:w-12 md:h-12"/>
             </div>
             <h2 className="text-2xl md:text-3xl font-black text-[#004D71] uppercase tracking-tighter leading-none">Vila de Rei</h2>
             <p className="text-[9px] md:text-[11px] font-black text-[#F7B500] uppercase mt-2 md:mt-3 tracking-widest font-black">Sistema de Gestão Desportiva</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setRegError(''); }}
              className={`flex-1 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${mode === 'login' ? 'bg-[#004D71] text-[#F7B500]' : 'bg-slate-100 text-[#004D71] border-2 border-slate-200'}`}
            >
              Entrar
            </button>
            {onRegister && (
              <button
                type="button"
                onClick={() => { setMode('register'); setRegError(''); }}
                className={`flex-1 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${mode === 'register' ? 'bg-[#004D71] text-[#F7B500]' : 'bg-slate-100 text-[#004D71] border-2 border-slate-200'}`}
              >
                Registar
              </button>
            )}
          </div>

          {(mode === 'login' ? error : regError) && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-bold mb-6 flex items-center gap-3 border border-red-100">
              <AlertTriangle size={18} className="shrink-0" /> {mode === 'login' ? error : regError}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); onLogin(email, password); }} className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-[#004D71] uppercase tracking-widest ml-2 mb-1 block text-left">Email de Acesso</label>
                  <input type="email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black outline-none focus:border-[#F7B500] text-[#004D71]" placeholder="O seu email..." />
               </div>
               <div>
                  <div className="flex justify-between items-end mb-1 ml-2 mr-2">
                    <label className="text-[10px] font-black text-[#004D71] uppercase tracking-widest text-left">Palavra-passe</label>
                    <button type="button" onClick={() => alert('Para recuperar a sua palavra-passe, por favor dirija-se à receção do Complexo Desportivo ou contacte os serviços municipais.')} className="text-[9px] font-black text-slate-400 hover:text-[#F7B500] transition-colors uppercase tracking-widest">Recuperar?</button>
                  </div>
                  <input type="password" required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black outline-none focus:border-[#F7B500] text-[#004D71]" placeholder="••••••" />
               </div>
               <button type="submit" className="w-full bg-[#004D71] text-[#F7B500] py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all mt-2">
                  Iniciar Sessão
               </button>
            </form>
          ) : (
            <form onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              if (!onRegister) return;
              setLoading(true);
              setRegError('');
              try {
                await onRegister(nome, email, password, inviteCode);
              } catch (err: any) {
                setRegError(err.message || 'Erro ao registar');
              } finally {
                setLoading(false);
              }
            }} className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-[#004D71] uppercase tracking-widest ml-2 mb-1 block text-left">Nome Completo</label>
                  <input type="text" required value={nome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNome(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black outline-none focus:border-[#F7B500] text-[#004D71]" placeholder="O seu nome..." />
               </div>
               <div>
                  <label className="text-[10px] font-black text-[#004D71] uppercase tracking-widest ml-2 mb-1 block text-left">Email</label>
                  <input type="email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black outline-none focus:border-[#F7B500] text-[#004D71]" placeholder="O seu email..." />
               </div>
               <div>
                  <label className="text-[10px] font-black text-[#004D71] uppercase tracking-widest ml-2 mb-1 block text-left">Palavra-passe</label>
                  <input type="password" required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black outline-none focus:border-[#F7B500] text-[#004D71]" placeholder="••••••" />
               </div>
               <div>
                  <label className="text-[10px] font-black text-[#004D71] uppercase tracking-widest ml-2 mb-1 block text-left">Código de Convite</label>
                  <input type="text" required value={inviteCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteCode(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-3.5 md:p-4 text-xs font-black outline-none focus:border-[#F7B500] text-[#004D71] font-mono" placeholder="Ex: VILA-X9K2" />
               </div>
               <button type="submit" disabled={loading} className="w-full bg-[#004D71] text-[#F7B500] py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading ? <><Loader size={16} className="animate-spin" /> Registando...</> : <><UserPlus size={16} /> Criar Conta</>}
               </button>
            </form>
          )}

          {onPublicDashboard && (
            <button
              type="button"
              onClick={onPublicDashboard}
              className="w-full mt-4 bg-slate-100 text-[#004D71] py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-[#004D71]/20"
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
    <div className="min-h-screen w-full login-bg flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 login-overlay" />
      <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-8 lg:p-12 shadow-2xl relative w-full max-w-lg border-4 border-white/20">
        <div className="text-center mb-6 md:mb-8">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-800 rounded-2xl md:rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-xl border-4 border-[#F7B500]">
            <Shield className="text-[#F7B500] w-8 h-8 md:w-10 md:h-10"/>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-[#004D71] uppercase tracking-tighter">Modo de Acesso</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Conta Informática — Selecione o modo a testar</p>
        </div>
        <div className="space-y-2 md:space-y-3">
          {modes.map(m => (
            <button
              key={m.role}
              onClick={() => onSelect(m.role)}
              className="w-full flex items-center gap-3 md:gap-5 p-4 md:p-5 rounded-2xl md:rounded-[2rem] border-2 border-slate-100 hover:border-[#F7B500] hover:shadow-xl transition-all active:scale-[0.98] text-left group"
            >
              <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-md ${m.color}`}>
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

function HeaderWeatherIcon({ code, size = 18 }: { code: number; size?: number }) {
  if (code === 0)   return <Sun size={size} className="text-[#F7B500]" />;
  if (code <= 2)    return <Sun size={size} className="text-yellow-400" />;
  if (code === 3)   return <Cloud size={size} className="text-slate-400" />;
  if (code <= 48)   return <Wind size={size} className="text-slate-400" />;
  if (code <= 67)   return <CloudRain size={size} className="text-sky-400" />;
  if (code <= 77)   return <CloudSnow size={size} className="text-blue-300" />;
  if (code <= 82)   return <CloudRain size={size} className="text-sky-500" />;
  return                   <CloudLightning size={size} className="text-yellow-400" />;
}

function headerWeatherLabel(code: number): string {
  if (code === 0)  return 'Céu Limpo';
  if (code <= 2)   return 'Pouco Nublado';
  if (code === 3)  return 'Nublado';
  if (code <= 48)  return 'Nevoeiro';
  if (code <= 55)  return 'Chuvisco';
  if (code <= 67)  return 'Chuva';
  if (code <= 77)  return 'Neve';
  if (code <= 82)  return 'Aguaceiros';
  return                  'Trovoada';
}

function headerAqiLabel(aqi: number): { label: string; color: string } {
  if (aqi <= 20)  return { label: 'Boa',         color: 'text-emerald-500' };
  if (aqi <= 40)  return { label: 'Razoável',    color: 'text-lime-500'   };
  if (aqi <= 60)  return { label: 'Moderada',    color: 'text-yellow-500' };
  if (aqi <= 80)  return { label: 'Fraca',       color: 'text-orange-500' };
  if (aqi <= 100) return { label: 'Muito Fraca', color: 'text-red-500'    };
  return                 { label: 'Crítica',      color: 'text-purple-500' };
}

export function Header({ user, unreadCount = 0, isVisible = true }: { user: UserProfile, unreadCount?: number, isVisible?: boolean }) {
  const [time, setTime] = React.useState(new Date());
  const [weather, setWeather] = React.useState<{
    temperature: number; humidity: number; apparentTemp: number;
    weatherCode: number; windSpeed: number;
  } | null>(null);
  const [aqi, setAqi] = React.useState<number | null>(null);

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const fetchW = () =>
      fetch('https://api.open-meteo.com/v1/forecast?latitude=39.67&longitude=-8.14' +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m')
        .then(r => r.json())
        .then(d => {
          const c = d.current;
          setWeather({
            temperature:  Math.round(c.temperature_2m),
            humidity:     c.relative_humidity_2m,
            apparentTemp: Math.round(c.apparent_temperature),
            weatherCode:  c.weather_code,
            windSpeed:    Math.round(c.wind_speed_10m),
          });
        })
        .catch(() => {});
    fetchW();
    const t = setInterval(fetchW, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    const fetchAqi = () =>
      fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=39.67&longitude=-8.14&current=european_aqi')
        .then(r => r.json())
        .then(d => setAqi(Math.round(d.current?.european_aqi ?? 0)))
        .catch(() => {});
    fetchAqi();
    const t = setInterval(fetchAqi, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const fullName = (user.nome || user.n || '').trim() || 'Utilizador';
  const age = user.data_nasc ? (() => {
    const b = new Date(user.data_nasc);
    const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
    return a;
  })() : null;

  const aqiInfo = aqi !== null ? headerAqiLabel(aqi) : null;

  return (
    <header className={`bg-white px-5 flex justify-between items-center sticky top-0 z-40 transition-all duration-300 overflow-hidden ${isVisible ? 'max-h-[160px] py-4 border-b-4 border-slate-100 opacity-100' : 'max-h-0 py-0 border-b-0 border-transparent opacity-0'}`}>

      {/* Esquerda: Foto + Info */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-16 h-16 rounded-2xl border-2 border-slate-200 overflow-hidden shadow-md shrink-0">
          <AvatarImage src={user.img} alt={fullName} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-[#004D71] uppercase leading-tight line-clamp-2">{fullName}</h2>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0 mt-0.5">
            <p className="text-[9px] font-black text-[#F7B500] uppercase tracking-widest">{user.cargo || 'Membro'}</p>
            {age !== null && <p className="text-[9px] font-bold text-slate-400 uppercase">· {age} anos</p>}
          </div>
          {user.cartao_municipal && (
            <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-wide mt-0.5">
              Cartão: {user.municipio_cartao || user.cartao_municipal}
            </p>
          )}
        </div>
      </div>

      {/* Centro + Direita: Meteorologia completa + Relógio */}
      <div className="flex items-center gap-4 justify-end shrink-0">

        {/* Bloco meteorologia — md+ */}
        {weather && (
          <div className="hidden md:flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-100">
            <HeaderWeatherIcon code={weather.weatherCode} size={22} />
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-3">
                <span className="text-base font-black text-[#004D71] tabular-nums leading-none">{weather.temperature}°C</span>
                <span className="text-[9px] font-black text-slate-400 uppercase">{headerWeatherLabel(weather.weatherCode)}</span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                  <Thermometer size={10}/> sensação {weather.apparentTemp}°C
                </span>
                <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                  <Droplets size={10}/> {weather.humidity}%
                </span>
                {aqiInfo && (
                  <span className={`flex items-center gap-1 text-[9px] font-bold ${aqiInfo.color}`}>
                    <Gauge size={10}/> Ar {aqiInfo.label}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                  <Wind size={10}/> {weather.windSpeed} km/h
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Meteorologia compacta — sm */}
        {weather && (
          <div className="flex md:hidden items-center gap-1.5 text-[#004D71]">
            <HeaderWeatherIcon code={weather.weatherCode} size={16} />
            <span className="text-sm font-black tabular-nums">{weather.temperature}°C</span>
            <span className="text-[9px] font-bold text-slate-400">{weather.humidity}%<Droplets size={9} className="inline ml-0.5"/></span>
          </div>
        )}

        {/* Relógio */}
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xl font-black text-[#004D71] tabular-nums leading-none">
            {time.toLocaleTimeString('pt-PT')}
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            {time.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>

        {/* Notificações */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <div className="relative">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
              <div className="relative bg-red-600 text-white text-[8px] font-black px-2.5 py-1 rounded-full shadow-lg">{unreadCount}</div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export const DesktopSidebar = ({ activeTab, setActiveTab, onLogout, user, unreadCount = 0 }: { activeTab: string, setActiveTab: (t: string) => void, onLogout: () => void, user: UserProfile, unreadCount?: number }) => {
  const menu = [
    { id: 'inicio',     icon: <Home />,         label: 'Início',     roles: ['admin', 'staff', 'chefia', 'professor', 'utente'] },
    { id: 'utentes',   icon: <Users />,         label: 'Utentes',    roles: ['admin', 'staff', 'chefia'] },
    { id: 'acessos',   icon: <ClipboardList />, label: 'Acessos',    roles: ['admin', 'staff', 'chefia'] },
    { id: 'alunos',    icon: <Users />,         label: 'Alunos',     roles: ['professor'] },
    { id: 'exercicios',icon: <Dumbbell />,      label: 'Exercícios', roles: ['admin', 'professor', 'chefia'] },
    { id: 'treino',    icon: <Dumbbell />,      label: 'Treino',     roles: ['utente'] },
    { id: 'mensagens', icon: <MessageSquare />, label: 'Chat',       roles: ['admin', 'staff', 'professor', 'utente'], badge: unreadCount },
    { id: 'mapas',     icon: <ClipboardList />, label: 'Mapas',      roles: ['admin', 'staff', 'chefia', 'professor'] },
    { id: 'agenda',    icon: <Calendar />,      label: 'Agenda',     roles: ['utente', 'staff', 'admin', 'chefia', 'professor'] },
    { id: 'perfil',    icon: <User />,          label: 'Perfil',     roles: ['admin', 'staff', 'chefia', 'professor', 'utente'] },
  ].filter(item => item.roles.includes(user.role));

  return (
    <aside className="hidden lg:flex flex-col w-80 bg-[#004D71] p-8 text-white relative shrink-0">
      <nav className="flex-1 space-y-1">
        {menu.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center justify-between px-5 py-4 rounded-[1.5rem] font-black transition-all ${activeTab === item.id ? 'bg-[#F7B500] text-[#004D71] shadow-xl translate-x-2' : 'text-blue-100/40 hover:bg-white/5 hover:text-white'}`}>
            <div className="flex items-center gap-4">
              {React.cloneElement(item.icon as React.ReactElement, { size: 20 })}
              <span className="uppercase text-[11px] tracking-widest">{item.label}</span>
            </div>
            {item.badge ? (
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
                <span className="relative bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-red-600/40">{item.badge}</span>
              </div>
            ) : null}
          </button>
        ))}
      </nav>
      <button onClick={onLogout} className="mt-auto flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-blue-300 hover:text-red-400 transition-all uppercase text-xs tracking-widest">
        <LogOut size={20}/> SAIR
      </button>
    </aside>
  );
};

export const MobileNav = ({ role, activeTab, setActiveTab, unreadCount = 0, isVisible = true }: { role: UserRole, activeTab: string, setActiveTab: (t: string) => void, unreadCount?: number, isVisible?: boolean }) => {
  const tabs = [
    { id: 'inicio', icon: <Home />, label: 'INICIO', roles: ['admin', 'staff', 'chefia', 'professor', 'utente'] },
    { id: 'utentes', icon: <Users />, label: 'UTENTES', roles: ['admin', 'staff', 'chefia'] },
    { id: 'acessos', icon: <ClipboardList />, label: 'ACESSOS', roles: ['admin', 'staff', 'chefia'] },
    { id: 'alunos', icon: <Users />, label: 'ALUNOS', roles: ['professor'] },
    { id: 'treino', icon: <Dumbbell />, label: 'TREINO', roles: ['utente'] },
    { id: 'mensagens', icon: <MessageSquare />, label: 'CHAT', roles: ['professor', 'staff', 'admin', 'utente'], badge: unreadCount },
    { id: 'agenda', icon: <Calendar />, label: 'AGENDA', roles: ['utente', 'staff', 'admin', 'chefia', 'professor'] },
    { id: 'perfil', icon: <User />, label: 'EU', roles: ['admin', 'staff', 'chefia', 'professor', 'utente'] },
  ].filter(tab => tab.roles.includes(role));

  return (
    <nav className={`lg:hidden bg-[#004D71] fixed bottom-0 w-full px-2 pt-3 pb-safe flex justify-around items-center z-50 rounded-t-[2.5rem] border-t-2 border-white/10 shadow-[0_-15px_50px_rgba(0,0,0,0.4)] transition-transform duration-300 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
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

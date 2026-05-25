import React, { useEffect } from 'react';
import { UserProfile } from '../types';
import { AvatarImage } from './Common';
import { ShieldAlert, ShieldCheck, Radio, AlertTriangle } from 'lucide-react';

interface KioskModeProps {
  scanResult: { type: 'success' | 'error'; user?: UserProfile; message: string } | null;
  onExit: () => void;
}

export function KioskMode({ scanResult, onExit }: KioskModeProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  if (!scanResult) {
    return (
      <div className="fixed inset-0 bg-[#004D71] z-[999999] flex flex-col items-center justify-center text-white cursor-none select-none">
        <button onClick={onExit} className="absolute top-8 right-8 text-white/20 hover:text-white/50 text-xs font-black uppercase tracking-widest outline-none transition-colors">Sair do Modo Quiosque</button>
        <div className="w-64 h-64 bg-[#F7B500]/10 rounded-full flex items-center justify-center mb-12 animate-pulse shadow-[0_0_100px_rgba(247,181,0,0.1)]">
          <Radio size={100} className="text-[#F7B500]"/>
        </div>
        <h1 className="text-6xl font-black uppercase tracking-tight mb-6">Auto Check-in</h1>
        <p className="text-2xl font-bold opacity-70 uppercase tracking-widest">Aproxime o seu Cartão ou Pulseira</p>
      </div>
    );
  }

  const { type, user, message } = scanResult;

  if (type === 'success' && user) {
    const remainingMatch = message.match(/Restantes: (\d+)/);
    const isWarning = remainingMatch ? parseInt(remainingMatch[1]) <= 3 : false;
    const bgClass = isWarning ? 'bg-yellow-400 text-[#004D71]' : 'bg-emerald-500 text-white';
    
    return (
      <div className={`fixed inset-0 ${bgClass} z-[999999] flex flex-col items-center justify-center animate-in zoom-in duration-300 select-none`}>
        {isWarning ? <AlertTriangle size={140} className="mb-10 drop-shadow-2xl"/> : <ShieldCheck size={140} className="mb-10 drop-shadow-2xl"/>}
        {user.img && (
          <div className={`w-48 h-48 rounded-[3rem] overflow-hidden border-[10px] ${isWarning ? 'border-[#004D71]' : 'border-white'} shadow-2xl mb-10`}>
            <AvatarImage src={user.img} alt="Foto" className="w-full h-full object-cover"/>
          </div>
        )}
        <h1 className="text-7xl font-black uppercase tracking-tight mb-6 drop-shadow-lg text-center px-4 leading-tight">{user.n || user.nome}</h1>
        <p className={`text-4xl font-black px-10 py-5 rounded-[2rem] uppercase tracking-widest shadow-inner ${isWarning ? 'bg-white/40' : 'bg-black/20'}`}>{user.modalidade || 'Acesso Autorizado'}</p>
        <p className={`text-3xl font-black mt-8 px-12 py-6 rounded-full uppercase tracking-widest shadow-2xl ${isWarning ? 'bg-[#004D71] text-yellow-400' : 'bg-white text-emerald-600'}`}>{message}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-red-600 z-[999999] flex flex-col items-center justify-center text-white animate-in zoom-in duration-300 select-none">
      <ShieldAlert size={140} className="mb-10 drop-shadow-2xl animate-bounce"/>
      <h1 className="text-7xl font-black uppercase tracking-tight mb-8 drop-shadow-lg text-center px-4 leading-tight">Acesso Bloqueado</h1>
      <p className="text-3xl font-black bg-black/20 px-10 py-8 rounded-[3rem] uppercase tracking-widest shadow-inner max-w-4xl text-center leading-relaxed">{message}</p>
      <p className="absolute bottom-12 font-black opacity-90 uppercase tracking-widest text-2xl">Dirija-se à Receção</p>
    </div>
  );
}

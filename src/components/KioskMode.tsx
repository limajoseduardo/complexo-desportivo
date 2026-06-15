import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../types';
import { AvatarImage } from './Common';
import { ShieldAlert, ShieldCheck, Radio, AlertTriangle } from 'lucide-react';

interface KioskModeProps {
  scanResult: { type: 'success' | 'error'; user?: UserProfile; message: string } | null;
  onExit: () => void;
  onScan: (decodedText: string) => void;
}

export function KioskMode({ scanResult, onExit, onScan }: KioskModeProps) {
  const scannerRef = useRef<any>(null);
  const [hasCameraError, setHasCameraError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  useEffect(() => {
    let scanner: any = null;
    let isMounted = true;

    // Se estivermos a mostrar um resultado de scan, não iniciamos a câmara
    if (scanResult) return;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        scanner = new Html5Qrcode('kiosk-qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'user' }, // Camara frontal comum para quiosques
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            // Em caso de leitura de sucesso, bloqueamos a leitura repetida até o resultado ser limpo
            if (scannerRef.current) {
              scannerRef.current.stop().catch(console.error);
              scannerRef.current = null;
            }
            onScan(decodedText);
          },
          () => {} // Ignorar erros normais de frame vazio
        );
      } catch (err) {
        console.error("Erro a iniciar câmara de Quiosque:", err);
        if (isMounted) setHasCameraError(true);
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scanner) {
        scanner.stop().catch(console.error);
      }
    };
  }, [scanResult, onScan]);

  if (!scanResult) {
    return (
      <div className="fixed inset-0 bg-[#004D71] z-[999999] flex flex-col items-center justify-center text-white cursor-none select-none">
        <button onClick={onExit} className="absolute top-8 right-8 text-white/20 hover:text-white/50 text-xs font-black uppercase tracking-widest outline-none transition-colors z-50">Sair do Modo Quiosque</button>
        
        {hasCameraError ? (
          <div className="w-64 h-64 bg-red-500/10 rounded-full flex flex-col items-center justify-center mb-12 shadow-[0_0_100px_rgba(239,68,68,0.1)]">
            <AlertTriangle size={60} className="text-red-500 mb-4"/>
            <span className="text-xs font-bold text-center px-4">Sem permissão de câmara. Usa Leitor RFID.</span>
          </div>
        ) : (
          <div className="w-[300px] h-[300px] mb-12 rounded-[3rem] overflow-hidden bg-black/20 shadow-2xl border-4 border-white/10 relative">
             <div id="kiosk-qr-reader" className="w-full h-full object-cover"></div>
             <div className="absolute inset-0 border-4 border-[#F7B500] rounded-[3rem] pointer-events-none animate-pulse opacity-50"></div>
          </div>
        )}

        <h1 className="text-6xl font-black uppercase tracking-tight mb-6">Auto Check-in</h1>
        <p className="text-2xl font-bold opacity-70 uppercase tracking-widest">Aproxime o seu QR Code, Cartão ou Pulseira</p>
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

import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../types';
import { AvatarImage } from './Common';
import { ShieldAlert, ShieldCheck, Radio, AlertTriangle } from 'lucide-react';
import { Scanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';

interface KioskModeProps {
  scanResult: { type: 'success' | 'error' | 'warning' | 'checkout'; user?: UserProfile; message: string; actionDetails?: { action: 'ENTRADA' | 'SAÍDA', time: string, modalidade?: string, duration?: number } } | null;
  onExit: () => void;
  onScan: (decodedText: string) => void;
}

export function KioskMode({ scanResult, onExit, onScan }: KioskModeProps) {
  const [hasCameraError, setHasCameraError] = useState(false);
  const isPaused = useRef(false);
  const lastScanned = useRef<{ text: string; time: number } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  // Retomar leitura quando o resultado desaparece
  useEffect(() => {
    if (!scanResult) {
      isPaused.current = false;
    }
  }, [scanResult]);

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (isPaused.current || detectedCodes.length === 0) return;
    
    const code = detectedCodes[0].rawValue;
    const now = Date.now();

    // Se o utente estiver a segurar o MESMO código (ex: entrada) durante muito tempo, 
    // ignoramos leituras repetidas do mesmo código durante 10 segundos para evitar dupla-entrada/saída.
    if (lastScanned.current && lastScanned.current.text === code && (now - lastScanned.current.time < 10000)) {
      return;
    }

    lastScanned.current = { text: code, time: now };
    isPaused.current = true;
    onScan(code);
  };

  return (
    <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center cursor-none select-none bg-[#004D71]">
      {/* Câmara Invisível quando há scanResult, mas sempre renderizada para não crashar o DOM */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${scanResult ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button onClick={onExit} className="absolute top-8 right-8 text-white/20 hover:text-white/50 text-xs font-black uppercase tracking-widest outline-none transition-colors z-50">Sair do Modo Quiosque</button>
        
        {hasCameraError ? (
          <div className="w-64 h-64 bg-red-500/10 rounded-full flex flex-col items-center justify-center mb-12 shadow-[0_0_100px_rgba(239,68,68,0.1)]">
            <AlertTriangle size={60} className="text-red-500 mb-4"/>
            <span className="text-xs font-bold text-center px-4 text-white">Sem permissão de câmara. Usa Leitor RFID.</span>
          </div>
        ) : (
          <div className="w-[80vw] max-w-[500px] aspect-square mb-12 rounded-[3rem] overflow-hidden bg-black/40 shadow-2xl border-4 border-white/10 relative flex items-center justify-center">
             <div className="w-[120%] h-[120%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
               <Scanner
                  onScan={handleScan}
                  formats={['qr_code']}
                  paused={!!scanResult}
                  components={{
                    audio: false,
                    tracker: false
                  }}
                  constraints={{ facingMode: 'user' }}
               />
             </div>
             <div className="absolute inset-0 border-4 border-[#F7B500] rounded-[3rem] pointer-events-none animate-pulse opacity-50 z-10"></div>
          </div>
        )}

        <h1 className="text-6xl font-black uppercase tracking-tight mb-6 text-white">Auto Check-in</h1>
        <p className="text-2xl font-bold opacity-70 uppercase tracking-widest text-white">Aproxime o seu QR Code</p>
      </div>

      {/* Resultados por cima da câmara */}
      {scanResult && (
        <div className={`absolute inset-0 ${scanResult.type === 'success' && scanResult.user ? 'bg-emerald-500 text-white' : scanResult.type === 'warning' && scanResult.user ? 'bg-yellow-400 text-[#004D71]' : scanResult.type === 'checkout' && scanResult.user ? 'bg-red-600 text-white' : 'bg-red-600 text-white'} flex flex-col items-center justify-center animate-in zoom-in duration-300`}>
          {(scanResult.type === 'success' || scanResult.type === 'warning' || scanResult.type === 'checkout') && scanResult.user ? (
            <>
              {scanResult.type === 'warning' ? <AlertTriangle size={140} className="mb-8 drop-shadow-2xl"/> : <ShieldCheck size={140} className="mb-8 drop-shadow-2xl"/>}
              
              {scanResult.actionDetails && (
                <div className="flex gap-4 mb-4">
                  <span className="px-6 py-2 rounded-full bg-white/20 font-black text-xl tracking-widest">{scanResult.actionDetails.action}</span>
                  <span className="px-6 py-2 rounded-full bg-white/20 font-black text-xl tracking-widest">{scanResult.actionDetails.time}</span>
                </div>
              )}

              {scanResult.user.img && (
                <div className={`w-48 h-48 rounded-[3rem] overflow-hidden border-[10px] ${scanResult.type === 'warning' ? 'border-[#004D71]' : 'border-white'} shadow-2xl mb-8`}>
                  <AvatarImage src={scanResult.user.img} alt="Foto" className="w-full h-full object-cover"/>
                </div>
              )}
              
              <h1 className="text-7xl font-black uppercase tracking-tight mb-4 drop-shadow-lg text-center px-4 leading-tight">{scanResult.user.n || scanResult.user.nome}</h1>
              
              {scanResult.actionDetails?.modalidade && (
                <p className={`text-4xl font-black px-10 py-5 rounded-[2rem] uppercase tracking-widest shadow-inner ${scanResult.type === 'warning' ? 'bg-white/40' : 'bg-black/20'}`}>
                  {scanResult.actionDetails.modalidade}
                </p>
              )}

              {scanResult.type === 'checkout' && scanResult.actionDetails?.duration !== undefined && (
                <p className="text-3xl font-black px-10 py-5 rounded-[2rem] uppercase tracking-widest shadow-inner bg-black/20 mt-4">
                  Tempo no recinto: {scanResult.actionDetails.duration} min
                </p>
              )}

              <p className={`text-3xl font-black mt-8 px-12 py-6 rounded-full uppercase tracking-widest shadow-2xl ${scanResult.type === 'warning' ? 'bg-[#004D71] text-yellow-400' : 'bg-white text-emerald-600'} ${scanResult.type === 'checkout' ? 'text-red-600' : ''}`}>{scanResult.message}</p>
            </>
          ) : (
            <>
              <ShieldAlert size={140} className="mb-10 drop-shadow-2xl animate-bounce"/>
              <h1 className="text-7xl font-black uppercase tracking-tight mb-8 drop-shadow-lg text-center px-4 leading-tight">Acesso Bloqueado</h1>
              <p className="text-3xl font-black bg-black/20 px-10 py-8 rounded-[3rem] uppercase tracking-widest shadow-inner max-w-4xl text-center leading-relaxed">{scanResult.message}</p>
              <p className="absolute bottom-12 font-black opacity-90 uppercase tracking-widest text-2xl">Dirija-se à Receção</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

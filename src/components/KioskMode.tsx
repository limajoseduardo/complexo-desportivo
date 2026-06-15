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

  // Manter a câmara viva sempre que o componente existir
  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        const scanner = new Html5Qrcode('kiosk-qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'user' }, // Camara frontal
          {
            fps: 10, 
            qrbox: 250, // Caixa padrão e segura, nunca falha
            disableFlip: false // Garante que lê códigos QR espelhados (típico em câmaras frontais)
          },
          (decodedText: string) => {
            // Se estivermos a mostrar um resultado de scan, ignorar novas leituras
            if (scannerRef.current?.isPaused) return;
            
            // Pausar internamente para não ler 10x no mesmo segundo
            scannerRef.current.isPaused = true;
            onScan(decodedText);
          },
          () => {} 
        );
      } catch (err) {
        console.error("Erro a iniciar câmara de Quiosque:", err);
        if (isMounted) setHasCameraError(true);
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  // Retomar leitura quando o resultado desaparece
  useEffect(() => {
    if (!scanResult && scannerRef.current) {
      scannerRef.current.isPaused = false;
    }
  }, [scanResult]);

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
             <div id="kiosk-qr-reader" className="w-full h-full object-cover"></div>
             <div className="absolute inset-0 border-4 border-[#F7B500] rounded-[3rem] pointer-events-none animate-pulse opacity-50"></div>
          </div>
        )}

        <h1 className="text-6xl font-black uppercase tracking-tight mb-6 text-white">Auto Check-in</h1>
        <p className="text-2xl font-bold opacity-70 uppercase tracking-widest text-white">Aproxime o seu QR Code</p>
      </div>

      {/* Resultados por cima da câmara */}
      {scanResult && (
        <div className={`absolute inset-0 ${scanResult.type === 'success' && scanResult.user ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'} flex flex-col items-center justify-center animate-in zoom-in duration-300`}>
          {scanResult.type === 'success' && scanResult.user ? (
            <>
              <ShieldCheck size={140} className="mb-10 drop-shadow-2xl"/>
              {scanResult.user.img && (
                <div className={`w-48 h-48 rounded-[3rem] overflow-hidden border-[10px] border-white shadow-2xl mb-10`}>
                  <AvatarImage src={scanResult.user.img} alt="Foto" className="w-full h-full object-cover"/>
                </div>
              )}
              <h1 className="text-7xl font-black uppercase tracking-tight mb-6 drop-shadow-lg text-center px-4 leading-tight">{scanResult.user.n || scanResult.user.nome}</h1>
              <p className="text-4xl font-black px-10 py-5 rounded-[2rem] uppercase tracking-widest shadow-inner bg-black/20">{scanResult.user.modalidade || 'Acesso Autorizado'}</p>
              <p className="text-3xl font-black mt-8 px-12 py-6 rounded-full uppercase tracking-widest shadow-2xl bg-white text-emerald-600">{scanResult.message}</p>
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

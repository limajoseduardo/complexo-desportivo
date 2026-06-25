import React from 'react';
import { Share, PlusSquare, MoreVertical, MonitorSmartphone, ArrowRight } from 'lucide-react';

export const InstallGuide = ({ onContinue }: { onContinue: () => void }) => {
  return (
    <div className="min-h-dvh w-full login-bg flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="absolute inset-0 login-overlay"></div>
      <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl relative w-full max-w-[500px] border-4 border-white/20">
        
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#004D71] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl border-4 border-[#F7B500]">
            <MonitorSmartphone className="text-[#F7B500] w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Instalar a App</h2>
          <p className="text-[11px] font-bold text-slate-500 uppercase mt-2 tracking-widest leading-relaxed">
            Tenha o seu QR Code sempre à mão.<br/>
            Siga os passos para instalar no seu telemóvel:
          </p>
        </div>

        <div className="space-y-4">
          {/* iOS (Apple) */}
          <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100">
            <h3 className="text-sm font-black text-[#004D71] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="bg-[#004D71] text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">1</span>
              iPhone / iPad (Safari)
            </h3>
            <ul className="space-y-3 text-xs font-bold text-slate-600 ml-1">
              <li className="flex items-center gap-3">
                <Share size={18} className="text-blue-500 shrink-0" />
                <span>Toque no botão <strong>Partilhar</strong> (barra inferior)</span>
              </li>
              <li className="flex items-center gap-3">
                <PlusSquare size={18} className="text-slate-400 shrink-0" />
                <span>Escolha <strong>"Ecrã Principal"</strong></span>
              </li>
            </ul>
          </div>

          {/* Android */}
          <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100">
            <h3 className="text-sm font-black text-[#004D71] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="bg-[#004D71] text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">2</span>
              Android (Chrome)
            </h3>
            <ul className="space-y-3 text-xs font-bold text-slate-600 ml-1">
              <li className="flex items-center gap-3">
                <MoreVertical size={18} className="text-emerald-500 shrink-0" />
                <span>Toque nos <strong>3 pontos</strong> (canto superior direito)</span>
              </li>
              <li className="flex items-center gap-3">
                <MonitorSmartphone size={18} className="text-slate-400 shrink-0" />
                <span>Escolha <strong>"Instalar Aplicação"</strong></span>
              </li>
            </ul>
          </div>
        </div>

        <button 
          onClick={onContinue}
          className="w-full mt-8 bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-[#003b57]"
        >
          Avançar para Login <ArrowRight size={16} />
        </button>

      </div>
    </div>
  );
};

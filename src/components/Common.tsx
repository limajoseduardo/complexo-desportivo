import React from 'react';
import { User, Camera } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

export const AvatarImage = React.memo(({ src, alt, className = "" }: { src: string, alt: string, className?: string }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  return (
    <div className={`relative ${className} bg-slate-50 flex items-center justify-center overflow-hidden`}>
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-100 flex items-center justify-center"
          >
            <div className="w-full h-full animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer flex items-center justify-center">
               <User size={32} className="text-slate-300 opacity-50" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setError(true);
        }}
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ 
          opacity: isLoading ? 0 : 1,
          scale: isLoading ? 1.1 : 1
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`w-full h-full object-cover ${error ? 'hidden' : 'block'}`}
      />
      {error && (
        <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
          <User size={32} />
          <span className="text-[8px] font-black uppercase tracking-tighter opacity-50 text-center">N/D</span>
        </div>
      )}
    </div>
  );
});

export const PicotoIcon = React.memo(({ size = 24, className = "", pulsing = false }: { size?: number, className?: string, pulsing?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`${className} ${pulsing ? 'pulse-active' : ''}`}>
    <path d="M4 21h16" /><path d="M6 21l3-14h6l3 14" /><path d="M12 7V3" /><circle cx="12" cy="3" r="1.5" fill="currentColor" />
  </svg>
));

export const FormInput = React.memo(({ label, icon, value, onChange, type = "text", multiline = false, disabled = false, placeholder = "" }: { label: string, icon?: React.ReactNode, value: any, onChange: (v: string) => void, type?: string, multiline?: boolean, disabled?: boolean, placeholder?: string }) => {
  return (
    <div className="space-y-1.5 text-left w-full">
      <div className="flex items-center gap-2 ml-1 text-[#004D71]">
        {icon} <label className="text-[10px] font-black uppercase tracking-widest">{label}</label>
      </div>
      {multiline ? (
        <textarea 
          value={String(value || '')} 
          disabled={disabled} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder={placeholder}
          rows={3} 
          className="w-full border-2 rounded-2xl px-5 py-4 font-bold text-base outline-none bg-white border-slate-200 focus:border-[#004D71] transition-all" 
        />
      ) : (
        <input 
          type={type} 
          value={String(value || '')} 
          disabled={disabled} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder={placeholder}
          className="w-full border-2 rounded-2xl px-5 py-4 font-bold text-base outline-none bg-white border-slate-200 focus:border-[#004D71] transition-all" 
        />
      )}
    </div>
  );
});

export function CVCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 text-[#004D71]">{icon}</div>
      <div className="text-left font-sans">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-xs font-bold text-slate-800 uppercase">{value}</p>
      </div>
    </div>
  );
}

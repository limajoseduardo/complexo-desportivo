import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, Waves, Sun, Flame, Users2, Activity,
  MapPin, User, ChevronRight, Search, Navigation
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { UserProfile } from '../types';
import { PicotoIcon, AvatarImage } from './Common';
import { isUserInZone } from '../lib/logic';

export function AttendanceModule() {
  const [utentes, setUtentes] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/users`;
    const q = query(
      collection(db, path),
      where('isInside', '==', true),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUtentes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsub();
  }, []);

  const zones = [
    { id: 'gym', label: "Ginásio", icon: <Dumbbell />, target: "Ginásio" },
    { id: 'pool_in', label: "Piscina Coberta", icon: <Waves />, target: "Coberta" },
    { id: 'pool_out', label: "Piscina Exterior", icon: <Sun />, target: "Exterior" },
    { id: 'sauna', label: "Sauna", icon: <Flame />, target: "Sauna" },
    { id: 'fit', label: "Aulas", icon: <Users2 />, target: "Aula" }
  ];

  const getCount = (zId: string) => {
    return utentes.filter(u => isUserInZone(u, zId)).length;
  };

  const filteredUtentes = utentes.filter(u => {
    const nameMatch = (u.n?.toLowerCase().includes(searchTerm.toLowerCase()) || u.nome?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!nameMatch) return false;
    if (!selectedZone) return true;
    
    const zone = zones.find(z => z.target === selectedZone);
    if (!zone) return (u.location || '').toLowerCase().includes(selectedZone.toLowerCase());

    return isUserInZone(u, zone.id);
  });

  return (
    <div className="space-y-6 animate-in fade-in pb-32 text-left font-sans max-w-full overflow-hidden px-1">
      <div className="px-1 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
            <Activity className="text-[#F7B500]"/> Afluência Live
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Quem está no complexo neste momento</p>
        </div>
        <div className="bg-[#004D71] text-[#F7B500] px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg">
          {utentes.length} Total
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-1">
         {zones.map(z => {
           const count = getCount(z.id);
           const isActive = selectedZone === z.target;
           return (
            <button 
              key={z.id}
              onClick={() => setSelectedZone(isActive ? null : z.target)}
              className={`flex flex-col items-center justify-center p-6 rounded-[2.5rem] border-4 transition-all active:scale-95 shadow-md relative ${isActive ? 'bg-[#004D71] border-[#F7B500] text-[#F7B500]' : 'bg-white border-slate-50 text-[#004D71]'}`}
            >
              {count > 0 && (
                <div className={`absolute -top-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black border-4 ${isActive ? 'bg-[#F7B500] text-[#004D71] border-[#004D71]' : 'bg-[#004D71] text-white border-white shadow-lg'}`}>
                  {count}
                </div>
              )}
              <div className={`p-4 rounded-3xl mb-3 ${isActive ? 'bg-white/10' : 'bg-slate-50 text-[#004D71]/40'}`}>
                {React.cloneElement(z.icon as React.ReactElement, { size: 32 })}
              </div>
              <span className="text-[11px] font-black uppercase leading-none text-center tracking-tighter">{z.label}</span>
            </button>
           );
         })}
      </div>

      <div className="space-y-4">
        {selectedZone && (
          <div className="flex items-center gap-2 px-2">
             <div className="w-2 h-2 bg-[#F7B500] rounded-full" />
             <p className="text-[10px] font-black text-[#004D71] uppercase tracking-widest">Filtrado por: {selectedZone} ({filteredUtentes.length})</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredUtentes.map(u => (
            <div key={u.id} className="bg-white rounded-[2.5rem] p-5 border-4 border-[#004D71]/5 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <AvatarImage src={u.img} alt={u.n || u.nome} className="w-16 h-16 rounded-[1.5rem] border-2 border-white shadow-md" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-white animate-pulse" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-sm text-[#004D71] uppercase leading-none truncate pr-4">{u.n || u.nome}</h4>
                  <div className="flex items-center gap-1.5 mt-2.5 text-slate-400">
                    <div className={`p-1 rounded-md ${u.location?.includes('Ginásio') ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>
                       <MapPin size={10}/>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">{u.location || 'Zona Comum'}</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl text-[#004D71] opacity-20 group-hover:opacity-100 group-hover:bg-[#F7B500] transition-all shrink-0">
                 <Navigation size={20}/>
              </div>
            </div>
          ))}
        </div>
        {filteredUtentes.length === 0 && (
          <div className="py-20 text-center text-slate-200">
            <PicotoIcon className="mx-auto mb-4 opacity-10" size={60} />
            <p className="font-black text-[10px] uppercase tracking-widest">Ninguém nesta área de momento</p>
          </div>
        )}
      </div>
    </div>
  );
}

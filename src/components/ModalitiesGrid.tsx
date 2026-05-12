import React from 'react';
import { Users2, Dumbbell, Waves, Flame, Droplet, Activity, Sun, Star, Target, Building2 } from 'lucide-react';
import { UserProfile } from '../types';
import { isUserInZone } from '../lib/logic';

export const ModalitiesGrid = React.memo(({ utentes }: { utentes: UserProfile[] }) => {
  const zones = React.useMemo(() => [
    { id: 'livre',    label: 'Piscina Regime Livre', icon: <Star size={24}/>,      color: 'text-sky-400',     bg: 'bg-sky-400/10' },
    { id: 'pool_out', label: 'Piscina Exterior',     icon: <Sun size={24}/>,       color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { id: 'nat1',     label: 'Natação Nível 1',      icon: <Waves size={24}/>,     color: 'text-blue-300',    bg: 'bg-blue-300/10' },
    { id: 'nat2',     label: 'Natação Nível 2',      icon: <Waves size={24}/>,     color: 'text-blue-400',    bg: 'bg-blue-400/10' },
    { id: 'nat3',     label: 'Natação Nível 3',      icon: <Waves size={24}/>,     color: 'text-blue-500',    bg: 'bg-blue-500/10' },
    { id: 'hidro',    label: 'Hidroginástica',       icon: <Droplet size={24}/>,   color: 'text-teal-400',    bg: 'bg-teal-400/10' },
    { id: 'bebes',    label: 'Bebés / AMA',          icon: <Users2 size={24}/>,    color: 'text-indigo-400',  bg: 'bg-indigo-400/10' },
    { id: 'fit',      label: 'Aulas Fitness',        icon: <Activity size={24}/>,  color: 'text-purple-400',  bg: 'bg-purple-400/10' },
    { id: 'gym',      label: 'Ginásio',              icon: <Dumbbell size={24}/>,  color: 'text-[#F7B500]',   bg: 'bg-[#F7B500]/10' },
    { id: 'padel',    label: 'Padel',                icon: <Target size={24}/>,    color: 'text-cyan-300',    bg: 'bg-cyan-300/10' },
    { id: 'pavilhao', label: 'Pavilhão',             icon: <Building2 size={24}/>, color: 'text-indigo-300',  bg: 'bg-indigo-300/10' },
    { id: 'sauna',    label: 'Sauna',                icon: <Flame size={24}/>,     color: 'text-orange-400',  bg: 'bg-orange-400/10' },
  ], []);

  const zoneCounts = React.useMemo(() =>
    zones.map(z => ({ ...z, count: utentes.filter(u => isUserInZone(u, z.id)).length })),
    [utentes, zones]
  );

  const total = utentes.length;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Afluência em Tempo Real</h3>
        <div className="flex items-center gap-2">
          <Users2 size={16} className="text-[#F7B500]" />
          <span className="text-base font-black text-[#004D71]">{total} total</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {zoneCounts.map(z => (
          <div
            key={z.id}
            className={`rounded-2xl p-4 flex flex-col items-center gap-3 border border-slate-100 transition-all hover:shadow-md ${z.bg}`}
          >
            <div className={`p-2.5 rounded-xl ${z.color}`}>
              {React.cloneElement(z.icon, { size: 20 })}
            </div>
            <p className="text-3xl font-black text-slate-700 text-center">{z.count}</p>
            <p className="text-xs font-black text-slate-600 uppercase text-center leading-tight">{z.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

export default ModalitiesGrid;

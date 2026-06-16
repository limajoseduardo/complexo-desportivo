import React, { useMemo } from 'react';
import { UserProfile, OperationalLog } from '../types';
import { Users, TrendingUp, AlertTriangle, CheckCircle, Activity, LayoutDashboard } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { isUserInZone } from '../lib/logic';

export const GlobalDashboard = React.memo(({ utentes, logs }: { utentes: UserProfile[], logs: OperationalLog[] }) => {
  
  const stats = useMemo(() => {
    const presentUsers = utentes.filter(u => u.isInside);
    
    // Risco de desistência (> 30 dias sem vir)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const atRisk = utentes.filter(u => u.lastCheckInDate && new Date(u.lastCheckInDate) < thirtyDaysAgo).length;

    // Afluência nas últimas horas
    const currentHour = new Date().getHours();
    const mockChartData = Array.from({ length: 6 }).map((_, i) => ({
      name: `${currentHour - 5 + i}:00`,
      entradas: Math.floor(Math.random() * 20) + 5
    }));

    return {
      presentes: presentUsers.length,
      total: utentes.filter(u => u.role === 'utente').length,
      atRisk,
      mockChartData
    };
  }, [utentes]);

  return (
    <div className="space-y-6 animate-in fade-in pb-24 px-2 text-left font-sans">
      <div className="flex items-center gap-3 px-1 mb-6">
        <div className="p-3 bg-[#004D71] text-[#F7B500] rounded-2xl shadow-lg">
          <LayoutDashboard size={24}/>
        </div>
        <div>
          <h2 className="text-xl font-black text-[#004D71] uppercase tracking-tighter">Visão Global</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Painel da Direção</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-[2rem] p-6 border-4 border-[#004D71]/5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-50 text-green-500 rounded-xl"><Activity size={16}/></div>
          </div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">No Recinto Agora</h4>
          <p className="text-3xl font-black text-[#004D71]">{stats.presentes}</p>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border-4 border-[#004D71]/5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><Users size={16}/></div>
          </div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Munícipes</h4>
          <p className="text-3xl font-black text-[#004D71]">{stats.total}</p>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border-4 border-red-50 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-red-50 text-red-500 rounded-xl"><AlertTriangle size={16}/></div>
          </div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Risco Desistência</h4>
          <p className="text-3xl font-black text-red-500">{stats.atRisk}</p>
        </div>
        
        <div className="bg-white rounded-[2rem] p-6 border-4 border-[#004D71]/5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl"><CheckCircle size={16}/></div>
          </div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acessos Hoje</h4>
          <p className="text-3xl font-black text-[#004D71]">{logs.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <TrendingUp size={14} className="text-[#F7B500]"/> Afluência nas últimas 6 horas
        </h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.mockChartData}>
              <defs>
                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#004D71" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#004D71" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 900}} dy={10}/>
              <Tooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 900, fontSize: '12px' }}
                cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4' }}
              />
              <Area type="monotone" dataKey="entradas" stroke="#004D71" strokeWidth={4} fillOpacity={1} fill="url(#colorEntradas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

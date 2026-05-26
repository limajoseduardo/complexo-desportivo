
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../contexts/AppContext';

interface BugReport {
  id: string;
  student_id: string;
  title: string;
  message: string;
  is_urgent: boolean;
  status: 'PENDING' | 'RESOLVED';
  created_at: string;
  student_name?: string;
  student_avatar?: string;
}

export default function BugReportsView({ onBack }: { onBack: () => void }) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_reports')
        .select('*, profiles(name, avatar)')
        .order('created_at', { ascending: false });

      if (data) {
        const formatted = data.map((r: any) => ({
          id: r.id,
          student_id: r.student_id,
          title: r.title,
          message: r.message,
          is_urgent: r.is_urgent,
          status: r.status || 'PENDING',
          created_at: r.created_at,
          student_name: r.profiles?.name || 'Aluno Desconhecido',
          student_avatar: r.profiles?.avatar
        }));
        setReports(formatted);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resolveReport = async (id: string) => {
    try {
      const { error } = await supabase
        .from('student_reports')
        .update({ status: 'RESOLVED' })
        .eq('id', id);
      
      if (error) {
        console.error('Erro ao resolver:', error);
        alert('Erro ao marcar como resolvido: ' + error.message);
        return;
      }
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'RESOLVED' } : r));
    } catch (e) {
      console.error(e);
      alert('Erro inesperado ao resolver.');
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteReport = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000); // Reset after 3s if not clicked again
      return;
    }

    try {
      const { error } = await supabase.from('student_reports').delete().eq('id', id);
      if (error) {
        console.error('Database error deleting report:', error);
        return;
      }
      setReports(prev => prev.filter(r => r.id !== id));
      setDeletingId(null);
    } catch (e) {
      console.error('Exception during delete:', e);
    }
  };

  const isDesktopAdmin = window.location.pathname.includes('/ptadmin');

  return (
    <div className={`flex flex-col h-full bg-background animate-enter ${isDesktopAdmin ? '' : ''}`}>
      {!isDesktopAdmin && (
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm p-4 border-b border-main/5 flex items-center gap-3">
          <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/5 transition-colors">
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
          <h1 className="text-xl font-bold text-main">Relatórios de Bugs / Feedback</h1>
        </header>
      )}

      <main className={`flex-1 p-4 overflow-y-auto space-y-4 ${isDesktopAdmin ? 'pt-8' : ''} pb-24`}>
        {isDesktopAdmin && (
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Relatórios de Bugs / Feedback</h2>
           </div>
        )}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></span>
            <p className="text-sm font-bold uppercase tracking-widest">A carregar mensagens...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted/40">
            <span className="material-symbols-outlined text-6xl mb-2">check_circle</span>
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum problema reportado!</p>
          </div>
        ) : (
          reports.map((report) => (
            <div 
              key={report.id} 
              className={`bg-surface p-5 rounded-[1.5rem] border ${report.status === 'RESOLVED' ? 'opacity-60 border-main/5 grayscale-[0.5]' : report.is_urgent ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-main/5'} shadow-sm animate-enter relative group overflow-hidden`}
            >
              {report.status === 'RESOLVED' && (
                <div className="absolute top-2 right-12 z-0 opacity-10 rotate-12 pointer-events-none">
                  <span className="material-symbols-outlined text-4xl text-green-500">task_alt</span>
                </div>
              )}
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div 
                    className="h-10 w-10 rounded-full bg-cover bg-center border border-main/10" 
                    style={{ backgroundImage: `url('${report.student_avatar}')` }}
                  ></div>
                  <div>
                    <h3 className="font-bold text-main text-sm">{report.student_name}</h3>
                    <p className="text-[10px] text-muted font-bold uppercase">{new Date(report.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {report.status === 'PENDING' ? (
                    <button 
                      onClick={() => resolveReport(report.id)}
                      className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-full bg-green-500/10 text-green-600 text-xs font-black uppercase tracking-wider hover:bg-green-500 hover:text-white transition-all shadow-sm"
                      title="Marcar como resolvido"
                    >
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>Resolver</span>
                    </button>
                  ) : (
                    <span className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-full bg-main/5 text-muted text-[10px] font-black uppercase tracking-wider">
                      Reslv.
                    </span>
                  )}
                  {report.is_urgent && report.status === 'PENDING' && (
                    <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Urgente</span>
                  )}
                  <button 
                    onClick={() => deleteReport(report.id)}
                    className={`h-10 px-3 flex items-center justify-center rounded-full transition-all cursor-pointer z-20 gap-1 ${deletingId === report.id ? 'bg-red-500 text-white w-auto shadow-lg scale-105' : 'text-muted hover:text-red-500 hover:bg-red-500/10'}`}
                    aria-label="Eliminar"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {deletingId === report.id ? 'warning' : 'delete'}
                    </span>
                    {deletingId === report.id && <span className="text-[10px] font-black uppercase">Apagar?</span>}
                  </button>
                </div>
              </div>

              <div className="bg-main/5 rounded-xl p-4">
                <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-1">{report.title}</h4>
                <p className="text-sm text-main leading-relaxed whitespace-pre-wrap">{report.message}</p>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

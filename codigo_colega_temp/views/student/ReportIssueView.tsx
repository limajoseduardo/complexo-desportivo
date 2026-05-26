import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../contexts/AppContext';

export default function ReportIssueView({ onBack }: { onBack: () => void }) {
  const { user } = useApp();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !title) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('student_reports').insert({
        student_id: user?.id,
        title,
        message,
        is_urgent: isUrgent,
      });

      if (error) throw error;
      setSent(true);
      setTimeout(onBack, 2000);
    } catch (err) {
      console.error('Erro ao enviar report:', err);
      alert('Erro ao enviar. Verifica a tua ligação.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-enter">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-green-500 text-4xl">check_circle</span>
        </div>
        <h2 className="text-xl font-bold text-main mb-2">Enviado com sucesso!</h2>
        <p className="text-muted text-sm">Obrigado pelo teu feedback. Vamos analisar o mais brevemente possível.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background animate-enter">
      <header className="p-4 flex items-center gap-3 border-b border-main/5">
        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/5 transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-xl font-bold text-main">Reportar Bug / Feedback</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6 overflow-y-auto pb-24">
        <div className="bg-primary/5 p-4 rounded-2xl flex gap-3 items-start">
          <span className="material-symbols-outlined text-primary">info</span>
          <p className="text-xs text-main/80 leading-relaxed">
            Encontraste algo que não funciona? Ou tens uma sugestão para melhorar a app? Escreve aqui os detalhes.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-main uppercase tracking-widest ml-1">Assunto</label>
          <input 
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-card border border-main/10 rounded-2xl p-4 text-sm text-main outline-none focus:border-primary/50 transition-all shadow-sm"
            placeholder="Ex: Erro ao finalizar treino, Sugestão de cor..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-main uppercase tracking-widest ml-1">Mensagem Detalhada</label>
          <textarea 
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full bg-card border border-main/10 rounded-2xl p-4 text-sm text-main outline-none focus:border-primary/50 transition-all shadow-sm resize-none"
            placeholder="Descreve o que aconteceu ou a tua ideia..."
          />
        </div>

        <div className="flex items-center gap-3 p-4 bg-card border border-main/5 rounded-2xl cursor-pointer select-none" onClick={() => setIsUrgent(!isUrgent)}>
          <div className={`h-6 w-11 rounded-full transition-colors relative ${isUrgent ? 'bg-red-500' : 'bg-main/10'}`}>
            <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${isUrgent ? 'right-1' : 'left-1'}`}></div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-main">Isto é urgente?</p>
            <p className="text-[10px] text-muted">Ativa se o erro te impede de usar a app.</p>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              <span className="material-symbols-outlined">send</span>
              Enviar Reporte
            </>
          )}
        </button>
      </form>
    </div>
  );
}

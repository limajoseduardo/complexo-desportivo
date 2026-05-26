import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Screen, UserRole } from '../types';

export default function ResetPasswordView() {
  const { updatePassword, setScreen, user } = useApp();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!password) {
      alert("Por favor, digite uma nova senha.");
      return;
    }
    if (password !== confirmPassword) {
      alert("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      alert("Erro ao redefinir senha: " + (error.message || "Erro desconhecido"));
    } else {
      setShowSuccess(true);
    }
  };

  const handleFinish = () => {
    // Clean up URL hash to avoid re-triggering recovery mode on reload
    window.location.hash = '';

    // If user is already loaded in context (common in recovery flow), redirect to dashboard
    if (user) {
        setScreen(user.role === UserRole.TRAINER ? Screen.TRAINER_DASHBOARD : Screen.STUDENT_DASHBOARD);
    } else {
        // Fallback to login if user state isn't ready
        setScreen(Screen.LOGIN);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-6 bg-background">
      <div className="absolute inset-0 z-0 opacity-20">
        <img 
          className="h-full w-full object-cover" 
          src="https://www.hussle.com/blog/wp-content/uploads/2020/12/Gym-structure-1080x675.png" 
          alt="Gym background" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-primary/10 rounded-full">
            <span className="material-symbols-outlined text-primary text-6xl">lock_reset</span>
          </div>
          <h1 className="text-2xl font-bold text-main text-center">Redefinir Senha</h1>
          <p className="text-muted text-center text-sm">
            Detectamos um pedido de recuperação.<br/>Crie uma nova senha para sua conta.
          </p>
        </div>

        <div className="w-full space-y-4">
           <div className="space-y-1">
                <label className="text-sm font-bold text-main ml-1">Nova Palavra-passe</label>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted">lock</span>
                    <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 rounded-lg bg-main/5 border border-main/10 pl-10 pr-4 text-main placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="••••••••"
                    />
                </div>
            </div>
            
             <div className="space-y-1">
                <label className="text-sm font-bold text-main ml-1">Confirmar Senha</label>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted">lock_clock</span>
                    <input 
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full h-12 rounded-lg bg-main/5 border border-main/10 pl-10 pr-4 text-main placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button 
                disabled={loading}
                onClick={handleSubmit}
                className="w-full h-12 rounded-xl bg-primary text-background font-bold text-base hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20 mt-4"
            >
                {loading ? "A guardar..." : "Redefinir Palavra-passe"}
            </button>
        </div>
      </div>

      {/* SUCCESS POPUP */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-primary/20 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                 <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <h3 className="text-xl font-bold text-main mb-2">Palavra-passe Alterada!</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                A tua palavra-passe foi redefinida com sucesso. Já podes aceder à tua conta.
              </p>
              <button 
                onClick={handleFinish}
                className="w-full h-12 rounded-xl bg-primary text-background hover:brightness-110 font-bold transition-all shadow-lg shadow-primary/20"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';

interface LoginViewProps {
  onLogin: (email: string, pass: string) => Promise<{ error?: any }>;
  onRegister: (name: string, email: string, pass: string, role: UserRole, code?: string) => Promise<{ error?: any }>;
  onRecover: (email: string) => Promise<{ error?: any }>;
}

export default function LoginView({ onLogin, onRegister, onRecover }: LoginViewProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Modais de Estado
  const [showCodeAlert, setShowCodeAlert] = useState(false); // Modal específico de código
  const [errorPopup, setErrorPopup] = useState<string | null>(null); // Modal genérico de erro
  const [successPopup, setSuccessPopup] = useState<{title: string, message: string} | null>(null); // Modal de sucesso

  // Safety Timeout: Force loading off after 8 seconds to prevent indefinite "Processando..."
  useEffect(() => {
    let timeout: any;
    if (loading) {
        timeout = setTimeout(() => {
            setLoading(false);
        }, 8000);
    }
    return () => clearTimeout(timeout);
  }, [loading]);

  const getErrorMessage = (error: any): string => {
      if (!error) return 'Erro desconhecido';
      if (typeof error === 'string') return error;
      if (error.message && typeof error.message === 'string') return error.message;
      if (error.error_description && typeof error.error_description === 'string') return error.error_description;
      
      // Fallback for object errors to avoid [object Object]
      try {
        return JSON.stringify(error, null, 2); 
      } catch (e) {
        return "Erro interno (formato inválido)";
      }
  };

  const handleAction = async () => {
    setLoading(true);
    try {
      if (isRecovering) {
        if (!email) {
          setErrorPopup("Por favor, digite o teu email.");
          setLoading(false);
          return;
        }

        const { error } = await onRecover(email);
        
        if (error) {
          setErrorPopup("Erro ao enviar email de recuperação: " + getErrorMessage(error));
        } else {
          setSuccessPopup({
            title: "Email Enviado!", 
            message: `Enviamos um link de recuperação para ${email}.\n\n1. Verifica a tua caixa de entrada (ou spam).\n2. Clica no link do email.\n3. Vais voltar aqui para criar uma nova password.`
          });
        }
        setLoading(false);
        return;
      }

      if (isRegistering) {
        // Validação de Campos Básicos
        if (!name || !email || !password) {
          setErrorPopup("Por favor, preencha todos os campos.");
          setLoading(false);
          return;
        }
        
        // Validação RIGOROSA do Código de Acesso
        if (!accessCode || accessCode.trim() === '') {
           setShowCodeAlert(true); // Trigger custom popup for code
           setLoading(false);
           return;
        }

        const cleanCode = accessCode.trim();
        // SECURITY FIX: All UI registrations are forced to STUDENT role.
        // Trainer accounts should be created manually in the database for security.
        const role = UserRole.STUDENT;

        const { error } = await onRegister(name, email, password, role, cleanCode);
        
        if (error) {
           let msg = getErrorMessage(error);
           const lowerMsg = msg.toLowerCase();

           // Tradução amigável de erros comuns do Supabase e validações
           if (lowerMsg.includes("password should be at least")) {
              msg = "A password deve ter pelo menos 6 caracteres.";
           } else if (lowerMsg.includes("user already registered") || lowerMsg.includes("already registered")) {
              msg = "Este email já está registado. Tenta fazer login.";
           } else if (lowerMsg.includes("código expirado") || lowerMsg.includes("codigo expirado")) {
              msg = "Código expirado porque já foi utilizado.";
           } else if (lowerMsg.includes("invalid claim")) {
              msg = "Sessão inválida. Tenta novamente.";
           } else if (lowerMsg.includes("rate limit")) {
              msg = "Muitas tentativas. Aguarda um pouco.";
           } else if (lowerMsg.includes("validation failed")) {
              msg = "Dados inválidos. Verifica as informações.";
           }

           setErrorPopup(`Erro no registo: ${msg}`);
           setLoading(false);
        } else {
           setSuccessPopup({
             title: "Conta Criada!", 
             message: `A tua conta de Aluno foi criada com sucesso! Faz login para continuar.`
           });
           setLoading(false);
        }
      } else {
        if (!email || !password) {
            setErrorPopup("Preenche o email e a password.");
            setLoading(false);
            return;
        }
        const { error } = await onLogin(email, password);
        
        if (error) {
            let msg = getErrorMessage(error);
            if (msg.includes("Invalid login credentials")) msg = "Email ou password incorretos.";
            setErrorPopup(`Erro no login: ${msg}`);
            setLoading(false); 
        }
      }
    } catch (e) {
      setErrorPopup("Ocorreu um erro inesperado. Verifica a tua ligação.");
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-6 bg-background overflow-y-auto">
      {/* Background Image & Overlay with subtle zoom/float effect */}
      <div className="absolute inset-0 z-0 opacity-20">
        <img 
          className="h-full w-full object-cover opacity-100" 
          src="https://www.hussle.com/blog/wp-content/uploads/2020/12/Gym-structure-1080x675.png" 
          alt="Gym background" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        {/* Logo/Header */}
        <div className="flex flex-col items-center gap-2 animate-enter">
          <div className="h-24 w-24 rounded-2xl bg-primary overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.3)] rotate-3 animate-float">
             <img src="/icon-192x192.png" alt="FITVLR Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-extrabold text-main tracking-tight mt-2 drop-shadow-lg">FITVLR<span className="text-primary">PRO</span></h1>
          <p className="text-muted text-sm font-medium">O teu PT de bolso.</p>
        </div>

        {/* Form Container */}
        <div className="w-full glass p-6 rounded-3xl shadow-2xl animate-enter delay-100">
           
           {/* Tabs (Login/Register) */}
           {!isRecovering && window.location.pathname !== '/ptadmin' && (
             <div className="flex p-1 bg-main/5 rounded-xl mb-6 border border-main/5">
               <button 
                 onClick={() => setIsRegistering(false)}
                 className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${!isRegistering ? 'bg-primary text-background shadow-md scale-105' : 'text-muted hover:text-muted-foreground'}`}
               >
                 Entrar
               </button>
               <button 
                 onClick={() => setIsRegistering(true)}
                 className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${isRegistering ? 'bg-primary text-background shadow-md scale-105' : 'text-muted hover:text-muted-foreground'}`}
               >
                 Criar Conta
               </button>
             </div>
           )}

           {!isRecovering && window.location.pathname === '/ptadmin' && (
             <div className="mb-6 text-center animate-enter">
                <h2 className="text-xl font-bold text-main">Área do Treinador</h2>
                <p className="text-xs text-muted mt-1">Faz login com a tua conta de PT.</p>
             </div>
           )}

           {isRecovering && (
             <div className="mb-6 text-center animate-enter">
                <h2 className="text-xl font-bold text-main">Recuperar Password</h2>
                <p className="text-xs text-muted mt-1">Digita o teu email para receber o link.</p>
             </div>
           )}

           <div className="space-y-4">
              {isRegistering && (
                <div className="space-y-1 animate-enter">
                  <label className="text-xs font-bold text-muted ml-1 uppercase">Nome Completo</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors">person</span>
                    <input 
                      type="text" 
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-12 rounded-xl bg-main/5 border border-main/10 pl-10 pr-4 text-main placeholder:text-zinc-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm"
                      placeholder="Nome Completo"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1 animate-enter delay-100">
                <label className="text-xs font-bold text-muted ml-1 uppercase">Email</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors">mail</span>
                  <input 
                    type="email" 
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 rounded-xl bg-main/5 border border-main/10 pl-10 pr-4 text-main placeholder:text-zinc-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm"
                    placeholder="exemplo@email.com"
                  />
                </div>
              </div>

              {!isRecovering && (
                <div className="space-y-1 animate-enter delay-200">
                  <label className="text-xs font-bold text-muted ml-1 uppercase">Password</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors">lock</span>
                    <input 
                      type="password" 
                      name="password"
                      autoComplete={isRegistering ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 rounded-xl bg-main/5 border border-main/10 pl-10 pr-4 text-main placeholder:text-zinc-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {isRegistering && (
                <div className="space-y-1 animate-enter delay-300">
                  <label className="text-xs font-bold text-primary ml-1 uppercase flex items-center gap-1">
                     Código de Acesso
                     <span className="material-symbols-outlined text-[14px]">vpn_key</span>
                  </label>
                  <input 
                    type="text" 
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="w-full h-12 rounded-xl bg-primary/10 border border-primary/30 px-4 text-main placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-mono text-center tracking-widest uppercase"
                    placeholder="CÓDIGO"
                  />
                  <p className="text-[10px] text-muted text-center leading-tight pt-1">Pede o código ao teu PT</p>
                </div>
              )}

              <button 
                onClick={handleAction}
                disabled={loading}
                className="w-full h-14 mt-4 bg-primary text-background rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed animate-enter delay-300"
              >
                {loading ? (
                   <span className="h-5 w-5 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                ) : (
                   <>
                     <span>{isRecovering ? 'Enviar Link' : (isRegistering ? 'Criar Conta' : 'Entrar')}</span>
                     <span className="material-symbols-outlined">{isRecovering ? 'send' : (isRegistering ? 'person_add' : 'login')}</span>
                   </>
                )}
              </button>
           </div>

           {!isRegistering && (
             <div className="mt-6 text-center animate-enter delay-400">
               <button 
                 onClick={() => setIsRecovering(!isRecovering)}
                 className="text-muted text-xs hover:text-main transition-colors underline decoration-zinc-600 hover:decoration-white underline-offset-4"
               >
                 {isRecovering ? 'Voltar para Login' : 'Esqueci-me da password'}
               </button>
             </div>
           )}
        </div>
      </div>

      {/* ERROR POPUP */}
      {errorPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-scale">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-red-500/30 shadow-2xl relative">
              <div className="flex flex-col items-center text-center">
                 <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-3 text-red-500 animate-pulse">
                    <span className="material-symbols-outlined text-3xl">error</span>
                 </div>
                 <h3 className="text-lg font-bold text-main mb-2">Ops! Algo correu mal.</h3>
                 <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    {errorPopup}
                 </p>
                 <button 
                   onClick={() => setErrorPopup(null)}
                   className="w-full h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95"
                 >
                   Tentar Novamente
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* CODE ALERT POPUP */}
      {showCodeAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-scale">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-primary/30 shadow-2xl relative">
              <div className="flex flex-col items-center text-center">
                 <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 text-primary animate-bounce">
                    <span className="material-symbols-outlined text-3xl">vpn_key</span>
                 </div>
                 <h3 className="text-lg font-bold text-main mb-2">Código Necessário</h3>
                 <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    Para te registares, precisas de um código de acesso fornecido pelo teu Personal Trainer.
                 </p>
                 <button 
                   onClick={() => setShowCodeAlert(false)}
                   className="w-full h-12 rounded-xl bg-primary text-background hover:brightness-110 font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
                 >
                   Entendi
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* SUCCESS POPUP */}
      {successPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-scale">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-primary/20 shadow-2xl relative">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary animate-pulse">
                 <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <h3 className="text-xl font-bold text-main mb-2">{successPopup.title}</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed whitespace-pre-wrap">
                {successPopup.message}
              </p>
              <button 
                onClick={() => {
                    setSuccessPopup(null);
                    if (successPopup.title === "Conta Criada!") {
                        setIsRegistering(false); // Switch to login tab
                    } else if (successPopup.title === "Email Enviado!") {
                        setIsRecovering(false); // Switch back to login
                    }
                }}
                className="w-full h-12 rounded-xl bg-primary text-background hover:brightness-110 font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
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

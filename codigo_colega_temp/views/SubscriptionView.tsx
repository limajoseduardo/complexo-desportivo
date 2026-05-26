import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../contexts/AppContext';

interface SubscriptionViewProps {
  onBack: () => void;
}

export default function SubscriptionView({ onBack }: SubscriptionViewProps) {
  const { user } = useApp();
  const [selectedPlan, setSelectedPlan] = useState<'PRO_MONTHLY_BASIC' | 'PRO_MONTHLY_ADVANCED' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'MBWAY' | 'MULTIBANCO' | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'WAITING_MBWAY' | 'COMPLETED'>('IDLE');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const plans = [
    { id: 'PRO_MONTHLY_BASIC', name: 'Plano Mensal', price: 9.99, desc: 'Acesso completo a todos os planos de treino personalizados para atingir os seus objetivos.' },
    { id: 'PRO_MONTHLY_ADVANCED', name: 'Plano Mensal', price: 19.99, desc: 'O pacote completo: treino, plano alimentar personalizado e acompanhamento contínuo.' },
  ];

  const handlePlanSelect = (planId: 'PRO_MONTHLY_BASIC' | 'PRO_MONTHLY_ADVANCED') => {
    setSelectedPlan(planId);
    setShowPaymentModal(true);
  };

  useEffect(() => {
    if (paymentStatus === 'WAITING_MBWAY') {
      let isCompleted = false;
      const handleFocus = () => {
        if (!isCompleted && (document.visibilityState === 'visible' || document.hasFocus())) {
          isCompleted = true;
          // Simulate checking backend for payment status after user returns to app
          setTimeout(() => {
            setPaymentStatus('COMPLETED');
          }, 1500);
        }
      };
      
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleFocus);

      // Fallback timeout in case user confirms on another device
      const fallbackTimer = setTimeout(() => {
        if (!isCompleted) {
          isCompleted = true;
          setPaymentStatus('COMPLETED');
        }
      }, 15000); // 15 seconds

      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
        clearTimeout(fallbackTimer);
      };
    }
  }, [paymentStatus]);

  const handlePay = async () => {
    if (!selectedPlan || !paymentMethod) return;
    if (paymentMethod === 'MBWAY' && mobileNumber.length < 9) return;
    
    setPaymentStatus('PROCESSING');
    
    try {
      const plan = plans.find(p => p.id === selectedPlan);
      const amount = plan?.price || 0;
      
      const endpoint = paymentMethod === 'MBWAY' ? '/api/eupago/mbway' : '/api/eupago/multibanco';
      const body = paymentMethod === 'MBWAY' ? { amount, mobileNumber } : { amount };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (data.success) {
        if (paymentMethod === 'MBWAY') {
          setPaymentStatus('WAITING_MBWAY');
        } else {
          setPaymentStatus('SUCCESS');
        }
        setPaymentDetails(data);
      } else {
        setPaymentStatus('ERROR');
        setPaymentDetails({ message: data.message });
      }
    } catch (e) {
      setPaymentStatus('ERROR');
      setPaymentDetails({ message: "Ocorreu um erro de rede." });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden font-sans">
      <header className="px-6 py-5 flex items-center justify-between z-10 shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-main/5 text-main active:scale-95 transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-main">Subscrição Premium</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-24 z-10 scrollbar-hide">
        {paymentStatus === 'IDLE' && (
          <div className="space-y-6">
            <section className="animate-enter delay-100">
              <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">Escolha o seu plano</h2>
              <div className="space-y-4">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => handlePlanSelect(plan.id as any)}
                    className={`w-full p-5 rounded-2xl text-left border-2 transition-all relative overflow-hidden ${
                      selectedPlan === plan.id 
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
                        : 'border-main/10 bg-card hover:border-main/20 hover:shadow-sm'
                    }`}
                  >
                    {plan.id === 'PRO_MONTHLY_ADVANCED' && (
                      <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-widest">
                        Mais Popular
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-2 mt-1">
                      <span className={`font-bold text-lg ${selectedPlan === plan.id ? 'text-primary' : 'text-main'}`}>{plan.name}</span>
                      <span className="font-bold text-2xl text-main">{plan.price.toFixed(2)}<span className="text-base text-muted ml-0.5">€</span></span>
                    </div>
                    <p className="text-sm text-muted leading-relaxed">{plan.desc}</p>
                    {selectedPlan === plan.id && (
                      <motion.div layoutId="plan-selector" className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-8 space-y-4 bg-surface p-5 rounded-2xl border border-main/5 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-main mb-0.5">Sem Fidelização</h4>
                    <p className="text-muted text-xs leading-relaxed">Cancele a qualquer momento, sem taxas ocultas ou compromissos a longo prazo.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">security</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-main mb-0.5">Pagamento Seguro</h4>
                    <p className="text-muted text-xs leading-relaxed">Os seus dados estão protegidos com encriptação de ponta a ponta.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">support_agent</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-main mb-0.5">Suporte 24/7</h4>
                    <p className="text-muted text-xs leading-relaxed">A nossa equipa está sempre disponível para ajudar com qualquer questão.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        <AnimatePresence>
          {paymentStatus === 'IDLE' && showPaymentModal && selectedPlan && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPaymentModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-card w-full max-w-md rounded-3xl p-8 relative z-10 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-main">Pagamento</h2>
                    <p className="text-sm text-muted">Escolha o seu método preferido</p>
                  </div>
                  <button 
                    onClick={() => setShowPaymentModal(false)}
                    className="w-10 h-10 rounded-full bg-main/5 flex items-center justify-center text-muted hover:text-main transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-surface p-4 rounded-2xl border border-main/5 flex justify-between items-center">
                    <span className="text-muted font-medium">Plano Selecionado</span>
                    <span className="font-bold text-primary">{plans.find(p => p.id === selectedPlan)?.price.toFixed(2)}€</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setPaymentMethod('MBWAY')}
                      className={`p-5 rounded-2xl text-center border-2 transition-all flex flex-col items-center gap-3 relative ${
                        paymentMethod === 'MBWAY' ? 'border-[#008c99] bg-[#008c99]/5 shadow-md shadow-[#008c99]/10' : 'border-main/10 bg-card hover:border-main/20 hover:shadow-sm'
                      }`}
                    >
                      {paymentMethod === 'MBWAY' && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#008c99]" />
                      )}
                      <div className="h-10 flex items-center justify-center">
                        <img src="/mbway 128px 32px.png" alt="MB WAY" className="h-8 object-contain" />
                      </div>
                      <span className="font-bold text-sm text-main">MB WAY</span>
                    </button>
                    
                    <button
                      onClick={() => setPaymentMethod('MULTIBANCO')}
                      className={`p-5 rounded-2xl text-center border-2 transition-all flex flex-col items-center gap-3 relative ${
                        paymentMethod === 'MULTIBANCO' ? 'border-[#007cc0] bg-[#007cc0]/5 shadow-md shadow-[#007cc0]/10' : 'border-main/10 bg-card hover:border-main/20 hover:shadow-sm'
                      }`}
                    >
                      {paymentMethod === 'MULTIBANCO' && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#007cc0]" />
                      )}
                      <div className="h-10 flex items-center justify-center">
                         <img src="/Entidade 128px 32px.png" alt="Multibanco" className="h-8 object-contain" />
                      </div>
                      <span className="font-bold text-sm text-main">Multibanco</span>
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {paymentMethod === 'MBWAY' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-surface border border-main/10 p-5 rounded-2xl shadow-sm">
                          <label className="text-xs font-bold w-full uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">phone_iphone</span>
                            Telemóvel MB WAY
                          </label>
                          <div className="relative flex items-center">
                            <span className="absolute left-4 text-main font-mono text-lg font-medium">+351</span>
                            <input
                              type="tel"
                              placeholder="912 345 678"
                              value={mobileNumber}
                              onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                              className="w-full bg-transparent border-2 border-main/10 rounded-xl py-3 pl-16 pr-4 text-lg font-mono text-main outline-none focus:border-[#008c99] transition-colors focus:ring-4 focus:ring-[#008c99]/10"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={() => {
                      if (paymentMethod) handlePay();
                    }}
                    disabled={!paymentMethod || (paymentMethod === 'MBWAY' && mobileNumber.length < 9)}
                    className="w-full bg-primary text-white text-lg font-bold py-4 rounded-xl shadow-xl shadow-primary/20 mt-4 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                  >
                    <span>Confirmar Pagamento</span>
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {paymentStatus === 'PROCESSING' && (
           <div className="flex flex-col items-center justify-center py-32 animate-enter">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-6"></div>
            <p className="text-main font-bold text-lg">A processar pagamento...</p>
            <p className="text-muted text-sm mt-2">Por favor aguarde um momento.</p>
          </div>
        )}

        {paymentStatus === 'ERROR' && (
          <div className="flex flex-col items-center justify-center py-24 animate-enter text-center">
            <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <span className="material-symbols-outlined text-4xl">error</span>
            </div>
            <h2 className="text-2xl font-bold text-main mb-3">Erro no Pagamento</h2>
            <p className="text-muted mb-8 max-w-[250px] mx-auto">{paymentDetails?.message || "Ocorreu um erro ao processar o seu pagamento."}</p>
            <button 
              onClick={() => setPaymentStatus('IDLE')}
              className="bg-primary text-white px-8 py-4 w-full rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {paymentStatus === 'WAITING_MBWAY' && (
          <div className="flex flex-col items-center justify-center py-16 animate-enter">
            <div className="bg-card w-full rounded-3xl p-8 text-center border-2 border-[#008c99]/20 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#008c99]/20 via-[#008c99] to-[#008c99]/20"></div>
               <div className="w-20 h-20 bg-[#008c99]/10 text-[#008c99] rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                 <span className="material-symbols-outlined text-4xl z-10">smartphone</span>
                 <motion.div 
                   className="absolute inset-0 border-4 border-[#008c99] rounded-2xl"
                   animate={{ scale: [1, 1.15, 1], opacity: [1, 0, 1] }}
                   transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                 />
               </div>
               <h2 className="text-2xl font-bold text-main mb-3">Aguardando Pagamento</h2>
               <p className="text-muted mb-8 leading-relaxed">
                 Aceite a notificação na sua aplicação MB WAY para <br/> o número <strong className="text-main font-mono text-lg">+351 {mobileNumber.replace(/(\d{3})(?=\d)/g, "$1 ")}</strong>
               </p>
               <div className="flex flex-col items-center gap-4 bg-surface py-4 rounded-xl border border-main/5">
                 <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin"></div>
                 <span className="text-xs font-bold text-muted uppercase tracking-wider">A verificar estado...</span>
               </div>
            </div>
          </div>
        )}

        {paymentStatus === 'COMPLETED' && (
          <div className="flex flex-col items-center justify-center py-24 animate-enter text-center">
            <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
              <span className="material-symbols-outlined text-5xl">check_circle</span>
            </div>
            <h2 className="text-3xl font-bold text-main mb-3 tracking-tight">Pagamento Concluído</h2>
            <p className="text-muted mb-10 text-lg">A sua subscrição premium foi ativada!</p>
            <button 
              onClick={onBack}
              className="bg-primary text-white w-full py-4 rounded-xl font-bold shadow-xl shadow-primary/30 active:scale-[0.98] transition-transform text-lg"
            >
              Começar a Usar
            </button>
          </div>
        )}

        {paymentStatus === 'SUCCESS' && paymentDetails && (
          <div className="flex flex-col items-center justify-center py-10 animate-enter">
            {paymentMethod === 'MULTIBANCO' && (
              <div className="bg-card w-full rounded-3xl pt-2 pb-6 px-6 shadow-2xl relative overflow-hidden flex flex-col items-center dash-border">
                {/* Simulated receipt tear at top */}
                <svg className="absolute top-0 left-0 w-full text-card fill-current" height="12" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0,0 L0,10 L5,0 L10,10 L15,0 L20,10 L25,0 L30,10 L35,0 L40,10 L45,0 L50,10 L55,0 L60,10 L65,0 L70,10 L75,0 L80,10 L85,0 L90,10 L95,0 L100,10 L100,0 Z"></path>
                </svg>

                <div className="text-center pt-8 mb-8 mt-2 w-full">
                  <img src="/Entidade 128px 32px.png" alt="Multibanco" className="h-8 object-contain mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-main uppercase tracking-widest">Dados de Pagamento</h2>
                  <p className="text-sm text-muted mt-2">Pague no Multibanco ou Homebanking</p>
                </div>
                
                <div className="space-y-5 bg-surface/50 w-full p-6 p-4 rounded-xl border border-main/10 mb-8 font-mono">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted uppercase tracking-wider mb-1 font-sans font-bold">Entidade</span>
                    <span className="text-2xl font-bold text-main leading-none">{paymentDetails.entity}</span>
                  </div>
                  <div className="w-full h-px border-t-2 border-dashed border-main/10"></div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted uppercase tracking-wider mb-1 font-sans font-bold">Referência</span>
                    <span className="text-2xl font-bold text-main leading-none">{String(paymentDetails.reference).replace(/(\d{3})(?=\d)/g, "$1 ")}</span>
                  </div>
                  <div className="w-full h-px border-t-2 border-dashed border-main/10"></div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted uppercase tracking-wider mb-1 font-sans font-bold">Valor</span>
                    <span className="font-bold text-2xl text-[#007cc0]">{Number(paymentDetails.amount).toFixed(2)}€</span>
                  </div>
                </div>
                
                <button onClick={onBack} className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]">
                   Voltar ao Perfil
                 </button>

                 <style>{`
                    .dash-border { border: 1px solid rgba(0,0,0,0.05); }
                    @media (prefers-color-scheme: dark) {
                      .dash-border { border: 1px solid rgba(255,255,255,0.05); }
                    }
                 `}</style>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

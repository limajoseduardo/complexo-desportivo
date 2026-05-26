
import React, { useEffect, useState } from 'react';
import { Screen } from '../types';

interface LandingViewProps {
  onNavigate: (screen: Screen) => void;
}

// Componente auxiliar para o Mockup do Telefone
const PhoneMockup = ({ children, className = "", borderColor = "border-[#2c2c2c]" }: { children?: React.ReactNode, className?: string, borderColor?: string }) => (
  <div className={`w-[260px] sm:w-[280px] bg-background border-[10px] ${borderColor} outline outline-2 outline-main/20 rounded-[35px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative aspect-[9/19] flex-shrink-0 ${className}`}>
    {/* Notch */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[20px] bg-[#2c2c2c] rounded-b-xl z-20"></div>
    <div className="h-full w-full bg-background overflow-hidden flex flex-col relative text-xs font-sans text-main">
        {children}
    </div>
  </div>
);

// Componente de Scroll
const ScrollIndicator = ({ targetId, isAbsolute = false }: { targetId: string, isAbsolute?: boolean }) => (
    <button 
        onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' })}
        className={`${isAbsolute ? 'absolute bottom-8 left-1/2 -translate-x-1/2' : 'flex mx-auto mt-16'} z-20 group outline-none`}
        aria-label="Rolar para baixo"
    >
        <div className="flex flex-col items-center gap-1 animate-bounce">
            <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-widest group-hover:text-primary transition-colors duration-300">Ver Mais</span>
            <span className="material-symbols-outlined text-muted text-3xl group-hover:text-main transition-colors duration-300">keyboard_arrow_down</span>
        </div>
    </button>
);

export default function LandingView({ onNavigate }: LandingViewProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  
  // PWA Install Logic
  useEffect(() => {
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    // DESKTOP CHECK: Se for desktop, mostra modal de QR Code
    if (window.innerWidth > 1024) {
        setShowDesktopModal(true);
        return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
          setDeferredPrompt(null);
      }
    } else if (isIOS) {
        setShowIOSInstructions(true);
    } else {
        setShowAndroidInstructions(true);
    }
  };

  const handleEnterApp = () => {
      // STRICT DESKTOP BLOCK: Impede entrada via desktop
      if (window.innerWidth > 1024) {
          setShowDesktopModal(true);
          return;
      }
      onNavigate(Screen.LOGIN);
  };

  return (
    <div className="bg-background text-main font-sans overflow-x-hidden w-full min-h-full flex flex-col">
      
      {/* Hero Section */}
      <header className="relative pt-12 pb-20 lg:pt-24 lg:pb-32 overflow-hidden min-h-[90vh] flex flex-col justify-center">
        {/* Grid Background CSS */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{
            backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)'
        }}></div>
        
        <div className="absolute top-20 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-[100px] -z-10"></div>

        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10 w-full">
            <div className="space-y-8 animate-fade-in-up">
                {/* Brand Logo (Added since Navbar is removed) */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-primary overflow-hidden shadow-lg">
                        <img src="/icon-192x192.png" alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-2xl font-black tracking-tight">FITVLR<span className="text-primary">PRO</span></span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-black leading-[1.1] tracking-tight">
                    O teu <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">PT</span> <br/>
                    de Bolso.
                </h1>
                <p className="text-xl text-muted leading-relaxed max-w-lg">
                    Acompanha treinos, dieta e evolução em tempo real. A ponte perfeita entre alunos focados e treinadores de elite.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button onClick={handleInstallClick} className="flex items-center gap-3 bg-main text-background px-6 py-3.5 rounded-xl hover:bg-zinc-200 transition-colors">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.49l1.83-3.18c.24-.42.1-.96-.32-1.2a.89.89 0 0 0-1.22.31L16 8.71a9.04 9.04 0 0 0-3.99-1c-1.4 0-2.73.34-3.92.93L6.15 5.42a.889.889 0 0 0-1.22-.31c-.42.24-.56.78-.32 1.2l1.79 3.11C4.31 11.53 3 14.63 3 18h18c0-3.38-1.32-6.49-3.4-8.51zM8.5 15c-.83 0-1.5-.67-1.5-1.5S7.67 12 8.5 12s1.5.67 1.5 1.5S9.33 15 8.5 15zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5S16.33 15 15.5 15z"/></svg>
                        <div className="text-left leading-none">
                            <div className="text-[10px] font-bold text-zinc-600 uppercase">Instalar no</div>
                            <div className="text-base font-bold">Android</div>
                        </div>
                    </button>
                    <button onClick={handleInstallClick} className="flex items-center gap-3 bg-transparent border border-main/20 text-main px-6 py-3.5 rounded-xl hover:bg-main/5 transition-colors">
                        <svg className="w-6 h-6" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z"/></svg>
                        <div className="text-left leading-none">
                            <div className="text-[10px] font-bold text-muted uppercase">Instalar no</div>
                            <div className="text-base font-bold">IOS</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Phone Mockup Hero */}
            <div className="relative flex justify-center lg:justify-end animate-float">
                <PhoneMockup>
                    {/* Mock App UI - Home */}
                    <div className="h-full w-full flex flex-col p-4 pt-10 font-sans text-main bg-background">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700 border-2 border-primary bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80')" }}></div>
                            <div>
                                <div className="text-[10px] text-muted">Bem-vindo,</div>
                                <div className="text-sm font-bold">João Silva</div>
                            </div>
                            <div className="ml-auto bg-surface p-2 rounded-full border border-main/5"><span className="material-symbols-outlined text-sm">notifications</span></div>
                        </div>
                        
                        <div className="flex gap-2 mb-6">
                            <div className="flex-1 bg-surface rounded-xl p-3 border border-main/5 text-center">
                                <span className="material-symbols-outlined text-primary mb-1">scale</span>
                                <div className="text-[10px] text-muted">Peso</div>
                                <div className="text-sm font-bold">75.2kg</div>
                            </div>
                            <div className="flex-1 bg-surface rounded-xl p-3 border border-main/5 text-center">
                                <span className="material-symbols-outlined text-primary mb-1">show_chart</span>
                                <div className="text-[10px] text-muted">Evolução</div>
                                <div className="text-sm font-bold text-primary">+2.1%</div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-surface to-background p-4 rounded-2xl border border-main/10 relative overflow-hidden mb-4">
                            <div className="relative z-10">
                                <div className="flex gap-2 mb-2">
                                    <span className="bg-primary text-background text-[10px] font-bold px-2 py-0.5 rounded">TREINO A</span>
                                </div>
                                <div className="text-lg font-bold leading-tight mb-1">Peito & Tríceps</div>
                                <div className="text-xs text-muted mb-3">6 Exercícios • 45 min</div>
                                <div className="h-8 w-24 bg-primary rounded-lg flex items-center justify-center text-background text-xs font-bold gap-1">
                                    Começar <span className="material-symbols-outlined text-xs">play_arrow</span>
                                </div>
                            </div>
                            <div className="absolute right-0 bottom-0 opacity-10">
                                <img src="/icon-192x192.png" alt="" className="w-32 h-32 object-cover rounded-full" />
                            </div>
                        </div>

                        <div className="mt-auto bg-surface/90 backdrop-blur rounded-2xl p-3 flex justify-between px-4 border-t border-main/5">
                            <span className="material-symbols-outlined text-primary">home</span>
                            <span className="material-symbols-outlined text-muted">fitness_center</span>
                            <span className="material-symbols-outlined text-muted">chat</span>
                            <span className="material-symbols-outlined text-muted">person</span>
                        </div>
                    </div>
                </PhoneMockup>
            </div>
        </div>

        {/* Scroll Indicator */}
        <ScrollIndicator targetId="features" isAbsolute />
      </header>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-surface/30 border-y border-main/5">
        <div className="max-w-6xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16 transition-all duration-700">
                <h2 className="text-3xl lg:text-4xl font-black mb-4">Tudo o que precisas num só lugar</h2>
                <p className="text-muted">Substitui o Excel, o WhatsApp e o Bloco de Notas. A FITVLRPRO centraliza a tua jornada fitness.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-background p-8 rounded-3xl border border-main/5 hover:border-primary/30 transition-all group duration-700 delay-100">
                    <div className="h-14 w-14 rounded-2xl bg-surface overflow-hidden flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-main/5">
                        <img src="/icon-512x512.png" alt="Training" className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">Planos de Treino</h3>
                    <p className="text-muted text-sm leading-relaxed">Acesso aos treinos criados pelo teu PT com vídeos demonstrativos, registo de cargas e histórico de PRs.</p>
                </div>

                <div className="bg-background p-8 rounded-3xl border border-main/5 hover:border-primary/30 transition-all group duration-700 delay-200">
                    <div className="h-14 w-14 rounded-2xl bg-surface flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-blue-400 border border-main/5">
                        <span className="material-symbols-outlined text-3xl">restaurant</span>
                    </div>
                    <h3 className="text-xl font-bold mb-3">Controlo Nutricional</h3>
                    <p className="text-muted text-sm leading-relaxed">Consulta o teu plano alimentar, marca refeições como concluídas e acompanha os teus macros diários.</p>
                </div>

                <div className="bg-background p-8 rounded-3xl border border-main/5 hover:border-primary/30 transition-all group duration-700 delay-300">
                    <div className="h-14 w-14 rounded-2xl bg-surface flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-yellow-400 border border-main/5">
                        <span className="material-symbols-outlined text-3xl">chat</span>
                    </div>
                    <h3 className="text-xl font-bold mb-3">Chat Direto</h3>
                    <p className="text-muted text-sm leading-relaxed">Fala com o teu treinador em tempo real, envia vídeos da execução e tira dúvidas sem sair da app.</p>
                </div>
            </div>
            
            <ScrollIndicator targetId="gallery" />
        </div>
      </section>

      {/* NEW SECTION: APP GALLERY */}
      <section id="gallery" className="py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16 transition-all duration-700">
                <h2 className="text-3xl lg:text-5xl font-black mb-4">Interface Intuitiva</h2>
                <p className="text-muted">Desenhada para te focares no que importa: os teus resultados.</p>
            </div>

            <div className="flex flex-col md:flex-row justify-center items-center gap-10 md:gap-16">
                {/* Phone 1: Diet */}
                <div className="transform md:rotate-[-5deg] hover:rotate-0 transition-transform duration-500 hover:scale-105 z-10 duration-700 delay-100">
                    <PhoneMockup>
                        <div className="p-4 pt-10 h-full flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold">Plano Alimentar</h3>
                                <span className="material-symbols-outlined">restaurant</span>
                            </div>
                            <div className="space-y-3">
                                <div className="bg-surface p-3 rounded-xl border border-main/10">
                                    <p className="text-[10px] text-muted uppercase font-bold">Pequeno Almoço</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-xl">🥚</span>
                                        <div>
                                            <p className="text-sm font-bold">Ovos Mexidos</p>
                                            <p className="text-xs text-muted">3 unidades</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-surface p-3 rounded-xl border border-main/10">
                                    <p className="text-[10px] text-muted uppercase font-bold">Almoço</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-xl">🍗</span>
                                        <div>
                                            <p className="text-sm font-bold">Frango Grelhado</p>
                                            <p className="text-xs text-muted">150g</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-xl">🍚</span>
                                        <div>
                                            <p className="text-sm font-bold">Arroz Basmati</p>
                                            <p className="text-xs text-muted">200g</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto bg-main/5 p-3 rounded-xl border border-main/5 text-center">
                                <p className="text-2xl font-bold">2450 <span className="text-xs text-primary font-normal">KCAL</span></p>
                                <p className="text-[10px] text-muted">Meta Diária</p>
                            </div>
                        </div>
                    </PhoneMockup>
                </div>

                {/* Phone 2: Workout (Center) */}
                <div className="transform md:-translate-y-10 z-20 duration-700 delay-200">
                    <PhoneMockup className="shadow-[0_0_60px_rgba(37,99,235,0.15)] border-primary/30" borderColor="border-primary/20">
                        <div className="h-full flex flex-col">
                            <div className="h-40 bg-cover bg-center relative" style={{ backgroundImage: "url('https://www.hussle.com/blog/wp-content/uploads/2020/12/Gym-structure-1080x675.png')" }}>
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background"></div>
                                <div className="absolute bottom-4 left-4">
                                    <span className="bg-primary text-background text-[10px] font-bold px-2 py-0.5 rounded mb-1 inline-block">EM PROGRESSO</span>
                                    <h2 className="text-2xl font-bold leading-none">Costas &<br/>Bíceps</h2>
                                </div>
                            </div>
                            <div className="p-4 flex-1 space-y-4">
                                <div className="bg-surface p-3 rounded-xl border border-primary/20">
                                    <div className="flex justify-between mb-2">
                                        <h3 className="font-bold text-sm">Puxada Alta</h3>
                                        <span className="text-xs text-muted">4 x 12</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex gap-2 text-xs">
                                            <div className="bg-main/5 px-2 py-1 rounded flex-1 text-center border border-main/5">Set 1</div>
                                            <div className="bg-primary/20 text-primary px-2 py-1 rounded flex-1 text-center border border-primary/20">Feito</div>
                                        </div>
                                        <div className="flex gap-2 text-xs">
                                            <div className="bg-main/5 px-2 py-1 rounded flex-1 text-center border border-main/5">Set 2</div>
                                            <div className="bg-main/5 text-muted px-2 py-1 rounded flex-1 text-center border border-main/5">...</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-surface p-3 rounded-xl border border-main/5 opacity-50">
                                    <h3 className="font-bold text-sm">Remada Curvada</h3>
                                    <p className="text-xs text-muted">4 séries • Carga: 60kg</p>
                                </div>
                            </div>
                            <div className="p-4 pt-0">
                                <button className="w-full bg-primary text-background font-bold py-3 rounded-xl text-sm">Finalizar Treino</button>
                            </div>
                        </div>
                    </PhoneMockup>
                </div>

                {/* Phone 3: Chat */}
                <div className="transform md:rotate-[5deg] hover:rotate-0 transition-transform duration-500 hover:scale-105 z-10 duration-700 delay-300">
                    <PhoneMockup>
                        <div className="flex flex-col h-full bg-background">
                            <div className="p-4 pt-10 border-b border-main/5 bg-surface flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-zinc-300 dark:bg-zinc-700 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=100&q=80')" }}></div>
                                <div>
                                    <p className="text-sm font-bold">Personal Trainer</p>
                                    <p className="text-[10px] text-primary flex items-center gap-1"><span className="w-1.5 h-1.5 bg-primary rounded-full"></span> Online</p>
                                </div>
                            </div>
                            <div className="flex-1 p-3 space-y-3 overflow-hidden flex flex-col justify-end">
                                <div className="self-start bg-surface p-3 rounded-xl rounded-tl-none border border-main/5 max-w-[85%]">
                                    <p className="text-xs text-muted-foreground">Bom dia! Como te sentiste no treino de pernas ontem?</p>
                                </div>
                                <div className="self-end bg-primary p-3 rounded-xl rounded-tr-none max-w-[85%]">
                                    <p className="text-xs text-background font-medium">Foi intenso! Aumentei a carga no agachamento.</p>
                                </div>
                                <div className="self-start bg-surface p-3 rounded-xl rounded-tl-none border border-main/5 max-w-[85%]">
                                    <p className="text-xs text-muted-foreground">Excelente evolução! 🔥 Continua assim.</p>
                                </div>
                            </div>
                            <div className="p-3 border-t border-main/5">
                                <div className="bg-surface h-10 rounded-full flex items-center px-4 text-xs text-muted">Escrever mensagem...</div>
                            </div>
                        </div>
                    </PhoneMockup>
                </div>
            </div>
            
            <ScrollIndicator targetId="split-section" />
        </div>
      </section>

      {/* Split Section (Trainers vs Students) */}
      <section id="split-section" className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-6">
            {/* Trainers */}
            <div id="trainers" className="flex flex-col lg:flex-row items-center gap-12 mb-32 transition-all duration-700">
                <div className="flex-1 order-2 lg:order-1">
                    <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-4 uppercase tracking-widest">Para Personal Trainers</div>
                    <h2 className="text-3xl lg:text-4xl font-black mb-6">Gere mais alunos em menos tempo.</h2>
                    <ul className="space-y-4 mb-8">
                        <li className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary">check_circle</span>
                            <span className="text-muted-foreground">Criação rápida de planos de treino e dieta.</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary">check_circle</span>
                            <span className="text-muted-foreground">Dashboard com visão geral de todos os alunos.</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary">check_circle</span>
                            <span className="text-muted-foreground">Banco de exercícios personalizável.</span>
                        </li>
                    </ul>
                </div>
                <div className="flex-1 order-1 lg:order-2 flex justify-center">
                    <PhoneMockup className="shadow-2xl shadow-primary/5">
                        <div className="h-full flex flex-col bg-background p-4 pt-10">
                            <h3 className="font-bold text-lg mb-4">Os Meus Alunos</h3>
                            <div className="space-y-3">
                                <div className="bg-surface p-3 rounded-xl flex items-center justify-between border border-main/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-cover bg-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80')"}}></div>
                                        <div>
                                            <p className="font-bold text-sm">Ana S.</p>
                                            <p className="text-[10px] text-muted">Hipertrofia</p>
                                        </div>
                                    </div>
                                    <span className="text-blue-400 text-xs font-bold bg-blue-400/10 px-2 py-1 rounded">+1.2kg</span>
                                </div>
                                <div className="bg-surface p-3 rounded-xl flex items-center justify-between border border-main/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-cover bg-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80')"}}></div>
                                        <div>
                                            <p className="font-bold text-sm">Carlos M.</p>
                                            <p className="text-[10px] text-muted">Perda de Peso</p>
                                        </div>
                                    </div>
                                    <span className="text-red-400 text-xs font-bold bg-red-400/10 px-2 py-1 rounded">-0.5kg</span>
                                </div>
                                <div className="bg-surface p-3 rounded-xl flex items-center justify-between border border-main/5 opacity-60">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-cover bg-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80')"}}></div>
                                        <div>
                                            <p className="font-bold text-sm">Mariana</p>
                                            <p className="text-[10px] text-muted">Manutenção</p>
                                        </div>
                                    </div>
                                    <span className="text-muted text-xs font-bold bg-zinc-400/10 px-2 py-1 rounded">=</span>
                                </div>
                            </div>
                            <button className="mt-auto w-full bg-surface border border-main/10 text-main py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-lg">add</span> Adicionar Aluno
                            </button>
                        </div>
                    </PhoneMockup>
                </div>
            </div>

            {/* Students */}
            <div id="students" className="flex flex-col lg:flex-row items-center gap-12 transition-all duration-700">
                <div className="flex-1 flex justify-center">
                    <PhoneMockup className="shadow-2xl shadow-blue-500/5">
                        <div className="h-full flex flex-col bg-background p-4 pt-10">
                            <h3 className="font-bold text-lg mb-4">Evolução</h3>
                            <div className="bg-surface rounded-xl p-4 border border-main/5 mb-4 relative overflow-hidden">
                                <p className="text-xs text-muted uppercase font-bold mb-1">Peso Atual</p>
                                <p className="text-3xl font-bold text-main">74.5 <span className="text-sm text-muted font-normal">kg</span></p>
                                <div className="absolute right-4 top-4 text-blue-400 bg-blue-400/10 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">trending_down</span> -2.1kg
                                </div>
                            </div>
                            <div className="flex-1 bg-surface rounded-xl p-4 border border-main/5 flex flex-col justify-end">
                                <div className="flex items-end gap-2 h-32">
                                    <div className="w-1/5 bg-zinc-300 dark:bg-zinc-700 rounded-t-sm h-[40%]"></div>
                                    <div className="w-1/5 bg-zinc-600 rounded-t-sm h-[55%]"></div>
                                    <div className="w-1/5 bg-zinc-500 rounded-t-sm h-[45%]"></div>
                                    <div className="w-1/5 bg-zinc-400 rounded-t-sm h-[60%]"></div>
                                    <div className="w-1/5 bg-primary rounded-t-sm h-[75%] relative">
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary">Now</div>
                                    </div>
                                </div>
                                <div className="flex justify-between mt-2 text-[10px] text-muted font-bold uppercase">
                                    <span>Sem 1</span>
                                    <span>Sem 5</span>
                                </div>
                            </div>
                            <button className="mt-4 w-full bg-primary text-background py-3 rounded-xl text-sm font-bold">
                                Ver Histórico
                            </button>
                        </div>
                    </PhoneMockup>
                </div>
                <div className="flex-1">
                    <div className="inline-block px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold mb-4 uppercase tracking-widest">Para Alunos</div>
                    <h2 className="text-3xl lg:text-4xl font-black mb-6">Visualiza o teu progresso.</h2>
                    <p className="text-muted mb-6 leading-relaxed">
                        Não treines às cegas. Regista as tuas cargas, tira fotos de progresso e vê os gráficos da tua evolução. A motivação vem dos resultados que consegues ver.
                    </p>
                    <button onClick={handleInstallClick} className="bg-main text-background font-bold py-3 px-6 rounded-xl hover:bg-zinc-200 transition-colors inline-flex items-center gap-2">
                        Começar a Evoluir <span className="material-symbols-outlined">rocket_launch</span>
                    </button>
                </div>
            </div>
            
            <ScrollIndicator targetId="download" />
        </div>
      </section>

      {/* CTA */}
      <section id="download" className="py-24 relative overflow-hidden border-t border-main/5">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 transition-all duration-700">
            <h2 className="text-4xl lg:text-6xl font-black mb-6">Pronto para começar?</h2>
            <p className="text-xl text-muted mb-10 max-w-xl mx-auto">
                Instala a FITVLRPRO agora e leva o teu treino para o próximo nível. Disponível para iOS e Android.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button onClick={handleInstallClick} className="flex items-center justify-center gap-3 bg-main text-background px-8 py-4 rounded-2xl hover:bg-zinc-200 transition-all hover:scale-105">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.49l1.83-3.18c.24-.42.1-.96-.32-1.2a.89.89 0 0 0-1.22.31L16 8.71a9.04 9.04 0 0 0-3.99-1c-1.4 0-2.73.34-3.92.93L6.15 5.42a.889.889 0 0 0-1.22-.31c-.42.24-.56.78-.32 1.2l1.79 3.11C4.31 11.53 3 14.63 3 18h18c0-3.38-1.32-6.49-3.4-8.51zM8.5 15c-.83 0-1.5-.67-1.5-1.5S7.67 12 8.5 12s1.5.67 1.5 1.5S9.33 15 8.5 15zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5S16.33 15 15.5 15z"/></svg>
                    <div className="text-left leading-none">
                        <div className="text-xs font-bold text-zinc-600 uppercase">Android</div>
                        <div className="text-lg font-bold">Instalar</div>
                    </div>
                </button>
                <button onClick={handleInstallClick} className="flex items-center justify-center gap-3 bg-surface border border-main/20 text-main px-8 py-4 rounded-2xl hover:bg-main/10 transition-all hover:scale-105">
                    <svg className="w-8 h-8" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z"/></svg>
                    <div className="text-left leading-none">
                        <div className="text-xs font-bold text-muted uppercase">IOS</div>
                        <div className="text-lg font-bold">Instalar</div>
                    </div>
                </button>
            </div>
        </div>
      </section>

      <footer className="py-8 text-center text-zinc-600 text-sm border-t border-main/5 bg-background">
        <p>&copy; {new Date().getFullYear()} FITVLRPRO. Todos os direitos reservados.</p>
      </footer>

      {/* IOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-surface w-full max-w-sm rounded-3xl p-6 border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300">
                <button onClick={() => setShowIOSInstructions(false)} className="absolute top-4 right-4 text-muted hover:text-main">
                    <span className="material-symbols-outlined">close</span>
                </button>
                <div className="flex flex-col items-center text-center">
                    <span className="material-symbols-outlined text-5xl text-muted-foreground mb-4">ios_share</span>
                    <h3 className="text-xl font-bold text-main mb-2">Instalar no iPhone</h3>
                    <p className="text-sm text-muted mb-6">
                        1. Toca no botão <strong>Partilhar</strong> no menu inferior do Safari.<br/>
                        2. Desliza para baixo e seleciona <strong>"Adicionar ao Ecrã Principal"</strong>.
                    </p>
                    <button onClick={() => setShowIOSInstructions(false)} className="w-full bg-primary text-background font-bold py-3 rounded-xl">
                        Entendi
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Android/Desktop Manual Instructions Modal */}
      {showAndroidInstructions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-surface w-full max-w-sm rounded-3xl p-6 border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300">
                <button onClick={() => setShowAndroidInstructions(false)} className="absolute top-4 right-4 text-muted hover:text-main">
                    <span className="material-symbols-outlined">close</span>
                </button>
                <div className="flex flex-col items-center text-center">
                    <span className="material-symbols-outlined text-5xl text-muted-foreground mb-4">install_mobile</span>
                    <h3 className="text-xl font-bold text-main mb-2">Instalar Aplicação</h3>
                    <p className="text-sm text-muted mb-6">
                        Para instalar, toca no menu do navegador (três pontos) e seleciona <strong>"Instalar aplicação"</strong> ou <strong>"Adicionar ao ecrã principal"</strong>.
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                        <button onClick={() => setShowAndroidInstructions(false)} className="w-full bg-main/10 hover:bg-main/20 text-main font-bold py-3 rounded-xl transition-colors">
                            Entendi
                        </button>
                        <button onClick={handleEnterApp} className="w-full text-muted hover:text-main text-sm font-bold py-2">
                            Apenas Entrar no Site
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Desktop Mobile-Only Warning Modal */}
      {showDesktopModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-surface w-full max-w-sm rounded-3xl p-8 border border-main/10 shadow-2xl relative flex flex-col items-center text-center">
                <button 
                    onClick={() => setShowDesktopModal(false)}
                    className="absolute top-4 right-4 text-muted hover:text-main transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                <div className="h-20 w-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(37,99,235,0.15)]">
                    <span className="material-symbols-outlined text-4xl text-primary">smartphone</span>
                </div>

                <h3 className="text-xl font-bold text-main mb-2">Disponível apenas no Mobile</h3>
                <p className="text-muted text-sm mb-6 leading-relaxed">
                    A FITVLRPRO foi criada para te acompanhar no ginásio. Faz scan do código para a instalares no teu telemóvel.
                </p>

                <div className="bg-main p-3 rounded-xl mb-4 shadow-lg">
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.href)}&bgcolor=ffffff&color=000000&margin=0`} 
                        alt="Scan QR Code" 
                        className="w-32 h-32 object-contain rounded-lg"
                    />
                </div>
                
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
                    Compatível com iOS e Android
                </p>
            </div>
        </div>
      )}
    </div>
  );
}

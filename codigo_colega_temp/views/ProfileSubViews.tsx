import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Screen, UserRole } from '../types';
import { supabase } from '../lib/supabaseClient';

interface SubViewProps {
  onBack: () => void;
}

const GOAL_OPTIONS = ['Hipertrofia', 'Emagrecimento', 'Força', 'Resistência', 'Manutenção', 'Saúde'];

export function EditProfileView({ onBack }: SubViewProps) {
  const { user, updateUserProfile, setScreen, activeRole } = useApp();
  const [showSuccess, setShowSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    goal: user.goal || '',
    weight: user.weight?.toString() || '',
    initialWeight: user.initialWeight?.toString() || '',
    height: user.height?.toString() || '',
    bodyFat: user.bodyFat?.toString() || '',
    birthdate: user.birthdate || '',
    targetWeight: user.targetWeight?.toString() || '',
    restDays: user.restDays || [0, 6],
    trainingFrequency: user.trainingFrequency || 5
  });

  const isStudent = user.role === UserRole.STUDENT;

  const toggleRestDay = (dayIndex: number) => {
      setFormData(prev => {
          const newDays = prev.restDays.includes(dayIndex) 
              ? prev.restDays.filter(d => d !== dayIndex)
              : [...prev.restDays, dayIndex];
          return { ...prev, restDays: newDays };
      });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo o que não é dígito
    
    // Limita a 8 dígitos (DDMMAAAA)
    if (value.length > 8) value = value.substring(0, 8);

    // Aplica a máscara DD/MM/AAAA
    if (value.length > 4) {
        value = value.replace(/^(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3');
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{0,2})/, '$1/$2');
    }

    setFormData({ ...formData, birthdate: value });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove não dígitos
    let value = e.target.value.replace(/\D/g, '');
    
    // Limita a 3 dígitos (ex: 2.50m no máximo, razoável)
    if (value.length > 3) value = value.substring(0, 3);

    // Aplica máscara de metros (X.XX)
    // Se tiver mais de 1 dígito, insere o ponto após o primeiro número
    if (value.length > 1) {
        value = value.replace(/^(\d{1})(\d{0,2})/, '$1.$2');
    }

    setFormData({ ...formData, height: value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        // Função auxiliar para converter string numérica com segurança
        const parseNum = (val: string) => {
            if (!val || val.trim() === '') return null;
            const num = parseFloat(val.replace(',', '.'));
            return isNaN(num) ? null : num;
        };

        // 1. Atualizar Perfil no Banco
        await updateUserProfile({
          name: formData.name,
          email: formData.email,
          avatar: formData.avatar,
          goal: formData.goal,
          birthdate: formData.birthdate,
          // Campos Numéricos
          weight: parseNum(formData.weight),
          initialWeight: parseNum(formData.initialWeight),
          height: parseNum(formData.height),
          bodyFat: parseNum(formData.bodyFat),
          targetWeight: parseNum(formData.targetWeight),
          restDays: formData.restDays,
          trainingFrequency: formData.trainingFrequency
        });

        // Notify PT if training frequency changes
        if (isStudent && formData.trainingFrequency !== user.trainingFrequency) {
            const { data: profile } = await supabase.from('profiles').select('trainer_id').eq('id', user.id).single();
            if (profile && profile.trainer_id && profile.trainer_id !== user.id) {
                await supabase.from('notifications').insert({
                    user_id: profile.trainer_id,
                    student_id: user.id,
                    title: 'Alteração de Frequência de Treino',
                    message: `${user.name} quer alterar a disponibilidade para treinar para ${formData.trainingFrequency} vezes por semana. Por favor, reveja o plano de treino do aluno.`,
                    type: 'INFO'
                });
            }
        }

        // 2. Se o avatar mudou, apagar o antigo do Storage (se for do Supabase)
        if (formData.avatar !== user.avatar && user.avatar) {
            // Verifica se a URL antiga pertence ao bucket 'avatars' do Supabase
            if (user.avatar.includes('/storage/v1/object/public/avatars/')) {
                const oldFileName = user.avatar.split('/avatars/').pop();
                if (oldFileName) {
                    try {
                        await supabase.storage.from('avatars').remove([oldFileName]);
                    } catch (err) {
                        console.warn("Falha ao remover avatar antigo:", err);
                    }
                }
            }
        }

        setShowSuccess(true);
    } catch (e) {
        console.error("Erro ao salvar:", e);
        alert("Erro ao salvar alterações.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    setIsUploading(true);

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // 1. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        
        if (data.publicUrl) {
            setFormData(prev => ({ ...prev, avatar: data.publicUrl }));
        }

    } catch (error: any) {
        console.error("Upload error:", error);
        alert("Erro ao enviar imagem: " + error.message);
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 flex items-center gap-3 animate-enter">
        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-main">Editar Dados</h1>
      </header>

      <main className="p-6 space-y-6 overflow-y-auto animate-enter delay-100 pb-24">
        <div className="flex justify-center mb-6">
           <div className="relative group">
             {/* Image Preview */}
             <div 
               className="h-28 w-28 rounded-full bg-cover bg-center border-4 border-surface shadow-xl animate-scale" 
               style={{ backgroundImage: `url('${formData.avatar}')` }}
             >
                {isUploading && (
                    <div className="absolute inset-0 bg-main/10 rounded-full flex items-center justify-center">
                        <span className="w-6 h-6 border-2 border-main border-t-transparent rounded-full animate-spin"></span>
                    </div>
                )}
             </div>
             
             {/* Edit Button */}
             <button 
               onClick={() => fileInputRef.current?.click()}
               disabled={isUploading}
               className="absolute bottom-0 right-0 bg-primary text-background p-2 rounded-full border-4 border-background hover:scale-110 transition-transform shadow-lg active:scale-95"
             >
               <span className="material-symbols-outlined text-lg font-bold">photo_camera</span>
             </button>

             {/* Hidden File Input */}
             <input 
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
             />
           </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted">Nome Completo</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-surface rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted">Email</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full bg-surface rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-colors"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-muted">Objetivo Principal</label>
            <div className="grid grid-cols-2 gap-3">
              {GOAL_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFormData({...formData, goal: option})}
                  className={`py-3 px-4 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 active:scale-95 ${
                    formData.goal === option
                      ? 'bg-primary text-background border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                      : 'bg-surface text-muted-foreground border-main/10 hover:border-primary/50'
                  }`}
                >
                  {option}
                  {formData.goal === option && <span className="material-symbols-outlined text-base">check</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-sm font-bold text-muted">Nascimento</label>
                <input 
                  type="tel" 
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  value={formData.birthdate}
                  onChange={handleDateChange}
                  maxLength={10}
                  className="w-full bg-surface rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-colors text-center font-bold tracking-wider"
                />
             </div>
             <div className="space-y-2">
                <label className="text-sm font-bold text-muted">Altura (m)</label>
                <input 
                  type="tel" 
                  inputMode="numeric"
                  value={formData.height}
                  onChange={handleHeightChange}
                  placeholder="Ex: 1.75"
                  className="w-full bg-surface rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-colors text-center font-bold tracking-wider"
                />
             </div>
          </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <label className="text-sm font-bold text-muted">Peso Inicial (kg)</label>
                  <input 
                      type="number" 
                      value={formData.initialWeight}
                      onChange={e => setFormData({...formData, initialWeight: e.target.value})}
                      className="w-full bg-surface rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-colors text-center font-bold"
                      placeholder="Ex: 80"
                  />
              </div>
              <div className="space-y-2">
                  <label className="text-sm font-bold text-muted">% Gordura (BF)</label>
                  <input 
                      type="number" 
                      value={formData.bodyFat}
                      onChange={e => setFormData({...formData, bodyFat: e.target.value})}
                      className="w-full bg-surface rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-colors text-center font-bold"
                      placeholder="Ex: 20"
                  />
              </div>
           </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-sm font-bold text-muted">Peso Atual (kg)</label>
                <input 
                  type="number" 
                  value={formData.weight}
                  onChange={e => setFormData({...formData, weight: e.target.value})}
                  className="w-full bg-surface rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-colors text-center font-bold"
               />
             </div>
             <div className="space-y-2">
                <label className="text-sm font-bold text-primary">Peso Alvo (kg)</label>
                <input 
                  type="number" 
                  value={formData.targetWeight}
                  onChange={e => setFormData({...formData, targetWeight: e.target.value})}
                  className="w-full bg-surface rounded-xl p-4 text-main border border-primary/50 focus:border-primary outline-none transition-colors text-center font-bold"
                />
             </div>
          </div>

          <div className="space-y-3">
             <label className="text-sm font-bold text-primary">Frequência de Treino (dias/semana)</label>
             <div className="flex justify-between gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map(num => (
                    <button
                        key={num}
                        onClick={() => setFormData({ ...formData, trainingFrequency: num })}
                        className={`h-12 flex-1 rounded-xl font-bold text-sm border transition-all ${
                            formData.trainingFrequency === num
                                ? 'bg-primary text-background border-primary shadow-lg shadow-primary/20 scale-105'
                                : 'bg-surface text-muted border-main/10 hover:border-primary/50'
                        }`}
                    >
                        {num}
                    </button>
                ))}
             </div>
             <p className="text-[10px] text-muted text-center">O PT será notificado caso altere a disponibilidade de dias.</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-muted">Dias de Descanso (Sem Treino)</label>
            <div className="flex flex-wrap gap-2 justify-center">
                {[
                    { id: 1, label: 'Seg' },
                    { id: 2, label: 'Ter' },
                    { id: 3, label: 'Qua' },
                    { id: 4, label: 'Qui' },
                    { id: 5, label: 'Sex' },
                    { id: 6, label: 'Sáb' },
                    { id: 0, label: 'Dom' }
                ].map(day => (
                    <button
                        key={day.id}
                        onClick={() => toggleRestDay(day.id)}
                        className={`py-2 px-3 rounded-xl text-sm font-bold border transition-all ${
                            formData.restDays.includes(day.id)
                                ? 'bg-primary text-background border-primary'
                                : 'bg-surface text-muted border-main/10 hover:bg-main/5'
                        }`}
                    >
                        {day.label}
                    </button>
                ))}
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isUploading || isSaving}
          className="w-full bg-primary text-background font-bold text-lg p-4 rounded-xl mt-8 shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
        >
          {isUploading ? 'A enviar foto...' : (isSaving ? 'A guardar...' : 'Atualizar Perfil')}
        </button>
      </main>

      {/* SUCCESS POPUP */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-primary/20 shadow-2xl relative animate-scale">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary animate-pulse">
                 <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <h3 className="text-xl font-bold text-main mb-2">Sucesso!</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                O teu perfil foi atualizado com sucesso.
              </p>
              <button 
                onClick={() => {
                    setShowSuccess(false);
                    onBack();
                }}
                className="w-full h-12 rounded-xl bg-primary text-background hover:brightness-110 font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function HelpView({ onBack }: SubViewProps) {
  const { setScreen, user, activeRole } = useApp(); // Access setScreen to navigate

  const handleStartTutorial = () => {
      // Force trigger the tutorial on the Dashboard
      localStorage.setItem('force_tutorial', 'true');
      
      // Determine where to send the user based on role
      if (user?.role === UserRole.TRAINER) {
          setScreen(Screen.TRAINER_DASHBOARD);
      } else {
          setScreen(Screen.STUDENT_DASHBOARD);
      }
  };

  const isTrainer = user?.role === UserRole.TRAINER;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 flex items-center gap-3 animate-enter">
        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-main">Ajuda e FAQ</h1>
      </header>
      <main className="p-4 space-y-4 animate-enter delay-100">
        
        {/* ADDED TUTORIAL BUTTON */}
        <button 
            onClick={handleStartTutorial}
            className="w-full bg-surface p-4 rounded-xl border border-main/5 shadow-md flex items-center justify-between group hover:bg-main/5 transition-all"
        >
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined">school</span>
                </div>
                <div className="text-left">
                    <h3 className="font-bold text-main text-sm">Ver Tutorial</h3>
                    <p className="text-muted text-xs">Rever o passo a passo inicial</p>
                </div>
            </div>
            <span className="material-symbols-outlined text-muted group-hover:text-main">chevron_right</span>
        </button>

        {!isTrainer && [
          { q: 'Como registro meu peso?', a: 'Vá até a aba "Progresso" na tela inicial e clique no botão "+" no canto inferior direito.' },
          { q: 'Como contato meu personal?', a: 'Utilize a aba "Chat" no menu inferior para enviar mensagens diretas.' },
          { q: 'Posso alterar meu treino?', a: 'Os treinos são definidos pelo seu personal. Você pode solicitar alterações via Chat.' },
          { q: 'O aplicativo funciona offline?', a: 'Algumas funções sim, mas recomendamos conexão para sincronizar dados.' }
        ].map((item, i) => (
          <div key={i} className="bg-surface p-4 rounded-xl border border-main/5 shadow-md animate-enter" style={{animationDelay: `${i*100}ms`}}>
            <h3 className="font-bold text-main text-sm mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">help</span>
              {item.q}
            </h3>
            <p className="text-muted text-sm leading-relaxed pl-6">{item.a}</p>
          </div>
        ))}
      </main>
          </div>
  );
}

export function ReportIssueView({ onBack }: SubViewProps) {
  const { reportIssue, user, setScreen, activeRole } = useApp();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      alert("Por favor, descreva o problema.");
      return;
    }
    setIsSending(true);
    try {
      await reportIssue(title || 'Relato de Problema', message, isUrgent);
      setShowSuccess(true);
    } catch (e) {
      alert("Erro ao enviar o relato. Tente novamente.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 flex items-center gap-3 animate-enter">
        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-main">Fale Conosco</h1>
      </header>
      <main className="p-4 space-y-6 animate-enter delay-100">
         <div className="space-y-4 bg-surface p-4 rounded-xl border border-main/5 shadow-lg">
            <h3 className="font-bold text-main mb-2">Relatar um Problema</h3>
            <p className="text-xs text-muted mb-4">Descreva o problema que você encontrou. Nossa equipe de suporte responderá o mais rápido possível.</p>
            
            <input 
              type="text" 
              placeholder="Assunto (Opcional)" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-main/5 rounded-lg p-3 text-main border border-main/5 focus:border-primary outline-none transition-colors"
            />

            <textarea 
              placeholder="Descreva o problema em detalhes..." 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-main/5 rounded-lg p-3 text-main border border-main/5 focus:border-primary outline-none h-32 resize-none"
            />

            <div className="flex items-center justify-between p-2 rounded-lg bg-main/5">
               <span className={`font-bold text-sm ${isUrgent ? 'text-red-400' : 'text-muted-foreground'}`}>É urgente?</span>
               <button 
                onClick={() => setIsUrgent(prev => !prev)}
                className={`w-12 h-6 rounded-full relative transition-colors ${isUrgent ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
               >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-main transition-all ${isUrgent ? 'left-7' : 'left-1'}`}></div>
               </button>
            </div>

            <button 
              onClick={handleSend}
              disabled={isSending || !message.trim()}
              className="w-full bg-primary text-background font-bold py-3 rounded-lg hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-primary/20"
            >
              {isSending ? 'Enviando...' : 'Enviar Relato'}
            </button>
         </div>
      </main>

      {/* SUCCESS POPUP */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-primary/20 shadow-2xl relative animate-scale">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary animate-pulse">
                 <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <h3 className="text-xl font-bold text-main mb-2">Enviado!</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Seu relato foi enviado com sucesso. Obrigado!
              </p>
              <button 
                onClick={() => { setShowSuccess(false); onBack(); }}
                className="w-full h-12 rounded-xl bg-primary text-background hover:brightness-110 font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationsView({ onBack }: SubViewProps) {
  const { user, updateUserProfile, requestNotificationPermission, setScreen, activeRole } = useApp();
  const [notifyWorkout, setNotifyWorkout] = useState(user?.notifyWorkout ?? true);
  const [notifyChat, setNotifyChat] = useState(user?.notifyChat ?? true);
  const [notifyDiet, setNotifyDiet] = useState(user?.notifyDiet ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [permission, setPermission] = useState(Notification.permission);
  const [debugMode, setDebugMode] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
      checkPermission();
      // Try to get token from storage if available to show in debug
      const savedToken = localStorage.getItem('fcm_token');
      if (savedToken) setFcmToken(savedToken);
  }, []);

  const checkPermission = () => {
      const perm = Notification.permission;
      setPermission(perm);
  };

    const handleRequest = async () => {
        try {
            if (!('serviceWorker' in navigator)) {
                alert("O teu navegador não suporta notificações. Tenta usar o Chrome.");
                return;
            }

            const result = await requestNotificationPermission();
            const token = typeof result === 'string' ? result : (result?.token || null);
            const error = typeof result === 'object' ? result?.error : null;

            if (token) {
                setFcmToken(token);
                localStorage.setItem('fcm_token', token);
                alert("Sucesso! Notificações ativadas.");
            } else {
                alert(`Falha no Registro:\n${error || 'Erro Crítico: O navegador recusou o pedido.'}\n\nVerifica se tens as notificações do navegador permitidas nas definições do Android.`);
            }
        } catch (err: any) {
            alert("Erro Técnico: " + err.message);
        }
        checkPermission();
    };

  const handleSave = async () => {
    setIsSaving(true);
    // Request permission if enabling any
    if ((notifyWorkout || notifyChat || notifyDiet)) {
        await requestNotificationPermission();
        checkPermission();
    }
    
    await updateUserProfile({
        notifyWorkout,
        notifyChat,
        notifyDiet
    });
    setIsSaving(false);
    onBack();
  };

  const Toggle = ({ label, value, onChange }: { label: string, value: boolean, onChange: (v: boolean) => void }) => (
      <button onClick={() => onChange(!value)} className="w-full flex items-center justify-between p-4 bg-surface rounded-xl border border-main/5 hover:bg-main/5 transition-colors">
          <span className="font-bold text-main text-sm">{label}</span>
          <div className={`w-12 h-6 rounded-full relative transition-colors ${value ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-background transition-all ${value ? 'left-7' : 'left-1'}`}></div>
          </div>
      </button>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 flex items-center gap-3 animate-enter">
        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-main">Notificações</h1>
      </header>
      <main className="p-4 space-y-4 animate-enter delay-100">
          {permission === 'denied' && (
              <div className="bg-red-500/10 border-2 border-red-500/30 text-red-500 rounded-xl p-4 text-xs font-bold space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined">warning</span>
                    <p>Notificações Bloqueadas no Telemóvel!</p>
                  </div>
                  <div className="font-normal text-muted-foreground space-y-4 bg-background/50 p-5 rounded-2xl border border-main/5">
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                           <span className="material-symbols-outlined text-red-500 text-sm">settings</span>
                           <div className="space-y-1">
                              <p className="text-[11px] font-bold text-main uppercase">Como Ativar no Telemóvel:</p>
                              <p className="text-[10px]">1. Vai às <span className="font-bold text-main">Definições do Sistema</span> &gt; <span className="font-bold text-main">Apps</span>.</p>
                              <p className="text-[10px]">2. Procura pela App <span className="font-bold text-main">FITVLR PRO</span>.</p>
                              <p className="text-[10px]">3. Em <span className="font-bold text-main">Notificações</span>, ativa todos os interruptores.</p>
                           </div>
                        </div>
                    </div>

                    <p className="pt-2 text-center text-[10px] italic opacity-70">Após ativares nas definições, fecha e volta a abrir a aplicação.</p>
                  </div>
              </div>
          )}
          {permission === 'default' && (
               <button onClick={handleRequest} className="w-full bg-primary/20 p-5 rounded-xl border-2 border-primary/30 text-primary text-sm font-black text-center hover:bg-primary/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                   <span className="material-symbols-outlined">notifications_active</span>
                   ATIVAR NOTIFICAÇÕES AGORA
               </button>
          )}

          <Toggle label="Lembretes de Treino" value={notifyWorkout} onChange={setNotifyWorkout} />
          <Toggle label="Mensagens do Chat" value={notifyChat} onChange={setNotifyChat} />
          <Toggle label="Horários das Refeições" value={notifyDiet} onChange={setNotifyDiet} />


          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full mt-8 bg-primary text-background font-bold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 active:scale-95"
          >
            {isSaving ? 'A guardar...' : 'Guardar Preferências'}
          </button>
      </main>
          </div>
  );
}

function SecurityView({ onBack }: SubViewProps) {
  const { updatePassword, logout, setScreen, user, activeRole } = useApp();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (password !== confirmPassword) {
        alert("As senhas não coincidem.");
        return;
    }
    if (password.length < 6) {
        alert("A senha deve ter no mínimo 6 caracteres.");
        return;
    }

    setIsSaving(true);
    const { error } = await updatePassword(password);
    setIsSaving(false);

    if (error) {
        alert("Erro ao atualizar senha: " + error.message);
    } else {
        alert("Senha atualizada com sucesso! Por segurança, faça login novamente.");
        logout();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 flex items-center gap-3 animate-enter">
        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-main">Segurança</h1>
      </header>
      <main className="p-4 space-y-6 animate-enter delay-100">
          <div className="bg-surface p-4 rounded-xl border border-main/5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted">Nova Palavra-passe</label>
                <div className="relative">
                    <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-main/5 rounded-lg p-3 text-main border border-main/5 focus:border-primary outline-none transition-colors"
                    placeholder="••••••••"
                    />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted">Confirmar Palavra-passe</label>
                <div className="relative">
                    <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-main/5 rounded-lg p-3 text-main border border-main/5 focus:border-primary outline-none transition-colors"
                    placeholder="••••••••"
                    />
                </div>
              </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving || !password}
            className="w-full bg-primary text-background font-bold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 active:scale-95"
          >
            {isSaving ? 'A atualizar...' : 'Alterar Palavra-passe'}
          </button>
      </main>
          </div>
  );
}

export { NotificationsView, SecurityView };
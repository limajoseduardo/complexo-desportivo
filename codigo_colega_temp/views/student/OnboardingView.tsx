
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { Screen } from '../../types';

const GOAL_OPTIONS = ['Emagrecimento', 'Hipertrofia', 'Força', 'Resistência', 'Manutenção', 'Saúde'];

export default function OnboardingView() {
    const { user, updateUserProfile, setScreen } = useApp();
    const [step, setStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    
    // Safety redirect for Trainers
    React.useEffect(() => {
        if (user?.role === 'TRAINER') {
            setScreen(Screen.TRAINER_DASHBOARD);
        }
    }, [user, setScreen]);
    
    // Pre-fill if user already has data (e.g. re-watching tutorial)
    const [formData, setFormData] = useState({
        birthdate: user?.birthdate || '',
        height: user?.height?.toString() || '',
        weight: user?.weight?.toString() || '',
        goal: user?.goal || 'Emagrecimento',
        targetWeight: user?.targetWeight?.toString() || '',
        gender: user?.gender || '',
        restDays: user?.restDays || [0, 6],
        trainingFrequency: user?.trainingFrequency || 5
    });

    const toggleRestDay = (dayIndex: number) => {
        setFormData(prev => {
            const newDays = prev.restDays.includes(dayIndex) 
                ? prev.restDays.filter(d => d !== dayIndex)
                : [...prev.restDays, dayIndex];
            return { ...prev, restDays: newDays };
        });
    };

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isStep1Valid = 
        formData.birthdate.length === 10 &&
        !isNaN(parseFloat(formData.height)) && parseFloat(formData.height) > 0 &&
        !isNaN(parseFloat(formData.weight)) && parseFloat(formData.weight) > 0 &&
        formData.gender !== '';

    const { bmi, category, idealWeightRange } = useMemo(() => {
        const h = parseFloat(formData.height);
        const w = parseFloat(formData.weight);

        if (!h || !w || h <= 0 || w <= 0) {
            return { bmi: null, category: null, idealWeightRange: null };
        }

        const bmiValue = w / (h * h);
        let cat = 'Peso Normal';
        let catColor = 'text-primary';
        if (bmiValue < 18.5) {
            cat = 'Abaixo do Peso';
            catColor = 'text-blue-400';
        } else if (bmiValue >= 25 && bmiValue < 30) {
            cat = 'Sobrepeso';
            catColor = 'text-yellow-400';
        } else if (bmiValue >= 30) {
            cat = 'Obesidade';
            catColor = 'text-red-400';
        }

        const minIdeal = 18.5 * (h * h);
        const maxIdeal = 24.9 * (h * h);

        return {
            bmi: bmiValue.toFixed(1),
            category: { label: cat, color: catColor },
            idealWeightRange: `${minIdeal.toFixed(1)}kg - ${maxIdeal.toFixed(1)}kg`
        };
    }, [formData.height, formData.weight]);
    
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 8) value = value.substring(0, 8);
        if (value.length > 4) value = value.replace(/^(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3');
        else if (value.length > 2) value = value.replace(/^(\d{2})(\d{0,2})/, '$1/$2');
        setFormData({ ...formData, birthdate: value });
    };

    const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 3) value = value.substring(0, 3);
        if (value.length > 1) value = value.replace(/^(\d{1})(\d{0,2})/, '$1.$2');
        setFormData({ ...formData, height: value });
    };
    
    const handleDecimalInputChange = (field: 'weight' | 'targetWeight', value: string) => {
        const sanitizedValue = value.replace(',', '.');
        if (/^\d*\.?\d*$/.test(sanitizedValue)) {
            setFormData(prev => ({...prev, [field]: sanitizedValue}));
        }
    };
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const finishOnboarding = () => {
        if (!formData.goal || !formData.targetWeight) {
            alert("Por favor, selecione um objetivo e defina um peso alvo.");
            return;
        }
        handleFinalSubmit();
    };

    const handleFinalSubmit = async () => {
        if (!user) return;
        setIsSaving(true);
        
        try {
            let avatarUrl = user.avatar;

            // 1. Upload Avatar if new file selected
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, avatarFile);

                if (uploadError) {
                    console.error("Avatar upload error:", uploadError);
                     if (uploadError.message.includes('Bucket not found')) {
                        throw new Error("Erro de configuração: o bucket 'avatars' não existe.");
                    } else if (uploadError.message.includes('new row violates row-level security')) {
                        throw new Error("Erro de permissão: as políticas de segurança não permitem a submissão.");
                    } else {
                        throw new Error(`Erro no upload do avatar: ${uploadError.message}`);
                    }
                }

                const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                if (!data || !data.publicUrl) {
                    throw new Error("Erro ao obter URL do avatar.");
                }
                avatarUrl = data.publicUrl;
            }

            // 2. Update Profile
            await updateUserProfile({
                birthdate: formData.birthdate,
                height: parseFloat(formData.height),
                weight: parseFloat(formData.weight),
                initialWeight: parseFloat(formData.weight), // Set initial weight if first time
                goal: formData.goal,
                targetWeight: parseFloat(formData.targetWeight),
                gender: formData.gender as 'MALE' | 'FEMALE',
                avatar: avatarUrl,
                restDays: formData.restDays,
                trainingFrequency: formData.trainingFrequency
            });

            // 3. Navigate to Dashboard
            setScreen(Screen.STUDENT_DASHBOARD);

        } catch (e) {
            console.error("Failed to save onboarding data:", e);
            alert("Ocorreu um erro ao salvar os dados. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const ProgressBar = ({ current, total }: { current: number, total: number }) => (
        <div className="w-full bg-surface rounded-full h-2 mb-8 border border-main/5">
            <div className="bg-primary h-2 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{ width: `${(current / total) * 100}%` }}></div>
        </div>
    );
    
    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col p-6 animate-in fade-in duration-500">
            <div className="w-full max-w-md mx-auto flex flex-col h-full">
                
                {/* STEP 1: Basic Info */}
                {step === 1 && (
                    <div className="flex flex-col flex-1 animate-in fade-in duration-500 min-h-0">
                        <ProgressBar current={1} total={2} />
                        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                            <h1 className="text-3xl font-bold text-main mb-2 text-center">Vamos começar!</h1>
                            <p className="text-muted mb-6 text-center text-sm">Preenche os teus dados para montarmos o teu plano.</p>
                            
                            <div className="flex justify-center mb-6">
                                <div className="relative group">
                                    <div
                                        className="h-28 w-28 rounded-full bg-cover bg-center border-4 border-surface shadow-xl"
                                        style={{ backgroundImage: `url(${avatarPreview || 'https://ui-avatars.com/api/?name=User&background=13ec5b&color=121212&size=128'})` }}
                                    ></div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute bottom-0 right-0 bg-primary text-background h-9 w-9 rounded-full flex items-center justify-center border-4 border-background hover:scale-110 transition-transform shadow-lg"
                                    >
                                        <span className="material-symbols-outlined text-lg">photo_camera</span>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Data de Nascimento</label>
                                    <input type="tel" inputMode="numeric" placeholder="DD/MM/AAAA" value={formData.birthdate} onChange={handleDateChange} maxLength={10} className="w-full bg-surface rounded-xl p-4 text-main border border-main/10 focus:border-primary outline-none text-center font-bold tracking-wider text-lg" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Género</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setFormData({ ...formData, gender: 'MALE' })}
                                            className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${
                                                formData.gender === 'MALE'
                                                    ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10'
                                                    : 'bg-surface border-main/10 text-muted hover:bg-main/5'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined">male</span>
                                            <span className="font-bold">Masculino</span>
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, gender: 'FEMALE' })}
                                            className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${
                                                formData.gender === 'FEMALE'
                                                    ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10'
                                                    : 'bg-surface border-main/10 text-muted hover:bg-main/5'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined">female</span>
                                            <span className="font-bold">Feminino</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted uppercase tracking-wider">Altura (m)</label>
                                        <input type="tel" inputMode="numeric" value={formData.height} onChange={handleHeightChange} placeholder="1.75" className="w-full bg-surface rounded-xl p-4 text-main border border-main/10 focus:border-primary outline-none text-center font-bold tracking-wider text-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted uppercase tracking-wider">Peso (kg)</label>
                                        <input type="tel" inputMode="decimal" value={formData.weight} onChange={(e) => handleDecimalInputChange('weight', e.target.value)} placeholder="70.5" className="w-full bg-surface rounded-xl p-4 text-main border border-main/10 focus:border-primary outline-none text-center font-bold tracking-wider text-xl" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setStep(2)} disabled={!isStep1Valid} className="w-full mt-6 h-14 rounded-xl bg-primary text-background font-bold text-lg disabled:opacity-50 transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 flex-shrink-0">
                            Próximo <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                )}

                {/* STEP 2: Goals */}
                {step === 2 && (
                    <div className="flex flex-col flex-1 animate-in fade-in duration-500 min-h-0">
                         <ProgressBar current={2} total={2} />
                         <button onClick={() => setStep(1)} className="absolute top-5 left-2 text-muted hover:text-main p-2 rounded-full"><span className="material-symbols-outlined">arrow_back</span></button>
                        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                            <h1 className="text-3xl font-bold text-main mb-4">Define as Tuas Metas</h1>

                            {bmi && (
                                <div className="bg-surface rounded-2xl p-6 border border-main/10 mb-8 text-center shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                                    <p className="text-xs text-muted font-bold uppercase tracking-wider">Teu IMC</p>
                                    <div className="flex items-baseline justify-center gap-2 mt-2 mb-1">
                                        <p className="text-6xl font-black text-main">{bmi}</p>
                                        <p className={`font-bold ${category?.color} text-lg`}>{category?.label}</p>
                                    </div>
                                    <p className="text-xs text-muted mt-4 bg-main/5 py-2 rounded-lg inline-block px-4 border border-main/5">
                                        Peso ideal sugerido: <strong className="text-main">{idealWeightRange}</strong>
                                    </p>
                                </div>
                            )}

                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Objetivo Principal</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {GOAL_OPTIONS.map(option => (
                                            <button 
                                                key={option} 
                                                onClick={() => setFormData({...formData, goal: option})} 
                                                className={`py-4 px-2 rounded-xl text-sm font-bold border transition-all active:scale-95 ${formData.goal === option ? 'bg-primary text-background border-primary shadow-md' : 'bg-surface text-muted border-main/10 hover:bg-main/5'}`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Peso Alvo (kg)</label>
                                    <div className="relative mb-6">
                                        <input type="tel" inputMode="decimal" value={formData.targetWeight} onChange={(e) => handleDecimalInputChange('targetWeight', e.target.value)} placeholder="Ex: 65" className="w-full bg-surface rounded-xl pl-6 pr-16 py-6 text-main border border-primary/50 focus:border-primary outline-none text-center font-black tracking-wider text-4xl" />
                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-muted font-bold">kg</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Frequência de Treino (dias/semana)</label>
                                    <div className="flex justify-between gap-2 mb-6">
                                        {[1, 2, 3, 4, 5, 6, 7].map(num => (
                                            <button
                                                key={num}
                                                onClick={() => setFormData({ ...formData, trainingFrequency: num })}
                                                className={`h-12 flex-1 rounded-xl font-bold text-sm border transition-all ${
                                                    formData.trainingFrequency === num
                                                        ? 'bg-primary text-background border-primary shadow-md'
                                                        : 'bg-surface text-muted border-main/10 hover:bg-main/5'
                                                }`}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Dias de Descanso</label>
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
                                                        : 'bg-surface text-muted border-main/10'
                                                }`}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={finishOnboarding} 
                            disabled={!formData.targetWeight || isSaving}
                            className="w-full mt-6 h-14 rounded-xl bg-primary text-background font-bold text-lg disabled:opacity-50 transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 flex-shrink-0"
                        >
                            {isSaving ? (
                                <span className="w-6 h-6 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    Concluir e Começar <span className="material-symbols-outlined">rocket_launch</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}


import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Screen, User } from '../../types';
import { supabase } from '../../lib/supabaseClient';

interface DietCreatorViewProps {
  onBack: () => void;
}

export default function DietCreatorView({ onBack }: DietCreatorViewProps) {
  const { viewingStudent, setScreen, sendPushNotification } = useApp();
  const [planName, setPlanName] = useState('');
  
  // Initialize with 0 to ensure inputs start empty/clean
  const [macros, setMacros] = useState({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Real Student Data State
  const [studentDetails, setStudentDetails] = useState<User | null>(null);
  const [currentIntake, setCurrentIntake] = useState<any[]>([]);
  const [isLoadingIntake, setIsLoadingIntake] = useState(false);
  const [showIntake, setShowIntake] = useState(false);

  const DAYS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  // Fetch full student details when component mounts
  useEffect(() => {
    const fetchStudentDetails = async () => {
        if (!viewingStudent?.id) return;
        setIsLoadingIntake(true);

        try {
            // 1. Current Intake (Meals/Items)
            const { data: meals } = await supabase
                .from('diet_meals')
                .select('*, diet_items(*)')
                .eq('student_id', viewingStudent.id)
                .order('order_index', { ascending: true });
            
            if (meals) setCurrentIntake(meals);

            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', viewingStudent.id)
                .single();
            
            if (data) {
                // Map Supabase snake_case fields to camelCase User type
                const sData: User = {
                    ...data as any,
                    initialWeight: data.initial_weight,
                    targetWeight: data.target_weight,
                    bodyFat: data.body_fat,
                    targetCalories: data.target_calories,
                    targetProtein: data.target_protein,
                    targetCarbs: data.target_carbs,
                    targetFat: data.target_fat,
                    activityFactor: data.activity_factor,
                    proteinMultiplier: data.protein_multiplier,
                    trainingFrequency: data.training_frequency,
                };
                
                setStudentDetails(sData);
                if (sData.diet_plan_name) setPlanName(sData.diet_plan_name);

                // Auto-calculate macros mathematically (following DietView logic)
                const weight = sData.weight || 0;
                const height = sData.height || 0;
                const bodyFat = sData.bodyFat || 0;
                const lbm = weight && bodyFat ? weight * (1 - bodyFat / 100) : null;
                
                // 1. Protein Target
                const defaultMult = sData.gender === 'FEMALE' ? 1.8 : 2.2;
                const activeMultiplier = sData.proteinMultiplier && sData.proteinMultiplier > 0 ? sData.proteinMultiplier : defaultMult;
                const proteinTarget = lbm 
                    ? Math.round(lbm * (sData.proteinMultiplier && sData.proteinMultiplier > 0 ? sData.proteinMultiplier : 2.5))
                    : Math.round(weight * activeMultiplier);

                // 2. Fat Target
                const fatTarget = Math.round((lbm || weight) * 1);

                // 3. Calories (TDEE)
                let bmr = 2000;
                if (weight && height) {
                    if (bodyFat > 0 && lbm) {
                        bmr = Math.round(370 + (21.6 * lbm));
                    } else {
                        const heightCMS = height < 3 ? height * 100 : height;
                        let age = 25;
                        if (sData.birthdate) {
                            try {
                                const birth = new Date(sData.birthdate);
                                if (!isNaN(birth.getTime())) {
                                    age = new Date().getFullYear() - birth.getFullYear();
                                }
                            } catch (e) {}
                        }
                        if (sData.gender === 'FEMALE') {
                            bmr = Math.round(655 + (9.6 * weight) + (1.8 * heightCMS) - (4.7 * age));
                        } else {
                            bmr = Math.round(66 + (13.7 * weight) + (5 * heightCMS) - (6.8 * age));
                        }
                    }
                }

                const freq = sData.trainingFrequency || 0;
                let fa = 1.2;
                if (sData.activityFactor) {
                    fa = sData.activityFactor;
                } else if (freq > 0) {
                    if (freq <= 3) fa = 1.375;
                    else if (freq <= 5) fa = 1.55;
                    else fa = 1.725;
                }

                const tdee = Math.round(bmr * fa);

                // 4. Final values with fallbacks
                const finalCalories = sData.targetCalories || tdee;
                const finalProtein = sData.targetProtein || proteinTarget;
                const finalFat = sData.targetFat || fatTarget;
                
                // Carbs is the remainder
                const remainingCals = finalCalories - (finalProtein * 4) - (finalFat * 9);
                const carbTarget = Math.max(0, Math.round(remainingCals / 4));
                const finalCarbs = sData.targetCarbs || carbTarget;

                setMacros({
                    calories: finalCalories || 0,
                    protein: finalProtein || 0,
                    carbs: finalCarbs || 0,
                    fat: finalFat || 0
                });
            }
        } catch (e) {
            console.error("Error fetching student details", e);
        } finally {
            setIsLoadingIntake(false);
        }
    };

    fetchStudentDetails();
  }, [viewingStudent]);

  const handleCreatePlan = async () => {
    if (!planName.trim()) {
      alert("Por favor, digite um nome para a dieta.");
      return;
    }

    if (!viewingStudent?.id) return;

    setIsSaving(true);

    try {
        // Update the profile with the new plan settings
        const { data, error } = await supabase
            .from('profiles')
            .update({
                diet_plan_name: planName,
                target_calories: macros.calories,
                target_protein: macros.protein,
                target_carbs: macros.carbs,
                target_fat: macros.fat
            })
            .eq('id', viewingStudent.id)
            .select();

        if (error) throw error;
        
        if (!data || data.length === 0) {
            throw new Error("Permissão negada ou aluno não encontrado. É provável que as políticas de segurança (RLS) da tabela 'profiles' não permitam que o personal trainer atualize o perfil do aluno.");
        }

        // Notify Student
        const pushTitle = 'Nova Dieta';
        const pushMessage = `Seu personal definiu uma nova dieta: ${planName}`;

        await supabase.from('notifications').insert({
            user_id: viewingStudent.id,
            title: pushTitle,
            message: pushMessage,
            type: 'SUCCESS'
        });

        sendPushNotification(viewingStudent.id, pushTitle, pushMessage);

        // Initialize a meal for each day of the week
        const mealsToInsert = [0, 1, 2, 3, 4, 5, 6].map(day => ({
          student_id: viewingStudent.id,
          day_of_week: day,
          name: 'Refeição 1',
          order_index: 0
        }));

        const { error: mealError } = await supabase.from('diet_meals').insert(mealsToInsert);
        if (mealError) throw mealError;

        // Redirect to the main Diet Editor (Meals)
        const isDesktopAdmin = window.location.pathname.includes('/ptadmin');
        if (isDesktopAdmin) {
            onBack();
        } else {
            setScreen(Screen.TRAINER_EDIT_DIET);
        }

    } catch (e: any) {
        console.error("Erro ao criar dieta", e);
        alert("Erro ao salvar dieta: " + e.message);
    } finally {
        setIsSaving(false);
    }
  };

  const avatarUrl = studentDetails?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingStudent?.name || 'User')}&background=13ec5b&color=102216`;
  const isDesktopAdmin = window.location.pathname.includes('/ptadmin');

  return (
    <div className={`flex flex-col h-full bg-background pb-8 ${isDesktopAdmin ? 'pt-0' : ''}`}>
        {/* Header */}
        {!isDesktopAdmin && (
          <header className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 flex items-center gap-3">
              <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
              <span className="material-symbols-outlined">arrow_back_ios_new</span>
              </button>
              <h1 className="text-lg font-bold text-main">Novo Plano Alimentar</h1>
          </header>
        )}

        <main className="flex-1 p-6 space-y-8 overflow-y-auto">
            {/* Student Card */}
            <div className="flex flex-col items-center justify-center pt-4">
                <div className="relative mb-3">
                    <div 
                        className="h-24 w-24 rounded-full bg-cover bg-center border-4 border-[#1A3824] shadow-2xl" 
                        style={{ backgroundImage: `url('${avatarUrl}')` }}
                    ></div>
                    <div className="absolute -bottom-2 -right-2 bg-primary text-background p-2 rounded-full shadow-lg">
                        <span className="material-symbols-outlined text-xl font-bold">restaurant_menu</span>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-main">{viewingStudent?.name}</h2>
                <p className="text-muted text-sm">Configurando nutrição</p>
            </div>

            {/* Step 1: Name */}
            <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 delay-100">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-primary ml-1 uppercase tracking-wider">Nome da Dieta</label>
                    {currentIntake.length > 0 && (
                        <button 
                            onClick={() => setShowIntake(!showIntake)}
                            className="text-[10px] bg-primary/10 text-primary px-3 py-1.5 rounded-full font-black border border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-xs">{showIntake ? 'visibility_off' : 'visibility'}</span>
                            {showIntake ? 'Esconder' : 'Ver'} Dieta atual (Semanal)
                        </button>
                    )}
                </div>
                
                {showIntake && currentIntake.length > 0 && (
                    <div className="bg-surface/50 rounded-2xl p-4 border border-primary/10 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary text-sm">history_edu</span>
                            <h3 className="text-xs font-black text-main uppercase tracking-widest">O que o aluno tem atualmente:</h3>
                        </div>

                        {/* Case for meals with no defined day (legacy data) */}
                        {(() => {
                            const noDayMeals = currentIntake.filter(m => m.day_of_week === null || m.day_of_week === undefined);
                            if (noDayMeals.length === 0) return null;
                            return (
                                <div className="space-y-3 pb-4 border-b border-main/5">
                                    <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest bg-orange-400/5 px-2 py-1 rounded w-fit">
                                        Plano Geral / Sem Dia Definido
                                    </h4>
                                    <div className="space-y-3 pl-2">
                                        {noDayMeals.map((meal) => (
                                            <div key={meal.id} className="space-y-1.5">
                                                <p className="text-[10px] font-black text-muted uppercase tracking-tighter">{meal.name}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {meal.diet_items?.map((item: any) => (
                                                        <div key={item.id} className="bg-main/5 px-2.5 py-1 rounded-lg text-xs text-main border border-main/5 flex items-center gap-1.5">
                                                            <span>{item.image && item.image.startsWith('http') ? '📸' : (item.image || '🥣')}</span>
                                                            <span className="font-medium">{item.name}</span>
                                                            <span className="text-muted text-[10px]">{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                    {(!meal.diet_items || meal.diet_items.length === 0) && (
                                                        <p className="text-[10px] text-muted-foreground/40 italic">Sem itens</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                            const dayMeals = currentIntake.filter(m => m.day_of_week === dayIdx);
                            if (dayMeals.length === 0) return null;

                            return (
                                <div key={dayIdx} className="space-y-3 pb-4 border-b border-main/5 last:border-0 last:pb-0">
                                    <h4 className="text-xs font-black text-primary uppercase tracking-widest bg-primary/5 px-2 py-1 rounded w-fit">
                                        {DAYS_FULL[dayIdx]}
                                    </h4>
                                    <div className="space-y-3 pl-2">
                                        {dayMeals.map((meal) => (
                                            <div key={meal.id} className="space-y-1.5">
                                                <p className="text-[10px] font-black text-muted uppercase tracking-tighter">{meal.name}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {meal.diet_items?.map((item: any) => (
                                                        <div key={item.id} className="bg-main/5 px-2.5 py-1 rounded-lg text-xs text-main border border-main/5 flex items-center gap-1.5">
                                                            <span>{item.image && item.image.startsWith('http') ? '📸' : (item.image || '🥣')}</span>
                                                            <span className="font-medium">{item.name}</span>
                                                            <span className="text-muted text-[10px]">{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                    {(!meal.diet_items || meal.diet_items.length === 0) && (
                                                        <p className="text-[10px] text-muted-foreground/40 italic">Sem itens</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <input 
                    type="text" 
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="Ex: Cutting Verão, Bulking Limpo..." 
                    className="w-full h-14 bg-surface rounded-2xl px-4 text-main border border-main/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium text-lg placeholder:text-zinc-600"
                    autoFocus
                />
            </div>

            {/* Step 2: Macros */}
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500 delay-200">
                <label className="text-sm font-bold text-primary ml-1 uppercase tracking-wider">Metas Diárias (Macros)</label>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface p-3 rounded-xl border border-main/5">
                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Calorias (Kcal)</label>
                        <input 
                            type="number" 
                            value={macros.calories || ''}
                            onChange={(e) => setMacros({...macros, calories: Number(e.target.value)})}
                            className="w-full bg-transparent text-xl font-bold text-main outline-none placeholder:text-zinc-700"
                            placeholder="0"
                        />
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-blue-500/20">
                        <label className="text-[10px] font-bold text-blue-400 uppercase block mb-1">Proteínas (g)</label>
                        <input 
                            type="number" 
                            value={macros.protein || ''}
                            onChange={(e) => setMacros({...macros, protein: Number(e.target.value)})}
                            className="w-full bg-transparent text-xl font-bold text-blue-400 outline-none placeholder:text-blue-900"
                            placeholder="0"
                        />
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-orange-500/20">
                        <label className="text-[10px] font-bold text-orange-400 uppercase block mb-1">Carboidratos (g)</label>
                        <input 
                            type="number" 
                            value={macros.carbs || ''}
                            onChange={(e) => setMacros({...macros, carbs: Number(e.target.value)})}
                            className="w-full bg-transparent text-xl font-bold text-orange-400 outline-none placeholder:text-orange-900"
                            placeholder="0"
                        />
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-yellow-500/20">
                        <label className="text-[10px] font-bold text-yellow-400 uppercase block mb-1">Gorduras (g)</label>
                        <input 
                            type="number" 
                            value={macros.fat || ''}
                            onChange={(e) => setMacros({...macros, fat: Number(e.target.value)})}
                            className="w-full bg-transparent text-xl font-bold text-yellow-400 outline-none placeholder:text-yellow-900"
                            placeholder="0"
                        />
                    </div>
                </div>
            </div>
        </main>

        <footer className="sticky bottom-0 bg-background p-6 border-t border-main/5">
            <button 
                onClick={handleCreatePlan}
                disabled={isSaving || !planName.trim()}
                className="w-full h-14 rounded-xl bg-primary text-background font-black text-lg shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSaving ? (
                    <>
                        <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                        Salvando...
                    </>
                ) : (
                    <>
                        <span>Criar e Editar</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </>
                )}
            </button>
        </footer>
    </div>
  );
}

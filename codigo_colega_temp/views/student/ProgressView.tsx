import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../contexts/AppContext';
import { Screen, WeightEntry, User } from '../../types';
import { supabase } from '../../lib/supabaseClient';

interface ProgressViewProps {
  onBack: () => void;
}

const timeRangeLabels: { [key: string]: string } = {
    '1S': 'Última Semana',
    '1M': 'Último Mês',
    '3M': 'Últimos 3 Meses',
    '6M': 'Últimos 6 Meses',
    '1A': 'Último Ano',
    'Tudo': 'Desde o Início'
};

export default function ProgressView({ onBack }: ProgressViewProps) {
  const { progress: contextProgress, addWeightEntry, user, viewingStudent, updateWeightEntry, deleteWeightEntry, setScreen } = useApp();
  const [activeTab, setActiveTab] = useState<'MEASURES' | 'PHOTOS'>('MEASURES');
  const [compareAngle, setCompareAngle] = useState<'FRONT' | 'SIDE' | 'BACK'>('FRONT');
  const [timeRange, setTimeRange] = useState<string>('1M');

  // Local state for fetched data
  const [localProgress, setLocalProgress] = useState<WeightEntry[]>([]);
  const [studentProfile, setStudentProfile] = useState<User | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [editedWeight, setEditedWeight] = useState('');
  
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);

  // State for the new entry modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [targetEntryId, setTargetEntryId] = useState<string | null>(null);
  const [isWeightReadOnly, setIsWeightReadOnly] = useState(false);

  // Photo Upload State
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [sideFile, setSideFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState<{ front?: string, side?: string, back?: string }>({});

  const frontInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // State for Reset Confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // State for Image Fullscreen Viewing
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Determine viewing context
  const isTrainer = !!viewingStudent; 
  const isOwner = !isTrainer; 

  const isToday = (dateString: string | null) => {
      if (!dateString) return false;
      const date = new Date(dateString);
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
  };

  // Combine context user or viewingStudent with fetched profile data
  const targetUser = useMemo(() => {
      const base = viewingStudent || user;
      if (isTrainer && studentProfile) {
          return { ...base, ...studentProfile };
      }
      return base;
  }, [viewingStudent, user, studentProfile, isTrainer]);

  // Fetch data specifically for targetUser whenever it changes
  useEffect(() => {
      const fetchData = async () => {
          if (!targetUser?.id) return;
          setIsFetching(true);
          try {
              // 1. Fetch History
              const { data: historyData } = await supabase
                  .from('weight_history')
                  .select('*')
                  .eq('user_id', targetUser.id)
                  .order('date', { ascending: true });
              
              if (historyData) {
                  const mapped: WeightEntry[] = historyData.map((item: any) => ({
                      id: item.id,
                      date: item.date,
                      weight: Number(item.weight),
                      photo_front: item.photo_front,
                      photo_side: item.photo_side,
                      photo_back: item.photo_back,
                      waist: item.waist
                  }));
                  setLocalProgress(mapped);
              }

              // 2. Fetch Full Profile (if viewing as trainer to ensure we have weights/goals)
              if (isTrainer) {
                  const { data: profileData } = await supabase
                      .from('profiles')
                      .select('weight, initial_weight, target_weight, goal, height')
                      .eq('id', targetUser.id)
                      .single();
                  
                  if (profileData) {
                      setStudentProfile(prev => ({
                          ...prev!, // Safe bang here because base exists
                          ...viewingStudent!,
                          weight: profileData.weight,
                          initialWeight: profileData.initial_weight,
                          targetWeight: profileData.target_weight,
                          goal: profileData.goal,
                          height: profileData.height
                      } as User));
                  }
              }
          } catch (e) {
              console.error("Error fetching progress data", e);
          } finally {
              setIsFetching(false);
          }
      };

      fetchData();
  }, [viewingStudent?.id, user?.id, isTrainer]);

  // Use localProgress if available (trainer view or fresh fetch), otherwise fallback to context
  const displayProgress = localProgress.length > 0 ? localProgress : (isTrainer ? [] : contextProgress);

  // Calculate Year Bounds
  const { minYear, maxYear } = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (!displayProgress || displayProgress.length === 0) {
        return { minYear: currentYear, maxYear: currentYear };
    }
    const years = displayProgress.map(p => new Date(p.date).getFullYear());
    return { 
        minYear: Math.min(...years),
        maxYear: Math.max(...years, currentYear) 
    };
  }, [displayProgress]);

  // Determine current displayed year for the selector
  const displayYear = useMemo(() => {
      const yearFilter = parseInt(timeRange);
      if (!isNaN(yearFilter) && timeRange.length === 4) {
          return yearFilter;
      }
      return new Date().getFullYear();
  }, [timeRange]);

  const handleYearChange = (offset: number) => {
      const newYear = displayYear + offset;
      if (newYear >= minYear && newYear <= maxYear) {
          setTimeRange(String(newYear));
      }
  };

  const currentRangeLabel = useMemo(() => {
    const yearFilter = parseInt(timeRange);
    if (!isNaN(yearFilter) && timeRange.length === 4) {
        return `Ano de ${yearFilter}`;
    }
    return timeRangeLabels[timeRange] || '';
  }, [timeRange]);

  const pageTitle = isTrainer ? `Progresso: ${targetUser?.name || ''}` : 'O meu Progresso';

  const filteredProgress = useMemo(() => {
    if (!displayProgress || displayProgress.length === 0) return [];
    
    const sortedProgress = [...displayProgress].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const yearFilter = parseInt(timeRange);
    if (!isNaN(yearFilter) && timeRange.length === 4) {
        return sortedProgress.filter(entry => new Date(entry.date).getFullYear() === yearFilter);
    }
    
    if (timeRange === 'Tudo' || timeRange === 'TUDO') return sortedProgress;

    const endDate = new Date(); 
    endDate.setHours(23, 59, 59, 999);

    let startDate = new Date(endDate);

    switch(timeRange) {
       case '1S': 
         startDate.setDate(endDate.getDate() - 7); 
         break;
       case '1M': 
         startDate.setMonth(endDate.getMonth() - 1); 
         break;
       case '3M': 
         startDate.setMonth(endDate.getMonth() - 3); 
         break;
       case '6M': 
         startDate.setMonth(endDate.getMonth() - 6); 
         break;
       case '1A': 
         startDate.setFullYear(endDate.getFullYear() - 1); 
         break;
       default: 
         startDate.setMonth(endDate.getMonth() - 1); 
         break;
    }
    
    startDate.setHours(0,0,0,0);

    return sortedProgress.filter(entry => {
        const d = new Date(entry.date);
        return d >= startDate && d <= endDate;
    });
  }, [displayProgress, timeRange]);

  const displayList = useMemo(() => {
      return [...filteredProgress].reverse();
  }, [filteredProgress]);

  const periodAverage = useMemo(() => {
    if (!filteredProgress || filteredProgress.length === 0) return null;
    const sum = filteredProgress.reduce((acc, curr) => acc + (typeof curr.weight === 'number' ? curr.weight : parseFloat(curr.weight as any)), 0);
    return (sum / filteredProgress.length).toFixed(1);
  }, [filteredProgress]);

  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    return filteredProgress.map(entry => {
       const dateObj = new Date(entry.date);
       const isCurrentYear = dateObj.getFullYear() === currentYear;
       
       const formattedDate = isCurrentYear 
          ? dateObj.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })
          : dateObj.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });

       return {
          ...entry,
          displayDate: formattedDate,
          fullDate: dateObj.toLocaleDateString('pt-BR')
       };
    });
  }, [filteredProgress]);
  
  const hasAnyProgress = displayProgress && displayProgress.length > 0;
  
  // STATS DISPLAY LOGIC
  const startWeight = targetUser?.initialWeight ?? (hasAnyProgress ? displayProgress[0].weight : null); 
  const currentWeight = hasAnyProgress ? displayProgress[displayProgress.length - 1].weight : (targetUser?.weight || null);
  const targetWeight = targetUser?.targetWeight || null;
  
  const periodDiff = useMemo(() => {
      if (filteredProgress.length < 2) return null;
      const first = filteredProgress[0].weight;
      const last = filteredProgress[filteredProgress.length - 1].weight;
      return (last - first).toFixed(1);
  }, [filteredProgress]);


  const handleAddEntry = () => {
    if (!isOwner) return; 
    setTargetEntryId(null);
    setIsWeightReadOnly(false);
    setNewDate(new Date().toISOString().split('T')[0]); 
    setNewWeight('');
    setFrontFile(null);
    setSideFile(null);
    setBackFile(null);
    setPreviews({});
    setShowAddModal(true);
  };

  const handleUploadInitial = () => {
    if (!isOwner) return;
    if (displayProgress && displayProgress.length > 0) {
        const sorted = [...displayProgress].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const first = sorted[0];
        
        setTargetEntryId(first.id); 
        setNewDate(new Date(first.date).toISOString().split('T')[0]);
        setNewWeight(first.weight.toString());
        setIsWeightReadOnly(true); 
        
        setPreviews({
            front: first.photo_front,
            side: first.photo_side,
            back: first.photo_back
        });
    } else {
        setTargetEntryId(null);
        setNewDate(new Date().toISOString().split('T')[0]);
        setNewWeight(targetUser?.weight?.toString() || '');
        setIsWeightReadOnly(false);
        setPreviews({});
    }
    
    setFrontFile(null); setSideFile(null); setBackFile(null);
    setShowAddModal(true);
  };

  const handleUploadCurrent = () => {
    if (!isOwner) return; 
    
    // Sort logic to get latest
    const sorted = [...displayProgress].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latestEntry = sorted.length > 0 ? sorted[sorted.length - 1] : null;

    // Use local comparison via helper
    if (latestEntry && isToday(latestEntry.date)) {
        setTargetEntryId(latestEntry.id);
        setNewDate(new Date().toISOString().split('T')[0]);
        setNewWeight(latestEntry.weight.toString());
        setIsWeightReadOnly(true); 
        setPreviews({
            front: latestEntry.photo_front,
            side: latestEntry.photo_side,
            back: latestEntry.photo_back
        });
    } else {
        setTargetEntryId(null);
        setNewDate(new Date().toISOString().split('T')[0]);
        setNewWeight(targetUser?.weight?.toString() || '');
        setIsWeightReadOnly(false); // New entry, can edit weight
        setPreviews({});
    }
    
    setFrontFile(null); setSideFile(null); setBackFile(null);
    setShowAddModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'side' | 'back') => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const url = URL.createObjectURL(file);
          
          if (type === 'front') setFrontFile(file);
          if (type === 'side') setSideFile(file);
          if (type === 'back') setBackFile(file);
          
          setPreviews(prev => ({ ...prev, [type]: url }));
      }
  };

  const uploadPhoto = async (file: File) => {
      if (!user) {
          throw new Error("Utilizador não autenticado.");
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
          .from('progress_photos')
          .upload(filePath, file);

      if (uploadError) {
          console.error("Upload error details:", uploadError);
          // Distinguish between common errors if possible based on message
          if (uploadError.message.includes('Bucket not found')) {
              throw new Error("Erro de configuração: o bucket 'progress_photos' não existe.");
          } else if (uploadError.message.includes('new row violates row-level security')) {
              throw new Error("Erro de permissão: as políticas de segurança não permitem a submissão.");
          } else {
              throw new Error(`Erro no upload: ${uploadError.message}`);
          }
      }

      const { data } = supabase.storage.from('progress_photos').getPublicUrl(filePath);
      if (!data || !data.publicUrl) {
          throw new Error("Erro ao obter URL da imagem.");
      }
      
      return data.publicUrl;
  };
  
  const handleSaveNewEntry = async () => {
    const weightValue = parseFloat(newWeight.replace(',', '.'));
    
    if (!isNaN(weightValue) && weightValue > 0) {
        setIsUploading(true);
        try {
            let photoUrls: { front?: string, side?: string, back?: string } = {};

            if (frontFile) photoUrls.front = await uploadPhoto(frontFile);
            if (sideFile) photoUrls.side = await uploadPhoto(sideFile);
            if (backFile) photoUrls.back = await uploadPhoto(backFile);

            if (targetEntryId) {
                const updates: any = {};
                if (photoUrls.front) updates.photo_front = photoUrls.front;
                if (photoUrls.side) updates.photo_side = photoUrls.side;
                if (photoUrls.back) updates.photo_back = photoUrls.back;
                
                if (Object.keys(updates).length > 0) {
                    const { error } = await supabase
                        .from('weight_history')
                        .update(updates)
                        .eq('id', targetEntryId);
                    if (error) throw error;

                    // Update local state immediately to avoid reload
                    setLocalProgress(prev => prev.map(p => {
                        if (p.id === targetEntryId) {
                            return { ...p, ...updates };
                        }
                        return p;
                    }));
                }
                
                // Close modal and show success
                setShowAddModal(false);
                setShowSuccessPopup(true);
            } else {
                const date = new Date(newDate + 'T00:00:00');
                await addWeightEntry(weightValue, date, photoUrls, viewingStudent?.id);
                
                // If viewing as trainer, we need to refresh local list since context 'progress' won't update for us
                if (isTrainer && viewingStudent) {
                     const { data: newHistory } = await supabase
                        .from('weight_history')
                        .select('*')
                        .eq('user_id', viewingStudent.id)
                        .order('date', { ascending: true });
                     if (newHistory) {
                        setLocalProgress(newHistory.map((item: any) => ({
                            id: item.id,
                            date: item.date,
                            weight: Number(item.weight),
                            photo_front: item.photo_front,
                            photo_side: item.photo_side,
                            photo_back: item.photo_back,
                            waist: item.waist
                        })));
                     }
                }

                setShowAddModal(false);
                setShowSuccessPopup(true);
            }
        } catch (e: any) {
            console.error(e);
            alert("Erro ao salvar: " + e.message);
        } finally {
            setIsUploading(false);
        }
    } else {
        alert("Por favor, insira um valor de peso válido.");
    }
  };


  const handleOpenEditModal = (entry: WeightEntry) => {
    if (!isOwner) return;
    setEditingEntry(entry);
    setEditedWeight(entry.weight.toString());
    setIsDeleteArmed(false); 
  };

  const handleCloseEditModal = () => {
    setEditingEntry(null);
    setEditedWeight('');
    setIsDeleteArmed(false); 
  };

  const handleUpdateWeight = () => {
    if (editingEntry) {
      const weightValue = parseFloat(editedWeight.replace(',', '.'));
      if (!isNaN(weightValue) && weightValue > 0) {
        updateWeightEntry(editingEntry.id, weightValue, viewingStudent?.id);
        
        // Update local state immediately so UI refreshes correctly for all users
        setLocalProgress(prev => prev.map(p => p.id === editingEntry.id ? { ...p, weight: weightValue } : p));
        
        handleCloseEditModal();
      } else {
        alert("Por favor, insira um valor de peso válido.");
      }
    }
  };

  const handleDeleteClick = () => {
    if (isDeleteArmed && editingEntry) {
        deleteWeightEntry(editingEntry.id, viewingStudent?.id);
        
        // Update local state immediately so UI refreshes without needing a page toggle
        setLocalProgress(prev => prev.filter(p => p.id !== editingEntry.id));
        
        handleCloseEditModal();
    } else {
        setIsDeleteArmed(true);
    }
  };

  const isYearMode = !isNaN(parseInt(timeRange)) && timeRange.length === 4;

  const renderHistoryItem = (entry: WeightEntry) => {
      const dateObj = new Date(entry.date);
      const isCurrentYear = dateObj.getFullYear() === new Date().getFullYear();
      const dateString = dateObj.toLocaleDateString('pt-BR', {
          day: 'numeric', 
          month: 'long', 
          year: isCurrentYear ? undefined : 'numeric'
      });

      const hasPhotos = entry.photo_front || entry.photo_side || entry.photo_back;

      return (
        <button 
            key={entry.id}
            onClick={() => handleOpenEditModal(entry)}
            disabled={!isOwner} 
            className={`bg-card rounded-xl p-4 flex justify-between items-center border border-main/5 w-full text-left transition-all group ${isOwner ? 'hover:bg-main/10 active:scale-95 cursor-pointer' : 'cursor-default'}`}
        >
            <div>
                <p className="font-bold text-main text-base">Registro de {dateString}</p>
                <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-sm text-muted font-medium">Peso: <span className="text-main font-bold">{entry.weight} kg</span></p>
                    {hasPhotos && (
                        <span className="text-[10px] bg-main/10 text-muted-foreground px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                            Fotos
                        </span>
                    )}
                </div>
            </div>
            {isOwner && (
                <span className="material-symbols-outlined text-muted group-hover:text-main transition-colors">chevron_right</span>
            )}
        </button>
      );
  };

  // --- PHOTOS LOGIC ---
  const sortedByDate = useMemo(() => {
      const angleKey = `photo_${compareAngle.toLowerCase()}` as keyof WeightEntry;
      return [...displayProgress]
        .filter(p => p[angleKey]) 
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [displayProgress, compareAngle]);

  const firstEntry = sortedByDate.length > 0 ? sortedByDate[0] : null;
  
  // FIX: If only 1 entry exists, it IS the last entry (Current).
  // This ensures the "Current" card is filled even if there's only 1 entry in total (Day 1)
  const lastEntry = sortedByDate.length > 0 ? sortedByDate[sortedByDate.length - 1] : null;

  const getComparisonImage = (entry: WeightEntry | null, angle: 'FRONT' | 'SIDE' | 'BACK') => {
      if (!entry) return null;
      if (angle === 'FRONT') return entry.photo_front;
      if (angle === 'SIDE') return entry.photo_side;
      if (angle === 'BACK') return entry.photo_back;
      return null;
  };

  // Function to Reset Comparison (Delete photos from first entry)
  const handleResetPhotos = async () => {
    if (!firstEntry || !isOwner) return;
    
    // Close confirmation modal
    setShowResetConfirm(false);

    try {
        const { error } = await supabase
            .from('weight_history')
            .update({ 
                photo_front: null, 
                photo_side: null, 
                photo_back: null 
            })
            .eq('id', firstEntry.id);

        if (error) throw error;

        // Refresh local state to remove photos from that entry
        setLocalProgress(prev => prev.map(p => {
            if (p.id === firstEntry.id) {
                return { ...p, photo_front: undefined, photo_side: undefined, photo_back: undefined };
            }
            return p;
        }));
    } catch (e) {
        console.error("Error resetting photos", e);
        alert("Erro ao reiniciar fotos.");
    }
  };

  // Guard clause
  if (!user && !viewingStudent) {
    return (
        <div className="flex flex-col h-full bg-background items-center justify-center">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
        </div>
    );
  }

  const ComparisonCard = ({ title, date, image, emptyText, onClick, canEdit }: { title: string, date: string, image: string | null | undefined, emptyText: string, onClick?: () => void, canEdit: boolean }) => (
      <div className="bg-surface rounded-2xl p-2 border border-main/5 flex flex-col h-full shadow-lg">
          <div className="text-center mb-3 mt-1">
              <p className="text-[10px] text-muted font-black uppercase tracking-widest leading-tight">{title}</p>
              <p className="text-main text-sm font-bold leading-tight">{date}</p>
          </div>
          <div 
            onClick={canEdit ? onClick : () => {
                if (image) setViewingImage(image);
            }} 
            className={`flex-1 rounded-xl overflow-hidden relative aspect-[3/4] flex items-center justify-center border transition-all group ${
                image 
                ? 'bg-main/5 border-main/5 cursor-zoom-in' 
                : (canEdit ? 'bg-main/5 border-dashed border-zinc-700 hover:bg-main/10 cursor-pointer' : 'bg-main/5 border-zinc-800 cursor-default')
            }`}
          >
              {image ? (
                  <>
                    <img src={image} alt={title} className="w-full h-full object-cover absolute inset-0" />
                    {/* Hover Overlay for Edit (Owner) */}
                    {canEdit && (
                        <div className="absolute inset-0 bg-main/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <span className="material-symbols-outlined text-main text-3xl">edit</span>
                        </div>
                    )}
                    
                    {/* Expand Button - For Owner to view full screen without triggering upload */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setViewingImage(image);
                        }}
                        className="absolute top-2 right-2 bg-main/10 hover:bg-background/80 text-main rounded-full p-2.5 transition-colors z-10 shadow-lg backdrop-blur-sm"
                    >
                        <span className="material-symbols-outlined text-xl">fullscreen</span>
                    </button>
                  </>
              ) : (
                  <div className="text-center p-2 flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-surface flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-2xl text-muted group-hover:text-primary transition-colors">
                            {canEdit ? 'add_a_photo' : 'image_not_supported'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted font-bold group-hover:text-main transition-colors uppercase tracking-wide">{emptyText}</p>
                  </div>
              )}
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex-none sticky top-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur-sm">
        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-base font-bold text-main truncate px-2">{pageTitle}</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 p-4 space-y-6 overflow-y-auto pb-24">
        {/* Main Tabs */}
        <div className="bg-surface p-1 rounded-xl flex border border-main/5">
          <button 
            onClick={() => setActiveTab('MEASURES')}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'MEASURES' ? 'bg-card text-main shadow-md border border-main/5' : 'text-muted hover:text-main'}`}
          >
            Medidas
          </button>
          <button 
            onClick={() => setActiveTab('PHOTOS')}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'PHOTOS' ? 'bg-card text-main shadow-md border border-main/5' : 'text-muted hover:text-main'}`}
          >
            Fotos
          </button>
        </div>

        {activeTab === 'MEASURES' ? (
            <div className="animate-in fade-in duration-300 space-y-6">
                 {/* Time Range Filter + Year Selector */}
                <div className="relative">
                    <div className="flex items-center overflow-x-auto no-scrollbar bg-surface p-1.5 rounded-full border border-main/5 mb-4 gap-3 pr-2">
                        {['1S', '1M', '3M', '6M', '1A', 'Tudo'].map(range => (
                            <button 
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${timeRange === range ? 'bg-primary text-background shadow-md' : 'text-muted hover:text-main'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-8">
                        <button 
                            onClick={() => handleYearChange(-1)} 
                            disabled={displayYear <= minYear}
                            className={`rounded-full h-8 w-8 flex items-center justify-center transition-colors ${displayYear <= minYear ? 'text-zinc-700 cursor-not-allowed' : 'text-muted hover:text-main hover:bg-main/10'}`}
                        >
                            <span className="material-symbols-outlined font-bold">chevron_left</span>
                        </button>
                        <span className={`text-xl font-black tracking-widest ${isYearMode ? 'text-main' : 'text-muted'}`}>
                            {displayYear}
                        </span>
                        <button 
                            onClick={() => handleYearChange(1)} 
                            disabled={displayYear >= maxYear}
                            className={`rounded-full h-8 w-8 flex items-center justify-center transition-colors ${displayYear >= maxYear ? 'text-zinc-700 cursor-not-allowed' : 'text-muted hover:text-main hover:bg-main/10'}`}
                        >
                            <span className="material-symbols-outlined font-bold">chevron_right</span>
                        </button>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1 bg-surface p-3 rounded-xl border border-main/5 text-center">
                        <p className="text-[10px] text-muted font-bold uppercase">Inicial</p>
                        <p className="text-xl font-bold text-main">{startWeight ? `${startWeight} kg` : '--'} </p>
                    </div>
                    <div className="flex-1 bg-surface p-3 rounded-xl border border-primary/20 text-center">
                        <p className="text-[10px] text-primary font-bold uppercase">Atual</p>
                        <p className="text-xl font-bold text-main">{currentWeight ? `${currentWeight} kg` : '--'}</p>
                    </div>
                    <div className="flex-1 bg-surface p-3 rounded-xl border border-main/5 text-center">
                        <p className="text-[10px] text-muted font-bold uppercase">Meta</p>
                        <p className="text-xl font-bold text-main">{targetWeight ? `${targetWeight} kg` : '--'}</p>
                    </div>
                </div>

                <div className="bg-surface rounded-2xl p-4 border border-main/5 shadow-sm">
                    <div className="mb-3">
                        <p className="text-muted text-[10px] font-black uppercase tracking-widest leading-none mb-1.5">Média do Período</p>
                        <div className="flex items-center gap-2">
                            <h2 className="text-3xl font-black text-main tracking-tight">{periodAverage !== null ? periodAverage : '--'} <span className="text-base text-muted font-medium">kg</span></h2>
                            {periodDiff !== null && Number(periodDiff) !== 0 && (() => {
                                const diffVal = Number(periodDiff);
                                const goalLower = (targetUser?.goal || '').toLowerCase();
                                const isGainGoal = goalLower.includes('hipertrofia') || goalLower.includes('massa') || goalLower.includes('ganhar');
                                const isPositiveChange = diffVal > 0;
                                const isGood = isGainGoal ? isPositiveChange : !isPositiveChange;

                                return (
                                    <div className={`flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded gap-0.5 ${isGood ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}`}>
                                        <span className="material-symbols-outlined text-xs">
                                            {isPositiveChange ? 'trending_up' : 'trending_down'}
                                        </span>
                                        <span>{isPositiveChange ? '+' : ''}{periodDiff} kg</span>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="h-40 w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" key={`${timeRange}-${displayProgress.length}`}>
                            <LineChart data={chartData}>
                                <defs>
                                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                                </linearGradient>
                                </defs>
                                <XAxis 
                                dataKey="displayDate" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#71717a', fontSize: 10 }} 
                                dy={10}
                                interval="preserveStartEnd"
                                minTickGap={20}
                                />
                                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                                <Tooltip 
                                contentStyle={{ backgroundColor: '#1A3824', border: 'none', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#2563EB' }}
                                cursor={{ stroke: "rgba(var(--color-main), 0.1)", strokeWidth: 2 }}
                                labelFormatter={(label, payload) => payload && payload.length > 0 ? payload[0].payload.fullDate : label}
                                />
                                <Line 
                                type="monotone" 
                                name="Peso"
                                dataKey="weight" 
                                stroke="rgb(var(--color-primary))" 
                                strokeWidth={3} 
                                dot={{ r: 4, fill: "rgb(var(--color-primary))", strokeWidth: 0 }} 
                                activeDot={{ r: 6, stroke: '#1e293b', strokeWidth: 2 }}
                                animationDuration={500}
                                />
                            </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center text-muted border-2 border-dashed border-zinc-700 rounded-xl">
                                <span className="material-symbols-outlined text-3xl mb-2">show_chart</span>
                                <p className="font-bold">Sem dados neste período</p>
                            </div>
                        )}
                    </div>
                </div>

                <section>
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h3 className="font-bold text-main">Histórico Recente ({currentRangeLabel})</h3>
                    </div>
                    <div className="space-y-3">
                        {displayList.length > 0 ? (
                            <>
                                {displayList.slice(0, 4).map(renderHistoryItem)}
                                {displayList.length > 4 && (
                                    <button 
                                        onClick={() => setShowHistoryModal(true)}
                                        className="w-full py-3 mt-2 text-primary font-bold text-sm hover:bg-primary/10 rounded-xl transition-colors border border-primary/20 hover:border-primary/40"
                                    >
                                        Ver todos os {displayList.length} registros
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-8 text-muted border-2 border-dashed border-zinc-700 rounded-xl">
                                <p>Nenhum registro encontrado.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        ) : (
            <div className="animate-in fade-in duration-300 flex flex-col h-full pt-4">
                
                <div className="space-y-6">
                    {/* Angle Toggle Text */}
                    <div className="flex justify-center gap-8 mb-2">
                        {(['FRONT', 'SIDE', 'BACK'] as const).map(angle => (
                            <button
                                key={angle}
                                onClick={() => setCompareAngle(angle)}
                                className={`text-[11px] font-black uppercase tracking-widest transition-colors py-1 relative flex flex-col items-center gap-1 ${
                                    compareAngle === angle 
                                    ? 'text-main' 
                                    : 'text-zinc-600 hover:text-muted'
                                }`}
                            >
                                {angle === 'FRONT' ? 'FRENTE' : (angle === 'SIDE' ? 'LADO' : 'COSTAS')}
                                {compareAngle === angle && (
                                    <span className="w-1 h-1 rounded-full bg-primary shadow-primary"></span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* RESTART COMPARISON BUTTON */}
                    {firstEntry && isOwner && (
                        <button 
                            onClick={() => setShowResetConfirm(true)}
                            className="mx-auto mb-4 text-[10px] font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 flex items-center gap-1 hover:bg-red-500/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[12px]">restart_alt</span>
                            Reiniciar Comparativo
                        </button>
                    )}

                    <div className="grid grid-cols-2 gap-3 h-auto">
                        <ComparisonCard 
                            title="INÍCIO" 
                            date={firstEntry ? new Date(firstEntry.date).toLocaleDateString('pt-BR') : 'Sem registo'} 
                            image={getComparisonImage(firstEntry, compareAngle)} 
                            emptyText="FOTO INICIAL"
                            onClick={() => handleUploadInitial()}
                            canEdit={isOwner}
                        />
                        <ComparisonCard 
                            title="ATUAL" 
                            date={lastEntry ? new Date(lastEntry.date).toLocaleDateString('pt-BR') : 'Hoje'} 
                            image={getComparisonImage(lastEntry, compareAngle)} 
                            emptyText="FOTO ATUAL"
                            onClick={() => handleUploadCurrent()}
                            canEdit={isOwner}
                        />
                    </div>
                    
                    {!firstEntry && !lastEntry && (
                        <div className="text-center p-6 bg-surface rounded-xl border border-dashed border-main/10 mt-4">
                            <span className="material-symbols-outlined text-4xl text-zinc-700 mb-2">compare</span>
                            <p className="text-muted text-sm font-bold">
                                {isOwner ? 'Comece seu Antes & Depois' : 'Sem fotos registradas'}
                            </p>
                            {isOwner && <p className="text-[10px] text-muted mt-1">Toque nos cartões acima para adicionar suas fotos.</p>}
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>
      
      {/* HISTORY MODAL (FULL LIST) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
           <div className="bg-background w-full max-w-sm max-h-[80vh] rounded-3xl border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-main/10 flex items-center justify-between bg-background z-10">
                  <h2 className="text-xl font-bold text-main">Histórico Completo</h2>
                  <button onClick={() => setShowHistoryModal(false)} className="text-muted hover:text-main flex items-center justify-center h-8 w-8 rounded-full hover:bg-main/10 transition-colors">
                      <span className="material-symbols-outlined">close</span>
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {displayList.map(renderHistoryItem)}
              </div>
           </div>
        </div>
      )}

      {/* ADD NEW WEIGHT MODAL */}
      {showAddModal && isOwner && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-main">
                        {targetEntryId ? 'Atualizar Fotos' : 'Novo Registo'}
                    </h3>
                    <button onClick={() => setShowAddModal(false)} className="text-muted hover:text-main">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-sm font-bold text-muted mb-2 block">Data</label>
                        <input 
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            disabled={!!targetEntryId} 
                            className={`w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-all font-bold text-center ${targetEntryId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-muted mb-2 block">Peso (kg)</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                inputMode="decimal"
                                value={newWeight}
                                onChange={(e) => {
                                    let val = e.target.value.replace(/[^0-9.,]/g, "").replace(/\./g, ",");
                                    const commaCount = (val.match(/,/g) || []).length;
                                    if (commaCount > 1) {
                                      const parts = val.split(",");
                                      val = parts[0] + "," + parts.slice(1).join("");
                                    }
                                    setNewWeight(val);
                                }}
                                disabled={isWeightReadOnly}
                                className={`w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-all font-bold text-2xl text-center ${isWeightReadOnly ? 'opacity-60 cursor-not-allowed text-muted-foreground' : ''}`}
                                autoFocus={!isWeightReadOnly}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-bold">kg</span>
                        </div>
                        {isWeightReadOnly && (
                            <div className="flex items-center justify-center gap-2 mt-3 animate-in fade-in zoom-in duration-300">
                                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[12px] text-primary font-bold">check</span>
                                </div>
                                <p className="text-xs font-bold text-primary">
                                    Peso já registrado hoje
                                </p>
                            </div>
                        )}
                    </div>
                    
                    <div className="pt-2 border-t border-main/5">
                        <p className="text-sm font-bold text-muted mb-3 block">Fotos de Progresso</p>
                        <div className="grid grid-cols-3 gap-2">
                            {/* Front Input */}
                            <div 
                                onClick={() => frontInputRef.current?.click()}
                                className="aspect-[3/4] rounded-lg border border-dashed border-zinc-400 dark:border-zinc-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all overflow-hidden relative"
                            >
                                {previews.front ? (
                                    <img src={previews.front} className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-muted">photo_camera</span>
                                        <span className="text-[10px] text-muted mt-1">Frente</span>
                                    </>
                                )}
                                <input type="file" ref={frontInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'front')} />
                            </div>

                            {/* Side Input */}
                            <div 
                                onClick={() => sideInputRef.current?.click()}
                                className="aspect-[3/4] rounded-lg border border-dashed border-zinc-400 dark:border-zinc-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all overflow-hidden relative"
                            >
                                {previews.side ? (
                                    <img src={previews.side} className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-muted">photo_camera</span>
                                        <span className="text-[10px] text-muted mt-1">Lado</span>
                                    </>
                                )}
                                <input type="file" ref={sideInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'side')} />
                            </div>

                            {/* Back Input */}
                            <div 
                                onClick={() => backInputRef.current?.click()}
                                className="aspect-[3/4] rounded-lg border border-dashed border-zinc-400 dark:border-zinc-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all overflow-hidden relative"
                            >
                                {previews.back ? (
                                    <img src={previews.back} className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-muted">photo_camera</span>
                                        <span className="text-[10px] text-muted mt-1">Costas</span>
                                    </>
                                )}
                                <input type="file" ref={backInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'back')} />
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveNewEntry}
                        disabled={!newWeight || isUploading}
                        className="w-full bg-primary text-background font-bold h-12 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isUploading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-main border-t-transparent rounded-full animate-spin"></span>
                                Enviando...
                            </>
                        ) : (targetEntryId ? 'Atualizar Fotos' : 'Salvar Registo')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {editingEntry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-main">Editar Registo</h3>
                    <button onClick={handleCloseEditModal} className="text-muted hover:text-main">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-sm font-bold text-muted mb-2 block">Peso (kg) em {new Date(editingEntry.date).toLocaleDateString('pt-BR', {day: 'numeric', month: 'long'})}</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                inputMode="decimal"
                                value={editedWeight}
                                onChange={(e) => {
                                    let val = e.target.value.replace(/[^0-9.,]/g, "").replace(/\./g, ",");
                                    const commaCount = (val.match(/,/g) || []).length;
                                    if (commaCount > 1) {
                                      const parts = val.split(",");
                                      val = parts[0] + "," + parts.slice(1).join("");
                                    }
                                    setEditedWeight(val);
                                }}
                                className="w-full bg-main/5 rounded-xl pl-4 pr-12 py-4 text-main border border-main/5 focus:border-primary outline-none transition-all font-bold text-2xl text-center"
                                autoFocus
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-bold">kg</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={handleDeleteClick}
                            className={`flex-1 font-bold h-12 rounded-xl transition-all flex items-center justify-center gap-2 ${
                                isDeleteArmed 
                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20' 
                                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">
                                {isDeleteArmed ? 'check' : 'delete'}
                            </span>
                            {isDeleteArmed ? 'Confirmar' : 'Apagar'}
                        </button>
                        <button 
                            onClick={handleUpdateWeight}
                            disabled={!editedWeight}
                            className="flex-[2] bg-primary text-background font-bold h-12 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showSuccessPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-primary/20 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                 <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <h3 className="text-xl font-bold text-main mb-2">Sucesso!</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Seu registo foi salvo com sucesso.
              </p>
              <button 
                onClick={() => setShowSuccessPopup(false)}
                className="w-full h-12 rounded-xl bg-primary text-background hover:brightness-110 font-bold transition-all shadow-lg shadow-primary/20"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* CONFIRM RESET MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-red-500/30 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
              <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500">
                 <span className="material-symbols-outlined text-3xl">restart_alt</span>
              </div>
              <h3 className="text-xl font-bold text-main mb-2">Reiniciar Comparativo?</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                 Isto removerá as fotos do registo inicial ("INÍCIO").<br/>
                 O peso registado será mantido.
              </p>
              
              <div className="flex gap-3">
                 <button 
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors"
                 >
                    Cancelar
                 </button>
                 <button 
                    onClick={handleResetPhotos}
                    className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20"
                 >
                    Sim, Reiniciar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE MODAL (LIGHTBOX) */}
      {viewingImage && (
        <div 
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={() => setViewingImage(null)}
        >
            <button 
                className="absolute top-4 right-4 text-main hover:text-muted-foreground z-10 p-2 bg-main/10 rounded-full"
                onClick={() => setViewingImage(null)}
            >
                <span className="material-symbols-outlined text-3xl">close</span>
            </button>
            <img 
                src={viewingImage} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" 
                onClick={(e) => e.stopPropagation()} 
                alt="Fullscreen Progress"
            />
        </div>
      )}
      
          </div>
  );
}
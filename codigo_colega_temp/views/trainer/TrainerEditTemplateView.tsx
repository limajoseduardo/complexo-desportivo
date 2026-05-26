import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../../contexts/AppContext";
import { supabase } from "../../lib/supabaseClient";
import { Screen, WorkoutTemplate } from "../../types";

const MUSCLE_GROUPS = [
  "Peitoral",
  "Costas",
  "Ombros",
  "Trapézio",
  "Bíceps",
  "Tríceps",
  "Antebraços",
  "Abdómen / Core",
  "Lombar",
  "Quadríceps",
  "Posterior da coxa / Isquiotibiais",
  "Glúteos",
  "Adutores",
  "Abdutores",
  "Gémeos",
  "Corpo inteiro / Compostos",
  "Cárdio",
  "Mobilidade / Alongamentos",
];

interface Props {
  onBack: () => void;
}

export default function TrainerEditTemplateView({ onBack }: Props) {
  const { user, editingTemplateId, setScreen } = useApp();
  const isDesktopAdmin = typeof window !== 'undefined' && window.location.pathname.includes('/ptadmin');
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Bank Modal State
  const [showBankModal, setShowBankModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSupersetAlert, setShowSupersetAlert] = useState(false);
  const hasShownSupersetAlert = useRef(false);
  const [bankExercises, setBankExercises] = useState<any[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("Todos");
  const [isLoadingBank, setIsLoadingBank] = useState(false);
  const [draggedExerciseIndex, setDraggedExerciseIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!editingTemplateId) {
      onBack();
      return;
    }
    loadTemplate();
  }, [editingTemplateId]);

  useEffect(() => {
    if (showBankModal || isDesktopAdmin) {
      const fetchBank = async () => {
        setIsLoadingBank(true);
        const { data } = await supabase
          .from("exercise_library")
          .select("*")
          .order("name");
        if (data) setBankExercises(data);
        setIsLoadingBank(false);
      };
      fetchBank();
      if (!isDesktopAdmin) {
        setBankSearch("");
        setBankFilter("Todos");
      }
    }
  }, [showBankModal, isDesktopAdmin]);

  const filteredBank = bankExercises.filter((ex) => {
    const matchesSearch =
      ex.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
      (ex.category &&
        ex.category.toLowerCase().includes(bankSearch.toLowerCase()));
    const matchesFilter =
      bankFilter === "Todos" ||
      ex.primary_muscle === bankFilter ||
      (bankFilter === "Cárdio" && ex.type === "CARDIO") ||
      (bankFilter === "Força" && ex.type === "STRENGTH");

    return matchesSearch && matchesFilter;
  });

  const loadTemplate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("workout_templates")
        .select("*")
        .eq("id", editingTemplateId)
        .single();

      if (error) throw error;

      let parsedData = data.data;
      if (typeof parsedData === "string") {
        try {
          parsedData = JSON.parse(parsedData);
        } catch (e) {
          console.error("Error parsing stringified template data", e);
          parsedData = { sessions: [] };
        }
      }

      if (
        !parsedData ||
        typeof parsedData !== "object" ||
        !Array.isArray(parsedData.sessions)
      ) {
        parsedData = { sessions: [] };
      }

      const safelyParsedTemplate = { ...data, data: parsedData };

      setTemplate(safelyParsedTemplate);
      if (safelyParsedTemplate.data?.sessions?.length > 0) {
        setActiveTab(safelyParsedTemplate.data.sessions[0].day_label);
      }
    } catch (e) {
      console.error("Error loading template", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("workout_templates")
        .update({ data: template.data, name: template.name })
        .eq("id", template.id);

      if (error) throw error;
      // Show success briefly
      setTimeout(() => onBack(), 500);
    } catch (e) {
      console.error("Error saving", e);
    } finally {
      setIsSaving(false);
    }
  };

  const activeSession =
    template?.data?.sessions?.find((s) => s.day_label === activeTab) ||
    template?.data?.sessions?.[0];

  const updateActiveSessionTitle = (title: string) => {
    if (!template) return;
    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab ? { ...s, title } : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
  };

  const addExercise = (
    name: string,
    type: "STRENGTH" | "CARDIO" = "STRENGTH",
    libraryId?: string,
  ) => {
    if (!template || !activeSession) return;
    const newEx = {
      name,
      type,
      sets: [{ reps: 10, weight: 0 }],
      id: crypto.randomUUID(),
      library_id: libraryId,
    };

    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab
        ? { ...s, exercises: [...(s.exercises || []), newEx] }
        : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
    setShowBankModal(false);
  };

  const addHeader = (groupName: string) => {
    if (!template || !activeSession) return;
    const newEx = {
      name: groupName,
      type: "STRENGTH" as const,
      isHeader: true,
      sets: [],
      id: crypto.randomUUID(),
    };
    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab
        ? { ...s, exercises: [...(s.exercises || []), newEx] }
        : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
    setShowGroupModal(false);
  };

  const moveExercise = (
    e: React.MouseEvent,
    index: number,
    direction: "up" | "down",
  ) => {
    e.stopPropagation();
    if (!template || !activeSession || !activeSession.exercises) return;
    const exercises = activeSession.exercises;

    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === exercises.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    const updatedExs = [...exercises];
    const [movedExercise] = updatedExs.splice(index, 1);
    updatedExs.splice(targetIndex, 0, movedExercise);

    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab ? { ...s, exercises: updatedExs } : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedExerciseIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedExerciseIndex === null || draggedExerciseIndex === targetIndex)
      return;

    if (!template || !activeSession || !activeSession.exercises) return;
    const updatedExs = [...activeSession.exercises];

    const [movedExercise] = updatedExs.splice(draggedExerciseIndex, 1);
    updatedExs.splice(targetIndex, 0, movedExercise);

    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab ? { ...s, exercises: updatedExs } : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
    setDraggedExerciseIndex(null);
  };

  const removeExercise = (exIndex: number) => {
    if (!template || !activeSession || !activeSession.exercises) return;
    const updatedExs = [...activeSession.exercises];
    updatedExs.splice(exIndex, 1);
    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab ? { ...s, exercises: updatedExs } : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
  };

  const updateExercise = (exIndex: number, updates: any) => {
    if (!template || !activeSession || !activeSession.exercises) return;
    if (updates.isSuperset === true) {
      if (!hasShownSupersetAlert.current) {
        setShowSupersetAlert(true);
        hasShownSupersetAlert.current = true;
      }
    }
    const updatedExs = [...activeSession.exercises];
    updatedExs[exIndex] = { ...updatedExs[exIndex], ...updates };
    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab ? { ...s, exercises: updatedExs } : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
  };

  const addSet = (exIndex: number) => {
    if (!template || !activeSession || !activeSession.exercises) return;
    const ex = activeSession.exercises[exIndex];
    const newSet =
      ex.sets?.length > 0
        ? { ...ex.sets[ex.sets.length - 1], weight: 0 }
        : { reps: 10, weight: 0 };

    const updatedExs = [...activeSession.exercises];
    updatedExs[exIndex] = { ...ex, sets: [...(ex.sets || []), newSet] };

    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab ? { ...s, exercises: updatedExs } : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
  };

  const updateSet = (exIndex: number, setIndex: number, updates: any) => {
    if (!template || !activeSession || !activeSession.exercises) return;
    const ex = activeSession.exercises[exIndex];
    if (!ex.sets) return;
    const updatedSets = [...ex.sets];
    updatedSets[setIndex] = { ...updatedSets[setIndex], ...updates };

    const updatedExs = [...activeSession.exercises];
    updatedExs[exIndex] = { ...ex, sets: updatedSets };

    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab ? { ...s, exercises: updatedExs } : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    if (!template || !activeSession || !activeSession.exercises) return;
    const ex = activeSession.exercises[exIndex];
    if (!ex.sets || ex.sets.length <= 1) return;
    const updatedSets = [...ex.sets];
    updatedSets.splice(setIndex, 1);

    const updatedExs = [...activeSession.exercises];
    updatedExs[exIndex] = { ...ex, sets: updatedSets };

    const newSessions = template.data.sessions.map((s) =>
      s.day_label === activeTab ? { ...s, exercises: updatedExs } : s,
    );
    setTemplate({
      ...template,
      data: { ...template.data, sessions: newSessions },
    });
  };

  if (isLoading || !template) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 w-full flex bg-background h-full overflow-hidden relative ${isDesktopAdmin ? "flex-row" : "flex-col"}`}
    >
      <div className="flex-1 flex flex-col relative overflow-hidden h-full">
        {/* Header */}
        {!isDesktopAdmin && (
          <div className="relative px-6 pt-12 pb-6 flex items-center justify-between border-b border-main/5 bg-surface z-20">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="w-10 h-10 rounded-full bg-main/5 flex items-center justify-center hover:bg-main/10 transition-colors"
              >
                <span className="material-symbols-outlined text-main">
                  arrow_back
                </span>
              </button>
              <div>
                <h1 className="text-xl font-black text-main uppercase italic truncate pr-4">
                  Base: {template.name}
                </h1>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none mt-1">
                  Editor de Templates
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="h-10 px-4 rounded-xl bg-primary text-background font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSaving ? "A guardar..." : "Guardar Base"}
            </button>
          </div>
        )}

        {isDesktopAdmin && (
          <div className="relative px-6 py-6 flex items-center justify-between border-b border-main/5 bg-surface z-20">
            <div>
              <h1 className="text-2xl font-bold text-main">
                Editar Base: {template.name}
              </h1>
              <p className="text-xs text-muted mt-1 font-bold">
                EDITOR DE TEMPLATES
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              {isSaving ? "A guardar..." : "Guardar Base"}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 py-4 border-b border-main/5 bg-surface backdrop-blur-md overflow-x-auto hide-scrollbar z-10 flex gap-2">
          {template.data.sessions?.map((session) => {
            const isActive =
              activeTab === session.day_label ||
              (!activeTab && template.data.sessions.indexOf(session) === 0);
            return (
              <button
                key={session.day_label}
                onClick={() => setActiveTab(session.day_label)}
                className={`h-12 min-w-[3rem] px-5 rounded-2xl font-black text-sm transition-all flex items-center justify-center border ${
                  isActive
                    ? "bg-primary border-primary text-background shadow-lg shadow-primary/20 scale-105"
                    : "bg-main/5 border-transparent text-muted hover:bg-main/10 hover:text-main"
                }`}
              >
                {session.day_label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto bg-background pb-32">
          {activeSession && (
            <div className="p-6">
              <input
                type="text"
                value={activeSession.title}
                onChange={(e) => updateActiveSessionTitle(e.target.value)}
                className="w-full text-2xl font-black text-main uppercase italic bg-transparent border-none outline-none mb-6 placeholder-muted"
              />

              {(!activeSession.exercises ||
                activeSession.exercises.length === 0) && (
                <div className="text-center py-12 px-6 border-2 border-dashed border-main/10 rounded-3xl">
                  <span className="material-symbols-outlined text-4xl text-muted mb-2">
                    fitness_center
                  </span>
                  <h3 className="text-lg font-black text-main uppercase italic mb-1">
                    Dia Vazio
                  </h3>
                  <p className="text-xs text-muted font-bold">
                    Adicione exercícios para construir esta rotina.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {activeSession.exercises?.map((ex, exIndex) => (
                  <div key={exIndex}>
                    {ex.isHeader ? (
                      <div className="flex items-center justify-between mt-6 first:mt-2 border-b-2 border-primary/50 pb-1">
                        <div className="flex flex-col -space-y-1 mr-2 px-1">
                          <button
                            onClick={(e) => moveExercise(e, exIndex, "up")}
                            className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                          >
                            <span className="material-symbols-outlined text-xl">
                              arrow_drop_up
                            </span>
                          </button>
                          <button
                            onClick={(e) => moveExercise(e, exIndex, "down")}
                            className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                          >
                            <span className="material-symbols-outlined text-xl">
                              arrow_drop_down
                            </span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={ex.name}
                          onChange={(e) =>
                            updateExercise(exIndex, {
                              name: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full bg-transparent text-primary font-black text-sm uppercase tracking-wider outline-none cursor-text"
                        />
                        <button
                          onClick={() => removeExercise(exIndex)}
                          className="p-1 text-muted hover:text-red-500"
                        >
                          <span className="material-symbols-outlined text-sm">
                            close
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`bg-surface rounded-xl p-4 border relative ${ex.isSuperset ? "border-orange-500/50 mb-6" : "border-main/5"}`}
                      >
                        {ex.isSuperset && (
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                            <div className="h-4 w-[2px] bg-orange-500/50"></div>
                            <div className="px-2 py-0.5 rounded-full bg-orange-500 text-[8px] font-black text-white shadow-lg shadow-orange-500/20 uppercase tracking-tighter flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px]">
                                link
                              </span>
                              Supersérie
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex flex-col -space-y-1 mr-1 shrink-0">
                            <button
                              onClick={(e) => moveExercise(e, exIndex, "up")}
                              className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                            >
                              <span className="material-symbols-outlined text-xl">
                                arrow_drop_up
                              </span>
                            </button>
                            <button
                              onClick={(e) => moveExercise(e, exIndex, "down")}
                              className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                            >
                              <span className="material-symbols-outlined text-xl">
                                arrow_drop_down
                              </span>
                            </button>
                          </div>
                          <input
                            type="text"
                            value={ex.name}
                            onChange={(e) =>
                              updateExercise(exIndex, { name: e.target.value })
                            }
                            className="flex-1 min-w-0 font-bold text-main bg-transparent outline-none truncate"
                            placeholder="Nome do Exercício"
                          />
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <button
                              onClick={() =>
                                updateExercise(exIndex, {
                                  isSuperset: !ex.isSuperset,
                                })
                              }
                              className={`h-7 px-2 flex items-center gap-1 text-[9px] font-black uppercase rounded-lg transition-all ${ex.isSuperset ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "bg-main/5 text-muted hover:bg-main/10"}`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                link
                              </span>
                              Supersérie
                            </button>
                            <button
                              onClick={() => removeExercise(exIndex)}
                              className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Apagar Exercício"
                            >
                              <span className="material-symbols-outlined text-lg">
                                delete
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {ex.sets?.map((set, setIndex) => (
                            <div
                              key={setIndex}
                              className="flex items-center gap-2"
                            >
                              <span className="w-4 text-[10px] font-bold text-muted">
                                {setIndex + 1}
                              </span>

                              <div className="flex-1 flex items-center gap-2">
                                <div className="flex-1 h-9 bg-main/5 rounded-lg flex items-center px-3 gap-2">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={set.reps || ""}
                                    onChange={(e) =>
                                      updateSet(exIndex, setIndex, {
                                        reps: e.target.value,
                                      })
                                    }
                                    className="w-full bg-transparent font-bold text-xs outline-none text-center"
                                    placeholder="0"
                                  />
                                  <span className="text-[9px] font-black text-muted uppercase tracking-tight">
                                    Reps
                                  </span>
                                </div>

                                <span className="text-muted text-[10px] font-bold">
                                  x
                                </span>

                                <div className="flex-1 h-9 bg-main/5 rounded-lg flex items-center px-3 gap-2">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={set.weight || ""}
                                    onChange={(e) =>
                                      updateSet(exIndex, setIndex, {
                                        weight: e.target.value,
                                      })
                                    }
                                    className="w-full bg-transparent font-bold text-xs outline-none text-center"
                                    placeholder="0"
                                  />
                                  <span className="text-[9px] font-black text-muted uppercase tracking-tight">
                                    Kg
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => removeSet(exIndex, setIndex)}
                                className="w-9 h-9 flex items-center justify-center text-muted hover:text-red-500 bg-main/5 rounded-lg hover:bg-red-500/10 ml-auto shrink-0 transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">
                                  remove
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => addSet(exIndex)}
                          className="w-full mt-3 h-8 border border-dashed border-main/20 rounded-lg text-[10px] font-bold text-muted uppercase flex items-center justify-center gap-1 hover:bg-main/5"
                        >
                          <span className="material-symbols-outlined text-sm">
                            add
                          </span>{" "}
                          Adicionar Série
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="h-32" />

              {/* FIXED ACTIONS */}
              {!isDesktopAdmin && (
                <div
                  className={`absolute bottom-0 left-0 right-0 pointer-events-none z-40 bg-gradient-to-t from-background via-background/80 to-transparent pt-10 pb-10 sm:pb-6`}
                >
                  <div
                    className={`max-w-md mx-auto px-4 pointer-events-auto`}
                  >
                    <div
                      className={`flex gap-3 bg-surface/90 backdrop-blur-xl p-3 rounded-[3rem] border border-main/10 shadow-2xl shadow-primary/10`}
                    >
                      <button
                        onClick={() => setShowGroupModal(true)}
                        className={`h-14 bg-main/5 border border-main/5 rounded-2xl text-main hover:bg-main/10 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex-1`}
                      >
                        <span className="material-symbols-outlined text-xl text-primary">
                          view_agenda
                        </span>
                        Grupo
                      </button>
                      <button
                        onClick={() => setShowBankModal(true)}
                        className={`h-14 bg-primary text-background rounded-2xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 whitespace-nowrap flex-[2]`}
                      >
                        <span className="material-symbols-outlined text-xl">
                          add_circle
                        </span>
                        Adicionar Exercício
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isDesktopAdmin && (
        <div className="w-[30%] min-w-[320px] max-w-sm border-l border-main/5 flex flex-col bg-surface z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
          {/* TAB HEADERS FOR SIDEBAR */}
          <div className="p-4 border-b border-main/5 flex gap-2">
            <button
              onClick={() => {
                setShowGroupModal(false);
                setShowBankModal(true);
              }}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${!showGroupModal ? "bg-primary text-background shadow-lg shadow-primary/20 scale-105" : "bg-main/5 text-muted hover:text-main"}`}
            >
              EXERCÍCIOS
            </button>
            <button
              onClick={() => {
                setShowGroupModal(true);
                setShowBankModal(false);
              }}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${showGroupModal ? "bg-primary text-background shadow-lg shadow-primary/20 scale-105" : "bg-main/5 text-muted hover:text-main"}`}
            >
              GRUPOS
            </button>
          </div>

          {/* SIDEBAR CONTENT: BANK */}
          {!showGroupModal && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-main/5 space-y-3 shrink-0">
                <div className="relative">
                  <select
                    value={bankFilter}
                    onChange={(e) => setBankFilter(e.target.value)}
                    className="w-full bg-surface text-main text-xs font-bold py-3 px-4 rounded-xl border border-main/5 focus:border-primary/50 outline-none appearance-none cursor-pointer transition-all"
                  >
                    <option value="Todos">TODOS OS GRUPOS</option>
                    {MUSCLE_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                    expand_more
                  </span>
                </div>

                <div className="bg-surface rounded-xl flex items-center px-4 h-12 border border-main/5 focus-within:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-muted mr-3">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar no banco..."
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    className="bg-transparent text-main w-full outline-none placeholder:text-zinc-600 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {isLoadingBank ? (
                  <div className="flex justify-center py-10">
                    <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                  </div>
                ) : filteredBank.length === 0 && bankSearch !== "" ? (
                  <div className="text-center py-10 text-muted">
                    <p>Nenhum exercício encontrado.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredBank.map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() =>
                          addExercise(
                            ex.name,
                            ex.type === "CARDIO" ? "CARDIO" : "STRENGTH",
                            ex.id,
                          )
                        }
                        className="w-full flex items-center justify-between p-4 hover:bg-main/5 rounded-xl border-b border-main/5 last:border-0 text-left group transition-colors"
                      >
                        <div>
                          <h3 className="font-bold text-main text-sm">
                            {ex.name}
                          </h3>
                          <div className="flex gap-2 mt-1">
                            {ex.id.toString().startsWith("default_") ? (
                              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/20">
                                CARDIO
                              </span>
                            ) : (
                              <>
                                <span className="text-[10px] bg-main/5 text-muted px-2 py-0.5 rounded border border-main/5">
                                  {ex.primary_muscle ||
                                    (ex.type === "CARDIO" ? "Cárdio" : "Força")}
                                </span>
                                <span className="text-[10px] bg-main/5 text-muted px-2 py-0.5 rounded border border-main/5">
                                  {ex.category}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-zinc-600 group-hover:text-primary transition-colors">
                          add_circle
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SIDEBAR CONTENT: GROUPS */}
          {showGroupModal && (
            <div className="flex-1 flex flex-col overflow-hidden p-6">
              <div className="grid grid-cols-2 gap-2 overflow-y-auto pb-8 custom-scrollbar pr-1">
                {MUSCLE_GROUPS.map((group) => (
                  <button
                    key={group}
                    onClick={() => addHeader(group.toUpperCase())}
                    className="py-3 px-2 bg-main/5 hover:bg-main/10 rounded-xl text-sm font-bold text-main transition-colors text-center"
                  >
                    {group.toUpperCase()}
                  </button>
                ))}
                <button
                  onClick={() => addHeader("NOVO GRUPO")}
                  className="py-3 px-2 bg-main/5 border border-dashed border-main/10 rounded-xl text-sm font-bold text-muted hover:text-main transition-all text-center"
                >
                  Outro / Vazio
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {!isDesktopAdmin && showBankModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md h-[90vh] sm:h-[80vh] sm:rounded-3xl rounded-t-3xl border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300 flex flex-col">
            <div className="p-4 border-b border-main/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-main">
                Selecionar Exercício
              </h2>
              <button
                onClick={() => setShowBankModal(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-main/5 hover:bg-main/10 text-muted hover:text-main transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-4 border-b border-main/5 space-y-3">
              <div className="relative">
                <select
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                  className="w-full bg-surface text-main text-xs font-bold py-3 px-4 rounded-xl border border-main/5 focus:border-primary/50 outline-none appearance-none cursor-pointer transition-all"
                >
                  <option value="Todos">TODOS OS GRUPOS</option>
                  {MUSCLE_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group.toUpperCase()}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                  expand_more
                </span>
              </div>

              <div className="bg-surface rounded-xl flex items-center px-4 h-12 border border-main/5 focus-within:border-primary/50 transition-colors">
                <span className="material-symbols-outlined text-muted mr-3">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Buscar no banco..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="bg-transparent text-main w-full outline-none placeholder:text-zinc-600 text-sm font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingBank ? (
                <div className="flex justify-center py-10">
                  <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                </div>
              ) : filteredBank.length === 0 && bankSearch !== "" ? (
                <div className="text-center py-10 text-muted">
                  <p>Nenhum exercício encontrado.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredBank.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() =>
                        addExercise(
                          ex.name,
                          ex.type === "CARDIO" ? "CARDIO" : "STRENGTH",
                          ex.id,
                        )
                      }
                      className="w-full flex items-center justify-between p-4 hover:bg-main/5 rounded-xl border-b border-main/5 last:border-0 text-left group transition-colors"
                    >
                      <div>
                        <h3 className="font-bold text-main text-sm">
                          {ex.name}
                        </h3>
                        <div className="flex gap-2 mt-1">
                          {ex.id.toString().startsWith("default_") ? (
                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/20">
                              CARDIO
                            </span>
                          ) : (
                            <>
                              <span className="text-[10px] bg-main/5 text-muted px-2 py-0.5 rounded border border-main/5">
                                {ex.primary_muscle ||
                                  (ex.type === "CARDIO" ? "Cárdio" : "Força")}
                              </span>
                              <span className="text-[10px] bg-main/5 text-muted px-2 py-0.5 rounded border border-main/5">
                                {ex.category}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-zinc-600 group-hover:text-primary transition-colors">
                        add_circle
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!isDesktopAdmin && showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm sm:rounded-3xl rounded-t-3xl border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-main">Adicionar Grupo</h3>
              <button
                onClick={() => setShowGroupModal(false)}
                className="text-muted hover:text-main"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {MUSCLE_GROUPS.map((group) => (
                <button
                  key={group}
                  onClick={() => addHeader(group.toUpperCase())}
                  className="py-3 px-2 bg-surface hover:bg-main/5 border border-main/5 rounded-xl text-sm font-bold text-muted-foreground hover:text-main hover:border-primary/50 transition-all text-center"
                >
                  {group.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSupersetAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSupersetAlert(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-surface rounded-[24px] border border-main/10 shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="mx-auto w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-orange-500">
                  link
                </span>
              </div>
              <h3 className="text-xl font-black text-main uppercase tracking-tight mb-2">
                Supersérie Activada
              </h3>
              <p className="text-muted text-sm leading-relaxed mb-6">
                Uma supersérie precisa ter pelo menos <strong>dois exercícios conectados</strong>.
                <br /><br />
                Certifique-se de que o próximo exercício está logo abaixo deste na lista e as suas repetições foram configuradas correctamente.
              </p>
              <button
                onClick={() => setShowSupersetAlert(false)}
                className="w-full h-12 bg-primary text-background font-black uppercase text-sm rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

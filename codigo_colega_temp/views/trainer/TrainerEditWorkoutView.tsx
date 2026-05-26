import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../../contexts/AppContext";
import { supabase } from "../../lib/supabaseClient";
import { Screen, WorkoutTemplate } from "../../types";

interface Props {
  onBack: () => void;
  initialWorkoutId?: string | null;
}

interface EditableSet {
  id: string;
  reps: string;
  weight: string;
  time?: string;
  intensity?: string;
}

interface EditableExercise {
  id: string;
  name: string;
  type?: "STRENGTH" | "CARDIO";
  sets: EditableSet[];
  isHeader: boolean;
  notes?: string;
  restTime?: string;
  order_index?: number;
  isSuperset?: boolean;
  trackingMode?: "reps" | "seconds";
  parent_exercise_id?: string;
  alternatives?: EditableExercise[];
}

const TABS = ["A", "B", "C", "D", "E", "F"];

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

const DEFAULT_CARDIO = [
  { name: "Bicicleta", muscle: "Cárdio" },
  { name: "Elíptico", muscle: "Cárdio" },
  { name: "Passadeira", muscle: "Cárdio" },
];

export default function TrainerEditWorkoutView({ onBack, initialWorkoutId }: Props) {
  const { viewingStudent, user, setScreen, sendPushNotification, resolveWorkoutChangeRequest } = useApp();
  const isDesktopAdmin = typeof window !== 'undefined' && window.location.pathname.includes('/ptadmin');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSupersetAlert, setShowSupersetAlert] = useState(false);
  const hasShownSupersetAlert = useRef(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null); // State for item deletion
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Autosave State
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveStatus === 'saved' && viewingStudent?.id) {
      resolveWorkoutChangeRequest(viewingStudent.id);
    }
  }, [saveStatus, viewingStudent?.id]);

  // Tab State
  const [activeTab, setActiveTab] = useState("A");
  const [studentWorkouts, setStudentWorkouts] = useState<any[]>([]); // List of all workouts for this student

  // Plan Settings State
  const [planName, setPlanName] = useState<string>("");
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"IDLE" | "CONFIRM">("IDLE");

  // Student Settings State
  const [studentRestDays, setStudentRestDays] = useState<number[]>([]);
  const [studentFrequency, setStudentFrequency] = useState<number>(3);

  // Active Workout State
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [workoutTitle, setWorkoutTitle] = useState("A carregar...");
  const [plannedDuration, setPlannedDuration] = useState<number>(50);
  const [exercises, setExercises] = useState<EditableExercise[]>([]);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const [draggedExerciseId, setDraggedExerciseId] = useState<string | null>(
    null,
  );
  const [canDrag, setCanDrag] = useState(false);
  const [addingAlternativeToId, setAddingAlternativeToId] = useState<
    string | null
  >(null);

  // Bank Modal State
  const [showBankModal, setShowBankModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false); // New state for group selection
  const [bankExercises, setBankExercises] = useState<any[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("Todos"); // NEW FILTER STATE
  const [isLoadingBank, setIsLoadingBank] = useState(false);

  // Avatar State
  const [studentAvatar, setStudentAvatar] = useState(() => {
    const name = viewingStudent?.name || "User";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=13ec5b&color=102216`;
  });

  // New state for set deletion confirmation
  const [setToDelete, setSetToDelete] = useState<{
    exerciseId: string;
    setId: string;
  } | null>(null);

  // 1. Initial Load of ALL Workouts for Student
  useEffect(() => {
    const init = async () => {
      if (!viewingStudent?.id) return;
      setIsLoading(true);

      // Load Profile Data
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar, rest_days, training_frequency")
        .eq("id", viewingStudent.id)
        .single();
      if (profile?.avatar) setStudentAvatar(profile.avatar);
      if (profile?.rest_days) setStudentRestDays(profile.rest_days);
      if (profile?.training_frequency)
        setStudentFrequency(profile.training_frequency);

      // If initialWorkoutId is provided, we need to find its tab first
      let targetTab = activeTab;
      if (initialWorkoutId) {
          const { data: w } = await supabase.from('workouts').select('day_label').eq('id', initialWorkoutId).single();
          if (w?.day_label) {
              targetTab = w.day_label;
              setActiveTab(targetTab);
          }
      }

      await fetchAllWorkouts(targetTab);
      setIsLoading(false);
    };
    init();
  }, [viewingStudent, initialWorkoutId]);

  // Reset delete step when closing modal
  useEffect(() => {
    if (!showPlanSettings) {
      setDeleteStep("IDLE");
    }
  }, [showPlanSettings]);

  // Fetch all workouts
  const fetchAllWorkouts = async (overrideTab?: string) => {
    try {
      const currentTab = overrideTab || activeTab;
      // Fetch description too as it holds the Plan Name
      const { data, error } = await supabase
        .from("workouts")
        .select(
          "id, title, description, created_at, day_label, planned_duration",
        )
        .eq("assigned_student_id", viewingStudent?.id)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      setStudentWorkouts(data || []);

      // Extract Plan Name from the first workout (if exists)
      if (data && data.length > 0 && data[0].description) {
        setPlanName(data[0].description);
      } else {
        setPlanName("");
      }

      // Find workout for current active tab (by label OR by legacy index fallback)
      const existingWorkout = data?.find((w: any) => w.day_label === currentTab);

      if (existingWorkout) {
        setWorkoutId(existingWorkout.id);
        setWorkoutTitle(existingWorkout.title);
        setPlannedDuration(existingWorkout.planned_duration || 50);
        await loadExercises(existingWorkout.id);
      } else {
        setWorkoutId(null);
        setWorkoutTitle("");
        setPlannedDuration(50);
        setExercises([]);
      }
    } catch (e) {
      console.error("Error fetching workouts:", e);
    }
  };

  const createWorkoutForTab = async (tabLabel: string) => {
    if (!viewingStudent?.id || !user?.id) return;
    setIsLoading(true);

    const newId = crypto.randomUUID();
    const title = `Treino ${tabLabel}`;

    try {
      const { error } = await supabase.from("workouts").insert({
        id: newId,
        title: title,
        description: planName, // Inherit current plan name
        trainer_id: user.id,
        assigned_student_id: viewingStudent.id,
        day_label: tabLabel, // Explicitly link to this tab
        created_at: new Date().toISOString(),
      });

      if (!error) {
        setWorkoutId(newId);
        setWorkoutTitle(title);
        setExercises([]);

        // Notify Student
        const pushTitle = "Novo Treino";
        const pushMessage = `O teu treinador adicionou um novo treino ${tabLabel}.`;

        await supabase.from("notifications").insert({
          user_id: viewingStudent.id,
          title: pushTitle,
          message: pushMessage,
          type: "INFO",
        });

        sendPushNotification(viewingStudent.id, pushTitle, pushMessage);

        // Refresh master list
        const { data } = await supabase
          .from("workouts")
          .select("id, title, description, created_at, day_label")
          .eq("assigned_student_id", viewingStudent.id)
          .order("created_at", { ascending: true });
        setStudentWorkouts(data || []);
      }
    } catch (e) {
      console.error("Error creating workout", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = async (tab: string) => {
    setActiveTab(tab);
    setIsLoading(true);

    // Look for workout specifically assigned to this Day Label
    const w = studentWorkouts.find((w) => w.day_label === tab);

    if (w) {
      setWorkoutId(w.id);
      setWorkoutTitle(w.title);
      setPlannedDuration(w.planned_duration || 50);
      await loadExercises(w.id);
    } else {
      setWorkoutId(null);
      setWorkoutTitle("");
      setPlannedDuration(50);
      setExercises([]);
    }
    setIsLoading(false);
  };

  const loadExercises = async (wId: string) => {
    const { data: exs, error } = await supabase
      .from("workout_exercises")
      .select("*, workout_sets(*, created_at)")
      .eq("workout_id", wId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true })
      .order("created_at", { foreignTable: "workout_sets", ascending: true });

    if (error) {
      console.error("Error loading exercises", error);
      return;
    }

    if (exs) {
      const allExercises: EditableExercise[] = exs.map((ex: any) => {
        let trackingMode: "reps" | "seconds" = "reps";
        let cleanNotes = ex.notes || "";
        if (cleanNotes.includes("[TIME_BASED]")) {
          trackingMode = "seconds";
          cleanNotes = cleanNotes.replace("[TIME_BASED]", "").trim();
        } else if (cleanNotes.includes("[REPS_BASED]")) {
          trackingMode = "reps";
          cleanNotes = cleanNotes.replace("[REPS_BASED]", "").trim();
        } else if (ex.name?.toLowerCase().includes("prancha")) {
          trackingMode = "seconds";
        }

        return {
          id: ex.id,
          name: ex.name,
          type: ex.type || "STRENGTH",
          isHeader: ex.is_header || false,
          notes: cleanNotes,
          restTime: ex.rest_time || "",
          isSuperset: ex.is_superset || false,
          order_index: ex.order_index || 0,
          trackingMode,
          parent_exercise_id: ex.parent_exercise_id,
          sets: (ex.workout_sets || []).map((s: any) => ({
            id: s.id,
            reps: s.reps?.toString() || "",
            weight: "0",
            time: s.time || "",
            intensity: s.intensity?.toString() || "",
          })),
        };
      });

      // Keep exercises flat in state to allow standard editing logic
      const mapped = allExercises;

      let needsUpdate = false;
      const orderedMapped = mapped.map((ex, index) => {
        if (!ex.order_index) {
          needsUpdate = true;
          return { ...ex, order_index: (index + 1) * 10000 };
        }
        return ex;
      });

      if (needsUpdate) {
        Promise.all(
          orderedMapped.map((ex) =>
            supabase
              .from("workout_exercises")
              .update({ order_index: ex.order_index })
              .eq("id", ex.id),
          ),
        ).catch(console.error);
      }

      orderedMapped.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setExercises(orderedMapped);
    } else {
      setExercises([]);
    }
  };

  // 2. Autosave Logic for Title & Duration
  const handleTitleChange = (newTitle: string) => {
    setWorkoutTitle(newTitle);
    setSaveStatus("saving");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!workoutId) return;
      try {
        await supabase
          .from("workouts")
          .update({ title: newTitle })
          .eq("id", workoutId);
        setSaveStatus("saved");
        setStudentWorkouts((prev) =>
          prev.map((w) => (w.id === workoutId ? { ...w, title: newTitle } : w)),
        );
      } catch (e) {
        setSaveStatus("error");
      }
    }, 1000);
  };

  const handleDurationChange = (newDuration: string) => {
    const val = parseInt(newDuration) || 0;
    setPlannedDuration(val);
    setSaveStatus("saving");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!workoutId) return;
      try {
        await supabase
          .from("workouts")
          .update({ planned_duration: val })
          .eq("id", workoutId);
        setSaveStatus("saved");
        // Update local ref to studentWorkouts if needed (optional as it's not often displayed in list)
        setStudentWorkouts((prev) =>
          prev.map((w) =>
            w.id === workoutId ? { ...w, planned_duration: val } : w,
          ),
        );
      } catch (e) {
        setSaveStatus("error");
      }
    }, 1000);
  };

  // 3. Plan Name & Delete Logic
  const handleSavePlanSettings = async () => {
    if (!viewingStudent?.id) return;
    setIsUpdatingPlan(true);
    try {
      // Update all workouts for this student with the new plan name (description)
      await supabase
        .from("workouts")
        .update({ description: planName })
        .eq("assigned_student_id", viewingStudent.id);

      // Update student profile with rest days and frequency
      await supabase
        .from("profiles")
        .update({
          rest_days: studentRestDays,
          training_frequency: studentFrequency,
        })
        .eq("id", viewingStudent.id);

      setShowPlanSettings(false);
      alert("Definições do aluno e plano atualizadas!");

      // Notify Student
      const pushTitle = "Plano Atualizado";
      const pushMessage = `O teu personal atualizou as definições do teu plano de treino.`;

      await supabase.from("notifications").insert({
        user_id: viewingStudent.id,
        title: pushTitle,
        message: pushMessage,
        type: "INFO",
      });

      sendPushNotification(viewingStudent.id, pushTitle, pushMessage);
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar definições.");
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const performDeletePlan = async () => {
    if (!viewingStudent?.id) return;

    setIsUpdatingPlan(true);
    try {
      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("assigned_student_id", viewingStudent.id);

      if (error) throw error;

      setScreen(Screen.TRAINER_STUDENT_DETAIL);
    } catch (e: any) {
      console.error("Delete Error:", e);
      alert("Erro ao excluir plano: " + e.message);
      setIsUpdatingPlan(false);
    }
  };

  // 4. Immediate Actions (Add/Remove)
  const addExercise = async (
    name: string = "Novo Exercício",
    type: "STRENGTH" | "CARDIO" = "STRENGTH",
    libraryId?: string,
  ) => {
    if (!workoutId) return;
    setSaveStatus("saving");

    const parentId = addingAlternativeToId;

    const maxOrder =
      exercises.length > 0
        ? Math.max(...exercises.map((e) => e.order_index || 0))
        : 0;
    const newOrderIndex = maxOrder + 10000;

    const tempId = `temp_${Date.now()}`;
    const defaultRestTime = type === "STRENGTH" ? "60s" : "";
    const newEx: EditableExercise = {
      id: tempId,
      name,
      type,
      sets: [],
      isHeader: false,
      notes: "",
      restTime: defaultRestTime,
      order_index: newOrderIndex,
      parent_exercise_id: parentId || undefined,
    };

    if (parentId) {
      const parentIdx = exercises.findIndex((ex) => ex.id === parentId);
      if (parentIdx !== -1) {
        const newExercisesList = [...exercises];
        newExercisesList.splice(parentIdx + 1, 0, newEx);
        setExercises(newExercisesList);
      } else {
        setExercises((prev) => [...prev, newEx]);
      }
    } else {
      setExercises((prev) => [...prev, newEx]);
    }

    setShowBankModal(false);
    setAddingAlternativeToId(null);

    const validLibraryId =
      libraryId && !libraryId.startsWith("default_") ? libraryId : null;

    try {
      const { data: exData, error: exError } = await supabase
        .from("workout_exercises")
        .insert({
          workout_id: workoutId,
          name,
          type,
          exercise_library_id: validLibraryId,
          is_header: false,
          rest_time: defaultRestTime,
          order_index: newOrderIndex,
          parent_exercise_id: parentId,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (exError) throw exError;
      const newExerciseId = exData.id;

      const setsPayload = Array.from({ length: 3 }).map(() => ({
        exercise_id: newExerciseId,
        reps: type === "CARDIO" ? null : 10,
        weight: type === "CARDIO" ? null : 0,
        time: type === "CARDIO" ? "10:00" : null,
        intensity: type === "CARDIO" ? 3 : null,
        created_at: new Date().toISOString(),
      }));

      const { data: setsData, error: setsError } = await supabase
        .from("workout_sets")
        .insert(setsPayload)
        .select();

      if (setsError) throw setsError;

      const newSets: EditableSet[] = setsData.map((s) => ({
        id: s.id,
        reps: s.reps?.toString() || "",
        weight: s.weight?.toString() || "",
        time: s.time || "",
        intensity: s.intensity?.toString() || "",
      }));

      setExercises((prev) =>
        prev.map((ex) =>
          ex.id === tempId ? { ...ex, id: newExerciseId, sets: newSets } : ex,
        ),
      );

      // ADDED NOTIFICATION
      if (viewingStudent?.id) {
        const pushTitle = "Treino Atualizado";
        const pushMessage = `Novo exercício adicionado ao Treino ${activeTab}: ${name}`;

        await supabase.from("notifications").insert({
          user_id: viewingStudent.id,
          title: pushTitle,
          message: pushMessage,
          type: "INFO",
        });

        sendPushNotification(viewingStudent.id, pushTitle, pushMessage);
      }

      setSaveStatus("saved");
    } catch (e: any) {
      console.error("Error adding exercise", e);
      setSaveStatus("error");
      setExercises((prev) => prev.filter((e) => e.id !== tempId));
      alert(`Erro ao adicionar exercício: ${e.message || JSON.stringify(e)}`);
    }
  };

  const addHeader = async (name: string = "NOVO GRUPO") => {
    if (!workoutId) return;
    setSaveStatus("saving");
    setShowGroupModal(false);

    const maxOrder =
      exercises.length > 0
        ? Math.max(...exercises.map((e) => e.order_index || 0))
        : 0;
    const newOrderIndex = maxOrder + 10000;

    const tempId = `temp_${Date.now()}`;
    const newEx: EditableExercise = {
      id: tempId,
      name,
      sets: [],
      isHeader: true,
      order_index: newOrderIndex,
    };
    setExercises((prev) => [...prev, newEx]);

    try {
      const { data: exData, error: exError } = await supabase
        .from("workout_exercises")
        .insert({
          workout_id: workoutId,
          name: name,
          is_header: true,
          order_index: newOrderIndex,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (exError) throw exError;
      if (!exData) throw new Error("Insert returned no data");

      setExercises((prev) =>
        prev.map((e) => (e.id === tempId ? { ...e, id: exData.id } : e)),
      );

      // ADDED NOTIFICATION
      if (viewingStudent?.id) {
        const pushTitle = "Treino Atualizado";
        const pushMessage = `Novo grupo muscular adicionado ao Treino ${activeTab}: ${name}`;

        await supabase.from("notifications").insert({
          user_id: viewingStudent.id,
          title: pushTitle,
          message: pushMessage,
          type: "INFO",
        });

        sendPushNotification(viewingStudent.id, pushTitle, pushMessage);
      }

      setSaveStatus("saved");
    } catch (e: any) {
      console.error("Error adding header", e);
      setSaveStatus("error");
      setExercises((prev) => prev.filter((e) => e.id !== tempId));
      alert(`Erro ao adicionar grupo: ${e?.message}`);
    }
  };

  const handleDragStart = (e: React.DragEvent, exerciseId: string) => {
    setDraggedExerciseId(exerciseId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const moveExercise = async (
    e: React.MouseEvent,
    exerciseId: string,
    direction: "up" | "down",
  ) => {
    e.stopPropagation();
    const index = exercises.findIndex((ex) => ex.id === exerciseId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === exercises.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    const newExercises = [...exercises];
    const [movedExercise] = newExercises.splice(index, 1);
    newExercises.splice(targetIndex, 0, movedExercise);

    const updatedExercises = newExercises.map((ex, idx) => ({
      ...ex,
      order_index: (idx + 1) * 10000,
    }));

    setExercises(updatedExercises);

    try {
      await Promise.all(
        updatedExercises.map((ex) =>
          supabase
            .from("workout_exercises")
            .update({ order_index: ex.order_index })
            .eq("id", ex.id),
        ),
      );
    } catch (err) {
      console.error("Failed to reorder", err);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetExerciseId: string) => {
    e.preventDefault();
    if (!draggedExerciseId || draggedExerciseId === targetExerciseId) return;

    const draggedIndex = exercises.findIndex(
      (ex) => ex.id === draggedExerciseId,
    );
    const targetIndex = exercises.findIndex((ex) => ex.id === targetExerciseId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newExercises = [...exercises];
    const [movedExercise] = newExercises.splice(draggedIndex, 1);
    newExercises.splice(targetIndex, 0, movedExercise);

    const updatedExercises = newExercises.map((ex, index) => ({
      ...ex,
      order_index: (index + 1) * 10000,
    }));

    setExercises(updatedExercises);
    setDraggedExerciseId(null);

    try {
      await Promise.all(
        updatedExercises.map((ex) =>
          supabase
            .from("workout_exercises")
            .update({ order_index: ex.order_index })
            .eq("id", ex.id),
        ),
      );
    } catch (err) {
      console.error("Failed to reorder", err);
    }
  };

  const confirmRemoveItem = async () => {
    if (!exerciseToDelete) return;
    const id = exerciseToDelete;

    const previousExercises = [...exercises];

    // Remove the exercise and all its alternatives from state
    setExercises((prev) =>
      prev.filter((ex) => ex.id !== id && ex.parent_exercise_id !== id),
    );
    setSaveStatus("saving");

    try {
      // Delete the main exercise (Supabase should ideally cascade to alternatives if set up, but we'll be explicit if needed)
      const { error } = await supabase
        .from("workout_exercises")
        .delete()
        .eq("id", id);
      if (error) throw error;

      // Also delete alternatives just in case no cascade
      await supabase
        .from("workout_exercises")
        .delete()
        .eq("parent_exercise_id", id);

      setSaveStatus("saved");
    } catch (e) {
      console.error("Error deleting", e);
      setSaveStatus("error");
      setExercises(previousExercises);
    }
    setExerciseToDelete(null);
  };

  const handleSaveAsTemplateClick = () => {
    setNewTemplateName(planName || "Novo Template");
    setShowSaveTemplateModal(true);
  };

  const saveAsTemplate = async () => {
    if (!user || !viewingStudent || !newTemplateName.trim()) return;

    setIsSavingTemplate(true);
    setSaveStatus("saving");
    try {
      // 1. Buscar todos os treinos deste aluno no plano atual
      const { data: ws, error: wErr } = await supabase
        .from("workouts")
        .select("*, workout_exercises(*, workout_sets(*))")
        .eq("assigned_student_id", viewingStudent.id);

      if (wErr) throw wErr;
      if (!ws || ws.length === 0) {
        alert("Não há treinos para guardar como base.");
        setShowSaveTemplateModal(false);
        return;
      }

      // 2. Mapear para o formato do Template
      const templateData = {
        sessions: ws.map((w: any) => ({
          day_label: w.day_label,
          title: w.title,
          exercises: (w.workout_exercises || [])
            .sort(
              (a: any, b: any) => (a.order_index || 0) - (b.order_index || 0),
            )
            .map((ex: any) => ({
              name: ex.name,
              type: ex.type || "STRENGTH",
              isHeader: ex.is_header || false,
              isSuperset: ex.is_superset || false,
              notes: ex.notes || "",
              restTime: ex.rest_time || "",
              sets: (ex.workout_sets || [])
                .sort(
                  (a: any, b: any) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime(),
                )
                .map((s: any) => ({
                  reps: s.reps,
                  weight: 0,
                  time: s.time,
                  intensity: s.intensity,
                })),
            })),
        })),
      };

      // 3. Inserir na tabela de templates
      const { error: tErr } = await supabase.from("workout_templates").insert({
        id: crypto.randomUUID(),
        trainer_id: user.id,
        name: newTemplateName,
        split_count: ws.length,
        data: templateData,
        created_at: new Date().toISOString(),
      });

      if (tErr) throw tErr;

      setSaveStatus("saved");
      setShowSaveTemplateModal(false);
      setTimeout(
        () => alert("✅ Plano guardado com sucesso na sua Base de Treinos!"),
        100,
      );
    } catch (e: any) {
      console.error("Erro ao guardar base", e);
      setSaveStatus("error");
      alert("Erro ao guardar: " + e.message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const updateExerciseField = (
    id: string,
    field:
      | "name"
      | "notes"
      | "type"
      | "isSuperset"
      | "restTime"
      | "trackingMode",
    value: any,
  ) => {
    if (field === "isSuperset" && value === true) {
      if (!hasShownSupersetAlert.current) {
        setShowSupersetAlert(true);
        hasShownSupersetAlert.current = true;
      }
    }
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)),
    );
    setSaveStatus("saving");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const exercise = exercises.find((e) => e.id === id);
        if (!exercise) return;

        let finalPayload: any = {};

        if (field === "isSuperset") {
          finalPayload.is_superset = value;
        } else if (field === "restTime") {
          finalPayload.rest_time = value;
        } else if (
          field === "trackingMode" ||
          field === "notes" ||
          (field === "name" && exercise.trackingMode)
        ) {
          // We need to re-construct notes with the marker if it's seconds
          const currentEx = exercises.find((e) => e.id === id);
          const mode =
            field === "trackingMode"
              ? value
              : currentEx?.trackingMode || "reps";
          const noteText = field === "notes" ? value : currentEx?.notes || "";

          const exName = (
            field === "name" ? value : currentEx?.name || ""
          ).toLowerCase();
          if (mode === "seconds") {
            finalPayload.notes = `[TIME_BASED] ${noteText}`.trim();
          } else {
            if (exName.includes("prancha")) {
              finalPayload.notes = `[REPS_BASED] ${noteText}`.trim();
            } else {
              finalPayload.notes = noteText;
            }
          }
          if (field === "name") finalPayload.name = value;
        } else {
          finalPayload[field] = value;
        }

        await supabase
          .from("workout_exercises")
          .update(finalPayload)
          .eq("id", id);
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus("error");
      }
    }, 1000);
  };

  const handleSetChange = (
    exerciseId: string,
    setId: string,
    field: "reps" | "weight" | "time" | "intensity",
    value: string,
  ) => {
    let allowedValue = value;
    if (field === "weight" || field === "reps" || field === "intensity") {
      allowedValue = value.replace(/[^0-9.,]/g, "");
      allowedValue = allowedValue.replace(/\./g, ",");
      const commaCount = (allowedValue.match(/,/g) || []).length;
      if (commaCount > 1) {
        const parts = allowedValue.split(",");
        allowedValue = parts[0] + "," + parts.slice(1).join("");
      }
    }

    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s) =>
                s.id === setId ? { ...s, [field]: allowedValue } : s,
              ),
            }
          : ex,
      ),
    );
    setSaveStatus("saving");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const updates: any = {};
      if (field === "reps")
        updates.reps = allowedValue === "" ? null : parseInt(allowedValue) || 0;
      else if (field === "weight")
        updates.weight =
          allowedValue === ""
            ? null
            : parseFloat(allowedValue.replace(",", ".")) || 0;
      else if (field === "time")
        updates.time = allowedValue === "" ? null : allowedValue;
      else if (field === "intensity") {
        updates.intensity =
          allowedValue === ""
            ? null
            : Math.min(5, Math.max(0, parseInt(allowedValue) || 0));
      }

      try {
        await supabase.from("workout_sets").update(updates).eq("id", setId);
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus("error");
      }
    }, 1000);
  };

  const addSet = async (exerciseId: string) => {
    if (exerciseId.startsWith("temp_")) {
      alert("Aguarde o exercício ser salvo antes de adicionar séries.");
      return;
    }
    setSaveStatus("saving");

    const exercise = exercises.find((e) => e.id === exerciseId);
    const isCardio = exercise?.type === "CARDIO";
    const lastSet = exercise?.sets[exercise.sets.length - 1];

    const payload: any = {
      exercise_id: exerciseId,
      created_at: new Date().toISOString(),
    };

    if (isCardio) {
      payload.time = lastSet?.time || "10:00";
      payload.intensity = lastSet?.intensity ? parseInt(lastSet.intensity) : 3;
    } else {
      payload.reps = lastSet ? parseInt(lastSet.reps) || 12 : 12;
      payload.weight = 0;
    }

    try {
      const { data: newSetData, error } = await supabase
        .from("workout_sets")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      const newSet: EditableSet = {
        id: newSetData.id,
        reps: newSetData.reps?.toString() || "",
        weight: newSetData.weight?.toString() || "",
        time: newSetData.time || "",
        intensity: newSetData.intensity?.toString() || "",
      };

      setExercises((prev) =>
        prev.map((ex) =>
          ex.id === exerciseId ? { ...ex, sets: [...ex.sets, newSet] } : ex,
        ),
      );
      setSaveStatus("saved");
    } catch (e) {
      setSaveStatus("error");
      console.error("Error adding set", e);
    }
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setSetToDelete({ exerciseId, setId });
  };

  const confirmRemoveSet = async () => {
    if (!setToDelete) return;
    const { exerciseId, setId } = setToDelete;

    const originalExercises = JSON.parse(JSON.stringify(exercises));
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
          : ex,
      ),
    );
    setSaveStatus("saving");
    setSetToDelete(null); // Close modal immediately

    try {
      const { error } = await supabase
        .from("workout_sets")
        .delete()
        .eq("id", setId);
      if (error) throw error;
      setSaveStatus("saved");
    } catch (e) {
      setSaveStatus("error");
      setExercises(originalExercises); // Revert on error
      console.error("Error removing set", e);
    }
  };

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

  const confirmDeleteWorkout = async () => {
    if (!workoutId) return;
    setIsDeleting(true);
    try {
      // Verify if it is completed to prevent deleting historical data
      const workoutToDelete = studentWorkouts.find((w) => w.id === workoutId);

      if (workoutToDelete?.completed) {
        const { error } = await supabase
          .from("workouts")
          .update({ day_label: "ARCHIVED_" + Date.now() })
          .eq("id", workoutId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workouts")
          .delete()
          .eq("id", workoutId);
        if (error) throw error;
      }

      setStudentWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
      setWorkoutId(null);
      setWorkoutTitle("");
      setExercises([]);
      setShowDeleteConfirm(false);
    } catch (e: any) {
      console.error("Erro ao excluir", e);
      alert("Erro ao excluir: " + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBank = useMemo(() => {
    const normalizeText = (text: string) =>
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    // 1. Start with database exercises
    let base = [...bankExercises];

    // 2. Add default cardio if applicable (and not already in DB to avoid dupes)
    if (bankFilter === "Todos" || bankFilter === "Cárdio") {
      DEFAULT_CARDIO.forEach((d) => {
        if (
          !base.some((ex) => ex.name.toLowerCase() === d.name.toLowerCase())
        ) {
          base.push({
            id: `default_${d.name}`,
            name: d.name,
            type: "CARDIO",
            primary_muscle: "Cárdio",
            category: "Padrão",
          });
        }
      });
    }

    const searchNormalized = normalizeText(bankSearch);
    const filterNormalized = normalizeText(bankFilter);

    // 3. Filter by search and category
    return base
      .filter((ex) => {
        const nameNormalized = normalizeText(ex.name);
        const matchesSearch = nameNormalized.includes(searchNormalized);

        const primaryMuscleNormalized = normalizeText(ex.primary_muscle || "");
        const secondaryMuscleNormalized = normalizeText(
          ex.secondary_muscle || "",
        );

        const matchesFilter =
          bankFilter === "Todos"
            ? true
            : primaryMuscleNormalized.includes(filterNormalized) ||
              secondaryMuscleNormalized.includes(filterNormalized);

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bankExercises, bankSearch, bankFilter]);

  const StatusBadge = () => {
    if (saveStatus === "saving")
      return (
        <div className="flex items-center gap-1 text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded-full animate-pulse">
          <span className="w-2 h-2 rounded-full bg-primary"></span>A guardar...
        </div>
      );
    if (saveStatus === "error")
      return (
        <div className="flex items-center gap-1 text-red-500 text-xs font-bold bg-red-500/10 px-2 py-1 rounded-full">
          <span className="material-symbols-outlined text-xs">error</span>
          Erro ao salvar
        </div>
      );
    return null;
  };

  // Find item to delete to show in modal
  const itemBeingDeleted = exercises.find((e) => e.id === exerciseToDelete);

  return (
    <div
      className={`flex w-full h-full bg-background relative overflow-hidden ${isDesktopAdmin ? "flex-row" : "flex-col pb-8"}`}
    >
      <div className="flex-1 flex flex-col relative overflow-hidden h-full">
        {!isDesktopAdmin && (
          <header className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={onBack}
                  className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main"
                >
                  <span className="material-symbols-outlined">
                    arrow_back_ios_new
                  </span>
                </button>
                <div>
                  <h1 className="text-lg font-bold text-main leading-none">
                    {planName || "Editar Plano"}
                  </h1>
                  <p className="text-[10px] text-muted mt-1">
                    {studentWorkouts.length > 0
                      ? `${studentWorkouts.length} Dias`
                      : "Novo Plano"}{" "}
                    / Split
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {workoutId && <StatusBadge />}
                <button
                  onClick={() => setShowPlanSettings(true)}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-main/5 hover:bg-main/10 text-muted-foreground hover:text-main transition-colors"
                  title="Configurações do Plano"
                >
                  <span className="material-symbols-outlined">settings</span>
                </button>
              </div>
            </div>

            {/* DAY TABS */}
            <div className="flex gap-2 justify-between bg-main/5 p-1 rounded-xl">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`flex-1 h-10 rounded-lg font-bold text-sm transition-all ${activeTab === tab ? "bg-primary text-background shadow-lg shadow-primary/20 scale-105" : "text-muted hover:bg-main/5 hover:text-muted-foreground"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </header>
        )}

        {isDesktopAdmin && (
          <div className="sticky top-0 z-10 p-6 bg-background/95 backdrop-blur-sm border-b border-main/5">
            <div className="flex items-center justify-between xl:max-w-6xl xl:mx-auto">
              <div className="flex items-center gap-4">
                <button
                  onClick={onBack}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-main/5 hover:bg-main/10 text-main transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">
                    arrow_back_ios_new
                  </span>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-main">
                    Editar Treino de {viewingStudent?.name || "Aluno"}
                  </h1>
                  <p className="text-xs text-muted font-bold mt-1">
                    {planName || "Novo Plano"} •{" "}
                    {studentWorkouts.length > 0
                      ? `${studentWorkouts.length} Dias`
                      : ""}{" "}
                    Split
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {workoutId && <StatusBadge />}

                <div className="flex bg-main/5 p-1 rounded-xl w-64 lg:w-96">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className={`flex-1 h-10 rounded-lg font-bold text-sm transition-all ${activeTab === tab ? "bg-primary text-background shadow-lg shadow-primary/20 scale-105" : "text-muted hover:bg-main/5 hover:text-main"}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowPlanSettings(true)}
                  className="bg-main/5 hover:bg-main/10 text-main transition-colors px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm shadow-sm border border-main/5"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    settings
                  </span>
                  <span className="hidden lg:inline">Configurações</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Student Info Header */}
          <div className="flex items-center gap-4 mb-2">
            <div
              className="h-14 w-14 rounded-full bg-cover bg-center border border-main/10"
              style={{ backgroundImage: `url('${studentAvatar}')` }}
            ></div>
            <div>
              <h2 className="text-xl font-bold text-main">
                {viewingStudent?.name || "Aluno"}
              </h2>
              <div className="flex items-center gap-2">
                <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded">
                  Treino {activeTab}
                </span>
              </div>
            </div>
          </div>

          {/* Workout Section */}
          {isLoading ? (
            <div className="text-center py-10">
              <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block"></span>
              <p className="text-muted text-sm mt-2">
                A carregar Treino {activeTab}...
              </p>
            </div>
          ) : !workoutId ? (
            // EMPTY STATE WITH CREATE BUTTON
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-zinc-700 rounded-xl bg-main/5 animate-in fade-in duration-300">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary shadow-[0_0_15px_rgba(37,99,235,0.1)]">
                <span className="material-symbols-outlined text-3xl">
                  add_box
                </span>
              </div>
              <h3 className="text-lg font-bold text-main mb-2">
                Sem Treino {activeTab}
              </h3>
              <p className="text-muted text-sm mb-6 text-center max-w-[200px]">
                Este dia ainda não possui um treino configurado.
              </p>
              <button
                onClick={() => createWorkoutForTab(activeTab)}
                className="bg-primary text-background px-6 py-3 rounded-xl font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95"
              >
                <span className="material-symbols-outlined">add</span>
                Criar Treino {activeTab}
              </button>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-main/5 overflow-hidden shadow-lg animate-in slide-in-from-right-4 duration-300">
              <div className="p-4 border-b border-main/5 flex items-center justify-between bg-main/5 gap-4">
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={workoutTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="font-bold text-main bg-transparent outline-none border-b border-transparent focus:border-primary/50 w-full text-lg"
                    placeholder={`Nome do Treino ${activeTab}`}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-muted hover:text-red-500 transition-colors p-2 hover:bg-main/5 rounded-lg"
                    title="Limpar este dia"
                  >
                    <span className="material-symbols-outlined">
                      delete_sweep
                    </span>
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {exercises.length === 0 && (
                  <div className="text-center py-8 text-muted border-2 border-dashed border-main/5 rounded-xl bg-main/5">
                    <span className="material-symbols-outlined text-3xl mb-1 opacity-50">
                      fitness_center
                    </span>
                    <p className="text-sm font-medium">Dia vazio</p>
                    <p className="text-xs opacity-70">
                      Adicione exercícios ou grupos musculares.
                    </p>
                  </div>
                )}

                {exercises.map((ex) => (
                  <div key={ex.id} className={`transition-all duration-200`}>
                    {ex.isHeader ? (
                      <div
                        className={`flex items-end justify-between mt-6 first:mt-2 border-b-2 pb-1 gap-2 border-primary/50`}
                      >
                        <div className="flex flex-col -space-y-1 mr-1">
                          <button
                            onClick={(e) => moveExercise(e, ex.id, "up")}
                            className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                          >
                            <span className="material-symbols-outlined text-xl">
                              arrow_drop_up
                            </span>
                          </button>
                          <button
                            onClick={(e) => moveExercise(e, ex.id, "down")}
                            className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                          >
                            <span className="material-symbols-outlined text-xl">
                              arrow_drop_down
                            </span>
                          </button>
                        </div>
                        {editingHeaderId === ex.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={ex.name}
                              onChange={(e) =>
                                updateExerciseField(
                                  ex.id,
                                  "name",
                                  e.target.value.toUpperCase(),
                                )
                              }
                              onBlur={() => setEditingHeaderId(null)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && setEditingHeaderId(null)
                              }
                              className="w-full bg-transparent text-primary font-black text-sm uppercase tracking-wider outline-none placeholder:text-primary/30"
                              placeholder="NOME DO GRUPO"
                            />
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setEditingHeaderId(null)}
                              className="text-primary hover:text-main"
                            >
                              <span className="material-symbols-outlined text-lg">
                                check
                              </span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-primary font-black text-sm uppercase tracking-wider truncate flex-1 py-0.5">
                            {ex.name}
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {editingHeaderId !== ex.id && (
                            <button
                              onClick={() => setEditingHeaderId(ex.id)}
                              className="p-1 text-muted hover:text-main transition-colors rounded hover:bg-main/10"
                              title="Editar nome"
                            >
                              <span className="material-symbols-outlined text-lg">
                                edit
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => setExerciseToDelete(ex.id)}
                            className="p-1 text-muted hover:text-red-500 transition-colors rounded hover:bg-main/10"
                            title="Remover grupo"
                          >
                            <span className="material-symbols-outlined text-lg">
                              close
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`bg-background rounded-lg p-3 border relative group mt-2 transition-all duration-300 ${ex.isSuperset ? "border-orange-500/50 shadow-lg shadow-orange-500/5 mb-6" : ex.parent_exercise_id ? "border-orange-400 bg-orange-500/5 ml-4" : "border-main/5 hover:border-main/10"}`}
                      >
                        {ex.parent_exercise_id && (
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <span className="material-symbols-outlined text-orange-500 text-xs">
                              alt_route
                            </span>
                            <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest leading-none">
                              Variação Alternativa
                            </span>
                          </div>
                        )}

                        {ex.isSuperset && (
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                            <div className="h-4 w-[2px] bg-orange-500/50"></div>
                            <div className="px-2 py-0.5 rounded-full bg-orange-500 text-[8px] font-black text-white shadow-lg shadow-orange-500/20 uppercase tracking-tighter flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px]">
                                link
                              </span>
                              Supersérie com o próximo
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col mb-4 gap-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={ex.name}
                                onChange={(e) =>
                                  updateExerciseField(
                                    ex.id,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                className="text-lg font-black text-main bg-transparent border-b-2 border-transparent focus:border-primary outline-none w-full truncate"
                                placeholder="Nome do Exercício"
                              />
                            </div>
                            <button
                              onClick={() => setExerciseToDelete(ex.id)}
                              className="text-muted hover:text-red-500 transition-colors p-1"
                            >
                              <span className="material-symbols-outlined text-xl">
                                close
                              </span>
                            </button>
                          </div>
                          <div className="flex items-center flex-wrap gap-2">
                            <button
                              onClick={() =>
                                updateExerciseField(
                                  ex.id,
                                  "trackingMode",
                                  ex.trackingMode === "seconds"
                                    ? "reps"
                                    : "seconds",
                                )
                              }
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${ex.trackingMode === "seconds" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95" : "bg-main/5 text-muted hover:bg-main/10"}`}
                              title={
                                ex.trackingMode === "seconds"
                                  ? "Mudar para Repetições"
                                  : "Mudar para Segundos"
                              }
                            >
                              <span className="material-symbols-outlined text-sm">
                                timer
                              </span>
                              {ex.trackingMode === "seconds"
                                ? "Segundos"
                                : "Reps"}
                            </button>

                            <button
                              onClick={() =>
                                updateExerciseField(
                                  ex.id,
                                  "isSuperset",
                                  !ex.isSuperset,
                                )
                              }
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${ex.isSuperset ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20 active:scale-95" : "bg-main/5 text-muted hover:bg-main/10"}`}
                              title={
                                ex.isSuperset
                                  ? "Em supersérie com o próximo"
                                  : "Transformar em supersérie"
                              }
                            >
                              <span className="material-symbols-outlined text-sm">
                                link
                              </span>
                              Supersérie
                            </button>

                            <button
                              onClick={() => {
                                setAddingAlternativeToId(ex.id);
                                setShowBankModal(true);
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-main/5 text-muted hover:bg-main/10"
                              title="Alternativa (caso a máquina esteja ocupada ou indisponível)"
                            >
                              <span className="material-symbols-outlined text-sm">
                                alt_route
                              </span>
                              Alternativa
                            </button>

                            <div className="flex flex-col -space-y-1 ml-auto">
                              <button
                                onClick={(e) => moveExercise(e, ex.id, "up")}
                                className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                              >
                                <span className="material-symbols-outlined text-xl">
                                  arrow_drop_up
                                </span>
                              </button>
                              <button
                                onClick={(e) => moveExercise(e, ex.id, "down")}
                                className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                              >
                                <span className="material-symbols-outlined text-xl">
                                  arrow_drop_down
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-2 px-1">
                          <div className="w-8 flex-shrink-0 text-center text-[10px] font-bold text-muted uppercase">
                            Série
                          </div>
                          {ex.type === "CARDIO" ? (
                            <>
                              <div className="flex-1 text-center text-[10px] font-bold text-muted uppercase">
                                Tempo
                              </div>
                              <div className="flex-1 text-center text-[10px] font-bold text-muted uppercase">
                                Int. (1-5)
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 text-center text-[10px] font-bold text-muted uppercase">
                                {ex.trackingMode === "seconds" ? "Seg" : "Reps"}
                              </div>
                              <div className="flex-1 text-center text-[10px] font-bold text-muted uppercase">
                                Carga (kg)
                              </div>
                            </>
                          )}
                          <div className="w-8 flex-shrink-0"></div>
                        </div>

                        <div className="space-y-2">
                          {ex.sets.map((set, index) => (
                            <div
                              key={set.id}
                              className="flex items-center gap-2"
                            >
                              <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-bold text-muted bg-surface rounded-md border border-main/5">
                                {index + 1}
                              </div>
                              <div className="flex-1 flex items-center gap-2">
                                {ex.type === "CARDIO" ? (
                                  <>
                                    <div className="flex-1 h-9 bg-surface rounded-lg flex items-center px-3 gap-2 border border-main/5 focus-within:border-primary transition-all">
                                      <input
                                        type="text"
                                        value={set.time || ""}
                                        onChange={(e) =>
                                          handleSetChange(
                                            ex.id,
                                            set.id,
                                            "time",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="00:00"
                                        className="w-full bg-transparent text-sm text-main outline-none text-center font-bold"
                                      />
                                      <span className="text-[9px] font-black text-muted uppercase tracking-tight">
                                        H
                                      </span>
                                    </div>
                                    <div className="flex-1 h-9 bg-surface rounded-lg flex items-center px-3 gap-2 border border-main/5 focus-within:border-primary transition-all">
                                      <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={set.intensity || ""}
                                        onChange={(e) =>
                                          handleSetChange(
                                            ex.id,
                                            set.id,
                                            "intensity",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="3"
                                        className="w-full bg-transparent text-sm text-main outline-none text-center font-bold"
                                      />
                                      <span className="text-[9px] font-black text-muted uppercase tracking-tight">
                                        Int
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex-1 h-9 bg-surface rounded-lg flex items-center px-3 gap-2 border border-main/5 focus-within:border-primary transition-all">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                          set.reps === 0 ||
                                          (set.reps as any) === "0"
                                            ? ""
                                            : set.reps || ""
                                        }
                                        onChange={(e) =>
                                          handleSetChange(
                                            ex.id,
                                            set.id,
                                            "reps",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="0"
                                        className="w-full bg-transparent text-sm text-main outline-none text-center font-bold"
                                      />
                                      <span className="text-[9px] font-black text-muted uppercase tracking-tight">
                                        {ex.trackingMode === "seconds"
                                          ? "Seg"
                                          : "Reps"}
                                      </span>
                                    </div>

                                    <div className="flex-1 h-9 bg-surface rounded-lg flex items-center px-3 gap-2 border border-main/5 focus-within:border-primary transition-all">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                          set.weight === 0 ||
                                          (set.weight as any) === "0"
                                            ? ""
                                            : set.weight || ""
                                        }
                                        onChange={(e) =>
                                          handleSetChange(
                                            ex.id,
                                            set.id,
                                            "weight",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="0"
                                        className="w-full bg-transparent text-sm text-main outline-none text-center font-bold"
                                      />
                                      <span className="text-[9px] font-black text-muted uppercase tracking-tight">
                                        Kg
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                              <button
                                onClick={() => removeSet(ex.id, set.id)}
                                className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md bg-surface text-muted hover:text-red-400 hover:bg-red-500/10 border border-main/5 transition-colors"
                              >
                                <span className="material-symbols-outlined text-lg">
                                  delete
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => addSet(ex.id)}
                          className="w-full mt-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors border border-dashed border-primary/30 flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">
                            add
                          </span>
                          Adicionar Série
                        </button>

                        {/* NOTES & REST TIME FIELDS */}
                        <div className="mt-3 pt-3 border-t border-main/5">
                          <div className="flex flex-wrap items-stretch gap-2">
                            <div
                              className={`flex-1 min-w-[100px] flex items-center gap-2 bg-main/5 px-3 py-1.5 rounded-lg border transition-all ${ex.type === "STRENGTH" && !ex.restTime ? "border-red-500/50 bg-red-500/5" : "border-main/5 focus-within:border-primary/30"}`}
                            >
                              <span
                                className={`material-symbols-outlined text-sm ${ex.type === "STRENGTH" && !ex.restTime ? "text-red-400" : "text-zinc-600"}`}
                              >
                                timer
                              </span>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span
                                  className={`text-[8px] font-black uppercase tracking-wider ${ex.type === "STRENGTH" && !ex.restTime ? "text-red-400" : "text-muted"}`}
                                >
                                  Descanso{" "}
                                  {ex.type === "STRENGTH" && (
                                    <span className="text-red-400 ml-0.5">
                                      *
                                    </span>
                                  )}
                                </span>
                                <input
                                  type="text"
                                  value={ex.restTime || ""}
                                  onChange={(e) =>
                                    updateExerciseField(
                                      ex.id,
                                      "restTime",
                                      e.target.value,
                                    )
                                  }
                                  className="bg-transparent text-xs text-main font-bold placeholder:text-zinc-700 outline-none border-none focus:ring-0 p-0 w-full"
                                  placeholder={
                                    ex.type === "CARDIO"
                                      ? "Opcional"
                                      : "Obrigatório (ex: 60s)"
                                  }
                                />
                              </div>
                            </div>

                            <div className="flex-[2] min-w-[150px] flex items-center gap-2 bg-main/5 px-3 py-1.5 rounded-lg border border-main/5 focus-within:border-primary/30 transition-all">
                              <span className="material-symbols-outlined text-zinc-600 text-sm">
                                edit_note
                              </span>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-[8px] font-black text-muted uppercase tracking-wider">
                                  Notas
                                </span>
                                <input
                                  type="text"
                                  value={ex.notes || ""}
                                  onChange={(e) =>
                                    updateExerciseField(
                                      ex.id,
                                      "notes",
                                      e.target.value,
                                    )
                                  }
                                  className="bg-transparent text-xs text-muted-foreground placeholder:text-zinc-700 outline-none border-none focus:ring-0 p-0 w-full"
                                  placeholder="Observações..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="h-32" />
              </div>
            </div>
          )}
        </main>

        {/* FIXED ACTIONS */}
        {workoutId && !isDesktopAdmin && (
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
              <div className="grid grid-cols-2 gap-2 overflow-y-auto pb-8">
                {MUSCLE_GROUPS.map((group) => (
                  <button
                    key={group}
                    onClick={() => addHeader(group)}
                    className="py-3 px-2 bg-main/5 hover:bg-main/10 rounded-xl text-sm font-bold text-main transition-colors text-center"
                  >
                    {group}
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
      {showPlanSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-main">
                Configurações do Plano
              </h3>
              <button
                onClick={() => setShowPlanSettings(false)}
                className="text-muted hover:text-main"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-muted mb-2 block">
                  Nome do Plano
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-all font-bold"
                />
              </div>

              <div className="pt-2">
                <label className="text-sm font-bold text-muted mb-3 block">
                  Frequência Semanal (Dias)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <button
                      key={num}
                      onClick={() => setStudentFrequency(num)}
                      className={`flex-1 h-10 rounded-lg font-bold text-xs transition-all border ${studentFrequency === num ? "bg-primary border-primary text-background" : "bg-main/5 border-main/10 text-muted"}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-muted mb-3 block">
                  Dias de Descanso (Bloqueados na App)
                </label>
                <div className="flex flex-wrap gap-2">
                  {["D", "S", "T", "Q", "Q", "S", "S"].map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setStudentRestDays((prev) =>
                          prev.includes(idx)
                            ? prev.filter((d) => d !== idx)
                            : [...prev, idx],
                        );
                      }}
                      className={`w-10 h-10 rounded-lg font-bold text-xs transition-all border ${studentRestDays.includes(idx) ? "bg-red-500 border-red-500 text-white" : "bg-main/5 border-main/10 text-muted"}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSavePlanSettings}
                disabled={isUpdatingPlan || !planName.trim()}
                className="w-full bg-primary text-background font-black h-14 rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 shadow-lg shadow-primary/20"
              >
                {isUpdatingPlan ? (
                  <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  "Guardar Alterações"
                )}
              </button>

              <div>
                <label className="text-sm font-bold text-muted mb-2 block">
                  Duração Estimada (min)
                </label>
                <input
                  type="number"
                  value={plannedDuration}
                  onChange={(e) => setPlannedDuration(Number(e.target.value))}
                  className="w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-all font-bold"
                />
              </div>

              {deleteStep === "IDLE" ? (
                <div className="pt-4 border-t border-main/5">
                  <button
                    onClick={() => setDeleteStep("CONFIRM")}
                    className="w-full border border-red-500/30 text-red-500 font-bold h-12 rounded-xl hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">
                      delete_forever
                    </span>
                    Apagar Plano Completo
                  </button>
                  <p className="text-[10px] text-muted text-center mt-2">
                    Isto removerá todos os treinos e exercícios deste aluno.
                  </p>
                </div>
              ) : (
                <div className="pt-4 border-t border-main/5 animate-in fade-in slide-in-from-bottom-2">
                  <p className="text-red-400 font-bold text-center text-sm mb-3">
                    Tens a certeza? Esta ação é irreversível.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteStep("IDLE")}
                      className="flex-1 bg-main/5 hover:bg-main/10 text-main font-bold h-12 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={performDeletePlan}
                      disabled={isUpdatingPlan}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold h-12 rounded-xl transition-colors flex items-center justify-center"
                    >
                      {isUpdatingPlan ? (
                        <span className="w-4 h-4 border-2 border-main border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        "Sim, Apagar"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              {/* CATEGORY DROPDOWN */}
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
                  {group}
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
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                <span className="material-symbols-outlined text-3xl">
                  delete_sweep
                </span>
              </div>
              <h3 className="text-xl font-bold text-main mb-2">
                Limpar Dia {activeTab}?
              </h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Esta ação removerá o treino desta aba e todos os exercícios.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteWorkout}
                  disabled={isDeleting}
                  className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20 flex items-center justify-center"
                >
                  {isDeleting ? (
                    <span className="w-4 h-4 border-2 border-main border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    "Apagar"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {exerciseToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-3 text-red-500">
                <span className="material-symbols-outlined text-3xl">
                  delete
                </span>
              </div>
              <h3 className="text-lg font-bold text-main mb-2">
                {itemBeingDeleted?.isHeader
                  ? "Remover Grupo?"
                  : "Remover Exercício?"}
              </h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                {itemBeingDeleted?.isHeader
                  ? "Estás a remover um grupo muscular. Isto não remove os exercícios abaixo dele, apenas o título."
                  : "Tens a certeza que desejas remover este exercício do treino?"}
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setExerciseToDelete(null)}
                  className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRemoveItem}
                  className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {setToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                <span className="material-symbols-outlined text-3xl">
                  delete
                </span>
              </div>
              <h3 className="text-xl font-bold text-main mb-2">
                Remover Série?
              </h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Tens a certeza que desejas remover esta série do exercício?
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setSetToDelete(null)}
                  className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRemoveSet}
                  className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      <AnimatePresence>
        {showSaveTemplateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-hidden">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-surface rounded-[2.5rem] p-6 shadow-2xl border border-main/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-main uppercase italic">
                  Guardar na Base
                </h3>
                <button
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="text-muted"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-muted font-medium">
                  Define um nome para identificares este plano na tua
                  biblioteca.
                </p>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Ex: Hipertrofia Pernas A/B"
                  className="w-full h-14 bg-main/5 rounded-2xl px-4 text-main font-bold outline-none border border-transparent focus:border-primary/30 transition-all"
                  autoFocus
                />

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="flex-1 h-12 bg-main/5 text-main font-black uppercase rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveAsTemplate}
                    disabled={isSavingTemplate || !newTemplateName.trim()}
                    className="flex-1 h-12 bg-primary text-background font-black uppercase rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {isSavingTemplate ? "A Guardar..." : "Confirmar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

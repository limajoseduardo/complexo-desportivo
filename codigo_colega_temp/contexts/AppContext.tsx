
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { demoUser, demoChats } from '../data/demoData';
import { 
  User, Screen, UserRole, WorkoutSession, DietPlan, 
  Chat, WeightEntry, SmartAlert, WorkoutSet, Exercise, ChatMessage
} from '../types';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabaseClient';
import { addToSyncQueue } from '../lib/syncQueue';

interface AppContextType {
  currentScreen: Screen;
  previousScreen: Screen | null;
  setScreen: (screen: Screen) => void;
  user: User | null;
  login: (email: string, pass: string) => Promise<{ error?: any }>;
  register: (name: string, email: string, pass: string, role: UserRole, code?: string) => Promise<{ error?: any }>;
  recoverPassword: (email: string) => Promise<{ error?: any }>;
  logout: () => void;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  
  activeWorkout: WorkoutSession;
  setActiveWorkout: (workout: WorkoutSession) => void;
  updateSet: (exerciseId: string, setId: string, updates: Partial<WorkoutSet>, durationSeconds?: number) => Promise<void>;
  finishWorkout: (durationSeconds: number) => Promise<void>;
  resetWorkout: (workoutId: string) => Promise<void>;
  
  dietPlan: DietPlan;
  toggleFoodItem: (mealId: string, itemId: string) => void;
  
  progress: WeightEntry[];
  addWeightEntry: (weight: number, date?: Date, photos?: { front?: string; side?: string; back?: string }, studentId?: string) => Promise<void>;
  updateWeightEntry: (entryId: string, weight: number, studentId?: string) => void;
  deleteWeightEntry: (entryId: string, studentId?: string) => void;
  
  chats: Chat[];
  selectedChatId: string | null;
  selectChat: (chatId: string) => void;
  startChat: (participantId: string, name: string, avatar: string) => void;
  sendMessage: (chatId: string, text: string, type?: 'text' | 'image', mediaUrl?: string) => void;
  refreshChat: (chatId: string) => void;
  markChatAsRead: (chatId: string) => void;
  deleteChat: (chatId: string) => Promise<void>;
  openTrainerChat: () => Promise<void>;
  sendPushNotification: (targetUserId: string, title: string, body: string, url?: string) => Promise<void>;
  
  viewingStudent: User | null;
  selectStudentForProgress: (studentId: string, name: string, avatar?: string) => void;
  clearViewingStudent: () => void;
  generateAccessCode: () => Promise<string | null>;
  
  resolveWorkoutChangeRequest: (studentId: string) => Promise<void>;
  hasPendingWorkoutChangeRequest: (studentId: string) => Promise<boolean>;
  
  editingTemplateId: string | null;
  setEditingTemplateId: (id: string | null) => void;
  
  alerts: SmartAlert[];
  refreshAlerts: () => void;
  markAlertAsRead: (alertId: string) => void;
  markAllAlertsAsRead: () => void;
  reportIssue: (title: string, message: string, urgent: boolean) => Promise<void>;
  reloadData: () => Promise<void>;
  activeRole: UserRole;
  switchRole: (role: UserRole) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isAuthReady: boolean;
  requestNotificationPermission: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Robust PWA detection
const isLaunchedAsPWA = (() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('pwa') === 'true' 
        || window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true;
})();

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [currentScreen, _setScreen] = useState<Screen>(() => {
    if (typeof window === 'undefined') return Screen.LANDING;
    
    // Check if we are on the desktop admin path
    const isDesktopAdminPath = window.location.pathname === '/ptadmin';
    
    // If not authenticated, force login/landing
    const session = localStorage.getItem('fitvlr-auth-token');
    if (!session && demoUser.id !== 'demo-user-1') return isLaunchedAsPWA ? Screen.LOGIN : Screen.LANDING;
    if (demoUser.id === 'demo-user-1') return Screen.STUDENT_DASHBOARD;
    
    // Check if user role was saved locally
    const savedRole = localStorage.getItem('fitvlr-active-role');
    
    if (isDesktopAdminPath && savedRole === UserRole.TRAINER) {
       return Screen.TRAINER_DESKTOP_ADMIN;
    }
    
    // If there is an active session, auto-resume to Workout View if student
    const hasActiveSession = !!localStorage.getItem('active_workout_session');
    if (hasActiveSession && savedRole !== UserRole.TRAINER) return Screen.WORKOUT_PLAN;
    
    return savedRole === UserRole.TRAINER ? Screen.TRAINER_DASHBOARD : Screen.STUDENT_DASHBOARD;
  });
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
  const [user, setUser] = useState<User | null>(demoUser);
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.STUDENT);
  const [isAuthReady, setIsAuthReady] = useState(true);

  // Wrapper for screen changes that updates browser history
  const setScreen = (screen: Screen | ((prev: Screen) => Screen), replace = false) => {
    if (typeof window !== 'undefined') {
        const nextScreenResult = typeof screen === 'function' ? screen(currentScreen) : screen;
        
        if (nextScreenResult === undefined) {
             console.error("[Navigation] setScreen chamado com undefined! Bloqueado.");
             return;
        }

        // Bloqueio de segurança: Se está logado, nunca enviar para LANDING
        if (nextScreenResult === Screen.LANDING && localStorage.getItem('fitvlr-auth-token')) {
            console.warn("[Navigation] Bloqueado redirecionamento indevido para LANDING.");
            return;
        }

        if (replace) {
            window.history.replaceState({ screen: nextScreenResult }, '', '');
        } else {
            window.history.pushState({ screen: nextScreenResult }, '', '');
        }
    }
    if (screen !== undefined) {
        setPreviousScreen(currentScreen);
        _setScreen(screen);
    }
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (activeWorkout.id !== 'default' && currentScreen === Screen.WORKOUT_PLAN) {
          window.history.pushState({ screen: Screen.WORKOUT_PLAN }, '', '');
          return;
      }
      if (event.state && event.state.screen) {
        _setScreen(event.state.screen);
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.history.replaceState({ screen: currentScreen }, '', '');
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
       return localStorage.getItem('app-theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
    if (user?.id) {
        try {
            await supabase.from('profiles').update({ theme: newTheme }).eq('id', user.id);
        } catch (e) {
            console.error("Failed to sync theme to DB:", e);
        }
    }
  };

  useEffect(() => {
    const html = document.documentElement;
    const themeColor = theme === 'dark' ? '#0a0f1e' : '#f1f5ff';
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    const updateMeta = () => {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
          metaThemeColor = document.createElement('meta');
          (metaThemeColor as any).name = 'theme-color';
          document.head.appendChild(metaThemeColor);
        }
        document.querySelectorAll('meta[name="theme-color"]').forEach(el => {
          if (el !== metaThemeColor) el.remove();
        });
        metaThemeColor.setAttribute('content', themeColor);
    };
    updateMeta();
    const timeout = setTimeout(updateMeta, 100);
    return () => clearTimeout(timeout);
  }, [theme]);

  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('active_workout_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.id && parsed.id !== 'default') {
                    return parsed;
                }
            } catch (e) {
                console.warn("Failed to parse saved workout session:", e);
            }
        }
    }
    return {
      id: 'default',
      title: '',
      description: '',
      exercises: [],
      originalExercises: [],
      completed: false,
      durationSeconds: 0,
      plannedDurationMinutes: 50
    };
  });

  useEffect(() => {
     if (typeof window !== 'undefined') {
         if (activeWorkout.id !== 'default' && !activeWorkout.completed) {
             localStorage.setItem('active_workout_session', JSON.stringify(activeWorkout));
         } else {
             localStorage.removeItem('active_workout_session');
         }
     }
  }, [activeWorkout]);

  const [dietPlan, setDietPlan] = useState<DietPlan>({
      id: '1',
      date: new Date().toISOString(),
      meals: [],
      targetCalories: 0,
      targetProtein: 0,
      targetCarbs: 0,
      targetFat: 0
  });

  const [progress, setProgress] = useState<WeightEntry[]>([]);
  const [chats, setChats] = useState<Chat[]>(demoChats);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [viewingStudent, setViewingStudent] = useState<User | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  
  const prevAlertsLength = useRef(0);

  useEffect(() => {
    // Inicializar listener para notificações push no foreground (app em foco)
    import('../lib/firebase').then(mod => {
        if (mod.setupForegroundMessaging) {
            mod.setupForegroundMessaging();
        }
    }).catch(err => console.error(err));

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setIsAuthReady(true);
      }
    }).catch(err => {
      console.error("getSession error:", err);
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
          setScreen(Screen.RESET_PASSWORD);
          setIsAuthReady(true);
      } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setScreen(Screen.LOGIN);
          setIsAuthReady(true);
      } else if (session?.user) {
          fetchUserProfile(session.user.id);
      } else {
          setUser(null);
          setIsAuthReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
      if (!user) return;
      refreshAlerts();
      const interval = setInterval(refreshAlerts, 30000);
      return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
      if (!user) return;
      const updatePresence = async () => {
          await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
      };
      updatePresence(); 
      const interval = setInterval(updatePresence, 60000);
      return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (user?.role !== 'TRAINER') return;
    const cleanupInvites = async () => {
      try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        await supabase.from('invite_codes').delete().lt('created_at', oneWeekAgo.toISOString());
      } catch (e) {
        console.warn("Auto-cleanup of expired invites failed:", e);
      }
    };
    const cleanupNotifications = async () => {
      try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        await supabase.from('notifications').delete().lt('created_at', oneWeekAgo.toISOString());
      } catch (e) {
        // Fail silent
      }
    };
    cleanupInvites();
    cleanupNotifications();
  }, [user?.id, user?.role]);

  const fetchUserProfile = async (userId: string) => {
      if (userId === demoUser.id) return;
      try {
          const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (data) {
              const mappedUser: User = {
                  id: data.id,
                  name: data.name || 'Utilizador',
                  email: data.email || '',
                  avatar: data.avatar || 'https://ui-avatars.com/api/?name=User',
                  role: (data.role as UserRole) || UserRole.STUDENT,
                  goal: data.goal, weight: data.weight, height: data.height,
                  initialWeight: data.initial_weight, targetWeight: data.target_weight,
                  birthdate: data.birthdate, gender: data.gender, bodyFat: data.body_fat,
                  targetCalories: data.target_calories || 0,
                  targetProtein: data.target_protein || 0,
                  targetCarbs: data.target_carbs || 0,
                  targetFat: data.target_fat || 0,
                  notifyWorkout: data.notify_workout !== false,
                  notifyChat: data.notify_chat !== false,
                  notifyDiet: data.notify_diet !== false,
                  hasSeenTour: data.has_seen_tour === true,
                  hasSeenWorkoutTour: data.has_seen_workout_tour === true,
                  hasSeenSessionTour: data.has_seen_session_tour === true,
                  hasSeenPerformanceTour: data.has_seen_performance_tour === true,
                  hasSeenLeaderboardTour: data.has_seen_leaderboard_tour === true,
                  restDays: data.rest_days || [0, 6],
                  trainingFrequency: data.training_frequency || 5,
                  trainerId: data.trainer_id,
                  theme: data.theme || 'light',
                  activityFactor: data.activity_factor,
                  proteinMultiplier: data.protein_multiplier
              };
              
              if (mappedUser.role === UserRole.STUDENT && data.trainer_id) {
                  try {
                      const { data: trainerData } = await supabase.from('profiles').select('avatar').eq('id', data.trainer_id).single();
                      if (trainerData) mappedUser.trainerAvatar = trainerData.avatar;
                  } catch (e) {
                      console.warn("Could not fetch trainer avatar:", e);
                  }
              }
              setUser(mappedUser);
              localStorage.setItem('fitvlr-cached-user', JSON.stringify(mappedUser));
              if (data.theme && data.theme !== localStorage.getItem('app-theme')) {
                  setTheme(data.theme);
                  localStorage.setItem('app-theme', data.theme);
              }
              const userRole = mappedUser.role;
              setActiveRole(userRole);
              localStorage.setItem('fitvlr-active-role', userRole);
              setScreen(prev => {
                  if (prev === Screen.RESET_PASSWORD) return prev;
                  const hasActiveSession = !!localStorage.getItem('active_workout_session');
                  
                  // Maintain desktop admin screen if on that path
                  if (window.location.pathname === '/ptadmin' && userRole === UserRole.TRAINER) {
                      return Screen.TRAINER_DESKTOP_ADMIN;
                  }

                  const nextScreen = (userRole === UserRole.STUDENT) 
                      ? (hasActiveSession ? Screen.WORKOUT_PLAN : Screen.STUDENT_DASHBOARD) 
                      : Screen.TRAINER_DASHBOARD;
                  if (prev === Screen.LOGIN || prev === Screen.LANDING) {
                      window.history.replaceState({ screen: nextScreen }, '', '');
                      return nextScreen;
                  }
                  return prev;
              }, true); 
              if (mappedUser.role === UserRole.STUDENT) loadStudentData(userId).catch(console.error);
              loadChats(userId).catch(console.error);
              setIsAuthReady(true);
          } else if (error && error.code !== 'PGRST116') {
              console.error("Database connection error or timeout, NOT signing out:", error);
              // Fallback to cached user if offline
              const cachedStr = localStorage.getItem('fitvlr-cached-user');
              if (cachedStr) {
                  try {
                      const cachedUser = JSON.parse(cachedStr);
                      setUser(cachedUser);
                      setActiveRole(cachedUser.role);
                      
                      setScreen(prev => {
                          if (prev === Screen.RESET_PASSWORD) return prev;
                          const hasActiveSession = !!localStorage.getItem('active_workout_session');
                          if (window.location.pathname === '/ptadmin' && cachedUser.role === UserRole.TRAINER) {
                              return Screen.TRAINER_DESKTOP_ADMIN;
                          }
                          const nextScreen = (cachedUser.role === UserRole.STUDENT) 
                              ? (hasActiveSession ? Screen.WORKOUT_PLAN : Screen.STUDENT_DASHBOARD) 
                              : Screen.TRAINER_DASHBOARD;
                          if (prev === Screen.LOGIN || prev === Screen.LANDING) {
                              window.history.replaceState({ screen: nextScreen }, '', '');
                              return nextScreen;
                          }
                          return prev;
                      }, true);
                      
                      if (cachedUser.role === UserRole.STUDENT) loadStudentData(userId).catch(console.error);
                      loadChats(userId).catch(console.error);
                  } catch(e) {}
              }
              setIsAuthReady(true);
          } else {
              console.warn("No profile data found for user:", userId);
              await supabase.auth.signOut();
              setUser(null);
              setScreen(Screen.LOGIN);
              setIsAuthReady(true);
          }
      } catch (err) {
          console.error("Error in fetchUserProfile:", err);
          setIsAuthReady(true);
      }
  };

  const loadStudentData = async (userId: string) => {
      if (userId === demoUser.id) return;
      const { data: weightData, error: weightError } = await supabase.from('weight_history').select('*').eq('user_id', userId).order('date', {ascending: true});
      let progressToUse = [];
      if (weightData && !weightError) {
          progressToUse = weightData.map((w: any) => ({
              id: w.id, date: w.date, weight: w.weight,
              photo_front: w.photo_front, photo_side: w.photo_side, photo_back: w.photo_back
          }));
          localStorage.setItem(`cached_progress_${userId}`, JSON.stringify(progressToUse));
      } else {
          const cachedProgress = localStorage.getItem(`cached_progress_${userId}`);
          if (cachedProgress) progressToUse = JSON.parse(cachedProgress);
      }
      setProgress(progressToUse);

      try {
          const today = new Date().getDay();
          const { data: profile } = await supabase.from('profiles').select('target_calories, target_protein, target_carbs, target_fat').eq('id', userId).single();
          const { data: mealsData, error: mealsError } = await supabase.from('diet_meals').select('*').eq('student_id', userId).eq('day_of_week', today).order('order_index', { ascending: true });
          
          let meals: any[] = [];
          
          if (!mealsError && mealsData) {
              if (mealsData.length > 0) {
                  meals = await Promise.all(mealsData.map(async (meal: any) => {
                      const { data: items } = await supabase.from('diet_items').select('*').eq('meal_id', meal.id).order('created_at', { ascending: true });
                      return {
                          id: meal.id, name: meal.name, targetCalories: 0,
                          items: (items || []).map((i: any) => ({
                              id: i.id, name: i.name, quantity: i.quantity, completed: i.completed || false, image: i.image, is_extra: i.is_extra || false
                          }))
                      };
                  }));
              }
              const finalDietPlan = {
                  id: 'current', date: new Date().toISOString(), meals: meals,
                  targetCalories: profile?.target_calories || 0, targetProtein: profile?.target_protein || 0, targetCarbs: profile?.target_carbs || 0, targetFat: profile?.target_fat || 0
              };
              setDietPlan(finalDietPlan);
              localStorage.setItem(`cached_diet_${userId}`, JSON.stringify(finalDietPlan));
          } else {
              const cachedDiet = localStorage.getItem(`cached_diet_${userId}`);
              if (cachedDiet) {
                  setDietPlan(JSON.parse(cachedDiet));
              }
          }
      } catch (e) {
          console.error("Error loading diet data context", e);
          const cachedDiet = localStorage.getItem(`cached_diet_${userId}`);
          if (cachedDiet) {
              setDietPlan(JSON.parse(cachedDiet));
          }
      }
  };

  const loadChats = async (userId: string) => {
      if (userId === demoUser.id) return;
      try {
          const { data: messages, error } = await supabase
              .from('messages')
              .select(`
                  *,
                  sender:profiles!sender_id(name, avatar, last_seen),
                  receiver:profiles!receiver_id(name, avatar, last_seen)
              `)
              .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
              .order('created_at', { ascending: true });
          if (error) throw error;
          const chatMap = new Map<string, Chat>();
          const now = new Date();
          if (messages) {
              messages.forEach((msg: any) => {
                  const isMe = msg.sender_id === userId;
                  const partnerId = isMe ? msg.receiver_id : msg.sender_id;
                  const partnerProfile = isMe ? msg.receiver : msg.sender;
                  if (!partnerId || !partnerProfile) return;
                  if (!chatMap.has(partnerId)) {
                      chatMap.set(partnerId, {
                          id: partnerId, participantId: partnerId,
                          participantName: partnerProfile.name || 'Utilizador', participantAvatar: partnerProfile.avatar || '',
                          lastMessage: '', lastMessageTime: '', lastMessageTs: 0, unreadCount: 0, messages: [], online: false, lastSeen: partnerProfile.last_seen
                      });
                  }
                  const chat = chatMap.get(partnerId)!;
                  const msgDate = new Date(msg.created_at);
                  const isToday = msgDate.toDateString() === now.toDateString();
                  const timeString = msgDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                  const dateString = msgDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                  const formattedTimestamp = isToday ? timeString : `${dateString} ${timeString}`;
                  const listTimestamp = isToday ? timeString : dateString;
                  chat.messages.push({
                      id: msg.id, senderId: msg.sender_id, text: msg.text || (msg.media_url ? '📷 Imagem' : ''),
                      timestamp: formattedTimestamp, type: msg.message_type || 'text', mediaUrl: msg.media_url, readAt: msg.read_at
                  });
                  chat.lastMessage = msg.message_type === 'image' ? '📷 Imagem' : msg.text;
                  chat.lastMessageTime = listTimestamp;
                  chat.lastMessageTs = msgDate.getTime();
                  if (partnerProfile.last_seen) {
                      const diff = now.getTime() - new Date(partnerProfile.last_seen).getTime();
                      chat.online = diff < 5 * 60 * 1000; 
                  }
                  if (!isMe && !msg.read_at) chat.unreadCount++;
              });
          }
          setChats(prev => {
              const existingEmptyChats = prev.filter(c => c.messages.length === 0);
              const newChatsMap = new Map(chatMap);
              existingEmptyChats.forEach(emptyChat => {
                  if (!newChatsMap.has(emptyChat.participantId)) newChatsMap.set(emptyChat.participantId, emptyChat);
              });
              return Array.from(newChatsMap.values()).sort((a, b) => (b.lastMessageTs || 0) - (a.lastMessageTs || 0));
          });
      } catch (e) {
          console.error("Error loading chats:", e);
      }
  };

  const refreshChat = async (chatId: string) => {
      if (!user) return;
      try {
          const { data: messages, error } = await supabase
              .from('messages')
              .select(`
                  *,
                  sender:profiles!sender_id(name, avatar, last_seen),
                  receiver:profiles!receiver_id(name, avatar, last_seen)
              `)
              .or(`and(sender_id.eq.${user.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${user.id})`)
              .order('created_at', { ascending: true });
              
          if (error) throw error;
          
          setChats(prev => {
              const updatedChats = [...prev];
              const chatIndex = updatedChats.findIndex(c => c.id === chatId);
              let chat = chatIndex >= 0 ? { ...updatedChats[chatIndex] } : null;
              
              if (!messages || messages.length === 0) return prev;
              
              const now = new Date();
              if (!chat) {
                  const firstMsg = messages[0];
                  const isMe = firstMsg.sender_id === user.id;
                  const partnerProfile = isMe ? firstMsg.receiver : firstMsg.sender;
                  chat = {
                      id: chatId, participantId: chatId,
                      participantName: partnerProfile?.name || 'Utilizador', participantAvatar: partnerProfile?.avatar || '',
                      lastMessage: '', lastMessageTime: '', lastMessageTs: 0, unreadCount: 0, messages: [], online: false, lastSeen: partnerProfile?.last_seen
                  };
              }
              
              let unreadCount = 0;
              chat.messages = messages.map((msg: any) => {
                  const msgDate = new Date(msg.created_at);
                  const isToday = msgDate.toDateString() === now.toDateString();
                  const timeString = msgDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                  const dateString = msgDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                  const formattedTimestamp = isToday ? timeString : `${dateString} ${timeString}`;
                  
                  const isMe = msg.sender_id === user.id;
                  if (!isMe && !msg.read_at) unreadCount++;
                  
                  return {
                      id: msg.id, senderId: msg.sender_id, text: msg.text || (msg.media_url ? '📷 Imagem' : ''),
                      timestamp: formattedTimestamp, type: msg.message_type || 'text', mediaUrl: msg.media_url, readAt: msg.read_at
                  };
              });
              
              chat.unreadCount = unreadCount;
              
              if (messages.length > 0) {
                  const lastMsg = messages[messages.length - 1];
                  const msgDate = new Date(lastMsg.created_at);
                  const isToday = msgDate.toDateString() === now.toDateString();
                  const timeString = msgDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                  const dateString = msgDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                  chat.lastMessage = lastMsg.message_type === 'image' ? '📷 Imagem' : lastMsg.text;
                  chat.lastMessageTime = isToday ? timeString : dateString;
                  chat.lastMessageTs = msgDate.getTime();
              }
              
              if (chatIndex >= 0) {
                  updatedChats[chatIndex] = chat;
              } else {
                  updatedChats.push(chat);
              }
              
              return updatedChats.sort((a, b) => (b.lastMessageTs || 0) - (a.lastMessageTs || 0));
          });
      } catch (e) {
          console.error("Error refreshing chat:", e);
      }
  };

  const login = async (email: string, pass: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      return { error };
  };

  const register = async (name: string, email: string, pass: string, role: UserRole, code?: string) => {
      if (role === UserRole.STUDENT && code) {
          const { data: codeData, error: codeError } = await supabase.from('invite_codes').select('*').eq('code', code).single();
          if (codeError || !codeData) return { error: 'Código de acesso inválido.' };
          if (codeData.student_id) return { error: 'Este código já foi utilizado.' };
      }
      const { data, error } = await supabase.auth.signUp({ 
          email, password: pass,
          options: { data: { name, role, avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random` } }
      });
      if (!error && data.user) {
          if (role === UserRole.STUDENT && code) {
              await supabase.from('invite_codes').update({ student_id: data.user.id, used_at: new Date().toISOString() }).eq('code', code);
              const { data: codeData } = await supabase.from('invite_codes').select('trainer_id').eq('code', code).single();
              if (codeData) {
                  await supabase.from('profiles').update({ trainer_id: codeData.trainer_id }).eq('id', data.user.id);
                  sendPushNotification(codeData.trainer_id, 'Novo Aluno', `O aluno ${name} registou-se e ainda não tem um treino associado.`, '/');
              }
          }
      }
      return { error };
  };

  const recoverPassword = async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' });
      return { error };
  };

  const logout = async () => {
      await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('fitvlr-cached-user');
      setScreen(Screen.LOGIN);
  };

  const updateUserProfile = async (data: Partial<User>) => {
      if (!user) return;
      const updates: any = {
          name: data.name, goal: data.goal, weight: data.weight, height: data.height, birthdate: data.birthdate,
          target_weight: data.targetWeight, initial_weight: data.initialWeight, avatar: data.avatar, gender: data.gender,
          body_fat: data.bodyFat, activity_factor: data.activityFactor, protein_multiplier: data.proteinMultiplier,
      };
      if (data.notifyWorkout !== undefined) updates.notify_workout = data.notifyWorkout;
      if (data.notifyChat !== undefined) updates.notify_chat = data.notifyChat;
      if (data.notifyDiet !== undefined) updates.notify_diet = data.notifyDiet;
      if (data.hasSeenTour !== undefined) updates.has_seen_tour = data.hasSeenTour;
      if (data.hasSeenWorkoutTour !== undefined) updates.has_seen_workout_tour = data.hasSeenWorkoutTour;
      if (data.hasSeenSessionTour !== undefined) updates.has_seen_session_tour = data.hasSeenSessionTour;
      if (data.hasSeenPerformanceTour !== undefined) updates.has_seen_performance_tour = data.hasSeenPerformanceTour;
      if (data.hasSeenLeaderboardTour !== undefined) updates.has_seen_leaderboard_tour = data.hasSeenLeaderboardTour;
      if (data.restDays !== undefined) updates.rest_days = data.restDays;
      if (data.trainingFrequency !== undefined) updates.training_frequency = data.trainingFrequency;
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (!error) setUser(prev => prev ? { ...prev, ...data } : null);
  };

  const updatePassword = async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      return { error };
  };

  const addWeightEntry = async (weight: number, date: Date = new Date(), photos?: { front?: string; side?: string; back?: string }, studentId?: string) => {
      if (!user) return;
      const targetId = studentId || user.id;
      const payload: any = { user_id: targetId, weight, date: date.toISOString() };
      if (photos) {
          if (photos.front) payload.photo_front = photos.front;
          if (photos.side) payload.photo_side = photos.side;
          if (photos.back) payload.photo_back = photos.back;
      }
      const { data, error } = await supabase.from('weight_history').insert(payload).select().single();
      if (data && targetId === user.id) {
          const newEntry = { id: data.id, weight: data.weight, date: data.date, photo_front: data.photo_front, photo_side: data.photo_side, photo_back: data.photo_back };
          setProgress(prev => {
              const newProgress = [...prev, newEntry];
              const sortedProgress = [...newProgress].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              if (sortedProgress.length > 0) updateUserProfile({ weight: sortedProgress[0].weight });
              return newProgress;
          });
      }
  };

  const updateWeightEntry = async (entryId: string, weight: number, studentId?: string) => {
      const { error } = await supabase.from('weight_history').update({ weight }).eq('id', entryId);
      if (!error && (!studentId || studentId === user?.id)) {
          setProgress(prev => {
              const newProgress = prev.map(p => p.id === entryId ? { ...p, weight } : p);
              const sortedProgress = [...newProgress].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              if (sortedProgress.length > 0 && sortedProgress[0].id === entryId) updateUserProfile({ weight: sortedProgress[0].weight });
              return newProgress;
          });
      }
  };

  const deleteWeightEntry = async (entryId: string, studentId?: string) => {
      const { error } = await supabase.from('weight_history').delete().eq('id', entryId);
      if (!error && (!studentId || studentId === user?.id)) {
          setProgress(prev => {
              const newProgress = prev.filter(p => p.id !== entryId);
              if (newProgress.length > 0) {
                  const sortedProgress = [...newProgress].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  updateUserProfile({ weight: sortedProgress[0].weight });
              } else {
                  updateUserProfile({ weight: 0 });
              }
              return newProgress;
          });
      }
  };

  const updateSet = async (exerciseId: string, setId: string, updates: Partial<WorkoutSet>, durationSeconds?: number) => {
    setActiveWorkout(prev => ({
        ...prev,
        exercises: prev.exercises.map(ex => ex.id !== exerciseId ? ex : { ...ex, sets: ex.sets.map(s => s.id !== setId ? s : { ...s, ...updates }) }),
        durationSeconds: durationSeconds !== undefined ? durationSeconds : prev.durationSeconds
    }));
    try {
        const dbUpdates: any = { ...updates, id: setId };
        if (typeof dbUpdates.weight === 'string') {
            dbUpdates.weight = parseFloat((dbUpdates.weight as string).replace(',', '.')) || null;
        }
        if (typeof dbUpdates.reps === 'string') {
             dbUpdates.reps = parseInt(dbUpdates.reps as string) || null;
        }

        if (!navigator.onLine) {
            await addToSyncQueue('update', 'workout_sets', dbUpdates);
            if (durationSeconds !== undefined && activeWorkout.id !== 'default') {
                await addToSyncQueue('update', 'workouts', { id: activeWorkout.id, duration_seconds: durationSeconds });
            }
            return;
        }

        const promises = [supabase.from('workout_sets').update(dbUpdates).eq('id', setId)];
        if (durationSeconds !== undefined && activeWorkout.id !== 'default') {
            promises.push(supabase.from('workouts').update({ duration_seconds: durationSeconds }).eq('id', activeWorkout.id));
        }
        await Promise.all(promises).catch(async (e) => {
            console.warn("Update failed, queuing for later:", e);
            await addToSyncQueue('update', 'workout_sets', dbUpdates);
            if (durationSeconds !== undefined && activeWorkout.id !== 'default') {
                await addToSyncQueue('update', 'workouts', { id: activeWorkout.id, duration_seconds: durationSeconds });
            }
        });
    } catch (e) {
        console.error("Update error:", e);
    }
  };

  const finishWorkout = async (durationSeconds: number) => {
      if (!activeWorkout.id || activeWorkout.id === 'default') return;
      
      const completedTimestamp = new Date().toISOString();
      const workoutUpdate = {
          id: activeWorkout.id,
          completed: true, 
          duration_seconds: durationSeconds, 
          completed_at: completedTimestamp 
      };

      try {
          // 1. Attempt to mark the MAIN workout as completed
          if (navigator.onLine) {
              const { error } = await supabase
                .from('workouts')
                .update(workoutUpdate)
                .eq('id', activeWorkout.id);
              
              if (error) throw error;
          } else {
              await addToSyncQueue('update', 'workouts', workoutUpdate);
          }

          // --- UPDATE LOCAL CACHE ---
          if (user?.id) {
              const cached = localStorage.getItem(`cached_workouts_${user.id}`);
              if (cached) {
                  const workouts = JSON.parse(cached);
                  const updatedWorkouts = workouts.map((w: any) => {
                      if (w.id === activeWorkout.id) {
                          return { ...w, completed: true, completed_at: completedTimestamp, duration_seconds: durationSeconds };
                      }
                      return w;
                  });
                  localStorage.setItem(`cached_workouts_${user.id}`, JSON.stringify(updatedWorkouts));
              }
          }
          // --------------------------

          // 2. Perform secondary tasks (History cloning)
          // Use the current activeWorkout state because it's the most up-to-date and works offline
          try {
              const historyId = crypto.randomUUID();
              const historyWorkout = {
                  id: historyId,
                  title: activeWorkout.title,
                  description: activeWorkout.description,
                  trainer_id: user?.trainerId || null,
                  assigned_student_id: user?.id,
                  day_label: 'HISTORY_' + (activeWorkout.dayLabel || ''),
                  completed: true,
                  duration_seconds: durationSeconds,
                  completed_at: completedTimestamp,
                  planned_duration: activeWorkout.plannedDurationMinutes || 50
              };

              if (navigator.onLine) {
                  await supabase.from('workouts').insert(historyWorkout);
              } else {
                  await addToSyncQueue('insert', 'workouts', historyWorkout);
              }

              for (const ex of (activeWorkout.exercises || [])) {
                  const newExId = crypto.randomUUID();
                  const historyEx = {
                      id: newExId,
                      workout_id: historyId,
                      name: ex.name,
                      type: ex.type,
                      notes: ex.notes,
                      order_index: ex.orderIndex,
                      is_header: ex.isHeader,
                      is_superset: ex.isSuperset,
                      rest_time: ex.restTime
                  };

                  if (navigator.onLine) {
                      await supabase.from('workout_exercises').insert(historyEx);
                  } else {
                      await addToSyncQueue('insert', 'workout_exercises', historyEx);
                  }

                  if (ex.sets && ex.sets.length > 0) {
                      const newSets = ex.sets.map((s: any) => ({
                          id: crypto.randomUUID(),
                          exercise_id: newExId,
                          reps: s.reps,
                          weight: s.weight,
                          time: s.time,
                          intensity: s.intensity,
                          completed: s.completed,
                          created_at: new Date().toISOString()
                      }));
                      
                      if (navigator.onLine) {
                          await supabase.from('workout_sets').insert(newSets);
                      } else {
                          // addToSyncQueue handles single objects in loop if needed, 
                          // but for multiple sets we might need a small modification 
                          // to syncQueue or just loop here.
                          for (const s of newSets) {
                              await addToSyncQueue('insert', 'workout_sets', s);
                          }
                      }
                  }
              }
          } catch (historyErr) {
              console.warn("History cloning failed or queued:", historyErr);
          }

          window.dispatchEvent(new CustomEvent('workoutFinished'));
          setScreen(Screen.STUDENT_DASHBOARD);
          setActiveWorkout({ id: 'default', title: '', description: '', exercises: [], originalExercises: [], completed: false, durationSeconds: 0 });
      } catch(e) {
          console.error("Error in finishWorkout:", e);
          // If the main update failed and we are online, it might be a real error. 
          // If we are offline, it should have been caught in the if (navigator.onLine) block.
          // Fallback to queue if it failed
          await addToSyncQueue('update', 'workouts', workoutUpdate);
          
          window.dispatchEvent(new CustomEvent('workoutFinished'));
          setScreen(Screen.STUDENT_DASHBOARD);
          setActiveWorkout({ id: 'default', title: '', description: '', exercises: [], originalExercises: [], completed: false, durationSeconds: 0 });
      }
  };

  const resetWorkout = async (workoutId: string) => {
      try {
          await supabase.from('workouts').update({ completed: false, completed_at: null, duration_seconds: 0 }).eq('id', workoutId);
          
          localStorage.removeItem(`workout_start_time_${workoutId}`);
          localStorage.removeItem(`workout_accumulated_${workoutId}`);
          localStorage.removeItem('active_rest_end_time');

          const { data: exs } = await supabase.from('workout_exercises').select('id').eq('workout_id', workoutId);
          if (exs && exs.length > 0) {
              const { error } = await supabase.from('workout_sets').update({ completed: false, weight: 0 }).in('exercise_id', exs.map(e => e.id));
              
              if (error) console.error('Reset error:', error);
              
              const resetExs = activeWorkout.exercises.map(ex => ({
                  ...ex,
                  sets: ex.sets.map(s => ({ ...s, completed: false, weight: 0 }))
              }));

              if (activeWorkout.id === workoutId) {
                  setActiveWorkout(prev => ({ 
                      ...prev, 
                      completed: false, 
                      durationSeconds: 0, 
                      exercises: resetExs
                  }));
              }
          }
      } catch (e) {
          console.error("Error resetting workout:", e);
      }
  };

  const toggleFoodItem = (mealId: string, itemId: string) => {
      setDietPlan(prev => ({
          ...prev,
          meals: prev.meals.map(m => m.id !== mealId ? m : { ...m, items: m.items.map(i => i.id !== itemId ? i : { ...i, completed: !i.completed }) })
      }));
  };

  const selectStudentForProgress = (studentId: string, name: string, avatar?: string) => {
      setViewingStudent({ id: studentId, name, avatar, role: UserRole.STUDENT } as User);
  };

  const clearViewingStudent = () => setViewingStudent(null);

  const generateAccessCode = async () => {
      if (!user) return null;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error } = await supabase.from('invite_codes').insert({ code, trainer_id: user.id });
      return error ? null : code;
  };

  const selectChat = (chatId: string) => {
      setSelectedChatId(chatId);
      setScreen(Screen.CHAT_DETAIL);
  };

  const startChat = (participantId: string, name: string, avatar: string) => {
      const existing = chats.find(c => c.participantId === participantId);
      if (existing) {
          selectChat(existing.id);
      } else {
          const newChat: Chat = {
              id: participantId, participantId, participantName: name, participantAvatar: avatar,
              lastMessage: '', lastMessageTime: '', unreadCount: 0, messages: [], online: false
          };
          setChats(prev => [newChat, ...prev]);
          setSelectedChatId(newChat.id);
          setScreen(Screen.CHAT_DETAIL);
      }
  };

  const sendMessage = async (chatId: string, text: string, type: 'text' | 'image' = 'text', mediaUrl?: string) => {
      if (!user) return;
      const chat = chats.find(c => c.id === chatId);
      const receiverId = chat ? chat.participantId : chatId;
      try {
          const { error } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: receiverId, text, message_type: type, media_url: mediaUrl, created_at: new Date().toISOString() });
          if (!error) {
              await refreshChat(chatId);
              
              // Fetch user preference to respect notify_chat setting
              const { data: receiverProfile } = await supabase.from('profiles').select('notify_chat').eq('id', receiverId).limit(1).maybeSingle();
              
              if (receiverProfile?.notify_chat !== false) {
                  const pushTitle = `Mensagem de ${user.name || "Alguém"}`;
                  const pushBody = type === 'text' ? text : "Enviou uma imagem";
                  
                  sendPushNotification(receiverId, pushTitle, pushBody, "/");
              }
          }
      } catch (e) { console.error("Error sending message", e); }
  };

  const markChatAsRead = async (chatId: string) => {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c));
      if(!user) return;
      const chat = chats.find(c => c.id === chatId);
      if(chat) {
          await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('sender_id', chat.participantId).eq('receiver_id', user.id).is('read_at', null);
      }
  };

  const deleteChat = async (chatId: string) => {
      if (!user) return;
      try {
          await supabase.from('messages').delete().or(`and(sender_id.eq.${user.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${user.id})`);
          setChats(prev => prev.filter(c => c.id !== chatId));
          if (selectedChatId === chatId) {
              setSelectedChatId(null);
              setScreen(Screen.CHAT_LIST);
          }
      } catch (e) { console.error("Error deleting chat:", e); }
  };

  const openTrainerChat = async () => {
    if (!user || activeRole !== UserRole.STUDENT) return;
    try {
        const { data: profile } = await supabase.from('profiles').select('trainer_id').eq('id', user.id).single();
        let tId = profile?.trainer_id;
        if (!tId) {
             const { data: msgs } = await supabase.from('messages').select('sender_id, receiver_id').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(1);
             if (msgs && msgs.length > 0) tId = msgs[0].sender_id === user.id ? msgs[0].receiver_id : msgs[0].sender_id;
        }
        if (!tId) {
            const { data: trains } = await supabase.from('profiles').select('id').eq('role', 'TRAINER').limit(1);
            if (trains && trains.length > 0) tId = trains[0].id;
        }
        if (tId) {
            const { data: trn } = await supabase.from('profiles').select('name, avatar').eq('id', tId).single();
            if (trn) { startChat(tId, trn.name, trn.avatar); return; }
        }
        startChat('trainer_support', 'Suporte FITVLR', 'https://ui-avatars.com/api/?name=Suporte&background=13ec5b&color=102216');
    } catch (e) {
        startChat('trainer_support', 'Personal Trainer', 'https://ui-avatars.com/api/?name=Personal+Trainer&background=13ec5b&color=102216');
    }
  };

  const refreshAlerts = async () => {
      if (!user) return;
      try {
          const { data: readData } = await supabase.from('read_notifications').select('alert_id').eq('user_id', user.id);
          const readIds = new Set(readData?.map(r => r.alert_id) || []);
          const newAlerts: SmartAlert[] = [];
          const { data: messages } = await supabase.from('messages').select('id, sender_id, text, created_at, profiles!messages_sender_id_fkey(name, avatar)').eq('receiver_id', user.id).is('read_at', null).order('created_at', { ascending: false });
          if (messages) {
              const senders = new Map();
              messages.forEach((msg: any) => {
                  if (!senders.has(msg.sender_id)) senders.set(msg.sender_id, { count: 0, latest: msg, name: msg.profiles?.name || 'Usuário', avatar: msg.profiles?.avatar });
                  senders.get(msg.sender_id).count++;
              });
              senders.forEach((val, sId) => {
                  const aId = `msg-${sId}-${val.latest.id}`;
                  if (!readIds.has(aId)) newAlerts.push({ id: aId, studentId: sId, studentName: val.name, studentAvatar: val.avatar, type: 'INFO', title: 'Nova Mensagem', message: val.count === 1 ? val.latest.text : `${val.count} novas mensagens`, date: new Date(val.latest.created_at).toLocaleDateString('pt-BR'), read: false });
              });
          }
          if (user.role === UserRole.TRAINER) {
              const { data: reports } = await supabase.from('student_reports').select('*, profiles(name, avatar)').order('created_at', { ascending: false }).limit(20);
              if (reports) reports.forEach((r: any) => {
                  const aId = `report-${r.id}`;
                  if (!readIds.has(aId)) newAlerts.push({ id: aId, studentId: r.student_id, studentName: r.profiles?.name || 'Aluno', studentAvatar: r.profiles?.avatar, type: r.is_urgent ? 'URGENT' : 'WARNING', title: r.title || 'Relato do Aluno', message: r.message, date: new Date(r.created_at).toLocaleDateString('pt-BR'), read: false });
              });

              const { data: students } = await supabase.from('profiles').select('id, name, avatar').eq('trainer_id', user.id).eq('role', 'STUDENT');
              if (students && students.length > 0) {
                  const studentIds = students.map((s: any) => s.id);
                  const { data: assignedWorkouts } = await supabase.from('workouts').select('assigned_student_id').in('assigned_student_id', studentIds);
                  const studentsWithWorkouts = new Set(assignedWorkouts?.map((w: any) => w.assigned_student_id) || []);
                  
                  for (const st of students) {
                      if (!studentsWithWorkouts.has(st.id)) {
                          const aId = `no-workout-${st.id}`;
                          // Persistent alert until dismissed by system (when workout exists)
                          newAlerts.push({
                              id: aId,
                              studentId: st.id,
                              studentName: st.name,
                              studentAvatar: st.avatar,
                              type: 'URGENT',
                              title: 'Treino em Falta',
                              message: `O aluno ${st.name} não tem nenhum treino programado.`,
                              date: new Date().toLocaleDateString('pt-BR'),
                              read: false
                          });
                      }
                  }
              }
          } else {
              const { data: history } = await supabase.from('weight_history').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(1);
              let daysS = history && history.length > 0 ? Math.floor((Date.now() - new Date(history[0].date).getTime()) / (1000 * 60 * 60 * 24)) : 999;
              if (daysS >= 1) {
                   const aId = `weight-reminder-day-${new Date().toISOString().split('T')[0]}`;
                   if (!readIds.has(aId)) newAlerts.push({ id: aId, studentId: 'system', studentName: 'Lembrete', studentAvatar: '', type: 'WARNING', title: 'Atualizar Peso', message: daysS === 999 ? 'Registre seu peso inicial para acompanhar o progresso.' : (daysS === 1 ? 'Ainda não registaste o peso de hoje.' : `Faz ${daysS} dias que não registas o peso.`), date: new Date().toLocaleDateString('pt-BR'), read: false });
              }
          }
          const { data: sysNotifs } = await supabase.from('notifications').select('*, profiles!notifications_student_id_fkey(name, avatar)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
          if (sysNotifs) sysNotifs.forEach((n: any) => {
              if (!readIds.has(n.id)) newAlerts.push({ id: n.id, studentId: n.student_id || 'system', studentName: user.role === UserRole.TRAINER ? (n.profiles?.name || 'Registo Aluno') : 'PT', studentAvatar: user.role === UserRole.TRAINER ? (n.profiles?.avatar || '') : (user.trainerAvatar || ''), type: user.role === UserRole.TRAINER ? 'SUCCESS' : 'INFO', title: n.title, message: n.message, date: new Date(n.created_at).toLocaleDateString('pt-BR'), read: false });
          });
          prevAlertsLength.current = newAlerts.length;
          setAlerts(newAlerts);
      } catch (e) { console.error("Error refreshing alerts", e); }
  };

  const markAlertAsRead = async (alertId: string) => {
      const alert = alerts.find(a => a.id === alertId);
      if (alert?.title === 'Pedido de Alteração de Treino') return;
      if (alertId.startsWith('no-workout-')) return;
      setAlerts(prev => prev.filter(a => a.id !== alertId)); 
      if (user) await supabase.from('read_notifications').insert({ user_id: user.id, alert_id: alertId });
  };

  const markAllAlertsAsRead = async () => {
      const dismissableAlerts = alerts.filter(a => 
          !a.id.startsWith('no-workout-') && 
          a.title !== 'Pedido de Alteração de Treino'
      );
      const allIds = dismissableAlerts.map(a => a.id);
      
      setAlerts(prev => prev.filter(a => 
          a.id.startsWith('no-workout-') || 
          a.title === 'Pedido de Alteração de Treino'
      ));

      if (user && allIds.length > 0) {
          await supabase.from('read_notifications').insert(allIds.map(id => ({ user_id: user.id, alert_id: id })));
      }
  };
  
  const resolveWorkoutChangeRequest = async (studentId: string) => {
      await supabase.from('student_reports')
          .delete()
          .eq('student_id', studentId)
          .eq('title', 'Pedido de Alteração de Treino');
      refreshAlerts();
  };

  const hasPendingWorkoutChangeRequest = async (studentId: string) => {
      const { data } = await supabase.from('student_reports')
          .select('id')
          .eq('student_id', studentId)
          .eq('title', 'Pedido de Alteração de Treino')
          .limit(1);
      return !!data && data.length > 0;
  };

  const reportIssue = async (title: string, message: string, urgent: boolean) => {
      if (!user) return;
      await supabase.from('student_reports').insert({ student_id: user.id, title, message, is_urgent: urgent });
  };

  const reloadData = async () => {
      if (user) await Promise.all([loadStudentData(user.id), refreshAlerts(), loadChats(user.id)]);
  };

  const switchRole = (role: UserRole) => {
      if (!user) return;
      setActiveRole(role);
      localStorage.setItem('fitvlr-active-role', role);
      setViewingStudent(null);
      if (role === UserRole.STUDENT) {
          loadStudentData(user.id);
          setScreen(Screen.STUDENT_DASHBOARD);
      } else {
          setScreen(Screen.TRAINER_DASHBOARD);
      }
  };

    const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert("As notificações não são suportadas neste dispositivo/browser. No iOS podes precisar de adicionar à página inicial primeiro.");
      return;
    }

    try {
      let permission = Notification.permission;
      
      if (permission !== 'granted' && permission !== 'denied') {
        const requestPromise = Notification.requestPermission();
        if (requestPromise instanceof Promise) {
            permission = await requestPromise;
        } else {
            // Callback fallback for older iOS Safari
            permission = await new Promise(resolve => Notification.requestPermission(resolve));
        }
      }

      if (permission === 'granted') {
        const { requestFirebaseToken } = await import('../lib/firebase');
        const token = await requestFirebaseToken();
        
        if (token && user) {
          await supabase.from('profiles').update({ fcm_token: token }).eq('id', user.id);
        }
      }
    } catch (error) {
      console.error("Erro ao pedir permissões/token de notificação", error);
    }
  };

  const sendPushNotification = async (targetUserId: string, title: string, body: string, url: string = "/") => {
    try {
        const { data: profile } = await supabase.from('profiles').select('fcm_token').eq('id', targetUserId).limit(1).maybeSingle();
        
        await supabase.functions.invoke('send-push', {
            body: {
                targetUserId,
                fcmToken: profile?.fcm_token || null,
                title,
                body,
                url
            }
        });
    } catch (err) {
        // Fail silent
        console.error("sendPush error:", err);
    }
  };

  return (
    <AppContext.Provider value={{
      currentScreen, previousScreen, setScreen, user, login, register, recoverPassword, logout,
      updateUserProfile, updatePassword,
      activeWorkout, setActiveWorkout, updateSet, finishWorkout, resetWorkout,
      dietPlan, toggleFoodItem,
      progress, addWeightEntry, updateWeightEntry, deleteWeightEntry,
      chats, selectedChatId, selectChat, startChat, sendMessage, refreshChat, markChatAsRead, deleteChat, openTrainerChat,
      sendPushNotification,
      viewingStudent, selectStudentForProgress, clearViewingStudent, generateAccessCode, resolveWorkoutChangeRequest, hasPendingWorkoutChangeRequest,
      editingTemplateId, setEditingTemplateId,
      alerts, refreshAlerts, markAlertAsRead, markAllAlertsAsRead, reportIssue, reloadData,
      activeRole, switchRole, theme, toggleTheme, isAuthReady, requestNotificationPermission
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

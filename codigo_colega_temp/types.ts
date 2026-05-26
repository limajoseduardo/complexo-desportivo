
export enum UserRole {
  STUDENT = 'STUDENT',
  TRAINER = 'TRAINER'
}

export enum Screen {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  ONBOARDING = 'ONBOARDING',
  STUDENT_DASHBOARD = 'STUDENT_DASHBOARD',
  WORKOUT_PLAN = 'WORKOUT_PLAN',
  DIET_PLAN = 'DIET_PLAN',
  PROGRESS = 'PROGRESS',
  CHAT_LIST = 'CHAT_LIST',
  CHAT_DETAIL = 'CHAT_DETAIL',
  TRAINER_DASHBOARD = 'TRAINER_DASHBOARD',
  STUDENT_LIST = 'STUDENT_LIST',
  WORKOUT_CREATOR = 'WORKOUT_CREATOR',
  DIET_CREATOR = 'DIET_CREATOR',
  TRAINER_EDIT_WORKOUT = 'TRAINER_EDIT_WORKOUT',
  TRAINER_EDIT_DIET = 'TRAINER_EDIT_DIET',
  TRAINER_STUDENT_DETAIL = 'TRAINER_STUDENT_DETAIL',
  EXERCISE_BANK = 'EXERCISE_BANK',
  FOOD_BANK = 'FOOD_BANK',
  PERFORMANCE_HISTORY = 'PERFORMANCE_HISTORY',
  ALERTS = 'ALERTS',
  PROFILE = 'PROFILE',
  PROFILE_EDIT = 'PROFILE_EDIT',
  PROFILE_NOTIFICATIONS = 'PROFILE_NOTIFICATIONS',
  PROFILE_SECURITY = 'PROFILE_SECURITY',
  PROFILE_HELP = 'PROFILE_HELP',
  PROFILE_REPORT_ISSUE = 'PROFILE_REPORT_ISSUE',
  RESET_PASSWORD = 'RESET_PASSWORD',
  LEADERBOARD = 'LEADERBOARD',
  WORKOUT_TEMPLATES = 'WORKOUT_TEMPLATES',
  TRAINER_EDIT_TEMPLATE = 'TRAINER_EDIT_TEMPLATE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  TRAINER_BUG_REPORTS = 'TRAINER_BUG_REPORTS',
  TRAINER_DESKTOP_ADMIN = 'TRAINER_DESKTOP_ADMIN'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  goal?: string;
  weight?: number;
  height?: number;
  initialWeight?: number;
  targetWeight?: number;
  birthdate?: string;
  gender?: 'MALE' | 'FEMALE';
  bodyFat?: number;
  // Macro Targets
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  // Notification Preferences
  notifyWorkout?: boolean;
  notifyChat?: boolean;
  notifyDiet?: boolean;
  // App State Persistance
  hasSeenTour?: boolean;
  hasSeenWorkoutTour?: boolean;
  hasSeenSessionTour?: boolean;
  hasSeenPerformanceTour?: boolean;
  hasSeenLeaderboardTour?: boolean;
  restDays?: number[];
  trainingFrequency?: number;
  trainerId?: string;
  trainerAvatar?: string;
  theme?: 'light' | 'dark';
  activityFactor?: number;
  proteinMultiplier?: number;
  diet_plan_name?: string;
}

export interface WorkoutSet {
  id: string;
  reps?: number;
  weight?: number;
  time?: string; // For Cárdio
  intensity?: number; // For Cárdio (1-5)
  notes?: string; // Student notes for the set (e.g. cardio notes)
  completed: boolean;
  trackingMode?: 'reps' | 'seconds';
}

export interface Exercise {
  id: string;
  name: string;
  type?: 'STRENGTH' | 'CARDIO';
  exerciseLibraryId?: string; // Link to global library for PR tracking
  sets: WorkoutSet[];
  notes?: string;
  restTime?: string;
  isHeader?: boolean; // New property for grouping
  isSuperset?: boolean; // New property for supersets
  trackingMode?: 'reps' | 'seconds';
  parent_exercise_id?: string; // For alternative exercises
  alternatives?: Exercise[];
}

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  primary_muscle: string;
  secondary_muscle?: string;
  video_url?: string;
}

export interface WorkoutSession {
  id: string;
  title: string;
  description: string;
  exercises: Exercise[];
  originalExercises?: Exercise[];
  completed: boolean;
  durationSeconds: number;
  plannedDurationMinutes?: number; // New field for specified duration
  date?: string;
  assignedStudentId?: string; // Optional for linking to student
}

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  completed: boolean;
  quantity: string;
  image?: string;
  is_extra?: boolean;
}

export interface Meal {
  id: string;
  name: string;
  targetCalories: number;
  items: FoodItem[];
}

export interface DietPlan {
  id: string;
  date: string;
  meals: Meal[];
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  name?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  type: 'text' | 'image';
  mediaUrl?: string;
  readAt?: string; // Timestamp when the message was read
}

export interface Chat {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageTs?: number; // Timestamp for sorting
  unreadCount: number;
  messages: ChatMessage[];
  online: boolean;
  lastSeen?: string; // New property for timestamp
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  waist?: number;
  photo_front?: string;
  photo_side?: string;
  photo_back?: string;
}

export interface BugReport {
  id: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  message: string;
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
  deviceInfo?: string;
  screenshotUrl?: string;
}

export type AlertType = 'WARNING' | 'SUCCESS' | 'URGENT' | 'INFO';

export interface SmartAlert {
  id: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  type: AlertType;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface WorkoutTemplate {
  id: string;
  trainer_id: string;
  name: string;
  description?: string;
  category?: string; // e.g. "Hypertrophy", "Beginner"
  split_count: number;
  data: {
    sessions: {
      day_label: string;
      title: string;
      exercises: {
        name: string;
        type: 'STRENGTH' | 'CARDIO';
        isHeader?: boolean;
        isSuperset?: boolean;
        notes?: string;
        restTime?: string;
        sets: {
          reps?: number;
          weight?: number;
          time?: string;
          intensity?: number;
          notes?: string;
        }[];
      }[];
    }[];
  };
  created_at: string;
}

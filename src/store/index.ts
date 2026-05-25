import { create } from 'zustand';
import { UserProfile, OperationalLog } from '../types';

interface GlobalState {
  // Session / Auth
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Data
  utentes: UserProfile[];
  setUtentes: (utentes: UserProfile[]) => void;
  logs: OperationalLog[];
  setLogs: (logs: OperationalLog[]) => void;

  // Notifications / Globals
  totalUnread: number;
  setTotalUnread: (count: number) => void;
  
  // Modals & UI Overlays
  viewingProfile: UserProfile | null;
  setViewingProfile: (u: UserProfile | null) => void;
  showScanner: boolean;
  setShowScanner: (show: boolean) => void;
  showBugReport: boolean;
  setShowBugReport: (show: boolean) => void;
  rfidToast: { message: string; type: 'success' | 'error' } | null;
  setRfidToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

export const useStore = create<GlobalState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  
  activeTab: 'inicio',
  setActiveTab: (tab) => set({ activeTab: tab }),

  utentes: [],
  setUtentes: (utentes) => set({ utentes }),

  logs: [],
  setLogs: (logs) => set({ logs }),

  totalUnread: 0,
  setTotalUnread: (count) => set({ totalUnread: count }),

  viewingProfile: null,
  setViewingProfile: (u) => set({ viewingProfile: u }),

  showScanner: false,
  setShowScanner: (show) => set({ showScanner: show }),

  showBugReport: false,
  setShowBugReport: (show) => set({ showBugReport: show }),

  rfidToast: null,
  setRfidToast: (toast) => set({ rfidToast: toast }),
}));

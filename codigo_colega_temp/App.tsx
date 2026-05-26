
import React, { useEffect, Suspense, lazy } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'motion/react';
import { Screen, UserRole } from './types';
import { AppProvider, useApp } from './contexts/AppContext';
import { Navigation } from './components/Navigation';
import { NotificationPrompt } from './components/NotificationPrompt';
import { processSyncQueue } from './lib/syncQueue';

const LoginView = lazy(() => import('./views/LoginView'));
const StudentDashboard = lazy(() => import('./views/student/StudentDashboard'));
const OnboardingView = lazy(() => import('./views/student/OnboardingView'));
const TrainerDashboard = lazy(() => import('./views/trainer/TrainerDashboard'));
const WorkoutView = lazy(() => import('./views/student/WorkoutView'));
const DietView = lazy(() => import('./views/student/DietView'));
const ProgressView = lazy(() => import('./views/student/ProgressView'));
const ChatListView = lazy(() => import('./views/ChatListView'));
const ChatDetailView = lazy(() => import('./views/ChatDetailView'));
const StudentListView = lazy(() => import('./views/trainer/StudentListView'));
const StudentDetailView = lazy(() => import('./views/trainer/StudentDetailView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
import { EditProfileView, HelpView, NotificationsView, SecurityView } from './views/ProfileSubViews';
const ReportIssueView = lazy(() => import('./views/student/ReportIssueView'));
const SubscriptionView = lazy(() => import('./views/SubscriptionView'));
const WorkoutCreatorView = lazy(() => import('./views/trainer/WorkoutCreatorView'));
const DietCreatorView = lazy(() => import('./views/trainer/DietCreatorView'));
const AlertsView = lazy(() => import('./views/trainer/AlertsView'));
const TrainerEditWorkoutView = lazy(() => import('./views/trainer/TrainerEditWorkoutView'));
const TrainerEditDietView = lazy(() => import('./views/trainer/TrainerEditDietView'));
const PerformanceHistoryView = lazy(() => import('./views/PerformanceHistoryView'));
const ResetPasswordView = lazy(() => import('./views/ResetPasswordView'));
const ExerciseBankView = lazy(() => import('./views/trainer/ExerciseBankView'));
const FoodBankView = lazy(() => import('./views/trainer/FoodBankView'));
const LandingView = lazy(() => import('./views/LandingView'));
const LeaderboardView = lazy(() => import('./views/student/LeaderboardView'));
const WorkoutTemplatesView = lazy(() => import('./views/trainer/WorkoutTemplatesView'));
const TrainerEditTemplateView = lazy(() => import('./views/trainer/TrainerEditTemplateView'));
const BugReportsView = lazy(() => import('./views/trainer/BugReportsView'));
const TrainerDesktopDashboard = lazy(() => import('./views/trainer/desktop/TrainerDesktopDashboard'));

const MainNavigator = () => {
  const { currentScreen, previousScreen, setScreen, login, register, recoverPassword, user, activeRole, selectedChatId, selectChat, viewingStudent, clearViewingStudent, isAuthReady, activeWorkout, requestNotificationPermission } = useApp();

  useEffect(() => {
    processSyncQueue();
    window.addEventListener('online', processSyncQueue);
    return () => window.removeEventListener('online', processSyncQueue);
  }, []);

  // Request notification permission once at startup for logged-in users
  useEffect(() => {
      if (isAuthReady && user) {
          if (Notification.permission === 'default') {
              const timer = setTimeout(() => {
                  requestNotificationPermission();
              }, 3000);
              return () => clearTimeout(timer);
          } else if (Notification.permission === 'granted') {
              requestNotificationPermission();
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, user?.id]);

  const [visitedScreens, setVisitedScreens] = React.useState<Set<Screen>>(new Set([currentScreen]));

  useEffect(() => {
    setVisitedScreens(prev => {
        if (!prev.has(currentScreen)) {
            const newSet = new Set(prev);
            newSet.add(currentScreen);
            return newSet;
        }
        return prev;
    });
  }, [currentScreen]);

  const handleProgressBack = () => {
    if (viewingStudent) {
        setScreen(Screen.TRAINER_STUDENT_DETAIL);
    } else {
        setScreen(Screen.STUDENT_DASHBOARD);
    }
  };

  const handleChatDetailBack = () => {
      if (previousScreen === Screen.TRAINER_STUDENT_DETAIL) {
          setScreen(Screen.TRAINER_STUDENT_DETAIL);
      } else {
          setScreen(Screen.CHAT_LIST);
      }
  };

  const handleReportBack = () => {
    // List of screens we DON'T want to go back to automatically if they are just transitional or irrelevant
    const blacklisted = [Screen.LOGIN, Screen.LANDING, Screen.ONBOARDING, Screen.RESET_PASSWORD, Screen.PROFILE];
    
    // If the previous screen was Profile, we prefer going to Dashboard often to avoid return loops
    // But specifically, if the user was reporting a bug, they probably want to see their dashboard after success
    if (previousScreen && !blacklisted.includes(previousScreen) && previousScreen !== currentScreen) {
        setScreen(previousScreen);
    } else {
        setScreen(activeRole === UserRole.TRAINER ? Screen.TRAINER_DASHBOARD : Screen.STUDENT_DASHBOARD);
    }
  };

  const isStudentUser = user?.role === UserRole.STUDENT;

  const [currentPath, setCurrentPath] = React.useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const renderScreen = () => {
    const isDesktopAdminPath = currentPath === '/ptadmin' || window.location.pathname === '/ptadmin';
    if (isDesktopAdminPath) {
      if (!user) {
        return <LoginView onLogin={login} onRegister={register} onRecover={recoverPassword} />;
      }
      if (user.role === UserRole.TRAINER) {
        return <TrainerDesktopDashboard />;
      }
      return (
        <div className="flex h-full w-full items-center justify-center bg-background text-main flex-col gap-4 p-8 text-center animate-enter">
            <span className="material-symbols-outlined text-6xl text-primary mb-2">lock</span>
            <h1 className="text-3xl font-bold">Acesso Restrito</h1>
            <p className="text-muted-foreground text-lg mb-4">Esta área do sistema é reservada apenas para Personal Trainers.</p>
            <button 
                onClick={() => { window.location.href = '/?pwa=true'; }} 
                className="px-8 py-4 bg-primary text-white rounded-2xl font-medium w-full sm:w-auto hover:opacity-90 active:scale-95 transition-all outline-none"
            >
                Entrar como Aluno
            </button>
        </div>
      );
    }

    switch (currentScreen) {
      case Screen.LANDING:
        return <LandingView onNavigate={setScreen} />;
        
      case Screen.LOGIN:
        return <LoginView onLogin={login} onRegister={register} onRecover={recoverPassword} />;
      
      case Screen.RESET_PASSWORD:
        return <ResetPasswordView />;

      // Student Views
      case Screen.STUDENT_DASHBOARD:
        if (!isStudentUser) return null;
        return <StudentDashboard onNavigate={setScreen} />;
      case Screen.ONBOARDING:
        return <OnboardingView />;
      case Screen.WORKOUT_PLAN:
        if (!isStudentUser) return null;
        return <WorkoutView onBack={() => setScreen(Screen.STUDENT_DASHBOARD)} />;
      case Screen.DIET_PLAN:
        if (!isStudentUser) return null;
        return <DietView onBack={() => setScreen(Screen.STUDENT_DASHBOARD)} />;
      case Screen.PROGRESS:
        if (!isStudentUser) return null;
        return <ProgressView onBack={handleProgressBack} />;
      
      // Trainer Views
      case Screen.TRAINER_DASHBOARD:
        return <TrainerDashboard onNavigate={(screen) => { if (screen === Screen.TRAINER_DASHBOARD) clearViewingStudent(); setScreen(screen); }} />;
      case Screen.STUDENT_LIST:
        return <StudentListView onBack={() => { clearViewingStudent(); setScreen(Screen.TRAINER_DASHBOARD); }} />;
      case Screen.TRAINER_STUDENT_DETAIL:
        return <StudentDetailView onBack={() => { clearViewingStudent(); setScreen(Screen.STUDENT_LIST); }} />;
      case Screen.WORKOUT_CREATOR:
        return <WorkoutCreatorView onBack={() => setScreen(Screen.TRAINER_STUDENT_DETAIL)} />;
      case Screen.DIET_CREATOR:
        return <DietCreatorView onBack={() => setScreen(Screen.TRAINER_STUDENT_DETAIL)} />;
      case Screen.TRAINER_EDIT_WORKOUT:
        return <TrainerEditWorkoutView onBack={() => setScreen(Screen.TRAINER_STUDENT_DETAIL)} />;
      case Screen.TRAINER_EDIT_DIET:
        return <TrainerEditDietView onBack={() => setScreen(Screen.TRAINER_STUDENT_DETAIL)} />;
      case Screen.EXERCISE_BANK:
        return <ExerciseBankView onBack={() => setScreen(Screen.TRAINER_DASHBOARD)} />;
      case Screen.FOOD_BANK:
        return <FoodBankView onBack={() => setScreen(Screen.TRAINER_DASHBOARD)} />;
      case Screen.PERFORMANCE_HISTORY:
        return <PerformanceHistoryView onBack={() => setScreen(activeRole === UserRole.TRAINER ? Screen.TRAINER_STUDENT_DETAIL : Screen.STUDENT_DASHBOARD)} />;
      case Screen.ALERTS:
        return <AlertsView onBack={() => setScreen(activeRole === UserRole.TRAINER ? Screen.TRAINER_DASHBOARD : Screen.STUDENT_DASHBOARD)} />;
      case Screen.LEADERBOARD:
        if (isStudentUser) return null;
        return <LeaderboardView onBack={() => setScreen(activeRole === UserRole.TRAINER ? Screen.TRAINER_DASHBOARD : Screen.STUDENT_DASHBOARD)} />;

      case Screen.WORKOUT_TEMPLATES:
        return <WorkoutTemplatesView onBack={() => setScreen(Screen.TRAINER_DASHBOARD)} />;
      case Screen.TRAINER_EDIT_TEMPLATE:
        return <TrainerEditTemplateView onBack={() => setScreen(Screen.WORKOUT_TEMPLATES)} />;

      case Screen.TRAINER_BUG_REPORTS:
        return <BugReportsView onBack={() => setScreen(Screen.TRAINER_DASHBOARD)} />;

      case Screen.TRAINER_DESKTOP_ADMIN:
        return <TrainerDesktopDashboard />;

      // Shared Views
      case Screen.CHAT_LIST:
        return (
          <ChatListView 
            onBack={() => setScreen(activeRole === UserRole.STUDENT ? Screen.STUDENT_DASHBOARD : Screen.TRAINER_DASHBOARD)} 
            onSelectChat={selectChat}
          />
        );
      case Screen.CHAT_DETAIL:
        return <ChatDetailView onBack={handleChatDetailBack} chatId={selectedChatId} />;
      
      case Screen.PROFILE:
        return <ProfileView />;
        
      // Profile Sub Views
      case Screen.PROFILE_EDIT:
        return <EditProfileView onBack={() => setScreen(Screen.PROFILE)} />;
      case Screen.PROFILE_NOTIFICATIONS:
        return <NotificationsView onBack={() => setScreen(Screen.PROFILE)} />;
      case Screen.PROFILE_SECURITY:
        return <SecurityView onBack={() => setScreen(Screen.PROFILE)} />;
      case Screen.PROFILE_HELP:
        return <HelpView onBack={() => setScreen(Screen.PROFILE)} />;
      case Screen.PROFILE_REPORT_ISSUE:
        return <ReportIssueView onBack={handleReportBack} />;
      case Screen.SUBSCRIPTION:
        return <SubscriptionView onBack={() => setScreen(Screen.PROFILE)} />;

      default:
        return <LandingView onNavigate={setScreen} />;
    }
  };

  const isLanding = currentScreen === Screen.LANDING && window.location.pathname !== '/ptadmin';
  const isDesktopAdmin = currentScreen === Screen.TRAINER_DESKTOP_ADMIN || window.location.pathname === '/ptadmin';
  const isDashboard = currentScreen === Screen.STUDENT_DASHBOARD || currentScreen === Screen.TRAINER_DASHBOARD;

  const showsNavigation = !isDesktopAdmin && [
    Screen.STUDENT_DASHBOARD,
    Screen.WORKOUT_PLAN,
    Screen.DIET_PLAN,
    Screen.PROGRESS,
    Screen.TRAINER_DASHBOARD,
    Screen.STUDENT_LIST,
    Screen.TRAINER_STUDENT_DETAIL,
    Screen.PERFORMANCE_HISTORY,
    Screen.ALERTS,
    Screen.CHAT_LIST,
    Screen.PROFILE,
    Screen.PROFILE_EDIT,
    Screen.PROFILE_NOTIFICATIONS,
    Screen.PROFILE_SECURITY,
    Screen.PROFILE_HELP,
    Screen.PROFILE_REPORT_ISSUE,
    Screen.SUBSCRIPTION,
    Screen.LEADERBOARD,
    Screen.TRAINER_BUG_REPORTS
  ].includes(currentScreen) && !(currentScreen === Screen.WORKOUT_PLAN && activeWorkout.id !== 'default');

  const getNavActiveScreen = () => {
    if (currentScreen === Screen.TRAINER_STUDENT_DETAIL) return Screen.STUDENT_LIST;
    if (String(currentScreen).startsWith('PROFILE_') || currentScreen === Screen.SUBSCRIPTION) return Screen.PROFILE;
    return currentScreen;
  };

  const isPersistentStudentScreen = isStudentUser && [
      Screen.STUDENT_DASHBOARD,
      Screen.WORKOUT_PLAN,
      Screen.DIET_PLAN,
      Screen.PROGRESS,
      Screen.LEADERBOARD
  ].includes(currentScreen);

  return (
    <div className={`bg-background font-sans text-main relative ${isDesktopAdmin ? 'h-[100dvh] overflow-hidden flex flex-col' : (isLanding ? 'h-[100dvh] overflow-y-auto flex flex-col' : 'h-[100dvh] overflow-hidden max-w-md mx-auto shadow-2xl pt-safe pl-safe pr-safe flex flex-col')}`}>
      {!isAuthReady ? (
        <div className="bg-background h-[100dvh] flex flex-col items-center justify-center p-6 text-center w-full">
           <div className="w-24 h-24 bg-primary rounded-[2rem] overflow-hidden shadow-2xl shadow-primary/20 animate-pulse mb-6">
              <img src="/icon-192x192.png" alt="Loading..." className="w-full h-full object-cover" />
           </div>
           <div className="flex gap-2">
              <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></div>
           </div>
        </div>
      ) : (
        <>
          {user && isDashboard && <NotificationPrompt />}

          <main className={`flex-1 flex flex-col w-full relative ${isLanding ? '' : 'h-full overflow-hidden'}`}>
            <Suspense fallback={<div className="flex h-full w-full items-center justify-center bg-background"><span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span></div>}>
                {!isPersistentStudentScreen && (
                    <motion.div
                       key={isDesktopAdmin ? 'desktop-admin' : currentScreen}
                       initial={{ opacity: 0, x: 5 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ duration: 0.1, ease: "easeOut" }}
                       className={`flex-1 flex flex-col w-full ${isLanding ? '' : 'h-full overflow-hidden'}`}
                    >
                      {renderScreen()}
                    </motion.div>
                )}

              {/* Persistent Student Screens */}
              {isStudentUser && (
                 <>
                    <div className={`flex-1 overflow-hidden w-full h-full ${currentScreen === Screen.STUDENT_DASHBOARD ? 'flex flex-col animate-in fade-in' : 'hidden'}`}>
                        {(currentScreen === Screen.STUDENT_DASHBOARD || visitedScreens.has(Screen.STUDENT_DASHBOARD)) && <StudentDashboard onNavigate={setScreen} />}
                    </div>
                    <div className={`flex-1 overflow-hidden w-full h-full ${currentScreen === Screen.WORKOUT_PLAN ? 'flex flex-col animate-in fade-in' : 'hidden'}`}>
                        {(currentScreen === Screen.WORKOUT_PLAN || visitedScreens.has(Screen.WORKOUT_PLAN)) && <WorkoutView onBack={() => setScreen(Screen.STUDENT_DASHBOARD)} />}
                    </div>
                    <div className={`flex-1 overflow-hidden w-full h-full ${currentScreen === Screen.DIET_PLAN ? 'flex flex-col animate-in fade-in' : 'hidden'}`}>
                        {(currentScreen === Screen.DIET_PLAN || visitedScreens.has(Screen.DIET_PLAN)) && <DietView onBack={() => setScreen(Screen.STUDENT_DASHBOARD)} />}
                    </div>
                    <div className={`flex-1 overflow-hidden w-full h-full ${currentScreen === Screen.PROGRESS ? 'flex flex-col animate-in fade-in' : 'hidden'}`}>
                        {(currentScreen === Screen.PROGRESS || visitedScreens.has(Screen.PROGRESS)) && <ProgressView onBack={handleProgressBack} />}
                    </div>
                    <div className={`flex-1 overflow-hidden w-full h-full ${currentScreen === Screen.LEADERBOARD ? 'flex flex-col animate-in fade-in' : 'hidden'}`}>
                        {(currentScreen === Screen.LEADERBOARD || visitedScreens.has(Screen.LEADERBOARD)) && <LeaderboardView onBack={() => setScreen(Screen.STUDENT_DASHBOARD)} />}
                    </div>
                 </>
              )}
            </Suspense>
          </main>

          {showsNavigation && (
            <Navigation 
              activeScreen={getNavActiveScreen()} 
              onNavigate={(screen) => {
                if ([Screen.TRAINER_DASHBOARD, Screen.STUDENT_LIST, Screen.STUDENT_DASHBOARD].includes(screen)) {
                    clearViewingStudent();
                }
                setScreen(screen);
              }} 
              role={user?.role || activeRole || 'STUDENT'} 
            />
          )}
        </>
      )}
    </div>
  );
};



export default function App() {
  return (
    <AppProvider>
      <MainNavigator />
    </AppProvider>
  );
}

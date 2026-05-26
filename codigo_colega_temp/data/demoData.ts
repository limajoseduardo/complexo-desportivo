
export const demoUser = {
  id: 'demo-user-1',
  name: 'Demo Student',
  email: 'demo@fitvlr.com',
  avatar: 'https://ui-avatars.com/api/?name=Demo+Student',
  role: 'STUDENT',
  goal: 'Emagrecimento',
  weight: 75,
  height: 175,
  initialWeight: 80,
  targetWeight: 70,
  birthdate: '1995-01-01',
  gender: 'male',
  bodyFat: 20,
  targetCalories: 2000,
  targetProtein: 150,
  targetCarbs: 200,
  targetFat: 60,
  notifyWorkout: true,
  notifyChat: true,
  notifyDiet: true,
  hasSeenTour: true,
  hasSeenWorkoutTour: true,
  hasSeenSessionTour: true,
  hasSeenPerformanceTour: true,
  hasSeenLeaderboardTour: true,
  restDays: [0, 6],
  trainingFrequency: 5,
  theme: 'light',
  activityFactor: 1.2,
  proteinMultiplier: 2.0
};

export const demoChats = [{
  id: 'trainer-1',
  participantId: 'trainer-1',
  participantName: 'Personal Trainer Demo',
  participantAvatar: 'https://ui-avatars.com/api/?name=Trainer',
  lastMessage: 'Bom treino hoje!',
  lastMessageTime: '10:00',
  lastMessageTs: Date.now(),
  unreadCount: 0,
  messages: [{
    id: 'msg-1',
    senderId: 'trainer-1',
    text: 'Bom treino hoje!',
    timestamp: '10:00',
    type: 'text'
  }],
  online: true,
  lastSeen: new Date().toISOString()
}];

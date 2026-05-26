importScripts("https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js");

// IMPORTANTE: Cola aqui a MESMA configuração que colocaste no src/lib/firebase.ts
const firebaseConfig = {
  apiKey: "AIzaSyBF7piJ8_ocOpDYFCwVLv19m_KVzwSMrL8",
  authDomain: "fitt-6c6d4.firebaseapp.com",
  projectId: "fitt-6c6d4",
  storageBucket: "fitt-6c6d4.firebasestorage.app",
  messagingSenderId: "688286083506",
  appId: "1:688286083506:web:86ee2555c5356d0116dcab"
};

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Intercetar background messages (Dados adicionais podem ser tratados aqui)
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.data?.title || "Nova Notificação";
  const notificationOptions = {
    body: payload.data?.body || "Tens uma nova mensagem no chat.",
    icon: "/icon-192x192.png", 
    badge: "/badge.png", 
    data: {
      url: payload.data?.url || "/",
    }
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Ao clicar na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url;
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(windowClients) {
      // Se já houver uma janela aberta do app, foca-a
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não houver, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Forçar ativação imediata para instalação mais rápida (PWA)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

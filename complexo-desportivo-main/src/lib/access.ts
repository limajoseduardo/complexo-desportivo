import { db } from './firebase';
import { APP_ID } from '../App';
import { 
  collection, addDoc, query, where, getDocs, orderBy, limit,
  Timestamp, serverTimestamp, updateDoc, doc
} from 'firebase/firestore';
import { UserProfile } from '../types';

export const handleCheckIn = async (user: UserProfile, zone: string = 'Ginásio') => {
  const usersPath = `artifacts/${APP_ID}/public/data/users`;
  const logsPath = `artifacts/${APP_ID}/public/data/logs_acesso`;
  const userRef = doc(db, usersPath, user.id);

  try {
    await addDoc(collection(db, logsPath), {
      userId: user.id,
      userName: user.nome || user.n || 'Utente',
      userRole: user.role,
      modalidade: user.modalidade || 'Acesso Livre',
      checkIn: serverTimestamp(),
      zone,
      date: new Date().toISOString().split('T')[0]
    });
  } catch (logError) {
    console.error("Error creating check-in log:", logError);
  }

  await updateDoc(userRef, {
    isInside: true,
    location: zone,
    updatedAt: new Date().toISOString()
  });
};

export const handleCheckOut = async (user: UserProfile) => {
  const usersPath = `artifacts/${APP_ID}/public/data/users`;
  const logsPath = `artifacts/${APP_ID}/public/data/logs_acesso`;
  const userRef = doc(db, usersPath, user.id);
  
  try {
    // 1. Find Open Log (try most recent log for this user)
    const q = query(
      collection(db, logsPath),
      where('userId', '==', user.id),
      orderBy('checkIn', 'desc'),
      limit(1)
    );
    
    let snap;
    try {
      snap = await getDocs(q);
    } catch (err) {
      console.warn("Log query failed (likely missing index), trying fallback:", err);
      // Fallback: search without orderBy
      const qFallback = query(collection(db, logsPath), where('userId', '==', user.id), limit(20));
      snap = await getDocs(qFallback);
    }
    
    if (snap && !snap.empty) {
      // Find the most recent log where checkOut is null
      const openLogs = snap.docs
        .filter(d => !d.data().checkOut)
        .sort((a,b) => {
          const aData = a.data();
          const bData = b.data();
          const aTime = aData.checkIn?.seconds || 0;
          const bTime = bData.checkIn?.seconds || 0;
          return bTime - aTime;
        });

      if (openLogs.length > 0) {
        const logDoc = openLogs[0];
        const logData = logDoc.data();
        
        let checkInDate: Date;
        
        if (logData.checkIn instanceof Timestamp) {
          checkInDate = logData.checkIn.toDate();
        } else if (logData.checkIn && typeof logData.checkIn === 'object' && 'seconds' in logData.checkIn) {
          checkInDate = new Date(logData.checkIn.seconds * 1000);
        } else if (logData.checkIn) {
          checkInDate = new Date(logData.checkIn);
        } else {
          checkInDate = new Date();
        }

        if (isNaN(checkInDate.getTime())) {
          checkInDate = new Date();
        }

        const now = new Date();
        const duration = Math.max(1, Math.round((now.getTime() - checkInDate.getTime()) / (1000 * 60)));

        await updateDoc(doc(db, logsPath, logDoc.id), {
          checkOut: serverTimestamp(),
          durationMinutes: duration
        });
      }
    }
  } catch (logError) {
    console.error("Error updating log during checkout:", logError);
    // Continue anyway to update user status
  }

  // 2. Update User Status
  try {
    await updateDoc(userRef, {
      isInside: false,
      location: null,
      updatedAt: new Date().toISOString()
    });
  } catch (userError) {
    console.error("Error updating user status during checkout:", userError);
    throw userError;
  }
};

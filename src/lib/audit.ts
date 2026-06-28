import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, APP_ID } from './firebase';

// Histórico de quem criou/alterou cada utente e que campos mudaram — visível
// no perfil para staff/admin. Gravação "best effort": uma falha aqui nunca deve
// impedir o save real do perfil, por isso os erros são só avisados na consola.
export async function logProfileAudit(params: {
  utenteId: string;
  utenteNome: string;
  action: 'criação' | 'edição';
  campos: string[];
  autorId?: string;
  autorNome: string;
  autorRole?: string;
}) {
  if (params.campos.length === 0) return;
  try {
    await addDoc(collection(db, `artifacts/${APP_ID}/public/data/audit_logs`), {
      utenteId: params.utenteId,
      utenteNome: params.utenteNome,
      action: params.action,
      campos: params.campos,
      autorId: params.autorId || '',
      autorNome: params.autorNome,
      autorRole: params.autorRole || '',
      data: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Falha ao gravar auditoria de perfil:', e);
  }
}

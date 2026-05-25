import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const APP_ID = 'cpx-vila-rei-main';

async function main() {
  console.log("=== INICIANDO TESTE DE CONEXÃO À CLOUD FIRESTORE ===");
  console.log("Projeto ID:", firebaseConfig.projectId);
  console.log("Base de Dados:", firebaseConfig.firestoreDatabaseId);

  // Inicializar Firebase
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  try {
    console.log("\n1. A tentar iniciar sessão de forma anónima (Anonymous Auth)...");
    const cred = await signInAnonymously(auth);
    console.log("Sucesso! Utilizador Anónimo UID:", cred.user.uid);

    const testDocRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'test_connection');

    console.log("\n2. A tentar escrever documento de teste no Firestore...");
    const testData = {
      testRunAt: new Date().toISOString(),
      status: "Ok",
      uid: cred.user.uid
    };
    await setDoc(testDocRef, testData);
    console.log("Sucesso! Documento de teste escrito.");

    console.log("\n3. A tentar ler o documento de teste de volta...");
    const snap = await getDoc(testDocRef);
    if (snap.exists()) {
      console.log("Sucesso! Dados lidos:", snap.data());
    } else {
      throw new Error("Erro: Documento escrito não foi encontrado!");
    }

    console.log("\n4. A limpar o documento de teste...");
    await deleteDoc(testDocRef);
    console.log("Sucesso! Documento limpo.");

    console.log("\n=================================================");
    console.log("TESTE CONCLUÍDO COM SUCESSO A 100%!");
    console.log("A base de dados de produção está ONLINE e ACESSÍVEL.");
    console.log("O login anónimo (Anonymous Auth) está ATIVO e a funcionar.");
    console.log("=================================================");
    process.exit(0);
  } catch (error: any) {
    console.error("\nERRO NO TESTE DE CONEXÃO CLOUD");
    console.error("Mensagem:", error.message || error);
    console.error("Código de Erro:", error.code);
    console.error("\nPor favor, valide se:");
    console.error("1. Ativou o provedor 'Anonymous' na consola do Firebase (Authentication > Sign-in method).");
    console.error("2. As regras de segurança do Firestore permitem leitura e escrita na coleção.");
    console.error("3. A sua máquina tem ligação à internet e acesso aos domínios do Firebase.");
    console.log("=================================================");
    process.exit(1);
  }
}

main();

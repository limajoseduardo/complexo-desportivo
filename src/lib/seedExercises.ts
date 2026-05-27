import { getFirestore, doc, getDoc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from './firebase';
import { APP_ID } from '../App';

export interface ExerciseData {
  name: string;
  type: 'STRENGTH' | 'CARDIO';
  primary_muscle: string;
  musculos_secundarios: string[];
  equipamento: string;
  dificuldade: 'iniciante' | 'intermédio' | 'avançado';
  descricao: string;
  instrucoes: string;
  video_url: string;
}

const EXERCISES: ExerciseData[] = [
  // ─── PEITO ────────────────────────────────────────────────────────────────
  {
    name: 'Supino com Barra',
    type: 'STRENGTH', primary_muscle: 'Peito',
    musculos_secundarios: ['Deltoides Anterior', 'Tríceps'],
    equipamento: 'Barra, Banco',
    dificuldade: 'intermédio',
    descricao: 'Exercício composto fundamental para desenvolvimento do peitoral, com recrutamento elevado de fibras musculares.',
    instrucoes: '1. Deita-te num banco horizontal com os pés no chão.\n2. Agarra a barra ligeiramente mais larga que os ombros.\n3. Desencosta a barra do suporte e posiciona-a sobre o peito com braços estendidos.\n4. Baixa a barra de forma controlada até tocar levemente no peito.\n5. Empurra para cima exalando o ar até os braços estarem completamente estendidos.',
    video_url: ''
  },
  {
    name: 'Supino Inclinado com Halteres',
    type: 'STRENGTH', primary_muscle: 'Peito Superior',
    musculos_secundarios: ['Deltoides Anterior', 'Tríceps'],
    equipamento: 'Halteres, Banco Inclinado',
    dificuldade: 'intermédio',
    descricao: 'Variação do supino que enfatiza a porção superior do peitoral, dando volume e definição à parte alta do peito.',
    instrucoes: '1. Ajusta o banco para 30–45°.\n2. Senta-te com um halter em cada mão sobre as coxas.\n3. Com ajuda das coxas, levanta os halteres à altura dos ombros.\n4. Empurra os halteres para cima até os braços estarem estendidos (sem bloquear os cotovelos).\n5. Baixa lentamente até os cotovelos ficarem ligeiramente abaixo da linha dos ombros.',
    video_url: ''
  },
  {
    name: 'Crucifixo com Halteres',
    type: 'STRENGTH', primary_muscle: 'Peito',
    musculos_secundarios: ['Deltoides Anterior'],
    equipamento: 'Halteres, Banco',
    dificuldade: 'intermédio',
    descricao: 'Exercício de isolamento que trabalha a abertura do peitoral, promovendo amplitude e definição muscular.',
    instrucoes: '1. Deita-te num banco com um halter em cada mão, braços estendidos acima do peito.\n2. Com uma ligeira flexão nos cotovelos, abre os braços para os lados num arco controlado.\n3. Desce até sentires um alongamento no peito (cotovelos ao nível dos ombros).\n4. Fecha os braços de volta à posição inicial como se abraçasses uma árvore.',
    video_url: ''
  },
  {
    name: 'Peck Deck (Voador)',
    type: 'STRENGTH', primary_muscle: 'Peito',
    musculos_secundarios: ['Deltoides Anterior'],
    equipamento: 'Máquina Peck Deck',
    dificuldade: 'iniciante',
    descricao: 'Máquina que isola o peitoral de forma segura, ideal para iniciantes ou para terminar o treino de peito.',
    instrucoes: '1. Ajusta o assento para que os braços fiquem alinhados com os ombros.\n2. Segura as alças com os cotovelos ligeiramente dobrados.\n3. Junta as alças à frente do peito de forma controlada, contraindo o peitoral.\n4. Volta lentamente à posição inicial sem deixar o peso bater.',
    video_url: ''
  },
  {
    name: 'Flexões',
    type: 'STRENGTH', primary_muscle: 'Peito',
    musculos_secundarios: ['Tríceps', 'Deltoides Anterior', 'Core'],
    equipamento: 'Peso Corporal',
    dificuldade: 'iniciante',
    descricao: 'Exercício clássico com peso corporal que trabalha o peitoral, ombros e tríceps em simultâneo.',
    instrucoes: '1. Posiciona as mãos ligeiramente mais largas que os ombros.\n2. Mantém o corpo em linha reta da cabeça aos pés (core ativado).\n3. Baixa o corpo até o peito quase tocar o chão.\n4. Empurra de volta à posição inicial estendendo os braços.',
    video_url: ''
  },
  {
    name: 'Flexões Declinadas',
    type: 'STRENGTH', primary_muscle: 'Peito Superior',
    musculos_secundarios: ['Deltoides Anterior', 'Tríceps'],
    equipamento: 'Banco ou Plataforma',
    dificuldade: 'intermédio',
    descricao: 'Variação das flexões com os pés elevados que aumenta o estímulo na parte superior do peito.',
    instrucoes: '1. Coloca os pés numa superfície elevada (banco, cadeira).\n2. Mãos no chão, ligeiramente mais largas que os ombros.\n3. Mantém o corpo reto e desce controladamente.\n4. Empurra de volta até os braços estarem estendidos.',
    video_url: ''
  },

  // ─── COSTAS ───────────────────────────────────────────────────────────────
  {
    name: 'Remada Curvada com Barra',
    type: 'STRENGTH', primary_muscle: 'Costas',
    musculos_secundarios: ['Bíceps', 'Trapézio', 'Romboides'],
    equipamento: 'Barra',
    dificuldade: 'intermédio',
    descricao: 'Exercício composto para toda a musculatura das costas, com especial foco no latíssimo do dorso e espessura das costas.',
    instrucoes: '1. De pé com pés à largura dos ombros, joelhos ligeiramente flexionados.\n2. Inclina o torso para a frente (~45°) mantendo as costas direitas.\n3. Agarra a barra com pega pronada (palmas para baixo), largura dos ombros.\n4. Puxa a barra em direção ao umbigo, juntando as omoplatas.\n5. Baixa controladamente até os braços estarem estendidos.',
    video_url: ''
  },
  {
    name: 'Puxada Frontal (Lat Pulldown)',
    type: 'STRENGTH', primary_muscle: 'Latíssimo do Dorso',
    musculos_secundarios: ['Bíceps', 'Romboides'],
    equipamento: 'Máquina de Polia',
    dificuldade: 'iniciante',
    descricao: 'Excelente exercício para desenvolver a largura das costas, especialmente o latíssimo do dorso.',
    instrucoes: '1. Senta-te na máquina com os joelhos fixos sob o suporte.\n2. Agarra a barra com as mãos ligeiramente mais largas que os ombros.\n3. Inclina ligeiramente o tronco para trás.\n4. Puxa a barra até ao nível do queixo/peito, juntando as omoplatas.\n5. Volta lentamente à posição inicial.',
    video_url: ''
  },
  {
    name: 'Remada Sentada (Cabo)',
    type: 'STRENGTH', primary_muscle: 'Costas',
    musculos_secundarios: ['Bíceps', 'Trapézio Médio'],
    equipamento: 'Máquina de Polia',
    dificuldade: 'iniciante',
    descricao: 'Exercício de remada em máquina que trabalha a espessura das costas com movimento seguro e controlado.',
    instrucoes: '1. Senta-te com os pés apoiados e joelhos ligeiramente dobrados.\n2. Agarra a pega e endireita as costas.\n3. Puxa a pega em direção ao abdómen, juntando as omoplatas.\n4. Mantém o tronco estável — não osciles.\n5. Volta lentamente à posição inicial.',
    video_url: ''
  },
  {
    name: 'Peso Morto (Deadlift)',
    type: 'STRENGTH', primary_muscle: 'Costas Inferior',
    musculos_secundarios: ['Glúteos', 'Isquiotibiais', 'Trapézio', 'Core'],
    equipamento: 'Barra',
    dificuldade: 'avançado',
    descricao: 'O exercício composto mais completo do ginásio. Recruta praticamente todos os músculos do corpo.',
    instrucoes: '1. Pés à largura dos ombros, barra sobre o médio do pé.\n2. Dobra os joelhos e inclina o torso para agarrar a barra.\n3. Costas direitas, peito aberto, olhar em frente.\n4. Empurra o chão com os pés enquanto levantas a barra ao longo das pernas.\n5. Termina de pé com ancas e joelhos completamente estendidos.\n6. Baixa com controlo revertendo o movimento.',
    video_url: ''
  },
  {
    name: 'Barra Fixa (Pull-Up)',
    type: 'STRENGTH', primary_muscle: 'Latíssimo do Dorso',
    musculos_secundarios: ['Bíceps', 'Romboides', 'Core'],
    equipamento: 'Barra de Puxar',
    dificuldade: 'avançado',
    descricao: 'Um dos exercícios mais completos para as costas. Exige força relativa elevada.',
    instrucoes: '1. Agarra a barra com as palmas viradas para a frente (pronado), largura dos ombros.\n2. Pende completamente com os braços estendidos.\n3. Puxa o corpo para cima até o queixo ultrapassar a barra.\n4. Junta as omoplatas no topo do movimento.\n5. Baixa de forma controlada até à posição inicial.',
    video_url: ''
  },
  {
    name: 'Chin-Up (Supinado)',
    type: 'STRENGTH', primary_muscle: 'Latíssimo do Dorso',
    musculos_secundarios: ['Bíceps'],
    equipamento: 'Barra de Puxar',
    dificuldade: 'intermédio',
    descricao: 'Variante da barra fixa com palmas viradas para si, com maior recrutamento do bíceps.',
    instrucoes: '1. Agarra a barra com as palmas viradas para si (supinado), largura dos ombros ou mais estreita.\n2. A partir da posição suspensa, puxa o corpo para cima.\n3. Mantém o core ativado e evita balançar.\n4. Baixa de forma controlada.',
    video_url: ''
  },
  {
    name: 'Remada com Halter Apoiado',
    type: 'STRENGTH', primary_muscle: 'Costas',
    musculos_secundarios: ['Bíceps', 'Romboides'],
    equipamento: 'Halter, Banco',
    dificuldade: 'iniciante',
    descricao: 'Exercício unilateral para as costas que permite trabalhar cada lado de forma independente.',
    instrucoes: '1. Coloca um joelho e a mão do mesmo lado num banco para apoio.\n2. Com o outro braço, segura um halter pendente.\n3. Puxa o halter até ao nível do quadril, cotovelo junto ao corpo.\n4. Junta a omoplata no topo e baixa controladamente.',
    video_url: ''
  },
  {
    name: 'Extensão Lombar',
    type: 'STRENGTH', primary_muscle: 'Costas Inferior',
    musculos_secundarios: ['Glúteos'],
    equipamento: 'Banco de Extensão Lombar',
    dificuldade: 'iniciante',
    descricao: 'Exercício para fortalecer a musculatura da coluna lombar e prevenir lesões nas costas.',
    instrucoes: '1. Posiciona-te no banco com os pés fixos e as ancas no bord do suporte.\n2. Cruza os braços sobre o peito ou coloca as mãos atrás da cabeça.\n3. Desce o torso de forma controlada.\n4. Sobe até o corpo ficar em linha reta (não hiperestendas).',
    video_url: ''
  },

  // ─── PERNAS ───────────────────────────────────────────────────────────────
  {
    name: 'Agachamento Livre',
    type: 'STRENGTH', primary_muscle: 'Quadríceps',
    musculos_secundarios: ['Glúteos', 'Isquiotibiais', 'Core'],
    equipamento: 'Barra ou Peso Corporal',
    dificuldade: 'intermédio',
    descricao: 'O rei dos exercícios de pernas. Estimula todo o trem inferior e core de forma intensa.',
    instrucoes: '1. Pés à largura dos ombros, dedos ligeiramente para fora.\n2. Mantém o peito alto e as costas direitas.\n3. Desce como se fosses sentar numa cadeira, joelhos acompanhando a direção dos pés.\n4. Desce até as coxas ficarem paralelas ao chão (ou abaixo).\n5. Empurra através dos calcanhares para voltar à posição inicial.',
    video_url: ''
  },
  {
    name: 'Agachamento Sumô',
    type: 'STRENGTH', primary_muscle: 'Quadríceps',
    musculos_secundarios: ['Adutores', 'Glúteos'],
    equipamento: 'Halter ou Barra',
    dificuldade: 'iniciante',
    descricao: 'Variação do agachamento com pés mais afastados que enfatiza o interior das coxas e glúteos.',
    instrucoes: '1. Pés mais largos que os ombros, dedos apontados para fora (~45°).\n2. Segura um halter com ambas as mãos entre as pernas.\n3. Mantém o torso direito e desce entre as pernas.\n4. Sobe empurrando com os calcanhares.',
    video_url: ''
  },
  {
    name: 'Leg Press',
    type: 'STRENGTH', primary_muscle: 'Quadríceps',
    musculos_secundarios: ['Glúteos', 'Isquiotibiais'],
    equipamento: 'Máquina Leg Press',
    dificuldade: 'iniciante',
    descricao: 'Alternativa ao agachamento em máquina, permite maior carga com menor risco para a coluna.',
    instrucoes: '1. Senta-te no banco e posiciona os pés na plataforma à largura dos ombros.\n2. Desencrava os suportes laterais.\n3. Dobra os joelhos de forma controlada até formarem ~90°.\n4. Empurra a plataforma de volta sem bloquear completamente os joelhos.',
    video_url: ''
  },
  {
    name: 'Afundo (Lunge)',
    type: 'STRENGTH', primary_muscle: 'Quadríceps',
    musculos_secundarios: ['Glúteos', 'Isquiotibiais', 'Estabilizadores'],
    equipamento: 'Halteres ou Peso Corporal',
    dificuldade: 'intermédio',
    descricao: 'Exercício unilateral que trabalha equilíbrio, força e coordenação do trem inferior.',
    instrucoes: '1. De pé com os pés juntos, dá um passo largo para a frente.\n2. Dobra ambos os joelhos até o traseiro quase tocar o chão.\n3. O joelho da frente não deve ultrapassar a ponta do pé.\n4. Empurra através do calcanhar da frente para voltar à posição inicial.',
    video_url: ''
  },
  {
    name: 'Cadeira Extensora',
    type: 'STRENGTH', primary_muscle: 'Quadríceps',
    musculos_secundarios: [],
    equipamento: 'Máquina Extensora',
    dificuldade: 'iniciante',
    descricao: 'Exercício de isolamento para o quadríceps, ideal para finalizar o treino de pernas.',
    instrucoes: '1. Ajusta a máquina para que o joelho fique alinhado com o eixo.\n2. Estende as pernas completamente.\n3. Mantém a contração 1 segundo no topo.\n4. Baixa de forma controlada sem deixar o peso bater.',
    video_url: ''
  },
  {
    name: 'Mesa Flexora',
    type: 'STRENGTH', primary_muscle: 'Isquiotibiais',
    musculos_secundarios: ['Glúteos'],
    equipamento: 'Máquina Flexora',
    dificuldade: 'iniciante',
    descricao: 'Isolamento dos isquiotibiais (posteriores da coxa). Essencial para equilíbrio muscular.',
    instrucoes: '1. Deita-te de bruços na máquina com os tornozelos sob o suporte.\n2. Dobra os joelhos trazendo os calcanhares em direção às nádegas.\n3. Mantém as ancas pressionadas contra o banco.\n4. Baixa controladamente.',
    video_url: ''
  },
  {
    name: 'Elevação de Gémeos (Calf Raise)',
    type: 'STRENGTH', primary_muscle: 'Gémeos (Panturrilha)',
    musculos_secundarios: ['Sóleo'],
    equipamento: 'Máquina ou Degrau',
    dificuldade: 'iniciante',
    descricao: 'Exercício para desenvolver os gémeos e melhorar a estética e força da parte inferior das pernas.',
    instrucoes: '1. De pé com as pontas dos pés num degrau, calcanhares no ar.\n2. Desce os calcanhares abaixo do nível do degrau para alongar.\n3. Sobe nas pontas dos pés o mais alto possível.\n4. Mantém 1 segundo no topo e baixa controladamente.',
    video_url: ''
  },
  {
    name: 'Hip Thrust',
    type: 'STRENGTH', primary_muscle: 'Glúteos',
    musculos_secundarios: ['Isquiotibiais', 'Core'],
    equipamento: 'Barra, Banco',
    dificuldade: 'intermédio',
    descricao: 'O melhor exercício para glúteos. Ativação máxima do glúteo máximo.',
    instrucoes: '1. Apoia as omoplatas num banco com a barra sobre as ancas (usa pad de proteção).\n2. Pés à largura dos ombros, joelhos a 90° no topo.\n3. Empurra as ancas para cima até o corpo ficar em linha reta.\n4. Contrai os glúteos no topo e baixa controladamente.',
    video_url: ''
  },
  {
    name: 'Peso Morto Romeno',
    type: 'STRENGTH', primary_muscle: 'Isquiotibiais',
    musculos_secundarios: ['Glúteos', 'Costas Inferior'],
    equipamento: 'Barra ou Halteres',
    dificuldade: 'intermédio',
    descricao: 'Variante do peso morto que enfatiza os isquiotibiais e glúteos com maior amplitude de alongamento.',
    instrucoes: '1. De pé com barra/halteres à frente das coxas.\n2. Projeta as ancas para trás mantendo as costas direitas e os joelhos ligeiramente dobrados.\n3. Desce até sentires o alongamento nos isquiotibiais (normalmente ao nível da canela).\n4. Contrai os glúteos para voltar à posição inicial.',
    video_url: ''
  },

  // ─── OMBROS ───────────────────────────────────────────────────────────────
  {
    name: 'Press Militar com Barra',
    type: 'STRENGTH', primary_muscle: 'Deltoides',
    musculos_secundarios: ['Tríceps', 'Trapézio', 'Core'],
    equipamento: 'Barra',
    dificuldade: 'intermédio',
    descricao: 'Exercício composto fundamental para o desenvolvimento da força e massa dos ombros.',
    instrucoes: '1. De pé ou sentado com a barra à altura do queixo, pega pronada.\n2. Empurra a barra verticalmente para cima até os braços estarem estendidos.\n3. Passa a cabeça para a frente quando a barra ultrapassar a cabeça.\n4. Baixa controladamente até ao ponto de partida.',
    video_url: ''
  },
  {
    name: 'Desenvolvimento com Halteres',
    type: 'STRENGTH', primary_muscle: 'Deltoides',
    musculos_secundarios: ['Tríceps'],
    equipamento: 'Halteres',
    dificuldade: 'intermédio',
    descricao: 'Versão com halteres do press militar que permite maior amplitude e trabalho unilateral.',
    instrucoes: '1. Sentado num banco com encosto, halteres à altura dos ombros, palmas para a frente.\n2. Empurra os halteres para cima até quase se tocarem.\n3. Não bloqueia completamente os cotovelos.\n4. Baixa de forma controlada.',
    video_url: ''
  },
  {
    name: 'Elevação Lateral',
    type: 'STRENGTH', primary_muscle: 'Deltoides Medial',
    musculos_secundarios: [],
    equipamento: 'Halteres',
    dificuldade: 'iniciante',
    descricao: 'Exercício de isolamento para a porção média do deltoides, responsável pela largura dos ombros.',
    instrucoes: '1. De pé com um halter em cada mão ao lado do corpo.\n2. Levanta os braços para os lados até ficarem paralelos ao chão (cotovelos ligeiramente dobrados).\n3. Os cotovelos devem estar ligeiramente mais altos que os pulsos.\n4. Baixa controladamente.',
    video_url: ''
  },
  {
    name: 'Elevação Frontal',
    type: 'STRENGTH', primary_muscle: 'Deltoides Anterior',
    musculos_secundarios: [],
    equipamento: 'Halteres ou Barra',
    dificuldade: 'iniciante',
    descricao: 'Isolamento da cabeça anterior do deltoides. Trabalha a frente do ombro.',
    instrucoes: '1. De pé com halteres à frente das coxas, palmas para baixo.\n2. Levanta um halter para a frente até ficar ao nível dos ombros.\n3. Mantém o braço quase reto (ligeira flexão no cotovelo).\n4. Baixa e repete com o outro braço (ou em simultâneo).',
    video_url: ''
  },
  {
    name: 'Pássaro / Elevação Posterior',
    type: 'STRENGTH', primary_muscle: 'Deltoides Posterior',
    musculos_secundarios: ['Romboides', 'Trapézio'],
    equipamento: 'Halteres',
    dificuldade: 'iniciante',
    descricao: 'Exercício para a cabeça posterior do deltoides, frequentemente negligenciada e importante para a postura.',
    instrucoes: '1. Sentado ou de pé inclinado para a frente (~45°).\n2. Halteres a pendurar com os braços ligeiramente dobrados.\n3. Levanta os braços para os lados até ficarem paralelos ao chão.\n4. Junta ligeiramente as omoplatas no topo.\n5. Baixa de forma controlada.',
    video_url: ''
  },
  {
    name: 'Remada Alta',
    type: 'STRENGTH', primary_muscle: 'Deltoides Medial',
    musculos_secundarios: ['Trapézio', 'Bíceps'],
    equipamento: 'Barra ou Halteres',
    dificuldade: 'intermédio',
    descricao: 'Exercício composto que trabalha ombros e trapézio em simultâneo.',
    instrucoes: '1. De pé com a barra na frente das coxas, pega estreita.\n2. Puxa a barra até ao queixo, cotovelos a subir acima dos ombros.\n3. Mantém a barra próxima do corpo durante todo o movimento.\n4. Baixa controladamente.',
    video_url: ''
  },
  {
    name: 'Arnold Press',
    type: 'STRENGTH', primary_muscle: 'Deltoides',
    musculos_secundarios: ['Tríceps'],
    equipamento: 'Halteres',
    dificuldade: 'intermédio',
    descricao: 'Variação criada por Arnold Schwarzenegger que trabalha todas as três cabeças do deltoides.',
    instrucoes: '1. Sentado com halteres à frente do rosto, palmas para ti (posição supinada inicial).\n2. Enquanto empurras os halteres para cima, roda as palmas para fora.\n3. No topo, as palmas ficam viradas para a frente.\n4. Desce revertendo a rotação.',
    video_url: ''
  },

  // ─── BÍCEPS ───────────────────────────────────────────────────────────────
  {
    name: 'Rosca Direta com Barra',
    type: 'STRENGTH', primary_muscle: 'Bíceps',
    musculos_secundarios: ['Braquial', 'Antebraço'],
    equipamento: 'Barra',
    dificuldade: 'iniciante',
    descricao: 'Exercício clássico de isolamento para o bíceps. Permite usar mais carga do que com halteres.',
    instrucoes: '1. De pé, agarra a barra com a pega supinada (palmas para cima), largura dos ombros.\n2. Mantém os cotovelos junto ao corpo e estáticos.\n3. Curva a barra em direção aos ombros contraindo o bíceps.\n4. Baixa controladamente sem deixar os cotovelos recuarem.',
    video_url: ''
  },
  {
    name: 'Rosca Alternada com Halteres',
    type: 'STRENGTH', primary_muscle: 'Bíceps',
    musculos_secundarios: ['Braquial'],
    equipamento: 'Halteres',
    dificuldade: 'iniciante',
    descricao: 'Variação que permite trabalhar cada braço de forma independente com maior amplitude de rotação.',
    instrucoes: '1. De pé com um halter em cada mão ao longo do corpo.\n2. Curva um braço em direção ao ombro rodando a palma para cima durante o movimento.\n3. Baixa o braço enquanto o outro sobe.\n4. Alterna de forma controlada.',
    video_url: ''
  },
  {
    name: 'Rosca Martelo',
    type: 'STRENGTH', primary_muscle: 'Braquial',
    musculos_secundarios: ['Bíceps', 'Braquiorradial'],
    equipamento: 'Halteres',
    dificuldade: 'iniciante',
    descricao: 'Variação com pega neutra que trabalha principalmente o braquial, dando espessura ao braço.',
    instrucoes: '1. De pé com halteres ao lado do corpo, palmas uma para a outra (pega neutra).\n2. Curva os braços mantendo as palmas viradas para dentro durante todo o movimento.\n3. Não rotes os pulsos.\n4. Baixa controladamente.',
    video_url: ''
  },
  {
    name: 'Rosca Concentrada',
    type: 'STRENGTH', primary_muscle: 'Bíceps',
    musculos_secundarios: [],
    equipamento: 'Halter',
    dificuldade: 'iniciante',
    descricao: 'Exercício de isolamento máximo do bíceps. Permite sentir a contração de forma muito intensa.',
    instrucoes: '1. Sentado com as pernas abertas, apoia o cotovelo na face interna da coxa.\n2. Segura o halter com o braço quase estendido.\n3. Curva o braço em direção ao ombro sem mover o cotovelo.\n4. Contrai no topo e baixa lentamente.',
    video_url: ''
  },
  {
    name: 'Rosca Scott (Preacher Curl)',
    type: 'STRENGTH', primary_muscle: 'Bíceps',
    musculos_secundarios: [],
    equipamento: 'Barra EZ, Banco Scott',
    dificuldade: 'intermédio',
    descricao: 'Exercício que elimina trapaças ao fixar os cotovelos no banco, isolando completamente o bíceps.',
    instrucoes: '1. Senta-te no banco Scott com os braços sobre a almofada inclinada.\n2. Agarra a barra EZ com pega supinada.\n3. Curva os braços trazendo a barra em direção aos ombros.\n4. Não deixa os braços estenderem completamente no fundo (mantém ligeira tensão).',
    video_url: ''
  },
  {
    name: 'Rosca com Cabo',
    type: 'STRENGTH', primary_muscle: 'Bíceps',
    musculos_secundarios: [],
    equipamento: 'Máquina de Polia',
    dificuldade: 'iniciante',
    descricao: 'Versão em cabo que mantém tensão constante no bíceps durante todo o movimento.',
    instrucoes: '1. Ajusta a polia na posição mais baixa.\n2. De pé, agarra a pega com pega supinada.\n3. Curva o braço mantendo o cotovelo fixo.\n4. O cabo garante tensão constante, mesmo no início do movimento.',
    video_url: ''
  },

  // ─── TRÍCEPS ──────────────────────────────────────────────────────────────
  {
    name: 'Tríceps Corda (Pushdown)',
    type: 'STRENGTH', primary_muscle: 'Tríceps',
    musculos_secundarios: [],
    equipamento: 'Máquina de Polia, Corda',
    dificuldade: 'iniciante',
    descricao: 'Exercício de isolamento para o tríceps usando a polia alta com corda. Muito popular e eficaz.',
    instrucoes: '1. Ajusta a polia na posição mais alta, afixa a corda.\n2. Agarra as extremidades da corda com os polegares para cima.\n3. Mantém os cotovelos junto ao corpo e estáticos.\n4. Empurra a corda para baixo até os braços estarem completamente estendidos, separando as pontas no final.\n5. Volta controladamente.',
    video_url: ''
  },
  {
    name: 'Tríceps Francês (Skull Crusher)',
    type: 'STRENGTH', primary_muscle: 'Tríceps',
    musculos_secundarios: [],
    equipamento: 'Barra EZ ou Halteres, Banco',
    dificuldade: 'intermédio',
    descricao: 'Exercício de isolamento intenso para o tríceps em posição deitada.',
    instrucoes: '1. Deita-te num banco com a barra EZ estendida acima do peito.\n2. Sem mover os cotovelos, baixa a barra em direção à testa/cabeça.\n3. Os cotovelos ficam apontados para o teto durante todo o movimento.\n4. Estende de volta à posição inicial.',
    video_url: ''
  },
  {
    name: 'Extensão de Tríceps Acima da Cabeça',
    type: 'STRENGTH', primary_muscle: 'Tríceps',
    musculos_secundarios: [],
    equipamento: 'Halter ou Barra',
    dificuldade: 'intermédio',
    descricao: 'Trabalha o tríceps em posição de alongamento máximo, recrutando mais fibras da cabeça longa.',
    instrucoes: '1. Sentado ou de pé, segura um halter com ambas as mãos acima da cabeça.\n2. Mantém os cotovelos apontados para a frente e junto à cabeça.\n3. Baixa o halter para trás da cabeça dobrando apenas os cotovelos.\n4. Estende de volta ao topo.',
    video_url: ''
  },
  {
    name: 'Mergulho no Banco (Bench Dip)',
    type: 'STRENGTH', primary_muscle: 'Tríceps',
    musculos_secundarios: ['Deltoides Anterior', 'Peito'],
    equipamento: 'Banco',
    dificuldade: 'iniciante',
    descricao: 'Exercício com peso corporal para tríceps, fácil de executar sem equipamento especializado.',
    instrucoes: '1. Apoias as palmas num banco atrás de ti, pernas estendidas à frente.\n2. Dobra os cotovelos para baixar o corpo.\n3. Desce até os cotovelos formarem ~90°.\n4. Empurra de volta à posição inicial.',
    video_url: ''
  },
  {
    name: 'Paralelas (Dips)',
    type: 'STRENGTH', primary_muscle: 'Tríceps',
    musculos_secundarios: ['Peito', 'Deltoides Anterior'],
    equipamento: 'Barras Paralelas',
    dificuldade: 'avançado',
    descricao: 'Exercício composto com o peso corporal. Excelente para a massa geral do tríceps.',
    instrucoes: '1. Apoia-te nas barras com os braços estendidos.\n2. Inclina ligeiramente o torso para a frente (mais tríceps) ou para trás (mais peito).\n3. Desce controladamente até os cotovelos formarem ~90°.\n4. Empurra de volta à posição inicial.',
    video_url: ''
  },
  {
    name: 'Tríceps Coice (Kickback)',
    type: 'STRENGTH', primary_muscle: 'Tríceps',
    musculos_secundarios: [],
    equipamento: 'Halter',
    dificuldade: 'iniciante',
    descricao: 'Exercício de isolamento que trabalha principalmente a cabeça lateral do tríceps.',
    instrucoes: '1. Apoia um joelho e uma mão num banco.\n2. Com a outra mão segura um halter, cotovelo junto ao corpo a 90°.\n3. Estende o braço para trás até ficar paralelo ao chão.\n4. Mantém 1 segundo e volta controladamente.',
    video_url: ''
  },

  // ─── ABDOMINAIS ───────────────────────────────────────────────────────────
  {
    name: 'Prancha Isométrica',
    type: 'STRENGTH', primary_muscle: 'Core (Abdómen)',
    musculos_secundarios: ['Glúteos', 'Costas', 'Ombros'],
    equipamento: 'Peso Corporal',
    dificuldade: 'iniciante',
    descricao: 'O exercício de core mais completo. Fortalece o abdómen profundo e melhora a postura.',
    instrucoes: '1. Apoia os antebraços no chão com os cotovelos alinhados aos ombros.\n2. Pernas estendidas, apoiadas nas pontas dos pés.\n3. Mantém o corpo completamente reto, sem levantar as ancas nem deixá-las cair.\n4. Respira normalmente e mantém a posição o máximo de tempo possível.',
    video_url: ''
  },
  {
    name: 'Crunch',
    type: 'STRENGTH', primary_muscle: 'Reto Abdominal',
    musculos_secundarios: [],
    equipamento: 'Peso Corporal',
    dificuldade: 'iniciante',
    descricao: 'Exercício básico para o reto abdominal. Eficaz quando executado com boa técnica.',
    instrucoes: '1. Deitado de costas, joelhos dobrados, pés no chão.\n2. Mãos atrás da cabeça (sem puxar o pescoço).\n3. Contrai o abdómen e eleva apenas os ombros do chão.\n4. Mantém 1 segundo no topo e baixa controladamente.',
    video_url: ''
  },
  {
    name: 'Elevação de Pernas',
    type: 'STRENGTH', primary_muscle: 'Abdómen Inferior',
    musculos_secundarios: ['Flexores da Anca'],
    equipamento: 'Peso Corporal ou Barra de Puxar',
    dificuldade: 'intermédio',
    descricao: 'Exercício eficaz para a porção inferior do abdómen, frequentemente negligenciada.',
    instrucoes: '1. Deitado de costas com os braços ao lado do corpo (ou suspenso numa barra).\n2. Mantendo as pernas juntas, levanta-as até formarem 90° com o torso.\n3. Baixa lentamente sem que os pés toquem completamente no chão.\n4. Repete de forma controlada.',
    video_url: ''
  },
  {
    name: 'Prancha Lateral',
    type: 'STRENGTH', primary_muscle: 'Oblíquos',
    musculos_secundarios: ['Core', 'Glúteos'],
    equipamento: 'Peso Corporal',
    dificuldade: 'iniciante',
    descricao: 'Variação da prancha para trabalhar os músculos oblíquos e estabilizadores laterais.',
    instrucoes: '1. Deita-te de lado apoiado num antebraço, com o corpo em linha reta.\n2. Levanta as ancas do chão.\n3. Mantém a posição o máximo de tempo possível.\n4. Repete do outro lado.',
    video_url: ''
  },
  {
    name: 'Russian Twist',
    type: 'STRENGTH', primary_muscle: 'Oblíquos',
    musculos_secundarios: ['Reto Abdominal'],
    equipamento: 'Peso Corporal ou Disco',
    dificuldade: 'intermédio',
    descricao: 'Exercício rotacional para os oblíquos que melhora a força funcional do tronco.',
    instrucoes: '1. Sentado no chão com os joelhos dobrados e os pés ligeiramente elevados.\n2. Inclina o tronco ligeiramente para trás.\n3. Roda o tronco para um lado, depois para o outro (conta como 1 rep).\n4. Para adicionar dificuldade, segura um disco ou halter.',
    video_url: ''
  },
  {
    name: 'Mountain Climbers',
    type: 'CARDIO', primary_muscle: 'Core (Abdómen)',
    musculos_secundarios: ['Ombros', 'Quadríceps'],
    equipamento: 'Peso Corporal',
    dificuldade: 'intermédio',
    descricao: 'Exercício dinâmico que combina trabalho de core com cardio, muito usado em HIIT.',
    instrucoes: '1. Em posição de prancha com os braços estendidos.\n2. Traz um joelho em direção ao peito rapidamente.\n3. Retorna e imediatamente traz o outro joelho.\n4. Alterna de forma rápida e controlada durante 30–60 segundos.',
    video_url: ''
  },
  {
    name: 'Abdominal com Polia',
    type: 'STRENGTH', primary_muscle: 'Reto Abdominal',
    musculos_secundarios: ['Oblíquos'],
    equipamento: 'Máquina de Polia',
    dificuldade: 'intermédio',
    descricao: 'Exercício com carga externa para o abdómen, permitindo sobrecarga progressiva.',
    instrucoes: '1. De joelhos de frente para a polia alta, segura a corda atrás da nuca.\n2. Flexiona o tronco em direção às coxas contraindo o abdómen.\n3. Mantém as ancas estáticas — só o tronco se move.\n4. Volta controladamente.',
    video_url: ''
  },

  // ─── CARDIO ───────────────────────────────────────────────────────────────
  {
    name: 'Corrida na Passadeira',
    type: 'CARDIO', primary_muscle: 'Sistema Cardiovascular',
    musculos_secundarios: ['Quadríceps', 'Glúteos', 'Gémeos'],
    equipamento: 'Passadeira',
    dificuldade: 'iniciante',
    descricao: 'Exercício cardiovascular base. Melhora a resistência aeróbica e queima calorias.',
    instrucoes: '1. Começa com uma caminhada a 5–6 km/h por 5 minutos (aquecimento).\n2. Aumenta para o ritmo de corrida desejado.\n3. Mantém postura ereta, olhar em frente, braços a 90°.\n4. Termina com 5 minutos de caminhada (retorno à calma).',
    video_url: ''
  },
  {
    name: 'Bicicleta Estática',
    type: 'CARDIO', primary_muscle: 'Sistema Cardiovascular',
    musculos_secundarios: ['Quadríceps', 'Glúteos', 'Isquiotibiais'],
    equipamento: 'Bicicleta Estática',
    dificuldade: 'iniciante',
    descricao: 'Cardio de baixo impacto articular. Excelente para principiantes ou reabilitação.',
    instrucoes: '1. Ajusta o selim para que os joelhos fiquem ligeiramente dobrados no ponto mais baixo do pedal.\n2. Começa com baixa resistência por 5 minutos.\n3. Aumenta gradualmente a resistência e o ritmo.\n4. Para HIIT: 30s sprint + 60s recuperação.',
    video_url: ''
  },
  {
    name: 'Máquina de Remo (Rowing)',
    type: 'CARDIO', primary_muscle: 'Sistema Cardiovascular',
    musculos_secundarios: ['Costas', 'Pernas', 'Core', 'Braços'],
    equipamento: 'Máquina de Remo',
    dificuldade: 'intermédio',
    descricao: 'Exercício cardio que trabalha ~86% dos músculos. Um dos melhores para condicionamento físico geral.',
    instrucoes: '1. Senta-te com os pés seguros nas correntes, joelhos dobrados.\n2. Agarra a pega com os braços estendidos.\n3. Empurra com as pernas enquanto inclinas o tronco ligeiramente para trás.\n4. Puxa a pega até ao abdómen.\n5. Reverte o movimento de forma controlada.',
    video_url: ''
  },
  {
    name: 'Elíptica',
    type: 'CARDIO', primary_muscle: 'Sistema Cardiovascular',
    musculos_secundarios: ['Quadríceps', 'Glúteos', 'Isquiotibiais'],
    equipamento: 'Máquina Elíptica',
    dificuldade: 'iniciante',
    descricao: 'Cardio de baixo impacto que simula a corrida sem stressar as articulações.',
    instrucoes: '1. Sobe na máquina e segura os manípulos.\n2. Começa com resistência e inclinação baixas.\n3. Move os braços e as pernas em sincronia num movimento elíptico fluido.\n4. Aumenta a resistência conforme a condição física melhora.',
    video_url: ''
  },
  {
    name: 'Burpee',
    type: 'CARDIO', primary_muscle: 'Sistema Cardiovascular',
    musculos_secundarios: ['Peito', 'Ombros', 'Core', 'Pernas'],
    equipamento: 'Peso Corporal',
    dificuldade: 'avançado',
    descricao: 'Exercício de corpo inteiro altamente intenso. Combina força e cardio num único movimento.',
    instrucoes: '1. De pé, agacha e coloca as mãos no chão.\n2. Salta os pés para trás ficando em posição de prancha.\n3. Faz uma flexão.\n4. Salta os pés de volta para junto das mãos.\n5. Salta explosivamente com os braços acima da cabeça.',
    video_url: ''
  },
  {
    name: 'Agachamento com Salto',
    type: 'CARDIO', primary_muscle: 'Quadríceps',
    musculos_secundarios: ['Glúteos', 'Sistema Cardiovascular'],
    equipamento: 'Peso Corporal',
    dificuldade: 'intermédio',
    descricao: 'Versão pliométrica do agachamento. Excelente para potência muscular e condicionamento.',
    instrucoes: '1. Agacha com os pés à largura dos ombros.\n2. No ponto mais baixo, salta explosivamente para cima.\n3. Aterra suavemente com os joelhos dobrados para absorver o impacto.\n4. Vai direto para o próximo agachamento.',
    video_url: ''
  },
  {
    name: 'Corda de Batalha (Battle Rope)',
    type: 'CARDIO', primary_muscle: 'Sistema Cardiovascular',
    musculos_secundarios: ['Ombros', 'Core', 'Braços'],
    equipamento: 'Corda de Batalha',
    dificuldade: 'intermédio',
    descricao: 'Exercício de condicionamento intenso que combina força dos membros superiores com cardio.',
    instrucoes: '1. Segura uma ponta da corda em cada mão, pés à largura dos ombros, joelhos ligeiramente dobrados.\n2. Move os braços alternadamente ou em simultâneo para cima e para baixo criando ondas.\n3. Mantém o core ativado.\n4. Realiza intervalos de 20–30 segundos com descanso equivalente.',
    video_url: ''
  },

  // ─── GLÚTEOS ──────────────────────────────────────────────────────────────
  {
    name: 'Ponte de Glúteos',
    type: 'STRENGTH', primary_muscle: 'Glúteos',
    musculos_secundarios: ['Isquiotibiais', 'Core'],
    equipamento: 'Peso Corporal',
    dificuldade: 'iniciante',
    descricao: 'Exercício fundamental para ativar os glúteos. Ótimo para iniciantes e para aquecimento.',
    instrucoes: '1. Deitado de costas, joelhos dobrados, pés no chão próximo das nádegas.\n2. Empurra com os calcanhares e eleva as ancas até o corpo formar uma linha reta.\n3. Contrai os glúteos no topo por 2 segundos.\n4. Baixa controladamente.',
    video_url: ''
  },
  {
    name: 'Abdução de Anca (Máquina)',
    type: 'STRENGTH', primary_muscle: 'Glúteo Médio',
    musculos_secundarios: ['Tensor Fáscia Lata'],
    equipamento: 'Máquina de Abdução',
    dificuldade: 'iniciante',
    descricao: 'Exercício de isolamento para o glúteo médio, importante para a estabilidade do quadril.',
    instrucoes: '1. Sentado na máquina com as almofadas nas faces externas das coxas.\n2. Afasta as pernas uma da outra contra a resistência.\n3. Mantém 1 segundo no ponto máximo de abertura.\n4. Fecha controladamente.',
    video_url: ''
  },

  // ─── FUNCIONAL / COMPOUND ─────────────────────────────────────────────────
  {
    name: 'Kettlebell Swing',
    type: 'CARDIO', primary_muscle: 'Glúteos',
    musculos_secundarios: ['Isquiotibiais', 'Core', 'Ombros'],
    equipamento: 'Kettlebell',
    dificuldade: 'intermédio',
    descricao: 'Exercício balístico de cadeia posterior. Excelente para potência, condicionamento e queima calórica.',
    instrucoes: '1. Pés ligeiramente mais largos que os ombros, kettlebell no chão à frente.\n2. Agarra o kettlebell, inclina o tronco projetando as ancas para trás (não agachas).\n3. Impulsiona as ancas para a frente enquanto balances o kettlebell até à altura dos ombros.\n4. Deixa o kettlebell descer enquanto projetas as ancas para trás novamente.',
    video_url: ''
  },
  {
    name: 'Clean and Press',
    type: 'STRENGTH', primary_muscle: 'Corpo Inteiro',
    musculos_secundarios: ['Pernas', 'Costas', 'Ombros', 'Core'],
    equipamento: 'Barra ou Halteres',
    dificuldade: 'avançado',
    descricao: 'Exercício olímpico composto que trabalha o corpo todo em dois movimentos explosivos.',
    instrucoes: '1. Agarra a barra como num peso morto.\n2. Puxa a barra explosivamente até ao nível dos ombros (clean).\n3. Empurra a barra acima da cabeça (press).\n4. Baixa controladamente até ao chão.',
    video_url: ''
  },
  {
    name: 'Farmer\'s Walk',
    type: 'STRENGTH', primary_muscle: 'Core',
    musculos_secundarios: ['Trapézio', 'Antebraços', 'Pernas'],
    equipamento: 'Halteres ou Kettlebells',
    dificuldade: 'iniciante',
    descricao: 'Exercício funcional simples mas altamente eficaz para força de grip, core e resistência muscular.',
    instrucoes: '1. Segura pesos pesados em cada mão.\n2. Mantém as costas direitas, ombros para trás, olhar em frente.\n3. Caminha durante uma distância ou tempo determinado.\n4. Mantém uma passada controlada sem balançar o tronco.',
    video_url: ''
  },
];

export async function seedExerciseLibrary() {
  const sentinelKey = 'cpx_seed_exercises_v1';
  if (localStorage.getItem(sentinelKey)) return;

  try {
    const sentinelRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'exercises_v1');
    const snap = await getDoc(sentinelRef);
    if (snap.exists()) {
      localStorage.setItem(sentinelKey, 'true');
      return;
    }

    const path = `artifacts/${APP_ID}/public/data/exercise_library`;
    const batches: ReturnType<typeof writeBatch>[] = [];
    let currentBatch = writeBatch(db);
    let count = 0;

    for (const ex of EXERCISES) {
      const ref = doc(collection(db, path));
      currentBatch.set(ref, { ...ex, video_url: '' });
      count++;
      if (count % 450 === 0) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
      }
    }
    batches.push(currentBatch);

    for (const batch of batches) {
      await batch.commit();
    }

    await setDoc(sentinelRef, { seededAt: new Date().toISOString(), total: EXERCISES.length });
    localStorage.setItem(sentinelKey, 'true');
    console.log(`Enciclopédia de exercícios carregada: ${EXERCISES.length} exercícios.`);
  } catch (err) {
    console.error('Erro ao carregar exercícios:', err);
  }
}

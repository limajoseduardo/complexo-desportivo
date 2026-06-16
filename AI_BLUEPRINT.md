# DOCUMENTAÇÃO DO PROJETO PARA INTELIGÊNCIA ARTIFICIAL (AI BLUEPRINT)

Este documento foi criado especificamente para servir de **prompt mestre** e mapa de arquitetura. Se necessitares de entregar este projeto a uma nova IA (Inteligência Artificial) para continuar o desenvolvimento, replicar a estrutura ou refatorar, deves fornecer-lhe o conteúdo deste ficheiro.

---

## 1. Visão Geral do Projeto
**Nome:** Gestão de Complexo Desportivo
**Stack Tecnológico:**
- Frontend: React 18, Vite, TypeScript, Tailwind CSS (Vanilla, sem configurações extra complexas).
- Ícones: `lucide-react`.
- Gráficos: `recharts`.
- Geração de QR Codes: `qrcode.react`.
- Geração de PDFs e Relatórios: `jspdf`, `jspdf-autotable`.
- Backend/Base de Dados: Firebase Firestore (Cloud Firestore).
- Autenticação: Firebase Auth (Email/Password e Google Auth).

**Conceito Base:**
Uma aplicação web orientada a Progressive Web App (PWA) e desenhada *mobile-first* / tablet-first, concebida para ser usada na receção, por professores, treinadores e pelos próprios utentes através de quiosques de self-service.

---

## 2. Estrutura de Base de Dados (Firestore)
A base de dados não usa as raízes standard, mas sim um caminho prefixado dinâmico baseado no `APP_ID` para permitir multi-tenancy ou ambientes de teste (ex: `artifacts/complexo-desportivo/public/data/`).

### Coleções Principais:
1. **`users` (Utentes, Staff, Professores):**
   - Propriedades chave: `n` (nome), `role` (utente, staff, admin, professor), `email`, `nif`, `data_nasc`, `telemovel`.
   - Estado de Acesso: `isInside` (boolean), `location` (string - local atual), `lastOut` (timestamp).
   - Cartões e Saúde: `cartao_tipo`, `atestado_medico`, `termo_responsabilidade`, `termo_imagens`.
   - Contabilidade: `saldo_entradas`, `saldo_livre`.

2. **`logs_acesso` (Controlo de Entradas e Saídas):**
   - Propriedades chave: `userId`, `userName`, `checkIn` (Timestamp), `checkOut` (Timestamp ou inexistente caso ainda esteja dentro), `modalidade`, `durationMinutes`, `date` (YYYY-MM-DD para queries diárias).
   - Notas: A funcionalidade "Desfazer Saída" baseia-se em eliminar o campo `checkOut` (através de `deleteField()`).

3. **`planos_treino` & `exercises`:**
   - Para gestão do ginásio. O treinador prescreve planos aos utentes.

4. **`turmas` (Gestão de Natação e Aulas de Grupo):**
   - Horários, capacidade, e subcoleção/array de utentes inscritos.

---

## 3. Lógica de Negócio Essencial (Regras de Ouro)

### Acessos e Quiosque:
- O utente chega e apresenta um QR Code gerado pelo seu telemóvel. O leitor do tablet/receção (em modo "Quiosque") lê o QR Code e processa a entrada automaticamente.
- Existe uma validação rigorosa de **Termos de Responsabilidade**. O utente *não pode* fazer self-check-in se não tiver aceite os termos.
- **Dedução de Saldo:** Na piscina livre, se o utilizador tiver "Piscina Regime Livre", é descontada `1` entrada do seu `saldo_entradas` automaticamente. Para Ginásio, se for "Piscina e Ginásio", é verificado o acesso híbrido.
- **Piscina Exterior:** Existe uma secção de "Registo Rápido Múltiplo" no ecrã de acessos, onde a receção insere apenas quantidades de Adultos e Crianças (sem identificar o utente) para criar entradas anónimas rápidas (`userId = 'ext_entrada'`).

### Relatórios e Caixa:
- Estatísticas diárias e mensais calculadas no browser (React `useMemo`) lendo todos os acessos do período selecionado.
- Inclui demografia: **Faixas Etárias**, **Cartões Municipais/Especiais** e **Atestados Médicos**. Os cálculos são feitos emparelhando o `userId` do `logs_acesso` com os perfis cacheados dos `users`.
- O fecho de caixa automático agrupa as tipologias de bilhetes e preços aplicados (ex: desconto de 20% se Cartão Jovem, etc.).

### Experiência de Utilização (UI/UX):
- Não usar `window.confirm` para ações rápidas como "Desfazer Saída", porque browsers de tablets (como iPads em modo quiosque) bloqueiam esses popups silenciosamente.
- Listas de utilizadores devem exibir apenas o **Primeiro e Último Nome** e, por baixo, detalhes pequenos em cinzento como NIF ou modalidade.
- A aplicação utiliza `ErrorBoundary` ao nível de módulos para impedir que erros de um componente (ex: Gráficos recharts) "congelem" a página inteira de renderizar (Erro "React 300").

---

## 4. Estrutura de Ficheiros e Componentes
- `App.tsx`: Ponto de entrada, gere Autenticação, Estado Global (`utentes`, `logs_acesso`), e define o roteamento/abas principal (`activeTab`).
- `components/AccessLogs.tsx`: O coração da receção. Gere entradas manuais, tabelas de quem está dentro, botão vermelho de "Desfazer Saída", fecho de caixa e gráficos de estatísticas demográficas.
- `components/Profile.tsx`: Ficha de utente central. Mostra dados, edita saldo, aceita termos e mostra gráficos de evolução física (peso, tensão arterial).
- `components/KioskMode.tsx`: Ecrã completo para leitura de QR Codes e mensagens de sucesso/erro. Usa temporizadores para voltar ao estado de "Pronto a Ler".
- `components/Dashboards.tsx`: Painéis específicos para Utentes (mostrar o seu QR card e treinos ativos) e Staff (visão geral).
- `lib/access.ts`: Motor lógico isolado para lidar com regras complexas de entrada (deduções matemáticas de saldo e cruzamento de horários).

---

## 5. Instruções de Continuidade para IA
Se uma IA receber este ficheiro e for instruída a continuar o projeto:
1. **LER ESTE FICHEIRO:** Entender imediatamente que é um sistema em tempo real com estado React complexo.
2. **VERIFICAR IMPORTS E TYPES:** Ao modificar objetos Firestore, referir sempre `import { doc, updateDoc, deleteField } from 'firebase/firestore'`.
3. **DESIGN SYSTEM:** Qualquer nova UI deve usar classes do Tailwind `rounded-2xl`, `bg-white`, `border-slate-100`, `shadow-sm`, com títulos em caixa alta `uppercase tracking-widest text-[10px] font-black`.
4. **COMPILAÇÃO VITE:** Manter o código TypeScript estrito (não esquecer de fechar tags JSX, tipar props e verificar imports de bibliotecas como Recharts).
5. **BUILD:** Os comandos padrão são `npm run dev` para teste e `npm run build` para compilar para produção.

*Documento gerado para servir de memória persistente da arquitetura desenvolvida.*

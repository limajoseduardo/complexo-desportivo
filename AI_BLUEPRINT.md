# DOCUMENTAÇÃO DO PROJETO PARA INTELIGÊNCIA ARTIFICIAL (AI BLUEPRINT)
**Última atualização:** 24 de Junho de 2026

Este documento foi criado especificamente para servir de **prompt mestre** e mapa de arquitetura. Se necessitares de entregar este projeto a uma nova IA (Inteligência Artificial) para continuar o desenvolvimento, replicar a estrutura ou refatorar, deves fornecer-lhe o conteúdo deste ficheiro.

---

## 1. Visão Geral do Projeto
**Nome:** Gestão de Complexo Desportivo — Câmara Municipal de Vila de Rei  
**Stack Tecnológico:**
- Frontend: React 19, Vite, TypeScript, Tailwind CSS
- Ícones: `lucide-react`
- Gráficos: `recharts`
- Geração de QR Codes: `qrcode.react`
- Geração de PDFs e Relatórios: `jspdf`, `jspdf-autotable`
- Backend/Base de Dados: Firebase Firestore (Cloud Firestore), projeto `complexo-desportivo-vr`
- Autenticação: Firebase Auth (sessão anónima automática para todos + verificação de email/password contra a coleção `users` no Firestore)

**Conceito Base:**
Uma aplicação web orientada a Progressive Web App (PWA) e desenhada *mobile-first* / tablet-first, concebida para ser usada na receção, por professores, treinadores e pelos próprios utentes através de quiosques de self-service.

**URL GitHub:** https://github.com/limajoseduardo/complexo-desportivo

---

## 2. Estrutura de Base de Dados (Firestore)
A base de dados não usa as raízes standard, mas sim um caminho prefixado dinâmico baseado no `APP_ID` para permitir multi-tenancy ou ambientes de teste (ex: `artifacts/complexo-desportivo/public/data/`).

O `APP_ID` é definido em `src/lib/firebase.ts` como `'cpx-vila-rei-main'`.

### Coleções Principais:

**`users` (Utentes, Staff, Professores):**
- Propriedades chave: `n` (nome), `nome` (nome completo), `role` (`utente`, `staff`, `admin`, `professor`, `chefia`), `email`, `nif`, `data_nasc`, `telemovel`.
- Estado de Acesso: `isInside` (boolean), `location` (string - local atual).
- Cartões: `cartao_tipo` (tipo de cartão municipal), `cartao_numero`, `cartao_validade`.
- Saúde: `atestado_medico` (boolean), `restricoes_medicas`, `alergias`.
- Termos: `termo_responsabilidade` (boolean), `termo_imagens` (boolean).
- Contabilidade: `entradas_disponiveis` (number), `tipoAcesso` (`Diário` | `Pacote` | `Isento`).
- Acesso ao Quiosque: `qrToken` (string único para QR Code), `rfidUid` (UID de cartão RFID).
- Faturação: `nif`, `iban`, `endereco`, `cod_postal`, `localidade`.

**`logs_acesso` (Controlo de Entradas e Saídas):**
- Propriedades: `userId`, `userName`, `checkIn` (Timestamp), `checkOut` (Timestamp ou inexistente), `modalidade`, `durationMinutes`, `date` (YYYY-MM-DD), `zone`.
- **NOVO:** `valorPago` (number) — valor cobrado confirmado pelo staff na receção. Se `undefined`/`null`, a entrada está pendente de confirmação de pagamento.
- Notas: A funcionalidade "Desfazer Saída" usa `deleteField()` para remover `checkOut` do Firestore — nunca usar `null`.
- Registos anónimos da Piscina Exterior usam `userId = 'ext_entrada'` com `userName = 'PISCINA EXTERIOR (ADULTO)'` ou `'PISCINA EXTERIOR (CRIANÇA)'`.

**`planos_treino` & `exercises`:** Para gestão do ginásio. O treinador prescreve planos aos utentes.

**`turmas` (Gestão de Natação e Aulas de Grupo):** Horários, capacidade, e array de utentes inscritos.

**`swimming_logs` (Registos de Aulas de Natação):** Presenças e distâncias por data e turma.

**`operational_logs` (Diário de Operações):** Registo de temperatura da água, pH e cloro das piscinas.

**`avisos_globais` (Mural de Avisos):** `titulo`, `mensagem`, `professorId`, `nomeProfessor`, `dataCriacao`. Geridos em `AvisosModule.tsx` (admin/staff), com opção de broadcast por email (BCC, lotes de 50) via `api/send-email.ts` — SMTP configurado por variáveis de ambiente no Vercel, nunca no repositório.

**Removidas (2026-06-24):** `saude` (peso/glicemia/tensão) e `treinos`/`treinos_assigned` (planos de treino prescritos) — funcionalidade "Saúde & Metas" e "Treino" retirada do perfil do utente a pedido; histórico apagado da produção.

**Pavilhão e Padel:** Têm agora o mesmo registo rápido de utilização anónima que a Piscina Exterior (sem distinção adulto/criança, sem preçário definido) — ver `modalities` em `AccessLogs.tsx` e `isUserInZone` em `lib/logic.ts`.

---

## 3. Preçário Oficial (Tabela de Taxas 2026 — Artigo 72º)

### Piscinas Municipais (coberta e descoberta/exterior) — por pessoa/por sessão:
| Faixa | Dias Úteis | Sábados, Domingos e Feriados |
|---|---|---|
| Até 6 anos | Grátis | Grátis |
| 7 a 14 anos | 1,09 € | 1,39 € |
| Mais de 14 anos | 2,10 € | 2,79 € |
| Cartões Municipais (Jovem, Idade-Ativa, Idoso) | **-20%** sobre o preço base | **-20%** |
| Atestado Médico / Universidade Sénior | **Isento** | **Isento** |
| Cartão 20 entradas (até 14 anos) | 22,17 € | — |
| Cartão 20 entradas (mais de 14 anos) | 32,01 € | — |

### Ginásio / Sala de Musculação — por sessão individual:
| | Dias Úteis | Fins de Semana |
|---|---|---|
| Senha individual | 1,39 € | 1,69 € |
| Cartões Municipais (-20%) | 1,11 € | 1,35 € |
| Atestado Médico / Universidade Sénior | Isento | Isento |
| Cartão 15 entradas | 16,68 € | — |

### Escola de Natação (Mensalidade):
| | Valor |
|---|---|
| Taxa de inscrição | 15,31 € |
| 2 aulas semanais por mês (1 atividade) | 15,31 € |
| 2 ou mais atividades | desconto de 2,50 € por atividade |
| Cartões Municipais | -20% |

### Hidroginástica: Por mensalidade (NÃO por entrada diária). Não deve ser calculada no fecho de caixa diário.

---

## 4. Lógica de Negócio Essencial (Regras de Ouro)

### Cartão Universidade Sénior:
- Acesso TOTALMENTE LIVRE e ILIMITADO a todo o complexo.
- Não desconta `entradas_disponiveis`. Não gera aviso de pagamento.
- As entradas e saídas continuam a ser registadas para estatísticas e seguros.

### Acessos e Quiosque:
- O utente apresenta um QR Code (gerado pelo Perfil ou pela App). O leitor do tablet (Modo Quiosque `KioskMode.tsx`) lê e processa a entrada automaticamente.
- Existe validação de **Termos de Responsabilidade** — o utente não pode fazer self-check-in sem os ter aceite.
- **Desfazer Saída:** Clicar no botão vermelho de saída repõe o utente como "No Recinto". Usa `deleteField()` para apagar `checkOut`.
- **NÃO usar `window.confirm()`** em ações rápidas — browsers de tablets em modo quiosque bloqueiam silenciosamente esses popups.

### Sistema de Fecho de Caixa:
- **Novo fluxo (Junho 2026):** O staff regista o `valorPago` diretamente na tabela de acessos através de um dropdown com preços pré-configurados por modalidade.
- O Fecho de Caixa soma os `valorPago` confirmados e mostra quantas entradas ainda estão pendentes de confirmação.
- A função `getBasePrice(age, modality, isWeekend)` está exportada de `AccessLogs.tsx` como utilitário central de cálculo de preços.

### Piscina Exterior (Registos Anónimos):
- A receção usa um painel rápido para registar quantidades de "Adultos" e "Crianças" sem identificar o utente.
- Cria documentos com `userId = 'ext_entrada'` em `logs_acesso`.
- Estes registos NÃO têm perfil associado, por isso não aparecem na coluna "Valor Pago" da tabela normal — devem ser calculados separadamente.

### Saída Automática às 20h00:
- `scripts/auto-checkout.ts` + `.github/workflows/auto-checkout.yml` — corre todos os dias (cron às 19h e 20h UTC, cobre DST) e fecha o `isInside` de **qualquer** utente ainda marcado "dentro" às 20h00 hora de Lisboa, seja o check-in de hoje ou de dias anteriores (esquecimentos do staff). O script só age na corrida cuja hora local bate certo com 20h.

### Papel `chefia` (só-consulta):
- `canAdd`/`canEdit` nunca incluem `'chefia'` em nenhum módulo (Utentes, Mapas, Acessos) — é o papel correto para dar a alguém visibilidade total (estatísticas de professores, demografia/idades, ranking de utentes mais frequentes, tudo em `AccessLogs.tsx` → Relatórios & Estatísticas) sem permitir editar/apagar dados.

---

## 5. Estrutura de Ficheiros e Componentes

- `App.tsx` — Ponto de entrada, autenticação, estado global (`utentes`, `activeTab`), modo quiosque e processamento de RFID/QR.
- `src/components/AccessLogs.tsx` — Coração da receção: tabela de acessos diários, coluna "Valor Pago", fecho de caixa, estatísticas demográficas, gráficos recharts.
- `src/components/Profile.tsx` — Ficha de utente: edição de dados, carregamento de saldo, tipos de cartão, termos, histórico de saúde.
- `src/components/KioskMode.tsx` — Ecrã de quiosque para leitura de QR Codes (câmara + RFID).
- `src/components/Dashboards.tsx` — Painéis para Utentes (QR Card) e Staff (visão geral).
- `src/components/Utentes.tsx` — Diretório de utentes, filtros, scanner RFID para staff.
- `src/components/ErrorBoundary.tsx` — Trata erros de renderização de componentes individuais para não congelar a aplicação.
- `src/lib/access.ts` — Motor lógico isolado para `handleCheckIn` e `handleCheckOut` (inclui regras de isenção por Cartão Universidade Sénior).
- `src/lib/firebase.ts` — Configuração do Firebase (APP_ID e db).
- `src/types.ts` — Interfaces TypeScript: `UserProfile`, `AccessLog` (inclui `valorPago?`, `isento?`), `Aula`, `Turma`, etc.
- `src/components/AvisosModule.tsx` — Mural de Avisos + broadcast por email (admin/staff).
- `api/send-email.ts` — Função serverless Vercel (nodemailer) para o broadcast de avisos.
- `scripts/auto-checkout.ts` — Saída automática às 20h00 (ver Secção 4).
- **Removidos (2026-06-24):** `Chat.tsx` (sistema de chat eliminado), `StudentWorkoutEditor.tsx`, `UtenteTraining.tsx`.
- `AI_BLUEPRINT.md` — Este ficheiro de documentação.

---

## 6. Design System

Toda a UI deve seguir estes padrões para consistência visual:
- **Contenedores:** `rounded-2xl` ou `rounded-[2rem]`, `bg-white`, `border border-slate-100`, `shadow-sm`
- **Títulos de secção:** `text-[10px] font-black uppercase tracking-widest text-slate-400`
- **Cor de marca:** `#004D71` (azul escuro) e `#F7B500` (amarelo)
- **Badges de estado:** `bg-emerald-50 text-emerald-600` (ativo/dentro), `bg-red-50 text-red-600` (saída), `bg-amber-50 text-amber-600` (aviso)
- **Tabelas:** `border-collapse`, cabeçalhos `sticky top-0` com `bg-slate-50`

---

## 7. Comandos de Desenvolvimento

```bash
npm run dev          # Servidor de desenvolvimento (porta 5173)
npm run dev -- --host=0.0.0.0  # Exposição na rede local (para acesso pelo tablet)
npm run build        # Build de produção (pasta dist/)
npx tsc --noEmit     # Verificar erros TypeScript sem compilar
```

---

## 8. Instruções de Continuidade para IA

Se uma IA receber este ficheiro e for instruída a continuar o projeto:
1. **LER ESTE FICHEIRO COMPLETO** antes de qualquer ação.
2. **VERIFICAR IMPORTS:** Ao modificar objetos Firestore, usar sempre `import { doc, updateDoc, deleteField, Timestamp } from 'firebase/firestore'`.
3. **DESIGN SYSTEM:** Seguir rigorosamente o padrão definido na Secção 6.
4. **NÃO usar `window.confirm()`** — usar modais ou botões inline.
5. **PREÇÁRIO:** Usar sempre a função `getBasePrice(age, modality, isWeekend)` de `AccessLogs.tsx` para calcular preços.
6. **ISENÇÕES:** Verificar sempre `cartao_tipo.includes('Universidade Sénior')` e `atestado_medico` antes de aplicar preços.
7. **COMPILAÇÃO:** Executar `npx tsc --noEmit` após qualquer alteração para verificar erros TypeScript. Nota: este projeto tem um `global.d.ts` que redeclara o namespace `JSX`, o que quebra o "key stripping" automático do TypeScript em componentes customizados usados em `.map()`. Workaround já usado no código: adicionar `key?: any;` ao tipo de props do componente (ver `UtenteRow` em `Utentes.tsx`, `PickerRow` em `Chat.tsx`, `UtenteSyncCard` em `SyncPortalMunicipal.tsx`).
8. **GIT:** Fazer commit após cada funcionalidade. **NÃO fazer `git push` sem autorização explícita do utilizador** — a publicação (GitHub Pages / Vercel) é desencadeada a partir do `main`, por isso um push é uma ação de produção, não só de backup.
9. **DEPLOY DE REGRAS DO FIRESTORE:** `firebase deploy --only firestore:rules` exige sempre `--project complexo-desportivo-vr` (ou `firebase use complexo-desportivo-vr` antes). O `.firebaserc` já foi corrigido para ter este projeto como default (Jun 2026) — antes disso apontava para um projeto Firebase errado (`gen-lang-client-0241795743`), o que pode ter feito com que deploys de regras anteriores nunca chegassem a `complexo-desportivo-vr`, o projeto real da app.

## 9. Estado Atual / Incidentes

**2026-06-24 — RESOLVIDO:** A app em produção ficou sem acesso à base de dados (`permission-denied` mesmo com sessão anónima válida, devido a `.firebaserc` apontar para o projeto Firebase errado). Resolvido pelo utilizador com `firebase login && firebase deploy --only firestore:rules --project complexo-desportivo-vr`. Confirmado novamente operacional com `scripts/test-cloud-connection.ts`.

**2026-06-24 — Lote de alterações** (depois da base de dados restaurada): chat eliminado do projeto; utentes passam a ver Eventos; "Saúde & Metas" e "Treino" removidos do perfil do utente (UI + dados); saída automática às 20h00; contas `chefia` (Carlos Luís, Sandra Carvalho) com password atualizada; sistema de Avisos com broadcast por email (SMTP próprio, ainda sem credenciais configuradas no Vercel); registo rápido de utilização para Pavilhão e Padel; banner de instalação da PWA no login.

*Documento gerado para servir de memória persistente da arquitetura desenvolvida — Complexo Desportivo de Vila de Rei.*

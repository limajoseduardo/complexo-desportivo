# Contexto do Projeto - Complexo Desportivo (Vila Vida / Vila de Rei)

## Ponto de Situação Atual
O projeto é uma aplicação React (construída com Vite e TailwindCSS) para a gestão do complexo desportivo.

### Correções Recentes (Layout e Responsividade):
- **Barra Lateral (Menu):** Tornada mais fina/compacta (`w-56`, `p-4`) para libertar espaço para as tabelas principais no resto do ecrã. Reduzimos o padding e tamanho da letra dos botões de navegação.
- **Barra de Topo (Acessos):** Os títulos e opções da barra de "REGISTO DE ACESSOS" agora empilham verticalmente em ecrãs menores (`xl:flex-row`), impedindo que o título fique colado ou sobreposto.
- **Modalidades (Pills):** O bug do texto cortado com "..." (ex: "GINÁ...") foi resolvido. A grelha de botões das modalidades só força as 8 colunas em ecrãs ultra-largos (`2xl:grid-cols-8`). Em ecrãs normais de portátil e desktop (até 1536px), divide-se em colunas de 4 (`sm:grid-cols-4`), permitindo que as palavras como "Hidroginástica" caibam perfeitamente sem cortes de texto.
- **Servidor Local:** O `localhost:3100` está funcional e a correr via `npm run dev` com sucesso (o `Node.js` teve de ser ativado indicando o caminho absoluto do `npm.cmd`, visto que as variáveis do sistema Windows não o encontravam).

## O que falta fazer / Regras:
1. **Publicação (Deploy):** A IA não tem permissões para executar o *push* para o GitHub nem Vercel por restrição de credenciais. A publicação online em `buildlab.pt` tem de ser desencadeada manualmente pelo utilizador enviando o código para o repositório remoto.
2. **Histórico:** A formatação da tabela de acessos deve ser revista sempre que a visualização colapsar em monitores <14 polegadas.

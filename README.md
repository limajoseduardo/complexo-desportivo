<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Complexo Desportivo

Aplicação do portal do Complexo Desportivo.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure the environment variables in `.env.local`
3. Run the app:
   `npm run dev`

## Modo Local Sem Quota (Firebase Emulator)

Este modo guarda dados localmente no servidor e evita o limite diario do Firestore cloud.

1. Arrancar emuladores (Firestore + Auth):
   `npm run firebase:local`
2. Noutro terminal, arrancar a app:
   `npm run dev`
3. Seed base local (staff + agenda base):
   `npm run firebase:seed`

Emulador UI:
`http://127.0.0.1:4000`

## Migrar Tudo da Cloud Para Local

Quando a quota do Firestore cloud voltar, corre:

`npm run firebase:migrate`

Este script copia os dados da cloud para a base local (mesmos IDs e caminhos), incluindo mensagens em subcolecoes.

## Depois de Migrar e Esquecer Cloud

Mantem `VITE_USE_FIREBASE_EMULATOR=\"true\"` no `.env.local` do servidor.
Assim a app continua local e deixa de depender da cloud para operar.

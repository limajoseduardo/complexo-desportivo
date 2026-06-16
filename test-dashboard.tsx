import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UtenteDashboard } from './src/components/Dashboards';

const user = {
  id: "123",
  role: "utente",
  nome: "Jose",
  n: "Jose",
  isInside: false,
  termo_imagens: true,
  termo_responsabilidade: true
};

try {
  const html = renderToStaticMarkup(<UtenteDashboard user={user} utentes={[]} />);
  console.log("Success! Length:", html.length);
} catch (e) {
  console.log("RENDER ERROR:", e.message);
}

import { UserProfile } from '../types';

export const ZONES = [
  { id: 'gym', label: "Ginásio", target: "Ginásio" },
  { id: 'pool_in', label: "Piscina Coberta", target: "Coberta" },
  { id: 'pool_out', label: "Piscina Exterior", target: "Exterior" },
  { id: 'sauna', label: "Sauna", target: "Sauna" },
  { id: 'fit', label: "Aulas Grupo", target: "Aula" }
];

export const isUserInZone = (user: UserProfile, zoneId: string) => {
  if (!user.isInside) return false;
  const loc = (user.location || '').toLowerCase().trim();

  if (zoneId === 'gym') {
    return loc.includes('ginásio') || loc.includes('ginasio') || loc.includes('gym') || loc.includes('musculação') || loc.includes('g_ginasio') || loc.includes('g_livre');
  }
  if (zoneId === 'pool_in') {
    if (loc.includes('exterior') || loc.includes('fora') || loc.includes('descoberta')) return false;
    return loc.includes('coberta') || loc.includes('piscina') || loc.includes('natação') || loc.includes('hidro') || loc.includes('g_piscina') || loc.includes('dentro') || loc.includes('livre');
  }
  if (zoneId === 'pool_out') {
    return loc.includes('exterior') || loc.includes('fora') || loc.includes('descoberta') || loc.includes('verão');
  }
  if (zoneId === 'sauna') {
    return loc.includes('sauna') || loc.includes('banho turco');
  }
  if (zoneId === 'fit') {
    return loc.includes('aula') || loc.includes('treino') || loc.includes('personal') || loc.includes('dance') || loc.includes('hiit') || loc.includes('g_modalidade');
  }

  return false;
};

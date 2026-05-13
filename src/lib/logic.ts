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
  const mod = (user.modalidade || '').toLowerCase().trim();

  if (zoneId === 'gym') {
    return loc.includes('ginásio') || loc.includes('ginasio') || loc.includes('gym') || loc.includes('musculação') || loc.includes('g_ginasio') || mod.includes('ginásio') || mod.includes('ginasio');
  }
  if (zoneId === 'pool_in') {
    if (loc.includes('exterior') || loc.includes('fora') || loc.includes('descoberta')) return false;
    return loc.includes('coberta') || loc.includes('piscina') || loc.includes('natação') || loc.includes('hidro') || loc.includes('g_piscina') || loc.includes('dentro') || loc.includes('livre') || mod.includes('piscina');
  }
  if (zoneId === 'pool_out') {
    return loc.includes('exterior') || loc.includes('fora') || loc.includes('descoberta') || loc.includes('verão') || mod.includes('exterior');
  }
  if (zoneId === 'sauna') {
    return loc.includes('sauna') || loc.includes('banho turco') || mod.includes('sauna');
  }
  if (zoneId === 'fit') {
    return loc.includes('aula') || loc.includes('treino') || loc.includes('personal') || loc.includes('dance') || loc.includes('hiit') || loc.includes('g_modalidade') || mod.includes('fitness') || mod.includes('aula');
  }
  if (zoneId === 'natacao') {
    return loc.includes('natação') || loc.includes('nível') || loc.includes('nivel') || mod.includes('natação') || mod.includes('nataçao');
  }
  if (zoneId === 'nat1') {
    return loc.includes('nível 1') || loc.includes('nivel 1') || loc.includes('natação nível 1') || mod.includes('nível 1') || mod.includes('nivel 1');
  }
  if (zoneId === 'nat2') {
    return loc.includes('nível 2') || loc.includes('nivel 2') || loc.includes('natação nível 2') || mod.includes('nível 2') || mod.includes('nivel 2');
  }
  if (zoneId === 'nat3') {
    return loc.includes('nível 3') || loc.includes('nivel 3') || loc.includes('natação nível 3') || mod.includes('nível 3') || mod.includes('nivel 3');
  }
  if (zoneId === 'hidro') {
    return loc.includes('hidro') || mod.includes('hidro');
  }
  if (zoneId === 'bebes') {
    return loc.includes('bebé') || loc.includes('bebe') || loc.includes('/ama') || loc.includes('bebés/ama') || mod.includes('bebé') || mod.includes('bebe');
  }
  if (zoneId === 'livre') {
    return loc.includes('regime livre') || loc.includes('piscina livre') || loc.includes('livre/geral') || loc.includes('geral') || loc.includes('g_livre') || mod.includes('regime livre');
  }
  if (zoneId === 'padel') {
    return loc.includes('padel') || loc.includes('pádel') || loc.includes('campo padel') || loc.includes('campo pádel') || mod.includes('padel');
  }
  if (zoneId === 'pavilhao') {
    return loc.includes('pavilhao') || loc.includes('pavilhão') || loc.includes('pavilhao municipal') || loc.includes('pavilhão municipal') || mod.includes('pavilhao') || mod.includes('pavilhão');
  }

  return false;
};

/**
 * Convertit un code couleur hexadécimal (#RRGGBB) en entier numérique Discord
 */
export function hexToDecimalColor(hex: string): number {
  const cleaned = hex.replace('#', '');
  return parseInt(cleaned, 16);
}

/**
 * Convertit un entier numérique de couleur Discord en hexadécimal (#RRGGBB)
 */
export function decimalToHexColor(decimal: number): string {
  if (!decimal || decimal === 0) return '#64748B';
  return '#' + decimal.toString(16).padStart(6, '0').toUpperCase();
}

/**
 * Normalise un nom de salon Discord (minuscules, tirets, caractères alphanumériques)
 */
export function sanitizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Normalisation stricte pour comparaison (ignore tirets, espaces, emojis et accents)
 * Permet d'éviter les faux positifs lors de la synchronisation de salons
 */
export function normalizeDiscordName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Découpe un identifiant stable en type et valeur
 * Ex: "role:admin" -> { type: 'role', key: 'admin' }
 * Ex: "user:123456" -> { type: 'user', key: '123456' }
 */
export function parseTargetKey(targetKey: string): { type: 'role' | 'user'; key: string } {
  const parts = targetKey.split(':');
  if (parts.length >= 2 && (parts[0] === 'role' || parts[0] === 'user')) {
    return {
      type: parts[0] as 'role' | 'user',
      key: parts.slice(1).join(':')
    };
  }
  // Par défaut, traite comme un rôle
  return { type: 'role', key: targetKey };
}

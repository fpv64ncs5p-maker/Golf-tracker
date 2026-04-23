// Club distance data and migration mappings

export const DEFAULT_CLUB_DISTANCES: Record<string, { carry: string; total: string; ballSpeed: string; direction: string; note: string; updatedAt: string }> = {
  'Driver': { carry: '89',  total: '170', ballSpeed: '', direction: 'C30% R60%',       note: 'Risky – use selectively',           updatedAt: new Date('2026-01-01').toISOString() },
  '3W':     { carry: '82',  total: '129', ballSpeed: '', direction: 'L17% C83%',        note: 'Wide holes only, flat terrain',     updatedAt: new Date('2026-01-01').toISOString() },
  '5W':     { carry: '107', total: '118', ballSpeed: '', direction: 'L23% C62% R16%',   note: 'Go-to tee club. Reliable carry',    updatedAt: new Date('2026-01-01').toISOString() },
  '4H':     { carry: '97',  total: '140', ballSpeed: '', direction: 'C66% R33%',        note: 'Emergency tee club – trust it!',    updatedAt: new Date('2026-01-01').toISOString() },
  '5i':     { carry: '100', total: '138', ballSpeed: '', direction: 'C67% R33%',        note: 'Good contact rate',                 updatedAt: new Date('2026-01-01').toISOString() },
  '6i':     { carry: '105', total: '132', ballSpeed: '', direction: 'L17% C17% R67%',   note: 'Direction work needed',             updatedAt: new Date('2026-01-01').toISOString() },
  '7i':     { carry: '84',  total: '136', ballSpeed: '', direction: 'L17% C17% R67%',   note: 'Perfect for short par-3s',          updatedAt: new Date('2026-01-01').toISOString() },
  '8i':     { carry: '104', total: '127', ballSpeed: '', direction: 'L17% C17% R67%',   note: 'Approach 70–85m',                   updatedAt: new Date('2026-01-01').toISOString() },
  '9i':     { carry: '109', total: '146', ballSpeed: '', direction: 'C34% R67%',        note: 'Approach 65–75m',                   updatedAt: new Date('2026-01-01').toISOString() },
  'PW':     { carry: '74',  total: '85',  ballSpeed: '', direction: 'C17% R83%',        note: 'Full & ¾ swing control',            updatedAt: new Date('2026-01-01').toISOString() },
  'SW':     { carry: '97',  total: '128', ballSpeed: '', direction: 'C54% R45%',        note: 'Chip & splash options',             updatedAt: new Date('2026-01-01').toISOString() },
};

// Maps old full-name keys to new abbreviations for migration
export const OLD_KEY_MAP: Record<string, string> = {
  '3 Wood': '3W',
  '5 Wood': '5W',
  '4 Hybrid': '4H',
  '5 Hybrid': '5H',
  '4 Iron': '4i',
  '5 Iron': '5i',
  '6 Iron': '6i',
  '7 Iron': '7i',
  '8 Iron': '8i',
  '9 Iron': '9i',
};

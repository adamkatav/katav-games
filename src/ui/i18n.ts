/**
 * Every Hebrew string in the product, in one place, so nothing ends up with
 * two names across games. DESIGN.md §9 treats this vocabulary as fixed.
 */
export const T = {
  appName: 'משחקי קלפים',
  chooseGame: 'בחרו משחק כדי להתחיל',

  menu: 'תפריט',
  undo: 'ביטול',
  hint: 'רמז',
  newGame: 'משחק חדש',
  settings: 'הגדרות',
  howToPlay: 'איך משחקים',
  resume: 'המשך משחק',

  score: 'ניקוד',
  moves: 'מהלכים',
  time: 'זמן',
  best: 'שיא',
  streak: 'רצף',

  wellDone: '🎉 כל הכבוד!',
  notThisTime: 'הפעם לא הסתדר',
  playAgain: 'עוד משחק',
  newBest: '⭐ שיא חדש! ⭐',

  confirmNewTitle: 'להתחיל משחק חדש?',
  confirmNewBody: 'המשחק הנוכחי יימחק ולא יהיה אפשר לחזור אליו.',
  yes: 'כן',
  noBack: 'לא, חזרה למשחק',
  close: 'סגירה',
  gotIt: 'הבנתי, קדימה!',

  noMoves: 'אין מהלך זמין',
  stuckTitle: 'אין יותר מהלכים',
  stuckBody: 'אפשר לבטל כמה מהלכים אחורה ולנסות דרך אחרת, או להתחיל משחק חדש.',

  chooseDifficulty: 'בחרו רמת קושי',

  ratings: [
    '',
    'לא נורא — העיקר ההנאה!',
    'יפה מאוד!',
    'משחק טוב!',
    'מצוין! כמעט מושלם',
    'מושלם! אלוף אמיתי 🏆',
  ] as const,

  settingsLabels: {
    marks: 'סימון מקומות אפשריים',
    marksNote: 'כשמופעל — אחרי לחיצה על קלף, כל המקומות שאפשר להניח אותו בהם נדלקים בזהב.',
    size: 'גודל הקלפים',
    direction: 'כיוון הלוח',
    sound: 'צלילים',
    on: 'מופעל',
    off: 'כבוי',
    sizes: ['רגיל', 'גדול', 'ענק'] as const,
    rtl: 'מימין לשמאל',
    ltr: 'משמאל לימין',
    soundOn: '🔊 פועלים',
    soundOff: '🔇 כבויים',
  },

  byline: (version: string) => `v${version} · by Adam Katav`,
} as const;

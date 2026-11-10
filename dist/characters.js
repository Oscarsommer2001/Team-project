// Pixel-art coach sprites: transparent PNGs in assets/coaches/<coach>-<mood>.png (256x256, built from
// 32x32 grids by tools/build_sprites.py). Moods: 'happy' | 'neutral' | 'upset'.
const COACH_MOODS = ['happy', 'neutral', 'upset'];
const COACH_TONES = ['retriever', 'younger', 'coworker', 'mum', 'sergeant'];

function coachSrc(tone, mood = 'neutral') {
  return `assets/coaches/${COACH_TONES.includes(tone) ? tone : 'retriever'}-${COACH_MOODS.includes(mood) ? mood : 'neutral'}.png`;
}

// Decorative <img> for the corner coach and toasts (the surrounding element carries the label).
function coachImg(tone, mood) {
  return `<img src="${coachSrc(tone, mood)}" alt="" width="256" height="256" decoding="async">`;
}

// Maps app statuses ('done', 'later', 'slip', 'pending', 'neutral', 'success') to a face.
function moodForStatus(status) {
  if (status === 'done' || status === 'success') return 'happy';
  if (status === 'later' || status === 'slip') return 'upset';
  return 'neutral';
}

// Absolute URL of the sprite, used as the icon of browser notifications.
function coachIconURL(tone, mood) {
  return Promise.resolve(new URL(coachSrc(tone, mood), location.href).href);
}

// Preload every sprite so mood changes swap instantly.
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => COACH_TONES.forEach((t) => COACH_MOODS.forEach((m) => { new Image().src = coachSrc(t, m); })));
}

if (typeof module !== 'undefined') module.exports = { coachSrc, moodForStatus };

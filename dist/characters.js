// Pixel-art coach sprites (32x32, handheld-game style), rendered as crisp SVG.
// Each sprite = palette + 32 rows of characters ('.' = background) + per-mood face patches.
// coachSVG(tone, mood) -> SVG string. Moods: 'happy' | 'neutral' | 'upset'.
// A patch is [x, y, 'chars']: it overwrites pixels from (x, y) to the right; '?' keeps a pixel.

const SPRITES = {
  retriever: {
    bg: '#fbe9c9',
    pal: { K: '#3b2a14', Y: '#f2b040', O: '#c97a22', L: '#f9dc9c', N: '#4a2a18', W: '#ffffff', P: '#e86a6a', R: '#8f2f26', G: '#6f9a45', C: '#f3e6c0', T: '#8fc3e3', Z: '#ef8b5a' },
    rows: [
      '................................',
      '................................',
      '................................',
      '...........KKKKKKKKKK...........',
      '.........KKYYYYYYYYYYKK.........',
      '........KYYYYYYYYYYYYYYK........',
      '......KKKYYYYYYYYYYYYYYKKK......',
      '.....KOOKYYYYYYYYYYYYYYKOOK.....',
      '....KOOOKYYYYYYYYYYYYYYKOOOK....',
      '....KOOKYYYYYYYYYYYYYYYYKOOK....',
      '....KOOKYYYWKYYYYYYWKYYYKOOK....',
      '....KOOKYYYKKYYYYYYKKYYYKOOK....',
      '....KOOKYYYYYYLLLLYYYYYYKOOK....',
      '....KOOKYYYYLLNNNNLLYYYYKOOK....',
      '....KOOKYYYYLLLNNLLLYYYYKOOK....',
      '....KOOKYYYYLKLLLLKLYYYYKOOK....',
      '.....KOKYYYYLLKKKKLLYYYYKOK.....',
      '.....KKKYYYYYLLPPLLYYYYYKKK.....',
      '......KKYYYYYYYPPYYYYYYYKK......',
      '......KYYYYYYYYYYYYYYYYYYK......',
      '.....KYYYYYYYYYYYYYYYYYYYYK.....',
      '....KYYKKKKKKKKKKKKKKKKKKYYK....',
      '...KYYKGGGGGGGGGGGGGGGGGGKYYK...',
      '..KYYYYKGGGGGGGGGGGGGGGGKYYYYK..',
      '..KYYYYYKGGGGGGCCGGGGGGKYYYYYK..',
      '.KYYYYYYYKGGGGCCCCGGGGKYYYYYYYK.',
      '.KYYYYYYYYKGGGGCCGGGGKYYYYYYYYK.',
      'KYYYYYYYYYYKGGGGGGGGKYYYYYYYYYYK',
      'KYYYYYYYYYYYKGGGGGGKYYYYYYYYYYYK',
      'KYYYYYYYYYYYYKGGGGKYYYYYYYYYYYYK',
      'KYYYYYYYYYYYYYKGGKYYYYYYYYYYYYYK',
      'KYYYYYYYYYYYYYYKKYYYYYYYYYYYYYYK',
    ],
    moods: {
      happy: [[10, 10, 'YKKY'], [10, 11, 'KYYK'], [18, 10, 'YKKY'], [18, 11, 'KYYK'],
        [12, 15, 'LKKKKKKL'], [12, 16, 'LKRRRRKL'], [13, 17, 'KPPPPK'], [14, 18, 'KPPK'],
        [2, 4, 'Z'], [3, 5, 'Z'], [1, 7, 'ZZ'], [29, 4, 'Z'], [28, 5, 'Z'], [29, 7, 'ZZ']],
      upset: [[10, 9, 'KKK'], [10, 10, 'KWK'], [10, 11, 'KKK'], [19, 9, 'KKK'], [19, 10, 'KWK'], [19, 11, 'KKK'],
        [22, 12, 'T'], [22, 13, 'T'],
        [12, 15, 'LLKKKKLL'], [12, 16, 'LKLLLLKL'], [13, 17, 'LLLLLL'], [15, 18, 'YY']],
    },
  },

  younger: {
    bg: '#fbf6ea', lines: '#c9d5e3', margin: '#e8b4b4', dx: 1,
    pal: { K: '#4a3326', H: '#b5642f', h: '#8a4520', S: '#f3b98f', s: '#e09a6e', F: '#c4703d', E: '#3d5a3c', W: '#ffffff', B: '#8aa6c8', R: '#c45a48', r: '#93402f', Y: '#f2c94c', T: '#8fc3e3' },
    rows: [
      '................................',
      '..........K...K...K.............',
      '.........KHK.KHK.KHK............',
      '.......KKHHHKHHHKHHHKK..........',
      '......KHHHHHHHHHHHHHHHHK........',
      '.....KHHHHhHHHHHHHHhHHHHK.......',
      '....KHHHhHHHHHHHHHHHHhHHHK......',
      '....KHHHHHSHHHHHHHSHHHHHHK......',
      '....KHHSSSSHSSSSSSHSSSSHHK......',
      '.....KHHSSSSSSSSSSSSSSHHK.......',
      '.....KHSSKKKSSSSSSKKKSSHK.......',
      '...KSKSSSSEWSSSSSSEWSSSSKSK.....',
      '...KSKSSSSEESSSSSSEESSSSKSK.....',
      '....KKSSFSFSSSssSSSFSFSSKK......',
      '.....KSSSSSSSKKKKSSSSSSSK.......',
      '.....KSSSSSSSSSSSSSSSSSSK.......',
      '......KSSSSSSSSSSSSSSSSK........',
      '.......KKSSSSSSSSSSSSKK.........',
      '.........KKKSSSSSSKKK...........',
      '....KKBBBBBKSSSSSSKBBBBBKK......',
      '...KBBBBBBBKKKKKKKKBBBBBBBK.....',
      '..KBBBBBBBBBBBBBBBBBBBBBBBBK....',
      '.KBBBBBBKKKKKKKKKKKKKKBBBBBBK...',
      '.KBBBBBBKRRRRRRRRRRRRKBBBBBBK...',
      '.KBBBBBBKrRRRRRRRRRRRKBBBBBBK...',
      '.KBBBBKSSSRRRRRRRRRRSSSKBBBBK...',
      '.KBBBBKSSSRRRRRRRRRRSSSKBBBBK...',
      '.KBBBBBKKKrRRRRRRRRRKKKBBBBBK...',
      '.KBBBBBBBKrRRRRRRRRRKBBBBBBBK...',
      '.KBBBBBBBKKKKKKKKKKKKBBBBBBBK...',
      '.KBBBBBBBBBBBBBBBBBBBBBBBBBBK...',
      '.KBBBBBBBBBBBBBBBBBBBBBBBBBBK...',
    ],
    moods: {
      happy: [[12, 14, 'KSSSSK'], [13, 15, 'KKKK'], [27, 1, 'Y'], [26, 2, 'YYY'], [27, 3, 'Y']],
      upset: [[10, 9, 'KK'], [9, 10, 'KSS'], [18, 9, 'KK'], [18, 10, 'SSK'], [10, 11, 'EE'], [18, 11, 'EE'],
        [12, 14, 'SSKKSS'], [12, 15, 'SKSSKS'], [21, 13, 'T'], [21, 14, 'T']],
    },
  },

  coworker: {
    bg: '#f6e1c3',
    pal: { K: '#25402a', H: '#8b4a25', h: '#6a3418', S: '#f3b98f', s: '#e09a6e', p: '#ee9278', E: '#2b2b2b', W: '#fffaf0', R: '#c45a50', G: '#6f9a45', g: '#4c7330', M: '#f3ead8', L: '#7d9a52', A: '#e2a93b', v: '#c9b8a0' },
    rows: [
      '................................',
      '.....KKKK.......................',
      '....KHHHHK......................',
      '...KHHhHHHKKKKKKKKK.............',
      '...KHHHHHKHHHHHHHHHHKK..........',
      '....KHHHKHHHHHHHHHHHHHK.........',
      '.....KKKHHHHHHHHHHHHHHHK........',
      '......KHHHHHHHHHHHHHHHHHK.......',
      '......KHHHHHHHHHSSSSSSSHHK......',
      '......KHHHHHSSSSSSSSSSSSHK......',
      '......KHHSSKKKSSSSKKKSSSHK......',
      '......KHSSKKKKKSSKKKKKSSHK......',
      '......KHSKKWEEKKKKWEEKKSHK......',
      '......KHSSKSSSKSSKSSSKSSHK......',
      '......KHSSKKKKKSSKKKKKSSHK......',
      '.....AKHSSSpSSSssSSSpSSSHKA.....',
      '......KHSSSSSRRRRRSSSSSSHK......',
      '......KHHSSSSSSSSSSSSSSHHK......',
      '.......KHSSSSSSSSSSSSSSHK.......',
      '........KKSSSSSSSSSSSSKK........',
      '..........KKSSSSSSSSKK..........',
      '.......KKKGGKWSSSSWKGGKKK.......',
      '..v..KGGGGGGKWWSSWWKGGGGGGK.....',
      '...vKGGGGGGGgKWWWWKgGGGGGGGK....',
      '..v.KGGGGGGGGgKWWKgGGGGGGGGGK...',
      '..KKKKKKKGGGGGgKKgGGGGGGGGGGK...',
      '..KMMMMMKGGGGGgGGgGGGGGGGGGGK...',
      '..KMMLMMKSSGGGgGGgGGGGGGGGGGK...',
      '..KMLLLMKSSSGGgGGgGGGGGGGGGGK...',
      '..KMMLMMKSSGGGgGGgGGGGGGGGGGK...',
      '..KMMMMMKGGGGGgGGgGGGGGGGGGGK...',
      '..KKKKKKKGGGGGgGGgGGGGGGGGGGK...',
    ],
    moods: {
      happy: [[11, 12, 'SSS'], [18, 12, 'SSS'], [11, 13, 'KKK'], [18, 13, 'KKK'], [13, 16, 'RSSSSR'], [14, 17, 'RRRR']],
      upset: [[11, 9, 'KKK'], [11, 10, 'SSS'], [11, 12, 'KKK'], [18, 12, 'KKK'], [12, 16, 'SKKKKKS']],
    },
  },

  mum: {
    bg: '#f8e3c6',
    pal: { K: '#3a1f1a', H: '#9a5a2c', h: '#74401c', S: '#f3b98f', s: '#e09a6e', p: '#ee9278', r: '#e2534a', E: '#3a1f1a', W: '#ffffff', R: '#9c3b30', T: '#ef8a8a', A: '#e2a93b', C: '#ec8d6c', c: '#c96a4c', G: '#7d9a52', L: '#e6edcf' },
    rows: [
      '................................',
      '..........KKKKKKKKKKKK..........',
      '........KKHHHHHHHHHHHHKK........',
      '.......KHHHHHHHHHHHHHHHHK.......',
      '......KHHHHHhHHHHHHhHHHHHK......',
      '.....KHHHHHHHHHHHHHHHHHHHHK.....',
      '.....KHHHHHHSSSSSSSSHHHHHHK.....',
      '.....KHHHHHSSSSSSSSSSHHHHHK.....',
      '....KHHHHKSSSSSSSSSSSSKHHHHK....',
      '....KHHHHKSKKKSSSSKKKSKHHHHK....',
      '....KHHHHKSSEWSSSSEWSSKHHHHK....',
      '....KHHHHKSSEESSSSEESSKHHHHK....',
      '....KHHHHKSpSSSssSSSpSKHHHHK....',
      '....KHHHAKSSSSSRRSSSSSKAHHHK....',
      '....KHHHAKSSSSSSSSSSSSKAHHHK....',
      '....KHHHHHKSSSSSSSSSSKHHHHHK....',
      '....KHHHHHHKSSSSSSSSKHHHHHHK....',
      '....KHHHHHHHKKSSSSKKHHHHHHHK....',
      '....KHHHHHHHKKSSSSKKHHHHHHHK....',
      '..KKCCCCCCCCKKSSSSKKCCCCCCCCKK..',
      '.KCCCCCCCGGCCccccccCCGGCCCCCCCK.',
      '.KCCCCCCCGGCCCCCCCCCCGGCCCCCCCK.',
      '.KCCCCCCCKGGGGGGGGGGGGKCCCCCCCK.',
      '.KCCCCCCKGGLGGGGGGGGLGGKCCCCCCK.',
      '.KCCCCCCKGLLLGGGGGGLLLGKCCCCCCK.',
      '.KCCCCCCKGGLGGGGGGGGLGGKCCCCCCK.',
      '.KCCCCCCKGGGGGGLLGGGGGGKCCCCCCK.',
      '.KCCCCCCKGGGGGLLLLGGGGGKCCCCCCK.',
      '.KCCCCCCKGGGGGGLLGGGGGGKCCCCCCK.',
      '.KCCCCCCKGGLGGGGGGGGLGGKCCCCCCK.',
      '.KCCCCCCKGLLLGGGGGGLLLGKCCCCCCK.',
      '.KCCCCCCKGGLGGGGGGGGLGGKCCCCCCK.',
    ],
    moods: {
      neutral: [[18, 8, 'KKK'], [18, 9, 'SSS']],
      happy: [[12, 10, 'KK'], [11, 11, 'KSSK'], [18, 10, 'KK'], [17, 11, 'KSSK'], [13, 13, 'KRRRRK'], [14, 14, 'KTTK']],
      upset: [[11, 8, 'K'], [20, 8, 'K'], [11, 9, 'SKK'], [18, 9, 'KKS'], [11, 12, 'r'], [20, 12, 'r'],
        [14, 13, 'KRRK'], [14, 14, 'KTTK'], [15, 15, 'KK'],
        [28, 11, 'K'], [28, 12, 'S'], [29, 12, 'K'], [28, 13, 'SK'], [28, 14, 'SK'], [28, 15, 'SK'], [28, 16, 'SK'], [28, 17, 'SK'], [28, 18, 'SK'],
        [26, 19, 'KSSK'], [26, 20, 'KSSSK'], [26, 21, 'KKKKK'], [30, 8, 'K'], [31, 10, 'K']],
    },
  },

  sergeant: {
    bg: '#f3dfbd',
    pal: { K: '#1f2414', G: '#7d8a45', g: '#5d6a30', B: '#6b4a2b', A: '#e2a93b', M: '#7a4524', S: '#f2aa7c', s: '#d98a5e', W: '#ffffff', E: '#3d5a3c', R: '#9c3b30', T: '#ef8a8a' },
    rows: [
      '..............KKKK..............',
      '............KKGGGGKK............',
      '...........KGgGGGGgGK...........',
      '..........KGGgGGGGgGGK..........',
      '.........KGGGgGGGGgGGGK.........',
      '.........KBBBBBBBBBBBBK.........',
      '.........KBABBBBBBBBABK.........',
      '..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
      '.KGGGGGGGGGGGGGGGGGGGGGGGGGGGGK.',
      '..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
      '.........KMSSSSSSSSSSMK.........',
      '.........KMKKKSSSSKKKMK.........',
      '.......KSKSSWESSSSEWSSKSK.......',
      '.......KSKSSSSSssSSSSSKSK.......',
      '.......KSKSSMMMMMMMMSSKSK.......',
      '.........KSSMSKKKKSMSSK.........',
      '.........KSSSSSSSSSSSSK.........',
      '.........KKSSSSSSSSSSKK.........',
      '..........KKSSSSSSSSKK..........',
      '....KKKKKKKKKSSSSSSKKKKKKKKK....',
      '...KGGGGGGGGGKSSSSKGGGGGGGGGK...',
      '..KGGGGGGGGgGGKSSKGGgGGGGGGGGK..',
      '.KGGGGGGGGGgGGGKKGGGgGGGGGGGGGK.',
      '.KGGGGGGGGGGGGGGgGGGGGGGGGGGGGK.',
      '.KGGGKKKKKKKKKKKKKKKKKKKKKKGGGK.',
      '.KGGKSSSSSSSSSSSSSSSSSSSSSSKGGK.',
      '.KGKSSSSSSsSSSSSSSSSSsSSSSSSKGK.',
      '.KGKSSSSSSSKKKKKKKKKKSSSSSSSKGK.',
      '.KGKSSSSSSSSSSSSSSSSSSSSSSSSKGK.',
      '.KGGKSSSSSSSSSSSSSSSSSSSSSSKGGK.',
      '.KGGGKKKKKKKKKKKKKKKKKKKKKKGGGK.',
      '.KGGGGGGGGGGGGGGgGGGGGGGGGGGGGK.',
    ],
    moods: {
      happy: [[11, 11, 'SKKSSSSKKS'], [12, 15, 'KWWWWWWK'], [13, 16, 'KKKKKK']],
      upset: [[12, 15, 'KRRRRRRK'], [12, 16, 'KRRTTRRK'], [13, 17, 'KKKKKK'],
        [3, 11, 'K'], [2, 13, 'KK'], [3, 15, 'K'], [28, 11, 'K'], [28, 13, 'KK'], [28, 15, 'K']],
    },
  },
};

const MOODS = ['happy', 'neutral', 'upset'];
const SIZE = 36; // 32x32 sprite inside a 2-pixel stepped frame

function spriteGrid(tone, mood) {
  const sp = SPRITES[tone] || SPRITES.retriever;
  const grid = sp.rows.map((r) => r.split(''));
  for (const [x, y, chars] of sp.moods[mood] || []) {
    [...chars].forEach((ch, i) => { if (ch !== '?' && grid[y] && x + i < 32) grid[y][x + i] = ch; });
  }
  return { sp, grid };
}

function coachSVG(tone, mood = 'neutral') {
  if (!MOODS.includes(mood)) mood = 'neutral';
  const { sp, grid } = spriteGrid(tone, mood);
  const ink = sp.pal.K;
  const px = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const inside = (x, y) => x >= 1 && x <= 34 && y >= 1 && y <= 34 && !((x === 1 || x === 34) && (y === 1 || y === 34));
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (inside(x, y)) px[y][x] = sp.lines && y % 4 === 2 ? sp.lines : sp.margin && x === 4 ? sp.margin : sp.bg;
    else if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) px[y][x] = ink;
  }
  const dx = 2 + (sp.dx || 0), dy = 3;
  grid.forEach((row, y) => row.forEach((ch, x) => {
    const X = x + dx, Y = y + dy;
    if (ch !== '.' && sp.pal[ch] && inside(X, Y)) px[Y][X] = sp.pal[ch];
  }));
  let rects = '';
  px.forEach((row, y) => {
    for (let x = 0; x < SIZE;) {
      const c = row[x];
      let w = 1;
      while (x + w < SIZE && row[x + w] === c) w++;
      if (c) rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
      x += w;
    }
  });
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" class="coach-svg" aria-hidden="true">${rects}</svg>`;
}

// Maps app statuses ('done', 'later', 'slip', 'pending', 'neutral', 'success') to a face.
function moodForStatus(status) {
  if (status === 'done' || status === 'success') return 'happy';
  if (status === 'later' || status === 'slip') return 'upset';
  return 'neutral';
}

// Rasterises a coach to a crisp PNG data URL, used as the icon of browser notifications.
function coachIconURL(tone, mood, size = 192) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
      try { resolve(c.toDataURL('image/png')); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(coachSVG(tone, mood));
  });
}

if (typeof module !== 'undefined') module.exports = { coachSVG, moodForStatus, SPRITES };

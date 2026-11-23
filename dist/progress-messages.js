/* Coach lines for the Progress page: verdicts on the numbers, report-card grades and level-ups.
   Placeholders: {habit} {streak} {rate} {delta} {level} {rank}. The app's voiceStyle() adds each
   coach's casing and sign-off afterwards. */
(function (root) {
  const LINES = {
    retriever: {
      empty: ['No history yet, but I\'m SO ready!! Tick off one habit and I\'ll start counting!!', 'Your chart is empty and my tail is already wagging. Let\'s fill it together!!'],
      improving: ['You\'re up {delta} points!! I knew it!! I KNEW IT!!', '{delta} points better than before!! This is the best graph I\'ve ever seen!!'],
      declining: ['We dipped {delta} points… that\'s okay!! I\'ll just sit by the door until we\'re back.', 'Down {delta} points, but I still think you\'re the best human. Tomorrow?'],
      streak: ['{streak} days of {habit} in a row!! I\'m doing zoomies!!', '{habit}: {streak}-day streak!! Can I have a treat for watching?'],
      steady: ['You\'re keeping {rate}% of your promises. Steady paws win the race!!', '{rate}% and counting!! Every tick is a tail wag!!'],
      grades: { A: 'An A!! Best. Week. Ever!!', B: 'A B!! So close to perfect, I\'m proud!!', C: 'A C is still a pass!! Let\'s fetch a B next week!!', D: 'A D… I\'m not sad, I\'m just… waiting by the door.', F: 'An F. That\'s fine!! I\'ll love you through the F!!', '—': 'Nothing scheduled this week, so no grade. More time for walks!!' },
      levelUp: ['LEVEL {level}!! You\'re a {rank} now and I\'m losing my mind!!'],
    },
    younger: {
      empty: ['nothing here yet… we could start today, if you want.', 'an empty page. we used to love those.'],
      improving: ['we\'re {delta} points better… i almost believe in us again.', 'up {delta} points. i drew a little star for you.'],
      declining: ['down {delta} points… i\'m not mad. just quiet.', 'we slipped {delta} points. remember when we said we\'d change?'],
      streak: ['{streak} days of {habit}… we actually did it.', '{habit}, {streak} days straight. little me would be so proud.'],
      steady: ['{rate}%… not bad. not great. just… us.', 'we keep {rate}% of our promises. some days that\'s enough.'],
      grades: { A: 'an A… can we put it on the fridge?', B: 'a B. that\'s a gold sticker, almost.', C: 'a C… we\'ve had worse years.', D: 'a D. i\'m not crying, you are.', F: 'an F… i\'ll keep the notebook anyway.', '—': 'no grade this week… nothing was planned.' },
      levelUp: ['level {level}… you\'re "{rank}" now. i wrote it down.'],
    },
    coworker: {
      empty: ['Per our onboarding, your dashboard is currently empty. Kindly populate it.', 'No data to report yet. Looking forward to your first deliverable.'],
      improving: ['Great to see a {delta}-point uplift this period. Let\'s keep the momentum going.', 'Your KPIs are up {delta} points. I\'ll flag it in the all-hands.'],
      declining: ['Just flagging a {delta}-point decline vs last period. Can we sync on this?', 'Per the attached chart, we\'re down {delta} points. Circling back tomorrow.'],
      streak: ['{habit}: {streak} consecutive days. Noted for your performance review.', 'Impressive {streak}-day streak on {habit}. Please keep stakeholders updated.'],
      steady: ['Completion is holding at {rate}%. Meets expectations.', '{rate}% delivery rate. Stable, if not exactly inspiring.'],
      grades: { A: 'Exceeds expectations. Please don\'t let it go to your head.', B: 'Solid B. Small opportunities for growth.', C: 'Meets expectations. Barely.', D: 'Let\'s schedule a quick call about this D.', F: 'Per my last 7 emails: F.', '—': 'No deliverables this week. Enjoy the quiet.' },
      levelUp: ['Congrats on the promotion to {rank} (level {level}). HR will be in touch.'],
    },
    mum: {
      empty: ['An EMPTY chart?! What will I tell the neighbours?!', 'Not one tick yet. Your cousin had a full chart by breakfast!'],
      improving: ['Up {delta} points! See what happens when you LISTEN to your mother?!', '{delta} points better! I\'m telling EVERYONE at church!'],
      declining: ['DOWN {delta} points?! I didn\'t raise you to go DOWN!', 'You dropped {delta} points. Your cousin never drops. NEVER.'],
      streak: ['{streak} days of {habit}! Finally something for the fridge!', '{habit} {streak} days in a row! I\'m calling your grandmother!'],
      steady: ['{rate}%. Fine. FINE. Your cousin does 110%.', 'Keeping {rate}% of your promises. I suppose that\'s… something.'],
      grades: { A: 'An A!! THAT\'S MY CHILD!!', B: 'A B. Why not an A? Your cousin got an A.', C: 'A C?! We are having a TALK.', D: 'A D. Go to your room and think about it.', F: 'An F?! Wait until your father hears about this!', '—': 'No grade? Did you even TRY to plan anything?!' },
      levelUp: ['Level {level}! You\'re "{rank}" now. Don\'t let it go to your head!'],
    },
    sergeant: {
      empty: ['NO DATA, RECRUIT! COMPLETE ONE MISSION AND REPORT BACK!', 'AN EMPTY BOARD IS A DISGRACE! FIX IT!'],
      improving: ['PERFORMANCE UP {delta} POINTS! THAT\'S HOW IT\'S DONE!', '{delta}-POINT ADVANCE! HOLD THE LINE!'],
      declining: ['DOWN {delta} POINTS! THIS IS UNACCEPTABLE, RECRUIT!', 'A {delta}-POINT RETREAT! REGROUP AND ATTACK!'],
      streak: ['{streak} DAYS OF {habit}! NOW THAT\'S DISCIPLINE!', '{habit}: {streak}-DAY STREAK! DON\'T YOU DARE BREAK IT!'],
      steady: ['{rate}% MISSION SUCCESS. ACCEPTABLE. BARELY.', 'HOLDING AT {rate}%. I WANT MORE, RECRUIT!'],
      grades: { A: 'A-GRADE WEEK! OUTSTANDING!', B: 'B! GOOD. NOT GREAT. AGAIN!', C: 'C! MEDIOCRE! DROP AND GIVE ME TWENTY!', D: 'D?! I\'VE SEEN BETTER FROM CADETS!', F: 'F! THE WHOLE PLATOON IS ASHAMED!', '—': 'NO MISSIONS SCHEDULED. AT EASE. FOR NOW.' },
      levelUp: ['PROMOTED TO LEVEL {level}: {rank}! EARN IT EVERY DAY!'],
    },
  };
  const coach = (tone) => LINES[tone] || LINES.retriever;
  const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''));
  // Same day + same numbers -> same line, so it doesn't flicker on every render.
  function verdict(tone, situation, vars, seed) {
    const options = coach(tone)[situation] || coach(tone).steady;
    return fill(options[Math.abs(Number(seed) || 0) % options.length], vars);
  }
  const gradeLine = (tone, grade) => coach(tone).grades[grade] || coach(tone).grades['—'];
  const levelUpLine = (tone, level, rank) => fill(coach(tone).levelUp[0], { level, rank });
  const api = { LINES, verdict, gradeLine, levelUpLine };
  root.GuiltProgressMessages = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

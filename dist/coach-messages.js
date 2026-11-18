(function (root) {
  const additions = {
    retriever: [
      'I believe in you!! One tiny step and the day is already wagging its tail!!',
      'Your goal is waiting, and I brought backup enthusiasm!!',
      'Let us make future-you do a happy little spin!!',
      'Every small try counts!! I made a chart with paw prints!!',
      'Ready when you are!! I have been practicing my supportive face!!',
      'One promise, one paw forward!!',
      'Even five minutes is a fetch-worthy start!!',
      'Your plans and I have been patiently waiting by the door!!',
      'No perfect day needed!! Just one little win to celebrate!!',
      'Let us do the first bit together!! I packed extra encouragement!!'
    ],
    younger: [
      'we could start with one page... remember how nice it felt?',
      'i saved a little space for this plan... whenever we are ready.',
      'maybe today is the day we make the tiny promise real...',
      'we do not need the old version of us... just one small try.',
      'i think future us would be glad we began...',
      'we said we would make room for this... let us try five minutes.',
      'one small checkmark... it would mean something to us.',
      'i am still rooting for the things we wanted...',
      'we can begin again... no big speech required.',
      'i brought back that little plan... it still matters to me.'
    ],
    coworker: [
      'Friendly follow-up: {habit} remains open. Please share a start time. Thanks.',
      'Action item: open {habit}. Estimated first step: five minutes.',
      'Per the agenda, we are beginning {habit} with one manageable step.',
      'Your task queue contains {habit}. A brief update would be appreciated.',
      'Closing the loop on {habit}: please choose a time today.',
      'Deliverable {habit} is ready for a small first pass. Regards.',
      'Status check: the next step for {habit} can be very small.',
      'Calendar invite: five minutes for {habit}. Attendance is optional but recommended.',
      'Following up as promised: {habit} is still available for completion.',
      'Thank you in advance for scheduling the first step of {habit}.'
    ],
    mum: [
      '{name}, I MADE YOU A LITTLE PLAN: START {habit} FOR FIVE MINUTES. THEN HAVE A TEA.',
      '{name}, THIS DOES NOT NEED TO BE PERFECT. JUST START {habit} AND SHOW ME A LITTLE EFFORT!',
      '{name}, YOUR GOAL IS WAITING. PICK A TIME AND LET ME KNOW!',
      '{name}, I AM CHEERING FOR YOU, EVEN WHEN I SOUND LOUD ABOUT IT!',
      '{name}, FIVE MINUTES ON {habit}. THAT IS A PERFECTLY GOOD START!',
      '{name}, YOU CAN DO THIS IN SMALL BITS. NOW PICK THE FIRST BIT!',
      '{name}, I SAVED YOU A PLACE AT THE TABLE AFTER YOU START {habit}!',
      '{name}, WE ARE NOT CHASING PERFECT. WE ARE CHASING STARTED!',
      '{name}, PUT {habit} ON THE CALENDAR BEFORE YOUR COUSIN CLAIMS THE GOOD PEN!',
      '{name}, ONE SMALL PROMISE, THEN YOU CAN TELL ME ALL ABOUT IT!'
    ],
    sergeant: [
      'MISSION BRIEF: BEGIN {habit} FOR FIVE MINUTES. REPORT BACK WITH A CHECKMARK.',
      'RECRUIT, BREAK {habit} INTO ONE SMALL STEP AND EXECUTE.',
      'NO PERFECT CONDITIONS REQUIRED. START {habit} WHERE YOU ARE.',
      'YOUR NEXT OBJECTIVE IS SIMPLE: OPEN {habit} AND BEGIN.',
      'FIVE MINUTES OF ACTION. THAT IS THE WHOLE MISSION, RECRUIT.',
      'PLAN YOUR FIRST MOVE, SET YOUR TIMER, AND GET STARTED.',
      'PROGRESS BEGINS WITH ONE FOCUSED EFFORT, NOT PERFECTION.',
      'YOUR GOAL IS READY. TAKE THE FIRST STEP AND HOLD YOUR GROUND.',
      'CHECK YOUR PLAN, RECRUIT. PICK A TIME AND FOLLOW THROUGH.',
      'THE MISSION IS SMALL AND CLEAR: BEGIN {habit} NOW.'
    ]
  };

  const actionAdditions = {
    retriever: {
      done: ['You finished {habit}!! I am celebrating with my whole tail!!', 'That is {habit} checked off!! Please accept this imaginary trophy and a happy bark!!'],
      later: ['We moved {habit} to later!! Let us pick a time so I can save you a spot!!', 'A little pause is okay!! When will we try {habit}? I will be right here!!'],
      pending: ['Back to the list!! Your next chance to do {habit} is already here!!', 'Fresh start!! Let us give {habit} another tiny try together!!']
    },
    younger: {
      done: ['you did {habit}... i think we would have been proud of this.', 'that promise is kept... let us remember how this feels.'],
      later: ['we moved {habit} to later... let us choose a time we can keep.', 'it is still waiting... maybe we can make a little room for {habit} today.'],
      pending: ['the checkmark is gone... but we can still try {habit} again.', 'we are starting over... one small step on {habit} is enough for now.']
    },
    coworker: {
      done: ['Closing ticket: {habit} is complete. Thank you for the timely delivery.', 'Deliverable received: {habit}. This concludes the current follow-up cycle.'],
      later: ['Rescheduled: {habit} remains open. Please add a specific time to the calendar.', 'Noted. {habit} is deferred, not cancelled. A revised start time would be helpful.'],
      pending: ['Reopening the {habit} action item. Please select the next available time.', 'Status update: {habit} is back in progress. Thank you for your continued attention.']
    },
    mum: {
      done: ['{name}, {habit} IS DONE! THAT IS MY CHILD, GETTING THINGS SORTED!', '{name}, LOOK AT YOU FINISHING {habit}! I AM MAKING A NOTE OF THIS GOOD NEWS!'],
      later: ['{name}, LATER IS FINE IF YOU PICK A TIME FOR {habit}. PUT IT ON THE CALENDAR!', '{name}, {habit} CAN WAIT A LITTLE, BUT NOT FOREVER. WHEN ARE YOU STARTING?'],
      pending: ['{name}, WE ARE PUTTING {habit} BACK ON THE LIST. TAKE A BREATH AND TRY ONE BIT!', '{name}, THE CHECKMARK IS UNDONE, NOT YOUR CHANCE. LET US TRY {habit} AGAIN!']
    },
    sergeant: {
      done: ['OBJECTIVE {habit} COMPLETE! TAKE THE WIN, RECRUIT. YOU EARNED IT!', 'MISSION ACCOMPLISHED: {habit}. RESET, RECOVER, AND PREPARE FOR YOUR NEXT MOVE!'],
      later: ['DEFERMENT APPROVED. SET A RETURN TIME FOR {habit} AND REPORT BACK!', '{habit} IS RESCHEDULED, NOT ABANDONED. PICK THE NEXT TIME SLOT!'],
      pending: ['STATUS REVERSED. {habit} IS BACK ON THE BOARD. REGROUP AND REDEPLOY!', 'NO PROBLEM, RECRUIT. RESET THE PLAN FOR {habit} AND TAKE THE NEXT STEP!']
    }
  };

  const api = { additions, actionAdditions };
  if (typeof messages !== 'undefined') {
    for (const [tone, lines] of Object.entries(additions)) messages[tone].push(...lines);
  }
  if (typeof actionReplies !== 'undefined') {
    for (const [tone, statuses] of Object.entries(actionAdditions)) {
      for (const [status, lines] of Object.entries(statuses)) actionReplies[tone][status].push(...lines);
    }
  }
  root.CoachMessageAdditions = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
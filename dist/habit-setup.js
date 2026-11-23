/* Habit setup (feature 2 in the team doc): a library of ready-made habits grouped by category.
   Pure functions without any screen code, like core.js, so the Node tests can check them directly. */
(function (root) {
  // The same four categories, in the same order, as the Category list in the habit form (index.html).
  const CATEGORIES = ['Fitness', 'Productivity', 'Health', 'Personal development'];

  // Days use JavaScript's numbering, like the rest of the app: 0 = Sunday, 1 = Monday ... 6 = Saturday.
  const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
  const WEEKDAYS = [1, 2, 3, 4, 5];

  const LIBRARY = [
    { id: 'move', category: 'Fitness', name: 'Move your body', detail: 'Take a walk or do a workout', target: 20, unit: 'minutes', days: EVERY_DAY, time: '18:00' },
    { id: 'run', category: 'Fitness', name: 'Go for a run', detail: 'An easy run at a pace where you can still talk', target: 3, unit: 'km', days: [1, 3, 6], time: '07:30' },
    { id: 'stretch', category: 'Fitness', name: 'Stretch', detail: 'Ten calm minutes of stretching', target: 10, unit: 'minutes', days: EVERY_DAY, time: '21:30' },
    { id: 'strength', category: 'Fitness', name: 'Strength training', detail: 'A short session at the gym or at home', target: 1, unit: 'session', days: [2, 4], time: '17:00' },

    { id: 'focus', category: 'Productivity', name: 'Make focus time', detail: 'One task without distractions', target: 25, unit: 'minutes', days: WEEKDAYS, time: '09:00' },
    { id: 'plan', category: 'Productivity', name: 'Plan tomorrow', detail: "Write down tomorrow's three most important tasks", target: 3, unit: 'tasks', days: [0, 1, 2, 3, 4], time: '20:00' },
    { id: 'inbox', category: 'Productivity', name: 'Clear your inbox', detail: "Answer or archive today's emails", target: 1, unit: 'session', days: WEEKDAYS, time: '16:00' },
    { id: 'study', category: 'Productivity', name: 'Study session', detail: 'Revise one course with your phone in another room', target: 45, unit: 'minutes', days: WEEKDAYS, time: '14:00' },

    { id: 'wind', category: 'Health', name: 'Wind down', detail: 'Put the phone away before bed', target: 1, unit: 'session', days: EVERY_DAY, time: '22:30' },
    { id: 'water', category: 'Health', name: 'Drink water', detail: 'A glass with every meal and one in between', target: 8, unit: 'glasses', days: EVERY_DAY, time: '10:00' },
    { id: 'bedtime', category: 'Health', name: 'Go to bed on time', detail: 'Lights out early enough for eight hours of sleep', target: 1, unit: 'night', days: EVERY_DAY, time: '22:45' },
    { id: 'veg', category: 'Health', name: 'Eat your vegetables', detail: 'Vegetables with lunch and with dinner', target: 2, unit: 'portions', days: EVERY_DAY, time: '12:30' },

    { id: 'read', category: 'Personal development', name: 'Read a little', detail: 'Read before picking up your phone', target: 20, unit: 'pages', days: EVERY_DAY, time: '08:00' },
    { id: 'language', category: 'Personal development', name: 'Practise a language', detail: 'One short lesson in a language app', target: 10, unit: 'minutes', days: EVERY_DAY, time: '19:00' },
    { id: 'journal', category: 'Personal development', name: 'Keep a journal', detail: 'A few lines about your day', target: 3, unit: 'lines', days: EVERY_DAY, time: '22:00' },
    { id: 'learn', category: 'Personal development', name: 'Learn something new', detail: 'A podcast, a lecture or a documentary', target: 20, unit: 'minutes', days: [6, 0], time: '11:00' },
  ];

  // A fresh copy, so filling in and changing the form can never change the library itself.
  function copy(habit) {
    return { ...habit, days: [...habit.days] };
  }

  // The ready-made habits in one category. An unknown category gives an empty list.
  function forCategory(category) {
    return LIBRARY.filter(habit => habit.category === category).map(copy);
  }

  // One ready-made habit by its id, or null when there is none ("Create my own" has the empty id).
  function find(id) {
    const habit = LIBRARY.find(h => h.id === id);
    return habit ? copy(habit) : null;
  }

  const api = { CATEGORIES, LIBRARY, forCategory, find };
  root.HabitSetup = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* The account session is reused; private habit data stays in the account store. */
window.GuiltSocial = {
  init({client, cloud, openAccount}) {
    const $ = id => document.getElementById(id);
    const dialog = $('friends-dialog');
    const settings = $('friends-settings');
    const profileForm = $('friends-profile');
    const searchForm = $('friends-search');
    const status = $('friends-status');
    const controls = $('friends-controls');
    const nav = document.createElement('a');
    nav.href = '#friends-dialog';
    nav.className = 'friends-nav';
    nav.textContent = 'Friends';
    document.querySelector('header nav').append(nav);
    const challengeForm = $('friends-challenge');
    const tabs = [...dialog.querySelectorAll('[role="tab"]')];
    const reactions = [
      ['like', '♥', 'Like', 'liked'], ['cheer', '👏', 'Cheer', 'cheered'], ['fire', '🔥', 'Fire', 'sent fire for']
    ];
    let profile, connections = [], activity, competitions, challengeAlerts, week;
    let selectedFriend, found, visiblePosts = 10;

    function selectTab(tab, focus = false) {
      for (const candidate of tabs) {
        const selected = candidate === tab;
        candidate.setAttribute('aria-selected', selected);
        candidate.tabIndex = selected ? 0 : -1;
        $(candidate.getAttribute('aria-controls')).hidden = !selected;
      }
      if (focus) tab.focus();
    }

    tabs.forEach((tab, index) => {
      tab.onclick = () => selectTab(tab);
      tab.onkeydown = event => {
        const next = {
          ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length,
          Home: 0, End: tabs.length - 1
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        selectTab(tabs[next], true);
      };
    });

    async function rpc(name, args) {
      const {data, error} = await client.rpc(name, args);
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') {
          throw new Error('Friends is unavailable until the database update is installed.');
        }
        throw new Error(error.message || 'Friends could not connect. Try again.');
      }
      return data;
    }

    async function run(work, loading = 'Loading…') {
      if (controls.disabled) return;
      controls.disabled = true;
      status.textContent = loading;
      try {
        await work();
        status.textContent = '';
      } catch (error) {
        status.textContent = error.message || 'Something went wrong. Try again.';
      } finally {
        controls.disabled = false;
      }
    }

    function button(label, click) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'text-btn';
      el.textContent = label;
      el.onclick = click;
      return el;
    }

    function row(label, ...buttons) {
      const line = document.createElement('div');
      line.className = 'friends-row';
      const text = document.createElement('span');
      text.textContent = label;
      const actions = document.createElement('div');
      actions.className = 'friends-actions';
      actions.append(...buttons);
      line.append(text, actions);
      return line;
    }

    function card(title, detail, actions = []) {
      const item = document.createElement('article');
      item.className = 'friends-card';
      const heading = document.createElement('h4');
      heading.textContent = title;
      const description = document.createElement('p');
      description.textContent = detail;
      item.append(heading, description);
      if (actions.length) {
        const bar = document.createElement('div');
        bar.className = 'friends-actions';
        bar.append(...actions);
        item.append(bar);
      }
      return item;
    }

    function list(id, rows, empty) {
      $(id).replaceChildren(...rows);
      if (!rows.length) {
        const note = document.createElement('p');
        note.textContent = empty;
        $(id).append(note);
      }
    }

    function renderSettings() {
      settings.hidden = false;
      settings.open = !profile;
      profileForm.elements.handle.value = profile?.username || '';
      const goals = JSON.parse(cloud.value || '{}').goals || [];
      const shared = new Set(profile?.sharedHabits || []);
      const checkboxes = goals.filter(goal => !goal.archived).map(goal => {
        const label = document.createElement('label');
        label.className = 'check-label';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'habit';
        checkbox.value = goal.id;
        checkbox.checked = shared.has(goal.id);
        label.append(checkbox, ' ' + goal.name);
        return label;
      });
      list('friends-sharing', checkboxes, 'Add a habit before choosing what to share.');
    }

    function connectionButton(label, handle, action) {
      return button(label, () => run(async () => {
        await rpc('social_connect', {handle, action});
        await refresh();
      }, 'Saving…'));
    }

    function renderSearch() {
      if (found === undefined) {
        $('friends-search-result').replaceChildren();
        return;
      }
      const already = connections.some(person => person.username === found);
      list('friends-search-result', found ? [row('@' + found,
        ...(already ? [] : [connectionButton('Send request', found, 'send')]))] : [],
      'No match. Check the exact username.');
    }

    function copyHabit(habit) {
      dialog.close();
      $('add-habit').click();
      const form = $('goal-form');
      for (const field of ['name', 'category', 'detail', 'target', 'unit']) {
        if (habit[field] != null) form.elements[field].value = habit[field];
      }
      for (const checkbox of form.querySelectorAll('[name="days"]')) {
        if (Array.isArray(habit.days)) checkbox.checked = habit.days.includes(Number(checkbox.value));
      }
      form.elements.name.focus();
    }

    function renderFriend() {
      const friend = connections.find(person => person.username === selectedFriend && person.status === 'friend');
      $('friends-view').hidden = !friend;
      const title = $('friends-view-title');
      title.tabIndex = -1;
      title.textContent = friend ? '@' + friend.username + ' · shared habits' : '';
      const habits = friend ? activity.habits.filter(habit => habit.username === friend.username) : [];
      const wins = habits.reduce((total, habit) => total + habit.completed, 0);
      const streak = Math.max(0, ...habits.map(habit => habit.streak));
      const milestone = [100, 50, 25, 10, 5, 1].find(count => wins >= count);
      const rows = habits.map(habit => row(
        `${habit.name} · ${habit.completed} ${habit.completed === 1 ? 'completion' : 'completions'} · ${habit.streak} in a row`,
        button('Copy habit', () => copyHabit(habit))
      ));
      if (habits.length) rows.unshift(card('Shared progress', [
        `${wins} ${wins === 1 ? 'completion' : 'completions'}`,
        `Best current streak: ${streak}`,
        milestone ? `${milestone}-completion milestone` : 'No milestones yet'
      ].join(' · ')));
      list('friends-shared', rows, 'No habits shared yet.');
    }

    function renderNetwork() {
      const rows = [], pending = [];
      for (const {username, status: relationship} of connections) {
        const action = (label, verb) => connectionButton(label, username, verb);
        if (relationship === 'incoming') pending.push(row(`@${username} sent you a friend request`, action('Accept', 'accept'), action('Decline', 'decline')));
        if (relationship === 'outgoing') pending.push(row(`Friend request sent to @${username}`, action('Cancel request', 'cancel')));
        if (relationship === 'friend') rows.push(row('@' + username, button('View profile', () => {
          selectedFriend = username;
          renderFriend();
          $('friends-view-title').focus();
        }), action('Remove friend', 'remove')));
      }
      list('friends-connections', rows, 'Search for a username to add your first friend.');
      list('friends-requests', pending, 'No friend requests.');
      renderSearch();
      renderFriend();
    }

    function reactionButtons(current, name, args) {
      return reactions.map(([value, icon, label]) => {
        const control = button(`${icon} ${label}`, () => run(async () => {
          await rpc(name, {...args, choice: current === value ? null : value});
          await refresh();
        }, 'Saving reaction…'));
        control.classList.add('friends-reaction');
        control.setAttribute('aria-pressed', current === value);
        return control;
      });
    }

    function scoreLine(c) {
      if (!c.scores) return '';
      return `@${c.challenger} ${c.scores[0]} · @${c.opponent} ${c.scores[1]}`;
    }

    function resultLine(c) {
      const [a, b] = c.scores;
      return (a === b ? 'Tie' : `@${a > b ? c.challenger : c.opponent} won`) + ' · ' + scoreLine(c);
    }

    function metric(c) {
      return c.metric === 'days' ? 'active days' : 'habit completions';
    }

    function renderFeed() {
      const posts = activity.feed.map(event => ({
        day: event.day,
        build: () => card(`@${event.username} completed ${event.name}`, event.day, reactionButtons(
          event.reaction, 'social_react', {handle: event.username, habit: event.id, completed_on: event.day}
        ))
      }));
      for (const c of competitions) {
        if (!['accepted', 'finished'].includes(c.status)) continue;
        posts.push({
          day: c.accepted_at.slice(0, 10),
          build: () => card(`@${c.challenger} challenged @${c.opponent}`, `${c.title} · ${c.duration} days · ${metric(c)}`,
            reactionButtons(c.start_reaction, 'social_react_challenge', {challenge: c.id, moment: 'started'}))
        });
        if (c.status === 'finished') posts.push({
          day: c.ends_on,
          build: () => card(`${c.title} · Results`, resultLine(c),
            reactionButtons(c.result_reaction, 'social_react_challenge', {challenge: c.id, moment: 'result'}))
        });
      }
      posts.sort((a, b) => b.day.localeCompare(a.day));
      list('friends-feed', posts.slice(0, visiblePosts).map(post => post.build()), 'Shared completions and challenge updates will appear here.');
      $('friends-load-more').hidden = posts.length <= visiblePosts;
      let rank = 0, previous;
      list('friends-rankings', week.rankings.filter(person => person.score > 0).map((person, index) => {
        if (previous !== person.score) rank = index + 1;
        previous = person.score;
        return row(`#${rank} · @${person.username} · ${person.score} of 7 days`);
      }), 'No shared completions this week.');
    }

    function answer(c, action, share = false) {
      run(async () => {
        await rpc('social_answer_challenge', {challenge: c.id, action, share});
        await refresh();
      }, 'Updating challenge…');
    }

    function renderCompetitions() {
      const friends = connections.filter(person => person.status === 'friend');
      const picker = $('friends-challenge-person');
      const previousFriend = picker.value;
      picker.replaceChildren(...friends.map(person => new Option('@' + person.username, person.username)));
      if (friends.some(person => person.username === previousFriend)) picker.value = previousFriend;
      $('friends-new-challenge').hidden = !friends.length;
      const mine = competitions.filter(c => c.mine);
      const invites = mine.filter(c => c.status === 'pending');
      list('friends-invites', invites.map(c => {
        if (!c.incoming) return card(c.title, `Waiting for @${c.opponent} · ${c.duration} days · ${metric(c)}`,
          [button('Cancel invite', () => answer(c, 'cancel'))]);
        const actions = [button('Accept privately', () => answer(c, 'accept')), button('Decline', () => answer(c, 'decline'))];
        if (c.offered_sharing) actions.splice(1, 0, button('Accept and share', () => answer(c, 'accept', true)));
        return card(`@${c.challenger} invited you to ${c.title}`,
          `${c.duration} days · Score by ${metric(c)}. Accepting shares your total from all habit completions in the date range.` +
          (c.offered_sharing ? ' You can also share the start and final result with mutual friends.' : ''), actions);
      }), 'No challenge requests.');
      list('friends-current', mine.filter(c => c.status === 'accepted').map(c =>
        card(c.title, `${scoreLine(c)} · ${metric(c)} · Through ${c.ends_on}`,
          c.shared ? [button('Hide from mutual friends', () => answer(c, 'hide'))] : [])), 'No competitions underway.');
      list('friends-results', mine.filter(c => c.status === 'finished').map(c =>
        card(c.title, resultLine(c), c.shared ? [button('Hide from mutual friends', () => answer(c, 'hide'))] : [])), 'No completed competitions yet.');
      const incoming = invites.filter(c => c.incoming).length + connections.filter(person => person.status === 'incoming').length;
      $('friends-inbox-count').textContent = String(incoming);
      $('friends-inbox-count').hidden = !incoming;
    }

    function togetherStreak(days) {
      const sharedDays = new Set(days);
      const date = new Date(week.today + 'T00:00:00Z');
      const previousDay = () => date.setUTCDate(date.getUTCDate() - 1);
      const key = () => date.toISOString().slice(0, 10);
      if (!sharedDays.has(key())) previousDay();
      let count = 0;
      while (sharedDays.has(key())) {
        count++;
        previousDay();
      }
      return count;
    }

    function renderAlerts() {
      const verb = choice => reactions.find(([value]) => value === choice)?.[3] || 'reacted to';
      const notes = [
        ...activity.received.map(event => ({at: event.reacted_at, text:
          `@${event.username} ${verb(event.reaction)} your completion of ${event.name}`})),
        ...challengeAlerts.map(event => ({at: event.reacted_at, text:
          `@${event.username} ${verb(event.reaction)} ${event.title}`})),
        ...competitions.filter(c => c.mine && c.status === 'finished').map(c => ({
          at: c.ends_on, text: `${c.title} finished · ${resultLine(c)}`
        })),
        ...competitions.filter(c => c.mine && !c.incoming && c.status === 'declined').map(c => ({
          at: c.invited_at, text: `@${c.opponent} declined ${c.title}`
        }))
      ].sort((a, b) => b.at.localeCompare(a.at));
      const streaks = week.rankings.map(person => ({...person, streak: togetherStreak(person.together)}))
        .filter(person => person.streak >= 2).map(person =>
          row(`You and @${person.username} both completed a shared habit ${person.streak} days in a row.`));
      list('friends-cheers', [...streaks, ...notes.map(note => row(note.text))], 'Reactions, finished challenges and shared streaks will appear here.');
    }

    async function refresh({showSettings = false} = {}) {
      ({profile, connections} = await rpc('social_network'));
      if (showSettings) renderSettings();
      if (!profile) {
        $('friends-member').hidden = true;
        return;
      }
      [activity, competitions, challengeAlerts, week] = await Promise.all([
        rpc('social_activity'), rpc('social_competitions'), rpc('social_challenge_alerts'), rpc('social_week')
      ]);
      renderNetwork();
      renderCompetitions();
      renderFeed();
      renderAlerts();
      $('friends-member').hidden = false;
    }

    nav.onclick = event => {
      event.preventDefault();
      if (dialog.open) return;
      if (controls.disabled) {
        dialog.showModal();
        return;
      }
      status.textContent = '';
      $('friends-refresh').hidden = !cloud;
      $('friends-guest').hidden = !!cloud;
      settings.hidden = true;
      $('friends-member').hidden = true;
      selectedFriend = found = undefined;
      visiblePosts = 10;
      selectTab(tabs[0]);
      searchForm.reset();
      dialog.showModal();
      if (cloud) run(() => refresh({showSettings: true}));
    };
    $('friends-close').onclick = () => dialog.close();
    $('friends-refresh').onclick = () => run(() => refresh({showSettings: true}));
    $('friends-load-more').onclick = () => {
      visiblePosts += 10;
      renderFeed();
    };
    $('friends-sign-in').onclick = openAccount;
    profileForm.onsubmit = event => {
      event.preventDefault();
      const fields = new FormData(profileForm);
      run(async () => {
        const before = new Set(profile?.sharedHabits || []);
        const habitIds = fields.getAll('habit');
        // Removing access must still work when local habit edits have failed to sync.
        if (habitIds.some(id => !before.has(id))) await cloud.flush();
        await rpc('social_save_profile', {handle: fields.get('handle'), habit_ids: habitIds});
        await refresh({showSettings: true});
      }, 'Saving…');
    };
    searchForm.onsubmit = event => {
      event.preventDefault();
      const handle = searchForm.elements.handle.value.trim().toLowerCase();
      run(async () => {
        found = await rpc('social_find', {handle});
        renderSearch();
      }, 'Searching…');
    };
    challengeForm.onsubmit = event => {
      event.preventDefault();
      const fields = new FormData(challengeForm);
      run(async () => {
        await cloud.flush();
        await rpc('social_invite_challenge', {handle: fields.get('friend'), label: fields.get('title'),
          scoring: fields.get('metric'), days: Number(fields.get('duration')), share: fields.has('share')});
        challengeForm.reset();
        $('friends-new-challenge').open = false;
        await refresh();
        selectTab($('friends-tab-alerts'), true);
      }, 'Sending challenge…');
    };
  }
};

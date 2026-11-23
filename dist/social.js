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
    const editForm = $('friends-edit-activity');
    const tabs = [...dialog.querySelectorAll('[role="tab"]')];
    const reactions = [
      ['like', '♥', 'Like', 'liked'], ['cheer', '👏', 'Cheer', 'cheered'], ['fire', '🔥', 'Fire', 'sent fire for']
    ];
    const encouragements = [['keep_it_up', 'Keep it up!'], ['great_work', 'Great work!']];
    const language = document.documentElement.lang || 'en';
    const relativeTime = new Intl.RelativeTimeFormat(language, {numeric: 'always'});
    const formatDay = new Intl.DateTimeFormat(language, {month: 'short', day: 'numeric', timeZone: 'UTC'});
    const formatScore = new Intl.NumberFormat(language, {maximumFractionDigits: 2});
    let profile, connections = [], activity, competitions, challengeAlerts, activityChanges, week;
    let managing = null;
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
      if (!detail) description.hidden = true;
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
      const rows = [];
      for (const {username, status: relationship} of connections) {
        const action = (label, verb) => connectionButton(label, username, verb);
        if (relationship === 'outgoing') rows.push(row(`Request sent to @${username}`, action('Cancel request', 'cancel')));
        if (relationship === 'friend') rows.push(row('@' + username, button('View profile', () => {
          selectedFriend = username;
          renderFriend();
          $('friends-view-title').focus();
        }), action('Remove friend', 'remove')));
      }
      list('friends-connections', rows, 'Search for a username to add your first friend.');
      renderSearch();
      renderFriend();
    }

    function reactionButtons(reaction, note, name, args) {
      function reactionButton(value, label, current, channel) {
        const control = button(label, () => run(async () => {
          await rpc(name, {...args, choice: current === value ? null : value, channel});
          await refresh();
        }, 'Sending…'));
        control.classList.add('friends-reaction');
        control.setAttribute('aria-pressed', current === value);
        return control;
      }
      return [
        ...reactions.map(([value, icon, label]) => reactionButton(value, `${icon} ${label}`, reaction, 'reaction')),
        ...encouragements.map(([value, label]) => reactionButton(value, label, note, 'note'))
      ];
    }

    function scoreLine(c) {
      if (!c.scores) return '';
      const score = amount => formatScore.format(amount) + (c.unit ? ' ' + c.unit : '');
      return `@${c.challenger} ${score(c.scores[0])} · @${c.opponent} ${score(c.scores[1])}`;
    }

    function targetLabel(c) {
      return `${formatScore.format(c.goal_target)} ${c.unit}`;
    }

    function totalScore(c) {
      return Number(c.scores[0]) + Number(c.scores[1]);
    }

    function goalProgress(c) {
      return `${formatScore.format(totalScore(c))} of ${targetLabel(c)} together · ${scoreLine(c)}`;
    }

    function goalCard(c, actions) {
      const item = card(c.title, `${goalProgress(c)} · Through ${dayLabel(c.ends_on)}`, actions);
      const progress = document.createElement('progress');
      progress.max = Number(c.goal_target);
      progress.value = Math.min(progress.max, totalScore(c));
      progress.setAttribute('aria-label', `Combined progress for ${c.title} in ${c.unit}`);
      item.insertBefore(progress, item.querySelector('.friends-actions'));
      return item;
    }

    function resultLine(c) {
      if (c.goal_target) return `${c.goal_reached_at ? 'Goal reached!' : 'Time ran out'} · ${goalProgress(c)}`;
      const [a, b] = c.scores;
      return (a === b ? 'Tie' : `@${a > b ? c.challenger : c.opponent} won`) + ' · ' + scoreLine(c);
    }

    function metric(c) {
      if (c.metric === 'amount') return `total ${c.unit} from one habit`;
      return c.metric === 'days' ? 'active days' : 'habit completions';
    }

    function dayLabel(day) {
      const date = new Date(day + 'T00:00:00Z');
      return Number.isNaN(date.getTime()) ? day : formatDay.format(date);
    }

    function challengeDates(c) {
      const aim = c.goal_target ? `Goal: ${targetLabel(c)} together` : `Score by ${metric(c)}`;
      return `${dayLabel(c.starts_on)}–${dayLabel(c.ends_on)} · ${c.duration} days · ${aim}`;
    }

    function resultAt(c) {
      return c.goal_reached_at || new Date(Date.parse(c.ends_on + 'T00:00:00Z') + 86400000).toISOString();
    }

    function completionDetail(event) {
      const facts = [dayLabel(event.day)];
      if (event.category) facts.push(event.category);
      if (event.target && event.unit) facts.push(`Goal: ${event.target} ${event.unit}`);
      if (event.streak > 1) {
        const calendarDays = (Date.parse(event.day) - Date.parse(event.streakStart)) / 86400000 + 1;
        facts.push(calendarDays === event.streak ? `🔥 ${event.streak}-day streak`
          : `🔥 ${event.streak} scheduled check-ins in a row`);
      }
      if (event.wins === 1) facts.push('First win! The coach can take a day off.');
      else if ([5, 10, 25, 50, 100].includes(event.wins)) facts.push(`🏅 ${event.wins}-completion milestone`);
      else facts.push(`${event.wins} completions for this habit`);
      return facts.join(' · ');
    }

    function renderFeed() {
      const posts = activity.feed.map(event => ({
        at: Date.parse(event.day),
        build: () => card(`@${event.username} completed ${event.name}`, completionDetail(event), reactionButtons(
          event.reaction, event.note, 'social_react', {handle: event.username, habit: event.id, completed_on: event.day}
        ))
      }));
      for (const c of competitions) {
        if (c.archived || !['accepted', 'finished'].includes(c.status)) continue;
        const sharedGoal = Boolean(c.goal_target);
        posts.push({
          at: Date.parse(c.accepted_at),
          build: () => card(`${sharedGoal ? '🤝' : '🏆'} ${c.title} · ${sharedGoal ? 'Shared goal started' : 'Challenge started'}`,
            (sharedGoal ? `@${c.challenger} teamed up with @${c.opponent}. ` :
              `@${c.challenger} challenged @${c.opponent}. `) + challengeDates(c) +
            (c.mine && c.status === 'accepted' ? ` · ${sharedGoal ? goalProgress(c) : 'Live score: ' + scoreLine(c)}` : ''),
            reactionButtons(c.start_reaction, c.start_note, 'social_react_challenge', {challenge: c.id, moment: 'started'}))
        });
        if (c.status === 'finished') posts.push({
          at: Date.parse(resultAt(c)),
          build: () => card(`${c.goal_reached_at ? '🎉' : '🏁'} ${c.title} · ${c.goal_reached_at ? 'Goal reached' : 'Results'}`,
            `${resultLine(c)} · ${challengeDates(c)}`,
            reactionButtons(c.result_reaction, c.result_note, 'social_react_challenge', {challenge: c.id, moment: 'result'}))
        });
      }
      posts.sort((a, b) => b.at - a.at);
      list('friends-feed', posts.slice(0, visiblePosts).map(post => post.build()), 'Shared completions and challenge updates will appear here.');
      $('friends-load-more').hidden = posts.length <= visiblePosts;
      let rank = 0, previous;
      list('friends-rankings', week.rankings.filter(person => person.score > 0).map((person, index) => {
        if (previous !== person.score) rank = index + 1;
        previous = person.score;
        return row(`#${rank} · @${person.username} · ${person.score} of 7 days`);
      }), 'No shared completions this week.');
    }

    function answer(c, action, share = false, habitName = null) {
      run(async () => {
        const habit = habitName === null ? null : window.GuiltHabits.ensureJointHabit(habitName, c.unit);
        if (habit) await cloud.flush();
        await rpc('social_answer_challenge', {challenge: c.id, action, share, habit, expected: c.edit_version});
        closeManage();
        await refresh({showSettings: !!habit});
      }, 'Updating challenge…');
    }

    function closeManage() {
      managing = null;
      $('friends-activity-editor').hidden = true;
      $('friends-activity-stop').hidden = true;
    }

    function editActivity(c) {
      closeManage();
      managing = c;
      const {name, duration, target, unit} = editForm.elements;
      name.value = c.title;
      duration.value = c.duration;
      target.value = c.goal_target ?? '';
      unit.value = c.unit ?? '';
      target.required = !!c.goal_target;
      $('friends-edit-target').hidden = target.disabled = !c.goal_target;
      $('friends-edit-unit').hidden = unit.disabled = c.status !== 'pending' || c.metric !== 'amount';
      unit.required = !unit.disabled;
      $('friends-edit-activity-help').textContent = c.status === 'pending'
        ? 'Your friend will be notified. For measured invites, changing the unit links or adds a tracker with that unit.'
        : 'Your friend will be notified. To change the scoring unit after starting, stop this activity and send a new invite.';
      $('friends-activity-editor').hidden = false;
      name.focus();
    }

    function askToStop(c) {
      closeManage();
      managing = c;
      const title = $('friends-activity-stop-title');
      title.textContent = `Stop “${c.title}”?`;
      $('friends-activity-stop').hidden = false;
      title.focus();
    }

    function startAgain(c) {
      const {mode, friend, title, metric, duration, target, unit, share} = challengeForm.elements;
      mode.value = c.goal_target ? 'together' : 'compete';
      friend.value = c.incoming ? c.challenger : c.opponent;
      title.value = c.title;
      metric.value = c.metric;
      duration.value = c.duration;
      target.value = c.goal_target ?? '';
      unit.value = c.unit ?? '';
      share.checked = false;
      renderMeasureField();
      $('friends-new-challenge').open = true;
      title.focus();
    }

    function manageTodayHabits() {
      dialog.close();
      $('edit').click();
    }

    function ownHabits() {
      return (JSON.parse(cloud.value || '{}').goals || []).filter(goal => !goal.archived);
    }

    function suggestHabits(list, habits) {
      list.replaceChildren(...habits.map(goal => new Option(goal.name)));
    }

    function jointUnit(name, value) {
      if (value.trim()) return value;
      const label = HabitCore.habitName(name).toLowerCase();
      const matches = ownHabits().filter(goal => HabitCore.habitName(goal.name).toLowerCase() === label);
      const units = [...new Set(matches.map(goal => HabitCore.measurementUnit(goal.unit)))];
      if (units.length > 1) throw new Error('You have matching habits with different units. Enter the unit you want to use.');
      return units[0] || 'times';
    }

    function renderMeasureField() {
      const together = challengeForm.elements.mode.value === 'together';
      const metricPicker = challengeForm.elements.metric;
      const measured = together || metricPicker.value === 'amount';
      const activityName = challengeForm.elements.title;
      const unit = challengeForm.elements.unit;
      const target = challengeForm.elements.target;
      $('friends-challenge-metric-label').hidden = together;
      metricPicker.disabled = together;
      $('friends-activity-name-label').textContent = measured ? 'Habit or activity' : 'Competition name';
      activityName.placeholder = measured ? 'e.g. Swim laps' : 'e.g. One good week';
      if (measured) activityName.setAttribute('list', 'friends-joint-habits');
      else activityName.removeAttribute('list');
      $('friends-challenge-unit-label').hidden = !measured;
      unit.disabled = !measured;
      $('friends-goal-target-label').hidden = !together;
      target.disabled = !together;
      target.required = together;
      $('friends-challenge-submit').textContent = together ? 'Invite to shared goal' : 'Send challenge';
      suggestHabits($('friends-joint-habits'), ownHabits());
      $('friends-challenge-score-help').textContent = measured
        ? 'Type an activity. We’ll link a matching habit or add it to Today. Use just the unit (like hours), and enter the amount separately. Leave the unit blank to use the matching habit’s unit or count how many times you do it.'
        : 'Your opponent sees your score from all habit completions in the date range. Only habits you already share reveal details.';
    }

    function renderCompetitions() {
      const friends = connections.filter(person => person.status === 'friend');
      const picker = $('friends-challenge-person');
      const previousFriend = picker.value;
      picker.replaceChildren(...friends.map(person => new Option('@' + person.username, person.username)));
      if (friends.some(person => person.username === previousFriend)) picker.value = previousFriend;
      $('friends-new-challenge').hidden = !friends.length;
      renderMeasureField();
      const mine = competitions.filter(c => c.mine);
      const invites = mine.filter(c => c.status === 'pending');
      const hideActions = c => c.shared ? [button('Hide from mutual friends', () => answer(c, 'hide'))] : [];
      const activeActions = c => [button('Edit', () => editActivity(c)), button('Stop', () => askToStop(c)), ...hideActions(c)];
      const active = mine.filter(c => c.status === 'accepted');
      const outgoing = invites.filter(c => !c.incoming);
      const waiting = c => card(c.title, `Waiting for @${c.opponent} · ${c.duration} days · ` +
        (c.goal_target ? `Goal: ${targetLabel(c)} together` : `Score by ${metric(c)}`),
      [button('Edit', () => editActivity(c)), button('Cancel invite', () => answer(c, 'cancel'))]);
      list('friends-shared-goals', [
        ...active.filter(c => c.goal_target).map(c => goalCard(c, activeActions(c))),
        ...outgoing.filter(c => c.goal_target).map(waiting)
      ], 'No shared goals underway.');
      list('friends-current', [
        ...active.filter(c => !c.goal_target).map(c => card(c.title, `${scoreLine(c)} · ${challengeDates(c)}`, activeActions(c))),
        ...outgoing.filter(c => !c.goal_target).map(waiting)
      ], 'No competitions underway.');
      const results = mine.filter(c => ['finished','stopped'].includes(c.status));
      const hidden = results.filter(c => c.archived);
      list('friends-results', results.filter(c => !c.archived).map(c => {
        const stopped = c.status === 'stopped';
        const actions = stopped ? [button('Start again', () => startAgain(c))] : hideActions(c);
        if (c.metric === 'amount') actions.push(button('Manage Today habits', manageTodayHabits));
        actions.push(button('Remove from my list', () => answer(c, 'hide_result')));
        return card(c.title, stopped ? 'Stopped early. Your Today habits are still separate and can be archived.' : resultLine(c), actions);
      }), 'No results yet.');
      $('friends-hidden-results').hidden = !hidden.length;
      list('friends-archived-activities', hidden.map(c => card(c.title, 'Hidden from your list. Your friend still has their copy.',
        [button('Restore to my list', () => answer(c, 'restore_result'))])), 'No removed activities.');
      const incoming = invites.filter(c => c.incoming).length + connections.filter(person => person.status === 'incoming').length;
      $('friends-inbox-count').textContent = String(incoming);
      $('friends-inbox-count').hidden = !incoming;
    }

    function inviteCard(c) {
      const measured = c.metric === 'amount';
      const input = document.createElement('input');
      const accept = (label, share) => button(label, () => answer(c, 'accept', share, measured ? input.value : null));
      const accepts = [accept('Accept privately', false)];
      if (c.offered_sharing) accepts.push(accept('Accept and share', true));
      const item = card(`@${c.challenger} invited you to ${c.title}`,
        `${c.duration} days · ` + (c.goal_target
          ? `Shared goal: ${targetLabel(c)} together. Your teammate sees your logged total for the habit you choose.`
          : `Score by ${metric(c)}. ` + (measured
          ? 'Your opponent sees the logged total for the habit you choose.'
          : 'Your opponent sees your total score from all habit completions.')) +
        (c.offered_sharing ? ' You can also share the start and final result with mutual friends.' : ''),
        [...accepts, button('Decline', () => answer(c, 'decline'))]);
      if (measured) {
        const label = document.createElement('label');
        const habits = ownHabits().filter(goal => HabitCore.measurementUnit(goal.unit) === c.unit);
        const suggestions = document.createElement('datalist');
        suggestions.id = 'joint-habits-' + c.id;
        suggestHabits(suggestions, habits);
        label.textContent = `Habit or activity (${c.unit})`;
        input.type = 'text';
        input.maxLength = 60;
        input.value = c.title;
        input.setAttribute('list', suggestions.id);
        const updateAccept = () => accepts.forEach(control => { control.disabled = !input.value.trim(); });
        input.oninput = updateAccept;
        updateAccept();
        label.append(input, suggestions);
        item.insertBefore(label, item.querySelector('.friends-actions'));
        const hint = document.createElement('p');
        hint.textContent = 'A matching habit will be linked. A new one will be added to Today when you accept.';
        label.after(hint);
      }
      return item;
    }

    function updateRelativeTimes() {
      for (const time of dialog.querySelectorAll('time[data-notification-time]')) {
        const elapsed = Math.max(0, (Date.now() - Date.parse(time.dateTime)) / 1000);
        const [seconds, unit] = elapsed < 3600 ? [60, 'minute'] : elapsed < 86400 ? [3600, 'hour'] : [86400, 'day'];
        time.textContent = elapsed < 60 ? 'Just now' : relativeTime.format(-Math.floor(elapsed / seconds), unit);
      }
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
      const notifications = [];
      const add = (at, item) => notifications.push({at, item});
      const note = (at, title, detail = '') => add(at, card(title, detail));
      for (const event of activityChanges) {
        const {name, duration, target, unit, tracker} = event.details;
        const comparison = (label, values) => values ? `${label}: ${values[0]} → ${values[1]}` : null;
        const detail = [
          comparison('Name', name), comparison('Days', duration), comparison('Target', target),
          comparison('Unit', unit), tracker ? 'Linked habit changed' : null
        ].filter(Boolean).join(' · ');
        const message = {
          edited: `edited ${event.title}`, stopped: `stopped ${event.title}`,
          cancelled: `cancelled the invite to ${event.title}`, hid: `hid ${event.title} from mutual friends`
        }[event.action];
        note(event.changed_at, `@${event.username} ${message}`, detail);
      }
      for (const {username, status: relationship, at, requestedByMe} of connections) {
        if (relationship === 'incoming') add(at, card(`@${username} sent you a friend request`, '', [
          connectionButton('Accept', username, 'accept'), connectionButton('Decline', username, 'decline')
        ]));
        if (relationship === 'friend' && requestedByMe) note(at, `@${username} accepted your friend request`);
      }
      for (const c of competitions.filter(challenge => challenge.mine)) {
        if (c.status === 'pending' && c.incoming) add(c.invited_at, inviteCard(c));
        if (c.status === 'finished') note(resultAt(c), `${c.title} · ${c.goal_reached_at ? 'Goal reached together!' : 'Finished'}`, resultLine(c));
        if (c.status === 'declined' && !c.incoming) note(c.responded_at, `@${c.opponent} declined ${c.title}`);
        if (c.accepted_at && !c.incoming) note(c.accepted_at, `@${c.opponent} accepted ${c.title}`);
      }
      const incoming = [
        ...activity.received.map(event => ({...event, subject: `your completion of ${event.name}`})),
        ...challengeAlerts.map(event => ({...event, subject: event.title}))
      ];
      for (const event of incoming) {
        const message = encouragements.find(([value]) => value === event.reaction)?.[1];
        if (message) note(event.reacted_at, `@${event.username} said “${message}”`, `On ${event.subject}`);
        else note(event.reacted_at, `@${event.username} ${verb(event.reaction)} ${event.subject}`);
      }
      for (const person of week.rankings) {
        const streak = togetherStreak(person.together);
        if (streak >= 2) note(person.together[0] + 'T00:00:00Z',
          `You and @${person.username} hit a ${streak}-day streak together`,
          `Both completed a shared habit each day through ${dayLabel(person.together[0])}.`);
      }
      const rows = notifications.filter(entry => Number.isFinite(Date.parse(entry.at)))
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map(({at, item}) => {
          const time = document.createElement('time');
          time.dateTime = new Date(at).toISOString();
          time.dataset.notificationTime = '';
          time.title = new Date(at).toLocaleString(language);
          item.prepend(time);
          return item;
        });
      list('friends-notifications', rows, 'Requests, reactions, and shared milestones will appear here.');
      updateRelativeTimes();
    }

    async function refresh({showSettings = false} = {}) {
      ({profile, connections} = await rpc('social_network'));
      if (showSettings) renderSettings();
      if (!profile) {
        $('friends-member').hidden = true;
        return;
      }
      [activity, competitions, challengeAlerts, activityChanges, week] = await Promise.all([
        rpc('social_activity'), rpc('social_competitions'), rpc('social_challenge_alerts'),
        rpc('social_activity_changes'), rpc('social_week')
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
      closeManage();
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
    setInterval(() => {
      if (dialog.open && !$('friends-panel-alerts').hidden) updateRelativeTimes();
    }, 30000);
    $('friends-refresh').onclick = () => run(async () => {
      closeManage();
      await refresh({showSettings: true});
    });
    $('friends-cancel-edit').onclick = $('friends-cancel-stop').onclick = closeManage;
    $('friends-confirm-stop').onclick = () => {
      if (managing) answer(managing, 'stop');
    };
    editForm.onsubmit = event => {
      event.preventDefault();
      if (!managing) return;
      const current = managing;
      const fields = new FormData(editForm);
      run(async () => {
        const label = HabitCore.habitName(fields.get('name'));
        if (label.length < 3) throw new Error('Enter at least 3 characters for the activity name.');
        const unit = fields.get('unit');
        let replacementHabit = null;
        if (unit !== null && HabitCore.measurementUnit(unit) !== current.unit) {
          replacementHabit = window.GuiltHabits.ensureJointHabit(label, unit);
          await cloud.flush();
        }
        await rpc('social_edit_challenge', {
          challenge: current.id, expected: current.edit_version, label, days: Number(fields.get('duration')),
          target: current.goal_target ? Number(fields.get('target')) : null, replacement_habit: replacementHabit
        });
        closeManage();
        await refresh({showSettings: !!replacementHabit});
      }, 'Saving activity changes…');
    };
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
    challengeForm.elements.mode.onchange = challengeForm.elements.metric.onchange = renderMeasureField;
    challengeForm.onsubmit = event => {
      event.preventDefault();
      const fields = new FormData(challengeForm);
      const together = fields.get('mode') === 'together';
      run(async () => {
        const title = HabitCore.habitName(fields.get('title'));
        if (title.length < 3) throw new Error('Enter at least 3 characters for the activity name.');
        const scoring = together ? 'amount' : fields.get('metric');
        const habit = scoring === 'amount'
          ? window.GuiltHabits.ensureJointHabit(title, jointUnit(title, fields.get('unit') || '')) : null;
        await cloud.flush();
        await rpc('social_invite_challenge', {handle: fields.get('friend'), label: title,
          scoring, days: Number(fields.get('duration')), share: fields.has('share'),
          habit, target: together ? Number(fields.get('target')) : null});
        challengeForm.reset();
        $('friends-new-challenge').open = false;
        await refresh({showSettings: !!habit});
      }, together ? 'Sending shared goal invite…' : 'Sending challenge…');
    };
  }
};

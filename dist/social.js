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
    let profile, connections = [], activity, selectedFriend, found;

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
      const milestone = [100, 50, 25, 10, 5, 1].find(count => wins >= count);
      const rows = habits.map(habit => row(
        `${habit.name} · ${habit.completed} ${habit.completed === 1 ? 'completion' : 'completions'} · ${habit.streak} in a row`,
        button('Copy habit', () => copyHabit(habit))
      ));
      if (milestone) rows.unshift(row(`Milestone unlocked · ${milestone} shared habit ${milestone === 1 ? 'completion' : 'completions'}`));
      list('friends-shared', rows, 'No habits shared yet.');
    }

    function renderNetwork() {
      const rows = connections.map(({username, status: relationship}) => {
        const action = (label, verb) => connectionButton(label, username, verb);
        if (relationship === 'incoming') return row(`@${username} · request received`, action('Accept', 'accept'), action('Decline', 'decline'));
        if (relationship === 'outgoing') return row(`@${username} · request sent`, action('Cancel request', 'cancel'));
        return row('@' + username, button('View profile', () => {
          selectedFriend = username;
          renderFriend();
          $('friends-view-title').focus();
        }), action('Remove friend', 'remove'));
      });
      list('friends-connections', rows, 'No friends or requests yet.');
      renderSearch();
      renderFriend();
      list('friends-feed', activity.feed.map(event => {
        const cheer = button(event.cheered ? 'Cheered' : '👏 Cheer', () => run(async () => {
          await rpc('social_cheer', {
            handle: event.username, habit: event.id, completed_on: event.day, enabled: !event.cheered
          });
          await refresh();
        }, 'Saving…'));
        cheer.setAttribute('aria-pressed', event.cheered);
        return row(`@${event.username} completed ${event.name} · ${event.day}`, cheer);
      }), 'Shared completions from your friends will appear here.');
      list('friends-cheers', activity.received.map(event =>
        row(`@${event.username} cheered your completion of ${event.name} · ${event.day}`)), 'No cheers yet.');
    }

    async function refresh({showSettings = false} = {}) {
      ({profile, connections} = await rpc('social_network'));
      if (showSettings) renderSettings();
      if (!profile) {
        $('friends-member').hidden = true;
        return;
      }
      activity = await rpc('social_activity');
      renderNetwork();
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
      $('friends-guest').hidden = !!cloud;
      settings.hidden = true;
      $('friends-member').hidden = true;
      selectedFriend = found = undefined;
      searchForm.reset();
      dialog.showModal();
      if (cloud) run(() => refresh({showSettings: true}));
    };
    $('friends-close').onclick = () => dialog.close();
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
  }
};

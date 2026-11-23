/* Supabase Auth owns credentials. This file never stores passwords. */
(async function () {
  const $ = selector => document.querySelector(selector);
  const config = window.GuiltTripConfig;
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'guilt-trip-auth'}
  });
  const dialog = $('#account-dialog');
  const form = $('#account-form');
  const message = $('#account-message');
  let mode = 'login', user = null, cloud = null, activeId, recovering = false, leaving = false;
  let loading = true;
  const recoveryKey = 'guilt-trip-recovering';
  try { recovering = sessionStorage.getItem(recoveryKey) === 'yes'; } catch {}
  const redirectTo = location.origin + location.pathname;
  $('[data-account-mode=reset]').hidden = !config.emailDeliveryEnabled;
  $('#account-prototype-note').hidden = !!config.emailDeliveryEnabled;
  const setMessage = text => { message.textContent = text; };
  function authError(error) {
    const code = error.code || '';
    if (code === 'email_address_not_authorized' || /not authorized|sending confirmation email/i.test(error.message || '')) return 'Email delivery is not configured for this address yet. Ask the project owner to finish the email setup.';
    if (code === 'over_email_send_rate_limit') return 'Too many emails requested. Please wait before trying again.';
    return error.message || 'Unable to connect. Please try again.';
  }
  function setMode(next) {
    mode = next;
    $('#account-title').textContent = {login:'Welcome back.',signup:'Your next chapter starts here.',reset:'Reset your password.',password:'Choose a new password.'}[mode];
    $('#account-submit').textContent = {login:'Log in',signup:'Create account',reset:'Send reset link',password:'Save new password'}[mode];
    $('#account-email-label').hidden = mode === 'password';
    form.elements.email.required = mode !== 'password';
    $('#account-password-label').hidden = mode === 'reset';
    form.elements.password.required = mode !== 'reset';
    form.elements.password.minLength = ['signup','password'].includes(mode) ? 8 : 1;
    form.elements.password.autocomplete = ['signup','password'].includes(mode) ? 'new-password' : 'current-password';
    form.elements.password.value = '';
    $('#account-tabs').hidden = mode === 'password';
    document.querySelectorAll('[data-account-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.accountMode === mode));
    setMessage('');
  }
  function showAccount() {
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    $('#account-guest').hidden = !!user;
    $('#account-member').hidden = !user;
    if (user && !recovering) {
      $('#account-title').textContent = 'Your account.';
      $('#account-email').textContent = user.email;
    } else {
      $('#account-guest').hidden = false;
      $('#account-member').hidden = true;
      setMode(recovering ? 'password' : 'login');
    }
    dialog.showModal();
  }
  function syncStatus(text, failed = false) {
    $('#save-status').textContent = text;
    $('#sync-retry').hidden = !failed;
    $('#sync-download').hidden = !failed;
    $('#sync-reload').hidden = !failed;
    $('#save-status').classList.toggle('save-error', failed);
  }
  $('#account-button').onclick = showAccount;
  $('#account-close').onclick = () => dialog.close();
  document.querySelectorAll('[data-account-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.accountMode));
  form.onsubmit = async event => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    form.querySelectorAll('input,button').forEach(el=>el.disabled=true);
    document.querySelectorAll('[data-account-mode]').forEach(el=>el.disabled=true);
    setMessage('One moment…');
    try {
      if (mode === 'signup') {
        const {data,error} = await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});
        if (error) throw error;
        setMessage(data.session ? 'Account created. Opening your habits…' : 'Check your email for a confirmation link, then come back and log in.');
      } else if (mode === 'login') {
        const {error} = await client.auth.signInWithPassword({email,password});
        if (error) throw error;
        setMessage('Opening your habits…');
      } else if (mode === 'reset') {
        if (!config.emailDeliveryEnabled) throw new Error('Password-reset emails are not available in this prototype yet.');
        const {error} = await client.auth.resetPasswordForEmail(email,{redirectTo});
        if (error) throw error;
        setMessage('If this email has an account, a reset link will arrive shortly.');
      } else {
        const {error} = await client.auth.updateUser({password});
        if (error) throw error;
        recovering = false;
        try { sessionStorage.removeItem(recoveryKey); } catch {}
        dialog.close();
        syncStatus('Password updated. Your habits are ready.');
      }
    } catch(error) { setMessage(authError(error)); }
    finally { form.elements.password.value = ''; form.querySelectorAll('input,button').forEach(el=>el.disabled=false); document.querySelectorAll('[data-account-mode]').forEach(el=>el.disabled=false); }
  };
  async function logOut() {
    try {
      if (cloud) await cloud.flush();
      await window.GuiltPush?.beforeLogout();
      const {error} = await client.auth.signOut({scope:'local'});
      if (error) throw error;
      location.reload();
    } catch(error) { setMessage('Could not log out safely: ' + error.message); }
  }
  $('#account-logout').onclick = logOut;
  $('#boot-signout').onclick = logOut;
  $('#boot-retry').onclick = () => location.reload();
  $('#sync-retry').onclick = () => cloud?.retry()
    .then(() => document.dispatchEvent(new Event('guilt-habit-log'))).catch(()=>{});
  function downloadDraft() {
    if (!cloud?.value) return;
    const url = URL.createObjectURL(new Blob([cloud.value],{type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download='guilt-trip-unsaved-backup.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('#sync-download').onclick = downloadDraft;
  $('#sync-reload').onclick = () => {
    if (confirm('Discard this tab’s unsaved changes and load the latest online version? Download a backup first if you want to keep them.')) {
      cloud.discardDraft(); leaving = true; location.reload();
    }
  };
  $('#import-consent').onchange = event => { $('#account-import').disabled = !event.target.checked; };
  $('#account-import').onclick = async () => {
    $('#account-import').disabled = true;
    try {
      await cloud.flush();
      const raw = localStorage.getItem('unfuck-day-v2');
      if (!raw) throw new Error('No browser-only habits were found.');
      const imported = window.GuiltAccountState.validate(JSON.parse(raw));
      cloud.setItem('unfuck-day-v2', JSON.stringify(window.GuiltAccountState.withNewHabitIds(imported, () => crypto.randomUUID())));
      await cloud.flush();
      location.reload();
    } catch(error) { setMessage(error.message); $('#account-import').disabled = false; }
  };
  client.auth.onAuthStateChange((event,session)=> {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; try { sessionStorage.setItem(recoveryKey,'yes'); } catch {} }
    if (activeId !== undefined && (session?.user?.id || null) !== activeId) {
      // Reload clears the previous user's in-memory view; any unsaved draft is owner-scoped.
      $('#app-shell').inert = true;
      $('#app-shell').hidden = true;
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      leaving = true;
      if (cloud) cloud.error = new Error('Your session changed. Log in again to resume saving.');
      setTimeout(async()=>{try{await window.GuiltPush?.clearDevice();}finally{location.reload();}},0);
    } else if (event === 'PASSWORD_RECOVERY' && activeId !== undefined && !loading) setTimeout(showAccount,0);
  });
  async function loadScript(src) {
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load the app. Refresh to retry.'));document.body.append(script);});
  }
  try {
    const {data,error} = await client.auth.getSession();
    if (error) throw error;
    user = data.session?.user || null;
    activeId = user?.id || null;
    if (user) {
      let result = await client.from('habit_accounts').select('payload,revision').eq('user_id',user.id).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        result = await client.from('habit_accounts').insert({user_id:user.id,payload:null}).select('payload,revision').single();
        // A concurrent first login may have created the row already.
        if (result.error?.code === '23505') result = await client.from('habit_accounts').select('payload,revision').eq('user_id',user.id).single();
        if (result.error) throw result.error;
      }
      if (result.data.payload) window.GuiltAccountState.validate(result.data.payload);
      cloud = new window.GuiltCloudStore({client,userId:user.id,row:result.data,onStatus:syncStatus,draftStorage:sessionStorage});
      if (cloud.value) window.GuiltAccountState.validate(JSON.parse(cloud.value));
      window.GuiltStorage = cloud;
      $('#account-button').textContent = 'My account';
      $('#profile-storage-note').textContent = 'Your profile, habits and progress are saved to your account.';
      syncStatus('Saved to your account');
      if (cloud.error) syncStatus(cloud.error.message,true);
      else if (cloud.pending !== null) cloud.flush().catch(()=>{});
    } else {
      window.GuiltStorage = localStorage;
      syncStatus('Guest mode · saved only in this browser');
    }
    window.GuiltPush?.init({client,userId:user?.id||null});
    await loadScript('app.js?v=joint-2');
    await loadScript('progress-ui.js?v=progress-7');
    await loadScript('quiz-ui.js?v=accounts-1');
    window.GuiltSocial?.init({client, cloud, openAccount: showAccount});
    $('#boot-status').hidden = true;
    $('#app-shell').hidden = false;
    $('#app-shell').inert = false;
    loading = false;
    if (recovering) showAccount();
  } catch(error) {
    $('#boot-message').textContent = 'Your account could not be loaded. Your online data has not been replaced. ' + (error.message || 'Please try again.');
    $('#boot-retry').hidden = false;
    $('#boot-signout').hidden = !user;
  }
  addEventListener('beforeunload',event=>{if(cloud?.dirty && !leaving){event.preventDefault();event.returnValue='';}});
})();

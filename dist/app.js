const appStorage=window.GuiltStorage;
const $=s=>document.querySelector(s),key='unfuck-day-v2';const {dateKey,fromKey}=HabitCore;
const defaultGoals=[{name:'Move a little',detail:'20 minutes of movement',category:'Fitness',target:20,unit:'minutes',time:'18:00'},{name:'Make time for a meal',detail:'Take a proper lunch break',category:'Health',target:1,unit:'break',time:'12:30'},{name:'Wind down',detail:'Put the phone away before bed',category:'Health',target:1,unit:'session',time:'22:30'}];
let state;let storageWarning=false;
try{state=JSON.parse(appStorage.getItem(key))}catch{}
let shouldStartQuiz=false;try{shouldStartQuiz=!appStorage.getItem(key)&&!appStorage.getItem('nudge-v1')}catch{}
if(!state){let old;try{old=JSON.parse(appStorage.getItem('nudge-v1'))}catch{}state={goals:(old?.goals||defaultGoals).map((g,i)=>({...defaultGoals[i%3],...g,id:'habit-'+i,days:[0,1,2,3,4,5,6],createdAt:dateKey(),paused:false,archived:false})),logs:{},tone:old?.tone||'retriever',paused:old?.paused||false,fullName:old?.fullName||'',displayName:'',checkinTime:'20:00',reminders:true,sessions:old?.sessions||{},timer:old?.timer||null};for(const [day,rows]of Object.entries(old?.days||{})){state.logs[day]={};rows.forEach((status,i)=>{let g=state.goals[i];if(g)state.logs[day][g.id]={name:g.name,target:g.target,unit:g.unit,status,value:status==='done'?g.target:0}})}}
if(!personaNames[state.tone])state.tone='retriever';if(typeof state.quizComplete!=='boolean')state.quizComplete=!shouldStartQuiz;if(!state.humourStyle)state.humourStyle='dry';if(!Array.isArray(state.sensitiveTopics))state.sensitiveTopics=[];shouldStartQuiz=!state.quizComplete;
let activeDay=dateKey(),replyCounts={},messageIndex=0,editId=null,popupReturn=null;const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
let toastTimeout;function toast(t,mood='neutral'){$('#toast .toast-avatar').innerHTML=coachImg(state?.tone,mood);$('#toast .toast-text').textContent=notificationStyle(t);$('#toast').style.display='flex';clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').style.display='none',5000)}
// Coach reminders: in-app toast with the coach, plus a browser notification with the coach as icon when the tab is in the background.
function coachNotify(t,status='neutral'){const mood=moodForStatus(status);toast(t,mood);setCoachMood(status);if(!localAlertsEnabled()||!document.hidden||!('Notification' in window)||Notification.permission!=='granted')return;coachIconURL(state.tone,mood).then(icon=>{try{new Notification(themeCopy[state.tone].greeting,{body:voiceStyle(t),icon:icon||undefined,tag:'coach-'+Date.now()})}catch{}})}
function localAlertsEnabled(){try{return localStorage.getItem('guilt-trip-local-alerts')==='yes'}catch{return false}}
function notificationStatus(){if(!('Notification' in window))return 'While-open alerts are unavailable here.';if(Notification.permission==='denied')return 'Notifications are blocked in your browser settings.';return localAlertsEnabled()&&Notification.permission==='granted'?'While-open habit alerts are on. These may include habit names.':'While-open habit alerts are off. These are separate from your daily push.'}
function renderLocalAlerts(){$('#notify-status').textContent=notificationStatus();$('#notify-button').hidden=!('Notification' in window)||Notification.permission==='denied';$('#notify-button').textContent=localAlertsEnabled()?'Turn off habit alerts':'Enable while-open habit alerts'}

function save(){try{appStorage.setItem(key,JSON.stringify(state))}catch{if(!storageWarning){toast('Browser storage is unavailable. Download your data before leaving.');storageWarning=true}}}
function syncDays(){let end=dateKey();let start=state.lastSeen||end;let d=fromKey(start);while(dateKey(d)<=end){let k=dateKey(d);if(!state.logs[k])state.logs[k]=HabitCore.entries(state.goals,k);d.setDate(d.getDate()+1)}state.lastSeen=end;const rows=state.logs[end];for(const g of state.goals){if(HabitCore.scheduled(g,end)&&!rows[g.id])rows[g.id]=HabitCore.entries([g],end)[g.id];if(!HabitCore.scheduled(g,end)&&rows[g.id]?.status!=='done')delete rows[g.id]}save()}
function personalize(message,habit='your goal'){const personalized=message.replaceAll('{name}',(state.fullName||'MY DEAR CHILD').toUpperCase()).replaceAll('{habit}',state.tone==='sergeant'?habit.toUpperCase():habit);return ShoveQuiz.styleMessage(personalized,state.humourStyle)}
function speak(){ $('#coach-message').textContent=state.paused?'Quiet mode is on. Your goals are here whenever you’re ready.':voiceStyle(personalize(messages[state.tone][messageIndex++%messages[state.tone].length]))}
function render(){syncDays();const rows=state.logs[dateKey()],all=Object.entries(rows),cat=$('#category-filter').value;
 $('#date').textContent=new Date().toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'}).toUpperCase();$('#profile-button').textContent=state.displayName?state.displayName+' · Settings':'Profile & settings';
 $('#coach-portrait').src='assets/'+state.tone+'.png';$('#coach-portrait').alt=personaNames[state.tone]+' portrait';$('#coach-name').textContent=personaNames[state.tone];$('#persona-description').textContent=personaDescriptions[state.tone];$('#meanness').textContent='Meanness '+(state.meanness||personaLevels[state.tone])+'/5';
 document.querySelectorAll('[data-tone]').forEach(b=>{b.classList.toggle('selected',b.dataset.tone===state.tone);b.setAttribute('aria-pressed',b.dataset.tone===state.tone)});$('#pause').textContent=state.paused?'Resume coach reminders':'Pause coach reminders';$('#nudge').disabled=state.paused;
 const shown=all.filter(([id])=>cat==='all'||state.goals.find(g=>g.id===id)?.category===cat);
 $('#habit-list').innerHTML=shown.map(([id,r])=>{let g=state.goals.find(g=>g.id===id);return `<article class="habit ${r.status==='done'?'done':''}"><div class="habit-content"><small>${escapeHTML(g?.category||'Habit')} · ${g?.time||''}</small><h3>${escapeHTML(r.name)}</h3><p>${escapeHTML(g?.detail||'')} · ${r.target} ${escapeHTML(r.unit)}</p><form class="amount-form" data-id="${id}"><label>Logged <input aria-label="Progress for ${escapeHTML(r.name)}" type="number" min="0" max="100000" step="0.01" required value="${r.value}"></label><button class="text-btn">Save</button></form>${r.status==='later'?'<small>Postponed · still on today’s list</small>':''}</div><div class="habit-actions"><button class="check" data-check="${id}" aria-label="${r.status==='done'?'Undo':'Complete'} ${escapeHTML(r.name)}" aria-pressed="${r.status==='done'}">✓</button><button class="later" data-later="${id}">${r.status==='later'?'Undo later':'Later'}</button></div></article>`}).join('')||'<div class="empty-state">'+(all.length?'No habits in this category today.':'Nothing scheduled today. Enjoy the breathing room—or add a small promise.')+'</div>';
 const n=all.filter(([,r])=>r.status==='done').length;$('#completion-text').textContent=`${n} of ${all.length} promises kept today`;$('#completion-bar').style.width=(all.length?n/all.length*100:0)+'%';renderProgress();applyTheme();document.dispatchEvent(new Event('guilt-habits-change'))}
function renderProgress(){window.GuiltProgressUI?.render()}
function showActionReply(id,status){const r=state.logs[dateKey()][id];const opts=actionReplies[state.tone][status],k=state.tone+status;let msg=personalize(opts[(replyCounts[k]||0)%opts.length],r.name);replyCounts[k]=(replyCounts[k]||0)+1;$('#response-popup .eyebrow').textContent=personaNames[state.tone].toUpperCase()+' SAYS';$('#response-title').textContent={done:'Promise kept!',later:'Later, then.',pending:'Back on your list.'}[status];$('#response-habit').textContent=r.name;$('#response-message').textContent=msg;$('#coach-message').textContent=msg;$('#response-portrait').src='assets/'+state.tone+'.png';$('#response-portrait').alt=personaNames[state.tone]+' portrait';decorateResponse(id,status);$('#response-popup').showModal()}
$('#response-popup').addEventListener('close',()=>{if(popupReturn)$(popupReturn)?.focus()});
function updateHabitLog(id, action, value, unit) {
  syncDays();
  const record=state.logs[dateKey()]?.[id];
  if(!record || (unit && HabitCore.measurementUnit(record.unit)!==unit))return null;
  if(action==='toggle'){
    record.status=record.status==='done'?'pending':'done';
    record.value=record.status==='done'?record.target:0;
  }else if(action==='later'){
    record.status=record.status==='later'?'pending':'later';
    if(record.value>=record.target)record.value=0;
  }else{
    if(!Number.isFinite(value)||value<0||value>100000)return null;
    record.value=value;
    record.status=value>=record.target?'done':'pending';
  }
  render();
  document.dispatchEvent(new Event('guilt-habit-log'));
  return record;
}

$('#habit-list').onclick=e=>{
  const b=e.target.closest('[data-check],[data-later]');
  if(!b)return;
  const id=b.dataset.check||b.dataset.later;
  const record=updateHabitLog(id,b.dataset.check?'toggle':'later');
  if(!record)return;
  popupReturn=b.dataset.check?`[data-check="${id}"]`:`[data-later="${id}"]`;
  showActionReply(id,record.status);
};
$('#habit-list').onsubmit=e=>{
  e.preventDefault();
  const id=e.target.dataset.id;
  const record=updateHabitLog(id,'amount',e.target.querySelector('input').valueAsNumber);
  if(!record)return;
  if(record.status==='done')showActionReply(id,'done');
  else toast(`Logged ${record.value} of ${record.target} ${record.unit}. Small steps count.`);
};
$('#category-filter').onchange=render;document.querySelectorAll('[data-tone]').forEach(b=>b.onclick=()=>{state.tone=b.dataset.tone;state.meanness=personaLevels[state.tone];save();render();speak()});$('#nudge').onclick=speak;$('#pause').onclick=()=>{state.paused=!state.paused;save();render();speak()};
function manager(){ $('#archive-list').innerHTML=state.goals.filter(g=>g.archived).map(g=>`<div class="managed-habit"><strong>${escapeHTML(g.name)}</strong><button class="text-btn" data-restore="${g.id}">Restore</button></div>`).join('')||'<p>No archived habits.</p>';$('#manager-list').innerHTML=state.goals.filter(g=>!g.archived).map(g=>`<div class="managed-habit"><strong>${escapeHTML(g.name)}</strong><small>${g.days.map(i=>weekdays[i]).join(', ')} · ${g.target} ${escapeHTML(g.unit)}${g.paused?' · Paused':''}</small><div><button class="text-btn" data-edit="${g.id}">Edit</button><button class="text-btn" data-pause="${g.id}">${g.paused?'Resume':'Pause'}</button><button class="text-btn" data-archive="${g.id}">Archive</button></div></div>`).join('')||'<p>No active habits. Add your first one below.</p>';if(!$('#manager').open)$('#manager').showModal()}
$('#archive-list').onclick=e=>{const b=e.target.closest('[data-restore]');if(!b)return;syncDays();let g=state.goals.find(g=>g.id===b.dataset.restore);g.archived=false;g.paused=false;save();render();manager()};$('#edit').onclick=manager;$('#manager-list').onclick=e=>{let b=e.target.closest('button');if(!b)return;let id=b.dataset.edit||b.dataset.pause||b.dataset.archive,g=state.goals.find(g=>g.id===id);if(b.dataset.edit){$('#manager').close();openEditor(id);return}syncDays();if(b.dataset.pause)g.paused=!g.paused;else g.archived=true;save();render();manager()};
function addHabit(fields) {
  const habit = {...fields, id:crypto.randomUUID(), createdAt:dateKey(), paused:false, archived:false};
  state.goals.push(habit);
  return habit;
}

window.GuiltHabits = {
  todayLogs() {
    const today=dateKey();
    return state.goals.filter(goal=>HabitCore.scheduled(goal,today)&&state.logs[today]?.[goal.id])
      .map(goal=>({id:goal.id,...state.logs[today][goal.id]}));
  },
  saveTodayLog(id, action, amount, unit) {
    const record=updateHabitLog(id,action,amount,unit);
    if(!record)throw new Error('This habit is unavailable or uses a different unit. Check Manage habits.');
  },
  ensureJointHabit(name, unit) {
    name = HabitCore.habitName(name);
    unit = HabitCore.measurementUnit(unit);
    if (!name || name.length > 60 || !unit || unit.length > 20) {
      throw new Error('Enter a habit name and a unit, such as km, pages, or times.');
    }
    const existing = HabitCore.matchingHabit(state.goals, name, unit);
    if (existing?.paused) throw new Error('Resume your matching habit in Manage habits, or enter a different name.');
    if (existing) return existing.id;
    const habit = addHabit({
      name, unit, target:1, detail:'Log your progress for this joint activity.',
      category:'Personal development', days:[0,1,2,3,4,5,6], time:'18:00'
    });
    render();
    return habit.id;
  }
};

function openEditor(id=null){editId=id;let g=state.goals.find(g=>g.id===id)||{name:'',detail:'',category:'Personal development',target:1,unit:'times',days:[0,1,2,3,4,5,6],time:'18:00'};let f=$('#goal-form');f.reset();for(let name of ['name','detail','category','target','unit','time'])f.elements[name].value=g[name];$('#weekday-picker').innerHTML=[1,2,3,4,5,6,0].map(i=>`<label class="day-choice"><input type="checkbox" name="days" value="${i}" ${g.days.includes(i)?'checked':''}>${weekdays[i]}</label>`).join('');$('#editor-title').textContent=id?'Edit your promise.':'A small promise.';$('#goal-error').textContent='';$('#editor').showModal()}
$('#add-habit').onclick=()=>openEditor();$('#manager-add').onclick=()=>{$('#manager').close();openEditor()};
const templates={read:['Read a little','Personal development','Read before picking up your phone',20,'pages'],move:['Move your body','Fitness','Take a walk or do a workout',20,'minutes'],focus:['Make focus time','Productivity','One task without distractions',25,'minutes'],wind:['Wind down','Health','Put the phone away before bed',1,'session']};$('#template').onchange=e=>{let t=templates[e.target.value];if(t)['name','category','detail','target','unit'].forEach((n,i)=>$('#goal-form').elements[n].value=t[i])};
$('#goal-form').onsubmit=e=>{e.preventDefault();let f=new FormData(e.target),days=f.getAll('days').map(Number),name=f.get('name').trim(),detail=f.get('detail').trim(),unit=f.get('unit').trim(),target=Number(f.get('target'));if(!days.length||!name||!detail||!unit||target<1){$('#goal-error').textContent='Add a name, small step, target, unit and at least one weekday.';return}syncDays();let g=state.goals.find(g=>g.id===editId);let change={name,detail,category:f.get('category'),target,unit,days,time:f.get('time')};if(g)Object.assign(g,change);else g=addHabit(change);let r=state.logs[dateKey()][g.id];if(r&&r.status!=='done'){Object.assign(r,{name,target,unit});if(r.value>=target)r.status='done'}save();render();$('#editor').close();toast('Habit saved. Your earlier history stays intact.')};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#profile-button').onclick=()=>{let f=$('#profile-form');f.elements.displayName.value=state.displayName;f.elements.fullName.value=state.fullName;f.elements.checkinTime.value=state.checkinTime;f.elements.reminders.checked=state.reminders;renderLocalAlerts();window.GuiltPush?.refresh();$('#profile-dialog').showModal()};
$('#notify-button').onclick=async()=>{try{if(localAlertsEnabled())localStorage.removeItem('guilt-trip-local-alerts');else if(await Notification.requestPermission()==='granted')localStorage.setItem('guilt-trip-local-alerts','yes');renderLocalAlerts()}catch{toast('Could not update this browser’s alerts.')}};
$('#corner-coach').onclick=()=>{$('.coach').scrollIntoView({behavior:'smooth',block:'center'});if(!state.paused)speak()};
$('#profile-form').onsubmit=e=>{e.preventDefault();let f=new FormData(e.target);state.displayName=f.get('displayName').trim();state.fullName=f.get('fullName').trim();state.checkinTime=f.get('checkinTime');state.reminders=f.has('reminders');save();render();$('#profile-dialog').close();toast('Preferences updated.')};$('#export').onclick=()=>{let url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='guilt-trip-'+dateKey()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.coachQuizProfile={shouldStartQuiz,preview(tone,style){let message=ShoveQuiz.styleMessage(personalizeForQuiz(messages[tone][0],tone),style);if(tone==='younger')return message.toLowerCase();if(tone==='sergeant')return message.toUpperCase();if(tone==='coworker'&&!message.endsWith('🙂'))return message+' 🙂';if(tone==='mum'&&!message.includes('Love, Mum'))return message+'\nLove, Mum';return message},save(result){state.tone=result.tone;state.meanness=result.meanness;state.humourStyle=result.humourStyle;state.sensitiveTopics=result.sensitiveTopics;state.quizComplete=true;save();render();speak();toast('Your coach profile is saved. Your habits and history are untouched.')}};
function personalizeForQuiz(message,tone){return message.replaceAll('{name}',(state.fullName||state.displayName||'friend').toUpperCase()).replaceAll('{habit}',tone==='sergeant'?'your goal'.toUpperCase():'your goal')}
let remaining=state.timer?.remaining??1500,end=state.timer?.end??null,reminded=new Set();if(state.timer?.duration)$('#duration').value=state.timer.duration;
function saveTimer(){state.timer={remaining,end,duration:$('#duration').value};save()}
function tick(){if(dateKey()!==activeDay){activeDay=dateKey();render();speak()}if(end){remaining=Math.max(0,Math.ceil((end-Date.now())/1000));if(!remaining){end=null;state.sessions[dateKey()]=(state.sessions[dateKey()]||0)+1;saveTimer();renderProgress();coachNotify('Focus session complete. Take a break!','done')}}$('#timer').textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');$('#start').textContent=end?'Pause session Ⅱ':remaining===0?'Start another ↗':'Start focusing ↗';$('#duration').disabled=!!end;if(state.paused||!state.reminders)return;let t=new Date().toTimeString().slice(0,5);for(let g of state.goals){let id=dateKey()+g.id+t;if(g.time===t&&state.logs[dateKey()]?.[g.id]?.status==='pending'&&!reminded.has(id)){reminded.add(id);coachNotify('A little nudge: '+g.name);speak()}}let id=dateKey()+'checkin'+t;if(t===state.checkinTime&&!reminded.has(id)){reminded.add(id);(window.GuiltPush?.enabled?toast:coachNotify)('Daily check-in: review your promises and log your progress.')}}
$('#start').onclick=()=>{if(end){remaining=Math.max(0,Math.ceil((end-Date.now())/1000));end=null}else{if(!remaining)remaining=Number($('#duration').value)*60;end=Date.now()+remaining*1000}saveTimer();tick()};$('#reset').onclick=()=>{end=null;remaining=Number($('#duration').value)*60;saveTimer();tick()};$('#duration').onchange=()=>{remaining=Number($('#duration').value)*60;saveTimer();tick()};
render();speak();tick();setInterval(tick,1000);

(function(root){
  function validate(state) {
    const fail = () => { throw new Error('Saved habit data has an unsupported format. Download a backup before making changes.'); };
    const object = x => x && typeof x === 'object' && !Array.isArray(x);
    const number = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
    const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
    const id = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
    if (!object(state) || !Array.isArray(state.goals) || !object(state.logs) || !object(state.sessions)) fail();
    if (!['retriever','younger','coworker','mum','sergeant'].includes(state.tone)) fail();
    if (state.lastSeen && !date(state.lastSeen)) fail();
    for (const key of ['displayName','fullName','checkinTime','humourStyle']) if (state[key] !== undefined && typeof state[key] !== 'string') fail();
    for (const key of ['paused','reminders','quizComplete']) if (state[key] !== undefined && typeof state[key] !== 'boolean') fail();
    for(const g of state.goals) {
      if(!object(g)||!id(g.id)||typeof g.name!=='string'||typeof g.detail!=='string'||typeof g.unit!=='string'||!number(g.target)||!date(g.createdAt)||!Array.isArray(g.days)||g.days.some(d=>!Number.isInteger(d)||d<0||d>6)||typeof g.time!=='string'||!/^\d{2}:\d{2}$/.test(g.time)) fail();
    }
    for(const [day,rows] of Object.entries(state.logs)) {
      if(!date(day)||!object(rows)) fail();
      for(const [key,r] of Object.entries(rows)) if(!id(key)||!object(r)||typeof r.name!=='string'||typeof r.unit!=='string'||!number(r.target)||!number(r.value)||!['pending','done','later'].includes(r.status)) fail();
    }
    for(const [day,n] of Object.entries(state.sessions)) if(!date(day)||!number(n)) fail();
    if(state.timer && (!object(state.timer)||!number(state.timer.remaining)||(state.timer.end!==null&&!number(state.timer.end))||!['5','15','25','45'].includes(String(state.timer.duration)))) fail();
    return state;
  }
  root.GuiltAccountState={validate};
  if(typeof module!=='undefined')module.exports={validate};
})(typeof window!=='undefined'?window:globalThis);

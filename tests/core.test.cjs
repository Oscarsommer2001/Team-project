const assert=require('node:assert/strict');const C=require('../dist/core.js');
const g={id:'a',name:'Read',target:20,unit:'pages',createdAt:'2026-11-02',days:[1,3],paused:false,archived:false};
assert.equal(C.scheduled(g,'2026-11-02'),true);assert.equal(C.scheduled(g,'2026-11-03'),false);assert.equal(C.scheduled({...g,paused:true},'2026-11-02'),false);assert.equal(C.scheduled(g,'2026-10-26'),false);
let rows=C.entries([g],'2026-11-02');g.target=40;assert.equal(rows.a.target,20,'History snapshot does not change when goal changes');
assert.deepEqual(C.summary({'2026-11-02':{a:{status:'later'}},'2026-11-03':{a:{status:'later'},b:{status:'done'}}},'2026-11-03'),{done:1,total:2,missed:1,rate:50});
assert.equal(C.summary({},'2026-11-03').rate,null);console.log('Scheduling, historical snapshots, and completion-rate checks passed.');
assert.equal(C.streak({'2026-11-01':{a:{status:'done'}},'2026-11-02':{},'2026-11-03':{a:{status:'later'}}},'a','2026-11-03'),1,'Today pending and unscheduled days do not break a streak');
assert.equal(C.streak({'2026-11-01':{a:{status:'done'}},'2026-11-02':{a:{status:'pending'}},'2026-11-03':{a:{status:'done'}}},'a','2026-11-03'),1,'A prior missed scheduled day breaks the streak');
console.log('Scheduled-day streak checks passed.');

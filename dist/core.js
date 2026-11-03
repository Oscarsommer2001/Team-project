/* Pure scheduling helpers, shared with the local regression checks. */
const HabitCore = (() => {
 function dateKey(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
 function fromKey(k){const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12)}
 function scheduled(g,k){return !g.archived&&!g.paused&&g.createdAt<=k&&g.days.includes(fromKey(k).getDay())}
 function entries(goals,k){return Object.fromEntries(goals.filter(g=>scheduled(g,k)).map(g=>[g.id,{name:g.name,target:g.target,unit:g.unit,status:'pending',value:0}]))}
 function summary(logs,today){let done=0,total=0,missed=0;for(const [day,rows]of Object.entries(logs)){for(const r of Object.values(rows)){if(r.status==='done')done++;if(day<today||r.status==='done')total++;if(day<today&&r.status!=='done')missed++}}return {done,total,missed,rate:total?Math.round(done/total*100):null}}
 function streak(logs,id,today){let count=0;for(const day of Object.keys(logs).sort().reverse()){if(day>today)continue;const r=logs[day][id];if(!r)continue;if(day===today&&r.status!=='done')continue;if(r.status!=='done')break;count++}return count}
 return {dateKey,fromKey,scheduled,entries,summary,streak};
})();
if(typeof module!=='undefined')module.exports=HabitCore;

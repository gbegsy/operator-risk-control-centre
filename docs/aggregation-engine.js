(function(g){
'use strict';
const clean=v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
const unique=a=>[...new Set(a)];
const types=['Shared cause','Shared control','Infrastructure dependency','People / supplier dependency','Combined scenario'];
const sourceTypes=['Control test','ORA / deviation','ICP finding','Indicator','Action progress','Report extract','Manual evidence'];
function fingerprint(x){const raw=JSON.stringify(x,Object.keys(x).sort());let a=2166136261,b=5381;for(let i=0;i<raw.length;i++){a=Math.imul(a^raw.charCodeAt(i),16777619);b=Math.imul(b,33)^raw.charCodeAt(i);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
function normalise(s){for(const key of ['aggregates','triangulations']){if(s[key]===undefined)s[key]=[];if(!Array.isArray(s[key]))throw Error('Invalid '+key+' array.');}return s;}
function riskIds(s,r){return r.target.startsWith('risk:')?[r.target.slice(5)]:(s.aggregates||[]).find(x=>x.id===r.target.slice(10))?.risks||[];}
function catalog(s,at){
 const E=g.RCC,rows=[];
 const add=(type,x,date,text,reference)=>rows.push({key:type+':'+x.id,type,ref:x.id,title:x.title||x.file,date:date||'',text:String(text||''),reference:reference||'',risks:x.risk?[x.risk]:[],fingerprint:fingerprint(x)});
 s.controls.forEach(x=>add('Control test',x,x.tested,E.controlState(x,at)+' · '+x.evidence+' · basis: '+x.basis,x.url));
 (s.oras||[]).forEach(x=>add('ORA / deviation',x,x.opened,x.status+' · '+x.hub+' · '+x.barrier+' · '+x.evidence+' · controls: '+x.controls,x.source));
 (s.findings||[]).forEach(x=>add('ICP finding',x,x.reported,x.status+' · '+x.significance+' · '+x.maturity+' · '+x.evidence,x.source));
 (s.indicators||[]).forEach(x=>add('Indicator',x,x.observed,E.indicatorState(x,at)+' · reading '+(x.value===null?'missing':x.value)+' '+x.unit+' · trigger '+x.direction+' '+x.threshold+' · '+x.note+' · basis: '+x.basis));
 s.actions.forEach(x=>add('Action progress',x,x.completed||x.created,x.status+' · maturity: '+(x.maturity||'not assessed')+' · '+x.note+' · completion alone does not verify control effectiveness'));
 (s.reports||[]).forEach(x=>add('Report extract',x,x.at.slice(0,10),x.note+'\n'+x.text.slice(0,12000),x.file));
 return rows;
}
function evidenceState(x,r,at){
 if(x.captured>at)return 'Captured after cutoff';
 if(!x.observed)return 'Undated';
 if(x.observed>at)return 'After cutoff';
 if((Date.parse(at)-Date.parse(x.observed))/86400000>r.maxAgeDays)return 'Stale';
 return 'Current';
}
function sourceDrift(s,r,at){const current=new Map(catalog(s,at).map(x=>[x.key,x]));return r.evidence.filter(x=>x.type!=='Manual evidence'&&(!current.has(x.key)||current.get(x.key).fingerprint!==x.fingerprint));}
function triangulation(r,at){
 const rows=r.evidence.map(x=>({...x,freshness:evidenceState(x,r,at)}));
 const current=rows.filter(x=>x.freshness==='Current');
 // Join both identical original records and declared common provenance. Two exports are not two independent sources.
 const parent=current.map((_,i)=>i),root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));
 for(let i=0;i<current.length;i++)for(let j=0;j<i;j++)if(clean(current[i].origin)===clean(current[j].origin)||clean(current[i].key)===clean(current[j].key))parent[root(i)]=root(j);
 const families=new Set(current.map((_,i)=>root(i))).size;
 const supports=current.filter(x=>x.position==='Supports'),challenges=current.filter(x=>x.position==='Challenges');
 return {rows,current,families,supports,challenges,conflict:supports.length>0&&challenges.length>0,duplicates:current.length-families,unusable:rows.length-current.length,overdue:r.status!=='Closed'&&r.review<at};
}
function aggregate(s,a,at){
 const E=g.RCC,risks=s.risks.filter(r=>a.risks.includes(r.id));
 const controls=s.controls.filter(c=>a.controls.includes(c.id)||a.risks.includes(c.risk));
 const actions=s.actions.filter(x=>a.risks.includes(x.risk)&&E.actionOpen(x,at));
 const overlaps=(s.aggregates||[]).filter(x=>x.id!==a.id&&x.status!=='Closed'&&a.status!=='Closed'&&x.risks.some(id=>a.risks.includes(id)));
 return {risks,controls,exceptions:controls.filter(c=>E.controlState(c,at)!=='Effective'),overdueActions:actions.filter(x=>E.isOverdue(x.due,at)),hubs:unique(risks.map(r=>r.hub)),objectives:unique(risks.map(r=>r.objective)),overlaps,overdue:a.status!=='Closed'&&a.review<at,unvalidated:risks.filter(r=>!r.validated).length};
}
function portfolio(s,at){
 const groups=(s.aggregates||[]).filter(x=>x.status!=='Closed'),reviews=(s.triangulations||[]).filter(x=>x.status!=='Closed');
 const memberships=groups.reduce((n,x)=>n+x.risks.length,0),distinct=unique(groups.flatMap(x=>x.risks));
 return {groups:groups.length,memberships,distinct:distinct.length,overlapMemberships:memberships-distinct.length,reviews:reviews.length,conflicts:reviews.filter(r=>triangulation(r,at).conflict).length,overdue:groups.filter(a=>a.review<at).length+reviews.filter(r=>r.review<at).length};
}
function suggestions(s){
 const open=new Set(s.risks.filter(r=>r.status==='Open').map(r=>r.id));
 return s.events.map(e=>({id:e.id,title:e.title,type:'Combined scenario',risks:unique(e.risks.filter(id=>open.has(id))),driver:e.detail,scope:e.hub})).filter(x=>x.risks.length>=2&&!(s.aggregates||[]).some(a=>a.status!=='Closed'&&a.risks.length===x.risks.length&&x.risks.every(id=>a.risks.includes(id)))).slice(0,6);
}
function validate(s){
 normalise(s);
 const str=(v,k,max=20000)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid '+k+'.');};
 const required=(v,k,max=20000)=>{str(v,k,max);if(!v.trim())throw Error('Record '+k+'.');};
 const date=(v,k,empty=false)=>{if(empty&&v==='')return;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Invalid '+k+'.');};
 const ids=(list,max)=>{if(list.length>max||new Set(list.map(x=>x?.id)).size!==list.length||list.some(x=>!x||typeof x.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(x.id)))throw Error('Invalid, duplicate or excessive analysis records.');};
 const refs=(list,known,min,label)=>{if(!Array.isArray(list)||list.length<min||list.length>2000||unique(list).length!==list.length||list.some(id=>!known.has(id)))throw Error('Choose '+label+' with valid, unique links.');};
 const risks=new Set(s.risks.map(x=>x.id)),controls=new Set(s.controls.map(x=>x.id));
 ids(s.aggregates,200);ids(s.triangulations,500);
 s.aggregates.forEach(a=>{
  for(const k of ['title','owner','driver','mechanism','consequence','boundary','decision','scope'])required(a[k],k,k==='title'?240:20000);
  refs(a.risks,risks,2,'at least two risks');refs(a.controls,controls,0,'controls');
  if(!types.includes(a.type)||!['Draft','Active','Closed'].includes(a.status)||!['Working','Illustrative','Owner reviewed'].includes(a.basis))throw Error('Invalid aggregate state.');
  for(const k of ['created','updated','review'])date(a[k],k);
 });
 const targets=new Set([...s.risks.map(x=>'risk:'+x.id),...s.aggregates.map(x=>'aggregate:'+x.id)]);
 s.triangulations.forEach(r=>{
  for(const k of ['title','claim','owner'])required(r[k],k,k==='title'?240:20000);
  for(const k of ['conclusion','gaps','reconciliation','decision','reviewer'])str(r[k],k);
  if(!targets.has(r.target)||!['Draft','Reviewed','Closed'].includes(r.status)||!['Not assessed','Low','Medium','High'].includes(r.confidence)||!Number.isInteger(r.maxAgeDays)||r.maxAgeDays<1||r.maxAgeDays>3660)throw Error('Invalid evidence review scope, state or freshness threshold.');
  for(const k of ['created','updated','review'])date(r[k],k);date(r.reviewedOn,'review date',true);
  if(!Array.isArray(r.evidence))throw Error('Invalid evidence list.');ids(r.evidence,50);
  r.evidence.forEach(x=>{
   for(const k of ['key','type','ref','title','origin','note','text','reference','fingerprint'])str(x[k],k);
   for(const k of ['key','ref','title','origin','note'])required(x[k],k);
   if(!sourceTypes.includes(x.type)||!['Supports','Challenges','Context'].includes(x.position))throw Error('Invalid evidence type or position.');
   if(x.type!=='Manual evidence'&&!/^[a-f0-9]{16}$/.test(x.fingerprint))throw Error('Invalid source capture.');
   refs(x.risks,risks,0,'evidence risk links');date(x.observed,'evidence observation',true);date(x.captured,'evidence capture');
  });
  if(r.status==='Reviewed'){
   const result=triangulation(r,r.reviewedOn||r.updated);
   for(const k of ['reviewer','conclusion','gaps','decision'])required(r[k],k);
   if(!r.reviewedOn||r.reviewedOn>r.updated||r.confidence==='Not assessed'||!result.current.length)throw Error('A reviewed judgement needs a named reviewer, review date, confidence and current dated evidence.');
   if(result.conflict)required(r.reconciliation,'how conflicting evidence was considered');
  }
 });
 return s;
}
g.RCC_AGG={types,sourceTypes,normalise,riskIds,catalog,evidenceState,sourceDrift,triangulation,aggregate,portfolio,suggestions,validate};
})(typeof window!=='undefined'?window:globalThis);

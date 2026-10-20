(function(g){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const score=r=>Number(r.rl)*Number(r.ri);
const impact=i=>Number(i)>=1&&Number(i)<=5?String(i):'?';
const bandAt=(l,i)=>{const n=Number(l)*Number(i);return n>=20?'Critical':n>=10?'High':n>=5?'Moderate':'Low';};
const band=r=>bandAt(r.rl,r.ri);
const bandRank=b=>['Low','Moderate','High','Critical'].indexOf(b);
const outside=r=>bandRank(band(r))>bandRank(r.appetiteBand);
const grade=(l,i)=>({'Critical':'critical','High':'high','Moderate':'medium','Low':'low'}[bandAt(l,i)]);
const cyberSummary=s=>{const list=s.risks.filter(r=>r.status==='Open'&&r.framework==='Generic cyber');const elevated=list.filter(r=>['Critical','High'].includes(band(r)));const quantified=elevated.filter(r=>r.frequency!==null&&r.loss!==null);return {list,elevated,quantified,total:quantified.reduce((n,r)=>n+r.frequency*r.loss,0),critical:list.filter(r=>r.ri>=5),designated:list.filter(r=>r.service==='Designated critical'),acceptance:list.filter(r=>r.treatment==='Accept'&&(!r.acceptor||!r.acceptedDate||!r.approvalRef||(band(r)==='Critical'&&(!r.seniorApprover||!r.seniorDate||!r.seniorApprovalRef))))};};
const isOverdue=(due,at)=>!!due&&due<at;
const controlState=(c,at)=>{
 if(!c.tested||c.status==='Untested')return 'Untested';
 if(c.tested>at)return 'Not tested at cutoff';
 if(['design','deployment','performance'].some(k=>c[k]==='Ineffective'))return 'Component ineffective';
 if(c.status==='Effective'&&['design','deployment','performance'].some(k=>c[k]==='Partly effective'))return 'Component partly effective';
 if(isOverdue(c.due,at))return 'Verification overdue';
 const days=(Date.parse(at+'T00:00:00Z')-Date.parse(c.tested+'T00:00:00Z'))/86400000;
 if(days>45)return 'Evidence stale';
 return c.status;
};
const indicatorState=(k,at)=>{
 if(k.value===null||!k.observed)return 'No reading';
 if(k.observed>at)return 'After cutoff';
 if((Date.parse(at+'T00:00:00Z')-Date.parse(k.observed+'T00:00:00Z'))/86400000>35)return 'Reading stale';
 return (k.direction==='Above'?k.value>k.threshold:k.value<k.threshold)?'Trigger breached':'Within trigger';
};
const observationTrend=(s,k,at)=>{if(k.value===null||!k.observed||k.observed>at)return null;const history=[...(s.indicatorHistory||[]),...(s.snapshots||[]).flatMap(x=>x.indicators||[])].filter(x=>x.id===k.id&&x.value!==null&&x.observed&&x.observed<k.observed&&x.observed<=at).sort((a,b)=>b.observed.localeCompare(a.observed));const prior=history[0];return prior?{value:k.value-prior.value,prior:prior.value,date:prior.observed}:null;};
const assuranceSummary=(s,at)=>{const oras=(s.oras||[]).filter(x=>(!x.deviationType||x.deviationType==='ORA')&&x.status!=='Cancelled'&&x.opened<=at&&(!x.closed||x.closed>at));const findings=(s.findings||[]).filter(x=>x.reported<=at&&(!x.closed||x.closed>at));const ps=s.indicators.filter(x=>x.kind==='Process safety');const breached=ps.filter(x=>indicatorState(x,at)==='Trigger breached');const interactions=new Map();const add=(x,type)=>{if(!x.hub||!x.barrier)return;const key=x.hub.toLowerCase().trim()+'|'+x.barrier.toLowerCase().trim();if(!interactions.has(key))interactions.set(key,{hub:x.hub,barrier:x.barrier,types:new Set(),records:[]});const item=interactions.get(key);item.types.add(type);item.records.push(x.id);};oras.forEach(x=>add(x,'ORA'));findings.forEach(x=>add(x,'ICP'));breached.forEach(x=>add(x,'Process safety'));return {oras,findings,ps,breached,oraReviews:oras.filter(x=>isOverdue(x.review,at)),oraExpired:oras.filter(x=>isOverdue(x.expires,at)),oraAged:oras.filter(x=>(Date.parse(at)-Date.parse(x.opened))/86400000>90),extended:oras.filter(x=>x.extensions>0),icpOverdue:findings.filter(x=>isOverdue(x.due,at)),repeats:findings.filter(x=>x.repeat),unverifiedClosures:(s.findings||[]).filter(x=>x.closed&&x.closed<=at&&!['Verified effective','Sustained'].includes(x.maturity)),maturityGaps:s.actions.filter(x=>x.completed&&x.completed<=at&&!['Verified effective','Sustained'].includes(x.maturity)),interactions:[...interactions.values()].filter(x=>x.types.size>=2)};};
const actionOpen=(a,at)=>a.created<=at&&(!a.completed||a.completed>at);
const metrics=(s,at)=>{
 const risks=s.risks.filter(r=>r.status==='Open');
 const open=s.actions.filter(a=>actionOpen(a,at));
 const controls=s.controls.filter(c=>risks.some(r=>r.id===c.risk));
 return {openRisks:risks.length,outside:risks.filter(r=>outside(r)).length,critical:risks.filter(r=>band(r)==='Critical').length,overdue:open.filter(a=>isOverdue(a.due,at)).length,openActions:open.length,assured:controls.filter(c=>controlState(c,at)==='Effective').length,controls:controls.length,exceptions:controls.filter(c=>controlState(c,at)!=='Effective').length,unvalidated:risks.filter(r=>!r.validated).length};
};
const monthEnd=m=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n,0)).toISOString().slice(0,10);};
const priorMonth=m=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n-2,1)).toISOString().slice(0,7);};
const addDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const windowEvents=(events,at,days=90)=>events.filter(e=>e.end>=at&&e.start<=addDays(at,days)).sort((a,b)=>a.start.localeCompare(b.start));
const scenario=s=>{const loss=s.production*s.days*s.margin/1000000;const draw=loss+s.extraCapex;return {loss,draw,remaining:s.availableCash-draw,bufferGap:s.availableCash-draw-s.buffer};};
const movement=(r,previous)=>{const p=previous?.risks.find(x=>x.id===r.id);return p?((Number(r.ri)-Number(p.ri))*5+Number(r.rl)-Number(p.rl)):null;};
const latestPrior=(snapshots,month)=>snapshots.filter(x=>x.month===priorMonth(month)).sort((a,b)=>b.created.localeCompare(a.created)||b.revision-a.revision)[0]||null;
const validate=s=>{
 if(!s||s.version!==3)throw Error('Unsupported backup format. This model requires the generic 5x5 version-3 format.');
 for(const list of ['risks','controls','actions','events','snapshots','audit'])if(!Array.isArray(s[list]))throw Error('Missing '+list+' array.');
 if(s.indicators===undefined)s.indicators=[];
 if(!Array.isArray(s.indicators))throw Error('Invalid indicators array.');
 for(const key of ['oras','findings','indicatorHistory','imports','reports','deviationHistory','aggregates','triangulations','matrixAssessments']){if(s[key]===undefined)s[key]=[];if(!Array.isArray(s[key]))throw Error('Invalid '+key+' array.');}
 const string=(v,n,max=20000)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid '+n);};
 const date=(v,n,empty=false)=>{if(empty&&v==='')return;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Invalid '+n);};
 const unique=list=>{if(list.length>2000||new Set(list.map(x=>x.id)).size!==list.length||list.some(x=>!x||typeof x.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(x.id)))throw Error('Invalid or duplicate IDs, or too many records.');};
 if(s.governance===undefined)s.governance={};
 if(!s.governance||Array.isArray(s.governance)||typeof s.governance!=='object')throw Error('Invalid governance records.');
 for(const [id,r] of Object.entries(s.governance)){if(!['scope','risk','material','testing','remediation','oversight','resilience'].includes(id)||!r||!['Not assessed','In progress','Gap identified','Evidence reviewed'].includes(r.status))throw Error('Invalid governance status.');for(const k of ['owner','evidence','note'])string(r[k],'governance '+k);date(r.due,'governance due',true);date(r.updated,'governance updated');if(r.status==='Evidence reviewed'&&(!r.owner.trim()||!r.evidence.trim()||!r.note.trim()))throw Error('Reviewed governance records need owner, evidence and notes.');}
 const refs=new Set(s.risks.map(r=>r.id));
 unique(s.risks);unique(s.controls);unique(s.actions);unique(s.events);unique(s.indicators);
 s.risks.forEach(r=>{for(const k of ['id','title','category','hub','objective','cause','event','consequence','owner','horizon','response','appetiteText','basis'])string(r[k],k);for(const k of ['il','ii','rl','ri','tl','ti'])if(!Number.isInteger(Number(r[k]))||Number(r[k])<1||Number(r[k])>5)throw Error('Risk likelihood and impact values must be 1–5.');if(!['Low','Moderate','High','Critical'].includes(r.appetiteBand))throw Error('Invalid appetite band.');for(const k of ['financial','operational','regulatory','reputation'])if(!Number.isInteger(Number(r[k]))||r[k]<1||r[k]>5)throw Error('Invalid impact domain.');if(Number(r.ri)!==Math.max(r.financial,r.operational,r.regulatory,r.reputation))throw Error('Residual impact must be the highest of the four domains.');for(const k of ['framework','treatment','acceptor','approvalRef','seniorApprover','seniorApprovalRef','service','serviceRef','lossBasis'])string(r[k],k);if(!['Mitigate','Transfer','Avoid','Accept'].includes(r.treatment))throw Error('Invalid treatment.');for(const k of ['frequency','loss'])if(r[k]!==null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0))throw Error('Invalid annual loss assumptions.');date(r.acceptedDate,'acceptance date',true);date(r.seniorDate,'senior approval date',true);if(!['Open','Closed'].includes(r.status)||!['O1','O2','O3','O4'].includes(r.objective)||typeof r.validated!=='boolean')throw Error('Invalid risk state or objective.');date(r.review,'review');date(r.updated,'updated');});
 s.controls.forEach(c=>{for(const k of ['id','title','risk','owner','evidence','url','basis'])string(c[k],k);if(!refs.has(c.risk))throw Error('Control has an unknown risk.');if(!['Effective','Partly effective','Ineffective','Untested'].includes(c.status))throw Error('Invalid control status.');date(c.tested,'test date',true);date(c.due,'due date');});
 s.actions.forEach(a=>{for(const k of ['id','title','risk','owner','note'])string(a[k],k);if(!refs.has(a.risk))throw Error('Action has an unknown risk.');if(!['Open','In progress','Complete'].includes(a.status)||!['Critical','High','Medium','Low'].includes(a.priority))throw Error('Invalid action state.');date(a.created,'created');date(a.due,'due');date(a.completed,'completed',true);if(a.status==='Complete'&&!a.completed)throw Error('Completed action needs a completion date.');if(a.completed&&a.completed<a.created)throw Error('Completion precedes creation.');});
 s.events.forEach(e=>{for(const k of ['id','title','lane','hub','detail','source'])string(e[k],k);date(e.start,'event start');date(e.end,'event end');if(e.end<e.start)throw Error('Event ends before it starts.');if(!Array.isArray(e.risks)||e.risks.some(id=>!refs.has(id)))throw Error('Event has an unknown risk.');if(!['Published','Conditional','Proposed','Documented'].includes(e.type)||!['Planned','In progress','Completed','To confirm'].includes(e.status))throw Error('Invalid event state.');});
 s.indicators.forEach(k=>{for(const f of ['id','title','risk','owner','unit','basis','note'])string(k[f],f);if(!refs.has(k.risk)||!['Above','Below'].includes(k.direction))throw Error('Invalid indicator link or trigger.');if(k.value!==null&&(typeof k.value!=='number'||!Number.isFinite(k.value)))throw Error('Invalid indicator reading.');if(typeof k.threshold!=='number'||!Number.isFinite(k.threshold))throw Error('Invalid indicator threshold.');date(k.observed,'indicator date',true);});
 unique(s.oras);unique(s.findings);if(s.indicatorHistory.length>10000||s.reports.length>50||s.imports.length>100)throw Error('Assurance history exceeds the supported limit.');
 for(const r of [...s.oras,...s.findings]){for(const k of ['id','title','risk','owner','hub','barrier','evidence'])string(r[k],k);if(!refs.has(r.risk))throw Error('Unknown assurance risk link.');}
 s.oras.forEach(r=>{date(r.opened,'ORA opened');date(r.review,'ORA review');date(r.expires,'ORA expiry',true);date(r.closed,'ORA closed',true);if(!['Active','Closed','Cancelled'].includes(r.status)||!Number.isInteger(r.extensions)||r.extensions<0||r.status==='Closed'&&!r.closed)throw Error('Invalid ORA state.');string(r.controls,'ORA controls');g.RCC_OD.valid(r);});
 s.findings.forEach(r=>{date(r.reported,'finding reported');date(r.due,'finding due');date(r.closed,'finding closed',true);if(!['Open','Closed'].includes(r.status)||!['Critical','High','Medium','Low','Unclassified'].includes(r.significance)||typeof r.repeat!=='boolean'||!['Planned','Implemented','Verified effective','Sustained'].includes(r.maturity)||r.status==='Closed'&&!r.closed)throw Error('Invalid finding state.');});
 s.indicatorHistory.forEach(k=>{string(k.id,'historical indicator ID');date(k.observed,'historical observation');if(typeof k.value!=='number'||!Number.isFinite(k.value))throw Error('Invalid historical reading.');});
 s.imports.forEach(x=>{for(const k of ['at','file','type'])string(x[k],k);if(!Number.isInteger(x.count)||x.count<0)throw Error('Invalid import record.');});
 s.reports.forEach(x=>{for(const k of ['id','file','text','at','risk','note'])string(x[k],k,k==='text'?120000:20000);if(x.risk&&!refs.has(x.risk))throw Error('Unknown report risk link.');});
 s.deviationHistory.forEach(h=>{string(h.id,'deviation history ID');string(h.at,'revision timestamp');string(h.reason,'revision reason');if(!h.record||typeof h.record!=='object')throw Error('Invalid deviation revision.');g.RCC_OD.valid(h.record);});if(s.deviationHistory.length>1000)throw Error('Too many deviation revisions.');
 s.actions.forEach(a=>{for(const k of ['deviationId','actionType','recurring','nextRepeatAt','lastDoneAt'])if(a[k]!==undefined)string(a[k],k);for(const k of ['nextRepeatAt','lastDoneAt'])if(a[k])g.RCC_OD.instant(a[k],k);if(a.deviationId&&!s.oras.some(x=>x.id===a.deviationId))throw Error('Unknown action deviation.');if(a.actionType!==undefined&&!['Not classified','Investigate','Monitor','Mitigate','Communicate','Resolve'].includes(a.actionType))throw Error('Invalid action type.');if(a.recurring!==undefined&&!['Not recorded','Yes','No'].includes(a.recurring))throw Error('Invalid recurring action.');if(a.repeatIntervalHours!==undefined&&a.repeatIntervalHours!==null&&(!Number.isFinite(a.repeatIntervalHours)||a.repeatIntervalHours<=0))throw Error('Invalid recurrence interval.');if(a.maturity!==undefined&&!['Planned','Implemented','Verified effective','Sustained'].includes(a.maturity))throw Error('Invalid action maturity.');});
 g.RCC_AGG.validate(s);
 g.RCC_MATRIX.validate(s);
 if(!s.scenario||!s.board||typeof s.board!=='object'||Array.isArray(s.board))throw Error('Missing reporting data.');
 string(s.scenario.name,'scenario name');
 for(const k of ['production','days','margin','extraCapex','availableCash','buffer'])if(typeof s.scenario[k]!=='number'||!Number.isFinite(s.scenario[k])||s.scenario[k]<0||s.scenario[k]>1e8)throw Error('Invalid scenario assumptions.');
 if(s.snapshots.length>100)throw Error('Maximum 100 snapshots per backup.');
 for(const b of Object.values(s.board)){if(!b||typeof b!=='object')throw Error('Invalid report');for(const k of ['what','so','now','decisions','prepared','reviewer','reviewDate','status'])if(b[k]!==undefined)string(b[k],k);}
 for(const x of s.snapshots){if(!x||!/^\d{4}-(0[1-9]|1[0-2])$/.test(x.month)||!Array.isArray(x.risks)||!Array.isArray(x.controls)||!Array.isArray(x.actions)||!Array.isArray(x.events)||!x.board||!x.scenario||!Number.isInteger(x.revision)||typeof x.id!=='string'||typeof x.created!=='string')throw Error('Invalid monthly snapshot.');const copy={...s,oras:[],findings:[],indicatorHistory:[],reports:[],imports:[],deviationHistory:[],aggregates:[],triangulations:[],matrixAssessments:[],...x,snapshots:[],audit:[],board:{[x.month]:x.board}};validate(copy);date(x.cutoff,'snapshot cutoff');if(x.odEvaluation)g.RCC_OD.validEvaluation(x.odEvaluation);if(x.matrixEvaluation)g.RCC_MATRIX.validEvaluation(x.matrixEvaluation);if(x.cutoffAt)g.RCC_OD.instant(x.cutoffAt,'Snapshot cutoff');}
 return s;
};
const csvCell=v=>{let s=String(v??'');if(/^[\t\r]|^\s*[=+@\-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
g.RCC={clone,score,impact,bandAt,band,bandRank,outside,grade,cyberSummary,isOverdue,controlState,indicatorState,observationTrend,assuranceSummary,actionOpen,metrics,monthEnd,priorMonth,addDays,windowEvents,scenario,movement,latestPrior,validate,csvCell};
})(typeof window!=='undefined'?window:globalThis);

/* Meaningful non-browser checks for report calculations, persistence and export. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const root=__dirname+'/docs/';
const fixed='2026-10-16T21:05:00Z';
class FixedDate extends Date{constructor(...v){super(...(v.length?v:[fixed]));}static now(){return Date.parse(fixed);}}
function harness(saved){
 const nodes=new Map(),listeners={},downloads=[],data=new Map(saved?[['operator-anonymous-demo-v1',JSON.stringify(saved)]]:[]);
 const node=sel=>{if(!nodes.has(sel))nodes.set(sel,{id:sel.replace('#',''),innerHTML:'',textContent:'',value:'',open:false,classList:{add(){},remove(){}},focus(){},setSelectionRange(){},showModal(){this.open=true;},close(){this.open=false;},addEventListener(type,fn){this[type]=fn;},append(){},remove(){},click(){if(this.download)downloads.push({name:this.download,url:this.href});}});return nodes.get(sel);};
 let lastBlob;
 const document={querySelector:node,addEventListener(type,fn){(listeners[type]??=[]).push(fn);},createElement(){return {remove(){},click(){downloads.push({name:this.download,blob:lastBlob});}};},body:{append(){}}};
 class FakeFormData{constructor(form){this.map=new Map(Object.entries(form.values||{}));}entries(){return this.map.entries();}has(k){return this.map.has(k);}}
 const url=class extends URL{};url.createObjectURL=b=>{lastBlob=b;return 'blob:test';};url.revokeObjectURL=()=>{};
 const window={scrollTo(){},addEventListener(){},print(){window.printed=true;}};
 const ctx=vm.createContext({window,document,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},location:{hash:''},Date:FixedDate,Intl,console,setTimeout:()=>0,clearTimeout(){},FormData:FakeFormData,crypto,URL:url,Blob});
 for(const file of ['matrix-engine.js','data.js','od-engine.js','aggregation-engine.js','engine.js','analysis-ui.js','matrix-ui.js','import-engine.js']){vm.runInContext(fs.readFileSync(root+file,'utf8'),ctx);if(file==='od-engine.js')ctx.RCC_OD=window.RCC_OD;}
 ctx.RCC_MATRIX=window.RCC_MATRIX;ctx.RCC_MATRIX_UI=window.RCC_MATRIX_UI;ctx.RCC_ANALYSIS_UI=window.RCC_ANALYSIS_UI;ctx.RCC_AGG=window.RCC_AGG;ctx.RCC=window.RCC;ctx.RCC_SEED=window.RCC_SEED;ctx.RCC_IMPORT=window.RCC_IMPORT;
 vm.runInContext(fs.readFileSync(root+'app.js','utf8').replace(/\}\)\(\);\s*$/, 'window.__RCC_TEST={readDrop,stageDrop,commitDrop,undoImport,setImport:v=>{drop={...drop,...v}},getImport:()=>drop,getState:()=>E.clone(state),odEvaluation,editDeviation,reassessDeviation};})();'),ctx);
 return {ctx,node,downloads,data,window,html:()=>node('#app').innerHTML,click:(id,dataset={})=>listeners.click.forEach(fn=>fn({target:{closest:()=>({id,dataset})}})),change:(id,value)=>listeners.change.forEach(fn=>fn({target:{id,value}})),submit:values=>node('#edit-form').onsubmit({preventDefault(){},target:{values}}),scenario:values=>listeners.submit.forEach(fn=>fn({preventDefault(){},target:{id:'scenario-form',values}})),saved:()=>JSON.parse(data.get('operator-anonymous-demo-v1'))};
}
async function run(){
 const h=harness(),E=h.ctx.RCC,seed=h.ctx.RCC_SEED;
 E.validate(E.clone(seed));
 const bands=['Purple','Dark Blue','Light Blue','White'];
 const expected={A:['Purple','Purple','Purple','Purple','Purple','Purple','Purple','Purple'],B:['Purple','Purple','Purple','Purple','Purple','Purple','Purple','Purple'],C:['Purple','Purple','Purple','Purple','Purple','Purple','Purple','Purple'],D:['White','White','Dark Blue','Dark Blue','Dark Blue','Purple','Purple','Purple'],E:['White','White','White','Dark Blue','Dark Blue','Dark Blue','Dark Blue','Dark Blue'],F:['White','White','White','White','Light Blue','Light Blue','Light Blue','Light Blue'],G:['White','White','White','White','White','Light Blue','Light Blue','Light Blue'],H:['White','White','White','White','White','White','Light Blue','Light Blue']};
 for(let impact=1;impact<=8;impact++)for(let likelihood=1;likelihood<=8;likelihood++)assert.equal(E.bandAt(likelihood,impact),expected[E.impact(impact)][likelihood-1],'OMS matrix cell');
 assert.equal(E.cyberSummary(seed).elevated.length,1);assert.equal(E.cyberSummary(seed).quantified.length,0);
 const quantified=E.clone(seed);Object.assign(quantified.risks.find(r=>r.id==='R08'),{frequency:0.1,loss:20000000});assert.equal(E.cyberSummary(quantified).total,2000000);

 assert.equal(E.score(seed.risks[0]),32);
 const m=E.metrics(seed,'2026-10-16');
 assert.equal(m.openRisks,14);assert.equal(m.overdue,1);assert.equal(m.assured,3);assert.equal(m.exceptions,11);
 assert.equal(E.monthEnd('2028-02'),'2028-02-29');assert.equal(E.priorMonth('2027-01'),'2026-12');
 assert.equal(E.isOverdue('2026-10-16','2026-10-16'),false);
 const action={created:'2026-09-01',completed:'2026-10-20'};
 assert.equal(E.actionOpen(action,'2026-10-16'),true);assert.equal(E.actionOpen(action,'2026-10-20'),false);
 assert.equal(E.actionOpen({created:'2026-11-01',completed:''},'2026-10-16'),false);
 assert.equal(E.controlState({tested:'2026-08-01',status:'Effective',due:'2026-12-01'},'2026-10-16'),'Evidence stale');
 assert.equal(E.controlState({tested:'2026-10-01',status:'Effective',due:'2026-10-15'},'2026-10-16'),'Verification overdue');
 assert.equal(E.controlState({tested:'2026-10-17',status:'Effective',due:'2026-11-15'},'2026-10-16'),'Not tested at cutoff');
 assert.equal(E.indicatorState(seed.indicators[0],'2026-10-16'),'No reading');
 assert.equal(E.indicatorState({...seed.indicators[0],value:1,observed:'2026-10-15'},'2026-10-16'),'Trigger breached');
 assert.equal(E.indicatorState({...seed.indicators[0],value:0,observed:'2026-10-15'},'2026-10-16'),'Within trigger');
 assert.equal(E.scenario(seed.scenario).draw,25.75);assert.equal(E.scenario(seed.scenario).bufferGap,14.25);
 assert.ok(E.csvCell(' =SUM(A1)').startsWith('"\''));
 for(const [id,title] of [['overview','Risk Control Centre'],['strategy','The operating plan behind the risks'],['risks','Understand the exposure'],['assurance','Control assurance'],['timeline','The timing of exposure'],['scenarios','Cumulative risk'],['cyber','Cyber governance'],['board','The board view'],['basis','Using the centre'],['imports','Data drop & review'],['evidence','Operational evidence'],['deviations','Operational deviations']]){h.click('',{nav:id});assert.ok(h.html().includes(title),'renders '+id);assert.ok(!h.html().includes('undefined'),'no undefined in '+id);}
 h.click('',{nav:'assurance'});h.click('',{tab:'indicators'});assert.ok(h.html().includes('Not recorded'));
 h.click('',{nav:'board'});h.click('freeze-board');let saved=h.saved();assert.equal(saved.snapshots.length,1);E.validate(saved);
 const frozenTitle=saved.snapshots[0].risks[0].title;
 h.click('',{nav:'risks'});h.click('',{editRisk:'R01'});
 const r={...saved.risks[0],title:'Revised working risk',basis:'Working'};delete r.validated;
 h.submit(r);saved=h.saved();assert.equal(saved.risks[0].title,'Revised working risk');assert.equal(saved.snapshots[0].risks[0].title,frozenTitle);
 h.click('',{nav:'board'});h.click('',{snapshot:saved.snapshots[0].id});assert.ok(h.html().includes(frozenTitle));assert.ok(!h.html().includes('Revised working risk'));
 h.click('word-board');const word=h.downloads.at(-1);assert.ok(word.name.endsWith('_r1.doc'));const text=await word.blob.text();assert.ok(text.includes(frozenTitle));assert.ok(text.includes('No prior-month baseline'));assert.ok(text.includes('Not recorded'));
 h.click('print-board');assert.ok(h.window.printed);assert.ok(h.node('#print-output').innerHTML.includes('Principal exposures'));
 h.change('board-month','2026-09');assert.ok(h.html().includes('Historical reconstruction'));h.click('freeze-board');saved=h.saved();assert.equal(saved.snapshots.length,2);E.validate(saved);
 h.change('board-month','2026-10');assert.ok(h.html().includes('Previous-month snapshot available'));h.click('freeze-board');const frozenWithPrior=h.saved().snapshots.at(-1);assert.equal(frozenWithPrior.comparison.month,'2026-09');h.change('board-month','2026-09');h.click('freeze-board');h.click('',{snapshot:frozenWithPrior.id});assert.ok(h.html().includes('September 2026, revision 1'));
 h.click('',{nav:'scenarios'});h.scenario({name:'Test stress',production:'10000',days:'20',margin:'30',extraCapex:'2',availableCash:'10',buffer:'5'});saved=h.saved();assert.equal(E.scenario(saved.scenario).bufferGap,-3);assert.ok(h.html().includes('Below illustrative planning buffer'));
 h.click('',{nav:'assurance'});h.click('',{editAction:'A01'});h.submit({...saved.actions[0],status:'Complete',completed:'2026-10-16',note:'Evidence checked'});saved=h.saved();assert.equal(E.metrics(saved,'2026-10-16').overdue,0);assert.equal(E.metrics(saved,'2026-10-15').overdue,1);
 h.click('',{editIndicator:'K01'});h.submit({...saved.indicators[0],value:'2',threshold:'0',observed:'2026-10-16',basis:'Working'});saved=h.saved();assert.equal(E.indicatorState(saved.indicators[0],'2026-10-16'),'Trigger breached');
 h.click('',{nav:'risks'});h.click('export-csv');assert.ok((await h.downloads.at(-1).blob.text()).includes('Revised working risk'));
 h.click('',{nav:'basis'});h.click('export-backup');const backup=JSON.parse(await h.downloads.at(-1).blob.text());E.validate(backup);assert.equal(backup.snapshots.length,4);
 const reloaded=harness(backup);reloaded.click('',{nav:'risks'});assert.ok(reloaded.html().includes('Revised working risk'));
 reloaded.click('',{editRisk:'R08'});const cyberRisk={...backup.risks.find(r=>r.id==='R08'),treatment:'Accept',operational:8,basis:'Working'};delete cyberRisk.validated;reloaded.submit(cyberRisk);assert.ok(reloaded.node('#toast').textContent.includes('sign-off'));cyberRisk.acceptor='Owner';cyberRisk.acceptedDate='2026-10-16';cyberRisk.approvalRef='Record 1';reloaded.submit(cyberRisk);assert.ok(reloaded.node('#toast').textContent.includes('Senior Management/Board'));cyberRisk.seniorApprover='Executive';cyberRisk.seniorDate='2026-10-16';cyberRisk.seniorApprovalRef='Decision 1';reloaded.submit(cyberRisk);assert.equal(reloaded.saved().risks.find(r=>r.id==='R08').ri,8);
 const broken=E.clone(seed);broken.risks[0].rl=9;assert.throws(()=>E.validate(broken));
 const badId=E.clone(seed);badId.risks[0].id='<img>';assert.throws(()=>E.validate(badId));
 const badRef=E.clone(seed);badRef.controls[0].risk='R999';assert.throws(()=>E.validate(badRef));
 console.log('PASS: all 64 source-matrix cells, four-domain impact, acceptance gates, ALE, frozen comparison baselines, scoring, monthly cutoffs, evidence freshness, indicators, all views, snapshot isolation, Word/print/CSV/JSON exports, reload and invalid-backup rejection.');
 console.log('Browser rendering and browser download compatibility were not exercised; no managed browser capability is available.');
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={harness};

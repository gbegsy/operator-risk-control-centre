/* Meaningful non-browser checks for report calculations, persistence and export. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const root=__dirname+'/docs/';
const fixed='2026-10-16T21:05:00Z';
class FixedDate extends Date{constructor(...v){super(...(v.length?v:[fixed]));}static now(){return Date.parse(fixed);}}
function harness(saved){
 const nodes=new Map(),listeners={},downloads=[],data=new Map(saved?[['operator-generic-5x5-v3',JSON.stringify(saved)]]:[]);
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
 return {ctx,node,downloads,data,window,html:()=>node('#app').innerHTML,click:(id,dataset={})=>listeners.click.forEach(fn=>fn({target:{closest:()=>({id,dataset})}})),change:(id,value)=>listeners.change.forEach(fn=>fn({target:{id,value}})),submit:values=>node('#edit-form').onsubmit({preventDefault(){},target:{values}}),scenario:values=>listeners.submit.forEach(fn=>fn({preventDefault(){},target:{id:'scenario-form',values}})),saved:()=>JSON.parse(data.get('operator-generic-5x5-v3'))};
}
async function run(){
 const h=harness(),E=h.ctx.RCC,seed=h.ctx.RCC_SEED;E.validate(E.clone(seed));assert.equal(seed.version,3);
 for(let l=1;l<=5;l++)for(let i=1;i<=5;i++){const n=l*i;assert.equal(E.bandAt(l,i),n>=20?'Critical':n>=10?'High':n>=5?'Moderate':'Low');assert.equal(E.bandAt(l,i),h.ctx.RCC_MATRIX.cell('Generic',i,l).band);}
 assert.equal(E.metrics(seed,'2026-10-16').openRisks,14);assert.equal(E.metrics(seed,'2026-10-16').overdue,1);assert.equal(E.metrics(seed,'2026-10-16').assured,3);
 assert.equal(E.monthEnd('2028-02'),'2028-02-29');assert.equal(E.priorMonth('2027-01'),'2026-12');assert.equal(E.scenario(seed.scenario).draw,25.75);
 assert.equal(E.controlState({tested:'2026-08-01',status:'Effective',due:'2026-12-01'},'2026-10-16'),'Evidence stale');assert.equal(E.indicatorState(seed.indicators[0],'2026-10-16'),'No reading');
 for(const id of ['overview','assets','executive','board','strategy','risks','assurance','matrices','deviations','evidence','analysis','imports','timeline','scenarios','cyber','basis']){h.click('',{nav:id});assert.ok(h.html().length>100,id);assert.doesNotMatch(h.html(),/undefined|Invalid Date/,id);}
 h.click('',{nav:'board'});h.click('freeze-board');const saved=h.saved();E.validate(saved);assert.equal(saved.snapshots.length,1);h.click('word-board');assert.match(await h.downloads.at(-1).blob.text(),/Generic 5×5/);h.click('print-board');assert.match(h.node('#print-output').innerHTML,/Board agenda/);
 h.click('export-backup');const backup=JSON.parse(await h.downloads.at(-1).blob.text());E.validate(backup);const again=harness(backup);again.click('',{nav:'board'});assert.match(again.html(),/revision 1/);
 const old=E.clone(seed);old.version=2;assert.throws(()=>E.validate(old),/generic 5x5/);const bad=E.clone(seed);bad.risks[0].rl=6;assert.throws(()=>E.validate(bad));
 console.log('PASS: 25 generic cells, consistent enterprise/operational bands, all 16 views, metrics, evidence freshness, scenario, immutable snapshot, Word/print/backup/reload and legacy-schema rejection.');
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={harness};

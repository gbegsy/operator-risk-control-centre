const {harness}=require('./checks.cjs');
const assert=require('node:assert/strict');
(async()=>{
const h=harness();h.click('',{nav:'governance'});assert.match(h.html(),/Main Market governance readiness/);assert.equal((h.html().match(/data-governance=/g)||[]).length,7);assert.match(h.html(),/0 of 7/);
h.click('',{governance:'material'});h.submit({status:'Evidence reviewed',owner:'CFO',due:'2026-11-01',evidence:'',note:''});assert.equal(h.window.__RCC_TEST.getState().governance.material,undefined);
h.submit({status:'Evidence reviewed',owner:'CFO',due:'2026-11-01',evidence:'TEST-001',note:'Synthetic review; coverage gaps remain'});assert.match(h.html(),/1 of 7/);assert.equal(h.saved().governance.material.evidence,'TEST-001');
h.click('',{nav:'board'});h.click('freeze-board');assert.equal(h.saved().snapshots[0].governance.material.evidence,'TEST-001');
h.click('',{nav:'governance'});h.click('',{governance:'material'});h.submit({status:'Gap identified',owner:'CFO',due:'2026-11-01',evidence:'TEST-002',note:'Retest required'});assert.equal(h.saved().snapshots[0].governance.material.evidence,'TEST-001');h.click('',{nav:'board'});h.click('',{snapshot:h.saved().snapshots[0].id});h.click('word-board');assert.match(await h.downloads.at(-1).blob.text(),/1 of 7/);
const restored=harness(h.saved());restored.click('',{nav:'governance'});assert.match(restored.html(),/Retest required/);const bad=restored.window.__RCC_TEST.getState();bad.governance.scope={status:'Compliant'};assert.throws(()=>restored.ctx.RCC.validate(bad));
console.log('PASS: seven governance workstreams, incomplete-review guard, persistence, snapshot isolation, board export, reload and invalid-record rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});

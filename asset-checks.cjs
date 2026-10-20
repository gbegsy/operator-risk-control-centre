const assert=require('node:assert/strict');
const fs=require('node:fs');
const {harness}=require('./checks.cjs');
const h=harness();
h.click('',{nav:'assets'});
assert.match(h.html(),/Asset Bravo/);assert.match(h.html(),/92% planned maintenance/);
for(const name of ['Asset Alpha','Asset Bravo','Asset Charlie','Asset Delta']){
 h.click('',{asset:name});assert.match(h.html(),new RegExp(name));assert.match(h.html(),/Critical control evidence/);assert.match(h.html(),/Actions requiring follow-through/);assert.doesNotMatch(h.html(),/undefined|Invalid Date/);
}
h.click('print-asset');assert.match(h.node('#print-output').innerHTML,/Asset Delta/);assert.equal(h.window.printed,true);
h.click('',{nav:'board'});assert.match(h.html(),/Asset-to-board line of sight/);assert.match(h.html(),/do not sum/);
h.click('word-board');assert.ok(h.downloads.some(x=>x.name.endsWith('.doc')));
for(const name of fs.readdirSync('docs').filter(x=>/\.(js|html)$/.test(x))) assert.doesNotMatch(fs.readFileSync('docs/'+name,'utf8'),/serica|garry begg|bruce|triton|tailwind|spirit-energy|OMS-[12]/i,name);
console.log('PASS: four asset views, scoped risk/control/action rendering, asset print, asset-to-board traceability, Word export and company-identity scan.');

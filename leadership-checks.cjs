const assert=require('node:assert/strict');
const {harness}=require('./checks.cjs');
(async()=>{
 const h=harness();h.click('',{nav:'executive'});
 assert.match(h.html(),/Executive leadership/);assert.match(h.html(),/competing resources|resource trade-offs/);assert.match(h.html(),/Missing evidence is an uncertainty/);assert.doesNotMatch(h.html(),/undefined|Invalid Date/);
 h.click('word-executive');const doc=await h.downloads.at(-1).blob.text();assert.match(doc,/EXECUTIVE LEADERSHIP/);assert.match(doc,/CFO \/ project sponsors/);assert.match(doc,/Critical restoration tests overdue/);
 h.click('print-executive');assert.equal(h.window.printed,true);assert.match(h.node('#print-output').innerHTML,/Management intervention pack/);
 h.click('',{nav:'board'});assert.match(h.html(),/Board agenda: three distinct asks/);assert.match(h.html(),/reserved to the board/);assert.match(h.html(),/Candidate principal exposures/);
 h.click('freeze-board');const frozen=h.saved(),snap=frozen.snapshots[0];
 h.click('',{nav:'assurance'});const c=frozen.controls[0];h.click('',{editControl:c.id});h.submit({...c,evidence:'New independent verification reference',basis:'Working'});
 h.click('',{nav:'executive'});assert.match(h.html(),/New independent verification reference/);
 h.click('',{nav:'board'});h.click('',{snapshot:snap.id});h.click('word-board');const board=await h.downloads.at(-1).blob.text();assert.match(board,/BOARD \/ COMMITTEE/);assert.doesNotMatch(board,/New independent verification reference/);
 assert.match(board,/No independent assurance opinion is recorded/);assert.match(board,/No saved snapshot exists/);
 const bad=h.window.__RCC_TEST.getState();bad.controls[0].evidence='<script>unexpected()</script>';const safe=harness(bad);safe.click('',{nav:'executive'});assert.doesNotMatch(safe.html(),/<script>unexpected/);assert.match(safe.html(),/&lt;script&gt;/);
 console.log('PASS: executive Word/print, audience decision boundaries, shared control evidence, frozen board isolation, absent trend handling and HTML escaping.');
})().catch(e=>{console.error(e);process.exitCode=1});

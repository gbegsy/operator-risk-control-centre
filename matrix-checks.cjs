const assert=require('node:assert/strict');
const {harness}=require('./checks.cjs');
async function run(){
 const h=harness(),M=h.ctx.RCC_MATRIX,E=h.ctx.RCC;
 const expected={A:'PPPPPPPP',B:'PPPPPPPP',C:'PPPPPPPP',D:'WWBBBPPP',E:'WWWBBBBB',F:'WWWWTTTT',G:'WWWWWTTT',H:'WWWWWWTT'};
 const band={P:'Purple',B:'Blue',T:'Turquoise',W:'White'};
 const red={A:[3,4,5,6,7,8],B:[4,5,6,7,8],C:[5,6,7,8],D:[6,7,8],E:[7,8],F:[8],G:[],H:[]};
 for(const i of 'ABCDEFGH')for(let f=1;f<=8;f++){
  assert.equal(M.cell('Generic',i,f).band,band[expected[i][f-1]],'generic '+i+f);
  assert.equal(M.cell('Health and safety',i,f).band,red[i].includes(f)?'Red':band[expected[i][f-1]],'H&S '+i+f);
  assert.equal(M.cell('Generic',i,f).ordinal,'HGFEDCBA'.indexOf(i)+f);
 }
 const cow={D:['Asset Manager','Asset Manager','Do not proceed','Do not proceed','Do not proceed'],E:['OIM','Asset Manager','Asset Manager','Do not proceed','Do not proceed'],F:['AA','OIM','OIM','OIM','Do not proceed'],G:['AA','AA','OIM','OIM','OIM'],H:['AA','AA','AA','AA','AA']};
 for(const i of 'ABCDEFGH')for(let f=1;f<=8;f++)assert.equal(M.cell('Control of Work',i,f).decision,cow[i]?.[f-4]||'Outside defined Level 2 subset');
 assert.equal(M.cell('Generic','A',1).decision,'COO');assert.ok(M.roles(M.cell('Generic','A',1),'Generic').lower.includes('Asset Manager'));
 assert.equal(M.cell('Health and safety','A',3).stop,true);assert.equal(M.cell('Health and safety','A',2).stop,false);assert.equal(M.cell('Generic','A',3).stop,false);
 assert.equal(M.coordinate(' d6 ').coordinate,'D6');assert.equal(M.coordinate('D9'),null);assert.equal(M.cell('Generic','D',9),null);
 h.click('',{nav:'matrices'});assert.ok(h.html().includes('Operational risk matrices'));h.click('',{matrixProfile:'Health and safety'});h.click('',{matrixCell:'D6'});assert.ok(h.html().includes('Risk may be intolerable'));h.click('',{matrixProfile:'Control of Work'});h.click('',{matrixCell:'F4'});assert.ok(h.html().includes('<h3>AA</h3>'));
 const record={title:'Detection impairment',risk:'R01',deviationId:'',profile:'Health and safety',context:'Abnormal condition',basis:'Initial / abnormal',initial:'D6',residual:'F2',overrideRef:'',rationale:'Safety Case scenario and degraded barrier evidence',sourceRef:'RA 1',roleMappingRef:'Controlled organisation map',deviationRaRef:'',recommendEvidence:'',agreeEvidence:'',performEvidence:'',inputEvidence:'',decideEvidence:'',lowerEvidence:'',oimEvidence:'',material:'Yes',escalationRef:'COO / Board review recorded',owner:'Asset owner',status:'Active',assessedOn:'2026-10-16',review:'2026-11-01'};
 h.click('',{matrixEdit:'new'});h.submit(record);let s=h.saved();assert.equal(s.matrixAssessments.length,1);let a=s.matrixAssessments[0];assert.ok(M.assess(a,s,'2026-10-16').issues.some(x=>x.code==='stop'));E.validate(s);
 h.click('',{nav:'board'});h.click('freeze-board');s=h.saved();let snap=s.snapshots[0];assert.equal(snap.matrixEvaluation.cases[0].band,'Red');assert.equal(snap.matrixAssessments[0].initial,'D6');h.click('word-board');assert.ok((await h.downloads.at(-1).blob.text()).includes('D6'));
 h.click('',{nav:'matrices'});h.click('',{matrixEdit:a.id});h.submit({...record,initial:'D5'});s=h.saved();assert.equal(s.matrixAssessments[0].initial,'D5');assert.equal(s.snapshots[0].matrixEvaluation.cases[0].band,'Red','frozen interpretation does not change');
 const reload=harness(s);reload.click('',{nav:'matrices'});assert.ok(reload.html().includes('D5'));reload.click('',{nav:'board'});reload.click('',{snapshot:snap.id});assert.ok(reload.html().includes('D6'));
 const old=E.clone(s);delete old.snapshots[0].matrixEvaluation;delete old.snapshots[0].matrixAssessments;const oldView=harness(old);oldView.click('',{nav:'board'});oldView.click('',{snapshot:snap.id});assert.ok(oldView.html().includes('no frozen DEMO-MATRIX assessment'));
 const changed=E.clone(s);const r=changed.matrixAssessments[0];r.profile='Generic';r.initial='D6';r.material='No';const checks=M.assess(r,changed,'2026-10-16');assert.equal(checks.decision,'COO');assert.ok(checks.issues.some(x=>x.code==='approval-lower'));
 Object.assign(r,{recommendEvidence:'Team dated reference',agreeEvidence:'VPs + Assurance',performEvidence:'Manager',inputEvidence:'TA',decideEvidence:'COO',lowerEvidence:'Asset Manager and Blue route'});assert.equal(M.assess(r,changed,'2026-10-16').issues.length,0);
 r.context='Planned activity';r.basis='Initial / abnormal';assert.ok(M.assess(r,changed,'2026-10-16').issues.some(x=>x.code==='basis'));r.overrideRef='Governing procedure exception';assert.ok(!M.assess(r,changed,'2026-10-16').issues.some(x=>x.code==='basis'));
 const legacy=E.clone(h.ctx.RCC_SEED);delete legacy.matrixAssessments;E.validate(legacy);assert.equal(legacy.matrixAssessments.length,0);
 const bad=E.clone(s);bad.matrixAssessments[0].initial='D99';assert.throws(()=>E.validate(bad));bad.matrixAssessments[0].initial='D5';bad.matrixAssessments[0].risk='UNKNOWN';assert.throws(()=>E.validate(bad));
 const d=h.ctx.RCC_OD.normalise({id:'OD1',title:'Deviation',risk:'R01',opened:'2026-10-10',raRef:'RA2',raAt:'2026-10-15T10:00:00Z',abnormalRisk:'D6',status:'Active'});changed.oras=[d];Object.assign(r,{deviationId:'OD1',context:'Abnormal condition',basis:'Initial / abnormal',deviationRaRef:'RA1'});let issues=M.assess(r,changed,'2026-10-16').issues;assert.ok(issues.some(x=>x.code==='revision'));assert.ok(issues.some(x=>x.code==='oim'));r.deviationRaRef='RA2';r.oimEvidence='Source OIM';assert.ok(!M.assess(r,changed,'2026-10-16').issues.some(x=>x.code==='revision'));
 const backup=E.clone(s);backup.snapshots[0].matrixEvaluation.cases[0].decision='<img src=x onerror=alert(1)>';E.validate(backup);const escaped=harness(backup);escaped.click('',{nav:'board'});escaped.click('',{snapshot:snap.id});assert.ok(!escaped.html().includes('<img src=x'));assert.ok(escaped.html().includes('&lt;img'));
 console.log('PASS: 128 generic/H&S cells, 64 CoW routes, red boundaries, additive approvals, native assessment save/reload, linked deviation revision/OIM checks, old backups, frozen board/Word output and escaped imported text.');
}
run().catch(e=>{console.error(e);process.exitCode=1});

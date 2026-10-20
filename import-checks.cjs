const assert=require('node:assert/strict');
const {harness}=require('./checks.cjs');
const JSZip=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip');
const {xml2js}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/xml-js');
/* A test-only DOM adapter exercises the actual XLSX reader without a browser. */
class XNode{
 constructor(value){this.v=value;}
 getAttribute(k){return this.v.attributes?.[k]??null;}
 getAttributeNS(ns,k){return this.v.attributes?.['r:'+k]??this.getAttribute(k);}
 get textContent(){return this.v.text||this.v.cdata||(this.v.elements||[]).map(x=>new XNode(x).textContent).join('');}
 getElementsByTagNameNS(ns,name){const out=[];const walk=n=>{for(const x of n.elements||[]){if(x.type==='element'){if(x.name.split(':').at(-1)===name)out.push(new XNode(x));walk(x);}}};walk(this.v);return out;}
 querySelector(){return null;}
}
class XMLParser{parseFromString(s){return new XNode(xml2js(s));}}
const file=(name,text)=>({name,size:Buffer.byteLength(text),text:async()=>text});
async function run(){
 const h=harness(),api=h.window.__RCC_TEST,I=h.ctx.RCC_IMPORT,E=h.ctx.RCC;
 assert.equal(I.parseCSV('a,b\r\n"one, two","line 1\nline 2"\r\n')[1][1],'line 1\nline 2');
 assert.equal(I.parseCSV('a;b\n1;2')[1][1],'2');assert.equal(I.parseCSV('a\tb\n1\t2')[1][1],'2');assert.throws(()=>I.parseCSV('a,b\n"bad'));
 assert.equal(I.date('16/10/2026','Date'),'2026-10-16');assert.throws(()=>I.date('31/02/2026','Date'));assert.throws(()=>I.numeric('=SUM(A1)','Reading'));
 const sparse=[];sparse[0]='id';sparse[2]='title';assert.equal(I.table([sparse,['A','','B']]).headers[1],'Column 2');
 assert.throws(()=>I.jsonTable([{nested:{a:1}}],'oras'));
 await api.readDrop(file('ORA.csv','Reference,Description,Risk ID,Asset,SCE,Owner,Date raised,Next review,Expiry,Extensions,Status,Compensating controls,Evidence\nORA_001,Temporary detector impairment,R01,Asset Alpha,Fire and gas,Asset lead,01/10/2026,15/10/2026,14/10/2026,2,Open,Additional detection patrols,ORA record 1'));
 api.stageDrop();assert.equal(api.getImport().staged[0].error,'');assert.equal(api.getImport().staged[0].record.status,'Active');api.commitDrop();let s=api.getState();assert.equal(s.oras.length,1);assert.equal(s.imports[0].file,'ORA.csv');assert.equal(s.oras[0].importedAt,'2026-10-16T21:05:00.000Z');
 api.setImport({type:'findings'});
 await api.readDrop(file('ICP.json',JSON.stringify([{id:'ICP_001',title:'Detection verification finding',risk:'R01',hub:'Asset Alpha',barrier:'Fire and gas',owner:'Technical authority',reported:'2026-10-08',due:'2026-10-12',significance:'High',repeat:'Yes',status:'Open',evidence:'ICP report p4'}])));
 api.stageDrop();assert.equal(api.getImport().staged[0].error,'');api.commitDrop();s=api.getState();assert.equal(s.findings.length,1);assert.equal(s.findings[0].repeat,true);
 api.setImport({type:'indicators'});
 const kri=(value,date)=>'id,title,risk,hub,barrier,owner,group,value,unit,threshold,direction,observed,evidence\nPSI01,Impaired detectors,R01,Asset Alpha,Fire and gas,Asset lead,Barrier health,'+value+',count,0,Above,'+date+',Barrier register';
 await api.readDrop(file('PSI.csv',kri(2,'2026-10-15')));api.stageDrop();api.commitDrop();s=api.getState();let summary=E.assuranceSummary(s,'2026-10-16');assert.equal(summary.oraExpired.length,1);assert.equal(summary.oraReviews.length,1);assert.equal(summary.icpOverdue.length,1);assert.equal(summary.repeats.length,1);assert.equal(summary.breached.length,1);assert.equal(summary.interactions.length,1);assert.equal(summary.interactions[0].types.size,3);
 h.click('',{nav:'board'});h.click('freeze-board');const frozen=api.getState().snapshots.at(-1);assert.equal(frozen.oras.length,1);assert.equal(frozen.findings.length,1);assert.equal(frozen.indicators.find(x=>x.id==='PSI01').value,2);
 h.click('',{nav:'imports'});api.setImport({mode:'update'});await api.readDrop(file('old-reading.csv',kri(3,'2026-10-12')));api.stageDrop();assert.equal(api.getImport().staged[0].operation,'History only');api.commitDrop();s=api.getState();assert.equal(s.indicators.find(x=>x.id==='PSI01').value,2);assert.equal(s.indicatorHistory.find(x=>x.id==='PSI01').value,3);
 await api.readDrop(file('new-reading.csv',kri(4,'2026-10-16')));api.stageDrop();api.commitDrop();s=api.getState();assert.equal(s.indicators.find(x=>x.id==='PSI01').value,4);assert.equal(E.observationTrend(s,s.indicators.find(x=>x.id==='PSI01'),'2026-10-16').value,2);assert.equal(s.snapshots.at(-1).indicators.find(x=>x.id==='PSI01').value,2);
 api.undoImport();assert.equal(api.getState().indicators.find(x=>x.id==='PSI01').value,2);
 api.setImport({type:'actions',mode:'add'});await api.readDrop(file('actions.csv','id,title,risk,owner,created,due,status,priority,completed,maturity,note\nACT001,Install revised detector,R01,Maintenance lead,2026-10-01,2026-10-15,Complete,High,2026-10-15,Implemented,Work order 1'));
 api.stageDrop();assert.equal(api.getImport().staged[0].error,'');api.commitDrop();assert.equal(E.assuranceSummary(api.getState(),'2026-10-16').maturityGaps.length,1);
 const before=JSON.stringify(api.getState());await api.readDrop(file('bad-batch.csv','id,title,risk,owner,created,due,status\nACT002,Valid row,R01,Lead,2026-10-01,2026-11-01,Open\nACT003,Invalid row,R99,Lead,2026-10-01,2026-11-01,Open'));
 api.stageDrop();assert.equal(api.getImport().staged.filter(x=>x.error).length,1);api.commitDrop();assert.equal(JSON.stringify(api.getState()),before,'invalid batch applies no records');
 api.setImport({type:'findings'});await api.readDrop(file('bad-grading.json',JSON.stringify([{id:'ICP2',title:'Finding',risk:'R01',owner:'TA',reported:'2026-10-01',due:'2026-10-30',significance:'Category 1'}])));api.stageDrop();assert.ok(api.getImport().staged[0].error.includes('Local significance'),'does not invent a criticality mapping');
 api.setImport({type:'oras',mode:'add'});await api.readDrop(file('duplicate.csv','id,title,risk,owner,opened,review\nORA_001,Existing,R01,Lead,2026-10-01,2026-11-01'));api.stageDrop();assert.ok(api.getImport().staged[0].error.includes('already exists'));
 api.setImport({type:'indicators'});await api.readDrop(file('missing.csv','id,title,risk,owner,unit,threshold,direction,value\nMISSING,No reading,R01,Lead,count,0,Above,'));api.stageDrop();assert.equal(api.getImport().staged[0].record.value,null,'blank is not zero');assert.equal(E.indicatorState(api.getImport().staged[0].record,'2026-10-16'),'No reading');
 const zip=new JSZip();const xml=s=>'<?xml version="1.0" encoding="UTF-8"?>'+s;
 zip.file('xl/workbook.xml',xml('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="0"/><sheets><sheet name="Indicators" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets></workbook>'));
 zip.file('xl/_rels/workbook.xml.rels',xml('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>'));
 zip.file('xl/styles.xml',xml('<styleSheet><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="9"/></cellXfs></styleSheet>'));
 zip.file('xl/sharedStrings.xml',xml('<sst><si><t>PSI_XLSX</t></si></sst>'));
 const headers=['id','title','risk','owner','value','unit','threshold','direction','observed'];
 const headerCells=headers.map((x,i)=>'<c r="'+String.fromCharCode(65+i)+'2" t="inlineStr"><is><t>'+x+'</t></is></c>').join('');
 const serial=(Date.UTC(2026,9,15)-Date.UTC(1899,11,30))/86400000;
 zip.file('xl/worksheets/sheet1.xml',xml('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Register metadata</t></is></c></row><row r="2">'+headerCells+'</row><row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3" t="inlineStr"><is><t>Maintenance overdue</t></is></c><c r="C3" t="inlineStr"><is><t>R01</t></is></c><c r="D3" t="inlineStr"><is><t>TA</t></is></c><c r="E3" t="n" s="2"><v>0.05</v></c><c r="F3" t="inlineStr"><is><t>%</t></is></c><c r="G3" t="n"><v>0</v></c><c r="H3" t="inlineStr"><is><t>Above</t></is></c><c r="I3" t="n" s="1"><v>'+serial+'</v></c></row></sheetData></worksheet>'));
 zip.file('xl/worksheets/sheet2.xml',xml('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Notes only</t></is></c></row></sheetData></worksheet>'));
 h.ctx.JSZip=JSZip;h.ctx.DOMParser=XMLParser;
 const sheets=await I.readXLSX(await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));assert.equal(sheets.length,2);const t=I.table(sheets[0].matrix,2);assert.equal(t.rows[0].value,5,'Excel percentage stored as fraction becomes displayed percentage');assert.equal(t.rows[0].observed,'2026-10-15','Excel formatted serial date');assert.equal(t.rows[0].id,'PSI_XLSX','shared string');const staged=I.stage(t.rows,I.guess(t.headers,'indicators'),'indicators',api.getState(),{at:'2026-10-16'},'actual.xlsx');assert.equal(staged[0].error,'');
 h.click('',{nav:'evidence'});assert.ok(h.html().includes('Fire and gas'));h.click('',{nav:'board'});h.click('word-board');const report=await h.downloads.at(-1).blob.text();assert.ok(report.includes('Operational evidence and treatment maturity'));assert.ok(report.includes('ORA_001'));assert.ok(report.includes('ICP_001'));
 E.validate(api.getState());const reloaded=harness(api.getState());assert.equal(reloaded.window.__RCC_TEST.getState().oras.length,1);
 const legacy=E.clone(h.ctx.RCC_SEED);for(const k of ['oras','findings','imports','reports','indicatorHistory'])delete legacy[k];assert.equal(harness(legacy).window.__RCC_TEST.getState().oras.length,0,'existing v2 data remains loadable');
 console.log('PASS: CSV/TSV quoting, UK/Excel dates, real ZIP/XML .xlsx worksheets/shared strings/percentages, mapping, JSON validation, duplicate guards, atomic import/undo, ORA/ICP/PSI interactions, maturity gaps, reading history, frozen board data, Word output and existing-data compatibility.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});

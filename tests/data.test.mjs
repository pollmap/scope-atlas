import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {filterRows,aggregateRows,initialQuery,queryString,csv,validateBackup,restoreItems,writeCollection,chartSlice,CHART_DIMENSIONS,comparisonStatus,STORAGE_KEY,buildIdentityIndex,identityRelations} from '../src/data.js';
const read=name=>JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const rows=read('catalog'),manifest=read('manifest'),evidence=read('evidence');
const f={q:'',sector:'',source:'',region:'',type:'',status:'',sort:'reviewed'};
test('public catalog reconciles all source rows and preserves separate IDs',()=>{
 assert.equal(rows.length,17321);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 assert.equal(manifest.coreRows,7173);assert.equal(manifest.legalEntitiesDeduplicated,false);
 assert.deepEqual(manifest.sources.map(s=>s.rows),[342,423,892,5516,3538,3855,2755]);
 for(const s of manifest.sources)assert.equal(rows.filter(r=>r.sourceId===s.id).length,s.rows);
 assert.ok(rows.length>new Set(rows.map(r=>r.name)).size);
});
test('only allowed public fields, safe links and bounded metadata leave the builder',()=>{
 const allowed=['id','name','sourceId','sourceUrl','sectors','types','region','regionKind','address','ministry','homepage','asOf','checked','evidenceCount','group','groupBasis','organization','industry','industryLabel','business','classification','classificationNote','industrySource','industryDate','identity','identityStatus','businessSource'].sort();
 for(const r of rows){assert.deepEqual(Object.keys(r).sort(),allowed);assert.ok(r.name);assert.ok(r.sourceUrl.startsWith('https://')||r.sourceUrl.startsWith('http://'));if(r.homepage)assert.match(r.homepage,/^https?:\/\//);}
 const noticeKeys=['url','title','checked','published','period','role','employment','education','region','entry','headcountText'].sort();
 for(const notices of Object.values(evidence))for(const n of notices){assert.deepEqual(Object.keys(n).sort(),noticeKeys);assert.equal(new URL(n.url).hostname,'job.alio.go.kr');for(const v of Object.values(n))assert.ok(v.length<=250);}
 assert.deepEqual(readdirSync(new URL('../public/data',import.meta.url)).sort(),['catalog.json','evidence.json','manifest.json']);
});
test('evidence counts reconcile and absent evidence stays distinct from no hiring',()=>{
 assert.equal(Object.values(evidence).filter(a=>a.length).length,152);
 assert.equal(Object.values(evidence).flat().length,153);
 for(const r of rows)assert.equal(r.evidenceCount,(evidence[r.id]||[]).length);
 assert.equal(filterRows(rows,{...f,status:'linked'}).length,152);
});
test('Korean search and intersecting filters return exact source rows',()=>{
 assert.deepEqual(filterRows(rows,{...f,q:'보 증',sector:'public'}),filterRows(rows,{...f,q:'보증',sector:'public'}));
 const selected=filterRows(rows,{...f,q:'보증',sector:'public',source:'invested',region:'충북'});
 assert.equal(selected.length,1);assert.match(selected[0].name,/충북신용보증재단/);
 assert.equal(filterRows(rows,{...f,q:'존재하지않는회사_QA_2026'}).length,0);
 assert.equal(filterRows(rows,f).length,17321);
 assert.equal(filterRows(rows,{...f,sector:'public'}).length,1657);
});
test('URL roundtrip caps and deduplicates comparison; notes are never serialized',()=>{
 const state=initialQuery('?q=보증&sector=public&compare=a,a,b,c,d&tab=compare&sort=name');
 assert.deepEqual(state.compare,['a','b','c']);
 const next=queryString({...state,note:'PRIVATE_NOTE_SENTINEL',items:['secret']});
 assert.ok(!next.includes('PRIVATE'));assert.deepEqual(initialQuery(next),state);
 assert.equal(initialQuery('?tab=bad&sector=unknown').tab,'explore');
});
test('chart groups reconcile with the population; multiple labels count once each per row',()=>{
 for(const s of manifest.sources){const subset=rows.filter(r=>r.sourceId===s.id);for(const dimension of ['region','evidence','industry','classification','group','category'])assert.equal(aggregateRows(subset,dimension).reduce((n,g)=>n+g.value,0),subset.length);}
 assert.deepEqual(aggregateRows([{types:['은행','은행','보험']},{types:['은행']}]),[{label:'은행',value:2},{label:'보험',value:1}]);
});
test('CSV retains missing values and protects spreadsheet formulas, quotes and line breaks',()=>{
 const result=csv([['기관','값'],['가"나',null],['=HYPERLINK("x")','a\nb'],['  @SUM(1)','-1']]);
 assert.ok(result.startsWith('\uFEFF'));assert.ok(result.includes('"가""나","미확인"'));assert.ok(result.includes('"\'=HYPERLINK'));assert.ok(result.includes('"\'  @SUM'));assert.ok(result.includes('"a\nb"'));
});
test('backup validation fails atomically and restore preserves unknown IDs and unrelated notes',()=>{
 const existing=[{id:'a',note:'keep',next:''},{id:'old:missing',note:'archived',next:'review'}];
 const incoming=validateBackup({version:1,items:[{id:'a',note:'restored',next:'next',untrusted:'drop'}]});
 assert.equal(incoming[0].untrusted,undefined);
 assert.deepEqual(restoreItems(existing,incoming),[{id:'a',note:'restored',next:'next'},existing[1]]);
 for(const bad of [null,{version:2,items:[]},{version:1,items:[{id:'a',note:1,next:''}]},{version:1,items:[...existing,existing[0]]},{version:1,items:[{id:'x',note:'x'.repeat(20001),next:''}]}])assert.throws(()=>validateBackup(bad));
 assert.equal(existing[0].note,'keep');
});
test('storage quota or access failures return a recoverable backup instruction',()=>{
 const items=[{id:'a',note:'still in memory',next:''}];let stored;
 assert.equal(writeCollection(()=>({setItem:(key,value)=>{stored=JSON.parse(value);}}),items),'');
 assert.deepEqual(stored,{version:1,items});
 assert.match(writeCollection(()=>({setItem:()=>{throw new Error('QuotaExceededError');}}),items),/バックアップ|백업/);
 assert.match(writeCollection(()=>{throw new Error('SecurityError');},items),/기기에 저장하지 못했습니다/);
 assert.equal(items[0].note,'still in memory');
});


test('category discovery is not a finance/public/private hierarchy and never drops unknown rows',()=>{
 const d=manifest.discovery;
 assert.equal(d.categories.length,20);
 assert.equal(d.categories.reduce((n,c)=>n+c.count,0),rows.length);
 for(const c of d.categories)assert.equal(filterRows(rows,{...f,industry:c.id}).length,c.count);
 for(const o of d.organizations)assert.equal(filterRows(rows,{...f,organization:o.id}).length,o.count);
 const unknown=filterRows(rows,{...f,industry:'unknown'});
 assert.ok(unknown.length>0);assert.ok(unknown.every(r=>r.classification==='unknown'));
 assert.ok(rows.find(r=>r.name==='국민건강보험공단').industry==='health');
});
test('group browsing keeps all 102 groups and intersects industries without classifying from group names',()=>{
 assert.equal(manifest.discovery.groups.length,102);
 assert.equal(manifest.discovery.groups.reduce((n,g)=>n+g.count,0),3538);
 for(const g of manifest.discovery.groups)assert.equal(filterRows(rows,{...f,group:g.id}).length,g.count);
 assert.equal(filterRows(rows,{...f,group:'삼성'}).length,67);
 const electronics=filterRows(rows,{...f,group:'삼성',industry:'electronics'});
 assert.ok(electronics.some(r=>r.name.includes('삼성전자')));
 assert.ok(!electronics.some(r=>r.name.includes('삼성생명')));
 assert.equal(filterRows(rows,{...f,group:'삼성',organization:'public'}).length,0);
});
test('finance composition counts cooperatives separately and totals reconcile',()=>{
 const b=manifest.discovery.financeBreakdown;
 assert.equal(b.cooperatives,3625);assert.equal(b.other,1891);
 assert.equal(Object.values(b.types).reduce((a,b)=>a+b,0),b.cooperatives);
 assert.equal(filterRows(rows,{...f,source:'finance',organization:'cooperative'}).length,3625);
 assert.equal(b.total,b.cooperatives+b.other);
});
test('official listed industry, products, and code deduplication retain provenance',()=>{
 const s=manifest.sources.find(s=>s.id==='listed');
 assert.equal(s.rawRows,2798);assert.equal(s.duplicatesCollapsed,43);assert.equal(s.rows,2755);
 const listed=rows.filter(r=>r.sourceId==='listed');
 assert.ok(listed.every(r=>r.classification==='official'&&r.industryLabel&&r.industrySource.includes('kind.krx.co.kr')));
 assert.equal(new Set(listed.map(r=>r.id)).size,2755);
 assert.ok(rows.filter(r=>r.classification==='matched').every(r=>r.classificationNote.includes('병합 아님')));
 assert.ok(rows.filter(r=>r.classification==='tentative').every(r=>r.classificationNote.includes('추정')));
 assert.ok(filterRows(rows,{...f,industry:'mobility',q:'자동차'}).length>0);
});
test('legacy URLs migrate, new discovery URLs roundtrip, saved IDs remain unchanged',()=>{
 assert.equal(initialQuery('').industry,'');assert.equal(initialQuery('').organization,'');assert.equal(initialQuery('').detail,'');
 assert.equal(initialQuery('?sector=finance').industry,'finance');assert.equal(initialQuery('?sector=public').organization,'public');
 const q=initialQuery('?browse=group&group=삼성&industry=electronics&subindustry=전자부품 제조업&compare=central:C0091');
 assert.deepEqual(initialQuery(queryString(q)),q);
 assert.ok(rows.some(r=>r.id==='central:C0091'));
 assert.ok(!queryString({...q,note:'PRIVATE'}).includes('PRIVATE'));
});

test('public industry exceptions and imported descriptions avoid misleading keyword matches',()=>{
 const find=name=>rows.find(r=>r.name===name);
 assert.equal(find('노사발전재단').industry,'social');
 assert.equal(find('의령친환경골프장관리사업소').industry,'leisure');
 assert.equal(find('군산교육발전진흥재단').industry,'education');
 for(const r of rows)assert.ok(!/<br\s*\/?>/i.test(r.business));
 assert.deepEqual(filterRows(rows,{...f,region:'경기'}),filterRows(rows,{...f,region:'경기도'}));
});

test('every chart group opens exactly its counted rows, including unknown and multi-region groups',()=>{
 for(const source of manifest.sources){
  const population=rows.filter(r=>r.sourceId===source.id);
  for(const dimension of Object.keys(CHART_DIMENSIONS)){
   for(const group of aggregateRows(population,dimension)){
    const state=initialQuery(queryString({...initialQuery(''),source:source.id,facets:{[dimension]:group.label}}));
    assert.equal(filterRows(population,state).length,group.value,`${source.id}/${dimension}/${group.label}`);
   }
  }
 }
});

test('chart continuation preserves prior facets and sharing settings without personal notes',()=>{
 const base=initialQuery('?source=listed&industry=electronics');
 const regional=aggregateRows(filterRows(rows,base),'region')[0];
 const next={...base,facets:{region:regional.label}};
 const field=aggregateRows(filterRows(rows,next),'industry')[0];
 const final={...next,facets:{...next.facets,industry:field.label},chartSource:'listed',chartDimension:'industry',chartLimit:0,chartFiltered:true,note:'PRIVATE_TEST'};
 const url=queryString(final),restored=initialQuery(url);
 assert.equal(filterRows(rows,restored).length,field.value);
 assert.equal(restored.chartLimit,0);assert.equal(restored.chartFiltered,true);
 assert.equal(Object.keys(restored.facets).length,2);assert.ok(!url.includes('PRIVATE_TEST'));
 assert.deepEqual(initialQuery('?facets=bad').facets,{});
 assert.deepEqual(initialQuery('?facets=%7B%22note%22%3A%22secret%22%7D').facets,{});
 assert.equal(initialQuery('?chartSource=bad&chartDimension=bad').chartSource,'listed');
});

test('top categories preserve full total and do not label the remainder as a company category',()=>{
 const groups=Array.from({length:30},(_,i)=>({key:String(i),label:String(i),value:30-i}));
 const short=chartSlice(groups,12);
 assert.equal(short.length,13);assert.equal(short.at(-1).remainder,true);
 assert.equal(short.reduce((n,g)=>n+g.value,0),groups.reduce((n,g)=>n+g.value,0));
 assert.deepEqual(chartSlice(groups,0),groups);assert.equal(groups.length,30);
});

test('comparison treats unknown information separately and rebranding preserves local data identity',()=>{
 const get=r=>r.value||'미확인',known=r=>!!r.value;
 assert.equal(comparisonStatus([{value:''},{value:''}],get,known),'missing');
 assert.equal(comparisonStatus([{value:'서울'},{value:''}],get,known),'missing');
 assert.equal(comparisonStatus([{value:'서울'},{value:'서울'}],get,known),'same');
 assert.equal(comparisonStatus([{value:'서울'},{value:'부산'}],get,known),'different');
 assert.equal(STORAGE_KEY,'career-atlas.collections.v1');
 const old={version:1,items:[{id:'central:C0091',note:'기존 메모',next:'다음 확인'}]};
 assert.deepEqual(validateBackup(old),old.items);
});


test('verified identity links reconcile while source IDs and saved items survive enrichment',()=>{
 const index=buildIdentityIndex(rows),info=manifest.enrichment;
 const verified=rows.filter(r=>r.identity);
 assert.equal(verified.length,info.identityRows);
 assert.equal(index.entities.size,info.identityGroups);
 const multi=[...index.entities.values()].filter(rs=>new Set(rs.map(r=>r.sourceId)).size>1);
 assert.equal(multi.length,info.multiSourceGroups);
 assert.equal(multi.flat().length,info.multiSourceRows);
 for(const r of verified){
  assert.deepEqual(Object.keys(r.identity).sort(),['key','name','alias','basis','source','checkedAt'].sort());
  assert.match(r.identity.key,/^entity:[a-f0-9]{20}$/);
  assert.equal(new URL(r.identity.source).hostname,'dart.fss.or.kr');
  assert.equal(r.identityStatus,'verified');
 }
 for(const [key,bucket] of index.entities){assert.equal(filterRows(rows,{...f,entity:key}).length,bucket.length);}
 assert.equal(info.after.unknownIndustry,rows.filter(r=>r.industry==='unknown').length);
 assert.equal(info.after.missingBusiness,rows.filter(r=>!r.business).length);
 assert.equal(info.after.missingHomepage,rows.filter(r=>!r.homepage).length);
});

test('name candidates cannot merge different verified entities or become facts',()=>{
 const one={id:'a',name:'가나다',identity:{key:'one',name:'주식회사 가나다',alias:'가나다'}};
 const two={id:'b',name:'가나다',identity:{key:'two',name:'다른 법인',alias:'가나다'}};
 const also={...one,id:'c',name:'다른 표기'};
 const unknown={id:'d',name:'가나다',identity:null};
 const index=buildIdentityIndex([one,two,also,unknown]);
 assert.deepEqual(identityRelations(one,index),{verified:[also],candidates:[unknown]});
 assert.deepEqual(identityRelations(two,index),{verified:[],candidates:[unknown]});
 assert.equal(identityRelations(unknown,index).verified.length,0);
 assert.equal(unknown.identity,null);
});

test('entity links share safely, aliases search and chart identity status matches filtered counts',()=>{
 const r=rows.find(r=>r.identity&&r.name!==r.identity.alias&&r.identity.alias);
 assert.ok(filterRows(rows,{...f,q:r.identity.alias,entity:r.identity.key}).some(x=>x.id===r.id));
 const state=initialQuery('?entity='+r.identity.key+'&browse=all');
 assert.deepEqual(initialQuery(queryString({...state,note:'do-not-share'})),state);
 assert.ok(!queryString({...state,note:'do-not-share'}).includes('do-not-share'));
 assert.equal(initialQuery('?entity=invalid').entity,'');
 for(const s of manifest.sources){const subset=rows.filter(r=>r.sourceId===s.id);for(const g of aggregateRows(subset,'identity')){
  assert.equal(filterRows(rows,{...f,source:s.id,facets:{identity:g.label}}).length,g.value);
 }}
});

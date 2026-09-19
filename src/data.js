export const SECTORS = { public: '공공기관', finance: '금융', general: '일반기업' };
export const STORAGE_KEY = 'career-atlas.collections.v1';
const koCollator = new Intl.Collator('ko');
export const simplify = (text = '') => text.toLowerCase().replace(/\(주\)|\(재\)|\(사\)|주식회사|재단법인|사단법인|\s+/g, '');
export const displayName = (text = '') => text.replace(/^\((주|재|사)\)\s*/, '');
export const number = (n) => new Intl.NumberFormat('ko-KR').format(n);
const REGION_NAMES={'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'};
export const regionValues=(region='')=>region?region.split(' · ').map(r=>REGION_NAMES[r]||r):[];
REGION_NAMES['강원도']='강원';REGION_NAMES['전라북도']='전북';
export const CLASSIFICATIONS={official:'원문 업종',verified:'식별자 일치 업종',matched:'이름 일치 연결',tentative:'기관명 기반 추정',unknown:'산업 미확인'};
export const IDENTITY_STATUS={verified:'식별자 일치 확인','no-key':'대조할 식별자 미확보',ambiguous:'식별자 중복 · 연결 보류','not-found':'DART 일치 항목 미확보','missing-corporate-number':'법인번호 미확인'};
export const hasScope=s=>['q','entity','industry','subindustry','organization','group','source','region','type','status'].some(k=>!!s[k])||Object.keys(s.facets||{}).length>0;
export const CHART_DIMENSIONS={category:'탐색 산업',industry:'원문 업종',classification:'산업 분류 근거',identity:'법인 식별자 대조 상태',group:'기업집단',type:'기관 유형·업권',region:'명부 지역',evidence:'공고 연결 상태'};
export const SOURCE_IDS=['central','local','invested','finance','large','middle','listed'];
// A chart click and its URL use the same grouping keys as the aggregation.
export function dimensionValues(r,dimension){
  if(dimension==='identity')return [IDENTITY_STATUS[r.identityStatus]||IDENTITY_STATUS['no-key']];
  return [...new Set(dimension==='category'?[r.industry||'unknown']:dimension==='industry'?[r.industryLabel||'원문 업종 미확인']:dimension==='classification'?[CLASSIFICATIONS[r.classification]||CLASSIFICATIONS.unknown]:dimension==='group'?[r.group||'그룹 미연결']:dimension==='region'?[r.region||'지역 미기재']:dimension==='evidence'?[r.evidenceCount?'공고 연결 있음':'공고 미연결']:r.types)];
}
export function chartSlice(groups,limit=12){
  if(!limit||groups.length<=limit)return groups;
  return [...groups.slice(0,limit),{key:'__remainder__',label:`그 외 ${groups.length-limit}개 분류`,value:groups.slice(limit).reduce((n,g)=>n+g.value,0),remainder:true}];
}
export const discoveryLabel=(manifest,id)=>manifest.discovery.categories.find(c=>c.id===id)?.name || '산업 미확인';
export function groupAlias(name=''){return ({에스케이:'SK',엘지:'LG',씨제이:'CJ',지에스:'GS',엘에스:'LS',케이티:'KT',에이치디현대:'HD현대'})[name]||name;}

export function initialQuery(search = '') {
  const p = new URLSearchParams(search);
  let facets={};try{const raw=JSON.parse(p.get('facets')||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))facets=Object.fromEntries(Object.entries(raw).filter(([key,value])=>Object.hasOwn(CHART_DIMENSIONS,key)&&typeof value==='string'&&value.length>0&&value.length<=500));}catch{/* Invalid shared conditions safely fall back to an unfiltered catalog. */}
  return { q: p.get('q') || '', sector: '',
    facets,entity:/^entity:[a-f0-9]{20}$/.test(p.get('entity')||'')?p.get('entity'):'',
    chartSource:SOURCE_IDS.includes(p.get('chartSource'))?p.get('chartSource'):'listed',
    chartDimension:Object.hasOwn(CHART_DIMENSIONS,p.get('chartDimension'))?p.get('chartDimension'):'category',
    chartLimit:['12','20','0'].includes(p.get('chartLimit'))?Number(p.get('chartLimit')):12,
    chartFiltered:p.get('chartFiltered')==='1',
    browse:['industry','organization','group','all'].includes(p.get('browse'))?p.get('browse'):'industry',
    industry:p.get('industry')||(p.get('sector')==='finance'?'finance':''),subindustry:p.get('subindustry')||'',
    organization:p.get('organization')||(p.get('sector')==='public'?'public':''),group:p.get('group')||'',
    source: p.get('source') || '', region: p.get('region') || '', type: p.get('type') || '',
    status: p.get('status') === 'linked' ? 'linked' : '', sort: ['name','reviewed'].includes(p.get('sort')) ? p.get('sort') : 'context',
    tab: ['explore','compare','charts','saved'].includes(p.get('tab')) ? p.get('tab') : 'explore',
    detail: p.get('detail') || '', compare: [...new Set((p.get('compare') || '').split(',').filter(Boolean))].slice(0,3) };
}

export function queryString(state) {
  const p = new URLSearchParams();
  for (const k of ['q','entity','browse','industry','subindustry','organization','group','source','region','type','status','sort','tab','detail']) {
    if (state[k] && !(k==='tab' && state[k]==='explore') && !(k==='sort' && state[k]==='context') && !(k==='browse'&&state[k]==='industry')) p.set(k,state[k]);
  }
  if(Object.keys(state.facets||{}).length)p.set('facets',JSON.stringify(state.facets));
  if(state.chartSource&&state.chartSource!=='listed')p.set('chartSource',state.chartSource);
  if(state.chartDimension&&state.chartDimension!=='category')p.set('chartDimension',state.chartDimension);
  if(state.chartLimit!==undefined&&state.chartLimit!==12)p.set('chartLimit',String(state.chartLimit));
  if(state.chartFiltered)p.set('chartFiltered','1');
  if (state.compare?.length) p.set('compare',state.compare.join(','));
  return p.size ? '?' + p.toString() : '';
}

export function filterRows(rows, f) {
  const needle = simplify(f.q);
  const found = rows.filter(r => (!needle || simplify([r.name,r.identity?.name,r.identity?.alias,...r.types,r.ministry,r.group,groupAlias(r.group),r.business,r.industryLabel].join(' ')).includes(needle))
    && (!f.entity||r.identity?.key===f.entity)
    && (!f.industry||r.industry===f.industry) && (!f.subindustry||r.industryLabel===f.subindustry)
    && (!f.organization||r.organization===f.organization) && (!f.group||(r.sourceId==='large'&&r.group===f.group))
    && (!f.sector || r.sectors.includes(f.sector)) && (!f.source || f.source===r.sourceId)
    && (!f.type || r.types.includes(f.type)) && (!f.region || (f.region==='unknown' ? !r.region : regionValues(r.region).includes(REGION_NAMES[f.region]||f.region)))
    && (!f.status || r.evidenceCount>0)
    && Object.entries(f.facets||{}).every(([dimension,value])=>dimensionValues(r,dimension).includes(value)));
  return found.sort((a,b)=> (f.sort==='reviewed' ? (b.checked || '').localeCompare(a.checked || '') : f.sort==='context' ? Number(!!b.business)-Number(!!a.business) || Number(b.classification==='official')-Number(a.classification==='official') : 0)
    || koCollator.compare(simplify(a.name),simplify(b.name)) || a.id.localeCompare(b.id));
}

// Name candidates never confer identity or transfer company facts.
export function buildIdentityIndex(rows){
 const entities=new Map(),names=new Map();
 for(const row of rows){
  if(row.identity){const key=row.identity.key;if(!entities.has(key))entities.set(key,[]);entities.get(key).push(row);}
  for(const name of new Set([row.name,row.identity?.name,row.identity?.alias].filter(Boolean).map(simplify))){
   if(!names.has(name))names.set(name,[]);names.get(name).push(row);
  }
 }
 return {entities,names};
}
export function identityRelations(row,index){
 if(!row)return {verified:[],candidates:[]};
 const verified=(index.entities.get(row.identity?.key)||[]).filter(r=>r.id!==row.id);
 const found=new Map();
 for(const name of [row.name,row.identity?.name,row.identity?.alias].filter(Boolean)){
  for(const r of index.names.get(simplify(name))||[]){
   if(r.id!==row.id&&!(r.identity&&row.identity))found.set(r.id,r);
  }
 }
 return {verified,candidates:[...found.values()]};
}

export function aggregateRows(rows, dimension='type') {
  const counts = new Map();
  for (const r of rows) {
    const values = dimensionValues(r,dimension);
    for (const key of new Set(values)) counts.set(key,(counts.get(key)||0)+1);
  }
  return [...counts].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value || a.label.localeCompare(b.label,'ko'));
}

export function csv(rows) {
  return '\uFEFF'+rows.map(row=>row.map(value=> {
    let text = String(value ?? '미확인');
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n');
}

export function validateBackup(input) {
  if (!input || input.version!==1 || !Array.isArray(input.items) || input.items.length>20000) throw new Error('지원하지 않는 백업 형식입니다. 기존 목록은 유지됩니다.');
  const seen=new Set();
  for (const i of input.items) {
    if (!i || typeof i.id!=='string' || !i.id || i.id.length>160 || seen.has(i.id) || typeof i.note!=='string' || typeof i.next!=='string' || i.note.length>20000 || i.next.length>2000) throw new Error('백업 항목을 확인할 수 없습니다. 기존 목록은 유지됩니다.');
    seen.add(i.id);
  }
  return input.items.map(({id,note,next})=>({id,note,next}));
}

export function restoreItems(existing,incoming) {
  const map = new Map(existing.map(i=>[i.id,i]));
  for (const i of incoming) map.set(i.id,i);
  return [...map.values()];
}

export function writeCollection(getStorage,items) {
  try {getStorage().setItem(STORAGE_KEY,JSON.stringify({version:1,items}));return '';}
  catch {return '기기에 저장하지 못했습니다. 현재 목록을 백업해 주세요. 새로고침하면 이번 변경을 잃을 수 있습니다.';}
}

export function download(content,filename,type='text/csv;charset=utf-8') {
  window.dispatchEvent(new CustomEvent('atlas-export',{detail:{blob:new Blob([content],{type}),filename}}));
}

export const comparisonSections = (sourceMap) => [
 ['사업과 소속',[
  ['원문 업종',r=>r.industryLabel||'미확인',r=>!!r.industryLabel],
  ['사업·제품·등록 업종',r=>r.business||'사업 내용 미확인',r=>!!r.business],
  ['기업집단',r=>r.group||'미연결',r=>!!r.group],
  ['기업·기관 유형',r=>r.types.join(' · '),r=>r.types.length>0],
  ['명부 지역',r=>r.region||'지역 미기재',r=>!!r.region],
  ['소재지',r=>r.address||'미확인',r=>!!r.address],
 ]],
 ['정보의 근거',[
  ['DART 법인명',r=>r.identity?.name||'미확인',r=>!!r.identity],
  ['법인 연결 근거',r=>r.identity?.basis||IDENTITY_STATUS[r.identityStatus]||'미확인',r=>!!r.identity],
  ['사업정보 출처',r=>r.businessSource||'미확인',r=>!!r.businessSource],
  ['산업 연결 근거',r=>r.classificationNote||'미확인',r=>r.classification!=='unknown'],
  ['명부 출처',r=>sourceMap[r.sourceId]?.name||r.sourceId,()=>true],
  ['명부 기준일',r=>r.asOf||'기준일 미기재',r=>!!r.asOf],
  ['공식 공고 연결',r=>r.evidenceCount?`${r.evidenceCount}건 · 과거 확인자료`:'미연결 · 채용 없음과 다름',()=>true],
  ['공고 확인일',r=>r.checked||'미확인',r=>!!r.checked],
 ]],
 ['추가로 확인할 내용',[
  ['연봉·인원·실제 근무지',()=> '공식 자료 추가 확인 필요',()=>false],
  ['직무·지원자격·현재 채용',()=> '해당 회차의 공식 공고 확인 필요',()=>false],
 ]],
];
export const comparisonFields=sourceMap=>comparisonSections(sourceMap).flatMap(([,fields])=>fields);
export function comparisonStatus(compared,get,known){
 if(compared.some(r=>!known(r)))return 'missing';
 return new Set(compared.map(get)).size>1?'different':'same';
}

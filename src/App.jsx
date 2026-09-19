import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ChartBar, X, Info, Spinner } from '@phosphor-icons/react';
import { STORAGE_KEY, number, displayName, initialQuery, queryString, filterRows, validateBackup, restoreItems, writeCollection, buildIdentityIndex } from './data';
import { AtlasContext } from './context';
import { External } from './ui';
import { Explore, Sidebar } from './Explore';
import { EnrichmentCoverage } from './CompanyLinks';
const ComparePage=lazy(()=>import('./ComparePage'));
const SavedPage=lazy(()=>import('./Workspace').then(m=>({default:m.SavedPage})));
const ChartPage=lazy(()=>import('./ChartPage'));
import '@fontsource-variable/noto-sans-kr';

const NAV=[['explore','탐색'],['compare','비교'],['charts','차트'],['saved','내 목록']];
export const emptyFilters={q:'',entity:'',sector:'',industry:'',subindustry:'',organization:'',group:'',source:'',region:'',type:'',status:'',detail:'',facets:{}};
function loadSaved(){try{const raw=localStorage.getItem(STORAGE_KEY);return {items:raw?validateBackup(JSON.parse(raw)):[],error:''};}catch{return {items:[],error:'저장된 목록을 읽지 못했습니다. 기존 저장값은 덮어쓰지 않았습니다. 백업 파일이 있다면 복원해 주세요.'};}}

export function App(){
  const [state,setState]=useState(()=>initialQuery(location.search));
  const [input,setInput]=useState(state.q),[data,setData]=useState(null),[loadError,setLoadError]=useState(''),[retry,setRetry]=useState(0);
  const [page,setPage]=useState(1),[mobileFilters,setMobileFilters]=useState(false),[toast,setToast]=useState('');
  const [initialSaved]=useState(loadSaved),[saved,setSaved]=useState(initialSaved.items),[storageError,setStorageError]=useState(initialSaved.error);
  const [dialog,setDialog]=useState(null);const dialogRef=useRef(null),toastTimer=useRef(null);
  const [exportFile,setExportFile]=useState(null);
  useEffect(()=>{let href;const receive=e=>{if(href)URL.revokeObjectURL(href);href=URL.createObjectURL(e.detail.blob);setExportFile({href,filename:e.detail.filename});setDialog('export');};window.addEventListener('atlas-export',receive);return()=>{window.removeEventListener('atlas-export',receive);if(href)URL.revokeObjectURL(href);};},[]);
  useEffect(()=>{let active=true;setLoadError('');
    Promise.all(['manifest','catalog','evidence'].map(async name=>{const r=await fetch(`/data/${name}.json`,{cache:'no-cache'});if(!r.ok)throw Error();return r.json();}))
    .then(([manifest,catalog,evidence])=>{if(active){setData({manifest,catalog,evidence});setState(s=>({...s,compare:s.compare.filter(id=>catalog.some(r=>r.id===id))}));}})
    .catch(()=>{if(active)setLoadError('자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');});return()=>{active=false;};
  },[retry]);
  useEffect(()=>{const next=queryString(state);if(location.search!==next)history.replaceState(null,'',location.pathname+next);},[state]);
  useEffect(()=>{window.scrollTo({top:0,left:0});},[state.tab]);
  useEffect(()=>{const pop=()=>{const next=initialQuery(location.search);setState(next);setInput(next.q);setPage(1);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  useEffect(()=>{if(dialog&&!dialogRef.current?.open)dialogRef.current?.showModal();else if(!dialog&&dialogRef.current?.open)dialogRef.current.close();},[dialog]);
  const all=data?.catalog||[];
  const sourceMap=useMemo(()=>Object.fromEntries((data?.manifest.sources||[]).map(s=>[s.id,s])),[data]);
  const byId=useMemo(()=>new Map(all.map(r=>[r.id,r])),[all]);
  const identityIndex=useMemo(()=>buildIdentityIndex(all),[all]);
  const filtered=useMemo(()=>filterRows(all,state),[all,state.q,state.entity,state.sector,state.industry,state.subindustry,state.organization,state.group,state.source,state.region,state.type,state.status,state.sort,state.facets]);
  const selected=byId.get(state.detail),compared=state.compare.map(id=>byId.get(id)).filter(Boolean);
  const savedIds=useMemo(()=>new Set(saved.map(i=>i.id)),[saved]);
  function notify(message){setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4500);}
  function change(values){setState(s=>({...s,...values}));setPage(1);}
  function reset(){change({...emptyFilters,browse:'industry'});setInput('');}
  function discover(browse,values={}){change({...emptyFilters,browse,tab:'explore',...values});setInput('');window.scrollTo({top:0});setMobileFilters(false);}
  function openChartGroup(source,dimension,value,useFilters){change({...(!useFilters?emptyFilters:{}),source,facets:{...(useFilters?state.facets:{}),[dimension]:value},browse:'all',tab:'explore',detail:''});if(!useFilters)setInput('');}
  function setTab(tab){setState(s=>({...s,tab}));setMobileFilters(false);}
  function toggleCompare(id){if(state.compare.includes(id)){change({compare:state.compare.filter(v=>v!==id)});}else if(state.compare.length>=3){notify('한 번에 3개까지 비교할 수 있습니다. 기존 후보를 하나 빼 주세요.');}else{change({compare:[...state.compare,id]});}}
  function persist(items){setSaved(items);setStorageError(writeCollection(()=>localStorage,items));}
  function toggleSave(id){if(savedIds.has(id)){setDialog({remove:id,name:displayName(byId.get(id)?.name||id)});}else{persist([...saved,{id,note:'',next:''}]);notify('내 목록에 저장했습니다.');}}
  function updateNote(id,key,value){persist(saved.map(i=>i.id===id?{...i,[key]:value}:i));}
  async function share(){try{await navigator.clipboard.writeText(location.href);notify('현재 화면 링크를 복사했습니다. 개인 메모는 포함되지 않습니다.');}catch{setDialog('share');}}
  async function importBackup(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;try{if(file.size>8*1024*1024)throw Error('8MB 이하의 백업 파일을 선택해 주세요.');const incoming=validateBackup(JSON.parse(await file.text()));persist(restoreItems(saved,incoming));notify(`${number(incoming.length)}개 항목을 복원했습니다. 같은 항목의 메모는 백업 값으로 반영했습니다.`);}catch(e){notify(e instanceof SyntaxError?'JSON 백업을 읽을 수 없습니다. 기존 목록은 유지됩니다.':e.message);}}
  const context={state,input,setInput,data,all,filtered,selected,compared,byId,sourceMap,identityIndex,saved,savedIds,page,setPage,mobileFilters,setMobileFilters,
    setDialog,change,reset,discover,openChartGroup,setTab,toggleCompare,toggleSave,updateNote,share,importBackup,notify};
  if(!data)return <main className="loading-screen"><h1>SCOPE</h1>{loadError?<><p>{loadError}</p><button className="button primary" onClick={()=>setRetry(v=>v+1)}>다시 불러오기</button></>:<p><Spinner className="spin" size={22}/> 기업 탐색에 필요한 공개 자료를 불러오고 있습니다.</p>}</main>;
  return <AtlasContext.Provider value={context}><a className="skip-link" href="#main-content">본문 바로가기</a>
    <header className="app-header"><a href="/" className="brand" onClick={e=>{e.preventDefault();discover('industry');}}>SCOPE<span>기업을 보는 시야</span></a><nav aria-label="주요 메뉴">{NAV.map(([id,label])=><button key={id} className={state.tab===id?'active':''} onClick={()=>setTab(id)} aria-current={state.tab===id?'page':undefined}>{label}{id==='saved'&&saved.length>0&&<span className="nav-count">{saved.length}</span>}</button>)}</nav><button className="header-date" onClick={()=>setDialog('about')}>SCOPE 안내 <Info size={16}/></button></header>
    {storageError&&<div className="storage-warning" role="alert">{storageError}<button onClick={()=>setTab('saved')}>내 목록 열기</button></div>}
    <div className={'app-body '+(state.tab==='explore'?'':'wide')}>{state.tab==='explore'&&<Sidebar/>}<main id="main-content" className="main-content"><Suspense fallback={<div className="workspace-loading" role="status"><Spinner className="spin" size={20}/> 화면을 준비하고 있습니다.</div>}>{state.tab==='explore'?<Explore/>:state.tab==='compare'?<ComparePage/>:state.tab==='charts'?<ChartPage/>:<SavedPage/>}</Suspense></main></div>
    <footer className={'compare-tray '+(!compared.length?'tray-empty':'')} aria-label="비교 후보 목록"><strong>{compared.length?`${compared.length}곳 선택`:'나란히 비교해 보세요'}</strong><div className="tray-items">{compared.map(r=><button key={r.id} onClick={()=>toggleCompare(r.id)}>{displayName(r.name)}<X size={16}/><span className="sr-only"> 비교에서 빼기</span></button>)}</div><span className="tray-help">{compared.length?'최대 3개까지 함께 볼 수 있습니다.':'기업 옆 비교 버튼으로 후보를 담아보세요.'}</span><button className="tray-cta" disabled={!compared.length} onClick={()=>setTab('compare')}><ChartBar size={21}/>비교하기 {compared.length?`(${compared.length})`:''}</button></footer>
    <div className="toast" role="status" aria-live="polite">{toast}</div>
    <dialog ref={dialogRef} className="app-dialog" onCancel={()=>setDialog(null)} onClose={()=>setDialog(null)}><button className="dialog-close icon-button" aria-label="안내 닫기" onClick={()=>setDialog(null)}><X size={23}/></button>
      {dialog==='sources'&&<><p className="eyebrow">SOURCES & METHODS</p><h2>무엇을 담고 있나요?</h2><p>서로 범위가 다른 7개 명부의 {number(data.manifest.rows)}개 출처 항목입니다. 국내 전체 기업 수나 고유 기업 수가 아닙니다. 파일 점검일은 {data.manifest.builtAt}이며 원자료 기준일은 각각 다릅니다.</p><div className="source-list">{data.manifest.sources.map(s=><article key={s.id}><h3>{s.name}<strong>{number(s.rows)}행</strong></h3><p>{s.note}</p><p>기준일 {s.date||'개별 행 미기재'}</p><External href={s.url}>{s.provider}</External></article>)}</div><EnrichmentCoverage/><h3>금융 자료가 많았던 이유</h3><p>금융 등록 5,516개 중 지역 조합·금고가 3,625개, 그 외 등록기관이 1,891개입니다. 산업별 규모가 아니라 수집 범위의 차이입니다.</p><h3>산업 분류의 근거</h3><p>공식 원문 업종, 공식 식별자가 일치하는 연결, 이름만 일치하는 연결, 기관명 기반 추정을 구분합니다. 기업집단 소속만으로 계열사 산업을 정하지 않습니다. 원문 업종이 없는 항목은 산업 미확인에서도 모두 볼 수 있습니다.</p><h3>숫자를 읽는 기준</h3><ul>{data.manifest.limitations.map(t=><li key={t}>{t}</li>)}</ul></>}
      {dialog==='about'&&<><p className="eyebrow">SCOPE · 스코프</p><h2>기업을 보는 시야</h2><p>산업과 기업집단에서 기업을 발견하고, 출처가 있는 정보를 비교해 관심 후보를 정리하는 기업 탐색 도구입니다. 취업 탐색부터 기업·산업 조사까지 누구나 같은 조건으로 사용할 수 있습니다.</p><ol className="about-steps"><li><strong>발견</strong><span>산업·기업 유형·그룹을 골라 모르는 기업까지 찾아보세요.</span></li><li><strong>이해와 비교</strong><span>사업 내용과 원문 근거를 읽고, 최대 3개 후보를 나란히 비교하세요.</span></li><li><strong>정리</strong><span>관심 목록에 저장하고 다음에 확인할 내용을 메모하세요.</span></li></ol><h3>공개 자료와 개인 기록은 따로</h3><ul><li>공개 기업·기관 명부와 공식 공고의 기본정보를 제공합니다. 운영자의 개인 프로필·성적·진로 기록·학교 제휴 계정 자료는 포함하지 않습니다.</li><li>관심 목록·메모는 이 브라우저에 저장됩니다. 앱은 이를 서버로 보내지 않으며 다른 기기로 자동 동기화하지 않습니다.</li><li>공유 링크에는 검색어·필터·비교 후보·차트 조건이 포함될 수 있습니다. 메모는 포함하지 않습니다.</li><li>백업 파일에는 직접 적은 메모가 들어갑니다. 다른 사람에게 전달하기 전에 내용을 확인하세요.</li><li>로그인·분석 추적 도구는 사용하지 않습니다. 사이트 접속에 필요한 통신과 호스팅 사업자의 처리까지 없다는 뜻은 아닙니다.</li></ul><h3>숫자를 읽는 방법</h3><p>수록된 {number(data.manifest.rows)}개는 출처 항목 수입니다. 같은 기업이 여러 명부에 나타나며, 전국 모든 기업 또는 현재 채용 중인 기업 수가 아닙니다. 연봉·기업 순위·개인별 합격 가능성을 산정하는 서비스는 아닙니다.</p><button className="button" onClick={()=>setDialog('sources')}>전체 출처와 기준일 보기</button></>}
      {dialog==='share'&&<><h2>현재 화면 공유</h2><p>아래 링크를 복사하세요. 개인 메모는 포함되지 않습니다.</p><input className="share-url" readOnly value={location.href} onFocus={e=>e.target.select()}/></>}
      {dialog==='export'&&exportFile&&<><h2>내보낼 파일이 준비됐습니다</h2><p>{exportFile.filename}</p><p>아래 링크를 눌러 기기에 저장하세요. 파일은 이 브라우저에서 생성됩니다.</p><a className="button primary export-file" href={exportFile.href} download={exportFile.filename}>파일 내려받기</a></>}
      {dialog?.remove&&<><h2>저장한 후보를 제거할까요?</h2><p>{dialog.name}의 메모와 다음 확인 항목도 이 기기에서 제거됩니다.</p><div className="button-group"><button className="button" onClick={()=>setDialog(null)}>취소</button><button className="button primary" onClick={()=>{persist(saved.filter(i=>i.id!==dialog.remove));setDialog(null);notify('저장한 후보를 제거했습니다.');}}>제거</button></div></>}
    </dialog>
  </AtlasContext.Provider>;
}

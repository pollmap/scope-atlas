import React,{useState} from 'react';
import {MagnifyingGlass,ChartBar,BookmarkSimple,X,DownloadSimple,LinkSimple,Info} from '@phosphor-icons/react';
import {useAtlas} from './context';
import {External,Tag} from './ui';
import {discoveryLabel,displayName,simplify,csv,download,comparisonSections,comparisonStatus} from './data';

export default function ComparePage(){
 const {data,compared,sourceMap,toggleCompare,toggleSave,savedIds,setTab,share,notify}=useAtlas();
 const [onlyDifferent,setOnlyDifferent]=useState(false),[hideMissing,setHideMissing]=useState(false);
 const sections=comparisonSections(sourceMap);
 const entries=sections.flatMap(([,fields])=>fields),summary={same:0,different:0,missing:0};
 if(compared.length>1)for(const [,get,known] of entries)summary[comparisonStatus(compared,get,known)]++;
 const visibleSections=sections.map(([name,fields])=>[name,fields.filter(([,get,known])=>(!onlyDifferent||comparisonStatus(compared,get,known)==='different')&&(!hideMissing||compared.some(known)))]);
 const identityKeys=compared.filter(r=>r.identity).map(r=>r.identity.key);
 const sameEntity=identityKeys.length!==new Set(identityKeys).size;
 const duplicate=compared.some((r,i)=>compared.slice(i+1).some(other=>simplify(r.name)===simplify(other.name)&&(!r.identity||!other.identity)));
 const differentEntities=compared.some((r,i)=>r.identity&&compared.slice(i+1).some(other=>other.identity&&r.identity.key!==other.identity.key&&simplify(r.name)===simplify(other.name)));
 function exportCompare(){download(csv([['SCOPE · 기업 비교표'],['항목 단위: 출처 행. 같은 기업이 여러 명부에 수록될 수 있습니다.'],['표시 조건',onlyDifferent?'확인된 차이만':'전체 항목',hideMissing?'모두 미확인인 항목 숨김':'미확인 항목 포함'],['구분','항목',...compared.map(r=>r.name)],...visibleSections.flatMap(([section,fields])=>fields.map(([title,get])=>[section,title,...compared.map(get)])),['원문','출처',...compared.map(r=>r.sourceUrl)]]),'SCOPE_기업비교.csv');notify('현재 비교표와 같은 항목의 CSV를 준비했습니다.');}
 return <section className="workspace-page"><div className="page-title"><div><p className="eyebrow">SIDE BY SIDE</p><h1>같은 기준으로, 나란히</h1><p>어떤 일을 하는지, 무엇이 다르고 아직 모르는지 살펴보세요.</p></div><button className="button" onClick={()=>setTab('explore')}><MagnifyingGlass size={18}/>후보 찾기</button></div>
 {!compared.length?<div className="empty-state"><ChartBar size={42}/><h2>비교할 기업을 골라주세요</h2><p>탐색 목록에서 최대 3개 후보의 비교 칸을 선택하세요.</p><button className="button primary" onClick={()=>setTab('explore')}>기업 탐색하기</button></div>:<>
  {compared.length>1?<div className="compare-summary"><div><strong>{summary.different}</strong><span>확인된 차이</span></div><div><strong>{summary.same}</strong><span>같은 정보</span></div><div><strong>{summary.missing}</strong><span>미확인 포함</span></div><p>공개된 비교 항목 기준입니다.<br/>같은 이름의 다른 명부 항목은 별도로 유지합니다.</p></div>:<div className="context-note"><Info size={18}/><p>후보를 한 곳 더 담으면 확인된 차이를 볼 수 있습니다.</p></div>}
  {(sameEntity||duplicate||differentEntities)&&<div className="context-note"><Info size={18}/><p>{sameEntity?'공식 식별자로 같은 법인임을 확인한 항목이 포함되어 있습니다. 서로 다른 출처의 기록을 비교하고 있습니다.':differentEntities?'이름은 같지만 공식 식별자가 다른 법인입니다. 출처의 법인명과 기준일을 확인하세요.':'이름이 같은 항목이 선택되어 있습니다. 법인 동일성은 미확인입니다. 출처와 기준일을 먼저 비교하세요.'}</p></div>}
  <div className="workspace-toolbar"><div className="compare-filters"><label className="checkbox-label"><input type="checkbox" disabled={compared.length<2} checked={onlyDifferent} onChange={e=>setOnlyDifferent(e.target.checked)}/>확인된 차이만</label><label className="checkbox-label"><input type="checkbox" checked={hideMissing} onChange={e=>setHideMissing(e.target.checked)}/>모두 미확인인 항목 숨김</label></div><div><button className="button" onClick={share}><LinkSimple size={17}/>링크 복사</button><button className="button" onClick={exportCompare}><DownloadSimple size={17}/>CSV</button></div></div>
  <p className="compare-scroll-hint">작은 화면에서는 비교표를 좌우로 움직여 보세요.</p><div className="compare-scroll" tabIndex={0} role="region" aria-label="기업 비교표 가로 스크롤"><table className="compare-table"><thead><tr><th scope="col">비교 항목</th>{compared.map(r=><th scope="col" key={r.id}><button className="icon-button compare-remove" aria-label={`${displayName(r.name)} 비교 제거`} onClick={()=>toggleCompare(r.id)}><X size={17}/></button><Tag blue>{discoveryLabel(data.manifest,r.industry)}</Tag><h2>{displayName(r.name)}</h2><p className="compare-source">{sourceMap[r.sourceId]?.name}</p><button className="text-button" onClick={()=>toggleSave(r.id)}><BookmarkSimple size={16} weight={savedIds.has(r.id)?'fill':'regular'}/>{savedIds.has(r.id)?'저장됨':'내 목록에 저장'}</button></th>)}</tr></thead><tbody>
   {visibleSections.filter(([,fields])=>fields.length).map(([section,fields])=><React.Fragment key={section}><tr className="compare-section"><th colSpan={compared.length+1} scope="rowgroup">{section}</th></tr>{fields.map(([label,get,known])=><tr key={label} className={compared.length>1&&comparisonStatus(compared,get,known)==='different'?'difference-row':''}><th scope="row">{label}</th>{compared.map(r=><td className={known(r)?'':'unknown-value'} key={r.id}>{get(r)}</td>)}</tr>)}</React.Fragment>)}
   {!visibleSections.some(([,fields])=>fields.length)&&<tr><td colSpan={compared.length+1}>현재 표시 조건에 해당하는 항목이 없습니다. 비교 조건을 해제해 전체 정보를 확인하세요.</td></tr>}
   <tr><th scope="row">원문 확인</th>{compared.map(r=><td key={r.id}><External href={r.sourceUrl}>명부 원문</External>{r.homepage&&<><br/><External href={r.homepage}>공식 홈페이지</External></>}</td>)}</tr>
  </tbody></table></div><div className="context-note"><Info size={18}/><p>미확인 값을 ‘없음’으로 해석하지 않습니다. 명부 지역은 실제 근무지와 다를 수 있으며, 고용조건·보수·현재 채용은 원문을 추가로 확인해야 합니다.</p></div>
 </>}
 </section>;
}

import React from 'react';
import {ArrowRight,LinkSimple} from '@phosphor-icons/react';
import {useAtlas} from './context';
import {identityRelations,IDENTITY_STATUS,displayName,number} from './data';
import {External,dateText} from './ui';

export function CompanyLinks(){
 const {selected,identityIndex,sourceMap,change,discover}=useAtlas();
 const {verified,candidates}=identityRelations(selected,identityIndex);
 if(!selected)return null;
 const identity=selected.identity;
 function links(rows){return <ul className="company-links">{rows.map(r=><li key={r.id}><button onClick={()=>change({detail:r.id})}><span><strong>{displayName(r.name)}</strong><small>{sourceMap[r.sourceId]?.name} · {dateText(r.asOf)}</small></span><ArrowRight size={17}/></button></li>)}</ul>;}
 return <section className="detail-section entity-detail"><h3><LinkSimple size={18}/> 다른 명부와 연결</h3>
  {identity?<><p className="identity-confirmed">공식 식별자 일치 확인</p><dl className="fact-list"><div><dt>DART 법인명</dt><dd>{identity.name}</dd></div><div><dt>연결 근거</dt><dd>{identity.basis}<small>대조일 {dateText(identity.checkedAt)}</small></dd></div></dl>
   {verified.length?<><p className="entity-summary">같은 법인의 다른 항목 <strong>{verified.length}개</strong></p>{links(verified)}<button className="text-button entity-all" onClick={()=>discover('all',{entity:identity.key})}>같은 법인 항목 모아보기 <ArrowRight size={15}/></button></>:<p className="filter-caption">현재 수록된 다른 명부에서 같은 법인을 확인하지 못했습니다.</p>}
   <External href={identity.source}>기업개황 원문</External><p className="filter-caption">명부마다 기준일과 업종 표기가 다를 수 있습니다. 현재 영업 여부와 최신 변경사항은 원문을 확인하세요.</p>
  </>:<p className="filter-caption">{IDENTITY_STATUS[selected.identityStatus]||'법인 동일성 미확인'}. 확인된 식별자가 없는 항목은 이름만으로 합치지 않습니다.</p>}
  {!!candidates.length&&<details className="name-candidates"><summary>이름이 같은 연결 후보 {candidates.length}개</summary><p>명부명 또는 공시 법인명이 일치한 후보입니다. 법인 동일성은 미확인입니다. 아래 항목의 업종·홈페이지를 이 기업의 정보로 간주하지 마세요.</p>{links(candidates)}</details>}
 </section>;
}

export function EnrichmentCoverage(){
 const {data}=useAtlas();const info=data.manifest.enrichment;if(!info)return null;
 const counts=[['산업 근거 미확보','unknownIndustry'],['사업·등록 업종 미기재','missingBusiness'],['홈페이지 미기재','missingHomepage']];
 return <section className="enrichment-coverage"><h3>사업정보와 법인 연결 보강</h3><p>{dateText(info.checkedAt)}에 DART 기업개황 {number(info.referenceRows)}행을 대조용으로 사용했습니다. 이 기업들을 탐색 목록에 새로 추가한 것은 아닙니다.</p>
  <div className="coverage-table"><table className="data-table"><thead><tr><th scope="col">미확인 항목</th><th scope="col">보강 전</th><th scope="col">보강 후</th></tr></thead><tbody>{counts.map(([label,key])=><tr key={key}><th scope="row">{label}</th><td>{number(info.before[key])}</td><td>{number(info.after[key])}</td></tr>)}</tbody></table></div>
  <p><strong>{number(info.multiSourceGroups)}개 법인 · {number(info.multiSourceRows)}개 출처 항목</strong>을 여러 명부 사이에서 연결했습니다. 총 {number(info.identityRows)}개 항목에서 식별자 일치를 확인했으며, 나머지 항목의 동일성은 확정하지 않았습니다.</p><p>추가된 사업정보에는 제품 설명 대신 ‘공시 업종’만 제공되는 경우가 있습니다. 홈페이지는 명부 기재값이며 접속 가능 여부를 전수 확인한 결과는 아닙니다.</p><p>{info.note}</p><External href={info.source}>{info.provider}</External>
 </section>;
}

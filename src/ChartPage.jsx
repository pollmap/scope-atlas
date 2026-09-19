import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ChartBar,Table,DownloadSimple,Info,ArrowRight,LinkSimple} from '@phosphor-icons/react';
import * as echarts from 'echarts/core';
import {BarChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,TitleComponent,AriaComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import {useAtlas} from './context';
import {External} from './ui';
import {number,aggregateRows,chartSlice,CHART_DIMENSIONS,discoveryLabel,csv,download} from './data';
echarts.use([BarChart,GridComponent,TooltipComponent,TitleComponent,AriaComponent,CanvasRenderer]);

function DataChart({groups,title,subtitle,onReady,onSelect}){
 const element=useRef(null);
 useEffect(()=>{
  const instance=echarts.init(element.current,null,{renderer:'canvas'});
  const narrow=element.current.clientWidth<600;
  instance.setOption({animation:false,backgroundColor:'#fff',aria:{enabled:true,label:{description:title+'。'+groups.map(g=>g.label+' '+g.value+'항목').join(', ')+'. 동일한 수치는 아래 표에서 확인할 수 있습니다.'}},
   title:{text:title,subtext:subtitle,left:20,top:18,textStyle:{fontSize:narrow?13:17,color:'#102746',width:element.current.clientWidth-40,overflow:'break'},subtextStyle:{fontSize:11,lineHeight:18,color:'#52647e',width:element.current.clientWidth-40,overflow:'break'}},
   grid:{left:narrow?116:200,right:58,top:narrow?135:115,bottom:35},tooltip:{trigger:'axis',axisPointer:{type:'shadow'},renderMode:'richText'},
   xAxis:{type:'value',min:0,minInterval:1,axisLabel:{color:'#61738b'},splitLine:{lineStyle:{color:'#edf1f6'}}},
   yAxis:{type:'category',inverse:true,data:groups.map(g=>g.label),axisLine:{show:false},axisTick:{show:false},axisLabel:{fontSize:narrow?10:12,width:narrow?100:180,overflow:'truncate',color:'#223858'}},
   series:[{type:'bar',barMaxWidth:23,data:groups.map(g=>({value:g.value,itemStyle:{color:g.remainder?'#a4b4ca':'#0866f5'}})),itemStyle:{borderRadius:[0,3,3,0]},label:{show:true,position:'right',formatter:p=>number(p.value),color:'#223858'}}]});
  instance.on('click',p=>{const group=groups[p.dataIndex];if(group&&!group.remainder)onSelect(group.key);});
  onReady(instance);const observer=new ResizeObserver(()=>instance.resize());observer.observe(element.current);
  return()=>{observer.disconnect();onReady(null);instance.dispose();};
 },[groups,title,subtitle,onReady,onSelect]);
 return <div className="chart-canvas" ref={element} style={{height:Math.max(380,groups.length*35+165)}} role="img" aria-label={`${title}. 막대를 눌러 기업 목록으로 이동하거나 아래 표의 기업 보기 버튼을 사용하세요.`}/>;
}

export default function ChartPage(){
 const {all,filtered,data,state,change,sourceMap,identityIndex,setDialog,notify,openChartGroup,share}=useAtlas();
 const {chartSource:source,chartDimension:dimension,chartLimit:limit,chartFiltered:useFilters}=state;
 const [view,setView]=useState('chart');const chart=useRef(null);
 const ready=useCallback(value=>{chart.current=value;},[]);
 const rows=useMemo(()=>(useFilters?filtered:all).filter(r=>r.sourceId===source),[all,filtered,source,useFilters]);
 const groups=useMemo(()=>aggregateRows(rows,dimension).map(g=>({...g,key:g.label,label:dimension==='category'?discoveryLabel(data.manifest,g.label):g.label})),[rows,dimension,data.manifest]);
 const plotted=useMemo(()=>chartSlice(groups,limit),[groups,limit]);
 const meta=sourceMap[source],total=groups.reduce((n,g)=>n+g.value,0);
 const title=`${meta.name} · ${CHART_DIMENSIONS[dimension]}`;
 const subtitle=`선택 ${number(rows.length)}개 출처 항목 · ${limit&&groups.length>limit?`상위 ${limit}개와 나머지 합계`:'모든 분류'}${dimension==='type'?' · 복수 유형 중복 집계':''}\n${meta.provider} · 원자료 ${meta.date||'기준일 미기재'}`;
 const selectGroup=useCallback(key=>openChartGroup(source,dimension,key,useFilters),[source,dimension,useFilters,openChartGroup]);
 const sameFilters=useFilters?'현재 탐색 조건을 적용했습니다.':'선택한 명부 전체를 보여줍니다.';
 const filterText=[state.entity&&`같은 법인: ${identityIndex.entities.get(state.entity)?.[0]?.identity.name||'일치 항목 없음'}`,state.q&&`검색: ${state.q}`,state.industry&&`산업: ${discoveryLabel(data.manifest,state.industry)}`,state.subindustry&&`업종: ${state.subindustry}`,state.organization&&`유형: ${data.manifest.discovery.organizations.find(o=>o.id===state.organization)?.name}`,state.group&&`그룹: ${state.group}`,state.source&&`출처: ${sourceMap[state.source]?.name}`,state.region&&`지역: ${state.region==='unknown'?'미기재':state.region}`,state.type&&`유형: ${state.type}`,state.status&&'공고 연결 있음',...Object.entries(state.facets).map(([key,value])=>`${CHART_DIMENSIONS[key]}: ${key==='category'?discoveryLabel(data.manifest,value):value}`)].filter(Boolean).join(' · ');
 function exportCSV(){download(csv([['SCOPE · '+title],[subtitle.replaceAll('\n',' / ')],[sameFilters],['탐색 조건',useFilters?filterText||'필터 없음':'미적용'],['분류','출처 항목 수','선택 항목 대비 비율(%)'],...groups.map(g=>[g.label,g.value,(g.value/rows.length*100).toFixed(2)]),['분류별 합계',total,dimension==='type'?'복수 유형으로 100% 초과 가능':'100.00']]),'SCOPE_차트자료.csv');notify('전체 분류를 담은 CSV를 준비했습니다.');}
 function exportPNG(){if(!chart.current)return;const raw=atob(chart.current.getDataURL({pixelRatio:2,backgroundColor:'#fff'}).split(',')[1]);download(Uint8Array.from(raw,c=>c.charCodeAt(0)),'SCOPE_분포차트.png','image/png');}
 return <section className="workspace-page"><div className="page-title"><div><p className="eyebrow">DATA STUDIO</p><h1>분포를 읽고, 기업으로 이어서</h1><p>막대나 표를 누르면 그 수치를 구성하는 기업 목록으로 이동합니다.</p></div><div className="button-group"><button className="button" onClick={share}><LinkSimple size={17}/>차트 조건 공유</button><button className="button" onClick={()=>setDialog('sources')}><Info size={17}/>집계 기준</button></div></div>
  <div className="chart-controls"><label>데이터셋<select value={source} onChange={e=>change({chartSource:e.target.value})}>{data.manifest.sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>묶는 기준<select value={dimension} onChange={e=>change({chartDimension:e.target.value})}>{Object.entries(CHART_DIMENSIONS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>차트에 표시<select value={limit} onChange={e=>change({chartLimit:Number(e.target.value)})}><option value={12}>상위 12개 + 나머지</option><option value={20}>상위 20개 + 나머지</option><option value={0}>모든 분류</option></select></label><label className="checkbox-label"><input type="checkbox" checked={useFilters} onChange={e=>change({chartFiltered:e.target.checked})}/>현재 탐색 필터 적용</label></div>
  <div className="chart-summary"><div><strong>{number(rows.length)}</strong><span>선택한 출처 항목</span></div><div><strong>{number(groups.length)}</strong><span>{CHART_DIMENSIONS[dimension]} 분류</span></div><p>{sameFilters}<br/>국내 시장점유율·기업 순위·일자리 수를 뜻하지 않습니다.</p></div>
  {useFilters&&<p className="active-chart-filters">적용한 조건 · {filterText||'필터 없음'}</p>}<div className="workspace-toolbar"><div className="segmented"><button aria-pressed={view==='chart'} className={view==='chart'?'active':''} onClick={()=>setView('chart')}><ChartBar size={17}/>차트</button><button aria-pressed={view==='table'} className={view==='table'?'active':''} onClick={()=>setView('table')}><Table size={17}/>표</button></div><div><button className="button" onClick={exportCSV} disabled={!groups.length}><DownloadSimple size={17}/>전체 CSV</button><button className="button" onClick={exportPNG} disabled={view!=='chart'||!groups.length}><DownloadSimple size={17}/>PNG</button></div></div>
  {!groups.length?<div className="empty-state"><h2>이 조건으로 집계할 자료가 없습니다</h2><p>탐색 조건과 명부가 겹치는 항목이 없습니다.</p><button className="button" onClick={()=>change({chartFiltered:false})}>탐색 필터 적용 해제</button></div>:<>{view==='chart'&&<div className="chart-frame"><DataChart groups={plotted} title={title} subtitle={subtitle} onReady={ready} onSelect={selectGroup}/></div>}<div className="chart-source"><External href={meta.url}>{meta.provider} 원문</External><span>{meta.note}</span></div>{limit>0&&groups.length>limit&&<p className="coverage-line">차트의 회색 막대는 나머지 {groups.length-limit}개 분류를 합친 값입니다. 아래 표와 CSV에는 모든 분류가 있습니다.</p>}
   <section className="chart-table-wrap table-expanded"><h2>분류별 기업 살펴보기</h2><p className="coverage-line">비율은 선택한 {number(rows.length)}개 출처 항목 기준입니다.{dimension==='type'?' 복수 유형은 중복 집계되어 비율 합이 100%를 넘을 수 있습니다.':''}</p><table className="data-table"><thead><tr><th scope="col">분류</th><th scope="col">출처 항목</th><th scope="col">비율</th><th scope="col"><span className="sr-only">목록으로 이동</span></th></tr></thead><tbody>{groups.map(g=><tr key={g.key}><th scope="row">{g.label}</th><td>{number(g.value)}</td><td>{(g.value/rows.length*100).toFixed(2)}%</td><td><button className="text-button" aria-label={`${g.label} ${number(g.value)}항목 보기`} onClick={()=>selectGroup(g.key)}>기업 보기 <ArrowRight size={15}/></button></td></tr>)}</tbody><tfoot><tr><th scope="row">분류별 합계</th><td>{number(total)}</td><td colSpan={2}>{dimension==='type'?'복수 유형 중복 집계':'100%'}</td></tr></tfoot></table></section></>}
 </section>;
}

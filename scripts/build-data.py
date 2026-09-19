"""Build a minimal public facts catalog. Never copy raw or affiliate content."""
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
from discovery import enrich
from entity_enrichment import enrich_entities

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
OUT = APP / 'public' / 'data'
AS_OF = '2026-09-20'

def read(rel):
    return json.loads((ROOT / rel).read_text(encoding='utf-8-sig'))

def url(s):
    return s.strip() if isinstance(s, str) and urlparse(s.strip()).scheme in ('https', 'http') else ''

def keyname(s):
    return re.sub(r'\s+|\(주\)|\(재\)|\(사\)|주식회사|재단법인|사단법인', '', s)

def trim(s, n=250):
    return re.sub(r'\s+', ' ', str(s or '')).strip()[:n]

sources = [
    dict(id='central', name='중앙 공공기관', provider='JOB-ALIO', url='https://job.alio.go.kr/introduce.do', date=None, unit='기관 명부 행', note='기관 ID 기준. 공기업·준정부기관·기타공공기관을 포함한 저장 명부이며 개별 행의 명부 기준일은 미기재입니다.'),
    dict(id='local', name='지방공기업', provider='클린아이', url='https://www.cleaneye.go.kr/siteGuide/pubCompStatus.do', date='2026-06-30', unit='명부 행', note='직영기업을 포함합니다. 직영사업을 독립 법인·독립 채용 주체로 해석하지 않습니다.'),
    dict(id='invested', name='지방 출자·출연기관', provider='클린아이', url='https://www.cleaneye.go.kr/siteGuide/iptCompStatus.do', date='2026-06-30', unit='명부 행', note='출자·출연기관의 분류와 관할 지역을 보존했습니다.'),
    dict(id='finance', name='금융회사 등록자료', provider='금융감독원 FINE', url='https://fine.fss.or.kr/fine/fncco/systemFncCo/list.do?menuNo=900038', date='2026-09-15', unit='등록 식별자 행', note='동일 이름의 복수 등록과 지역 조합이 포함됩니다. 등록 사실은 현재 채용을 의미하지 않습니다.'),
    dict(id='large', name='기업집단 계열사', provider='공정거래위원회 발표자료', url='https://www.korea.kr/briefing/pressReleaseView.do?newsId=156759013', date='2026-05-01', unit='명부 행', note='기업집단의 계열사 범위입니다. 전체 대기업 또는 독립 채용 법인 수와 다릅니다.'),
    dict(id='middle', name='중견기업 확인서', provider='중견기업 정보마당', url='https://www.mme.or.kr/PGPC0010.do', date='2026-09-15', unit='확인서 명부 행', note='확인서 명부이며 국내 전체 중견기업 수가 아닙니다. 회사별 확인서 유효기간이 다릅니다.'),
]
source_map = {s['id']: s for s in sources}
catalog = []
evidence = {}
inputs = []

def load(rel):
    data = read(rel)
    inputs.append(dict(path=rel, rows=len(data), sha256=hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()))
    return data

profiles = {r['id']: r for r in load('work/normalized/central_profiles.json')}
official = load('work/educe/official_hiring_evidence.json')
by_name = {}
for r in official:
    if r.get('status') != 'ok' or not r.get('name_match') or not url(r.get('url')):
        continue
    metadata = r.get('metadata', {})
    item = dict(url=url(r['url']), title=trim(r.get('title'),180), checked=trim(r.get('retrieved_at'),10),
                published=trim(metadata.get('등록일')), period=trim(metadata.get('채용기간')),
                role=trim(metadata.get('근무분야')), employment=trim(metadata.get('고용형태')),
                education=trim(metadata.get('학력정보')), region=trim(metadata.get('근무지')),
                entry=trim(metadata.get('채용구분')), headcountText=trim(metadata.get('채용인원')))
    by_name.setdefault(keyname(r['name']), []).append(item)

finance_words = ('보증','금융','보험','자산관리','장학','예금','투자','신용','중소벤처기업진흥','소상공인시장진흥')
exclude_hosts = ('publicjob.kr','work24.go.kr','hrdb.go.kr','gojobs.go.kr','career.co.kr','moel.go.kr','youthcenter.go.kr','alioplus.go.kr','alio.go.kr')
for r in load('work/normalized/central_roster.json'):
    p = profiles.get(r['id'], {}); fields = p.get('fields', {})
    links = [url(x) for x in p.get('external_links', []) if url(x) and not any(h in urlparse(x).netloc for h in exclude_hosts)]
    rid = 'central:' + r['id']
    linked = by_name.get(keyname(r['name']), [])
    # Name match is restricted to the official recheck's own confirmed institution.
    evidence[rid] = linked
    catalog.append(dict(id=rid, name=r['name'], sourceId='central', sourceUrl=url(p.get('source')),
                        sectors=['public'] + (['finance'] if any(w in r['name'] for w in finance_words) else []),
                        types=['중앙 공공기관'], region='', regionKind='소재지', address=trim(fields.get('소재지')),
                        ministry=trim(fields.get('주무기관')), homepage=links[0] if links else '', asOf=None,
                        checked=max((n['checked'] for n in linked),default=''), evidenceCount=len(linked)))

configs = [('local','work/normalized/cleaneye_public_roster.json','public'),
           ('invested','work/normalized/cleaneye_invested_roster.json','public'),
           ('finance','work/normalized/inventory_finance.json','finance'),
           ('large','work/normalized/inventory_large.json','general'),
           ('middle','work/normalized/inventory_middle.json','general')]
for sid, rel, sector in configs:
    for i,r in enumerate(load(rel)):
        native = str(r.get('id') or r.get('corporate_id') or '')
        # Stable within the versioned snapshot; duplicate source rows remain separate.
        suffix = native or hashlib.sha256(json.dumps([r['name'],r.get('region'),r.get('type'),r.get('발급번호'),i],ensure_ascii=False).encode()).hexdigest()[:16]
        rid = sid+':'+suffix+(f':row{i+1}' if sid=='large' else '')
        types = r.get('types') or ([r['type']] if r.get('type') else [source_map[sid]['name']])
        catalog.append(dict(id=rid,name=r['name'],sourceId=sid,sourceUrl=url(r.get('source')),
                            sectors=[sector],types=types,region=r.get('region',''),regionKind='관할 지역' if sector=='public' else '지역 정보 없음',
                            address='',ministry=r.get('group',''),homepage=url(r.get('homepage')),
                            asOf=r.get('as_of'),checked='',evidenceCount=0))

discovery = enrich(catalog, sources, load, url, trim)
enrichment,identity_ledger=enrich_entities(catalog,load,discovery)
assert len(catalog) == 17321, len(catalog)
ids = [r['id'] for r in catalog]
assert len(set(ids)) == len(ids), 'Duplicate source identifiers must be resolved explicitly'
for s in sources:
    rows = [r for r in catalog if r['sourceId']==s['id']]
    s['rows'] = len(rows)
    s['distinctNames'] = len({r['name'] for r in rows})
    s['rightsNote'] = '기본 명칭·분류·출처만 수록. 장문 원문·제휴 사례·개인정보 미포함.'
manifest = dict(version=3,builtAt=AS_OF,rows=len(catalog),coreRows=sum(s['rows'] for s in sources[:4]),discovery=discovery,enrichment=enrichment,
                unit='출처 항목',legalEntitiesDeduplicated=False,sources=sources,
                catalog='catalog.json', evidence='evidence.json',
                limitations=['명부 등록은 현재 채용이나 지원 적격을 의미하지 않습니다.',
                             '같은 이름이 여러 출처에 등장할 수 있습니다. 법적 고용주 중복 제거는 완료하지 않았습니다.',
                             '과거 공고는 확인 당시의 사례입니다. 최신 정정과 접수 여부는 원문에서 확인하세요.',
                             '금융 등록자료는 지역 조합·금고 3,625개를 포함합니다. 출처마다 수집 범위가 달라 산업별 규모 비교에 사용할 수 없습니다.',
                             discovery['industryNote'],
                             '이름 일치로 연결한 업종·그룹 정보는 탐색 보조자료입니다. 법인 식별자를 검증한 고용주 통합 결과가 아닙니다.'])
OUT.mkdir(parents=True,exist_ok=True)
for filename,data in [('catalog.json',catalog),('evidence.json',evidence),('manifest.json',manifest)]:
    (OUT/filename).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
audit = dict(asOf=AS_OF,inputs=inputs,rows=len(catalog),distinctIds=len(set(ids)),sourceCounts=dict(Counter(r['sourceId'] for r in catalog)),
             linkedInstitutions=sum(bool(v) for v in evidence.values()),notices=sum(len(v) for v in evidence.values()),
             outputBytes={p.name:p.stat().st_size for p in OUT.glob('*.json')},
             forbiddenFields=['사업자번호','financial','sections','raw_file','기관장','prior_posting','자소서','합격사례'])
(APP/'data-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(APP/'qa/scope').mkdir(parents=True,exist_ok=True)
(APP/'qa/scope/identity-ledger.json').write_text(json.dumps(identity_ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(APP/'qa/scope/enrichment-audit.json').write_text(json.dumps(enrichment,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(audit,ensure_ascii=False,indent=2))

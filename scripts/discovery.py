"""Source-backed discovery metadata. No affiliate corpora or personal cases.

One primary exploration category per source row. Official industry labels remain
verbatim; broader navigation labels are our mapping, not an official KSIC code.
Name matches enrich metadata only and NEVER merge employers or change source IDs.
"""
import re
import html
from collections import Counter, defaultdict

KRX_URL = 'https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage'
CATEGORIES = [
 ('electronics','반도체·전자·전기','반도체, 전자부품, 전기장비'),
 ('mobility','자동차·모빌리티','완성차, 부품, 이동수단'),
 ('machinery','기계·조선·항공','산업기계, 선박, 항공우주·방산'),
 ('it','IT·통신','소프트웨어, 정보서비스, 통신'),
 ('materials','철강·소재·화학','금속, 화학, 플라스틱, 건축소재'),
 ('energy','에너지·환경','전력, 가스, 자원, 환경·수도'),
 ('construction','건설·부동산','건설, 엔지니어링, 부동산'),
 ('commerce','유통·무역','도소매, 상사, 온라인 유통'),
 ('consumer','소비재·패션','의류, 생활용품, 가구·제지'),
 ('food','식품·농림수산','식음료, 식품가공, 농수산업'),
 ('health','의료·제약·바이오','병원, 의약품, 의료기기'),
 ('logistics','운송·물류','육해공 운송, 물류, 교통 인프라'),
 ('media','문화·미디어','콘텐츠, 방송, 광고, 문화예술'),
 ('education','교육·연구','교육기관, 연구개발, 학습지원'),
 ('finance','금융·보험','은행, 증권, 보험, 보증·상호금융'),
 ('leisure','관광·숙박·여가','여행, 숙박, 스포츠, 레저'),
 ('services','전문·사업서비스','사업지원, 컨설팅, 시설관리'),
 ('social','행정·복지·기업지원','공공행정, 사회서비스, 지원사업'),
 ('other','기타·복합사업','원문 업종은 있으나 별도 분류 필요'),
 ('unknown','산업 미확인','산업 근거가 아직 없는 명부도 탐색'),
]
COOPS = {'새마을금고','농업ㆍ축산업협동조합','신용협동조합','산림조합','수산업협동조합'}
ORG_TYPES = [
 ('public','공공기관·지방공기업','중앙·지방 공공기관, 출자·출연기관'),
 ('group','기업집단 계열사','공정위 공시대상기업집단 명부'),
 ('middle','중견기업 확인서','유효 확인서 명부에 수록된 기업'),
 ('listed','상장법인','유가증권·코스닥·코넥스'),
 ('cooperative','지역 조합·금고','농협·신협·새마을금고 등'),
 ('registered','기타 금융 등록기관','지역 조합·금고를 제외한 FINE 등록'),
]
ALIASES = {'에스케이':'SK','엘지':'LG','씨제이':'CJ','지에스':'GS','엘에스':'LS','에이치디현대':'HD현대','에이치디씨':'HDC','케이티':'KT','케이티앤지':'KT&G','에이치엠엠':'HMM'}

def norm(s):
    return re.sub(r'\s+|\(주\)|\(재\)|\(사\)|주식회사|재단법인|사단법인','',s).casefold()

def category(label):
    # Match explicit official industry text; order distinguishes manufacturing,
    # commerce, logistics and finance (e.g. aircraft manufacture != airlines).
    rules = [
      ('finance',r'금융|보험|은행|신탁|투자|저축|증권|신용카드|여신|손해 사정'),
      ('commerce',r'도매|소매|상품 중개|자동차.*판매|부품 및 내장품 판매|통신 판매|백화점'),
      ('logistics',r'운송업|운송\s*관련|창고업|화물 취급|터미널 운영|주차장 운영|물류'),
      ('construction',r'건설업|공사업|부동산|건축기술|시설물 축조|건물설비|건물 개발|건물 건설|토목|조경 공사'),
      ('health',r'의약|의료'),
      ('it',r'소프트웨어|프로그래밍|정보 서비스|정보매개|자료처리|전기 통신|온라인정보|시스템 통합|통신업'),
      ('electronics',r'반도체|전자부품|전기장비|전동기|전지 제조|통신 및 방송 장비|영상 및 음향기기|광학|정밀기기|컴퓨터 및 주변|케이블|전구|통신장비|집적회로|표시장치|전자.*부품|인쇄회로|축전지|변압기|배전반|전선 제조'),
      ('mobility',r'자동차.*제조'),
      ('machinery',r'기계 제조|기계장비 제조|유압기기|여과기|선박|항공기|운송장비 제조|무기 및|밸브|펌프|압축기|기어 및|베어링|승강기|컨베이어'),
      ('energy',r'전기업|가스 제조|석유 정제|증기,|폐기물|원료 재생|발전업|수도업|하수 처리|가스 공급|전기 판매'),
      ('food',r'식품|식료|음료|사료|도축|육류|수산물|곡물|유지 및 낙농|채소|떡,|작물|어로|담배 제조|구내식당|조미료'),
      ('consumer',r'의복|섬유|가죽|신발|가구|목재|나무제품|종이|펄프|가정용 기기|가정용 전기기기|귀금속|악기|운동 및 경기용구|화장품|골판지|겉옷|속옷|편조|세제|비누'),
      ('materials',r'철강|비철금속|금속|화학|플라스틱|고무|시멘트|비금속|요업|유리|비료|레미콘|도료|알루미늄|압연|연신제품|주물|주조|합성수지|콘크리트|윤활유'),
      ('media',r'영화|방송업|오디오|출판|광고|창작|예술|인쇄|기록매체|영상·|방송 프로그램|프로그램 공급|신문 발행|매니저업'),
      ('education',r'연구개발|교육|교습'),
      ('leisure',r'숙박|여행|스포츠|오락|골프장|호텔업|휴양콘도|유원지'),
      ('services',r'서비스업|임대업|수리업|전문디자인|경비|조사업|경영 컨설팅|인력 공급|공인회계|청소업'),
    ]
    return next((k for k,p in rules if re.search(p,label)), 'other')

def public_category(name):
    # Explicitly marked as a tentative name-based tag, never an official industry.
    if re.search(r'골프|경륜|리조트',name): return 'leisure'
    if re.search(r'교육발전|발전교육|대학교',name) and '병원' not in name: return 'education'
    rules=[('health',r'병원|의료|보건|건강보험|적십자|장기조직'),
      ('social',r'노사|연금|복지|고용|사회서비스|경제진흥|기업진흥|테크노파크|산업진흥|소상공인|중소벤처|창조경제|장학'),
      ('finance',r'신용보증|기술보증|신용회복|금융|무역보험|자산관리|예금보험|주택도시보증|투자공사'),
      ('logistics',r'공항|항만|철도|교통공사|항공안전|도로공사'),
      ('energy',r'상하수도|하수|상수|환경|에너지|발전(?:공사|\(|\s*주식회사)|수력원자력|전력|가스|석유|지역난방|수자원|매립지'),
      ('media',r'문화|예술|콘텐츠|방송|영화|공연|박물관'),
      ('education',r'연구|교육|대학|학술|평가원'),
      ('leisure',r'관광|체육|레저|리조트|강원랜드|경륜'),
      ('construction',r'도시공사|주택공사|토지주택|국토정보|부동산'),
      ('food',r'농수산|농업|농촌|산림|수산'),
      ('services',r'시설관리|시설공단')]
    return next((k for k,p in rules if re.search(p,name)), 'unknown')

def enrich(catalog,sources,load,url,trim):
    krx_raw=load('work/normalized/krx_listed_20260919.json')
    by_code=defaultdict(list)
    for r in krx_raw: by_code[r['종목코드']].append(r)
    krx=[]
    for code,items in by_code.items():
        assert len({tuple(r[k] for k in ['회사명','업종','주요제품','시장구분']) for r in items})==1, code
        row=dict(items[0]);regions=sorted({r['지역'] for r in items})
        row['지역']=' · '.join(regions)
        krx.append(row)
    names=defaultdict(list)
    for r in krx: names[norm(r['회사명'])].append(r)
    group_raw=load('work/normalized/inventory_large.json')
    financial_names=defaultdict(list)
    for r in catalog:
        if r['sourceId']=='finance': financial_names[norm(r['name'])].append(r)
    profiles={r['id']:r for r in load('work/normalized/central_profiles.json')}
    ranks={r['group']:r.get('rank',999) for r in group_raw}
    group_names=defaultdict(set)
    for r in group_raw: group_names[norm(r['name'])].add(r['group'])
    sources.append(dict(id='listed',name='상장법인',provider='한국거래소 KIND',url=KRX_URL,date='2026-09-19',unit='종목코드 기준 항목',rawRows=len(krx_raw),duplicatesCollapsed=len(krx_raw)-len(krx),note='공개 엑셀 2,798행 중 같은 종목코드의 지역 중복 43행을 묶은 2,755항목입니다. 복수 지역 표기는 보존했습니다. 기존 명부와 중복될 수 있으며 스팩·리츠도 포함됩니다.'))
    for r in krx:
        catalog.append(dict(id='listed:'+r['종목코드'],name=r['회사명'],sourceId='listed',sourceUrl=KRX_URL,sectors=['general'],types=[r['시장구분']+' 상장'],region=r['지역'],regionKind='KIND 명부 지역',address='',ministry='',homepage=url(r['홈페이지']),asOf='2026-09-19',checked='',evidenceCount=0))
    for r in catalog:
        sid=r['sourceId']; r['group']=r['ministry'] if sid=='large' else ''
        r['groupBasis']='공정위 기업집단 명부' if r['group'] else ''
        r['organization']='public' if sid in ('central','local','invested') else 'group' if sid=='large' else 'middle' if sid=='middle' else 'listed' if sid=='listed' else 'cooperative' if COOPS.intersection(r['types']) else 'registered'
        r['industry']='unknown';r['industryLabel']='';r['business']='';r['classification']='unknown';r['classificationNote']='산업 근거 미확보';r['industrySource']='';r['industryDate']=''
        matches=names[norm(r['name'])]
        # Financial registrations take precedence; names can denote a different
        # regulated entity than an identically named listed parent.
        if sid=='finance':
            r.update(industry='finance',industryLabel=' · '.join(r['types']),business='등록 업권: '+' · '.join(r['types']),classification='official',classificationNote='FINE 등록 업권을 금융·보험으로 묶음',industrySource=r['sourceUrl'],industryDate=r['asOf'])
        elif sid=='listed' or len(matches)==1:
            match=next((x for x in krx if 'listed:'+x['종목코드']==r['id']),None) if sid=='listed' else matches[0]
            r.update(industry=category(match['업종']),industryLabel=match['업종'],business=trim(match['주요제품'],180),classification='official' if sid=='listed' else 'matched',classificationNote='KIND 원문 업종을 탐색 분류로 묶음' if sid=='listed' else '법인 표기·공백 제거 후 이름이 유일하게 일치한 KIND 자료 연결. 법인 동일성 확정·병합 아님.',industrySource=KRX_URL,industryDate='2026-09-19')
            if not r['homepage']:r['homepage']=url(match['홈페이지'])
        elif len(financial_names[norm(r['name'])])==1:
            match=financial_names[norm(r['name'])][0]
            r.update(industry='finance',industryLabel=' · '.join(match['types']),business='연결된 등록 업권: '+' · '.join(match['types']),classification='matched',classificationNote='법인 표기·공백 제거 후 이름이 유일하게 일치한 FINE 등록 연결. 법인 동일성 확정·병합 아님.',industrySource=match['sourceUrl'],industryDate=match['asOf'])
        elif r['organization']=='public':
            cat=public_category(r['name'])
            if cat!='unknown':r.update(industry=cat,classification='tentative',classificationNote='기관명 키워드에 따른 탐색용 추정. 공식 산업분류 아님.',industrySource=r['sourceUrl'],industryDate=r['asOf'] or '')
        if sid=='central' and not r['business']:
            fields=profiles.get(r['id'].split(':',1)[1],{}).get('fields',{})
            intro=re.split(r'홈페이지연결',fields.get('기관소개',''))[0]
            intro=html.unescape(re.sub(r'<[^>]*>',' ',intro))
            r['business']=trim(intro,110)+('…' if len(trim(intro,10000))>110 else '')
        if sid=='listed' and len(group_names[norm(r['name'])])==1:
            r['group']=next(iter(group_names[norm(r['name'])]));r['groupBasis']='공정위 명부와 이름 일치 연결 · 법인 동일성 추가 확인 필요'
        # Keep legacy sectors solely for old bookmarked URLs, not visible hierarchy.
        r['sectors']=['public'] if r['organization']=='public' else ['general']
        if r['industry']=='finance':r['sectors'].append('finance')
    groups=[]
    for name in sorted(ranks,key=lambda n:(ranks[n],n)):
        rows=[r for r in catalog if r['sourceId']=='large' and r['group']==name]
        detailed=sorted(rows,key=lambda r:(not r['business'],r['name']))
        groups.append(dict(id=name,name=ALIASES.get(name,name),officialName=name,rank=ranks[name],count=len(rows),examples=[r['name'] for r in detailed[:3]]))
    coop_rows=[r for r in catalog if r['sourceId']=='finance' and r['organization']=='cooperative']
    return dict(categories=[dict(id=k,name=n,description=d,count=sum(r['industry']==k for r in catalog)) for k,n,d in CATEGORIES],organizations=[dict(id=k,name=n,description=d,count=sum(r['organization']==k for r in catalog)) for k,n,d in ORG_TYPES],groups=groups,classificationCounts=dict(Counter(r['classification'] for r in catalog)),financeBreakdown=dict(total=5516,cooperatives=len(coop_rows),other=5516-len(coop_rows),types=dict(Counter(t for r in coop_rows for t in r['types'] if t in COOPS))),industryNote='산업은 탐색용으로 재분류했습니다. 공식 업종, 이름 일치 연결, 기관명 추정을 구분하며 산업 미확인도 숨기지 않습니다. 산업별 수록 수는 국내 기업 비중이 아닙니다.')

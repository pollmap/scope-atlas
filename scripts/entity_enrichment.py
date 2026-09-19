"""Join official company identifiers without merging or replacing source rows."""
import hashlib
import re
from collections import Counter,defaultdict
from urllib.parse import urlsplit,urlunsplit
from discovery import category

DART_URL='https://dart.fss.or.kr/dsae001/main.do'
DART_DOWNLOAD='https://dart.fss.or.kr/dsae001/downloadExcel.do'
CHECKED='2026-09-20'

def digits(value):
    return re.sub(r'\D','',str(value or ''))

def valid_number(value,length):
    value=digits(value)
    return value if len(value)==length and len(set(value))>1 else ''

def official_homepage(value):
    value=str(value or '').strip()
    if not value or value in ('-','없음') or re.search(r'\s|[<>"\']',value):return ''
    if re.match(r'^[a-z][a-z0-9+.-]*:',value,re.I) and not re.match(r'^https?://',value,re.I):return ''
    if not re.match(r'^https?://',value,re.I):value='https://'+value
    try:
        parts=urlsplit(value)
        if not parts.hostname or '.' not in parts.hostname or parts.username or parts.password:return ''
        # Official directory value, not a live availability guarantee.
        return urlunsplit((parts.scheme.lower(),parts.netloc,parts.path,parts.query,''))
    except ValueError:return ''

def indices_for(reference):
    indices={k:defaultdict(list) for k in ('corporateNumber','businessNumber','stockCode')}
    for row in reference:
        for key,size in [('corporateNumber',13),('businessNumber',10)]:
            val=valid_number(row.get(key),size)
            if val:indices[key][val].append(row)
        code=row.get('stockCode','').strip().upper()
        if re.fullmatch(r'[0-9A-Z]{6}',code) and code!='000000':indices['stockCode'][code].append(row)
    return indices

def unique_reference(index,value):
    matches=index.get(value,[]) if value else []
    # No arbitrary first-row selection, including identical duplicated input rows.
    return (matches[0],'verified') if len(matches)==1 else (None,'ambiguous' if matches else 'not-found')

def enrich_entities(catalog,load,discovery):
    reference=load('work/normalized/scope_dart_overview_20260920.json')
    indices=indices_for(reference)
    keys={}
    for sid,filename,field,index_name,length in [
        ('large','inventory_large.json','corporate_id','corporateNumber',13),
        ('middle','inventory_middle.json','사업자번호','businessNumber',10)]:
        raw=load('work/normalized/'+filename)
        existing=[r for r in catalog if r['sourceId']==sid]
        assert len(raw)==len(existing)
        for old,new in zip(raw,existing):
            assert old['name']==new['name']
            keys[new['id']]=(index_name,valid_number(old.get(field),length))
    for row in catalog:
        if row['sourceId']=='listed':keys[row['id']]=('stockCode',row['id'].split(':',1)[1])
    listed={r['id'].split(':',1)[1]:dict(r) for r in catalog if r['sourceId']=='listed'}
    before={'unknownIndustry':sum(r['industry']=='unknown' for r in catalog),
            'missingBusiness':sum(not r['business'] for r in catalog),
            'missingHomepage':sum(not r['homepage'] for r in catalog)}
    ledger=[];basis_labels={'corporateNumber':'공정위·DART 법인등록번호 일치','businessNumber':'중견기업 명부·DART 사업자등록번호 일치','stockCode':'KIND·DART 종목코드 일치'}
    for row in catalog:
        row['identity']=None
        row['identityStatus']='no-key'
        row['businessSource']=row['sourceUrl'] if row['sourceId']=='central' else row['industrySource'] if row['business'] else ''
        if row['id'] not in keys:continue
        index_name,value=keys[row['id']]
        match,status=unique_reference(indices[index_name],value)
        row['identityStatus']=status
        if not match:
            ledger.append({'id':row['id'],'status':status,'basis':index_name})
            continue
        corporate=valid_number(match.get('corporateNumber'),13)
        if not corporate:
            row['identityStatus']='missing-corporate-number'
            ledger.append({'id':row['id'],'status':row['identityStatus'],'basis':index_name})
            continue
        # An inconsistent duplicate corporate identifier cannot bridge another source.
        if len(indices['corporateNumber'][corporate])!=1:
            row['identityStatus']='ambiguous'
            ledger.append({'id':row['id'],'status':'ambiguous','basis':index_name})
            continue
        row['identity']={'key':'entity:'+hashlib.sha256(corporate.encode()).hexdigest()[:20],
                         'name':match['legalName'],'alias':match['name'],'basis':basis_labels[index_name],
                         'source':DART_URL,'checkedAt':CHECKED}
        row['identityStatus']='verified'
        stock=match.get('stockCode','');stock_row=listed.get(stock)
        if row['sourceId']!='listed':
            industry=match.get('industry','').strip()
            if industry:
                row.update(industry=category(industry),industryLabel=industry,classification='verified',
                           classificationNote=basis_labels[index_name]+'로 연결한 DART 공시 업종. 탐색 산업은 재분류이며 최신 사업 지속 여부는 별도 확인.',
                           industrySource=DART_URL,industryDate=CHECKED)
            if stock_row and stock_row['business']:
                row['business']=stock_row['business'];row['businessSource']=stock_row['industrySource']
            elif industry:
                row['business']='공시 업종: '+industry;row['businessSource']=DART_URL
            elif row['classification']=='matched':
                # A prior name-only product must not survive a failed identifier bridge.
                row['business']='';row['businessSource']=''
            row['homepage']=official_homepage(match.get('homepage')) or (stock_row or {}).get('homepage','')
        else:
            if not row['homepage']:row['homepage']=official_homepage(match.get('homepage'))
            if not row['business'] and match.get('industry'):
                row['business']='공시 업종: '+match['industry'];row['businessSource']=DART_URL
        if not row['address']:row['address']=match.get('address','')[:250]
        if not row['region']:
            address=match.get('address','')
            region=re.match(r'^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)(?:\s|$)',address)
            if region:row['region']=region[1];row['regionKind']='DART 본점 소재지'
        ledger.append({'id':row['id'],'status':'verified','basis':index_name,'entity':row['identity']['key']})
    verified_groups=defaultdict(set)
    for row in catalog:
        if row['sourceId']=='large' and row['identity']:
            verified_groups[row['identity']['key']].add(row['group'])
    for row in catalog:
        if row['identity'] and row['sourceId']=='listed':
            groups=verified_groups[row['identity']['key']]
            row['group']=next(iter(groups)) if len(groups)==1 else ''
            row['groupBasis']='공정위·DART·KIND 공식 식별자 연결' if row['group'] else ''
        # Keep legacy filter semantics consistent with the refreshed classification.
        row['sectors']=['public'] if row['organization']=='public' else ['general']
        if row['industry']=='finance':row['sectors'].append('finance')
    discovery['industryNote']='공식 원문 업종을 탐색용으로 재분류했습니다. 식별자 일치, 이름 일치, 기관명 추정을 구분하며 산업 미확인도 숨기지 않습니다. 산업별 수록 수는 국내 기업 비중이 아닙니다.'
    for entry in discovery['categories']:entry['count']=sum(r['industry']==entry['id'] for r in catalog)
    discovery['classificationCounts']=dict(Counter(r['classification'] for r in catalog))
    for group in discovery['groups']:
        rows=[r for r in catalog if r['sourceId']=='large' and r['group']==group['id']]
        group['examples']=[r['name'] for r in sorted(rows,key=lambda r:(not r['business'],r['name']))[:3]]
    linked=defaultdict(list)
    for row in catalog:
        if row['identity']:linked[row['identity']['key']].append(row)
    stats={'source':DART_URL,'download':DART_DOWNLOAD,'provider':'금융감독원 DART 기업개황',
           'checkedAt':CHECKED,'referenceRows':len(reference),'before':before,
           'after':{'unknownIndustry':sum(r['industry']=='unknown' for r in catalog),'missingBusiness':sum(not r['business'] for r in catalog),'missingHomepage':sum(not r['homepage'] for r in catalog)},
           'identityRows':sum(bool(r['identity']) for r in catalog),'identityGroups':len(linked),
           'multiSourceGroups':sum(len({r['sourceId'] for r in rs})>1 for rs in linked.values()),
           'multiSourceRows':sum(len(rs) for rs in linked.values() if len({r['sourceId'] for r in rs})>1),
           'identityStatus':dict(Counter(r['identityStatus'] for r in catalog)),
           'note':'조회 시점의 공시 기업개황을 공식 식별자로 대조했습니다. 원자료의 기업별 마지막 신고일·현재 영업 여부는 미확인입니다. 원 명부 행·이름·저장 ID는 유지하며, 전체 고유 기업 수로 환산하지 않습니다.'}
    return stats,ledger

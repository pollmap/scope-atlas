"""Normalize the public DART overview Excel, retaining business facts only.

The download is offered at DART's company overview page. The original workbook
stays in the internal QA directory; no officers, phone/fax, or raw workbook are
allowed into the public bundle. Registration identifiers are internal join keys.
"""
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

APP=Path(__file__).resolve().parents[1]
SOURCE=APP/'qa/scope/dart-company-download.bin'
OUT=APP.parent/'work/normalized/scope_dart_overview_20260920.json'
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
COLUMNS={'A':'legalName','C':'name','D':'stockCode','F':'market','G':'corporateNumber',
         'H':'businessNumber','I':'address','L':'homepage','N':'industry','O':'established'}
rows=[]
with zipfile.ZipFile(SOURCE) as z:
    for _,elem in ET.iterparse(z.open('xl/worksheets/sheet1.xml'),events=('end',)):
        if elem.tag!=NS+'row': continue
        if elem.attrib.get('r')=='1':
            header={re.sub(r'\d','',c.attrib['r']):''.join(c.itertext()) for c in elem}
            assert header['G']=='법인등록번호' and header['N']=='업종명',header
            elem.clear();continue
        row={}
        for cell in elem:
            col=re.sub(r'\d','',cell.attrib['r'])
            if col in COLUMNS:row[COLUMNS[col]]=''.join(cell.itertext()).strip()
        if row.get('name') or row.get('legalName'):rows.append(row)
        elem.clear()
OUT.write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
audit={'retrievedAt':'2026-09-20','source':'https://dart.fss.or.kr/dsae001/main.do',
       'download':'https://dart.fss.or.kr/dsae001/downloadExcel.do','rows':len(rows),
       'originalSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
       'normalizedSha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),
       'fields':list(COLUMNS.values()),'snapshotNote':'공개 기업개황의 조회 시점 스냅샷. 기업별 최종 신고일은 별도 미제공.'}
(APP/'qa/scope/dart-reference-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(audit,ensure_ascii=False,indent=2))

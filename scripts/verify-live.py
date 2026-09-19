"""Read-only public-release checks. No browser notes or authentication involved."""
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from pathlib import Path
import requests

APP=Path(__file__).resolve().parents[1]
DIST=APP/'dist/client'
BASE='https://scope-atlas.pages.dev'
targets=[('/',DIST/'index.html'),('/company/example',DIST/'index.html')]
targets += [('/'+p.relative_to(DIST).as_posix(),p) for p in DIST.rglob('*') if p.is_file() and p.suffix in ('.json','.js','.css')]

def check(target):
    path,file=target
    response=requests.get(BASE+path,headers={'User-Agent':'Mozilla/5.0','Cache-Control':'no-cache'},timeout=60)
    response.raise_for_status()
    actual=hashlib.sha256(response.content).hexdigest()
    expected=hashlib.sha256(file.read_bytes()).hexdigest()
    assert actual==expected,path
    return dict(path=path,status=response.status_code,contentType=response.headers.get('content-type'),bytes=len(response.content),sha256=actual,matchesBuild=True)

with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(check,targets))
report=dict(url=BASE,checkedAt=datetime.now(timezone.utc).isoformat(),result='passed',checks=results)
(APP/'qa/scope').mkdir(parents=True,exist_ok=True)
(APP/'qa/scope/pages-live-http.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'result':'passed','responses':len(results),'paths':[r['path'] for r in results]},ensure_ascii=False,indent=2))

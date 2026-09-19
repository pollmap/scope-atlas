import {readFileSync,readdirSync,statSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dist=new URL('../dist/client/',import.meta.url);
const base=decodeURIComponent(dist.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const privateFile=new URL('.release-private-patterns.json',root);
const privatePatterns=existsSync(privateFile)?JSON.parse(readFileSync(privateFile,'utf8')):[];
const files=[];
function walk(path){for(const name of readdirSync(path)){const full=join(path,name);if(statSync(full).isDirectory())walk(full);else files.push(full);}}
walk(base);
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const file of files){
 const rel=relative(base,file).replaceAll('\\','/');
 assert.ok(rel==='index.html'||rel==='_headers'||/^data\/(catalog|evidence|manifest)\.json$/.test(rel)||/^assets\/[^/]+\.(js|css|woff2)$/.test(rel),`Unexpected public file: ${rel}`);
 if(/\.(json|html|js|css)$/.test(rel)){const body=readFileSync(file,'utf8');assert.ok(!/C:[\\/]Users[\\/]|Bearer\s+[A-Za-z0-9._-]{20,}|ghp_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{20,}/.test(body),`Sensitive pattern: ${rel}`);
  for(const pattern of privatePatterns)assert.ok(!new RegExp(pattern,'i').test(body),`Private marker found: ${rel}`);
  assert.ok(!/career\.nis\.go\.kr|local\.gosi\.go\.kr/.test(body),`Out-of-scope exam link: ${rel}`);
 }
}
const dataFiles=['catalog','evidence','manifest'].map(name=>{
 const publicBytes=readFileSync(new URL(`public/data/${name}.json`,root));
 const deployedBytes=readFileSync(new URL(`data/${name}.json`,dist));
 assert.equal(hash(publicBytes),hash(deployedBytes));return {name,bytes:deployedBytes.length,sha256:hash(deployedBytes)};
});
const report={checkedAt:new Date().toISOString(),result:'passed',files:files.length,totalBytes:files.reduce((n,p)=>n+statSync(p).size,0),dataFiles,checks:['Only static app assets and 3 approved data files','No research archives, affiliate text, fixtures or credentials',privatePatterns.length?'Local private-marker checks passed':'Local private-marker configuration not provided','No civil-service or intelligence exam links','Built data SHA-256 equals reviewed public data'],limitation:'Allowlist and known-pattern inspection, not a guarantee of detection of every sensitive value.'};
mkdirSync(new URL('qa/',root),{recursive:true});
writeFileSync(new URL('qa/release-audit.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

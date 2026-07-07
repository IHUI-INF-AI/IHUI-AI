import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import * as esbuild from './client/node_modules/esbuild/lib/main.js';

const SRC = 'client/src';
const skipDirs = new Set(['__pycache__','node_modules','.venv','dist','__tests__']);
const files = [];
function walk(d){
  for(const n of readdirSync(d)){
    const p = join(d,n); const s = statSync(p);
    if(s.isDirectory()){ if(!skipDirs.has(n)) walk(p); }
    else { const e = extname(n); if(e==='.ts'||e==='.tsx'||e==='.vue') files.push(p); }
  }
}
walk(SRC);
console.log('scanning', files.length, 'ts/tsx/vue files');

let errCount=0; const errs=[];
for(const f of files){
  let code;
  try { code = readFileSync(f,'utf8'); } catch(e){ errs.push([f,'read:'+e.message]); continue; }
  if(f.endsWith('.vue')){
    // only match real <script ...> blocks (lang handled by tsx loader)
    const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/g; let m; let idx=0; let ok=true;
    while((m=re.exec(code))){
      const block=m[2];
      try { await esbuild.transform(block,{loader:'tsx'}); }
      catch(e){ ok=false; const er=e.errors?.[0]; errs.push([f+`#script${idx}`, er?`${er.text} @line ${er.location?.line}`:e.message]); }
      idx++;
    }
    if(!ok) errCount++;
    continue;
  }
  const loader = f.endsWith('.tsx')?'tsx':'ts';
  try { await esbuild.transform(code,{loader}); }
  catch(e){ errCount++; const er=e.errors?.[0]; errs.push([f, er?`${er.text} @line ${er.location?.line}`:e.message]); }
}
console.log('SYNTAX ERRORS:', errCount);
for(const [f,m] of errs.slice(0,120)) console.log('  ERR', f, '->', m);

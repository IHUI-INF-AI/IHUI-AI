#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const ROOT = process.cwd()
const EXCLUDE = new Set(['node_modules','.git','.next','.turbo','dist','build','.worktrees','.venv','venv','__pycache__','.pytest_cache','out','.cache','coverage','.output','.svelte-kit'])
const EXTS = ['.ts','.tsx','.js','.jsx']
function isExempt(line){const t=line.trim()
if(/<img\b[^>]*\brounded-full\b/.test(t))return true
if(/<Image\b[^>]*\brounded-full\b/.test(t))return true
if(/AvatarImage\b[^>]*\brounded-full\b/.test(t))return true
if(/block\s+rounded-full\s+bg-background\s+shadow-lg/.test(t))return true
if(/data-\[state=checked\]:translate-x/.test(t))return true
if(/data-\[state=unchecked\]:translate-x/.test(t))return true
if(/SwitchPrimitives\.Thumb/.test(t))return true
if(/SwitchThumb\b/.test(t))return true
if(/inline-flex\s+shrink-0\s+items-center\s+rounded-full\s+border-2\s+border-transparent/.test(t))return true
if(/flex\s+h-4\s+w-4\s+items-center\s+justify-center\s+rounded-full\s+border\s+border-input/.test(t))return true
if(/RadioPrimitive/.test(t))return true
if(/RadioGroupPrimitive/.test(t))return true
if(/<input[^>]*type="radio"[^>]*\brounded-full\b/.test(t))return true
if(/===\s*['"]circle['"]\s*\?[^)]*rounded-full/.test(t))return true
if(/shape\s*===\s*['"]circle['"]/.test(t)&&/rounded-full/.test(t))return true
if(/\brounded-full\b/.test(t)){const s=/\b(?:w|h)-(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?)\b/.test(t)
const b=/\bw-(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?)\b/.test(t)&&/\bh-(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?)\b/.test(t)
const n=!/\b(?:flex-1|px-[3-9]|px-\d{2}|py-[3-9]|py-\d{2}|p-[3-9]|p-\d{2}|text-base|text-lg|text-xl)\b/.test(t)
if(s&&b&&n)return true
if(/\b(?:w|h)-0\.5\b/.test(t))return true}
if(/\bbg-red-500\b/.test(t)&&/\brounded-full\b/.test(t)){if(/\b(?:min-w-\[?\d+px?\]?|h-4|w-4|h-5|min-w-5)\b/.test(t))return true
if(/\bpx-1\b/.test(t)&&/\b(?:absolute|top|right|left|bottom)/.test(t))return true}
if(/\banimate-(?:spin|bounce|ping|pulse)\b/.test(t)&&/\brounded-full\b/.test(t))return true
if(/\banimate-spin\b/.test(t)&&/\bborder\b/.test(t))return true
return false}
function pickRadius(line){const s=[];const r=/\b(?:h|w)-(\d+)(?:\.5)?\b/g;let m
while((m=r.exec(line))!==null)s.push(parseFloat(m[1]))
const mx=s.length>0?Math.max(...s):0
if(/\bw-full\b|\bflex-1\b/.test(line)&&/\bh-(?:1|1\.5|2)\b/.test(line))return 'rounded'
if(mx>=14)return 'rounded-2xl'
if(mx>=11)return 'rounded-xl'
if(mx>=8)return 'rounded-lg'
if(mx>=5)return 'rounded-md'
if(mx>=3)return 'rounded'
if(mx>=1)return 'rounded'
if(/\bpx-2\b.*\bpy-0\.5\b|\bpy-0\.5\b.*\bpx-2\b/.test(line))return 'rounded-md'
if(/\btext-xs\b.*\bpx-2\b|\bpx-2\b.*\btext-xs\b/.test(line))return 'rounded-md'
return 'rounded-md'}
function fix(line){if(isExempt(line))return{f:false,l:line,r:null}
let n=line;let r=null
if(/\brounded-full\b/.test(n)){const p=pickRadius(line);n=n.replace(/\brounded-full\b/g,p);r=`rounded-full→${p}`}
if(/\brounded-pill\b/.test(n)){n=n.replace(/\brounded-pill\b/g,'rounded-md');r=r||'rounded-pill→rounded-md'}
return{f:n!==line,l:n,r:r}}
function collect(d,res=[]){if(!existsSync(d))return res
for(const e of readdirSync(d)){if(EXCLUDE.has(e))continue
const f=join(d,e);const s=statSync(f)
if(s.isDirectory())collect(f,res)
else if(EXTS.some(x=>e.endsWith(x)))res.push(f)}
return res}
let files=[]
for(const sub of['apps','packages'])files=files.concat(collect(join(ROOT,sub)))
let tf=0;let td=0
for(const f of files){const src=readFileSync(f,'utf8');const ls=src.split('\n');let hf=false
ls.forEach((l,i)=>{const r=fix(l);if(r.f){hf=true;tf++;ls[i]=r.l}})
if(hf){td++;writeFileSync(f,ls.join('\n'))}}
console.log(`扫描:${files.length} 修改:${td} 修复:${tf}`)

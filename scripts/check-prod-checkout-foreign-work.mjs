#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产签出外来工作只读尺子(2026-10-21 立;判机器状态 ⇒ 不进提交链、不进 CI,§12e;
 * 唯一调度器 = scripts/git-guardian.mjs 经 git-guardian-prod-foreign.mjs 的 auditProdForeignWork())。
 *
 * 立因(当天 15:0x~16:1x 实测):生产服务与部署环跑**独立生产签出**(nssm `IHUI-DEPLOYLOOP`
 * AppDirectory/AppParameters 实测指向 `D:\DevEnv\ihui-prod` 形态,路径按当次现读,绝不硬编码)。
 * 16:0x 实测该签出里躺过 `apps/ai-service/app/services/model_catalog.py` 的工作区 blob `bf7ee8ab8c...`,
 * 而 prod HEAD 与 origin 两侧都是 `4159ac393c...` ⇒ 那 29 行新增只活在盘上,仓里没有、远端没有、
 * CI 看不见、任何提交链守门判不到,一次 `git checkout` 就静默蒸发。另有 11 枚 `A ` 的
 * `apps/web/app/(main)/plugins/plugins-data/market-plugins-parts/part-*.ts`(远端没有的新文件被
 * `git add` 进索引),一次 reset 就整批蒸发。
 *
 * 逐路径三态 + 一个独立统计,单列绝不并桶(§0.3):
 *   duplicate          工作区/索引 blob == 远端 tip 同路径 blob 或 == 该签出 HEAD blob(内容已在仓,无丢失风险)
 *   foreign            blob 在 prod HEAD 与 origin/main 两侧都取不到 ⇒ 真存续性风险(点名路径 + blob 前 12 位 + 行数差)
 *   unjudged           问不到 git / 签出不可读 / 比不了(单列;含"工作区 blob 取不到"的删除型)
 *   staged-untracked   别人在 prod `git add` 了远端没有的新文件(一次 reset 整批蒸发型)
 *
 * 两个已知坑(本仓踩过,判据写死在实现里):
 *   ① Git Bash 的 MSYS 路径改写会把 `origin/main:路径` 这种**冒号形态**重写成反斜杠 ⇒ git 假报
 *      "不存在",尺子把"比得了"读成"取不到"整片误判 foreign。一律 `git rev-parse`/`git cat-file`/
 *      `git ls-tree` 走 argv(本器取树内 blob 只用 `ls-tree <commit> -- <path>`,从不拼 `ref:path`)。
 *   ② blob 存在性只认 `git cat-file -e <sha>` 的**退出码结论**(0=在/非0=不在),绝不解析输出文本。
 *
 * 诚实边界(立项时如实登记,不为凑绿说话):
 *   - duplicate-only 不发信:内容已在仓里,无丢失风险;但它们会挡 ff(14:27/15:5x 两枚部署冻结即此型),
 *     那一格由 auditDeployStall 的停摆判据负责,本格不重复盖一层。
 *   - 本器只读:不 fetch(远端 tip = 本地 origin/main ref 现读)、不写生产签出一字节、不代删代提交。
 *   - 判不到的型:工作区 blob 与 HEAD/origin **都**取得到但组合出别的形态(如把 HEAD 版本挪到新路径)
 *     落 duplicate/foreign 的既有格;本器不判"语义上是不是该提交",只判"内容在不在仓里"。
 *
 * 用法:node scripts/check-prod-checkout-foreign-work.mjs [--json]
 * 退出码:0 = 生产签出干净(或只有 duplicate,无丢失风险);1 = 有 foreign / staged-untracked /
 *   unjudged 脏路径(枚举成功但存在不冒绿的项);2 = 未判定到给不出任何结论(nssm 取不到实跑路径 /
 *   签出不是 git 工作树 / git status 失败 —— 绝不回落默认目录)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
// §0.6 单一真相源:nssm 判读与候选路径复用 check-service-binary-paths 的出口,禁抄第二份
import { NSSM_CANDIDATES, interpretNssmGet } from './check-service-binary-paths.mjs'
import { resolveGitBin } from './lib/gitdir.mjs'

const PROD_SERVICE = 'IHUI-DEPLOYLOOP'
const ORIGIN_REF = 'origin/main'
const GIT_TIMEOUT_MS = 60_000
const NSSM_TIMEOUT_MS = 5_000
/** 一次 argv 批量查树的路径上限(超了分批,防命令行截断静默丢路径)。 */
const LS_TREE_BATCH = 40

/** 派生出口:显式 stdio + windowsHide(§12g;本器从不带 input ⇒ stdin 恒 'ignore',门 193 的
 *  input↔stdin 取值维不适用)。返回 code/stdout/stderr 的 buffer 形态,由调用方解码。 */
function runCapture(file, args, opts = {}) {
  try {
    const out = spawnSync(file, args, {
      cwd: opts.cwd,
      windowsHide: true,
      timeout: opts.timeoutMs ?? GIT_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (out.error) return { code: -1, stdout: '', stderr: String(out.error.code || out.error.message || 'spawn-error') }
    return { code: out.status ?? -1, stdout: String(out.stdout ?? ''), stderr: String(out.stderr ?? '') }
  } catch (e) {
    return { code: -1, stdout: '', stderr: String(e?.message || e) }
  }
}

const GIT_BASE = ['-c', 'safe.directory=*']

/** 生产签出实跑路径的唯一取值处:先 nssm AppDirectory,取不到再从 AppParameters 的 ps1 路径推导
 *  (`<root>\deploy\win\*.ps1` ⇒ 截到 `\deploy\` 之前)。两级都落空 ⇒ unjudged,绝不回落默认目录。 */
export function resolveProdCheckout({ exists = existsSync, isDirectory, nssmGet } = {}) {
  const dirProbe = (p) => {
    try {
      if (!exists(p) || !(isDirectory ? isDirectory(p) : statSync(p).isDirectory())) return false
    } catch {
      return false
    }
    return true
  }
  const validRoot = (p) => typeof p === 'string' && p !== '' && dirProbe(p) && exists(join(p, '.git'))
  const why = []
  const read = (param) => {
    const raw = nssmGet ? nssmGet(param) : nssmGetRaw(param)
    return interpretNssmGet(raw)
  }
  const dir = read('AppDirectory')
  if (dir.kind === 'measured' && dir.value && validRoot(dir.value)) return { state: 'ok', root: dir.value, via: 'AppDirectory' }
  if (dir.kind === 'measured') why.push(`AppDirectory=${dir.value || '(空)'} 不是带 .git 的目录`)
  else why.push(`AppDirectory 取不到(${dir.reason})`)
  const par = read('AppParameters')
  if (par.kind === 'measured' && par.value) {
    const m = /^"([^"]+)"/.exec(par.value) || /^(\S+)/.exec(par.value)
    const tok = m ? m[1] || m[2] : ''
    const low = tok.toLowerCase()
    if (/\.(ps1|cmd|bat)$/.test(low) && low.includes('\\deploy\\')) {
      const root = tok.slice(0, low.lastIndexOf('\\deploy\\'))
      if (validRoot(root)) return { state: 'ok', root, via: 'AppParameters' }
      why.push(`AppParameters 推导根 ${root} 不是带 .git 的目录`)
    } else why.push('AppParameters 首段不是 <root>\\deploy\\ 下的可执行脚本')
  } else why.push(`AppParameters 取不到(${par.kind === 'unmeasured' ? par.reason : '空'})`)
  return { state: 'unjudged', why: why.join('; ') }
}

/** nssm get 实跑(测试注入假 nssmGet 时不会走到这里)。nssm stdout 是无 BOM 的 UTF-16LE,
 *  必须把原始 buffer 交给 interpretNssmGet 走 decodeNssm 按 NUL 密度解码,不能先按 utf8 解成坏串。 */
function nssmGetRaw(param) {
  const nssm = NSSM_CANDIDATES.find((p) => existsSync(p))
  if (!nssm) return { spawnError: 'ENOENT', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
  try {
    const out = spawnSync(nssm, ['get', PROD_SERVICE, param], {
      windowsHide: true,
      timeout: NSSM_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (out.error) return { spawnError: out.error.code || 'spawn-error', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
    return { code: out.status ?? -1, stdoutBuf: out.stdout ?? Buffer.alloc(0), stderrBuf: out.stderr ?? Buffer.alloc(0) }
  } catch (e) {
    return { spawnError: String(e?.code || e?.message || 'spawn-throw'), stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
  }
}

/** `git status --porcelain=v1 -z` 解析(含重命名的双 NUL 段;目的路径为准)。 */
export function parsePorcelainZ(text) {
  const parts = String(text ?? '').split('\0')
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]
    if (seg === '' || seg.length < 4) continue
    const status = seg.slice(0, 2)
    const path = seg.slice(3)
    if (status.includes('R') || status.includes('C')) i++ // rename/copy 的第二个 NUL 段是原始路径
    out.push({ status, path })
  }
  return out
}

/** `git ls-tree -z <commit> -- paths` ⇒ Map(path→blobSha)。坑①:paths 全走 argv,从不拼 `commit:path`。 */
function lsTreeMap(git, root, commitish, paths) {
  const map = new Map()
  for (let i = 0; i < paths.length; i += LS_TREE_BATCH) {
    const batch = paths.slice(i, i + LS_TREE_BATCH)
    const r = runCapture(git, [...GIT_BASE, '-C', root, 'ls-tree', '-z', commitish, '--', ...batch])
    if (r.code !== 0) return { ok: false, why: `ls-tree ${commitish} exit ${r.code}: ${r.stderr.trim().slice(0, 120)}` }
    for (const seg of r.stdout.split('\0')) {
      if (seg === '') continue
      const tab = seg.indexOf('\t')
      if (tab < 0) continue
      const meta = seg.slice(0, tab).split(' ')
      if (meta[1] === 'blob') map.set(seg.slice(tab + 1), meta[2])
    }
  }
  return { ok: true, map }
}

/**
 * 分类判据唯一实现(镜像测试 import;变异对照钉在这里):
 *   摘松(只比 origin、丢掉 HEAD 侧):`workBlob == headBlob ∧ != originBlob` 的条目会被误判 foreign
 *     —— 用例以该输入形状断言 'duplicate',摘松即翻红。
 *   摘紧(还要求索引里也有条目才算 foreign):untracked 新文件没有索引项,会被漏判
 *     —— 用例以该输入形状断言 'foreign',摘紧即漏报。
 * 注意:未暂存改动的索引 blob 恒等于 HEAD blob(索引存的是 HEAD 版),所以 duplicate 只看
 * 工作区 blob 与两侧的等值;"索引 blob == 远端 tip"在有未暂存改动时恒真,拿它判 duplicate
 * 会把每一处未暂存改动都读成安全(实测推演后废弃的写法,留注防回潮)。
 */
export function classifyEntry(e) {
  if (e.idxBlob && e.idxExists === false) return { bucket: 'unjudged', why: '索引 blob 不在对象库(cat-file -e 非零)' }
  if (!e.workBlob) return { bucket: 'unjudged', why: `工作区 blob 取不到(status=${e.status})` }
  if (e.workBlob === e.originBlob || e.workBlob === e.headBlob) return { bucket: 'duplicate' }
  if (e.idxExists && e.idxBlob && !e.inOrigin) return { bucket: 'staged-untracked' }
  return { bucket: 'foreign' } // 两侧都取不到(含全新未跟踪;§0.3:枚举到 ≠ 判死,这里判的就是死)
}

/** 退出码映射(测试 import 钉;main 用同一份,不抄第二份):unjudged=2 / dirty=1 / 其余=0。 */
export function exitFor(result) {
  if (!result || result.state === 'unjudged') return 2
  return result.state === 'dirty' ? 1 : 0
}

function lineDiffFor(git, root, e) {
  const d = runCapture(git, [...GIT_BASE, '-C', root, 'diff', '--numstat', 'HEAD', '--', e.path])
  if (d.code === 0 && d.stdout.trim() !== '') {
    const f = d.stdout.split('\n')[0].split('\t')
    const n = (x) => (Number.isInteger(Number(x)) ? Number(x) : null)
    return { added: n(f[0]), deleted: n(f[1]) }
  }
  if (!e.inHead && !e.inOrigin && !e.idxExists) {
    try {
      return { added: readFileSync(join(root, e.path), 'utf8').split('\n').length, deleted: 0 }
    } catch {
      return null
    }
  }
  return null
}

/** 主探测(同步,只读):返回 {state,counts,...,line}。 */
export function probeProdCheckout(root, { git = resolveGitBin() || 'git' } = {}) {
  const line = (state, c) =>
    `PROBE-RESULT state=${state} foreign=${c.foreign} duplicate=${c.duplicate} staged=${c.staged} untracked=${c.untracked} unjudged=${c.unjudged}`
  const empty = { foreign: 0, duplicate: 0, staged: 0, unjudged: 0, untracked: 0 }
  const st = runCapture(git, [...GIT_BASE, '-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'])
  if (st.code !== 0) {
    const r = { state: 'unjudged', prodRoot: root, why: `git status exit ${st.code}: ${st.stderr.trim().slice(0, 160)}`, counts: { ...empty }, foreign: [], staged: [], duplicates: [], unjudged: [] }
    r.line = line('unjudged', r.counts)
    return r
  }
  const allEntries = parsePorcelainZ(st.stdout)
  // 未跟踪(`??`)条目**不进逐项判据**:它们结构上没有索引 blob(`ls-files -s` 对它们恒空返回),
  // 却会把 argv 顶穿 Windows 命令行上限、并把逐项 cat-file/hash-object 打成几万发。
  // 立项实测:生产签出出现过 23,559 条 `??`(路径字符合计约 2.3MB)⇒ 整档永久 unjudged,
  // 而这把尺子的失效方向恰恰是"安静"。所以它们改为**只计数、不判定**,计数必须出现在结论行
  // (不许被静默折成 0);真正要守的存续性风险是"已入索引/已跟踪却被改动"的那些。
  const entries = allEntries.filter((e) => e.status !== '??')
  const untrackedCount = allEntries.length - entries.length
  const result = {
    state: 'clean',
    prodRoot: root,
    counts: { ...empty, untracked: untrackedCount },
    foreign: [],
    staged: [],
    duplicates: [],
    unjudged: [],
  }
  if (entries.length === 0) {
    result.line = line('clean', result.counts)
    return result
  }
  const paths = [...new Set(entries.map((e) => e.path))]
  const head = lsTreeMap(git, root, 'HEAD', paths)
  if (!head.ok) return { ...result, state: 'unjudged', why: head.why, line: line('unjudged', result.counts) }
  const origin = lsTreeMap(git, root, ORIGIN_REF, paths)
  if (!origin.ok) return { ...result, state: 'unjudged', why: origin.why, line: line('unjudged', result.counts) }
  const idx = new Map()
  // 分批同上两处 ls-tree(同一个 Windows argv 上限,同一把尺子不许一处修一处不修)
  for (let i = 0; i < paths.length; i += LS_TREE_BATCH) {
    const batch = paths.slice(i, i + LS_TREE_BATCH)
    const lf = runCapture(git, [...GIT_BASE, '-C', root, 'ls-files', '-s', '-z', '--', ...batch])
    if (lf.code !== 0)
      return { ...result, state: 'unjudged', why: `ls-files exit ${lf.code}`, line: line('unjudged', result.counts) }
    for (const seg of lf.stdout.split('\0')) {
      if (seg === '') continue
      const tab = seg.indexOf('\t')
      if (tab < 0) continue
      const meta = seg.slice(0, tab).split(' ')
      idx.set(seg.slice(tab + 1), meta[1])
    }
  }
  for (const entry of entries) {
    const p = entry.path
    const e = {
      path: p,
      status: entry.status,
      headBlob: head.map.get(p) ?? null,
      originBlob: origin.map.get(p) ?? null,
      inHead: head.map.has(p),
      inOrigin: origin.map.has(p),
      idxBlob: idx.get(p) ?? null,
      idxExists: undefined,
      workBlob: null,
    }
    if (e.idxBlob) {
      const ce = runCapture(git, [...GIT_BASE, '-C', root, 'cat-file', '-e', e.idxBlob]) // 坑②:只认退出码结论
      e.idxExists = ce.code === 0
    } else e.idxExists = false
    const h = runCapture(git, [...GIT_BASE, '-C', root, 'hash-object', '--', p])
    if (h.code === 0 && h.stdout.trim() !== '') e.workBlob = h.stdout.trim()
    const verdict = classifyEntry(e)
    if (verdict.bucket === 'duplicate') {
      result.duplicates.push({ path: p, blob: (e.workBlob || e.idxBlob || '').slice(0, 12) })
      result.counts.duplicate++
    } else if (verdict.bucket === 'staged-untracked') {
      result.staged.push({ path: p, blob: (e.idxBlob || e.workBlob || '').slice(0, 12) })
      result.counts.staged++
    } else if (verdict.bucket === 'foreign') {
      result.foreign.push({ path: p, blob: (e.workBlob || e.idxBlob || '').slice(0, 12), lineDiff: lineDiffFor(git, root, e) })
      result.counts.foreign++
    } else {
      result.unjudged.push({ path: p, why: verdict.why })
      result.counts.unjudged++
    }
  }
  const c = result.counts
  if (c.foreign > 0 || c.staged > 0 || c.unjudged > 0) result.state = 'dirty'
  else if (c.duplicate > 0) result.state = 'duplicate'
  result.line = line(result.state, c)
  return result
}

async function main() {
  const json = process.argv.includes('--json')
  const resolved = resolveProdCheckout()
  if (resolved.state !== 'ok') {
    const msg = `PROBE-RESULT state=unjudged foreign=0 duplicate=0 staged=0 untracked=0 unjudged=0 // 未判定:${resolved.why}`
    if (json)
      console.log(
        JSON.stringify({
          state: 'unjudged',
          why: resolved.why,
          counts: { foreign: 0, duplicate: 0, staged: 0, unjudged: 0, untracked: 0 },
          line: msg,
        }),
      )
    else console.error(msg)
    process.exit(2)
  }
  const result = probeProdCheckout(resolved.root)
  result.resolvedVia = resolved.via
  if (json) console.log(JSON.stringify(result, null, 2))
  else {
    for (const [label, list] of [['foreign', result.foreign], ['staged-untracked', result.staged], ['duplicate', result.duplicates], ['unjudged', result.unjudged]]) {
      for (const it of list) console.log(`[${label}] ${JSON.stringify(it)}`)
    }
    if (result.why) console.log(`[unjudged-run] ${result.why}`)
    console.log(result.line)
  }
  process.exit(exitFor(result))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { PROD_SERVICE, ORIGIN_REF, classifyEntry, exitFor, parsePorcelainZ, probeProdCheckout, resolveProdCheckout, nssmGetRaw }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

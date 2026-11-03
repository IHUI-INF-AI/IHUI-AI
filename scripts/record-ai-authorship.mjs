// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AI 代码归属 notes 的记录/校验 CLI(判据与读写单源 = scripts/lib/ai-authorship-notes.mjs)。
// 退出码:0 已记录/校验通过 · 1 业务失败 · 2 未判定(§0.3,取不到输入不记绿也不记红)。
// 消费方接线形态(safe-commit 成功路径,fail-open):
//   import { recordForCommit } from './lib/ai-authorship-notes.mjs'
//   try { recordForCommit({ commit: sha, session, declaredPaths, model, tool }) } catch { /* 绝不影响提交 */ }

import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  NOTES_REF_DEFAULT,
  notesRefForNamespace,
  recordForCommit,
  verifyRecord,
  decideAttribution,
  buildEntry,
  buildPayload,
  mergeEntry,
  verifyIntegrity,
  dedupeKeyOf,
} from './lib/ai-authorship-notes.mjs'

const EXIT = { ok: 0, failed: 1, undetermined: 2 }

function parseArgs(argv) {
  const opts = { declaredPaths: [], commit: 'HEAD', namespace: 'default', dryRun: false, json: false, verify: false, selfTest: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      i += 1
      if (i >= argv.length) throw new Error(`${a} 缺少取值`)
      return argv[i]
    }
    switch (a) {
      case '--commit':
        opts.commit = next()
        break
      case '--session':
        opts.session = next()
        break
      case '--namespace':
        opts.namespace = next()
        break
      case '--repo':
        opts.repoDir = next()
        break
      case '--model':
        opts.model = next()
        break
      case '--tool':
        opts.tool = next()
        break
      case '--event':
        opts.event = next()
        break
      case '--declared':
        opts.declaredPaths.push(...next().split(',').map((s) => s.trim()).filter(Boolean))
        break
      case '--declared-file':
        opts.declaredPaths.push(...readFileSync(next(), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
        break
      case '--dry-run':
        opts.dryRun = true
        break
      case '--json':
        opts.json = true
        break
      case '--verify':
        opts.verify = true
        break
      case '--self-test':
        opts.selfTest = true
        break
      default:
        throw new Error(`不认识的参数:${a}`)
    }
  }
  opts.session = opts.session || process.env.IHUI_AGENT_SESSION_ID || ''
  return opts
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  t('namespace 默认与派生', () => {
    if (notesRefForNamespace('default') !== NOTES_REF_DEFAULT) throw new Error('默认 ref 不对')
    if (notesRefForNamespace('wip') !== 'refs/notes/ihui-ai-wip') throw new Error('命名空间 ref 不对')
    let threw = false
    try {
      notesRefForNamespace('Bad NS')
    } catch {
      threw = true
    }
    if (!threw) throw new Error('非法命名空间必须抛')
  })
  t('dedupe_key 与路径顺序无关', () => {
    const a = dedupeKeyOf({ session: 's', commit: 'c', paths: ['b.ts', 'a.ts'] })
    const b = dedupeKeyOf({ session: 's', commit: 'c', paths: ['a.ts', 'b.ts'] })
    if (a !== b) throw new Error('哈希未归一')
  })
  t('undetermined 显式产出且点名原因', () => {
    const d = decideAttribution({ sha: 'c', parentCount: 1, changedPaths: ['a.ts'], declaredPaths: ['a.ts'], dirtyPaths: ['a.ts'], session: 's' })
    if (d.status !== 'undetermined' || !d.reasons.some((r) => r.startsWith('worktree-copy-diverged'))) throw new Error(JSON.stringify(d))
    const m = decideAttribution({ sha: 'c', parentCount: 2, changedPaths: ['a.ts'], declaredPaths: ['a.ts'], session: 's' })
    if (m.status !== 'undetermined' || !m.reasons.includes('merge-commit-not-hunk-attributable')) throw new Error(JSON.stringify(m))
  })
  t('他席内容不产生归属断言', () => {
    const d = decideAttribution({ sha: 'c', parentCount: 1, changedPaths: ['mine.ts', 'theirs.ts'], declaredPaths: ['mine.ts'], session: 's' })
    if (d.status !== 'attributed') throw new Error(d.status)
    if (d.ai_paths.join() !== 'mine.ts' || d.external_paths.join() !== 'theirs.ts') throw new Error(JSON.stringify(d))
  })
  t('幂等:同 dedupe_key 重记不增长条目', () => {
    const e = buildEntry({ session: 's', commit: 'c', decision: { status: 'attributed', ai_paths: ['a'], external_paths: [], undetermined_paths: [], reasons: [] }, recordedAt: '2026-01-01T00:00:00.000Z' })
    let p = buildPayload([])
    p = mergeEntry(p, e)
    const before = p.entries.length
    p = mergeEntry(p, { ...e, recordedAt: '2026-01-02T00:00:00.000Z' })
    if (p.entries.length !== before) throw new Error('条目重复增长了')
    if (verifyIntegrity(p).state !== 'ok') throw new Error('完整性自检不过')
  })
  t('篡改必被 verifyIntegrity 点名', () => {
    const p = buildPayload([{ dedupe_key: 'k', session: 's', commit: 'c', status: 'attributed', ai_paths: ['a'], external_paths: [], undetermined_paths: [], reasons: [], recorded_at: 'x' }])
    p.entries[0].ai_paths = ['a', 'forged']
    if (verifyIntegrity(p).state !== 'mismatch') throw new Error('篡改未检出')
  })
  let pass = 0
  for (const c of cases) {
    try {
      c.fn()
      pass += 1
    } catch (e) {
      console.error(`✗ ${c.name}:${e.message}`)
    }
  }
  console.log(pass === cases.length ? `self-test: ${pass}/${cases.length} passed` : `self-test: ${pass}/${cases.length} passed(有失败)`)
  return pass === cases.length ? EXIT.ok : EXIT.failed
}

function main(argv = process.argv.slice(2)) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (e) {
    console.error(`✗ ${e.message}`)
    return EXIT.failed
  }
  if (opts.selfTest) return selfTest()
  const out = (payload, code, lines) => {
    if (opts.json) console.log(JSON.stringify(payload, null, 2))
    else for (const l of lines || []) console.log(l)
    return code
  }
  if (opts.verify) {
    const r = verifyRecord({ repoDir: opts.repoDir, commit: opts.commit, namespace: opts.namespace })
    const code = r.state === 'ok' ? EXIT.ok : r.state === 'mismatch' ? EXIT.failed : EXIT.undetermined
    return out(r, code, [
      `AI-verify state=${r.state} ref=${r.ref || notesRefForNamespace(opts.namespace)}` + (r.fp ? ` fp=${r.fp.slice(0, 12)}` : ''),
      ...(r.issues || []).map((i) => `  issue: ${i}`),
      r.why ? `  why: ${r.why}` : '',
    ].filter(Boolean))
  }
  const r = recordForCommit({
    repoDir: opts.repoDir,
    commit: opts.commit,
    session: opts.session,
    declaredPaths: opts.declaredPaths,
    event: opts.event || 'checkpoint',
    model: opts.model || '',
    tool: opts.tool || '',
    namespace: opts.namespace,
    dryRun: opts.dryRun,
  })
  const code = r.state === 'recorded' || r.state === 'would-record' ? EXIT.ok : r.state === 'undetermined' ? EXIT.undetermined : EXIT.failed
  return out(r, code, [
    `AI-authorship state=${r.state}` + (r.entry ? ` status=${r.entry.status} ai=${r.entry.ai_paths.length} external=${r.entry.external_paths.length} undetermined=${r.entry.undetermined_paths.length}` : ''),
    ...(r.reasons || []).map((x) => `  reason: ${x}`),
    r.hint ? `  hint: ${r.hint}` : '',
  ].filter(Boolean))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main()

export const __test__ = { main, parseArgs, EXIT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

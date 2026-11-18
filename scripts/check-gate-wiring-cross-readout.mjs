// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 只读对账器（**刻意不接提交链**）：把 `evaluate_gate_suite` 的"生产消费者数"用
// 两把互相独立的尺子量同一件事，任一取不到/不一致 ⇒ exit 2 显式未判定（§0.3）。
//
//   尺 A：本仓 Python 装车观测仪 app/services/gate_wiring_instrument.py（含仪器自证）
//   尺 B：git grep 独立扫调用点（不共享尺 A 的任何判据词表）
//
// 立因（2026-11-18 / Round 61 教训）：上一轮我用自己刚造的尺报了"6/6 声明漂移 ⇒ 上游真因"，
// 那是假信号 —— 新尺子没对**已知-good 对照**校准就出结论。本器把那次纠正固化成可重复动作：
// 尺 A 必须先在自己内置的正/负夹具上自证，再与尺 B 交叉，两尺不合不报任何结论。
//
// 用法：node scripts/check-gate-wiring-cross-readout.mjs [--json]
// 退出码：0 两尺一致 / 1 两尺不一致（真缺陷，须人看）/ 2 未判定（取不到输入，不记绿也不冒红）

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const AI_SERVICE = path.join(ROOT, 'apps', 'ai-service')
const TOKEN = 'evaluate_gate_suite'
/** 声明面/说明书/夹具：两尺共用的排除口径（写在这里是为了让两尺**必须**用同一份）。 */
const DECLARATION_SUBSTRINGS = [
  'reverse_engineered_gates',
  'reverse_engineered_gate_wiring',
  'gate_wiring_instrument',
]
const TEST_PATH_MARK = `${path.sep}tests${path.sep}`

// §22d：判"直跑"必须用 pathToFileURL —— 手拼 'file:///' + argv[1] 在 Windows 反斜杠下永不匹配。
const isDirectRun = () => {
  const entry = process.argv[1]
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href
}

function gitGrepConsumerPaths() {
  // 测试注入缝：判别力用例需要造"两尺不合"，不能靠往生产树写文件
  if (Array.isArray(globalThis.__GIT_GREP__)) return [...globalThis.__GIT_GREP__]
  // -l 只列文件名；-- 固定路径面；stdio 显式接管（§12g：派生 git 不写 stdio 稳定 EBUSY）
  const out = execFileSync('git', ['grep', '-l', TOKEN, '--', 'apps/ai-service'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  })
  return out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function runInstrument() {
  // 测试注入缝（同上）：给定 {selfcheck, decl, sites} 即跳过真子进程
  if (globalThis.__INSTRUMENT__) {
    const o = globalThis.__INSTRUMENT__
    return {
      selfcheck: o.selfcheck ?? null,
      decl: o.decl ?? DECLARATION_SUBSTRINGS,
      sites: o.sites ?? null,
      raw: '',
    }
  }
  const snippets = [
    'import json,sys',
    'sys.path.insert(0,"apps/ai-service")',
    'from app.services import reverse_engineered_gates as g',
    'from app.services import gate_wiring_instrument as gi',
    'sc=gi.run_instrument_selfcheck()',
    'print("SELFCHECK "+json.dumps(sc,ensure_ascii=False))',
    'print("DECL "+json.dumps(list(gi.DECLARATION_SUBSTRINGS),ensure_ascii=False))',
    'sites=[]',
    'for k,v in gi.scan_wiring({p:open(p,encoding="utf-8",errors="replace").read() for p in sys.argv[1:]}).get("consumer_sites",{}).items():',
    '    sites+=v',
    'print("SITES "+json.dumps(sorted(set(sites)),ensure_ascii=False))',
  ].join('\n')
  const paths = gitGrepConsumerPaths()
    .filter((p) => !p.includes('/tests/'))
    .map((p) => path.join(ROOT, p))
  const out = execFileSync(pythonExe(), ['-c', snippets, ...paths], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  })
  const pick = (tag) => {
    const line = out.split(/\r?\n/).find((l) => l.startsWith(tag + ' '))
    return line ? JSON.parse(line.slice(tag.length + 1)) : null
  }
  return { selfcheck: pick('SELFCHECK'), decl: pick('DECL'), sites: pick('SITES'), raw: out }
}

function pythonExe() {
  const local = path.join(AI_SERVICE, '.venv', 'Scripts', 'python.exe')
  try {
    execFileSync(local, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true })
    return local
  } catch {
    return 'python'
  }
}

function normalize(list) {
  return [...new Set(list.map((p) => p.replace(/\\/g, '/').replace(/^\.\/+/, '')))].sort()
}

export function crossReadout() {
  let instrument = null
  let gitPaths = null
  const notes = []
  try {
    gitPaths = normalize(gitGrepConsumerPaths())
  } catch (e) {
    notes.push(`尺B取不到: ${String(e && e.message ? e.message : e).slice(0, 180)}`)
  }
  try {
    instrument = runInstrument()
  } catch (e) {
    notes.push(`尺A取不到: ${String(e && e.message ? e.message : e).slice(0, 180)}`)
  }
  if (!gitPaths || !instrument || !instrument.selfcheck || !instrument.sites) {
    return {
      state: 'undetermined',
      reason: notes.join(' | ') || '两尺之一未产出读数',
      instrument,
      gitPaths,
    }
  }
  if (instrument.selfcheck.ok !== true) {
    return {
      state: 'undetermined',
      reason: `尺A仪器自证未过 ⇒ 其读数不得用于任何结论（先修尺）：${JSON.stringify(instrument.selfcheck)}`,
      instrument,
      gitPaths,
    }
  }
  // 两尺共用同一份声明面口径；不一致说明有人在第二处自立词表（§0.6 单一真相源）
  if (
    JSON.stringify(normalize(instrument.decl)) !== JSON.stringify(normalize(DECLARATION_SUBSTRINGS))
  ) {
    return {
      state: 'undetermined',
      reason: `声明面口径漂移：尺A=${JSON.stringify(instrument.decl)} 本器=${JSON.stringify(DECLARATION_SUBSTRINGS)}`,
      instrument,
      gitPaths,
    }
  }
  const gitConsumers = normalize(
    gitPaths.filter(
      (p) =>
        !p.includes(TEST_PATH_MARK.replace(/\\/g, '/')) &&
        !DECLARATION_SUBSTRINGS.some((s) => p.includes(s)),
    ),
  )
  const instConsumers = normalize(instrument.sites)
  const agree = JSON.stringify(gitConsumers) === JSON.stringify(instConsumers)
  return {
    state: agree ? 'agree' : 'disagree',
    consumers: gitConsumers.length,
    git_consumers: gitConsumers,
    instrument_consumers: instConsumers,
    git_paths_seen: gitPaths.length,
    instrument: instrument.selfcheck,
    reason: agree
      ? `两尺一致（含夹具正例校验：仪器自证已在其内置 1 真阳 + 3 真阴上通过）`
      : `两尺不一致：尺B=${JSON.stringify(gitConsumers)} 尺A=${JSON.stringify(instConsumers)} ⇒ 真缺陷，须人看`,
  }
}

function main() {
  const r = crossReadout()
  const asJson = process.argv.includes('--json')
  if (asJson) process.stdout.write(JSON.stringify(r, null, 2) + '\n')
  else {
    process.stdout.write(
      `[gate-wiring-cross] state=${r.state} consumers=${r.consumers ?? 'n/a'}\n  ${r.reason}\n` +
        `  尺B(git grep) = ${JSON.stringify(r.git_consumers ?? r.gitPaths ?? null)}\n` +
        `  尺A(仪器)     = ${JSON.stringify(r.instrument_consumers ?? null)}\n`,
    )
  }
  if (r.state === 'agree') return 0
  if (r.state === 'disagree') return 1
  return 2
}

if (isDirectRun()) {
  try {
    process.exit(main())
  } catch (e) {
    process.stdout.write(`[gate-wiring-cross] 未判定：${String(e && e.message ? e.message : e)}\n`)
    process.exit(2)
  }
}

export const __test__ = { crossReadout, normalize, DECLARATION_SUBSTRINGS, TOKEN }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

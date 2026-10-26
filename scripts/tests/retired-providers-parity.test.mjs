// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端对账:退役 provider 前缀清单(apps/api TS 侧 ≡ apps/ai-service Python 侧)+ 4 个调用点退役字面量清零。
//
// 为什么要有这一件(2026-10-26 立):
//   stepfun(阶跃星辰)订阅失效后被机主永久除名。Python 侧已有单一真相源
//   `app/core/default_model.py` 的 `RETIRED_MODEL_PREFIXES`,TS 侧(apps/api)本轮新建
//   `src/utils/retired-providers.ts` 的 `RETIRED_PROVIDER_PREFIXES`。
//   跨语言没法 import,于是"两份清单"本身就是漂移源 —— 任一侧新增/删除退役 provider 而
//   忘了另一侧,守卫就会一边认、一边不认,退役档照样能从某一侧回到调用链。
//   本件把两侧**逐字**钉在一起:任何一侧增删都必须同改另一侧,否则红。
//
// 取材面说明:本件读**工作树**(两侧都在本次改动中;TS 侧新文件尚不在 HEAD 面,
// 按 HEAD 面判会得到"未判定"而非结论)。本件不改任何仓内真实文件 —— 变体自证的夹具
// 落在仓内 `.ihui-agent/tmp/`(git 忽略面),跑完即删。
//
// 用法:
//   node --test scripts/tests/retired-providers-parity.test.mjs
//   node scripts/tests/retired-providers-parity.test.mjs --self-check <根目录>   # 判据单独跑(变体自证用)
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const SELF = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(SELF), '..', '..')

/** Python 侧真相源(单一真相源) */
const PY_FILE = 'apps/ai-service/app/core/default_model.py'
/** TS 侧真相源(本轮新建) */
const TS_FILE = 'apps/api/src/utils/retired-providers.ts'
/** 4 个默认模型调用点(本轮收口) */
const CALL_SITES = [
  'apps/api/src/services/ai-feed-service.ts',
  'apps/api/src/services/crew-llm-adapter.ts',
  'apps/api/src/utils/conversation-title.ts',
  'apps/api/src/utils/semantic-summary.ts',
]
/** 已退役的模型 id 字面量:4 个调用点里不得再出现(代码与注释 alike) */
const RETIRED_MODEL_LITERAL = 'stepfun/step-3.7-flash'
/** 夹具落点:仓内 .ihui-agent/tmp(git 忽略面);禁 os.tmpdir() */
const FIXTURE_BASE = join(ROOT, '.ihui-agent', 'tmp', 'retired-providers-parity')

/**
 * 从源码里解析「某个常量赋值的前缀清单」。
 *
 * 取材:先按 `标识符 … =` 定位赋值行,再用括号配对取字面量正文 —— 不写死
 * Python 的 `tuple[...]` / TS 的 `as const` 形态,两侧同一把尺。
 *
 * @returns {{state:'parsed'|'unparsed', members:string[], why:string}}
 *   `unparsed` = **未判定**(取不到输入),调用方必须按红计,不得当成空集合放行。
 */
export function parsePrefixMembers(source, identifier) {
  const assignRe = new RegExp(`\\b${identifier}\\b[\\s\\S]{0,300}?=\\s*([\\[(])`)
  const m = assignRe.exec(source)
  if (!m) return { state: 'unparsed', members: [], why: `找不到 ${identifier} 的赋值` }
  const start = m.index + m[0].length - 1
  const open = source[start]
  const close = open === '[' ? ']' : ')'
  let depth = 0
  let end = -1
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return { state: 'unparsed', members: [], why: `${identifier} 的清单字面量没闭合` }
  const body = source.slice(start + 1, end)
  const members = []
  for (const q of body.matchAll(/'([^']*)'|"([^"]*)"/g)) members.push(q[1] ?? q[2])
  if (members.length === 0) {
    return { state: 'unparsed', members: [], why: `${identifier} 的清单里解析出 0 个成员` }
  }
  return { state: 'parsed', members, why: '' }
}

/**
 * 跑一遍对账判据(只读;不写任何文件)。
 *
 * @param {string} rootDir 仓根(夹具自证时传夹具根)
 */
export function audit(rootDir = ROOT) {
  const read = (rel) => {
    const abs = join(rootDir, rel)
    if (!existsSync(abs)) return { ok: false, text: '', why: `文件不存在:${rel}` }
    try {
      return { ok: true, text: readFileSync(abs, 'utf8'), why: '' }
    } catch (e) {
      return { ok: false, text: '', why: `文件读不到:${rel}(${e && e.message ? e.message : e})` }
    }
  }

  const py = read(PY_FILE)
  const ts = read(TS_FILE)
  const python = py.ok
    ? parsePrefixMembers(py.text, 'RETIRED_MODEL_PREFIXES')
    : { state: 'unparsed', members: [], why: py.why }
  const tsSide = ts.ok
    ? parsePrefixMembers(ts.text, 'RETIRED_PROVIDER_PREFIXES')
    : { state: 'unparsed', members: [], why: ts.why }

  const callSites = CALL_SITES.map((rel) => {
    const r = read(rel)
    if (!r.ok) return { file: rel, hits: -1, why: r.why }
    const hits = r.text.split(RETIRED_MODEL_LITERAL).length - 1
    return { file: rel, hits, why: '' }
  })

  const equal =
    python.state === 'parsed' &&
    tsSide.state === 'parsed' &&
    python.members.length === tsSide.members.length &&
    python.members.every((v, i) => v === tsSide.members[i])

  const reds = []
  if (python.state !== 'parsed') reds.push(`Python 侧前缀表未判定:${python.why}`)
  if (tsSide.state !== 'parsed') reds.push(`TS 侧前缀表未判定:${tsSide.why}`)
  if (python.state === 'parsed' && tsSide.state === 'parsed' && !equal) {
    reds.push(
      `两侧前缀清单不逐字相等:Python=${JSON.stringify(python.members)} TS=${JSON.stringify(tsSide.members)}`,
    )
  }
  for (const c of callSites) {
    if (c.hits === -1) reds.push(`调用点读不到:${c.file}(${c.why})`)
    else if (c.hits > 0) reds.push(`${c.file} 仍含退役模型字面量(${c.hits} 处)`)
  }

  return { python, ts: tsSide, equal, callSites, reds, red: reds.length > 0 }
}

/** 把仓内一份文件复制进夹具树(保持相对路径)。 */
function fixtureCopy(root, rel) {
  const src = join(ROOT, rel)
  const dst = join(root, rel)
  mkdirSync(dirname(dst), { recursive: true })
  copyFileSync(src, dst)
  return dst
}

/** 建一棵夹具树:6 份文件(两侧真相源 + 4 个调用点)逐字复制过去。 */
function makeFixture(name) {
  const dir = join(FIXTURE_BASE, `${name}-${process.pid}-${Date.now()}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const rel of [PY_FILE, TS_FILE, ...CALL_SITES]) fixtureCopy(dir, rel)
  return dir
}

/** 跑判据的 CLI 自检口(变体自证用):红 ⇒ exit 1,绿 ⇒ exit 0。 */
function runSelfCheck(rootDir) {
  return spawnSync(process.execPath, [SELF, '--self-check', rootDir], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// ── CLI 自检口(变体自证用):跑判据、打 JSON、按红绿给退出码 ──────────────────
const selfCheckIndex = process.argv.indexOf('--self-check')
if (selfCheckIndex >= 0) {
  const target = process.argv[selfCheckIndex + 1]
  if (!target) {
    console.error('❌ --self-check 缺根目录参数')
    process.exit(2)
  }
  const result = audit(resolve(target))
  console.info(JSON.stringify(result, null, 2))
  process.exit(result.red ? 1 : 0)
}

// ── 正常态:node --test 跑这一组 ───────────────────────────────────────────
test('P1 Python 侧前缀表可判定且非空(取不到 ⇒ 未判定 ⇒ 红,不得当空集合放行)', () => {
  const r = audit(ROOT)
  assert.equal(r.python.state, 'parsed', `Python 侧前缀表未判定:${r.python.why}`)
  assert.ok(r.python.members.length > 0, 'Python 侧前缀表解析出 0 个成员')
})

test('P2 TS 侧前缀表可判定且非空', () => {
  const r = audit(ROOT)
  assert.equal(r.ts.state, 'parsed', `TS 侧前缀表未判定:${r.ts.why}`)
  assert.ok(r.ts.members.length > 0, 'TS 侧前缀表解析出 0 个成员')
})

test('P3 两侧前缀清单逐字相等(任一侧增删必须同改另一侧)', () => {
  const r = audit(ROOT)
  assert.equal(
    r.equal,
    true,
    `两侧不逐字相等:Python=${JSON.stringify(r.python.members)} TS=${JSON.stringify(r.ts.members)}`,
  )
})

test('P4 4 个调用点文件里不再出现退役模型字面量', () => {
  const r = audit(ROOT)
  for (const c of r.callSites) {
    assert.notEqual(c.hits, -1, `调用点读不到:${c.file}(${c.why})`)
    assert.equal(c.hits, 0, `${c.file} 仍含退役模型字面量(${c.hits} 处)`)
  }
})

test('P5 变体自证:TS 侧前缀表多一枚 ⇒ 判据必须红(证明对账有牙)', () => {
  const dir = makeFixture('extra-prefix')
  try {
    const tsPath = join(dir, TS_FILE)
    const patched = readFileSync(tsPath, 'utf8').replace(
      /RETIRED_PROVIDER_PREFIXES = \[[^\]]*\]/,
      "RETIRED_PROVIDER_PREFIXES = ['stepfun/', 'dummy/']",
    )
    writeFileSync(tsPath, patched, 'utf8')
    const r = runSelfCheck(dir)
    assert.notEqual(r.status, 0, `多一枚前缀却判绿(退出码 ${r.status})⇒ 对账判据没牙`)
    assert.match(r.stdout, /两侧前缀清单不逐字相等/, `红因没点名清单漂移:${r.stdout.slice(0, 400)}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('P6 变体自证:调用点被塞回退役字面量 ⇒ 判据必须红', () => {
  const dir = makeFixture('call-site-literal')
  try {
    const p = join(dir, CALL_SITES[0])
    writeFileSync(p, `${readFileSync(p, 'utf8')}\n// 'stepfun/step-3.7-flash'\n`, 'utf8')
    const r = runSelfCheck(dir)
    assert.notEqual(r.status, 0, `调用点含退役字面量却判绿(退出码 ${r.status})⇒ 判据没牙`)
    assert.match(r.stdout, /仍含退役模型字面量/, `红因没点名调用点:${r.stdout.slice(0, 400)}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('P7 正对照:逐字副本 ⇒ 判据必须绿(证明"红"不是恒真)', () => {
  const dir = makeFixture('baseline')
  try {
    const r = runSelfCheck(dir)
    assert.equal(r.status, 0, `逐字副本却判红(退出码 ${r.status}):${r.stdout.slice(0, 400)}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

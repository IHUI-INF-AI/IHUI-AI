// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:b76-08a「连接级能力位由宿主注入并清掉所有客户端可自报同名字段」。
//
// 在修什么
//   连接级能力位(connectionId / clientMode / deliveryProfile / subscriberScope /
//   workflowRunDeltas,唯一名单:packages/types/src/agent-runtime.ts 的
//   CONNECTION_CAPABILITY_FIELDS)是**连接**的事实,只可能由宿主注入;任何
//   入站 schema 声明了名单内的键、而所在文件又不调用宿主注入口(stripClientCapabilityFields
//   / engine.py::_bind_principal 族),就是"客户端可自报档位"那一型 —— 自报即自授权。
//
// 四态(逐文件判,不猜):
//   hit          红名单键以**声明形态**(interface/type 成员、字符串键)出现在文件里,
//                且该文件不调用注入口、也不是名单本体文件 ⇒ 必须修;
//   cleared      同文件调用注入口(且注入口含 delete/pop/覆盖语句),或本文件就是
//                名单/注入口定义处 ⇒ 放过;
//   undetermined 键名来自**动态拼接**('client' + 'Mode' 一族)⇒ 静态判不了,逐条报名;
//   clean        文件不含任何名单键 ⇒ 不报。
//
// 口径
//   · 名单从 agent-runtime.ts 现读(单一真相源);读不到 ⇒ exit 2「无法判定」。
//   · 默认全仓扫描(packages/*/src + apps/*/src 的 .ts/.py);`--files a,b` 只查指定文件;
//     `--self-test` 跑内置正反例(不接提交链 —— 本门由主会话决定何时挂链)。
//   · 退出码:有 hit ⇒ 1;无 hit(含 undetermined,逐条报名)⇒ 0;无法判定 ⇒ 2。
//
// 口径同 70/77/118:静态启发式守门,undetermined 不冒红也不记绿。

import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const REGISTRY_FILE = 'packages/types/src/agent-runtime.ts'
const INJECTION_CALL_RE = /stripClientCapabilityFields\s*\(|_bind_principal\s*\(|strip_client_capability_fields\s*\(/
const REGISTRY_MARKER_RE = /CONNECTION_CAPABILITY_FIELDS\s*=|_CONNECTION_CAPABILITY_FIELDS\s*=/

/** 从名单本体文件现读五键;读不到就 exit 2(不回落硬编码 —— 名单漂移必须现形)。 */
function readCapabilityFields() {
  const abs = join(REPO_ROOT, REGISTRY_FILE)
  if (!existsSync(abs)) {
    console.error(`[capability-field] 无法判定:名单本体缺失 ${REGISTRY_FILE}`)
    process.exit(2)
  }
  const src = readFileSync(abs, 'utf8')
  const m = src.match(/CONNECTION_CAPABILITY_FIELDS\s*=\s*\[([^\]]*)\]/)
  if (!m) {
    console.error('[capability-field] 无法判定:名单本体里读不出 CONNECTION_CAPABILITY_FIELDS 数组')
    process.exit(2)
  }
  const fields = [...m[1].matchAll(/['"]([A-Za-z]+)['"]/g)].map((x) => x[1])
  if (fields.length === 0) {
    console.error('[capability-field] 无法判定:名单为空')
    process.exit(2)
  }
  return fields
}

/** 动态拼接检测:'client' + 'Mode' / `client` + `Mode` 一族(键名不落全称,静态判不了)。 */
function dynamicConcatPattern(field) {
  // 找把 field 拆成两段字符串字面量再拼接的写法:对每个可能的切点 i,'a' + 'b'
  const parts = []
  for (let i = 1; i < field.length; i++) {
    const a = field.slice(0, i)
    const b = field.slice(i)
    parts.push(
      new RegExp(`['"\`]${a}['"\`]\\s*\\+\\s*['"\`]${b}['"\`]`),
    )
  }
  return parts
}

/**
 * 判单文件,返回 'clean' | 'cleared' | 'undetermined' | 'hit'。
 * @param {string} relPath 仓内相对路径(报告用)
 * @param {string} content 文件全文
 * @param {string[]} fields 名单键
 */
function judgeFile(relPath, content, fields) {
  const isRegistry = REGISTRY_MARKER_RE.test(content)
  const hasInjection = INJECTION_CALL_RE.test(content)

  // 动态拼接先判:键名被拆成两段拼接时,全称词检测结构性看不见它 —— 此时无论
  // 文件里还有没有别的名单词,这一格都判不了,如实报名(undetermined)。
  for (const field of fields) {
    if (dynamicConcatPattern(field).some((re) => re.test(content))) return 'undetermined'
  }

  const wordRe = new RegExp(`\\b(${fields.join('|')})\\b`)
  if (!wordRe.test(content)) return 'clean'
  if (isRegistry || hasInjection) return 'cleared'

  // 声明形态:TS 成员键(field: / field?:)、字符串键('field': / "field":)、
  // Python 字典键写入(["field"] = / 'field':)。
  const declareRe = new RegExp(
    `\\b(?:${fields.join('|')})\\s*\\??:|['"](?:${fields.join('|')})['"]\\s*[:\\]]`,
  )
  return declareRe.test(content) ? 'hit' : 'clean'
}

/** 默认扫描面:packages 与 apps 各端 src 下的 .ts/.tsx/.py(排除 node_modules/dist/tests)。 */
function listRepoFiles() {
  const out = execFileSync(
    'git',
    ['ls-files', 'packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx', 'apps/*/src/**/*.py'],
    // 本机交互会话下 node 给子进程建 stdin 管道会 EBUSY(根治记录见技能
    // ihui-spawn-ebusy-fix):本调用不消费 stdin,一律 ignore 掉。
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function main() {
  const args = process.argv.slice(2)
  const fields = readCapabilityFields()

  if (args.includes('--self-test')) {
    process.exit(selfTest(fields) ? 0 : 1)
  }

  const filesIdx = args.indexOf('--files')
  const targets =
    filesIdx >= 0
      ? args
          .slice(filesIdx + 1)
          .join(',')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : listRepoFiles()

  let hits = 0
  let undetermined = 0
  for (const rel of targets) {
    const abs = join(REPO_ROOT, rel)
    if (!existsSync(abs)) continue
    const content = readFileSync(abs, 'utf8')
    const verdict = judgeFile(rel, content, fields)
    if (verdict === 'hit') {
      hits++
      console.error(`[capability-field] hit: ${rel} 声明了名单键且未调用宿主注入口`)
    } else if (verdict === 'undetermined') {
      undetermined++
      console.warn(`[capability-field] undetermined: ${rel} 名单键疑似动态拼接,静态判不了`)
    }
  }

  if (hits > 0) {
    console.error(`[capability-field] ${hits} 文件命中 / ${undetermined} 未判定(名单:${fields.join(',')})`)
    process.exit(1)
  }
  console.log(`[capability-field] 0 命中,${undetermined} 未判定(名单:${fields.join(',')})`)
  process.exit(0)
}

/** 内置正反例:临时目录写 fixture,跑同一 judgeFile,断言四态。 */
function selfTest(fields) {
  const clientMode = fields.includes('clientMode') ? 'clientMode' : fields[0]
  const dir = mkScratch("cap-field-selftest-")
  const cases = []
  try {
    // 反例(必红):入站 schema 声明了 clientMode,无注入口
    const red = join(dir, 'red-fixture.ts')
    writeFileSync(
      red,
      `export interface ZCodeAgentConversationSubscribeParams {\n  sessionId: string\n  ${clientMode}: string\n}\n`,
    )
    cases.push(['red-fixture.ts', 'hit'])
    // 正例(必绿):同键由 withTrustedConnection 式出口(调注入口)写出
    const green = join(dir, 'green-fixture.ts')
    writeFileSync(
      green,
      `import { stripClientCapabilityFields } from '@ihui/types'\n` +
        `export interface ZCodeAgentConversationSubscribeParams {\n  sessionId: string\n  ${clientMode}: string\n}\n` +
        `export function withTrustedConnection(raw: ZCodeAgentConversationSubscribeParams) {\n` +
        `  return stripClientCapabilityFields(raw)\n}\n`,
    )
    cases.push(['green-fixture.ts', 'cleared'])
    // 未判定:键名来自动态拼接
    const dyn = join(dir, 'dynamic-fixture.ts')
    const i = clientMode.search(/[A-Z]/)
    const a = clientMode.slice(0, i > 0 ? i : 3)
    const b = clientMode.slice(i > 0 ? i : 3)
    writeFileSync(
      dyn,
      `const key = '${a}' + '${b}'\nexport function apply(p: Record<string, unknown>) {\n  p[key] = 'x'\n}\n`,
    )
    cases.push(['dynamic-fixture.ts', 'undetermined'])
    // 干净文件:不含名单键
    const clean = join(dir, 'clean-fixture.ts')
    writeFileSync(clean, `export interface Params {\n  sessionId: string\n}\n`)
    cases.push(['clean-fixture.ts', 'clean'])

    let ok = true
    for (const [name, expected] of cases) {
      const got = judgeFile(name, readFileSync(join(dir, name), 'utf8'), fields)
      if (got !== expected) {
        console.error(`[capability-field] self-test FAIL: ${name} 期望 ${expected} 实得 ${got}`)
        ok = false
      }
    }
    // 名单本体豁免与真仓注入口调用方必须判绿(拿 HEAD 现读,防名单改动破豁免)
    for (const rel of [REGISTRY_FILE, 'packages/api-client/src/client.ts']) {
      const abs = join(REPO_ROOT, rel)
      if (!existsSync(abs)) continue
      const got = judgeFile(rel, readFileSync(abs, 'utf8'), fields)
      if (got !== 'cleared') {
        console.error(`[capability-field] self-test FAIL: 真仓 ${rel} 期望 cleared 实得 ${got}`)
        ok = false
      }
    }
    if (ok) console.log('[capability-field] self-test PASS(红/绿/未判定/干净 + 真仓两面全符合)')
    return ok
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

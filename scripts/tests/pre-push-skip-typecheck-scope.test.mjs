// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DG-09 镜像测试:`HUSKY_SKIP_TYPECHECK=1` 必须名副其实 —— 只跳过 T1,其余 push 门照跑。
 *
 * 病灶:旧版 .husky/pre-push 把 `HUSKY_SKIP_TYPECHECK` 的 else 分支一直包到 push 门调用结束,
 * 设该变量 ⇒ 47p 水印、IG 不可变护栏、299~308 等 12 道 blocking 门全部不跑,文案却只说
 * 「跳过全量 typecheck」= 名不副实的静默释放面。
 *
 * 本器只做**源码结构锁**(不重跑真门):
 *   a) env 判断块不得再包裹 `guardian-runner.mjs --push-gate` 调用(旧结构下必红);
 *   b) 该分支必须导出跳过 id,而不是 exit/跳过整段;
 *   c) runner 必须消费 `IHUI_PUSH_GATE_SKIP_IDS`、打印 `skippedGates=[...]`,
 *      且过滤后清单为空/含未知 id 时显式失败,并强制 `--no-cache`(跳过后不许命中缓存短路其余门);
 *   d) 文案必须写明「仅跳过 T1」「其余 N 道 push 门照跑」(防止只改结构不改说明)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = readFileSync(join(ROOT, '.husky', 'pre-push'), 'utf8')
const RUNNER = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
const HOOK_LINES = HOOK.split(/\r?\n/)

/** env 判断行的下标(含 `HUSKY_SKIP_TYPECHECK:-0` 的那一行)。 */
const ENV_IF = HOOK_LINES.findIndex((l) => l.includes('HUSKY_SKIP_TYPECHECK:-0'))
/** env 判断块闭合的顶层 `fi` 下标(块内嵌套 if 均已缩进,不会误配)。 */
const ENV_FI = ENV_IF < 0 ? -1 : HOOK_LINES.findIndex((l, i) => i > ENV_IF && /^fi\s*$/.test(l))
/** `guardian-runner.mjs --push-gate` 真实调用行下标(注释里的裸 `--push-gate` 不算)。 */
const GATE_CALL = HOOK_LINES.findIndex((l) => l.includes('guardian-runner.mjs --push-gate'))

test('a) env 判断块不得再包裹 guardian-runner --push-gate 调用', () => {
  assert.ok(ENV_IF >= 0, '钩子里找不到 HUSKY_SKIP_TYPECHECK 判断行 —— 结构与判据失联')
  assert.ok(ENV_FI > ENV_IF, '找不到 HUSKY_SKIP_TYPECHECK 判断块的顶层 fi —— 结构不可判定')
  assert.ok(GATE_CALL >= 0, '钩子里找不到 guardian-runner.mjs --push-gate 调用行')
  assert.ok(
    GATE_CALL > ENV_FI,
    `push 门调用仍在 HUSKY_SKIP_TYPECHECK 判断块内(调用行 ${GATE_CALL + 1},块止于 ${ENV_FI + 1})` +
      ' ⇒ 设该变量会跳过整条 push 门链(DG-09 未修复)',
  )
})

test('b) env 分支必须导出跳过 id,而不是 exit/跳过整段', () => {
  assert.ok(ENV_IF >= 0 && ENV_FI > ENV_IF, 'env 判断块无法定位')
  const block = HOOK_LINES.slice(ENV_IF, ENV_FI + 1).join('\n')
  assert.match(block, /export\s+IHUI_PUSH_GATE_SKIP_IDS=/, 'env 分支没有导出 IHUI_PUSH_GATE_SKIP_IDS')
  assert.match(block, /T1/, 'env 分支导出的跳过清单必须点名 T1')
  assert.doesNotMatch(block, /\bexit\b/, 'env 分支不得直接 exit(那等于跳过整段门链)')
  assert.ok(!block.includes('guardian-runner.mjs --push-gate'), 'push 门调用不得被搬进 env 分支')
})

test('c) runner 消费 IHUI_PUSH_GATE_SKIP_IDS、打印 skippedGates、空清单显式失败且强制 no-cache', () => {
  assert.match(RUNNER, /IHUI_PUSH_GATE_SKIP_IDS/, 'runner 未消费 IHUI_PUSH_GATE_SKIP_IDS')
  assert.match(RUNNER, /skippedGates=\[/, 'runner 未打印被跳过门清单 skippedGates=[...]')
  assert.match(
    RUNNER,
    /effectiveChecks\.length\s*===\s*0[\s\S]{0,400}?process\.exit\(2\)/,
    '过滤后 push 门清单为空时必须显式失败(exit 2),不得当作全绿',
  )
  assert.match(
    RUNNER,
    /未知[\s\S]{0,150}?process\.exit\(2\)/,
    '未知/畸形门 id 必须显式失败(exit 2),不得静默忽略',
  )
  assert.match(
    RUNNER,
    /cliArgs\.push\('--no-cache'\)/,
    '跳过态必须强制 --no-cache,否则 push-gate 缓存命中会短路其余门',
  )
})

test('d) 文案写明「仅跳过 T1」「其余 N 道 push 门照跑」', () => {
  assert.match(HOOK, /仅跳过\s*T1/, '文案没有写明「仅跳过 T1」')
  assert.match(HOOK, /其余\s*\d+\s*道\s*push\s*门照跑/, '文案没有写明「其余 N 道 push 门照跑」')
  assert.doesNotMatch(HOOK, /已跳过全量 typecheck 验证/, '旧误导文案「已跳过全量 typecheck 验证」仍在')
})

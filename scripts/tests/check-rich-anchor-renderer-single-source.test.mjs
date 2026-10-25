// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/check-rich-anchor-renderer-single-source.test.mjs
// §22c 镜像测试:判据 import 源脚本的 __test__,本文件不复制第二份(门 191 同族禁令)。
// 本票锁四件事:
//   ① 装车证明(工作树 runner 有 id 247 条目,blocking + skipEnv 成套;idsOfRegistry 预验 R5 无撞号
//      —— 本枚落地前 HEAD 里还没有 247,故读工作树面,落地后由门 89 在 HEAD 面长期守);
//   ② A1/A2/A3 成对正反控(全部用门体自带的 tagsFixture/webFixture 造夹具,判据函数即生产函数);
//   ③ 真仓 CLI 三档(两面旗同给 exit 2 / --help exit 0 / 全量档在可读仓库上**永不**判成未判定);
//   ④ §22d 形状锁(isDirectRun 必须走 pathToFileURL,main 必须 async)。
// 注意:本文件**不得**断言"HEAD 现状有几处违规"——现存那枚 move-to-worktree-dialog 的 A2 分叉与
// 本门同批落地,落地后该断言会腐烂成恒红(§12e)。正向取证只走构造夹具。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-rich-anchor-renderer-single-source.mjs'
import { idsOfRegistry } from '../check-gate-wiring.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-rich-anchor-renderer-single-source.mjs')
const stdio = ['ignore', 'pipe', 'pipe']

const run = (args = []) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
    stdio,
  })

const ALL = [
  'a',
  'action',
  'branch',
  'code',
  'detail',
  'learnMore',
  'link',
  'status',
  'strong',
  'verb',
]

test('装车证明:工作树 runner 有 id 247 条目,blocking + skipEnv 成套,且无撞号(门 89 R5/R13 预验)', () => {
  const text = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const i = text.indexOf("'check-rich-anchor-renderer-single-source.mjs'")
  assert.ok(i > -1, '门体未插进提交链注册表')
  const block = text.slice(Math.max(0, i - 500), i + 1400)
  assert.match(block, /mode:\s*'blocking'/, '须为 blocking')
  assert.match(
    block,
    /skipEnv:\s*'HUSKY_SKIP_RICH_ANCHOR_RENDERER_SINGLE_SOURCE'/,
    'blocking 门必须成套带 skipEnv',
  )
  assert.ok(!/stagedTriggers:\s*\[\s*\]/.test(block), '禁止空 stagedTriggers 数组(R8 同型当场抛错)')
  const ids = idsOfRegistry(text)
  const mine = ids.filter((v) => String(v) === '247')
  assert.equal(mine.length, 1, `id 247 应恰好登记一枚,实得 ${mine.length}`)
  const dupes = ids.filter((v, k) => ids.indexOf(v) !== k)
  assert.deepEqual(dupes, [], `注册表撞号(门 89 R5 会在 HEAD 面拦):${dupes.join(',')}`)
})

test('A1 成对:键集==标签集零判;缺 branch 点名 branch;多 iframe 点名 iframe', () => {
  const tags = gate.parseTagWhitelist(gate.tagsFixture(ALL))
  assert.deepEqual(tags, ALL, '白名单解析须逐字取回')
  assert.deepEqual(
    gate.judgeA1(tags, gate.parseRendererTable(gate.webFixture(ALL))),
    [],
    '完备表不得判红',
  )
  const miss = gate.judgeA1(
    tags,
    gate.parseRendererTable(gate.webFixture(ALL.filter((k) => k !== 'branch'))),
  )
  assert.equal(miss.length, 1)
  assert.equal(miss[0].tag, 'branch', '缺标签必须点名该标签')
  const extra = gate.judgeA1(tags, gate.parseRendererTable(gate.webFixture([...ALL, 'iframe'])))
  assert.equal(extra.length, 1)
  assert.equal(extra[0].tag, 'iframe', '白名单外键必须点名(渲染面静默放宽即白名单漂移)')
})

test('A1 守卫本体成对:空数组洗白与整体摘除都判红,健全引用两标识符不咬', () => {
  const tags = gate.parseTagWhitelist(gate.tagsFixture(ALL))
  const washed = gate.judgeA1(
    tags,
    gate.parseRendererTable(gate.webFixture(ALL, 'export const MISSING_ANCHOR_RENDERERS = []\n')),
  )
  assert.equal(washed.length, 1)
  assert.match(washed[0].detail, /空数组字面量/)
  const removed = gate.judgeA1(tags, gate.parseRendererTable(gate.webFixture(ALL, '')))
  assert.equal(removed.length, 1)
  assert.match(removed[0].detail, /不在被审面/)
})

test('A2 成对:内联箭头(含 JSX 体)判红并点名 文件:行:标签;richAnchorRenderer 调用与整体传表不咬', () => {
  const tagSet = new Set(ALL)
  const bad =
    'export function D() {\n  return t.rich("subtitle", {\n    branchName: "v",\n    branch: (chunks) => <code>{chunks}</code>,\n  })\n}\n'
  const hits = gate.findInlineRichRenderers(bad, 'apps/web/src/components/ai/probe.tsx', tagSet)
  assert.equal(hits.length, 1, '内联白名单标签渲染器必须被逐条点名')
  assert.equal(hits[0].tag, 'branch')
  assert.equal(hits[0].line, 4)
  const good = gate.findInlineRichRenderers(
    't.rich("subtitle", { branch: richAnchorRenderer("branch"), branchName: x })\nt.rich("k2", RICH_ANCHOR_COMPONENTS)',
    'probe.tsx',
    tagSet,
  )
  assert.deepEqual(good, [], '叫表/整体传表是合法形状,不得咬')
  const computed = gate.findInlineRichRenderers(
    't.rich("k", { [dyn]: (chunks) => chunks })',
    'probe.tsx',
    tagSet,
  )
  assert.equal(computed.length, 1, '计算键 + 内联渲染器同样判红(门读不懂的形状不放行)')
})

test('A3 成对:importer 枚到 0 ⇒ 空集(调用方判死);载体自身不得自荐', () => {
  const self = { p: gate.WEB_MODULE, s: 'export const RichAnchorText = 1' }
  assert.deepEqual(gate.findAnchorModuleImporters([self]), [], '载体自身不算 importer')
  const withImporter = gate.findAnchorModuleImporters([
    self,
    { p: 'apps/web/src/x.tsx', s: "import { RichAnchorText } from './chat/rich-anchor-text'\n" },
  ])
  assert.deepEqual(withImporter, ['apps/web/src/x.tsx'])
})

test('射程过滤:__tests__ / *.test.tsx / e2e/ / .next* 排除,生产 ts/tsx 在射程', () => {
  assert.ok(gate.isProductionSource('apps/web/src/components/chat/message-list/MessageItem.tsx'))
  assert.ok(
    !gate.isProductionSource('apps/web/src/components/chat/__tests__/rich-anchor-text.test.tsx'),
  )
  assert.ok(!gate.isProductionSource('apps/web/e2e/rich-anchor-flow.spec.ts'))
  assert.ok(!gate.isProductionSource('apps/web/.next/generated/routes.ts'))
  assert.ok(!gate.isProductionSource('apps/web/src/components/chat/rich-anchor-text.test.tsx'))
})

test('真仓 CLI 三档:两面旗同给 exit 2 / --help exit 0 / 全量档在可读仓库永不落未判定', () => {
  const both = run(['--staged', '--worktree'])
  assert.equal(both.status, 2, `两面旗同给必须 exit 2,实得 ${both.status}:${both.stdout}`)
  assert.match(both.stdout, /未判定/)
  const help = run(['--help'])
  assert.equal(help.status, 0)
  const full = run([])
  assert.ok(
    full.status === 0 || full.status === 1,
    `全量档只可能是判过(0)或判红(1),不得在可读仓库上未判定(2);实得 ${full.status}:${full.stdout}${full.stderr}`,
  )
  assert.match(full.stdout, /富文本锚点渲染器单一源头/)
})

test('§22d 形状锁:isDirectRun 走 pathToFileURL(手拼 file:/// 在 Windows 永不匹配)且 main 为 async', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(
    src,
    /pathToFileURL\(process\.argv\[1\]\)\.href/,
    'isDirectRun 必须用 pathToFileURL 对账',
  )
  assert.ok(!/'file:\/\/\/'\s*\+/.test(src), '禁止手拼 file:/// 前缀')
  assert.match(src, /async function main\(/, 'main() 必须是 async(门 194 红线)')
})

test('判据单源(§0.6):本镜像只 import 门体 __test__,未复制任何判据实现', () => {
  const src = readFileSync(join(HERE, 'check-rich-anchor-renderer-single-source.test.mjs'), 'utf8')
  assert.ok(
    src.includes("from '../check-rich-anchor-renderer-single-source.mjs'"),
    'import 锚点在位',
  )
  // 判据函数名与 "function" 的拼接串**只能在运行时组装**——字面量写进本文件会被自己的断言命中(自噬)。
  for (const fn of [
    'findInlineRichRenderers',
    'parseTagWhitelist',
    'parseRendererTable',
    'judgeA1',
  ]) {
    assert.ok(!src.includes(`function ${'' + fn}`), `禁止在测试里重写判据 ${fn}(门 191 同族禁令)`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 22 `check-readme-sync.mjs`(README 对外能力同步)
//
// §22c 纪律:本文件**不复制任何判据常量/正则/路径口径** —— 判据一律从门体 `__test__` 直连
// (门体自己再从 `scripts/lib/readme-capability-surface.mjs` 单源取)。要加断言只加断言,
// 不许在这里重写一份"什么算对外能力""什么算提到过"。
//
// 用例形状(成对硬要求,单侧不算证明):
//  - 阳性对照:器物必须真能看见一条没写进 README 的新能力(否则就是恒绿门);
//  - 阴性对照:已经描述过的能力不得被误报(否则 warn 也会退化成噪声);
//  - 三态各一 + 三面分叉(§0.4 同面同轮)+ "枚举到 0 ≠ 通过" + 取不到输入 ⇒ 未判定;
//  - 形状锁:runner 档位现值仍是 warn(§12e:升档前置 = 存量归零)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { SCAN_DIRS } from '../lib/outbound-route-facts.mjs'
// §22c:判据真相只在门体/判据层一份
import { __test__ as gate } from '../check-readme-sync.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-readme-sync.mjs')
const REPO_ROOT = join(__dirname, '..', '..')
const STDIO = ['ignore', 'pipe', 'pipe']
const OLD_DATE = '2000-01-01T00:00:00Z'

/* ──────────── 夹具源码(输入样本,不是判据;README 文本与门体 FIXTURES 同源) ──────────── */

/** 守门 8 的唯一提取式能解析的最小挂载图:server.ts 按 prefix 注册插件函数 */
const SERVER_TS_WITHOUT_NEW = [
  "import Fastify from 'fastify'",
  "import { widgetRoutes } from './routes/widget.js'",
  'export async function buildServer() {',
  '  const server = Fastify()',
  "  await server.register(widgetRoutes, { prefix: '/api/widget' })",
  '  return server',
  '}',
  '',
].join('\n')

const SERVER_TS_WITH_NEW = [
  "import Fastify from 'fastify'",
  "import { widgetRoutes } from './routes/widget.js'",
  "import { brandNewRoutes } from './routes/brand-new.js'",
  'export async function buildServer() {',
  '  const server = Fastify()',
  "  await server.register(widgetRoutes, { prefix: '/api/widget' })",
  "  await server.register(brandNewRoutes, { prefix: '/api/widget' })",
  '  return server',
  '}',
  '',
].join('\n')

const WIDGET_ROUTE_TS = [
  "import type { FastifyPluginAsync } from 'fastify'",
  'const widgetRoutes: FastifyPluginAsync = async (server) => {',
  "  server.get('/existing', async () => ({}))",
  '}',
  'export default widgetRoutes',
  '',
].join('\n')

const BRAND_NEW_ROUTE_TS = [
  "import type { FastifyPluginAsync } from 'fastify'",
  'const brandNewRoutes: FastifyPluginAsync = async (server) => {',
  "  server.get('/brand-new-capability', async () => ({}))",
  '}',
  'export default brandNewRoutes',
  '',
].join('\n')

const README_SILENT = gate.FIXTURES.readmeBlank
const README_FULL_PATH = '# IHUI-AI\n\n组件可选清单:`/api/widget/brand-new-capability`。\n'
const README_FAMILY_PREFIX = '# IHUI-AI\n\n组件能力见 `/api/widget`(逐条子路径不逐一列举)。\n'
const README_ALIAS_ONLY = '# IHUI-AI\n\n旧写法登记:`widget/brand-new-capability`(不带 /api 前缀)。\n'

/* ───────────────── 临时 git 仓辅助(§15b:夹具落仓库外) ───────────────── */

function gitIn(dir, args, env = {}) {
  return spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    stdio: STDIO,
    env: { ...process.env, ...env },
  })
}

function mustGit(dir, args, env = {}) {
  const r = gitIn(dir, args, env)
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败:${r.stderr || r.stdout}`)
  return String(r.stdout || '').trim()
}

function writeFileIn(dir, rel, content) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function commitAll(dir, message, dateIso) {
  mustGit(dir, ['add', '-A'])
  const env = dateIso ? { GIT_AUTHOR_DATE: dateIso, GIT_COMMITTER_DATE: dateIso } : {}
  const r = gitIn(dir, ['commit', '-q', '-m', message], env)
  if (r.status !== 0) throw new Error(`commit 失败:${r.stderr || r.stdout}`)
  return mustGit(dir, ['rev-parse', 'HEAD'])
}

/**
 * 造一枚"有历史的仓":
 *   commit1(远古日期)= README + 后端旧面(只有 /api/widget/existing)
 *   commit2(今天)= 按 commit2Files 决定这一轮动了什么;动了 brand-new 路由才同步换 server.ts
 * 远古日期让"默认 7 天回看点"正好落在 commit1 上 ⇒ 窗口起点可解、不产生"回看点取不到"那一格未判定,
 * 这样 `--strict` 与非 `--strict` 两支的差就只剩别称桶本身(否则两因混在一处,证不到点上)。
 */
function makeRepo({ readme1 = README_SILENT, commit2Files = null, readme2 = null } = {}) {
  const dir = mkScratch('ihui-readme-sync-')
  mustGit(dir, ['init', '-q', '-b', 'main'])
  mustGit(dir, ['config', 'user.email', 'test@ihui.local'])
  mustGit(dir, ['config', 'user.name', 'Test'])
  mustGit(dir, ['config', 'commit.gpgsign', 'false'])
  writeFileIn(dir, 'README.md', readme1)
  writeFileIn(dir, 'apps/api/src/server.ts', SERVER_TS_WITHOUT_NEW)
  writeFileIn(dir, 'apps/api/src/routes/widget.ts', WIDGET_ROUTE_TS)
  writeFileIn(dir, 'docs/ops.md', '# 运维\n')
  const c1 = commitAll(dir, 'init: README + 后端旧面', OLD_DATE)
  const files = commit2Files ?? { 'apps/api/src/routes/brand-new.ts': BRAND_NEW_ROUTE_TS }
  for (const [rel, content] of Object.entries(files)) writeFileIn(dir, rel, content)
  if (Object.keys(files).some((p) => p.endsWith('routes/brand-new.ts')))
    writeFileIn(dir, 'apps/api/src/server.ts', SERVER_TS_WITH_NEW)
  if (readme2 !== null && readme2 !== undefined) writeFileIn(dir, 'README.md', readme2)
  const c2 = commitAll(dir, 'feat: 新增对外能力')
  return { dir, c1, c2 }
}

function cleanup(...dirs) {
  for (const d of dirs) {
    try {
      rmScratch(d)
    } catch {
      /* 回收失败不改结论 */
    }
  }
}

function runCli(args, cwd = REPO_ROOT) {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: STDIO,
  })
  return { code: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') }
}

const { analyze } = gate

/* ═════════════════════ 一、阳性 / 阴性对照(器物的牙) ═════════════════════ */

test('阳性对照:窗口内新增端点而 README 未写 ⇒ 判成未描述缺口并点名出处(旧判据这一型全静默)', () => {
  const { dir } = makeRepo()
  try {
    const r = analyze({ root: dir })
    assert.equal(
      r.counts.missing,
      1,
      `未描述应为 1,实得 ${r.counts.missing};notes=${JSON.stringify(r.notes)};undetermined=${JSON.stringify(r.undetermined)}`,
    )
    assert.equal(r.counts.added, 1, '窗口内新增对外能力应恰 1 枚')
    assert.equal(r.gaps[0].id, 'GET /api/widget/brand-new-capability')
    assert.equal(r.gaps[0].file, 'apps/api/src/routes/brand-new.ts')
    assert.equal(r.exit, 1)
  } finally {
    cleanup(dir)
  }
})

test('阴性对照:同一枚新能力已写进 README ⇒ 不误报(而"新增"照样算得出来)', () => {
  const { dir } = makeRepo({ readme2: README_FULL_PATH })
  try {
    const r = analyze({ root: dir })
    // README 在第二枚提交里同步更新了 ⇒ 文档锚点挪到 HEAD,窗口起点仍取更旧的远古回看点,
    // 所以"改了功能也改了 README"这一型不再被静默放过,而是真去核对描述有没有覆盖
    assert.equal(r.counts.added, 1)
    assert.equal(r.counts.covered, 1)
    assert.equal(r.counts.missing, 0)
    assert.equal(r.exit, 0)
  } finally {
    cleanup(dir)
  }
})

test('前缀不吃便宜:README 只写资源族 `/api/widget` 而新增的是其子路径 ⇒ 仍算缺口', () => {
  const { dir } = makeRepo({ readme2: README_FAMILY_PREFIX })
  try {
    const r = analyze({ root: dir })
    // 只有"尾部动态段"才折成资源族前缀(`/api/plaza/:id` 与 `/api/plaza` 是同一能力寻址到实例);
    // 多出一个静态段就是一条新能力,写一行族名不许给整片新端点打钩(门体 --self-test ⑭ 钉住另一侧)
    assert.equal(r.counts.missing, 1, `应仍判 1 枚缺口,实得 ${JSON.stringify(r.gaps)}`)
    assert.equal(r.counts.covered, 0)
    assert.equal(r.exit, 1)
  } finally {
    cleanup(dir)
  }
})

test('别称桶:只命中不带 /api 前缀的多段尾巴 ⇒ 报数不判红,--strict 才逼人交待', () => {
  const { dir } = makeRepo({ readme2: README_ALIAS_ONLY })
  try {
    const r = analyze({ root: dir })
    assert.equal(r.counts.alias, 1, `未判定应 1 枚,实得 ${r.counts.alias}`)
    assert.equal(r.counts.missing, 0)
    assert.equal(r.undetermined.length, 0, '夹具把回看点落在远古 commit1 上 ⇒ 不该有尺子未判定混进来')
    assert.equal(r.exit, 0, 'warn 档:别称不顶红(§12e)')
    assert.equal(gate.decideExit(r, { strict: true }), 1, '--strict 必须逼这一格交待人')
    assert.equal(r.aliases[0].evidence, 'widget/brand-new-capability')
  } finally {
    cleanup(dir)
  }
})

test('web 页面腿:新增 apps/web/app/(main)/demo/page.tsx 而 README 未写 ⇒ PAGE /demo', () => {
  const { dir } = makeRepo({
    commit2Files: { 'apps/web/app/(main)/demo/page.tsx': 'export default function P() { return null }\n' },
  })
  try {
    const r = analyze({ root: dir })
    assert.equal(r.counts.missing, 1, `缺口应 1 枚,实得 ${JSON.stringify(r.gaps)}`)
    assert.equal(r.gaps[0].id, 'PAGE /demo')
  } finally {
    cleanup(dir)
  }
})

test('存量 / 新增分档:第二轮带来的缺口 bucket=in-doc-window(升 blocking 时唯一可拦的一截)', () => {
  const { dir } = makeRepo()
  try {
    const r = analyze({ root: dir })
    assert.equal(r.gaps[0].bucket, 'in-doc-window')
    assert.equal(r.counts['in-doc-window'], 1)
    assert.equal(r.counts.backlog, 0)
  } finally {
    cleanup(dir)
  }
})

test('盲区点名:第二轮动小程序页面文件 ⇒ blindSpots 计数但不判红(§0.6 不另立第二份提取式)', () => {
  const { dir } = makeRepo({
    commit2Files: {
      'apps/miniapp-taro/src/pages/demo/index.tsx': 'export default function P() { return null }\n',
    },
  })
  try {
    const r = analyze({ root: dir })
    assert.ok(r.blindSpots.files >= 1, `盲区应点名到文件,实得 ${JSON.stringify(r.blindSpots)}`)
    assert.ok(r.blindSpots.dirs.includes('apps/miniapp-taro/src'))
    assert.equal(r.counts.missing, 0, '盲区只报数,不得冒红')
    assert.equal(r.exit, 0)
  } finally {
    cleanup(dir)
  }
})

/* ═════════════════════ 二、三态纪律(§0.3) ═════════════════════ */

test('取不到被审文档面 ⇒ 未判定(抛 Undetermined,不回落另一个面)', () => {
  const dir = mkScratch('ihui-readme-sync-')
  try {
    mustGit(dir, ['init', '-q', '-b', 'main'])
    mustGit(dir, ['config', 'user.email', 'test@ihui.local'])
    mustGit(dir, ['config', 'user.name', 'Test'])
    writeFileIn(dir, 'apps/api/src/server.ts', SERVER_TS_WITHOUT_NEW)
    writeFileIn(dir, 'apps/api/src/routes/widget.ts', WIDGET_ROUTE_TS)
    commitAll(dir, 'init: 仓里根本没有 README')
    assert.throws(
      () => analyze({ root: dir }),
      (e) => /取不到 README\.md/.test(String(e?.message ?? e)),
      undefined,
      '必须显式未判定',
    )
  } finally {
    cleanup(dir)
  }
})

test('枚举到 0 个端点却有后端源文件 ⇒ 未判定(尺子坏了不等于没有能力)', () => {
  const dir = mkScratch('ihui-readme-sync-')
  try {
    mustGit(dir, ['init', '-q', '-b', 'main'])
    mustGit(dir, ['config', 'user.email', 'test@ihui.local'])
    mustGit(dir, ['config', 'user.name', 'Test'])
    writeFileIn(dir, 'README.md', README_SILENT)
    commitAll(dir, 'init readme', OLD_DATE)
    writeFileIn(dir, 'apps/api/src/loose.ts', 'export const x = 1\n')
    commitAll(dir, 'feat: 加一个不注册任何端点的后端文件')
    assert.throws(
      () => analyze({ root: dir }),
      (e) => /提取式失效/.test(String(e?.message ?? e)),
      undefined,
      '必须显式未判定',
    )
  } finally {
    cleanup(dir)
  }
})

test('有依据的 0:窗口内只动文档没动能力源面 ⇒ 记 sound-zero 依据行,不空口通过', () => {
  const dir = mkScratch('ihui-readme-sync-')
  try {
    mustGit(dir, ['init', '-q', '-b', 'main'])
    mustGit(dir, ['config', 'user.email', 'test@ihui.local'])
    mustGit(dir, ['config', 'user.name', 'Test'])
    writeFileIn(dir, 'README.md', README_SILENT)
    writeFileIn(dir, 'apps/api/src/server.ts', SERVER_TS_WITHOUT_NEW)
    writeFileIn(dir, 'apps/api/src/routes/widget.ts', WIDGET_ROUTE_TS)
    commitAll(dir, 'init', OLD_DATE)
    writeFileIn(dir, 'docs/ops.md', '# 运维(改了文档)\n')
    commitAll(dir, 'docs: 只动文档')
    const r = analyze({ root: dir })
    assert.equal(r.counts.added, 0)
    assert.equal(r.exit, 0)
    assert.ok(r.notes.some((n) => n.kind === 'sound-zero'), '必须给出"这是有依据的 0"的依据行')
  } finally {
    cleanup(dir)
  }
})

test('回看点解不出(仓龄短于窗口)⇒ 落一条未判定点名,不冒充审过全部历史', () => {
  const dir = mkScratch('ihui-readme-sync-')
  try {
    mustGit(dir, ['init', '-q', '-b', 'main'])
    mustGit(dir, ['config', 'user.email', 'test@ihui.local'])
    mustGit(dir, ['config', 'user.name', 'Test'])
    writeFileIn(dir, 'README.md', README_SILENT)
    writeFileIn(dir, 'apps/api/src/server.ts', SERVER_TS_WITHOUT_NEW)
    writeFileIn(dir, 'apps/api/src/routes/widget.ts', WIDGET_ROUTE_TS)
    commitAll(dir, 'init(今天)')
    writeFileIn(dir, 'apps/api/src/routes/brand-new.ts', BRAND_NEW_ROUTE_TS)
    writeFileIn(dir, 'apps/api/src/server.ts', SERVER_TS_WITH_NEW)
    commitAll(dir, 'feat: 新能力(今天)')
    const r = analyze({ root: dir })
    assert.ok(
      r.undetermined.some((u) => u.what === '回看点'),
      '两条提交都是今天 ⇒ 7 天回看点解不出,必须点名',
    )
    assert.equal(r.counts.missing, 1, '文档锚点窗口照样判得出这一枚(退化到锚点,不是退化到不判)')
    assert.equal(r.exit, 1, '未判定项不顶红,缺口顶红(warn 档)')
  } finally {
    cleanup(dir)
  }
})

/* ═════════════════════ 三、面纪律(§0.4 同面同轮) ═════════════════════ */

test('三面分叉:README 只在盘上补对而未提交 ⇒ head/staged 仍判缺口,worktree 判覆盖', () => {
  const { dir } = makeRepo()
  try {
    writeFileIn(dir, 'README.md', README_FULL_PATH) // 只改盘上,不 add 不 commit
    const head = analyze({ root: dir, face: 'head' })
    const staged = analyze({ root: dir, face: 'staged' })
    const wt = analyze({ root: dir, face: 'worktree' })
    assert.equal(head.counts.missing, 1, 'HEAD 面不看盘上副本')
    assert.equal(staged.counts.missing, 1, '索引面不看盘上副本')
    assert.equal(wt.counts.missing, 0, '--worktree 是显式逃生舱,读盘上副本')
    assert.equal(wt.counts.covered, 1)
  } finally {
    cleanup(dir)
  }
})

test('两面旗同给 ⇒ 参数不成立,不猜面', () => {
  const r = runCli(['--staged', '--worktree'])
  assert.equal(r.code, 2, `${r.out}${r.err}`)
  assert.match(r.err, /不得同用/)
})

/* ═════════════════════ 四、CLI 与参数纪律 ═════════════════════ */

test('非 git 目录 ⇒ exit 2 显式未判定(旧行为是 exit 0 假绿,这一条封死它)', () => {
  const dir = mkScratch('ihui-readme-sync-nongit-')
  try {
    const r = runCli(['--root', dir, '--staged'], dir)
    assert.equal(r.code, 2, `实得 ${r.code}/${r.err || r.out}`)
    assert.match(r.err, /无法判定/)
  } finally {
    cleanup(dir)
  }
})

test('旗标吞值与未知旗标 ⇒ 参数不成立并点名,不静默退回默认', () => {
  assert.match(String(gate.parseArgs(['--horizon-days']).horizonError), /--horizon-days 需要一个/)
  assert.match(String(gate.parseArgs(['--since']).sinceError), /--since 需要一个/)
  assert.equal(gate.parseArgs(['--horizon-days', '3']).horizonDays, 3)
  assert.equal(gate.parseArgs(['--turbo-mode']).unknown.join(' '), '--turbo-mode')
  const r = runCli(['--turbo-mode'])
  assert.equal(r.code, 2)
  assert.match(r.err, /未知旗标:--turbo-mode/)
})

test('--horizon-days 非正数 ⇒ 参数不成立(不接受"0 = 关掉窗口"这种静默降级)', () => {
  const r = runCli(['--horizon-days', '0'])
  assert.equal(r.code, 2, `${r.out}${r.err}`)
  assert.match(r.err, /必须是正数/)
})

test('--since 钉到 HEAD ⇒ same-face 依据行,不拿 0 冒充审过', () => {
  const { dir, c2 } = makeRepo()
  try {
    const r = analyze({ root: dir, since: c2 })
    assert.equal(r.counts.added, 0)
    assert.ok(r.notes.some((n) => n.kind === 'same-face'))
    assert.match(r.startSource, /--since/)
  } finally {
    cleanup(dir)
  }
})

test('--since 给一个解不出的引用 ⇒ 未判定 exit 2', () => {
  const r = runCli(['--since', 'definitely-not-a-rev-xyz'])
  assert.equal(r.code, 2, `${r.out}${r.err}`)
  assert.match(r.err, /无法判定/)
})

test('--json 出口给逐条缺口(清存量的唯一机器可读入口)且形状稳定', () => {
  const { dir } = makeRepo()
  try {
    const r = analyze({ root: dir })
    const json = JSON.parse(JSON.stringify(r))
    assert.equal(json.gaps[0].id, 'GET /api/widget/brand-new-capability')
    for (const k of [
      'face',
      'docAnchor',
      'horizonRev',
      'start',
      'counts',
      'gaps',
      'aliases',
      'undetermined',
      'blindSpots',
      'notes',
    ])
      assert.ok(k in json, `json 面必须有 ${k}`)
  } finally {
    cleanup(dir)
  }
})

test('--help 给用法即 exit 0(§0.8:文档里每条出路都必须真跑得通)', () => {
  const r = runCli(['--help'])
  assert.equal(r.code, 0, `${r.out}${r.err}`)
  assert.match(r.out, /--horizon-days/)
})

test('--self-test 真求值且零失败(登记侧不求值会被门 156 判红)', () => {
  const r = runCli(['--self-test'])
  assert.equal(r.code, 0, `${r.out}\n${r.err}`)
  assert.match(r.out, /--self-test: \d+ 通过 \/ 0 失败/)
})

/* ═════════════════════ 五、单源与形状锁(§22c / §12e) ═════════════════════ */

test('§22c 判据直连:门体 surface 与判据层是同一批函数对象(测试与门都没抄第二份)', () => {
  const surface = gate.surface
  assert.equal(typeof surface.classifyDescriptor, 'function')
  assert.equal(typeof surface.pickWindowStart, 'function')
  assert.equal(
    surface.BACKEND_SOURCE_DIRS,
    SCAN_DIRS,
    '源面目录必须是 outbound 那一枚数组,不是副本(§0.6 单一真相源)',
  )
  // 端到端与判据函数同形:两侧都得成立(阳性 + 阴性)
  const d = { primary: 'api/widget/brand-new-capability' }
  assert.equal(surface.classifyDescriptor(d, README_SILENT.toLowerCase()).state, 'missing')
  assert.equal(surface.classifyDescriptor(d, README_FULL_PATH.toLowerCase()).state, 'covered')
})

test('棘轮(§0.5):存量在额度内不顶红,超出额度才判红 —— 且不许靠上调额度消红', () => {
  // §22c:判据只从门体取,这里只构造输入
  const mk = (missing) => ({ counts: { missing, alias: 0 }, undetermined: [] })
  const bl = { missing: 125 }
  assert.equal(gate.decideExit(mk(125), { baseline: bl }), 0, '齐平额度 ⇒ 存量只报数')
  assert.equal(gate.decideExit(mk(120), { baseline: bl }), 0, '存量下降 ⇒ 更不该红')
  assert.equal(gate.decideExit(mk(126), { baseline: bl }), 1, '新增一枚未描述 ⇒ 必须判红')
  // 无基线 ⇒ 退回旧语义,绝不因为"没读到基线"就静默放宽
  assert.equal(gate.decideExit(mk(1), {}), 1)
  assert.equal(gate.decideExit(mk(0), {}), 0)
  // 基线件读不懂 ⇒ 未判定信号(error 非空),门侧据此 exit 2
  const dir = mkScratch('readme-sync-bl-')
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(join(dir, gate.BASELINE_REL), '{"missing": "一百"}', 'utf8')
    const bad = gate.loadBaseline(dir)
    assert.equal(bad.present, false)
    assert.equal(typeof bad.error, 'string', '读不懂必须给未判定信号,不许当没基线')
  } finally {
    cleanup(dir)
  }
})

test('形状锁:runner(HEAD 面)登记 id 22 且档位仍是 warn(升档前置=存量归零)', () => {
  const got = catBatch(REPO_ROOT, ['HEAD:scripts/guardian-runner.mjs'], { maxBuffer: 1 << 29 })
  const runner = got.get('HEAD:scripts/guardian-runner.mjs')
  assert.equal(typeof runner, 'string', 'runner 的 HEAD 面必须取到,取不到就是没判')
  const idx = runner.indexOf("script: 'check-readme-sync.mjs'")
  assert.ok(idx > 0, '本门必须真在注册表里(没装车=没有)')
  const entry = runner.slice(Math.max(0, idx - 400), idx + 260)
  assert.match(entry, /id:\s*'22'/, '条目 id 必须紧邻')
  assert.match(
    entry,
    /mode:\s*'warn'/,
    `runner 现值必须是 warn(§12e:存量未清零时上 blocking=恒红门):${entry}`,
  )
  assert.doesNotMatch(entry, /mode:\s*'blocking'/, '有人没清存量就升档 ⇒ 本用例先红')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

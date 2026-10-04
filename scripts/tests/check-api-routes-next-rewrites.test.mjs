// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:守门 8(check-api-routes)的「next rewrites 转发面」判据(2026-10-04)
 *
 * 背景:改前 `extractFrontendCalls` 里有两行硬编码 `continue`,注释写着
 * "走 Next.js rewrite 到 ai-service" —— 那是**人工断言**,不是判据。断言与事实脱钩的后果是
 * **"规则删了门还装看不见"**:哪天有人从 `apps/web/next.config.ts` 删掉
 * `source: '/api/llm/:path*'` 那条 rewrite,这两行**照样跳过** ⇒ 门继续绿,
 * 而该前缀在生产已真的 404。本组把判据换成"从 next.config.ts 真读出来的转发面"。
 *
 * 六组用例各钉一格,另有**防过度收紧**一族(本票最容易犯的错在这一侧):
 *  · T1 前缀在解析出的 8803 转发面里 ⇒ 跳过,**不判死**
 *  · T2 规则从夹具 next.config 里删掉 ⇒ skip **失效**、路径重新进对账(**本票核心行为**)
 *  · T3 8802 面(含 `/api/:path*` 兜底)**不得**被当成已验面(否则全仓 `/api/*` 免死调用)
 *  · T4 匹配函数双向用例表(`:path*` / 精确 / 不匹配,含 `:path+` `:path?` `:param`)
 *  · T5 **读不到 next.config 时**的行为(既不当"没有转发面"也不当"全部已验")
 *  · T6 源码锁:解析判据入口不得被静默删掉
 *
 * 不重写判据实现(重写就是第二份真相,会跟着源一起漂绿);只锁"装上了 / 有牙 / 不过度"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 遮噪必须引 lib 那一份实现(§22c:测试里不得再抄一台分词器,否则"测试跟着实现一起漂绿")
import { maskComments } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-api-routes.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

const BASELINE = JSON.stringify({ version: 1, perFileCount: {} })

/** 一份最小可用的 next.config.ts 夹具:`lines` 逐行拼在 `nextConfig` 的 rewrites 里 */
function nextConfig(lines) {
  return [
    "const IHUI_API_PROXY_TARGET = process.env.IHUI_API_PROXY_TARGET ?? 'http://localhost:8802'",
    "const IHUI_AI_PROXY_TARGET = process.env.IHUI_AI_PROXY_TARGET ?? 'http://localhost:8803'",
    'const nextConfig = {',
    '  async rewrites() {',
    '    return {',
    '      beforeFiles: [',
    ...lines,
    '      ],',
    '    }',
    '  },',
    '}',
    'export default nextConfig',
    '',
  ].join('\n')
}

/** ai-service(8803)转发面里的一条规则 */
function aiRule(source) {
  return [
    '        {',
    `          source: '${source}',`,
    '          destination: `${IHUI_AI_PROXY_TARGET}${source}`,',
    '        },',
  ]
}

/** apps/api(8802)转发面里的一条规则 */
function apiRule(source) {
  return [
    '        {',
    `          source: '${source}',`,
    '          destination: `${IHUI_API_PROXY_TARGET}${source}`,',
    '        },',
  ]
}

/** 本组默认夹具:ai 面 2 条(llm/voice,策略面要的就是这两条)+ api 面 4 条真实形态 */
function defaultNextConfig() {
  return nextConfig([
    ...aiRule('/api/llm/:path*'),
    ...aiRule('/api/voice/:path*'),
    ...apiRule('/v1/:path*'),
    ...apiRule('/v1beta/:path*'),
    ...apiRule('/api/:path*'),
    ...apiRule('/ws/:path*'),
  ])
}

function root() {
  const dir = mkScratch('ihui-api-routes-nextrw-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  mkdirSync(join(dir, 'apps', 'ai-service', 'app', 'routers'), { recursive: true })
  mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
  return dir
}
function put(dir, rel, content) {
  const full = join(dir, ...rel.split('/'))
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}
function run(dir, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, '--worktree', '--root', dir, ...extra], {
    cwd: HERE,
    encoding: 'utf8',
    // 不建 stdin 管道在本机会必 EBUSY(见记忆:凡不吃 stdin 的子进程一律带管道)
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}
/** 某一端的调用点数 */
function calls(out, end) {
  const m =
    out.match(new RegExp(`· ${end}:文件 (\\d+) / 调用 (\\d+) /`)) ||
    out.match(new RegExp(`· ${end}:文件 (\\d+) / 调用点 (\\d+) /`))
  if (!m) throw new Error(`输出里没有 ${end} 的报数行\n${out}`)
  return Number(m[2])
}
/** `--dump-missing` 落盘后读回死调用清单 */
function missingOf(dir, r) {
  const p = join(dir, 'missing.json')
  const r2 = run(dir, ['--warn-only', '--dump-missing', p])
  assert.equal(r2.status, 0, `本组用例不该 exit 非 0\n${r2.out}`)
  void r
  return JSON.parse(readFileSync(p, 'utf8'))
}
/** 死调用清单里的 `METHOD path` 集合 */
function missingKeys(list) {
  return list.map((c) => `${c.method} ${c.path}`).sort()
}

// ─────────────────────────────────────────────────────────────────────────
// T1 前缀在解析出的 8803 转发面里 ⇒ 跳过,不判死
// ─────────────────────────────────────────────────────────────────────────
//
// 判据读的是**夹具自己造出来的** next.config.ts(不是真仓那份),所以这组真正在验
// "读到 ⇒ 豁免"这条腿。`/api/llm/chat` 后端刻意**不注册** —— 若豁免不生效,它会变死调用。
test('T1 前缀在解析出的 8803 转发面内 ⇒ 该前缀跳过、不判死(豁免真的装上了牙)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/web/next.config.ts', defaultNextConfig())
    put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/chat')\n")
    const r = run(dir, ['--warn-only'])
    const missing = missingOf(dir, r)
    assert.equal(calls(r.out, 'web'), 0, `命中转发面的前缀不该进调用集\n${r.out}`)
    assert.deepEqual(
      missingKeys(missing),
      [],
      `8803 转发面内的前缀不得判死调用\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(r.status, 0, `本用例不该判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// 防过度收紧(同一条腿的另一半):**只**在转发面里的前缀豁免,面外的同族前缀不许一起豁免。
// `/api/llmx/chat` 不是 `/api/llm/:path*` 命中的路径(段边界不同),它必须进对账。
test('T1 防过度收紧:段边界不同(`/api/llmx/`)不在 `/api/llm/:path*` 射程内 ⇒ 照常进对账', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/web/next.config.ts', defaultNextConfig())
    put(dir, 'apps/web/src/llmx.ts', "export const go = () => api('/api/llmx/chat')\n")
    const r = run(dir, ['--warn-only'])
    const missing = missingOf(dir, r)
    assert.equal(calls(r.out, 'web'), 1, `非转发面内的调用点必须仍在调用集里\n${r.out}`)
    assert.deepEqual(
      missingKeys(missing),
      ['GET /api/llmx/chat'],
      `/api/llmx/chat 不该被 /api/llm/:path* 豁免(段边界不同)\n${JSON.stringify(missing, null, 1)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// T2 规则从夹具 next.config 里删掉 ⇒ skip 失效、路径重新进对账(**本票核心行为**)
// ─────────────────────────────────────────────────────────────────────────
//
// 这是改前**做不到**的那一格:改前那两行 `continue` 与 next.config.ts 无关,
// 把 `/api/llm/:path*` 那条规则从夹具里删掉,改前仍然跳过(门装看不见);改后必须进对账。
test('T2 把 `/api/llm/:path*` 那条 rewrite 从夹具 next.config 删掉 ⇒ skip 失效、路径重新进对账', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 只留 voice 那条:llm 规则**已被删除**
    put(
      dir,
      'apps/web/next.config.ts',
      nextConfig([
        ...aiRule('/api/voice/:path*'),
        ...apiRule('/api/:path*'),
      ]),
    )
    put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/chat')\n")
    const r = run(dir, ['--warn-only'])
    const missing = missingOf(dir, r)
    assert.equal(
      calls(r.out, 'web'),
      1,
      `rewrite 规则被删后该调用点必须重新进对账(改前那两行 continue 会让它继续隐身)\n${r.out}`,
    )
    assert.deepEqual(
      missingKeys(missing),
      ['GET /api/llm/chat'],
      `规则删了 ⇒ 路径已无后端路由 ⇒ 必须被点名\n${JSON.stringify(missing, null, 1)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// T2 的第二条腿:规则被删时,报告必须**响**。判据失效若表现为安静,本票就白做。
test('T2 规则被删 ⇒ 报告点名"已失效的策略前缀",不静默', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/web/next.config.ts', nextConfig([...aiRule('/api/voice/:path*')]))
    put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/chat')\n")
    const r = run(dir, ['--warn-only'])
    assert.match(
      r.out,
      /next rewrites 转发面[\s\S]*已失效的策略前缀/,
      `规则被删必须被点名(判据失效的表现永远是安静)\n${r.out}`,
    )
    assert.match(r.out, /\/api\/llm\/:path\*/, `必须点名是哪条策略前缀失效了\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// T2 的第三条腿:规则被**改窄**(不再是通配,只剩精确路径)也必须让 skip 失效。
// 这一格防的是"只按前缀字面量判覆盖"那种半吊子实现:`/api/llm/:path*` 变 `/api/llm/chat`
// 之后,策略前缀的射程已不被覆盖 ⇒ 必须重新进对账。
test('T2 规则被改窄成精确路径 ⇒ 覆盖裁定不认、skip 失效、重新进对账', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(
      dir,
      'apps/web/next.config.ts',
      nextConfig([...aiRule('/api/llm/chat'), ...aiRule('/api/voice/:path*')]),
    )
    put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/combos')\n")
    const r = run(dir, ['--warn-only'])
    const missing = missingOf(dir, r)
    assert.equal(
      calls(r.out, 'web'),
      1,
      `规则被改窄后 /api/llm/combos 已不在转发面内 ⇒ 必须进对账\n${r.out}`,
    )
    assert.deepEqual(missingKeys(missing), ['GET /api/llm/combos'])
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// T3 8802 面(含 `/api/:path*` 兜底)不得被当成已验面 —— 防过度收紧的主战场
// ─────────────────────────────────────────────────────────────────────────
//
// 这是本票**最危险**的一格:8802 面里有一条 `source: '/api/:path*'` 兜底,覆盖全仓每一个
// `/api/*`。若解析时把它当成"已验面",本门主面就被自己豁免掉了 ——
// 下面这个用例的后端**刻意什么都不注册**,任何 `/api/whatever` 都必须被判死;
// 一旦 8802 兜底被误当已验面,`missing` 会是空数组,用例当场翻红。
test('T3 8802 面(含 /api/:path* 兜底)不是已验面 ⇒ 任意 /api/* 仍进对账、不免死', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 夹具的 next.config **只有** 8802 面(其中就有 /api/:path* 兜底),ai 面一条都没有
    put(
      dir,
      'apps/web/next.config.ts',
      nextConfig([
        ...apiRule('/v1/:path*'),
        ...apiRule('/v1beta/:path*'),
        ...apiRule('/api/:path*'),
        ...apiRule('/ws/:path*'),
      ]),
    )
    // 后端零注册 ⇒ 每一条 /api/* 都该死
    put(dir, 'apps/web/src/a.ts', "export const go = () => api('/api/whatever/deep/path')\n")
    put(dir, 'apps/web/src/b.ts', "export const go2 = () => api('/api/llm/chat')\n")
    const r = run(dir, ['--warn-only'])
    const missing = missingOf(dir, r)
    assert.equal(
      calls(r.out, 'web'),
      2,
      `8802 兜底不得豁免任何调用点(否则全仓 /api/* 免死调用)\n${r.out}`,
    )
    assert.deepEqual(
      missingKeys(missing),
      ['GET /api/llm/chat', 'GET /api/whatever/deep/path'],
      `两条都必须进对账并被判死;空清单 = 8802 兜底被误当已验面\n${JSON.stringify(missing, null, 1)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// T3 的第二条腿:报告在"有东西要说"的那一档必须把 8802 面的条数与"永不豁免"打在脸上。
// 这不是为了好看:下一个想扩豁免面的人,这一行就是那个决定的即时反证。
test('T3 8802 面在报告里被点名"永不豁免",且带出 /api/:path* 兜底这条', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // ai 面留空(策略面全失效)⇒ 报告进"有东西要说"那一档
    put(dir, 'apps/web/next.config.ts', nextConfig([...apiRule('/api/:path*')]))
    put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/chat')\n")
    const r = run(dir, ['--warn-only'])
    assert.match(r.out, /apps\/api 自己那面 1 条\*\*永不豁免\*\*/, `8802 面必须被点名\n${r.out}`)
    assert.match(r.out, /\/api\/:path\* 兜底/, `必须点出那条兜底的存在\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// T3 的第三条腿(反向哨兵):**读到了、策略面两条都在、8802 兜底也在**的正常档下,
// 报告**必须不打印这一格** —— 否则默认档输出不再与改前逐字节相同。
// 这条是"逐字节不变"这条硬约束的锁。
test('T3 正常档(读到且策略面全在)报告不打印 ⇒ 默认档输出与改前逐字节一致', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/web/next.config.ts', defaultNextConfig())
    put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/chat')\n")
    const r = run(dir, ['--warn-only'])
    assert.doesNotMatch(
      r.out,
      /next rewrites 转发面/,
      `读到了且策略面全在时不得打印这一格(默认档必须逐字节不变)\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// T4 匹配函数的双向用例表
// ─────────────────────────────────────────────────────────────────────────
//
// 判据本体在 `scripts/check-api-routes.mjs` 的 `matchRewriteSource`,本组**不重写**它
// (重写就是第二份真相,会跟着源一起漂绿)。
//
// ## 观察通道:只有策略面那两条能被端到端看到
// 豁免面 = 策略面(`/api/llm/:path*`、`/api/voice/:path*`)∩ ai 转发面覆盖面。
// 非策略面的 source 形态(`:path+` / `:path?` / 裸 `:param` / 精确路径)端到端**看不到**
// matchRewriteSource 的输出 —— 覆盖裁定会在它们有机会进豁免面之前就挡掉。
// 故本组分两族,合起来覆盖 matchRewriteSource 的全部输入形态:
//  · **策略面族**(下表):端到端可观察,直接断"跳没跳过"。每条用例的 next.config **只放该条
//    策略前缀自己**,否则会被另一条策略前缀顺带豁免(例如在只测 llm 的用例里放 voice 规则,
//    `/api/voice/stt` 会被 voice 那条正当豁免,测的就不是"llm 判它不命中"了)。
//  · **形态族**(`COVER_CASES`):非策略面的形态由覆盖裁定那一侧钉 —— 覆盖裁定内部逐段调用
//    matchRewriteSource,故那组用例同样锁住了段边界与通配宽度语义。
const CLAIM_MATCH_CASES = [
  // 形态 × 输入 → 是否命中。路径一律挑**能分辨该形态**的那一档。
  { claim: '/api/llm/:path*', path: '/api/llm', hit: true, note: ':path* 吃零段' },
  { claim: '/api/llm/:path*', path: '/api/llm/chat', hit: true, note: '一段' },
  {
    claim: '/api/llm/:path*',
    path: '/api/llm/fim/metrics/summary',
    hit: true,
    note: '四段(首版 `take` 上界写错就漏这一格)',
  },
  { claim: '/api/llm/:path*', path: '/api/llm/', hit: true, note: '尾斜杠归一' },
  { claim: '/api/llm/:path*', path: '/api/llmx/chat', hit: false, note: '段边界不同' },
  { claim: '/api/llm/:path*', path: '/api/llmchat', hit: false, note: '前缀粘连' },
  { claim: '/api/llm/:path*', path: '/api/llm-x/chat', hit: false, note: '连字符合并' },
  { claim: '/api/llm/:path*', path: '/api/other/stt', hit: false, note: '兄弟前缀' },
  { claim: '/api/llm/:path*', path: '/api/x/llm', hit: false, note: '顺序不同不是前缀' },
  // voice 那条同样要能双向工作(两条策略前缀共用同一个 matchRewriteSource)
  { claim: '/api/voice/:path*', path: '/api/voice/stt', hit: true, note: 'voice 一段' },
  { claim: '/api/voice/:path*', path: '/api/voice', hit: true, note: 'voice 零段' },
  { claim: '/api/voice/:path*', path: '/api/voicex/stt', hit: false, note: 'voice 段边界' },
]

for (const c of CLAIM_MATCH_CASES) {
  test(`T4 匹配:${c.claim} × ${c.path} ⇒ ${c.hit ? '命中(跳过)' : '不命中(进对账)'}(${c.note})`, () => {
    const dir = root()
    try {
      put(dir, 'scripts/api-routes-baseline.json', BASELINE)
      // 只放被测那一条策略前缀 ⇒ 另一条策略前缀不会顺带豁免(否则测的就不是它了)
      put(dir, 'apps/web/next.config.ts', nextConfig(aiRule(c.claim)))
      put(dir, 'apps/web/src/probe.ts', `export const go = () => api('${c.path}')\n`)
      const r = run(dir, ['--warn-only'])
      assert.equal(
        calls(r.out, 'web'),
        c.hit ? 0 : 1,
        `${c.claim} × ${c.path} 期望${c.hit ? '命中(跳过)' : '不命中(进对账)'}(${c.note})\n${r.out}`,
      )
    } finally {
      rmScratch(dir)
    }
  })
}

// T4 的覆盖裁定族:策略前缀 `/api/llm/:path*` 面对**不同 source 形态**时,宽严必须如下。
// 这一族直接测 `rewriteSourceCoversClaim`,是本票判据里唯一带"近似"成分的那一格
// (段模式包含判定),必须逐档钉死,否则下一个人改它没人知道会动哪一档。
//
// ⚠️ 特别地 `:path?` / 裸 `:path` 两档是**放宽方向**的守卫:它们都能命中
// `/api/llm/chat` 这类单段路径,但只覆盖一段、覆盖不了 `/api/llm/a/b`。
// 判据若用"拿样本路径试"来裁定,这两档会被误判成覆盖 ⇒ 多段路径被豁免 ⇒ 门装看不见。
const COVER_CASES = [
  { face: '/api/llm/:path*', covered: true, note: '同形 ⇒ 覆盖' },
  { face: '/api/:path*', covered: true, note: '更宽的兜底 ⇒ 覆盖' },
  { face: '/api/llm/:path+', covered: true, note: '+ 也是 1..N,能覆盖 * 的 0..N 段要求' },
  { face: '/api/llm/:path?', covered: false, note: '只覆盖一段 ⇒ 不覆盖(放宽方向守卫)' },
  { face: '/api/llm/:path', covered: false, note: '只覆盖一段 ⇒ 不覆盖(放宽方向守卫)' },
  { face: '/api/llm', covered: false, note: '精确更窄 ⇒ 不覆盖' },
  { face: '/api/llm/chat', covered: false, note: '精确兄弟路径 ⇒ 不覆盖' },
  { face: '/api/other/:path*', covered: false, note: '兄弟前缀 ⇒ 不覆盖' },
  { face: '/api/llmx/:path*', covered: false, note: '段边界不同 ⇒ 不覆盖' },
  { face: '/api/:p*', covered: true, note: '同形不同参数名 ⇒ 覆盖(参数名不参与形状)' },
]

for (const c of COVER_CASES) {
  test(`T4 覆盖裁定:ai 面 ${c.face} 是否覆盖策略前缀 /api/llm/:path* ⇒ ${c.covered ? '是' : '否'}(${c.note})`, () => {
    const dir = root()
    try {
      put(dir, 'scripts/api-routes-baseline.json', BASELINE)
      // voice 那条保持策略形态,只有 llm 这条被换成 c.face
      put(
        dir,
        'apps/web/next.config.ts',
        nextConfig([...aiRule(c.face), ...aiRule('/api/voice/:path*')]),
      )
      // 用**多段**路径验"覆盖"这一档:单段路径在 `:path?` 下也命中,分辨不开
      put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/a/b/c')\n")
      const r = run(dir, ['--warn-only'])
      // 覆盖 ⇒ 豁免生效 ⇒ 调用点不进调用集;不覆盖 ⇒ 进对账
      assert.equal(
        calls(r.out, 'web'),
        c.covered ? 0 : 1,
        `ai 面 ${c.face} 对策略前缀 /api/llm/:path* 的覆盖裁定应为 ${c.covered}(${c.note})\n${r.out}`,
      )
    } finally {
      rmScratch(dir)
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────
// T5 读不到 next.config 时的行为 —— 这一格最易出事
// ─────────────────────────────────────────────────────────────────────────
//
// 三个可能口径里,"静默当成没有转发面"与"静默当成全部已验"都排除:
//   · 当成没有转发面 ⇒ 全部路径突然进对账 ⇒ 存量恒红(§12e)
//   · 当成全部已验   ⇒ 门回到"规则删了也不响"的老病根
// 采用的第三种:退回改前的字面前缀集,并**显式报告降级**。
// 下面两条分别钉住"不静默"与"不新判红"。
test('T5 夹具里没有 next.config.ts ⇒ 显式报告降级(不静默当成"没有转发面"或"全部已验")', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/chat')\n")
    const r = run(dir, ['--warn-only'])
    assert.match(
      r.out,
      /⚠️ 未判定\(next rewrites 转发面\)/,
      `读不到 next.config 必须显式报降级\n${r.out}`,
    )
    assert.match(r.out, /兜底/, `必须说明这一格用的是兜底集而非"已读出转发面"\n${r.out}`)
    assert.doesNotMatch(
      r.out,
      /next rewrites 转发面\(读自/,
      `降级档不得伪装成"读到了"\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// T5 的第二条腿:降级时**不得**新判红(§12e)。降级档继续按改前口径豁免 llm/voice,
// 所以 `/api/llm/chat` 不该进对账、也不该判死。
test('T5 降级档不得新判红:退回的字面前缀集继续生效,llm/voice 不进对账', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/chat')\n")
    put(dir, 'apps/web/src/voice.ts', "export const go2 = () => api('/api/voice/stt')\n")
    const r = run(dir, ['--warn-only'])
    assert.equal(
      calls(r.out, 'web'),
      0,
      `降级档继续按改前口径豁免,不得让存量突然进对账(§12e)\n${r.out}`,
    )
    assert.equal(r.status, 0, `降级档不判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// T5 的第三条腿:next.config.ts 存在但**解析不出任何规则对**(形态变了)也走同一个降级出口,
// 不是"读到了 ⇒ 没有转发面"(那会让全部路径进对账)。
test('T5 next.config 读到了但解析不出规则对 ⇒ 同一个降级出口,不判红、不静默', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/web/next.config.ts', 'export default { async rewrites() { return {} } }\n')
    put(dir, 'apps/web/src/llm.ts', "export const go = () => api('/api/llm/chat')\n")
    const r = run(dir, ['--warn-only'])
    assert.match(r.out, /⚠️ 未判定\(next rewrites 转发面\)/, `解析不出必须报降级\n${r.out}`)
    assert.match(r.out, /解析不出/, `必须说明是"解析不出"而不是"没有转发面"\n${r.out}`)
    assert.equal(r.status, 0, `降级档不判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// T6 源码锁:解析判据入口不得被静默删掉
// ─────────────────────────────────────────────────────────────────────────
//
// 判据被删掉时,最危险的形态不是报错(会立刻发现),而是**连同它的调用点一起消失** ——
// 那样 T1/T2 会在夹具里"因为豁免失效"而误判为通过。所以判据入口本身要上锁。
test('T6 源码锁:next rewrites 解析判据的入口与分面常量都在', () => {
  assert.match(SRC, /const NEXT_CONFIG_REL = 'apps\/web\/next\.config\.ts'/, '取材点常量被删了')
  assert.match(SRC, /function parseNextRewriteForwardFaces\(/, '解析函数被删了')
  assert.match(SRC, /function matchRewriteSource\(/, '匹配函数被删了')
  assert.match(SRC, /function nextRewriteExemption\(/, '豁免面读取函数被删了')
  assert.match(SRC, /function corroborateExemptionPrefixes\(/, '覆盖裁定函数被删了')
  // 分面必须发生在**取值处**:两个目标常量的字面判别式都必须在解析函数里
  assert.match(SRC, /const REWRITE_TARGET_AI = 'IHUI_AI_PROXY_TARGET'/, '8803 面常量被删了')
  assert.match(SRC, /const REWRITE_TARGET_API = 'IHUI_API_PROXY_TARGET'/, '8802 面常量被删了')
  // 豁免面必须**只用** corroborated(经裁定的那份),不得直接吃 forwarded 全集
  const fn = SRC.slice(SRC.indexOf('function isNextRewriteForwardedPath('))
  const body = fn.slice(0, fn.indexOf('\n}'))
  assert.match(
    body,
    /exemption\.corroborated/,
    `豁免判据必须用经覆盖裁定的 corroborated,不得直接用 forwarded 全集\n${body}`,
  )
  assert.doesNotMatch(
    body,
    /exemption\.forwarded/,
    `豁免判据不得直接吃 ai 面全 53 条(实测会把 101 条真调用点赶出对账面)\n${body}`,
  )
  // 旧的硬编码前缀判据不得复活 —— 但只在**可执行代码**上扫。
  //
  // ⚠️ 必须先剥注释再扫:判据上方的变更说明**故意**引用了改前那两行原话
  // ("改前这里是两行硬编码 `rawPath.startsWith('/api/llm/')` …"),那是如实记录改前状态,
  // 不是现行断言。全文扫会把变更说明也判成违规,逼着下一个人删掉它 —— 那才是在破坏可追溯性。
  // 这里用与判据本身同款的遮罩(§22c:测试里不得再抄一台分词器)。
  const codeOnly = maskComments(SRC)
  assert.doesNotMatch(
    codeOnly,
    /rawPath\.startsWith\('\/api\/llm\/'\)/,
    '硬编码 /api/llm/ 前缀判据复活了',
  )
  assert.doesNotMatch(
    codeOnly,
    /rawPath\.startsWith\('\/api\/voice\/'\)/,
    '硬编码 /api/voice/ 前缀判据复活了',
  )
})

// T6 的第二条腿:硬编码的**策略面**常量必须还在(它是政策,允许存在),
// 但**豁免判据处**的注释必须指向判据来源,不能只是宣称"走 Next.js rewrite 到 ai-service"。
//
// ⚠️ 两个取样陷阱,都踩过:
//  ① 不能拿全文 `doesNotMatch(/走 Next\.js rewrite/)` 来钉:判据上方的注释**故意**引用了
//     改前那两句原话("改前这里是两行硬编码…")—— 那是变更说明,不是现行断言。
//     全文扫会把"如实记录改前状态"也判成违规,逼着下一个人删掉变更说明。
//  ② 不能按"向上取到空行为止"取注释块:该 `continue` 位于 `lines.forEach` 循环体内部,
//     整段循环里**一个空行都没有** ⇒ 会一路捞到几百行外的函数头注释上去。
// 所以按豁免段自己的**起始标记行**取块:上界是段首,下界是那句 continue。
test('T6 豁免判据处的注释指向判据来源,不再只是宣称"走 Next.js rewrite"', () => {
  assert.match(SRC, /const REWRITE_EXEMPTION_CLAIMS = \[/, '策略面常量被删了')
  const at = SRC.indexOf('if (!cliShapes && isNextRewriteForwardedPath(rawPath, rewriteExemption))')
  assert.ok(at > 0, '找不到豁免判据的调用点')
  const startMark = '// ── next rewrites 转发面豁免('
  const start = SRC.lastIndexOf(startMark, at)
  assert.ok(start > 0 && start < at, '找不到豁免段的注释起始标记')
  const block = SRC.slice(start, at)
  assert.match(block, /next\.config\.ts/, `豁免处的注释必须指向判据来源 next.config.ts\n${block}`)
  assert.doesNotMatch(
    block,
    /走 Next\.js rewrite 到 ai-service/,
    `豁免处仍在宣称人工断言(注释必须与代码现状一致)\n${block}`,
  )
  // 正面那一格:注释必须说明"规则被删 ⇒ skip 失效"这个收益,否则读者学不到本票的意图
  assert.match(
    block,
    /规则被删时 skip 自动失效|规则被删.*skip.*失效/s,
    `豁免处注释必须写明本票的收益(规则被删 ⇒ skip 失效)\n${block}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

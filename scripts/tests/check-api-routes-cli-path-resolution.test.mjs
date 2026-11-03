// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 8(check-api-routes)的「CLI 变量路径一跳常量解析」(2026-09-27 判据扩面票)
// 判据本体在 scripts/check-api-routes.mjs;本文件按 §22c 只锁"装上了 / 有牙 / 不静默 / 口径不漂",
// 不重写解析实现(重写就是第二份真相)。行为面的成对用例(构造面必命中 / 解析不到仍落未判定)
// 在同目录 check-api-routes-cli-ends.test.mjs 的 N12-N16,此处不重复,只补那一份补不了的三件事:
// 真仓 HEAD 面的正向对照、取材面纪律的形状锁、以及"未判定既不算绿也不算红"的方向锁。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-api-routes.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

function run(args, cwd = HERE) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ─── T1 装车证明:一跳解析的每个环节都必须"既有定义又有调用点" ───
// (函数在而无人调 = 提交链上一路绿灯,守门 70/76/81 同型;这里逐个数接线)
test('一跳解析各构件必须已接线(定义 + 至少一个调用点)', () => {
  for (const fn of [
    'cliFactoryCallRe',
    'cliVarArgToken',
    'cliVarArgNames',
    'classifyCliVarInit',
    'cliInitToPaths',
    'findCliVarDeclLine',
    'cliImportBindings',
    'cliImportCandidates',
    'cliExportedConstPath',
    'resolveCliVarPathOneHop',
    'buildLineStartOffsets',
  ]) {
    // 文本计数即够:定义行的 `function X(` 与调用点的 `X(` 都形如 "X("。0/1 次 = 摘线或死代码。
    const withParen = SRC.split(fn + '(').length - 1
    assert.ok(withParen >= 2, `${fn} 必须既有定义又有调用点(接线);现测 "X(" 形态 ${withParen} 次`)
  }
  // 预扫描算好的 import 目标表必须真的喂进提取器(第四实参),否则 import 一跳整条空转
  assert.match(SRC, /extractCliShapeCalls\(src, rel, cliFactory, cliImportInfo\.get\(rel\)\)/)
  // 工厂调用正则的**构造点全仓只许一处**(在 cliFactoryCallRe 里);提取器/预扫描各自手搓
  // 一份 = 两处判据必漂移(守门 131/135 同族)。构造出现 ≠1 次即红。
  assert.equal(
    (SRC.match(/new RegExp\(`\\\\b\$\{name\}/g) || []).length,
    1,
    'callRe 的构造必须恰好一处(cliFactoryCallRe);0 = 被拆走,>1 = 第二份真相',
  )
})

// ─── T2 取材面纪律形状锁:内容一律走 face-reader,遮罩只许引那一份实现 ───
test('一跳解析不得开第二取材面/第二遮罩实现', () => {
  assert.match(SRC, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(SRC, /from '\.\/lib\/code-mask\.mjs'/)
  assert.equal(
    (SRC.match(/function\s+maskCommentsAndStrings/g) || []).length,
    0,
    '不得在门内重写遮罩(守门 131/135 同族:两处实现必漂移)',
  )
  assert.equal(
    (SRC.match(/readFileSync\(/g) || []).length,
    0,
    '被审内容不得按磁盘散读(面纪律:全量 HEAD blob / --staged 索引 blob)',
  )
  // import 目标的"存在性"必须问被审面(catBatchOids),工作树档才允许 existsSync
  assert.ok(
    (SRC.match(/catBatchOids/g) || []).length >= 2 && /catBatchOids\(/.test(SRC),
    'catBatchOids 必须既在 import 面又被真调用(存在性问面,不问盘)',
  )
  assert.match(SRC, /if \(FACE === 'worktree'\)[\s\S]{0,400}?existsSync\(/)
})

// ─── T3 真仓 HEAD 面正向对照:本票清偿的 9 站不得再回未判定桶,残留桶必须带原因 ───
// (判据失明的表现永远是安静 —— 若解析分支被摘线,这 9 站会悄悄回到未判定且账面仍"通过",
//  该断言把"回潮"变成可见红;残留的 3 站是诚实的判不出,只要求点名原因在位。)
test('真仓 HEAD 面:已清偿站点不再落未判定,未判定每条都带原因,总数严格小于 12', () => {
  const r = run([])
  assert.notEqual(r.status, 2, `取材面失问不得伪装成结论:\n${r.out}`)
  const m = /未判定\(CLI 变量路径调用点\)(\d+) 处/.exec(r.out)
  const count = m ? Number(m[1]) : 0
  assert.ok(count < 12, `一跳解析前该桶是 12 处;现读 ${count} 处 ⇒ 若回到 12 说明解析被摘线`)
  if (count > 0) {
    const siteLines = r.out.split('\n').filter((l) => l.includes('<变量路径>'))
    assert.ok(siteLines.length > 0, '头部说有未判定,却没有逐条点名 ⇒ 不成立')
    for (const l of siteLines) {
      assert.match(l, /—— \S/, `未判定条目必须带原因(不得只报"拼不出"):${l}`)
    }
    assert.ok(siteLines.length <= count, '点名条数不得超过头部计数')
    for (const site of [
      'commands/context.ts:170',
      'commands/context.ts:332',
      'commands/mcp-market.ts:263',
      'commands/mcp-market.ts:317',
      'commands/mcp-market.ts:379',
      'commands/memory.ts:287',
      'commands/memory.ts:338',
      'commands/security.ts:249',
      'commands/security.ts:302',
    ]) {
      assert.ok(
        siteLines.every((l) => !l.includes(site)),
        `本票已清偿的站点回潮进未判定桶:${site}`,
      )
    }
  }
})

// ─── T4 方向锁:"未判定"既不并进绿也不并进红 ───
// 同一夹具里放一条真死调用 + 一条判不出的变量站:
//  ⇒ 退出码必须是红(未判定不得被算成"已判过");且红只点名真死调用,变量站只进未判定块。
test('未判定不冲销真判据:同轮有真死调用时仍 exit 1,且红只点名已判定的那条', () => {
  const dir = mkScratch('ihui-api-routes-dir-lock-')
  const put = (rel, content) => {
    const full = join(dir, ...rel.split('/'))
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  try {
    put('scripts/api-routes-baseline.json', JSON.stringify({ version: 1, perFileCount: {} }))
    put('apps/api/src/routes/t4.ts', "server.get('/api/t4probe/list', async () => ({}))\n")
    put(
      'apps/cli/src/commands/t4.ts',
      [
        "const API_PREFIX = '/api/t4probe';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        'const qs = makeQs()',
        "const ghost = await apiRequest(baseUrl, '/ghost', { method: 'POST' });",
        'const r = await apiRequest(baseUrl, qs, { apiKey })',
        '',
      ].join('\n'),
    )
    const r = run(['--worktree', '--root', dir])
    assert.equal(r.status, 1, `判据不被"未判定"冲销\n${r.out}`)
    assert.match(r.out, /POST \/api\/t4probe\/ghost/)
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)1 处/)
    assert.match(r.out, /t4\.ts:5 ——/)
    assert.doesNotMatch(
      r.out,
      /(GET|POST|PUT|PATCH|DELETE|ANY) \S+ @ apps\/cli\/src\/commands\/t4\.ts:5/,
      '判不出的站不得被造出路径判红(它只允许出现在未判定块里,那里没有 "METHOD path @ file:5" 形态)',
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ─── T5 查询串助手档:按返回值形状判,不按函数名判 ───
// 真仓那 3 处是 `const qs = buildQueryString(query)` 后把 qs 直接当 path 传进工厂;
// 该助手在本仓有**三份同名各自定义**,返回值形状相同而名字相同不代表形状相同 ⇒
// 判据只能读函数体的 return 字面量。三条臂各钉一边:能证的必须解出来、
// 形状不对的必须留在未判定、跨文件的(二跳)一律不追。
test('查询串助手档:同文件且返回值只会是 ?k=v / 空串 ⇒ 路由即工厂前缀', () => {
  const dir = mkScratch('ihui-api-routes-qs-only-')
  const put = (rel, content) => {
    const full = join(dir, ...rel.split('/'))
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  try {
    put('scripts/api-routes-baseline.json', JSON.stringify({ version: 1, perFileCount: {} }))
    // 后端**故意不注册** /api/t5probe ⇒ 一旦解析成功,它会以"死调用"的形式冒出来;
    // 这比"未判定变少"更硬:它证明路径真被拼出来了,而不是整条被静默丢掉。
    put('apps/api/src/routes/t5.ts', "server.get('/api/t5probe/list', async () => ({}))\n")
    put(
      'apps/cli/src/commands/t5.ts',
      [
        "const API_PREFIX = '/api/t5probe';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        'function buildQueryString(query: Record<string, string | undefined>): string {',
        '  const params = new URLSearchParams();',
        "  if (query.k) params.set('k', query.k);",
        '  const qs = params.toString();',
        "  return qs ? `?${qs}` : '';",
        '}',
        'const qs = buildQueryString(query);',
        'const resp = await apiRequest(baseUrl, qs, { apiKey });',
        '',
      ].join('\n'),
    )
    const r = run(['--worktree', '--root', dir])
    assert.equal(r.status, 1, '解析出的路由要能问责(未注册 ⇒ 判红),不能停在"没看见"\n' + r.out)
    assert.match(r.out, /GET \/api\/t5probe @ apps\/cli\/src\/commands\/t5\.ts:10/)
    // 这一档解析干净时,报告行**仍要存在**并给出"站点数/路径数"(见 0 也要出声那条设计),
    // 所以这里判的是"没有未判定条目",不是"没有这一行"。
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)0 处 —— 变量站点 1 条全部由一跳解析给出/)
    assert.doesNotMatch(r.out, /<变量路径>/, '解出来了就不许再点名未判定条目')
  } finally {
    rmScratch(dir)
  }
})

test('同名但返回值形状不对(会产出路径段)⇒ 必须留在未判定,不得造路径', () => {
  const dir = mkScratch('ihui-api-routes-qs-neg-')
  const put = (rel, content) => {
    const full = join(dir, ...rel.split('/'))
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  try {
    put('scripts/api-routes-baseline.json', JSON.stringify({ version: 1, perFileCount: {} }))
    put('apps/api/src/routes/t5b.ts', "server.get('/api/t5bprobe/list', async () => ({}))\n")
    put(
      'apps/cli/src/commands/t5b.ts',
      [
        "const API_PREFIX = '/api/t5bprobe';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        'function buildQueryString(query: Record<string, string | undefined>): string {',
        "  return query.k ? `/detail/${query.k}` : '';",
        '}',
        'const qs = buildQueryString(query);',
        'const resp = await apiRequest(baseUrl, qs, { apiKey });',
        '',
      ].join('\n'),
    )
    const r = run(['--worktree', '--root', dir])
    assert.equal(r.status, 0, `形状不对时不得判红(那是造路径)\n${r.out}`)
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)1 处/)
    assert.doesNotMatch(r.out, /\/api\/t5bprobe\/detail/)
  } finally {
    rmScratch(dir)
  }
})

test('助手不在本文件(import 来的属二跳)⇒ 不追,留在未判定', () => {
  const dir = mkScratch('ihui-api-routes-qs-hop-')
  const put = (rel, content) => {
    const full = join(dir, ...rel.split('/'))
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  try {
    put('scripts/api-routes-baseline.json', JSON.stringify({ version: 1, perFileCount: {} }))
    put('apps/api/src/routes/t5c.ts', "server.get('/api/t5cprobe/list', async () => ({}))\n")
    put(
      'apps/cli/src/commands/other.ts',
      [
        'export function buildQueryString(q: Record<string, string>): string {',
        "  return q.k ? `?k=${q.k}` : '';",
        '}',
        '',
      ].join('\n'),
    )
    put(
      'apps/cli/src/commands/t5c.ts',
      [
        "const API_PREFIX = '/api/t5cprobe';",
        'const apiRequest = createApiRequest(API_PREFIX, 1000);',
        "import { buildQueryString } from './other.js';",
        'const qs = buildQueryString(query);',
        'const resp = await apiRequest(baseUrl, qs, { apiKey });',
        '',
      ].join('\n'),
    )
    const r = run(['--worktree', '--root', dir])
    assert.equal(r.status, 0, `跨文件不追(宁漏不误报),但必须点名未判定\n${r.out}`)
    assert.match(r.out, /未判定\(CLI 变量路径调用点\)1 处/)
  } finally {
    rmScratch(dir)
  }
})

test('真仓读数必须带变量站点数:0 处未判定只能来自"站点全部解析",不能来自空扫', () => {
  const r = run([])
  const line = r.out.split('\n').find((l) => l.includes('未判定(CLI 变量路径调用点)'))
  assert.ok(line, '这一行必须始终存在(0 也要出声)')
  assert.match(
    line,
    /变量站点 (\d+) 条全部由一跳解析给出 (\d+) 条路径/,
    `0 处必须给出"站点数/路径数"两个量,否则分不清空扫与真干净:${line}`,
  )
  const sites = Number(/变量站点 (\d+)/.exec(line)[1])
  const paths = Number(/给出 (\d+) 条路径/.exec(line)[1])
  assert.ok(sites >= 12, `本票清偿的 12 处不许缩成空面:现读 ${sites}`)
  assert.ok(paths >= sites, '路径数不得少于站点数(三元各分支会各给一条)')
})

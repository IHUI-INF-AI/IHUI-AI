// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/check-admin-gate-consistency.test.mjs
 * O13b admin 面守门的 §22c 镜像单测:直接 import 源脚本 __test__ 导出,无复制实现。
 * 运行:node --test scripts/tests/check-admin-gate-consistency.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
// 遮噪只引这一份实现(守门 131/135 同规矩:两处实现必漂移)。测试自己抄一份剥注释逻辑,
// 就会与门看到的不是同一张脸 —— 那是"锁对着自己的夹具点头"那一型。
import { maskComments } from '../lib/code-mask.mjs'

const {
  detectRawRoleIdComparisons,
  detectLocalRequireAdmin,
  evaluateFile,
  evaluatePlatformInvariants,
  platformScopesFromSource,
  faceFromArgv,
  inApiScope,
  readFaceContents,
  CATALOG_REL,
  LEGACY_RAW_ROLEGATE,
} = (await import('../check-admin-gate-consistency.mjs')).__test__

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE_REL = 'check-admin-gate-consistency.mjs'
const GIT = resolveGitBin() || 'git'

test('裸 roleId 数值比较被识别(>=1 / >0 / ===1 / <1 各形态)', () => {
  assert.equal(detectRawRoleIdComparisons('if (request.jwtPayload?.roleId >= 1) return').length, 1)
  assert.equal(detectRawRoleIdComparisons('if (u.roleId > 0) allow()').length, 1)
  assert.equal(detectRawRoleIdComparisons('if (dbUser.roleId === 1) wildcard()').length, 1)
  assert.equal(detectRawRoleIdComparisons('if (roleId < 1) deny()').length, 1)
})

test('非特权判定形态零误报(赋值 / 对象字面量 / 常量比较 / 注释)', () => {
  const src = [
    'const roleId = payload.roleId ?? 0',
    'return { userId, roleId: 1 }',
    'if (roleId < ADMIN_ROLE_ID) {',
    '// roleId >= 1 视为管理员(注释)',
    'type Row = { roleId: number }',
  ].join('\n')
  assert.deepEqual(detectRawRoleIdComparisons(src), [])
})

test('存量豁免、新增拦截:白名单文件条数内放行、超登记拦下', () => {
  // ⚠️ 夹具不得写死路径 —— 本仓已在此处栽过两次:白名单条目会随 O13b 收敛被删,写死
  // 'apps/api/src/routes/oss.ts' 会在"收敛成功当天"抛 TypeError(条目没了 → .count 取不到),
  // 看起来像判据被改坏,诱发的错误处置是把条目加回去 = 回滚收敛。
  // 探针必须取 count===1 的条目:本例要"2 处 > 登记"才能验拦截,取到 count=6 的会假通过。
  const legacy = Object.entries(LEGACY_RAW_ROLEGATE).find(([, v]) => v.count === 1)?.[0]
  assert.ok(
    !!legacy,
    '自测前置:白名单需至少一条 count===1 的条目(若已全清,本例应随判据一起删除,而不是补条目)',
  )
  assert.ok(LEGACY_RAW_ROLEGATE[legacy].count >= 1)
  const within = evaluateFile({ relPath: legacy, source: 'if (x.roleId >= 1) ok()' })
  assert.deepEqual(within, [], '登记条数内不得报违规')
  const grown = evaluateFile({ relPath: legacy, source: 'x.roleId >= 1\ny.roleId >= 1' })
  assert.equal(grown.length, 1, '超过登记条数必须拦截')
})

test('未登记文件出现裸比较 ⇒ 违规;集中封装自身豁免', () => {
  const fresh = evaluateFile({
    relPath: 'apps/api/src/routes/totally-new.ts',
    source: 'if (r.roleId >= 1) grant()',
  })
  assert.equal(fresh.length, 1)
  assert.match(fresh[0], /RULE-1/)
  const central = evaluateFile({
    relPath: 'apps/api/src/plugins/require-permission.ts',
    source: 'if (roleId >= 1) return\nconst requireAdmin = async () => {}',
  })
  assert.deepEqual(central, [], '集中封装是定义点,不得自我拦截')
})

test('RULE-2:集中封装之外重定义 requireAdmin 被识别,import 行不计', () => {
  assert.equal(
    detectLocalRequireAdmin("import { requireAdmin } from '../../plugins/require-permission.js'")
      .length,
    0,
  )
  assert.equal(detectLocalRequireAdmin('async function requireAdmin(req, reply) {}').length, 1)
  assert.equal(detectLocalRequireAdmin('const requireAdmin = async (req, reply) => {}').length, 1)
})

test('RULE-3:dataClass=platform 条目 thirdPartyEligible 必须为 false,否则拦(自相矛盾哨兵)', () => {
  assert.equal(
    evaluatePlatformInvariants([
      { domain: 'platform', scope: 's:x', dataClass: 'platform', thirdPartyEligible: true },
    ]).length,
    1,
  )
  assert.deepEqual(
    evaluatePlatformInvariants([
      // domain=platform 但 dataClass 非 platform(edu:read/edu:write 真实形态):不属本不变量
      { domain: 'platform', scope: 'edu:read', dataClass: 'scoped-read', thirdPartyEligible: true },
      { domain: 'platform', scope: 's:y', dataClass: 'platform', thirdPartyEligible: false },
      { domain: 'agent', scope: 's:a', dataClass: 'compute', thirdPartyEligible: true },
    ]),
    [],
  )
})

test('真实 capability-catalog 解析:platform 清单存在且不变量成立(解析器漂移哨兵)', () => {
  // 取**被审面**(HEAD blob)而不是磁盘副本:门判哪一面,哨兵就得读哪一面 —— 否则"磁盘副本滞后
  // 而 HEAD 已改"的那一刻,这条哨兵会拿旧内容验新判据(守门 118 立项要防的那一型)。
  const src = readFaceContents(ROOT, [CATALOG_REL], 'head').get(CATALOG_REL)
  assert.equal(typeof src, 'string', 'HEAD 面必须取到能力目录(取不到 = 无法判定,不得记绿)')
  const plat = platformScopesFromSource(src)
  assert.ok(plat.length >= 1, 'platform 域 scope 清单不得为空(为空=解析器看不见该域,判据失效)')
  assert.ok(plat.some((s) => s.scope === 'publish:operate'))
  assert.deepEqual(evaluatePlatformInvariants(plat), [])
})

test('存量白名单只减不增 + 表自身卫生(不留 0 条目)', () => {
  const entries = Object.entries(LEGACY_RAW_ROLEGATE)
  const total = entries.reduce((n, [, v]) => n + v.count, 0)
  assert.ok(total <= 74, `白名单登记总数 ${total} 超过 2026-09-21 盘点值 74(只减不增)`)
  assert.ok(
    entries.every(([, v]) => v.count >= 1),
    '不得留 count=0 的空条目 —— 收敛完成即删项,留 0 会让"表里有它"被误读成"还有债"',
  )
  // **刻意不设下界**。原断言是 `total <= 74 && total >= 40`,那个 `>= 40` 与"只减不增"
  // 方向相反:收敛越成功总数越小,实测已降到 23 —— 于是 O13b 每收敛一批,本例就在达成
  // 当天变红,而红点看起来像"有人改坏了白名单",最省事的"修复"是把条目加回去 = 回滚收敛。
  // 棘轮的下界就是 0(全部收敛完即目标态),要钉的只有上界与表卫生两条。
})

// ───────────────────────────────────────────────────────────────────────────────
// 取材面收口(2026-09-28)的取证:临时 git 仓端到 CLI 的三面三答 + 源码级反向锁。
// 判据本体的正反成对用例住在 `--self-test`(例数以命令末行为准,这里不钉数字);本段只打三类东西:
//  ① 可注入性(门必须能按 `--root` 换仓 —— 否则"审夹具"的测试会静默变成"审真仓",守门 70 那一型);
//  ② CLI 契约(两面旗同给 / 无提交 / 空扫 ⇒ 2,暂存档零候选 ⇒ 0);
//  ③ 反向锁(源码不得回到 node:fs 直读、不得散写 git 取正文、默认档不得变成磁盘)。
//  这三类失效都是**行为断言跟着实现一起漂绿**的形态,只有源码级锁能防。
// ───────────────────────────────────────────────────────────────────────────────

const SCRIPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const X_REL = 'apps/api/src/routes/x.ts'
/** 属性访问形态:来源排除通道对它不开放,必判红(真鉴权不得被"排除"洗白)。 */
const BAD1 = 'export const h = (r) => {\n  if (r.roleId >= 1) return grant()\n  return deny()\n}\n'
const BAD2 = BAD1 + '\nif (r.roleId > 0) grant()\n'
const GOOD = "export const h = (r) => {\n  return requirePermission(r, 'admin')\n}\n"
const CATALOG_OK =
  'export const CAPABILITY_CATALOG = [\n' +
  "  { scope: 'publish:operate', domain: 'platform', dataClass: 'platform', thirdPartyEligible: false },\n" +
  ']\n'

function gitIn(dir, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/**
 * 把门**连同相对 import 闭包**装进夹具仓(门按自身位置推 ROOT,不装它就是在审真仓),
 * 再按参数铺 HEAD 面。闭包由 scratch-module-closure 推导,不手抄。
 */
function writeRepo(
  dir,
  { commit = true, headBody = GOOD, withCatalog = true, withTarget = true } = {},
) {
  gitIn(dir, ['init', '-q'])
  gitIn(dir, ['config', 'user.email', 'gate@fixture.local'])
  gitIn(dir, ['config', 'user.name', 'gate-fixture'])
  gitIn(dir, ['config', 'commit.gpgsign', 'false'])
  if (withTarget) put(dir, X_REL, headBody)
  if (withCatalog) put(dir, CATALOG_REL, CATALOG_OK)
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/face-reader.mjs'])
  if (commit) {
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'fixture'])
  }
  return dir
}

function runFixture(dir, args) {
  try {
    const out = execFileSync(
      process.execPath,
      [join(dir, 'scripts', GATE_REL), '--root', dir, ...args],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 300_000,
        maxBuffer: 64 << 20,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    return { code: 0, out }
  } catch (e) {
    return {
      code: typeof e?.status === 'number' ? e.status : -1,
      out: `${e?.stdout ?? ''}${e?.stderr ?? ''}`,
    }
  }
}

/** 结论行里的"裸roleId比较=N"是三面各自的读数 —— 三面三答靠它区分,而不是只看退出码。 */
function rawOf(out) {
  const m = /裸roleId比较=(\d+)/.exec(out)
  if (!m) throw new Error(`结论行解不出裸 roleId 计数:${out.slice(0, 240)}`)
  return Number(m[1])
}

test('F1 --root 换根取证:夹具仓 HEAD 上的违规被点名(审的是夹具,不是真仓)', () => {
  const dir = mkScratch('adm-gate-f1-')
  try {
    writeRepo(dir, { headBody: BAD1 })
    const r = runFixture(dir, [])
    assert.equal(r.code, 1, `夹具 HEAD 有违规必须 exit 1,实得 ${r.code}:${r.out}`)
    assert.ok(r.out.includes(X_REL), `红的输出必须点名被注入的文件(归因铰链靠它):${r.out}`)
    assert.equal(rawOf(r.out), 1)
    assert.ok(/范围=head/.test(r.out), `结论行必须写出取材面是 head:${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('F2 三面三答:同一棵临时仓,HEAD 干净 / 索引一份违规 / 磁盘另一份违规 ⇒ 三答互异', () => {
  const dir = mkScratch('adm-gate-f2-')
  try {
    writeRepo(dir) // HEAD = GOOD ⇒ 0 处
    put(dir, X_REL, BAD1)
    gitIn(dir, ['add', X_REL]) // 索引 = 1 处
    put(dir, X_REL, BAD2) // 磁盘 = 2 处(第三份)
    const h = runFixture(dir, [])
    const s = runFixture(dir, ['--staged'])
    const w = runFixture(dir, ['--worktree'])
    assert.equal(rawOf(h.out), 0, `HEAD 面是干净那份 ⇒ 0,实得 ${rawOf(h.out)}`)
    assert.equal(h.code, 0, `HEAD 面不得判红,实得 ${h.code}:${h.out}`)
    assert.equal(rawOf(s.out), 1, `--staged 必须判索引里那份(1 处),实得 ${rawOf(s.out)}`)
    assert.equal(s.code, 1, `索引净新增必须 exit 1,实得 ${s.code}`)
    assert.ok(s.out.includes(X_REL), '暂存档的红必须点名文件,否则归因铰链拿不到证据')
    assert.equal(rawOf(w.out), 2, `--worktree 必须看到磁盘那第三份(2 处),实得 ${rawOf(w.out)}`)
  } finally {
    rmScratch(dir)
  }
})

test('F3 两面旗同给 ⇒ exit 2 并喊"无法判定"(不得任选一面冒充判定)', () => {
  const dir = mkScratch('adm-gate-f3-')
  try {
    writeRepo(dir)
    const r = runFixture(dir, ['--staged', '--worktree'])
    assert.equal(r.code, 2, `期望 exit 2,实得 ${r.code}:${r.out}`)
    assert.match(r.out, /无法判定/)
  } finally {
    rmScratch(dir)
  }
})

test('F4 还没有提交 ⇒ exit 2,不得记成"没有违规"', () => {
  const dir = mkScratch('adm-gate-f4-')
  try {
    writeRepo(dir, { commit: false })
    const r = runFixture(dir, [])
    assert.equal(r.code, 2, `无提交时 HEAD 面取不到 ⇒ 必须 2,实得 ${r.code}:${r.out}`)
    assert.match(r.out, /无法判定/)
  } finally {
    rmScratch(dir)
  }
})

test('F5 全量面枚举到 0 个射程内文件 ⇒ 判死(尺子空转不是通过)', () => {
  const dir = mkScratch('adm-gate-f5-')
  try {
    writeRepo(dir, { withTarget: false })
    const r = runFixture(dir, [])
    assert.equal(r.code, 2, `0 候选必须判死,实得 ${r.code}:${r.out}`)
    assert.match(r.out, /枚举到 0 个/)
  } finally {
    rmScratch(dir)
  }
})

test('F6 暂存档零候选 ⇒ 0 —— 那条边界不得被"顺手收紧"成替每次提交挡路', () => {
  const dir = mkScratch('adm-gate-f6-')
  try {
    writeRepo(dir)
    const r = runFixture(dir, ['--staged'])
    assert.equal(r.code, 0, `本次没暂存 apps/api 的 .ts ⇒ 沿用旧语义放行,实得 ${r.code}:${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('F7 磁盘面缺能力目录 ⇒ exit 1(沿用旧语义"判据不完整,按失败处理",不是静默跳过)', () => {
  const dir = mkScratch('adm-gate-f7-')
  try {
    writeRepo(dir)
    rmSync(join(dir, CATALOG_REL))
    const r = runFixture(dir, ['--worktree'])
    assert.equal(r.code, 1, `目录缺席 ⇒ RULE-3 无从成立,必须按失败处理,实得 ${r.code}:${r.out}`)
    assert.match(r.out, /判据不完整/)
  } finally {
    rmScratch(dir)
  }
})

test('F8 纯函数级三面与空扫判定(构造面证明,不依赖仓库瞬时状态)', () => {
  assert.equal(faceFromArgv([]).face, 'head', '默认档必须是 HEAD')
  assert.equal(faceFromArgv(['--staged']).face, 'staged')
  assert.equal(faceFromArgv(['--worktree']).face, 'worktree')
  assert.ok(faceFromArgv(['--staged', '--worktree']).error, '两旗同给必须给error')
  assert.equal(inApiScope('apps/api/src/routes/x.ts'), true)
  assert.equal(inApiScope('apps/api/src/tests/x.ts'), false, '段名精确排除(与旧 walkTs 同形)')
  assert.equal(inApiScope('apps/api/src/mytests/x.ts'), true, '非精确段名不得被子串筛误排除')
  assert.equal(inApiScope('apps/api/src/routes/x.test.ts'), false)
  assert.equal(inApiScope('apps/cli/src/routes/x.ts'), false)
})

test('T1 反向锁(源码级):本门不得再按磁盘判仓库内容', () => {
  const src = readFileSync(join(SCRIPTS_DIR, GATE_REL), 'utf8')
  // 判据面 = **剥注释后的代码面**。不剥就会自咬:头注里"旧形态用 readdirSync 磁盘枚举"这句
  // 说明性文字与真代码同形(本仓记过同类:说明性文字也会带执行性字符)。剥注释是这把锁的
  // 前提,而"前提"必须有阳性对照证明它确实关掉了误报、没关掉判据 —— 见下面两条合成面。
  const code = maskComments(src)
  const locks = [
    [
      '不得再 import node:fs(磁盘直读就是恒红/假绿来回跳那台机器的入口)',
      !/from\s+'node:fs'/.test(code),
    ],
    ['不得回到 readdirSync/statSync 磁盘枚举', !/\b(?:readdirSync|statSync)\s*\(/.test(code)],
    [
      '正文必须经取材层的读取入口',
      /catBatch\s*\(/.test(code) || /readWorktreeFile\s*\(/.test(code),
    ],
    [
      '不得再散写 git 派生(枚举也必须走层的 gitRaw)',
      !/\b(?:execSync|execFileSync)\s*\(/.test(code),
    ],
    ["默认档必须写死 'head'(改成 worktree 就是回到旧形态)", /def:\s*'head'/.test(code)],
    ['不得用 git show 自己取正文', !/['"]show['"]/.test(code)],
  ]
  for (const [why, ok] of locks) assert.ok(ok, why)
  // 阳性对照:同一批锁喂"回到磁盘读"的合成源码 ⇒ 必须逐条抓到(锁若对真违规无牙,它就只是装饰)
  const bad = maskComments(
    [
      "import { readdirSync } from 'node:fs'",
      "import { execFileSync } from 'node:child_process'",
      'const files = readdirSync(ROOT)',
      "execFileSync('git', ['show', 'HEAD:' + p])",
      "const FACE = selectFace({ staged: true, worktree: false, def: 'worktree' })",
      'function statSync() {}',
    ].join('\n'),
  )
  assert.match(bad, /from\s+'node:fs'/, '合成面必须让"node:fs"那条锁命中')
  assert.match(bad, /\b(?:readdirSync|statSync)\s*\(/, '合成面必须让"磁盘枚举"那条锁命中')
  assert.match(bad, /\b(?:execSync|execFileSync)\s*\(/, '合成面必须让"散写 git 派生"那条锁命中')
  assert.ok(
    !/catBatch\s*\(/.test(bad) && !/readWorktreeFile\s*\(/.test(bad),
    '合成面没有层读取入口 ⇒ 该锁也应命中',
  )
  assert.match(bad, /def:\s*'worktree'/, "合成面把默认档写成 'worktree' ⇒ 那条锁必须能区分")
})

test('T2 装车证明:runner 里确有 id 53 指向本门,且 blocking + skipEnv 齐备(摘线不得被读成已装车)', () => {
  const runner = readFaceContents(ROOT, ['scripts/guardian-runner.mjs'], 'head').get(
    'scripts/guardian-runner.mjs',
  )
  assert.equal(typeof runner, 'string', 'runner 的 HEAD 面必须取到')
  const idx = runner.indexOf(`script: '${GATE_REL}'`)
  assert.ok(idx > 0, `runner(HEAD 面)必须登记本门,否则它只是仓库里一个没人调度的脚本`)
  const entry = runner.slice(Math.max(0, idx - 400), idx + 400)
  assert.match(entry, /id:\s*'53'/, `本门条目的 id 必须在注册块附近:${entry.slice(0, 200)}`)
  assert.match(
    entry,
    /mode:\s*'blocking'/,
    'runner 现值是 blocking(头注那句"warn 级"是旧的,以 runner 为准)',
  )
  assert.match(
    entry,
    /skipEnv:\s*'HUSKY_SKIP_ADMIN_GATE_GUARD'/,
    '应急跳过通道必须真在位(假逃生舱=没有)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

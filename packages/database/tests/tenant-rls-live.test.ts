// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13 第二格的**镜像测试**(§22c 形态):它不重跑真数据库,而是把
 * `scripts/tenant-rls-live-check.mjs` 的判据本身拿到没数据库的环境里核三件事 ——
 *
 *  1. **CI 上必须"响",不许安静地绿。** 本仓最高频的失效型是"判据看不见的东西被读成
 *     通过"(守门 70/76/81/118 全是这一族)。本票的运行时判据依赖本机 PostgreSQL,
 *     而 CI 机器上没有 ⇒ 如果"没有 PG"被记成"通过",这台尺子就在它最该说话的地方沉默了。
 *     所以这里既测纯函数(`resolvePgBin` 返回 null),也**真spawn一次 `--check`** 断言
 *     退出码非 0 且输出里有"未判定"。只测纯函数不够:CLI 完全可能把 null 写成 exit 0。
 *
 *  2. **三条隔离纪律是判据,不是注释。** 端口不得是 8810/8811(生产,§5 铁律)或 5432
 *     (本机既有实例);data dir 只能在仓库内 `.ihui-agent/tmp/**` 或 `<盘>:\DevEnv\Temp\**`
 *     (§15/§15b);被审主体必须是 NOBYPASSRLS。每条都配正反对照 —— 只有正向断言的测试
 *     等于没写(§22c),而名单/白名单类判据"从没证明过名单里某一条真能命中"是本仓
 *     第八批三份取证共同指出的缺陷型,所以这里每条都喂**它自己产出的形态**。
 *
 *  3. **收尾必须写在 finally 里。** 这是源码级锁:行为断言在"没有 PG 的环境"里跑不到,
 *     而"忘了收尾"的后果(留下一个占着端口的临时集群 + 项目内几百 MB data dir)
 *     只有锁住代码形态才防得住。同型先例见守门 70 的镜像测试 13/14 恒红那一格。
 *
 * 判据**不在这里**写第二份 —— 全部 import 源模块(§22c:测试里复制实现 = 两份真相,
 * 源改了就假绿)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { __test__ as live } from '../scripts/tenant-rls-live-check.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG_DIR = resolve(HERE, '..')
const LIVE_SCRIPT = join(PKG_DIR, 'scripts', 'tenant-rls-live-check.mjs')
const FIXTURE_SCRIPT = join(PKG_DIR, 'scripts', 'tenant-rls-live-fixture.mjs')

const {
  PRODUCTION_PORTS,
  ALREADY_USED_PORTS,
  OWNER_ROLE,
  MEMBER_ROLE,
  TABLE_ANCHORS,
  assertPortChoice,
  assertDataDirAllowed,
  buildRoleDdl,
  roleAttrSql,
  psqlArgs,
  resolvePgBin,
  judgeOne,
  buildJudgementPlan,
  parseProbeOutput,
  lastNonEmptyLine,
  expectedIds,
  seedRowCount,
} = live as any

const REPO_ROOT = resolve(PKG_DIR, '..', '..')

describe('O13 第二格:RLS 运行时验证器的镜像测试', () => {
  it('两份脚本在位,且 §22c/§22d 的双形态出口齐备(缺出口 = 测试只能复制实现)', () => {
    expect(existsSync(LIVE_SCRIPT)).toBe(true)
    expect(existsSync(FIXTURE_SCRIPT)).toBe(true)
    const liveSrc = readFileSync(LIVE_SCRIPT, 'utf8')
    // 出口必须在 isDirectRun 之后(§22d:放前面会让 import 方拿到 undefined)
    expect(liveSrc.indexOf('export const __test__')).toBeGreaterThan(liveSrc.indexOf('if (isDirectRun)'))
    expect(liveSrc).toMatch(/pathToFileURL\(process\.argv\[1\]\)\.href/)
    for (const key of ['assertPortChoice', 'assertDataDirAllowed', 'buildRoleDdl', 'judgeOne', 'buildJudgementPlan', 'parseProbeOutput', 'lastNonEmptyLine', 'resolvePgBin']) {
      expect(Object.keys(live), `__test__ 缺出口 ${key}`).toContain(key)
    }
  })

  // ---------------------------------------------------------------- 1) 无 PG ⇒ 未判定
  it('没有可用 PostgreSQL 二进制时判 null,而不是"看起来能跑"', () => {
    // 决定性:override 指到一个必然不存在 initdb 的目录(不依赖本机装没装 PG)
    const missing = resolvePgBin('win32', { IHUI_RLS_LIVE_PG_BIN: join(REPO_ROOT, '.ihui-agent', 'tmp', 'no-such-pg-bin-' + process.pid) })
    expect(missing).toBeNull()
  })

  it('真 spawn 一次 --check 并把 PG 出口指到不存在处:必须非 0 退出且喊"未判定"(不许安静地绿)', () => {
    const r = spawnSync(process.execPath, [LIVE_SCRIPT, '--check'], {
      encoding: 'utf8',
      windowsHide: true, // §5b
      timeout: 120_000,
      env: { ...process.env, IHUI_RLS_LIVE_PG_BIN: join(REPO_ROOT, '.ihui-agent', 'tmp', 'no-such-pg-bin-' + process.pid) },
    })
    const out = `${r.stdout || ''}\n${r.stderr || ''}`
    expect(r.error).toBeUndefined()
    // 2 = 无法判定。这里绝不允许是 0:"没有 PG"与"RLS 全绿"是两件不同的事,
    // 把它们混成一个退出码就是把判据失效的表现写成"通过"。
    expect(r.status, `退出码应为 2(未判定),实得 ${r.status}:${out.slice(0, 400)}`).toBe(2)
    expect(out).toContain('未判定')
    expect(out).not.toMatch(/结论:pass/)
  })

  // ---------------------------------------------------------------- 2) 三条隔离纪律
  it('端口判据:生产端口与既有实例端口必须拒,候选端口必须放行(正反成对)', () => {
    for (const p of PRODUCTION_PORTS) {
      expect(() => assertPortChoice(p), `生产端口 ${p} 必须判死`).toThrow(/生产/)
    }
    for (const p of ALREADY_USED_PORTS) {
      expect(() => assertPortChoice(p), `既有实例端口 ${p} 必须判死`).toThrow(/既有/)
    }
    expect(assertPortChoice(54320)).toBe(54320)
    expect(assertPortChoice(8899)).toBe(8899)
    expect(() => assertPortChoice(22)).toThrow(/不合法/)
  })

  it('连接参数唯一出口自带端口护栏(不靠调用方记得先 assert)', () => {
    for (const p of [...PRODUCTION_PORTS, ...ALREADY_USED_PORTS]) {
      expect(() => psqlArgs({ port: p, user: 'u', database: 'd', inline: 'select 1' }), `psqlArgs 对 ${p} 必须抛`).toThrow(/端口/)
    }
    const a = psqlArgs({ port: 54320, user: 'u', database: 'd', inline: 'select 1' })
    expect(a.slice(a.indexOf('-h'), a.indexOf('-h') + 4)).toEqual(['-h', '127.0.0.1', '-p', '54320'])
  })

  it('data dir 落点判据:两个允许落点收、三类禁止落点拒(§15/§15b)', () => {
    expect(assertDataDirAllowed(join(REPO_ROOT, '.ihui-agent', 'tmp', 'o13-cluster', 'data'))).toBeTruthy()
    const drive = /^[A-Za-z]/.exec(REPO_ROOT)?.[0].toUpperCase()
    expect(assertDataDirAllowed(`${drive}:\\DevEnv\\Temp\\ihui-rls-cluster`)).toBeTruthy()
    // 三条禁止路径各自命中**不同**的分支 —— 混成一句"都不许"就看不见哪一支失效了
    expect(() => assertDataDirAllowed('C:\\temp\\ihui-rls')).toThrow(/temp/)
    expect(() => assertDataDirAllowed(`${drive}:\\`)).toThrow(/盘根/)
    expect(() => assertDataDirAllowed('C:\\ihui-rls')).toThrow(/落点/)
    expect(() => assertDataDirAllowed(join(process.env.USERPROFILE || process.env.HOME || '/tmp', 'ihui-rls'))).toThrow(/家目录/)
  })

  it('被审主体必须 NOSUPERUSER + NOBYPASSRLS,且变异版本必须被同一条判据判假', () => {
    const ddl = buildRoleDdl().join('\n')
    const isBound = (t: string) => (t.match(/NOSUPERUSER/g) || []).length === 2 && (t.match(/NOBYPASSRLS/g) || []).length === 2
    expect(isBound(ddl)).toBe(true)
    // 正向证明(§22c/守门 120 那一课):判据必须真能命中名单里那一条,否则它可以是张死表
    expect(isBound(ddl.replaceAll('NOBYPASSRLS', 'BYPASSRLS'))).toBe(false)
    expect(isBound(ddl.split('\n')[0])).toBe(false)
    expect(roleAttrSql(OWNER_ROLE)).toMatch(/rolbypassrls/)
    expect(roleAttrSql(MEMBER_ROLE)).toMatch(/rolsuper/)
  })

  // ---------------------------------------------------------------- 3) 收尾在 finally
  it('收尾(stop + 删目录 + 端口复测)必须写在 finally 里 —— 源码级锁', () => {
    const src = readFileSync(LIVE_SCRIPT, 'utf8')
    const m = /finally\s*\{([\s\S]*?)\n  \}\n/.exec(src)
    expect(m, 'main() 必须有 finally 收尾').not.toBeNull()
    const block = m?.[1] || ''
    expect(block).toMatch(/stop/)
    expect(block).toMatch(/'fast'/)
    expect(block).toMatch(/rmSync\(/)
    expect(block).toMatch(/probePortBusy\(/)
    expect(block).toMatch(/existsSync\(/)
    // 反向锁:不得把收尾降级成"仅 --keep 分支里做"
    expect(block.indexOf('if (!opts.keep)')).toBeLessThan(block.indexOf('rmSync('))
  })

  it('派生点必须一律带 windowsHide(§5b 禁弹窗),且不得出现 execSync', () => {
    const src = readFileSync(LIVE_SCRIPT, 'utf8')
    const spawnCalls = (src.match(/spawnSync\(/g) || []).length + (src.match(/[^a-zA-Z]spawn\(/g) || []).length
    expect(spawnCalls, '本门至少要有 psql 与 pg_ctl 两类派生').toBeGreaterThan(0)
    const hideCalls = (src.match(/windowsHide/g) || []).length
    expect(hideCalls, `派生 ${spawnCalls} 处 / windowsHide ${hideCalls} 处`).toBeGreaterThanOrEqual(spawnCalls)
    expect(src).not.toMatch(/exec[Ss]ync\(/)
  })

  // ---------------------------------------------------------------- 4) 断言器有牙 + 覆盖面对账
  it('judgeOne 的三态不可混:fail-open 判 P0、非策略错误判 SKIP、无输出不判 PASS', () => {
    const cSpec = { id: 'C 不设 app.user_id ⇒ 租户行一律不可见(fail-closed;若可见即 P0)', expect: 'missing=a,b' }
    expect(judgeOne(cSpec, { status: 0, value: 'a' }).verdict).toBe('P0')
    expect(judgeOne(cSpec, { status: 0, value: '' }).verdict).toBe('PASS')
    expect(judgeOne(cSpec, null).verdict).toBe('SKIP')
    // "改不动"的两种正当形态都要认,而第三种(探针自己坏了)必须不认
    const uSpec = { id: 'U', expect: 'affected=0' }
    expect(judgeOne(uSpec, { status: 0, value: '0' }).verdict).toBe('PASS')
    expect(judgeOne(uSpec, { status: 3, value: null, stderr: 'ERROR:  new row violates row-level security policy' }).verdict).toBe('PASS')
    expect(judgeOne(uSpec, { status: 3, value: null, stderr: 'ERROR: column "updated_at" does not exist' }).verdict).toBe('SKIP')
    expect(judgeOne(uSpec, { status: 0, value: '1' }).verdict).toBe('FAIL')
    expect(judgeOne(uSpec, { status: 0, value: null, stderr: '' }).verdict).toBe('FAIL')
    // 探针取数:set_config 的噪音行不得被当成读数(第一轮真跑就栽在这)
    expect(parseProbeOutput('true\nROWS|x,y').value).toBe('x,y')
    expect(parseProbeOutput('ROWS|').value).toBe('')
    expect(parseProbeOutput('true').value).toBeNull()
    expect(lastNonEmptyLine('true\n1')).toBe('true')
  })

  it('判据矩阵覆盖八张纳管表 × 两条主体角色 × 六类语义,且期望值与夹具自洽', () => {
    const plan = buildJudgementPlan() as any[]
    expect(plan.length).toBeGreaterThanOrEqual(100)
    const tables = new Set(plan.map((p) => p.table))
    for (const t of Object.keys(TABLE_ANCHORS)) {
      expect(tables.has(t), `表 ${t} 没进判据矩阵`).toBe(true)
      const roles = new Set(plan.filter((p) => p.table === t).map((p) => p.role))
      expect(roles.has(OWNER_ROLE), `${t} 缺属主角色(FORCE 无法证)`).toBe(true)
      expect(roles.has(MEMBER_ROLE), `${t} 缺非属主角色(无法把筛选归因到 RLS)`).toBe(true)
      for (const prefix of ['A ', 'B ', 'C ', 'U ', 'D ', 'P ', 'F ']) {
        expect(plan.some((p) => p.table === t && String(p.id).startsWith(prefix)), `${t} 缺判据 ${prefix.trim()}`).toBe(true)
      }
      // 每表都要有跨租户写判据(只看 SELECT 的验证会整侧漏掉 WITH CHECK)
      expect(plan.some((p) => p.table === t && p.id.startsWith('U '))).toBe(true)
    }
    // 尺子自洽:rows= 的期望必须等于夹具给该主体定义的应见 id 集大小
    for (const spec of plan) {
      if (!String(spec.expect).startsWith('rows=')) continue
      const want = Number(String(spec.expect).slice(5))
      const m = /set_config\('app\.user_id', '([0-9a-f-]+)/.exec(spec.probe.sql)
      if (!m) {
        expect(want, `${spec.table} 的旁路判据期望应等于夹具行数`).toBe(seedRowCount(spec.table))
        continue
      }
      const ids = expectedIds(spec.table, m[1])
      if (ids.length) expect(want, `${spec.table}/${m[1]} 期望与 id 集不符`).toBe(ids.length)
    }
  })

  it('验证器不冒充"已接入提交链"(它是机器状态判据,接成 blocking 就是恒红门)', () => {
    const runner = readFileSync(join(REPO_ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
    expect(runner).not.toMatch(/tenant-rls-live-check/)
    const liveSrc = readFileSync(LIVE_SCRIPT, 'utf8')
    expect(liveSrc).toMatch(/未接入|刻意不接/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

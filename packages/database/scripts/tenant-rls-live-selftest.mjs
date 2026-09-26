// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `tenant-rls-live-check.mjs --self-test` 的用例集(零副作用,不 initdb、不起进程、不连库)。
 *
 * 独立成文件只为守住两件事:① 单文件 800 行上限(守门 11e)不该靠删"为什么"来满足,
 *   该分出去的是用例清单;② 用例与被审判据仍在同一进程里跑,判据**只有一份实现** ——
 *   这里 import 的是源模块导出的函数,不复制逻辑(§22c:测试里再抄一份判据 = 两份真相,
 *   源改了测试就假绿)。
 *
 * ctx 注入的是"路径类"信息:被测文件在哪、仓库根在哪。不注入判据本身 —— 那些从源模块 import。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { TENANT_RLS_TABLES } from './tenant-rls-policy-check.mjs'
import { OWNER_ROLE, MEMBER_ROLE, TABLE_ANCHORS, expectedIds, judgeOne, buildJudgementPlan, parseProbeOutput, lastNonEmptyLine, NO1, NO2, U1 } from './tenant-rls-live-fixture.mjs'
import { assertPortChoice, assertDataDirAllowed, buildRoleDdl, roleAttrSql, psqlArgs } from './tenant-rls-live-check.mjs'

export function selfTest(ctx) {
  /** @type {Array<{name:string,pass:boolean,detail:string}>} */
  const cases = []
  const rec = (name, pass, detail = '') => cases.push({ name, pass: !!pass, detail })
  const rejects = (fn) => {
    try {
      fn()
      return null
    } catch (error) {
      return error.message
    }
  }

  // S1 端口判据:生产端口 / 既有实例端口必须拒绝,候选必须放行(正反成对)
  rec('S1a 8810(生产 PostgreSQL)必须判死', /生产/.test(rejects(() => assertPortChoice(8810)) || ''), rejects(() => assertPortChoice(8810)) || '没拒绝 —— 本票会去连生产库')
  rec('S1b 8811(生产 Redis 位)必须判死', /生产/.test(rejects(() => assertPortChoice(8811)) || ''), '')
  rec('S1c 5432(本机既有实例)必须判死', /既有/.test(rejects(() => assertPortChoice(5432)) || ''), '')
  rec('S1d 54320 必须放行', rejects(() => assertPortChoice(54320)) === null, '')
  rec('S1e 8899 必须放行', rejects(() => assertPortChoice(8899)) === null, '')
  rec('S1f 1024 以下必须判死', rejects(() => assertPortChoice(80)) !== null, '')

  // S1g psqlArgs 是唯一连接出口:它自己也必须拒生产端口(不靠调用方记得先 assert)
  rec('S1g psqlArgs 对 8810 必须抛(连接出口自带护栏)', rejects(() => psqlArgs({ port: 8810, user: 'x', database: 'y', inline: 'select 1' })) !== null, '')
  rec('S1h psqlArgs 对 54320 必须给出 -h 127.0.0.1 -p 54320', (() => {
    const a = psqlArgs({ port: 54320, user: 'u', database: 'd', inline: 'select 1' })
    return a.includes('127.0.0.1') && a.includes('54320')
  })(), '')

  // S2 data dir 落点判据
  rec('S2a 拒 C:\\temp\\ihui-rls', rejects(() => assertDataDirAllowed('C:\\temp\\ihui-rls')) !== null, '')
  rec('S2b 拒 C:\\ihui-rls(盘根下一层)', rejects(() => assertDataDirAllowed('C:\\ihui-rls')) !== null, '')
  rec('S2c 拒家目录', rejects(() => assertDataDirAllowed(join(process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\x', '.ihui-rls'))) !== null, '')
  rec('S2d 收仓库内 .ihui-agent/tmp/**', rejects(() => assertDataDirAllowed(join(ctx.repoRoot, '.ihui-agent', 'tmp', 'o13-cluster', 'data'))) === null, '')
  rec('S2e 收同盘 DevEnv\\Temp\\**', rejects(() => assertDataDirAllowed(`${ctx.driveOf(ctx.repoRoot)}:\\DevEnv\\Temp\\ihui-rls`)) === null, '')

  // S3 角色 DDL:超级用户 / BYPASSRLS 主体跑出来的绿是假的
  const subjectIsBound = (ddlText) => (ddlText.match(/NOSUPERUSER/g) || []).length === 2 && (ddlText.match(/NOBYPASSRLS/g) || []).length === 2
  const ddl = buildRoleDdl().join('\n')
  rec('S3a 两个主体角色都写 NOSUPERUSER + NOBYPASSRLS', subjectIsBound(ddl), ddl.slice(0, 140))
  // 变异对照必须**跑同一条判据**,不是"检查一个必然不等的数字"(§22c:断言只复读实现就是复读机)
  rec('S3b 变异对照:同一判据喂 BYPASSRLS 版本必须判假', subjectIsBound(ddl.replaceAll('NOBYPASSRLS', 'BYPASSRLS')) === false, '')
  rec('S3c 变异对照:同一判据喂少一个角色的版本必须判假', subjectIsBound(ddl.split('\n')[0]) === false, '')
  rec('S3c roleAttrSql 必须真回读 rolsuper 与 rolbypassrls 两列', /rolsuper/.test(roleAttrSql('x')) && /rolbypassrls/.test(roleAttrSql('x')), '')

  // S4 收尾必须在 finally(源码级反向锁:加断言会跟着一起漂绿,只有源码锁防得住)
  const src = readFileSync(ctx.liveScriptPath, "utf8")
  const finallyBlock = /finally\s*\{([\s\S]*?)\n  \}\n/.exec(src)?.[1] || ''
  rec('S4a finally 里必须真做 pg_ctl stop -m fast', /pg_ctl|pgCtlExe/.test(finallyBlock) && /'fast'/.test(finallyBlock), finallyBlock.slice(0, 120))
  rec('S4b finally 里必须真删临时目录', /rmSync\(/.test(finallyBlock) && /clusterDir/.test(finallyBlock), '')
  rec('S4c finally 里必须实测端口是否释放', /probePortBusy\(/.test(finallyBlock), '')
  // S4d 的 windowsHide 源码级锁放在**镜像测试**里(那个文件检查的是本文件,不存在自指污染)。
  // 这里刻意不写那个"同步执行"API 的名字:在本文件里写出它,就等于让本文件含它,
  // 镜像测试的"不得出现该 API"锁会被自己的说明文字打红 —— 本仓记过同型坑:
  // **说明性文字也会带执行性字符**。
  rec('S4d 派生出口只有 shRun 与 pg_ctl 两类,且都带 windowsHide', (() => {
    const spawnSites = (src.match(new RegExp('sp' + 'awnSync\\(', 'g')) || []).length + (src.match(new RegExp('sp' + 'awn\\(', 'g')) || []).length
    const hideSites = (src.match(/windowsHide/g) || []).length
    return spawnSites > 0 && hideSites >= spawnSites
  })(), '')
  rec('S4e 判据不得按磁盘读被审内容之外的面(迁移正文一律走 fs 直读真文件)', /readFileSync\(JOURNAL_PATH/.test(src) && /join\(DRIZZLE_DIR/.test(src), '')

  // S5 断言器有牙:喂 fail-open 的合成观测必须判 P0,而不是"行数不对"就放过
  const cSpec = { id: 'C 不设 app.user_id ⇒ 租户行一律不可见(fail-closed;若可见即 P0)', expect: `missing=${NO1},${NO2}` }
  rec('S5a 未设 GUC 却看见租户行 ⇒ P0(不可被记成通过)', judgeOne(cSpec, { status: 0, value: `${NO1},${NO2}` }).verdict === 'P0', JSON.stringify(judgeOne(cSpec, { status: 0, value: `${NO1},${NO2}` })))
  rec('S5b 未设 GUC 且看不见任何行 ⇒ PASS', judgeOne(cSpec, { status: 0, value: null }).verdict === 'PASS', '')
  rec('S5c 同一条 C 判据看到 1 行也必须 P0(不是 SKIP)', judgeOne(cSpec, { status: 0, value: NO2 }).verdict === 'P0', '')
  rec('S5d UPDATE 期望 0 行而实测 1 行 ⇒ FAIL', judgeOne({ id: 'U', expect: 'affected=0' }, { status: 0, value: '1' }).verdict === 'FAIL', '')
  rec('S5e 子进程派生失败 ⇒ SKIP 而不是 PASS', judgeOne({ id: 'X', expect: 'affected=0' }, { transportFailure: true, detail: 'psql 不存在' }).verdict === 'SKIP', '')
  rec('S5f 观测为 null ⇒ SKIP', judgeOne({ id: 'X', expect: 'rows=2' }, null).verdict === 'SKIP', '')
  rec("S5g INSERT 伪冒:没报错(写入成功)⇒ FAIL(不是 'PASS 因为 rc=0')", judgeOne({ id: 'S7', expect: 'rls-error' }, { status: 0, value: '1', stderr: '' }).verdict === 'FAIL', '')
  rec('S5h INSERT 伪冒:报 42501 ⇒ PASS', judgeOne({ id: 'S7', expect: 'rls-error' }, { status: 3, stderr: 'ERROR: 42501: new row violates row-level security policy' }).verdict === 'PASS', '')
  rec('S5i INSERT 伪冒:报别的错 ⇒ SKIP(不把别的失败当成 RLS 生效)', judgeOne({ id: 'S7', expect: 'rls-error' }, { status: 3, stderr: 'ERROR: relation "notes" does not exist' }).verdict === 'SKIP', '')

  // S5j–S5l 观测提取的对照:**第一轮真跑就是栽在这里** —— 取"第一行非空输出"时,
  // set_config() 打的 'true' 会被当成探针读数,于是所有 rows= 判据拿 'true' 去比期望行集,
  // 数字全错而表面像"判过了"。现只认带标记的行,并由这三条把形状钉死。
  rec('S5j set_config 噪音 + ROWS| 标记 ⇒ 取标记后面的行集', parseProbeOutput('true\n' + 'ROWS|a,b').value === 'a,b', JSON.stringify(parseProbeOutput('true\nROWS|a,b')))
  rec('S5k ROWS| 为空(0 行)⇒ value 是空串而不是 null(null 在判据里等于"没判")', (() => {
    const r = parseProbeOutput('ROWS|')
    return r.value === '' && r.kind === 'rows'
  })(), JSON.stringify(parseProbeOutput('ROWS|')))
  rec('S5l 没有任何标记行 ⇒ null(判据据此走 SKIP,不记为通过)', parseProbeOutput('true\nBEGIN\nROLLBACK').value === null, '')
  rec('S5m AFFECTED 标记与 set_config 噪音混排仍取对的值', parseProbeOutput('true\nAFFECTED=0').value === '0', '')

  // S5n–S5q "改不动"有**两种正当形态**(USING 为假 ⇒ 0 行;WITH CHECK 为假 ⇒ 42501),而
  // "探针自己写坏了"是第三种 —— 三者必须可区分,否则判据会把环境错误记成策略结论。
  rec('S5n UPDATE 期望 0 行而实测报 42501 ⇒ PASS(WITH CHECK 拒也算拦住)', judgeOne({ id: 'U', expect: 'affected=0' }, { status: 3, value: null, stderr: 'ERROR:  new row violates row-level security policy for table "notes"' }).verdict === 'PASS', '')
  rec('S5o UPDATE 期望 0 行而报的是别的错 ⇒ SKIP(不把列名写错算成策略生效)', judgeOne({ id: 'U', expect: 'affected=0' }, { status: 3, value: null, stderr: 'ERROR: column "updated_at" of relation "notes" does not exist' }).verdict === 'SKIP', '')
  rec('S5p rc=0 但没有 AFFECTED 行 ⇒ FAIL(不接受"没输出=没事")', judgeOne({ id: 'U', expect: 'affected=0' }, { status: 0, value: null, stderr: '' }).verdict === 'FAIL', '')
  rec('S5q 管理类读数取原始末行,不受标记判据影响', lastNonEmptyLine('1') === '1' && lastNonEmptyLine('') === null, '')

  // S6 覆盖面对账:每张纳管表都必须进矩阵,且空矩阵/空清单不许读成绿
  const plan = buildJudgementPlan()
  const covered = new Set(plan.map((p) => p.table))
  const missing = TENANT_RLS_TABLES.map((t) => t.table).filter((t) => !covered.has(t))
  rec(`S6a 八张纳管表全部进判据矩阵(缺 ${missing.length})`, TENANT_RLS_TABLES.length > 0 && missing.length === 0, missing.join(','))
  rec('S6b 判据矩阵规模 >= 表数 × 10', plan.length >= TENANT_RLS_TABLES.length * 10, `${plan.length} 条`)
  rec('S6c 每张表两条主体角色都在(owner 证 FORCE / member 证 RLS 归因)', (() => {
    for (const t of TENANT_RLS_TABLES.map((x) => x.table)) {
      const roles = new Set(plan.filter((p) => p.table === t).map((p) => p.role))
      if (!roles.has(OWNER_ROLE) || !roles.has(MEMBER_ROLE)) return false
    }
    return true
  })(), '')
  rec('S6d 每张表都有 FORCE 变异对照(否则 C 那一串绿无法证伪)', TENANT_RLS_TABLES.every((t) => plan.some((p) => p.table === t.table && p.mutate === 'no-force')), '')
  rec('S6e 跨租户 UPDATE 与 DELETE 各覆盖每张表(只看 SELECT 不够)', (() => {
    for (const t of TENANT_RLS_TABLES.map((x) => x.table)) {
      const hasU = plan.some((p) => p.table === t && p.id.startsWith('U '))
      const hasD = plan.some((p) => p.table === t && p.id.startsWith('D '))
      if (!hasU || !hasD) return false
    }
    return true
  })(), '')

  // S7 尺子自洽:期望行数必须等于夹具定义的应见 id 集大小
  let consistent = true
  const offenders = []
  for (const spec of plan) {
    if (!String(spec.expect).startsWith('rows=')) continue
    const want = Number(String(spec.expect).slice(5))
    const m = /set_config\('app\.user_id', '([0-9a-f-]+)'/.exec(spec.probe.sql)
    if (!m) continue
    const ids = expectedIds(spec.table, m[1])
    if (ids.length && ids.length !== want) {
      consistent = false
      offenders.push(`${spec.table}/${m[1]}: 期望 ${want} 而 id 集 ${ids.length}`)
    }
  }
  rec('S7 尺子自洽:rows= 期望与夹具 id 集大小一致', consistent, offenders.join('; '))

  // S8 夹具自洽:八张表的锚点必须齐,缺一个就有一条判据是"对着空气打分"
  rec('S8 每张纳管表都有 u1/u2 锚点', TENANT_RLS_TABLES.every((t) => TABLE_ANCHORS[t.table]?.u1 && TABLE_ANCHORS[t.table]?.u2), '')
  rec('S8b 锚点 id 必须真是库里那些行(与 expectedIds 对得上)', TENANT_RLS_TABLES.every((t) => expectedIds(t.table, U1).includes(TABLE_ANCHORS[t.table].u1)), '')

  let failed = 0
  for (const c of cases) {
    if (!c.pass) failed += 1
    console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}${c.pass || !c.detail ? '' : ` —— ${c.detail}`}`)
  }
  console.log(`[tenant-rls-live-check --self-test] ${cases.length - failed}/${cases.length} 通过`)
  return failed ? 1 : 0
}

export const __test__ = { caseCountHint: 47 }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

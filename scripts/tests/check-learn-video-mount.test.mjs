// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 

/**
 * §22c 镜像测试:`scripts/check-learn-video-mount.mjs`(G-921 同族的只读对账尺子,2026-10-24 立)
 *
 * 判据一律 `import { __test__ } from '../check-learn-video-mount.mjs'`,本文件**不复制第二份
 * 判据常量**(§22c;门 191 `check-test-judge-not-replicated.mjs` 判复制)。
 *
 * 本票锁九组(编号与各 test 标题一一对应;同一组内用 a/b/c/d 分条):
 *  ①①b①c 定级形状锁(反向)—— 本尺判**机器态 + 网络态**,`guardian-runner.mjs` 注册表、
 *     `.husky/*`、`.github/workflows/*`、根 `package.json` **四面都不得出现本文件名**(接成提交门
 *     即 §12e 禁的恒红门:非生产机上生产 DSN 与公网入口结构上不可达,提交者满足不了);
 *     ①c 再钉"声明与判据同面"——头注那句定级句必须逐字在位。
 *     ⚠️ 本文件**不钉**「AGENTS.md 已点名本尺」:AGENTS.md 不在本席位的允许写面内,把别人欠的
 *     登记钉成我的红 = §12e 同型。门 89 R4 只管"已接线而不点名",本尺刻意未接线,那条文档义务
 *     落在**接线那一刻**;欠的那一行登记在交付报告里点名交后手,不静默放过。
 *  ②②b②c②d 只读红线 —— 每条 SQL builder 的产出必须过 `assertReadOnlySql`,而该尺对
 *     INSERT/UPDATE/DELETE/DROP/多语句**都要真抛**(不抛 = 锁是纸的);②b 锁本尺不得 import seed
 *     写侧(`legacy-videos.ts` 自带 `--apply/--publish` 生产写动作,import 进来就把只读纪律洗掉);
 *     ②c 是**摘臂正证**:在 scratch 里造一份"把 publish 那一臂换成恒 ok"的副本来 import,同一夹具
 *     下汇总结论必须跟着翻(不翻 ⇒ 那一臂从未参与判定);②d 对一轮里**实发**的每条 SQL 取证。
 *  ③ 三态阳性对照 —— 全齐⇒ok(0)、发布位 0⇒gap(1)、库与接口都取不到⇒unjudged(2),三档各真跑
 *     一轮 `collect`(注入夹具,不碰真库、不发网络、不探本机 psql 安装位);外加"同轮里 gap 必须
 *     压过 unjudged"(量到的缺陷不被缺失的输入洗掉)。
 *  ④④b 脱敏哨兵锁 —— 夹具 DSN 里埋一个哨兵口令,渲染面、JSON 面与 spawn 登记面都不得出现它;
 *     psql 报错回声整条 conninfo 那一型也必须被吃掉。④b 锁 DSN 三面皆空时不回落到"猜一个 localhost"。
 *  ⑤ 枚举到 0 判死 —— 空 manifest / 空标题清单 / 空维度清单都不得产出"对账通过"。
 *  ⑥ 期望值不内联 —— 台账里会腐烂的那三个量级数不得写进源码,必须每次现读(§0.1),并锁住
 *     「judgeManifest 只吃 parseManifest 的产出」这一条来路(手捏对象一律未判定 ⇒ 长不出第二份真相)。
 *  ⑦ 判定链 —— 上游(M1/M2)未判定或"连错库"时下游三维必须跟着未判定且**各自点名自己的理由**;
 *     读数形态不对 ⇒ 未判定,不猜 0、不记 ok。
 *  ⑧ 派生进程纪律 —— 判据层唯一的 spawn 位必须显式带 `stdio: ['ignore','pipe','pipe']` 与
 *     `windowsHide: true`(§12g)。为此源脚本把该位做成具名出口 `psqlSpawn` + 调用登记
 *     `spawnCallSites`:测试对**实调用**的参数取证,而不是拿正则猜生产代码(改了 opts 而正则没
 *     跟着改,锁当场变纸、账面照绿)。**注**:登记面 args 的 DSN 逐元素过 `sanitizeDsn`、
 *     `opts.env` 整体不落登记面 —— 原样 push 就是把凭据抄进一份内存镜像,这一格在本票写作过程
 *     中真的先写错过一次,被 ④ 的哨兵锁当场抓住(留档于此,不是马后炮)。
 *  ⑨⑩ §22d 双形态闸 + 夹具落 `mkScratch()`(§15b)+ 体内 `--self-test` 全绿。
 *  附:两把判据层直尺(`parseCountRow` 形态、`classifyDsnTarget` 分类 —— 后者锁"只分类不拒绝"
 *     这一格与 `lib/db-probe-client` 的取证纪律**刻意分歧**的根据必须在头注里写清)。
 *
 * 夹具落点 = `scripts/lib/scratch-dir.mjs` 的 `mkScratch()`(§15b:禁 `os.tmpdir()`)。本仓批准的
 * scratch 根按当次实测取值:本机 `scratchRoot()` 落在仓库内被 `.gitignore` 覆盖、并由该层打 git
 * 边界的 `.DevEnv/Temp/ihui-scratch` ⇒ "不得在 ROOT 之下"是**错判据**,真判据是"不得落进
 * scripts/apps/packages/deploy 这些被跟踪的源码树"(门 208 怕的是工作树里长出夹具)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as gate, runSelfTest } from '../check-learn-video-mount.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const GATE_FILE = 'check-learn-video-mount.mjs'
const SOURCE_REL = join('scripts', GATE_FILE)

/** 哨兵口令:只活在夹具里,任何一档输出里出现它都等于凭据泄露。 */
const SENTINEL_PW = 'SENTINEL-PW-9e3c1a'
const FIXTURE_DSN = `postgres://ihui_ro:${SENTINEL_PW}@127.0.0.1:5432/ihui`

const MANIFEST_TEXT = JSON.stringify({
  courses: [{ title: '甲课', sections: [{ rel: 'a/1.mp4' }, { rel: 'a/2.mp4' }] }],
  excluded: ['x.f1.mp4'],
})

/** 注入式取材面:全部输入由夹具给,绝不碰真库/网络/本机安装位。 */
/** 夹具里唯一一处 psql 替身:记下发出去的每一条 SQL,供"实发面也只读"那一锁取证。 */
const sentSql = []
function fixtureIO({ rows, psqlFound = true, fetchResult = { status: 200, total: null }, stderrText = '' }) {
  sentSql.length = 0
  const sqlRunner = (psql, dsn, sql) => {
    sentSql.push(sql)
    if (sql.includes('information_schema.tables')) return { status: 0, stdout: '3', stderr: '', lost: '' }
    if (!rows) return { status: 1, stdout: '', stderr: stderrText || 'connection failed', lost: '' }
    return { status: 0, stdout: [rows.courses, rows.chapters, rows.sections, rows.sectionsWithUrl, rows.publishedCourses, rows.feedSections].join('|'), stderr: '', lost: '' }
  }
  return {
    fsImpl: { existsSync: () => true, readFileSync: () => MANIFEST_TEXT },
    locateClient: () => ({ psql: psqlFound ? 'psql-fixture' : null, tried: ['fixture'] }),
    psqlRunner: sqlRunner,
    httpFetcher: async () => (fetchResult ? { ...fetchResult } : { fetchError: '夹具:不发网络' }),
  }
}

const FULL_ROWS = { courses: 1, chapters: 1, sections: 2, sectionsWithUrl: 2, publishedCourses: 1, feedSections: 2 }
const UNPUBLISHED_ROWS = { courses: 1, chapters: 1, sections: 2, sectionsWithUrl: 2, publishedCourses: 0, feedSections: 0 }

// ────────────────────────────── ① 反向定级形状锁 ──────────────────────────────
test('形状锁①(反向):本尺不得出现在提交链注册表与 .husky 钩子面 —— 判机器态的门挂上去即恒红门', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.ok(!runner.includes('check-learn-video-mount'), '本尺被误接进 guardian-runner 注册表(§12e 恒红门风险)')
  const ciDir = join(ROOT, '.github', 'workflows')
  for (const f of existsSync(ciDir) ? readdirSync(ciDir).map((name) => ({ name, text: readFileSync(join(ciDir, name), 'utf8') })) : []) {
    assert.ok(!f.text.includes('check-learn-video-mount'), `本尺被误接进 CI(${f.name})`)
  }
  for (const f of ['pre-commit', 'pre-push', 'commit-msg']) {
    let text = ''
    try {
      text = readFileSync(join(ROOT, '.husky', f), 'utf8')
    } catch {
      continue
    }
    assert.ok(!text.includes('check-learn-video-mount'), `本尺被误接进 .husky/${f}`)
  }
  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8')
  assert.ok(!pkg.includes('check-learn-video-mount'), '本尺被误接进根 package.json 脚本面(提交链/CI 同面)')
})

test('形状锁①b:定级声明必须与判据同面 —— 本尺在 runner/.husky/CI/package.json 四面皆零登记', () => {
  // AGENTS.md 的「只读对账尺子」族点名是**人家的写面**(本席位被禁止写 AGENTS.md),
  // 因此这里不钉"文档已点名"(那会把别人未做的登记变成我的红),只钉**我自己这侧**的事实:
  // 上述四面对零登记 ⇒ 与头注「不进提交链/不进 CI」逐字同形。门 89 R4 只管"已接线而不点名",
  // 本尺刻意未接线,所以 R4 的文档义务在这里落在**接线那一刻**而不是现在。
  const src = readFileSync(join(ROOT, SOURCE_REL), 'utf8')
  assert.match(src, /本尺不进提交链、不进 CI/, '头注的定级句被改写 ⇒ 与判据分叉')
})

test('形状锁①c:源脚本头注必须把"不进提交链/不进 CI"写死(判据与声明不得分叉)', () => {
  const src = readFileSync(join(ROOT, SOURCE_REL), 'utf8')
  assert.match(src, /不进提交链[^\n]*不进 CI|不进提交链/, '头注缺"不进提交链"声明')
  assert.match(src, /人工档|人工 \/ 结清/, '头注未写明调用者是人工/现读取证档')
  assert.match(src, /恒红门/, '头注未点名 §12e 恒红门风险')
})

// ────────────────────────────── ② 只读红线 ──────────────────────────────
test('判据②:每条 SQL builder 的产出都是只读句;写句/多语句必须真抛(不抛=锁是纸的)', () => {
  const titles = ["O'Brien", '正常课']
  assert.equal(gate.assertReadOnlySql(gate.sqlTablePresence()).slice(0, 6), 'SELECT')
  const main = gate.sqlLegacyMountFacts(titles)
  assert.equal(main.slice(0, 6), 'SELECT')
  assert.ok(main.includes(`'${"O''Brien"}'`), '单引号标题未翻倍转义,拼句形状不对')
  for (const bad of ['INSERT INTO lessons VALUES (1)', 'UPDATE lessons SET is_published = true', 'DELETE FROM lessons', 'SELECT 1; DROP TABLE lessons', 'TRUNCATE lesson_chapters', '']) {
    assert.throws(() => gate.assertReadOnlySql(bad), `写句/坏句未被拦:${JSON.stringify(bad).slice(0, 30)}`)
  }
})

test('判据②b(只读红线的第二半):本尺不得 import seed 写侧(它自带 --apply/--publish)', () => {
  const src = readFileSync(join(ROOT, SOURCE_REL), 'utf8')
  assert.doesNotMatch(src, /from '[^']*packages\/database/, '本尺 import 了 seed/写侧 ⇒ 红线②被绕')
})

// ────────────────────────────── ③ 三态阳性对照 ──────────────────────────────
test('阳性对照①:三表齐 ∧ 发布位齐 ∧ 接口读数一致 ⇒ ok / exit 0', async () => {
  const r = await gate.collect({ ...fixtureIO({ rows: FULL_ROWS, fetchResult: { status: 200, total: 2 } }), argvDsn: FIXTURE_DSN, baseUrl: 'https://fixture.invalid' })
  assert.equal(r.overall, 'ok', gate.render(r))
  assert.equal(r.exitCode, 0)
  assert.equal(r.counts.gap, 0)
  assert.equal(r.counts.unjudged, 0)
  assert.equal(r.dimensions.length, 6, '六维齐(缺一维就是有人在并桶或摘臂)')
})

test('阳性对照②:行齐而发布位 0(票面现网形态)⇒ gap / exit 1,且点名 M4 与 M6', async () => {
  const r = await gate.collect({ ...fixtureIO({ rows: UNPUBLISHED_ROWS, fetchResult: { status: 200, total: 0 } }), argvDsn: FIXTURE_DSN, baseUrl: 'https://fixture.invalid' })
  assert.equal(r.overall, 'gap', gate.render(r))
  assert.equal(r.exitCode, 1)
  const byId = Object.fromEntries(r.dimensions.map((d) => [d.id, d.state]))
  assert.equal(byId['M3-db-rows'], 'ok', '行是齐的 ⇒ M3 不得跟着冒红(红错维度=把人支去修没坏的东西)')
  assert.equal(byId['M4-db-publish'], 'gap')
  assert.equal(byId['M6-http-feed-total'], 'gap')
})

test('阳性对照③:库与接口都取不到 ⇒ unjudged / exit 2,逐维点名且绝不记绿', async () => {
  const r = await gate.collect({ ...fixtureIO({ rows: null, psqlFound: false, fetchResult: null }), argvDsn: null, env: { DATABASE_URL: '' }, baseUrl: 'https://fixture.invalid' })
  assert.equal(r.overall, 'unjudged', gate.render(r))
  assert.equal(r.exitCode, 2)
  assert.equal(r.counts.ok, 1, '只有 M1(manifest 本地可读)该记绿')
  assert.equal(r.counts.unjudged, 5)
  assert.equal(r.counts.gap, 0)
  for (const d of r.dimensions.filter((x) => x.state === 'unjudged')) {
    assert.ok(typeof d.why === 'string' && d.why.length > 8, `维度 ${d.id} 未判定却没点名原因`)
  }
})

test('三态之互斥:同一轮里 gap 优先于 unjudged(量到的缺陷不被缺失的输入洗掉)', async () => {
  // 库侧全灭(psql 取不到 ⇒ M2~M5 unjudged),但接口面量到 0 ⇒ 仍报 gap
  const r = await gate.collect({ ...fixtureIO({ rows: null, psqlFound: false, fetchResult: { status: 200, total: 0 } }), argvDsn: null, env: { DATABASE_URL: '' }, baseUrl: 'https://fixture.invalid' })
  assert.equal(r.overall, 'gap')
  assert.ok(r.counts.unjudged >= 4, '库侧未判定必须照数报,不得因有 gap 就不写')
})

// ────────────────────────────── ④ 脱敏哨兵锁 ──────────────────────────────
test('判据⑧b:子进程结果归一 —— 空 stderr/无 error 必须归成空串,不得变成 "(无输出)" 那种恒真值', () => {
  // 这一格是本票写作当轮**真实坏过**的一臂:redactChildOutput('') 返回字面量 '(无输出)',
  // 一旦无条件套在 stderr/lost 上,`lost || ...` 恒真 ⇒ psql 每一次**成功**都被读成
  // "psql 无法执行",M2 假未判定、M3~M5 连坐。夹具手写 `lost:''` 打不到这里,所以判据
  // 必须留成可直刺的纯函数(§22c 的 export __test__ 不是礼仪,是让这类洞能被量到)。
  const dsn = `postgres://u:${SENTINEL_PW}@h:5432/d`
  const good = gate.normalizeChildResult({ status: 0, stdout: '3\r\n', stderr: '', error: undefined }, dsn)
  assert.equal(good.status, 0)
  assert.equal(good.lost, '', `成功那次的 lost 被填成了诊断词:${JSON.stringify(good.lost)}`)
  assert.equal(good.stderr, '', `成功那次的 stderr 被填成了诊断词:${JSON.stringify(good.stderr)}`)
  assert.equal(good.stdout, '3\r\n')
  const bad = gate.normalizeChildResult({ status: null, stdout: '', stderr: '', error: new Error('spawnSync psql ENOENT') }, dsn)
  assert.ok(bad.lost.includes('ENOENT'), '真失败反而没留下原因')
  const leak = gate.normalizeChildResult({ status: 1, stdout: '', stderr: `FATAL: ${SENTINEL_PW} rejected`, error: undefined }, dsn)
  assert.ok(!leak.stderr.includes(SENTINEL_PW), '子进程 stderr 里的口令未被打码 ⇒ 红线③破了')
})

test('判据④:哨兵口令在渲染面/JSON 面/stderr 回声面三处都不落', async () => {
  const r = await gate.collect({ ...fixtureIO({ rows: FULL_ROWS, fetchResult: { status: 200, total: 2 } }), argvDsn: FIXTURE_DSN, baseUrl: 'https://fixture.invalid' })
  const rendered = `${gate.render(r)}\n${JSON.stringify(r)}`
  assert.ok(!rendered.includes(SENTINEL_PW), '哨兵口令出现在输出 ⇒ 凭据泄露(红线③破了)')
  const echo = gate.redactDsnInText(`FATAL: password authentication failed for "${SENTINEL_PW}" at conninfo postgres://ihui_ro:${SENTINEL_PW}@h`, FIXTURE_DSN)
  assert.ok(!echo.includes(SENTINEL_PW), 'psql 回声 conninfo 未被吃掉')
  assert.ok(r.target.dsnShape.includes('***'), `DSN 展示形态未脱敏(实得 ${r.target.dsnShape})`)
})

test('判据④b:DSN 三面皆空时不回落到"猜一个 localhost"(§0.3 不猜)', () => {
  const res = gate.resolveDsn({ argvDsn: null, envText: 'NODE_ENV=production\nPORT=8801\n', processEnv: {} })
  assert.equal(res.ok, false)
  assert.match(res.why, /三面皆空/)
})

// ────────────────────────────── ⑤ 枚举到 0 判死 ──────────────────────────────
test('判据⑤:空 manifest / 空标题清单不得产出"对账通过"', () => {
  assert.equal(gate.judgeManifest(gate.parseManifest('{"courses":[],"excluded":[]}')).state, 'unjudged')
  assert.throws(() => gate.sqlLegacyMountFacts([]), /枚举到 0/)
  assert.throws(() => gate.aggregate([]), /枚举到 0/)
  assert.equal(gate.judgeManifest(gate.parseManifest('not json')).state, 'unjudged')
})

// ────────────────────────────── ⑥ 期望值不内联 ──────────────────────────────
test('判据⑥:期望值必须现读,那三个量级数(课/节/排除)不得内联(§0.1;测试里只许出现在注释句里)', () => {
  const src = readFileSync(join(ROOT, SOURCE_REL), 'utf8')
  // 只钉"会被腐烂的那几个具体形态",不钉所有 22/3 之类数字 —— 后者会把无关的合法数字一起拦掉,
  // 变成一道与提交内容无关的门(§12e 同一取向,虽然本锁在测试里而不是在提交链里)。
  for (const inlined of [/22\/22\/867/, /22\/867\/3/, /\b867\b/, /\b870\s*枚/]) {
    assert.ok(!inlined.test(src), `源码里内联了会腐烂的读数形态:${inlined}`)
  }
  // 期望值的唯一来路 = manifest 现读:judgeManifest 只认 parseManifest 的产出形态,
  // 手捏一个"已经算好"的对象进来一律未判定(否则第二份真相就能顶过这一维)
  assert.equal(gate.judgeManifest({ courses: 1, sections: 1, excluded: 0 }).state, 'unjudged', 'judgeManifest 接受了非 parseManifest 形态的输入 ⇒ 长出第二份真相')
  assert.equal(gate.judgeManifest(gate.parseManifest('{"courses":[{"title":"x","sections":[{}]}],"excluded":[]}')).reading.courses, 1)
  const real = gate.parseManifest(readFileSync(join(ROOT, gate.MANIFEST_REL), 'utf8'))
  assert.equal(real.ok, true, `真仓 manifest 解析不出:${real.why}`)
  assert.ok(real.courses > 0 && real.sections > real.courses, '现读期望值形状不对')
  assert.equal(gate.judgeManifest(real).reading.courses, real.courses, '期望值没从 manifest 走')
})

// ────────────────────────────── ⑦⑧ 形状锁 ──────────────────────────────
test('形状锁⑨:§22d 双形态闸 —— pathToFileURL 守卫在位,且不得手拼 file:///', () => {
  const src = readFileSync(join(ROOT, SOURCE_REL), 'utf8')
  assert.match(src, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.doesNotMatch(src, /'file:\/\/\/'/, '手拼 file:/// 在 Windows 上永不匹配(§22d 红线)')
})

test('形状锁⑧:派生进程纪律 —— 对**实调用登记的参数**取证(§12g),不用正则猜生产代码', () => {
  const before = gate.spawnCallSites.length
  // ⑧a 写句必须在**登记之前**被拦 ⇒ 一次都不落 spawn 面
  assert.throws(() => gate.psqlSpawn('psql-fixture-bin', FIXTURE_DSN, 'UPDATE lessons SET is_published = true'))
  assert.equal(gate.spawnCallSites.length, before, '写句竟先登记后抛 ⇒ 只读闸门不在 spawn 路径上')
  // ⑧b 只读句走真实调用路径(bin 是夹具名 ⇒ spawnSync 只会 ENOENT,不可能连到任何库)
  gate.psqlSpawn('psql-fixture-bin', FIXTURE_DSN, gate.sqlTablePresence())
  assert.equal(gate.spawnCallSites.length, before + 1)
  const site = gate.spawnCallSites[gate.spawnCallSites.length - 1]
  // §12g 样板明文:**带 input 的派生必须 ['pipe','pipe','pipe']**;写成 ignore 就是把脚本堵在
  // 门外 —— psql 读到空 stdin 会静默返回空集,而下游把那读成"库里没东西"。
  assert.deepEqual(site.stdio, ['pipe', 'pipe', 'pipe'], 'spawnSync 未按"带 input"那一档接管 stdio')
  assert.equal(site.windowsHide, true, 'spawnSync 未带 windowsHide(派生进程纪律)')
  assert.equal(site.timeout, gate.PSQL_TIMEOUT_MS, 'psql 调用无超时上限 ⇒ 尺子能把人工档卡死')
  assert.equal(site.clientEncoding, 'UTF8', 'PGCLIENTENCODING 未钉 UTF8 ⇒ 中文锚定集会被码页拆坏')
  assert.ok(site.args.some((a) => String(a).startsWith('postgres://')), 'DSN 未随 args 传给 psql(取不到输入)')
  assert.ok(site.args.every((a) => !/--apply|--publish/.test(String(a))), 'psql 参数面出现 --apply/--publish ⇒ 生产写动作混进只读尺')
  assert.ok(!JSON.stringify(site).includes(SENTINEL_PW), 'spawn 登记镜像里含哨兵口令 ⇒ 凭据进了内存镜像面(红线③)')
  assert.ok(!site.args.some((a) => /SELECT/i.test(String(a))), 'SQL 又从 argv 走(GBK 码页那一坑回潮)')
  assert.match(site.script, /^SET client_encoding TO 'UTF8'/, '会话首句未钉 client_encoding')
  assert.doesNotThrow(() => gate.assertReadOnlySql(site.script.slice(gate.SESSION_PREFIX.length + 1, -1)), 'stdin 里那条不是只读句')
})

test('形状锁⑧c:中文锚定集必须能原样落到服务端(GBK 码页实测坑的回归锁)', () => {
  // 本机实测:`-c <含中文的 SQL>` 经 Windows ANSI 码页(936)转换后落到 psql,服务端报
  // `invalid byte sequence for encoding "UTF8": 0xcf 0xdf`;PGCLIENTENCODING 单独设也救不了
  // (转换发生在 argv 侧)。这条锁把"脚本走 stdin + UTF-8 缓冲"钉成形状,不回潮靠它。
  const sql = gate.sqlLegacyMountFacts(['清华大学机器学习导论', "O'Brien 课"])
  const script = gate.buildSessionScript(sql)
  assert.equal(script.startsWith(gate.SESSION_PREFIX), true)
  assert.ok(script.includes('清华大学机器学习导论'), '中文锚定集在装配阶段就变了形')
  const buf = Buffer.from(script, 'utf8')
  assert.equal(buf.toString('utf8'), script, 'UTF-8 往返不同形 ⇒ stdin 那条路也靠不住')
  assert.ok(!script.includes('-c'), '脚本里混进了 argv 形态参数')
  assert.throws(() => gate.buildSessionScript('DROP TABLE lessons'), /非只读语句起手/)
})

test('判据层:parseCountRow 只认 6 段非负整数,形态不对一律 null(不猜 0)', () => {
  assert.deepEqual(gate.parseCountRow('22|22|867|867|0|0'), { courses: 22, chapters: 22, sections: 867, sectionsWithUrl: 867, publishedCourses: 0, feedSections: 0 })
  assert.equal(gate.parseCountRow('22|22|867'), null)
  assert.equal(gate.parseCountRow(''), null)
  assert.equal(gate.parseCountRow('a|b|c|d|e|f'), null)
  assert.equal(gate.parseCountRow('-1|2|3|4|5|6'), null)
})

test('判据层:目标分类只分类不拒绝(与 lib/db-probe-client 的取证纪律刻意分歧,须有据)', () => {
  assert.equal(gate.classifyDsnTarget('postgres://u:p@127.0.0.1:5432/d').klass, 'loopback')
  assert.equal(gate.classifyDsnTarget(`postgres://u:p@127.0.0.1:${gate.prodTunnelPort}/d`).klass, 'prod-tunnel')
  assert.equal(gate.classifyDsnTarget('postgres://u:p@db.internal:5432/d').klass, 'remote-other')
  assert.equal(gate.classifyDsnTarget('mysql://u:p@h/d').klass, 'unjudged')
})

test('夹具落点纪律:manifest 夹具落 mkScratch,不落被跟踪的产品/守门源码树(§15b/门 208)', () => {
  const scratch = mkScratch('learn-mount-fixture-')
  try {
    const p = resolve(join(scratch, 'legacy-video-courses.json'))
    writeFileSync(p, MANIFEST_TEXT)
    assert.equal(gate.parseManifest(readFileSync(p, 'utf8')).ok, true)
    // 本仓批准的 scratch 落点按当次实测取值:本机 scratchRoot() 落在仓库内的 `.DevEnv/Temp`
    // (被 .gitignore 覆盖并由 lib/scratch-dir 打 git 边界),所以"不得在 ROOT 下"是错的判据;
    // 真判据是**不落被跟踪的源码树**(门 208 怕的是工作树里长出夹具)。
    for (const seg of ['scripts', 'apps', 'packages', 'deploy']) {
      assert.ok(!p.startsWith(join(ROOT, seg)), `夹具落进被跟踪源码树 ${seg}/:${p}`)
    }
    assert.ok(p.includes('ihui-scratch'), `夹具不在 scratch 根下:${p}`)
    assert.ok(!p.startsWith(resolve(os.tmpdir())), `夹具走了 os.tmpdir()(§15b 禁,TEMP 可能钉 C 盘):${p}`)
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

test('判据⑦:上游未判定不得让下游记绿;形态不对一律不猜 0', async () => {
  // ⑦a 库里只有两张表 ⇒ M2 gap,M3~M5 必须未判定(绝不能在"连错库"的面上读数)
  const wrongDb = await gate.collect({
    ...fixtureIO({ rows: FULL_ROWS, fetchResult: { status: 200, total: 2 } }),
    psqlRunner: (psql, dsn, sql) =>
      sql.includes('information_schema.tables')
        ? { status: 0, stdout: '2', stderr: '', lost: '' }
        : { status: 0, stdout: '1|1|2|2|1|2', stderr: '', lost: '' },
    argvDsn: FIXTURE_DSN,
    baseUrl: 'https://fixture.invalid',
  })
  const byId = Object.fromEntries(wrongDb.dimensions.map((d) => [d.id, d.state]))
  assert.equal(byId['M2-db-target'], 'gap')
  for (const id of ['M3-db-rows', 'M4-db-publish', 'M5-db-feed-total']) {
    assert.equal(byId[id], 'unjudged', `${id} 在"连错库"这一面上被记成了 ${byId[id]}`)
  }
  // ⑦b 主查询返回形态不对(4 段而不是 6 段)⇒ 三维未判定,不猜 0、不记 ok
  const badShape = await gate.collect({
    ...fixtureIO({ rows: FULL_ROWS, fetchResult: { status: 200, total: 2 } }),
    psqlRunner: (psql, dsn, sql) => (sql.includes('information_schema.tables') ? { status: 0, stdout: '3', stderr: '', lost: '' } : { status: 0, stdout: '1|1|2|2', stderr: '', lost: '' }),
    argvDsn: FIXTURE_DSN,
    baseUrl: 'https://fixture.invalid',
  })
  assert.ok(badShape.dimensions.filter((d) => d.state === 'unjudged').length >= 3, '半截读数被当成了判定')
})

test('判据②c(锁真的有牙):摘掉 publish 那一臂,同一夹具立刻从 gap 掉成 ok —— 反证 M4 在起作用', async () => {
  const src = readFileSync(join(ROOT, SOURCE_REL), 'utf8')
  const arm = 'export function judgePublish(rows) {'
  assert.ok(src.includes(arm), '找不到 judgePublish 的函数头(判据面改名了,本锁要跟着改,不得静默))')
  // 只把"函数头"换成"函数头 + 提前 return",**不带闭合花括号** —— 补了花括号会把原函数体甩到
  // 模块顶层,得到 SyntaxError: Illegal return statement(第一次写这把自己咬过一次,如实留档)
  const patched = src.replace(arm, 'export function judgePublish(rows) { return { id: "M4-db-publish", state: "ok", reading: rows, note: "臂被摘" }')
  assert.notEqual(patched, src, '补丁没落上')
  const scratch = mkScratch('learn-mount-arm-')
  try {
    const file = join(scratch, 'gate-armed.mjs')
    // 把源码整份复制到 scratch,并把相对 import 改写成 file:// 绝对 URL(副本不在仓树里,
    // 裸相对说明符无处解析;Windows 下裸 `G:/...` 会被当 URL scheme 吃,必须 pathToFileURL)
    const abs = (spec) => (spec.startsWith('./') || spec.startsWith('../') ? pathToFileURL(resolve(ROOT, 'scripts', spec)).href : spec)
    const rewritten = patched.replace(/from '(\.\.?\/[^']+)'|from "(\.\.?\/[^"]+)"/g, (m, a, b) => `from '${abs(a || b)}'`)
    writeFileSync(file, rewritten)
    const mod = await import(pathToFileURL(file).href)
    const io = {
      // 摘臂对照必须让**只有 M4 那一臂**在判:publishedCourses=0(部分发布都没,直接 0)而
      // feedSections 与接口读数都好 ⇒ armed=gap 且 gap 只来自 M4;摘掉后 armed→ok。
      // 这组数在真库里逻辑上不自洽(发布位 0 却谓词有数),正因为不自洽才能把"是不是 M4 在判"
      // 单独 isolate 出来 —— 这是臂测的本分,不是对现网的描述(现网那一型见阳性对照②)。
      fsImpl: { existsSync: () => true, readFileSync: () => MANIFEST_TEXT },
      locateClient: () => ({ psql: 'psql-fixture', tried: ['fixture'] }),
      psqlRunner: (psql, dsn, sql) =>
        sql.includes('information_schema.tables')
          ? { status: 0, stdout: '3', stderr: '', lost: '' }
          : { status: 0, stdout: '1|1|2|2|0|2', stderr: '', lost: '' },
      httpFetcher: async () => ({ status: 200, total: 2 }),
    }
    const armed = await gate.collect({ ...io, argvDsn: FIXTURE_DSN, baseUrl: 'https://fixture.invalid' })
    const disarmed = await mod.collect({ ...io, argvDsn: FIXTURE_DSN, baseUrl: 'https://fixture.invalid' })
    assert.equal(armed.overall, 'gap', '原码这一轮本该 gap')
    assert.equal(armed.dimensions.find((d) => d.id === 'M4-db-publish').state, 'gap', '原码里 M4 没红 ⇒ 摘臂对照组选错了')
    assert.ok(disarmed.dimensions.find((d) => d.id === 'M4-db-publish').state === 'ok', '摘臂后 M4 仍红 ⇒ 补丁没生效(测试自身假绿)')
    assert.equal(disarmed.overall, 'ok', `摘掉唯一在判的那一臂后汇总仍=${disarmed.overall} ⇒ 结论与判据脱钩`)
    assert.notEqual(disarmed.overall, armed.overall, '摘掉 publish 臂后汇总结论没变 ⇒ 那一臂从未参与判定(锁是纸的)')
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

test('判据②d:一轮里实发的每条 SQL 都必须过只读闸(取材面取证,不是读源码正则)', async () => {
  await gate.collect({ ...fixtureIO({ rows: FULL_ROWS, fetchResult: { status: 200, total: 2 } }), argvDsn: FIXTURE_DSN, baseUrl: 'https://fixture.invalid' })
  assert.equal(sentSql.length, 2, `一轮该发 2 条 SQL(表存在性 + 主查询),实得 ${sentSql.length}`)
  for (const sql of sentSql) assert.doesNotThrow(() => gate.assertReadOnlySql(sql), `实发的 SQL 不是只读句:${sql.slice(0, 40)}`)
})

test('体内 --self-test 必须真的全绿(登记器不求值就等于没判)', () => {
  assert.equal(typeof runSelfTest, 'function')
  return runSelfTest().then((code) => assert.equal(code, 0, '--self-test 有失败用例'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

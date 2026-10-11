// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * pg-backup-cadence-audit 的镜像测试(§22c:直接 import 源脚本的 __test__,不在测试里重抄判据)。
 *
 * 锁的是"三态绝不并桶"这一件事,以及六条最小判据:
 *  ① 某日实存且完整 ⇒ ok;② 窗口内某日无文件 ⇒ MISSING(broken);
 *  ③ TOC 解析失败 ⇒ truncated(既不是 undetermined 也不是 ok);
 *  ④ 读不到的文件 ⇒ undetermined 且该日**永不算 ok**;
 *  ⑤ 保留窗口之外的缺席与窗口内的缺席必须分成两件事(前者不是故障 —— 假警报会让这把尺子没人看);
 *  ⑥ 邻日中位数骤缩规则:真骤缩必须命中,而 09-25 那种"一天 8 份、大小几乎相同"的多轮日绝不得命中。
 * 另配端到端(buildReport + 临时目录 + 注入假 pg_restore)证明报告不是恒绿:
 * 同一套夹具,把其中一天改成解析失败 ⇒ 结论必须从 ok 翻成 broken。
 * 临时夹具一律经 scripts/lib/scratch-dir.mjs(不用 os.tmpdir、不落仓库树内)。
 *
 * 2026-09-28 多库(keycloak)接入后另锁三条 —— 它们就是这次修掉的三个缺陷:
 *  ⑦ 审计的库清单读自 runner 的 $backupDatabases:解析不出 ⇒ **未判定**,绝不静默退回单库;
 *    判据有牙用真仓 runner 原文当正例(§22c"夹具只复读实现就是复读机"),并用一份 fixture runner
 *    的 A/B(同一套夹具,唯一差别是有没有那行)证明红来自那一行而不是管道。
 *    G-297 又把"退回单库"这最后一格堵死:源码里不得存在任何默认库名(掩码后的源码级反向锁)、
 *    空清单(含测试通道注入的空数组)一律按未判定处理、审计面为空时逐日一律 UNAUDITED 且目录里的
 *    疑似备份档必须带数量报名 —— "没看着"既不许写成 ok 也不许悄悄消失。
 *  ⑧ 统计**按库分开**:小库(0.2 MB 量级)的档不得被大库的中位数判成"骤缩";缺席判定 likewise 逐库,
 *    并含一条主案正例(两个库 + 大小差两个数量级 + 小库缺一天 ⇒ 点名小库、大库齐不得顶成满分)。
 *  ⑨ 新库不得造出追溯性假红:起判日派生自目录实存,起判之前的日子记 PRE_START
 *    (既不算缺席、也不算齐),而起判之后缺一天 ⇒ 必须 MISSING;起判日必须写进人读报告。
 * ⑩ 量不到的每一格(表数 / 代表档大小 / 骤缩邻日)都要点名到"日子 + 原因",不得静默算通过。
 * ⑪ --json 输出必须真能被 JSON.parse,且 --strict 与默认档只差退出码、判读逐字相同。
 * ⑫ --self-test 是一条真出路(指向镜像测试)而不是一枚空开关。
 * 外加两条反向锁:FOREIGN 归属它自己那个库(不得替别的库作证)、逐日 rollup 不得让 ok 盖掉 MISSING。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskComments } from '../lib/code-mask.mjs'
import { __test__ as A } from '../pg-backup-cadence-audit.mjs'

const TODAY = '20260927'
const WINDOW = A.enumerateWindow(TODAY, 7)
/** 测试夹具用的一台库名。刻意放在**测试**里而不是源码里 —— 源码不留默认库(G-297 的正身) */
const MAIN = 'ihui_dev'
const MAIN_ONLY = [MAIN]

/** 构造"文件"记录(纯数据,决策层只吃这些);dbs 只用于分类,不进记录 */
function f(name, { dbs = MAIN_ONLY, ...over } = {}) {
  const cls = A.classifyFileName(name, dbs)
  return { name, family: cls.family, db: cls.db, ymd: cls.ymd, hms: cls.hms, stamp: (cls.ymd || '') + (cls.hms || ''), size: 90_000_000, verdict: 'complete', reasons: [], ...over }
}
const dumpName = (ymd, hms = '030003') => `${MAIN}_${ymd}_${hms}.dump`

// ──────────────────────────── ① 命名族识别 ────────────────────────────

test('家族分类:下划线族=每晚链、连字符族=旁生产者、.sql.gz=旧形态、其余不相关', () => {
  assert.equal(A.classifyFileName(dumpName('20260927', '030003'), MAIN_ONLY).family, 'dump')
  assert.equal(A.classifyFileName('ihui-dev-20260924-073532.dump', MAIN_ONLY).family, 'dump-foreign')
  assert.equal(A.classifyFileName('ihui_dev-20260906-065559.sql.gz', MAIN_ONLY).family, 'sqlgz')
  assert.equal(A.classifyFileName('backup.log', MAIN_ONLY).family, 'unrelated')
  assert.equal(A.classifyFileName('pg_hba.conf.pre-admin-20260925-031645', MAIN_ONLY).family, 'unrelated')
  // 不传清单 ⇒ 一个库都不认 ⇒ keycloak 的档仍是 unrelated(它曾这样静默消失在每一条序列之外)
  assert.equal(A.classifyFileName('keycloak_20260927_030003.dump').family, 'unrelated')
  // **同一型对主库也成立**:不传清单时连 ihui_dev 的档都不认 —— 源码里没有"默认库"这回事
  assert.equal(A.classifyFileName(dumpName('20260927')).family, 'unrelated', '无清单 ⇒ 不猜默认库')
  assert.equal(A.classifyFileName(dumpName('20260927'), []).family, 'unrelated')
})

test('清单归一:空进空出,绝不长出任何默认库;重复与空白被去掉', () => {
  assert.deepEqual(A.normalizeDatabases(undefined), [])
  assert.deepEqual(A.normalizeDatabases(null), [])
  assert.deepEqual(A.normalizeDatabases([]), [])
  assert.deepEqual(A.normalizeDatabases(['  ', '']), [], '空字面量不算一个库')
  assert.deepEqual(A.normalizeDatabases([MAIN, 'keycloak', MAIN, ' keycloak ']), [MAIN, 'keycloak'])
})

test('家族分类·清单驱动:keycloak 的三种命名各归各位,且 db 字段指向它自己那个库', () => {
  const dbs = ['ihui_dev', 'keycloak']
  const dump = A.classifyFileName('keycloak_20260927_030003.dump', dbs)
  assert.deepEqual(dump, { family: 'dump', ymd: '20260927', hms: '030003', db: 'keycloak' })
  assert.equal(A.classifyFileName('keycloak-20260927-030003.dump', dbs).family, 'dump-foreign')
  assert.equal(A.classifyFileName('keycloak-20260927-030003.dump', dbs).db, 'keycloak')
  assert.equal(A.classifyFileName('keycloak_20260906_065559.sql.gz', dbs).family, 'sqlgz')
  // 一个库的旁族档不得被认成另一个库的产出
  assert.equal(A.classifyFileName('keycloak-20260927-030003.dump', ['ihui_dev']).family, 'unrelated')
})

test('⑦ 命名族按清单逐库识别:keycloak 的档只在清单含它时才进被审面,且归属自己那个库', () => {
  // 不传清单 ⇒ 兜底只认 ihui_dev ⇒ keycloak 的档是 unrelated(它曾这样静默消失在每一条序列之外)
  assert.equal(A.classifyFileName('keycloak_20260927_030003.dump').family, 'unrelated')
  assert.equal(A.classifyFileName('keycloak_20260927_030003.dump').db, null)
  const c = A.classifyFileName('keycloak_20260927_030003.dump', ['ihui_dev', 'keycloak'])
  assert.equal(c.family, 'dump')
  assert.equal(c.db, 'keycloak')
  assert.equal(c.ymd, '20260927')
  // 反向锁:清单里没有 keycloak 时,它的档不得被算成任何库的产出
  assert.equal(A.classifyFileName('keycloak_20260927_030003.dump', ['ihui_dev']).family, 'unrelated')
  // dash 族同样逐库:归属它自己那个库,不替别的库作证
  assert.deepEqual(
    A.classifyFileName('keycloak-20260924-073532.dump', ['ihui_dev', 'keycloak']),
    { family: 'dump-foreign', ymd: '20260924', hms: '073532', db: 'keycloak' },
  )
  assert.equal(A.classifyFileName('keycloak_20260906_065559.sql.gz', ['keycloak']).family, 'sqlgz')
})

test('⑦ 模式生成器只有一份实现:对主库逐字复现 drill 的 DUMP_NAME_RE,另两族形状由字面锁住', () => {
  // 泛化不能漂:两条模式的字面 source 必须相同,否则"同一个文件名两边判成不同族"就没人看见了
  assert.equal(A.dumpNameReFor(MAIN).source, A.DUMP_NAME_RE.source)
  // 旁族/旧族的形状写成**测试里的字面量**(而不是源码再导出一份常量):形状漂了这里红,而导出的常量被顺手删掉时无人红
  assert.equal(A.dashDumpReFor(MAIN).source, '^ihui[-_]dev-(\\d{8})-(\\d{6})\\.dump$')
  assert.equal(A.sqlGzReFor(MAIN).source, '^ihui[-_]dev[-_](\\d{8})[-_](\\d{6})\\.sql\\.gz$')
  // 库名里的正则元字符必须被转义(否则 my.db 那点号会当通配)
  assert.equal(A.classifyFileName('myXdb_20260927_030003.dump', ['my.db']).family, 'unrelated')
  assert.equal(A.classifyFileName('my.db_20260927_030003.dump', ['my.db']).family, 'dump')
  assert.equal(A.looksLikeBackupArtifact('whatever.dump'), true)
  assert.equal(A.looksLikeBackupArtifact('whatever.sql.gz'), true)
  assert.equal(A.looksLikeBackupArtifact('backup.log'), false)
})

// ──────────────────────────── ⑤ 缺席定性 ────────────────────────────

test('缺席定性:窗口内=MISSING、窗口外=OUT_OF_RETENTION、今天未过点=PENDING_TODAY', () => {
  assert.equal(A.absenceKind('20260925', WINDOW, TODAY, 12, 3), 'MISSING')
  assert.equal(A.absenceKind('20260910', WINDOW, TODAY, 12, 3), 'OUT_OF_RETENTION')
  assert.equal(A.absenceKind(TODAY, WINDOW, TODAY, 1, 3), 'PENDING_TODAY')
  assert.equal(A.absenceKind(TODAY, WINDOW, TODAY, 9, 3), 'MISSING', '今天已过 03:00+宽限仍无文件 ⇒ 是真缺失,不是"还没到点"')
})

test('②⑤ 窗口内空日判 MISSING(broken),窗口外空日不得产生任何 finding', () => {
  const inside = A.judgeDay({ ymd: '20260925', files: [], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.equal(inside.status, 'MISSING')
  assert.equal(inside.findings[0].code, 'MISSING')
  assert.equal(inside.findings[0].severity, 'broken')

  const outside = A.judgeDay({ ymd: '20260910', files: [], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.equal(outside.status, 'OUT_OF_RETENTION')
  assert.deepEqual(outside.findings, [], '保留策略把老文件清了不是故障 —— 报成故障就是假警报')
  assert.equal(A.decideVerdict([outside]).verdict, 'ok')
})

// ──────────────────────────── ① 完整日 ────────────────────────────

test('① 实存且完整 ⇒ ok,无 finding', () => {
  const d = A.judgeDay({ ymd: '20260925', files: [f(dumpName('20260925'))], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.equal(d.status, 'ok')
  assert.deepEqual(d.findings, [])
  assert.equal(A.decideVerdict([d]).verdict, 'ok')
})

// ──────────────────────────── ③ 截断 ────────────────────────────

test('③ TOC 解析失败 ⇒ truncated(既不是 undetermined,该日也不是 ok)', () => {
  const one = { exists: true, size: 90_000_000, magicOk: true, toc: { rc: 1 } }
  const c = A.classifyDump(one)
  assert.equal(c.verdict, 'truncated')
  assert.notEqual(c.verdict, 'undetermined', '截断与判不出是两件事:前者是坏消息,后者是没看到')
  assert.match(c.reasons[0], /TOC/)

  const day = A.judgeDay({ ymd: '20260923', files: [f(dumpName('20260923'), { verdict: 'truncated' })], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.notEqual(day.status, 'ok')
  assert.equal(day.status, 'TRUNCATED')
  assert.equal(A.decideVerdict([day]).verdict, 'broken')
})

test('③ 同日既有完整又有截断 ⇒ 该日仍可恢复,但必须点名(降级不判死)', () => {
  const day = A.judgeDay({
    ymd: '20260924',
    files: [f(dumpName('20260924', '030002')), f(dumpName('20260924', '043937'), { verdict: 'truncated' })],
    window: WINDOW,
    todayStr: TODAY,
    nowHour: 12,
    schedHour: 3,
  })
  assert.equal(day.status, 'ok-with-truncated')
  const codes = day.findings.map((x) => x.code)
  assert.ok(codes.includes('TRUNCATED_WITH_GOOD'), codes.join(','))
  assert.equal(A.decideVerdict([day]).verdict, 'degraded')
})

// ──────────────────────────── ④ 判不出 ────────────────────────────

test('④ 读不到的文件 ⇒ undetermined,该日永不算 ok,总结论也不算 ok', () => {
  assert.equal(A.classifyDump({ exists: true, size: 10, magicOk: true, toc: null }).verdict, 'undetermined')
  assert.equal(A.classifyDump({ exists: true, magicOk: true }).verdict, 'undetermined', '量不到大小不算通过')
  const day = A.judgeDay({ ymd: '20260926', files: [f(dumpName('20260926'), { verdict: 'undetermined' })], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.equal(day.status, 'UNDETERMINED')
  assert.equal(day.findings[0].severity, 'undetermined')
  const dec = A.decideVerdict([day])
  assert.equal(dec.verdict, 'undetermined')
  assert.notEqual(dec.verdict, 'ok')
})

test('结论优先级:undetermined > broken > degraded(尺子本身瞎了比坏消息更该先处理)', () => {
  const broken = { ymd: 'a', findings: [{ code: 'MISSING', severity: 'broken' }] }
  const degraded = { ymd: 'b', findings: [{ code: 'LATE_LAND', severity: 'degraded' }] }
  const undet = { ymd: 'c', findings: [{ code: 'UNDETERMINED_ONLY', severity: 'undetermined' }] }
  assert.equal(A.decideVerdict([broken, degraded]).verdict, 'broken')
  assert.equal(A.decideVerdict([degraded]).verdict, 'degraded')
  assert.equal(A.decideVerdict([broken, degraded, undet]).verdict, 'undetermined')
})

test('退出码:ok=0;broken=1;degraded 默认 0 而 --strict 1;undetermined 默认 2 而 --strict 1', () => {
  assert.equal(A.exitCodeFor('ok', false), 0)
  assert.equal(A.exitCodeFor('ok', true), 0)
  assert.equal(A.exitCodeFor('broken', false), 1)
  assert.equal(A.exitCodeFor('degraded', false), 0)
  assert.equal(A.exitCodeFor('degraded', true), 1)
  assert.equal(A.exitCodeFor('undetermined', false), 2)
  assert.equal(A.exitCodeFor('undetermined', true), 1)
})

// ──────────────────────────── ⑥ 骤缩规则 ────────────────────────────

test('⑥ 邻日中位数骤缩:真骤缩必须命中', () => {
  const sizes = [90e6, 91e6, 92e6, 1e6, 93e6, 94e6]
  const series = sizes.map((size, i) => ({ ymd: `d${i}`, size }))
  const hits = series.map((_, i) => A.judgeShrink(series, i).state)
  assert.equal(hits[3], 'shrink', hits.join(','))
  assert.deepEqual(hits.filter((h) => h === 'shrink'), ['shrink'], '只有那一日命中')
})

test('⑥ 骤缩规则不得在 09-25 式"一天 8 份、大小几乎相同"的多轮日上误报', () => {
  // 真实数字取自 2026-09-25 那 8 份(98,881,042 … 98,913,088),同日多轮彼此差 <0.04%
  const dayFiles = [
    '022154', '023656', '030001', '031845', '031924', '035459', '041652', '050926',
  ].map((hms, i) => f(dumpName('20260925', hms), { size: 98_881_042 + i * 4500 }))
  const primary = A.pickPrimary(dayFiles)
  assert.equal(primary.hms, '050926', '代表文件 = 时间最晚的那一份完整件')
  const series = [
    { ymd: '20260923', size: 89_758_951 },
    { ymd: '20260924', size: 94_457_386 },
    { ymd: '20260925', size: primary.size },
    { ymd: '20260926', size: 103_626_143 },
    { ymd: '20260927', size: 108_082_145 },
  ]
  const i = series.findIndex((s) => s.ymd === '20260925')
  assert.equal(A.judgeShrink(series, i).state, 'ok', '同日多轮 + 缓慢增长不是骤缩')
  // 同日多份且后面的更大 ⇒ 也不得命中同日缩水判据
  assert.deepEqual(A.judgeIntraDay(dayFiles), [])
})

test('同日多份而后一份显著变小 ⇒ INTRA_DAY_SHRINK(失败截断轮形态)', () => {
  const files = [f(dumpName('20260924', '030002'), { size: 94_402_387 }), f(dumpName('20260924', '090000'), { size: 12_000_000 })]
  const out = A.judgeIntraDay(files)
  assert.equal(out.length, 1)
  assert.equal(out[0].code, 'INTRA_DAY_SHRINK')
  const d = A.judgeDay({ ymd: '20260924', files, window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.ok(d.findings.some((x) => x.code === 'INTRA_DAY_SHRINK'), d.findings.map((x) => x.code).join(','))
})

test('0 字节文件:三态判 truncated,且单独记一条 broken 级异常', () => {
  assert.equal(A.classifyDump({ exists: true, size: 0, magicOk: false, toc: null }).verdict, 'truncated')
})

// ──────────────────────────── 落盘时刻 ────────────────────────────

test('落盘窗口:任一份落在 03:00±2h 即算在点(只看最早那份会误判 09-25)', () => {
  assert.equal(A.judgeLanding([f(dumpName('20260925', '022154')), f(dumpName('20260925', '030001'))], 3).state, 'on-schedule')
  assert.equal(A.judgeLanding([f(dumpName('20260926', '113000'))], 3).state, 'late')
  assert.equal(A.judgeLanding([f(dumpName('20260926', '004500'))], 3).state, 'off-window')
})

// 2026-10-11 实测假阳:计划轮的文件名是 dump **起始**时刻 02:59:59(mtime 03:00:22、流水"备份完成"),
// 旧判据按小时截断且只给迟到一侧宽限 ⇒ 把它报成 OFF_WINDOW_LAND。以下三条钉住这一族。
test('落盘窗口按分钟量:跨了分钟界的计划轮(02:59:59)算在点,且仍留观察注记', () => {
  const land = A.judgeLanding([f(dumpName('20261011', '025959'))], 3)
  assert.equal(land.state, 'on-schedule', '早 1 秒不是故障:窗口须与报告行"±2h"的措辞同形')
  assert.deepEqual(land.window, [60, 300], '窗口 = 计划时刻两侧各 2h')
  assert.equal(land.early.length, 1, '但"落在计划时刻之前"这一维必须被量出来,不得静默')
  const d = A.judgeDay({ ymd: '20261011', files: [f(dumpName('20261011', '025959'))], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.ok(!d.findings.some((x) => x.code === 'OFF_WINDOW_LAND'), d.findings.map((x) => x.code).join(','))
  assert.ok(d.notes.some((n) => n.includes('落在计划时刻之前')), '在点≠不报名:注行必须写进报告')
  assert.equal(A.decideVerdict([d]).verdict, 'ok', '真·正常轮不得再产出一封假信')
})

test('落盘窗口边界成对:01:00/05:00 在点,00:59:59 判 off-window,05:00:01 判 late(单边放宽即翻红)', () => {
  assert.equal(A.judgeLanding([f(dumpName('20261011', '010000'))], 3).state, 'on-schedule')
  assert.equal(A.judgeLanding([f(dumpName('20261011', '050000'))], 3).state, 'on-schedule')
  assert.equal(A.judgeLanding([f(dumpName('20261011', '005959'))], 3).state, 'off-window', '早于整个窗口仍须判红 —— 牙齿没被削弱')
  assert.equal(A.judgeLanding([f(dumpName('20261011', '050001'))], 3).state, 'late')
  const d = A.judgeDay({ ymd: '20261011', files: [f(dumpName('20261011', '004500'))], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.ok(d.findings.some((x) => x.code === 'OFF_WINDOW_LAND'), 'off-window 这一档必须真能红')
  assert.ok(d.findings.find((x) => x.code === 'OFF_WINDOW_LAND').text.includes('00:45'), `报告须给 HH:MM 而不是裸小时整数`)
})

test('时间戳读不出 ⇒ 落 off-window 并点名,不得因为"没量到"就发合格证', () => {
  assert.ok(Number.isNaN(A.minuteOfDay('')))
  assert.ok(Number.isNaN(A.minuteOfDay('20261011')))
  assert.equal(A.hhmm(A.minuteOfDay('025959')), '02:59')
  assert.equal(A.hhmm(NaN), '??:??')
  const bad = f(dumpName('20261011', '025959'))
  bad.hms = 'zzzzzz'
  assert.equal(A.judgeLanding([bad], 3).state, 'off-window')
})

test('延迟落盘 ⇒ LATE_LAND(degraded),它不是 MISSING 但必须被看见', () => {
  const d = A.judgeDay({ ymd: '20260926', files: [f(dumpName('20260926', '113000'))], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.equal(d.status, 'ok', '文件在且完整 —— 日状态与"是否在点"是两个维度,不得混成一个')
  assert.ok(d.findings.some((x) => x.code === 'LATE_LAND'))
  assert.ok(d.findings.find((x) => x.code === 'LATE_LAND').text.includes('11:30'), '措辞须给得出具体时刻')
  assert.equal(A.decideVerdict([d]).verdict, 'degraded')
})

test('某日只有旁族(连字符)dump ⇒ FOREIGN_ONLY(degraded),不得读成 MISSING', () => {
  const d = A.judgeDay({ ymd: '20260925', files: [f('ihui-dev-20260925-073532.dump')], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.equal(d.status, 'FOREIGN_ONLY')
  assert.equal(d.findings[0].code, 'FOREIGN_ONLY')
  assert.notEqual(d.findings[0].code, 'MISSING')
})

// ──────────────────────────── 配置读取 ────────────────────────────

test('保留天数/计划时刻/云目录读自脚本原文,而不是抄进本工具', () => {
  assert.equal(A.parseRetention('$retentionDays = 7'), 7)
  assert.equal(A.parseRetention('nothing'), null)
  assert.equal(A.parseScheduleHour('$next = Get-Date -Year 2026 -Month 9 -Day 27 -Hour 3 -Minute 0 -Second 0'), 3)
  assert.equal(A.parseScheduleHour('$next = Get-Date -Hour 4 -Minute 15'), 4)
  assert.equal(A.parseCloudDir('$cloudDir = "D:\\BaiduSyncdisk\\IHUI-PG-BACKUP"'), 'D:\\BaiduSyncdisk\\IHUI-PG-BACKUP')
  assert.equal(A.parseCloudDir('$x = 1'), null)
})

// ──────────────────── ⑦ 审计库清单(读自 runner,不写死) ────────────────────

/** 真仓入库源原文 —— §22c:判据的对象是"某个真实文件的形态",正例的输入必须逐字取自那个文件 */
const REAL_RUNNER_TEXT = readFileSync(new URL('../../deploy/win/ihui-pg-backup.ps1', import.meta.url), 'utf8')

test('⑦ 正例:真仓 runner 原文解析出 ihui_dev + keycloak($dbName 走同文件兜底行)', () => {
  const r = A.parseBackupDatabases(REAL_RUNNER_TEXT)
  assert.equal(r.parsed, true, r.reason)
  assert.deepEqual(r.databases, ['ihui_dev', 'keycloak'])
  assert.equal(r.primaryLiteral, 'ihui_dev', '主库字面值必须来自 if (-not $dbName) 那一行,不是抄进本工具')
})

test('⑦ "被执行的那份"与入库源必须给同一个清单(§5e 取径;影子副本缺失时如实报未判定)', (t) => {
  // 工具读清单的顺序是 prod-bundle 优先。非部署机没有那份(整目录被 gitignore)⇒
  // 这里只能"未判定",不得把它读成"两份一致"。两份都在却清单不同 ⇒ 红(那正是影子副本过期的形态)。
  const shadow = new URL('../../deploy/prod-bundle/pg-backup.ps1', import.meta.url)
  if (!existsSync(shadow))
    return t.skip('本机没有 deploy/prod-bundle/pg-backup.ps1(非部署机是常态)⇒ 本维未判定,不记为通过')
  const s = A.parseBackupDatabases(readFileSync(shadow, 'utf8'))
  assert.equal(s.parsed, true, `被执行的那份解析不出清单:${s.reason}`)
  assert.deepEqual(s.databases, A.parseBackupDatabases(REAL_RUNNER_TEXT).databases, '两份 runner 的审计面不同 ⇒ 工具审的不是在跑的那个面')
})

test('⑦ 反例:四种"读不出清单"一律 parsed=false,绝不给出半个清单冒充完整', () => {
  assert.equal(A.parseBackupDatabases('$retentionDays = 7').parsed, false, '没有 $backupDatabases 行')
  assert.equal(A.parseBackupDatabases('$backupDatabases = @()').parsed, false, '空数组不等于"没有库要审"')
  assert.equal(A.parseBackupDatabases('$backupDatabases = @($other, "x")').parsed, false, '看不懂的项不猜库名')
  assert.equal(A.parseBackupDatabases('$backupDatabases = @($dbName, "keycloak")').parsed, false, '$dbName 而无兜底行 ⇒ 主库字面值无从解析')
  assert.match(A.parseBackupDatabases('$backupDatabases = @($other, "x")').reason, /不猜/)
  // 正例成对:同样带 $dbName,但兜底行在同份文件里 ⇒ 解析成功
  assert.deepEqual(A.parseBackupDatabases('if (-not $dbName) { $dbName = "ihui_dev" }\n$backupDatabases = @($dbName, "keycloak")').databases, ['ihui_dev', 'keycloak'])
  // 去重(Select-Object -Unique 的语义):$dbName 恰好就等于 keycloak 时不得审两遍
  assert.deepEqual(A.parseBackupDatabases('if (-not $dbName) { $dbName = "keycloak" }\n$backupDatabases = @($dbName, \'keycloak\')').databases, ['keycloak'])
})

// ──────────────────── ⑨ 每库起判日(派生自实存) ────────────────────

test('⑨ 起判日四种形态:新库从第一份档起判、一份都没有则整窗照判', () => {
  const win = A.enumerateWindow('20260927', 4) // 20260924..27
  assert.deepEqual(win, ['20260924', '20260925', '20260926', '20260927'])
  const derived = A.deriveStartYmd(['20260926', '20260927'], win)
  assert.equal(derived.mode, 'DERIVED')
  assert.equal(derived.startYmd, '20260926')
  assert.equal(derived.startIdx, 2)
  const noFile = A.deriveStartYmd([], win)
  assert.equal(noFile.mode, 'NO_FILE')
  assert.equal(noFile.startYmd, '20260924', '一份都没有 ⇒ 从窗口首日起判(缺席即 MISSING),不得当成"还没开始"放过')
  assert.equal(A.deriveStartYmd(['20260920', '20260924'], win).mode, 'CLAMPED_TO_WINDOW')
  const future = A.deriveStartYmd(['20261001'], win)
  assert.equal(future.mode, 'AFTER_WINDOW')
  assert.equal(future.startIdx, -1, '日期超前 ⇒ 本窗口不判缺席,但不能被读成"这个库齐了"')
})

test('逐日 rollup:一天两库,ok 不得盖掉另一库的 MISSING', () => {
  assert.equal(A.worstStatus(['ok', 'MISSING']), 'MISSING')
  assert.equal(A.worstStatus(['MISSING', 'ok']), 'MISSING', '与遍历顺序无关')
  assert.equal(A.worstStatus(['ok', 'TRUNCATED']), 'TRUNCATED')
  assert.equal(A.worstStatus(['PENDING_TODAY', 'ok-with-truncated']), 'ok-with-truncated')
  assert.equal(A.worstStatus(['ok', 'PRE_START']), 'ok', 'PRE_START 不是坏消息,不得顶掉真实状态')
  assert.equal(A.worstStatus([]), 'ok')
})

test('TOC 元信息:TABLE DATA 严格计数(namespace 为 "-" 的不算),并量出源库版本', () => {
  const toc = [
    ';',
    '; Archive created at 2026-09-27 03:00:03',
    ';     TOC Entries: 5325',
    ';     Dumped from database version: 18.6',
    '; Selected TOC Entries:',
    '7; 2200 0 TABLE DATA public users ihui',
    '8; 0 0 TABLE DATA - - postgres',
  ].join('\n')
  const m = A.parseTocMeta(toc)
  assert.equal(m.tocEntries, 5325)
  assert.equal(m.dbVersion, '18.6')
  assert.equal(m.tableDataCount, 1, 'TABLE DATA - - 那一行是归档元信息,不是表')
  assert.equal(m.archiveCreatedAt, '2026-09-27 03:00:03')
})

test('版本漂移作为观察项报告:参照档 = 最近一日(平票时"众数"没有定义)', () => {
  const v = A.judgeVersionDrift([
    { ymd: '20260921', dbVersion: '18.2' },
    { ymd: '20260922', dbVersion: '18.2' },
    { ymd: '20260923', dbVersion: '18.6' },
    { ymd: '20260924', dbVersion: '18.6' },
  ])
  assert.equal(v.drift, true)
  assert.equal(v.reference, '18.6', '要还原的目标是当下这台库,不是窗口里出现次数最多的那台')
  assert.deepEqual(v.odd, ['20260921=18.2', '20260922=18.2'])
  assert.equal(A.judgeVersionDrift([{ ymd: 'a', dbVersion: '18.6' }, { ymd: 'b', dbVersion: '18.6' }]).drift, false)
  // 参照档取"最后一个有版本的日子",末尾缺 TOC 元信息时不得把 null 当参照
  const partial = A.judgeVersionDrift([{ ymd: 'x', dbVersion: '18.2' }, { ymd: 'y', dbVersion: '18.6' }, { ymd: 'z', dbVersion: null }])
  assert.equal(partial.reference, '18.6')
})

test('TABLE DATA 骤降 ⇒ 降级发现;缓慢增长不得命中', () => {
  const mk = (n) => [{ ymd: '1', tableDataCount: n - 2 }, { ymd: '2', tableDataCount: n - 1 }, { ymd: '3', tableDataCount: 40 }, { ymd: '4', tableDataCount: n }]
  assert.equal(A.judgeTableDrift(mk(722)).length, 1)
  const grow = [{ ymd: '1', tableDataCount: 715 }, { ymd: '2', tableDataCount: 716 }, { ymd: '3', tableDataCount: 722 }, { ymd: '4', tableDataCount: 722 }]
  assert.deepEqual(A.judgeTableDrift(grow), [])
})

test('magic 前缀量的是实际字节(报告要给人看),不是布尔', () => {
  assert.equal(A.magicPrefixOf(Buffer.from('PGDMP\u0001\u0002')), 'PGDMP')
  assert.equal(A.magicPrefixOf(Buffer.from('PD ')), null, '不足 5 字节 ⇒ 判不出,不得当成 PGDMP')
  assert.equal(A.magicPrefixOf(Buffer.from('-- pg_dump text')), '-- pg')
})

test('CLI 开关:未知开关/坏 --days/位置参数一律判死(不静默掉进默认档)', () => {
  assert.ok(A.parseCliArgs(['--nonsense']).error)
  assert.ok(A.parseCliArgs(['--days', 'abc']).error)
  assert.ok(A.parseCliArgs(['--dir', 'x']).error, '目录覆盖请走环境变量,不给第二个入口')
  assert.equal(A.parseCliArgs(['--days', '14']).days, 14)
  assert.equal(A.parseCliArgs(['--days=14']).days, 14)
  assert.equal(A.parseCliArgs(['--strict', '--json']).strict, true)
})

// ──────────────────────────── 端到端(buildReport) ────────────────────────────

const TOC_OK = [';', '; Archive created at 2026-09-27 03:00:03', ';     TOC Entries: 5325', ';     Dumped from database version: 18.6', '; Selected TOC Entries:', '7; 2200 0 TABLE DATA public users ihui'].join('\n')

/** 一份可读的 fixture runner 文本;withList:false ⇒ 刻意抹掉 $backupDatabases 行(⑦ 的反例载体) */
function runnerText({ retention = 3, withList = true } = {}) {
  const lines = [`$retentionDays = ${retention}`, '$cloudDir = "X:\\not-used-in-test"', 'if (-not $dbName) { $dbName = "ihui_dev" }']
  if (withList) lines.push("$backupDatabases = @($dbName, 'keycloak') | Select-Object -Unique")
  return lines.join('\n')
}

/**
 * 端到端夹具。
 *  databases   注入给 buildReport 的审计清单;'omit' ⇒ 不注入(改由 runnerText 解析,用来验 ⑦)
 *  extraDb     第二个库的名字;extraDbDays 它实存的日子(⑨ 的起判日就派生自这里)
 *  extraSize   第二个库的档大小 —— 故意远小于主库,用来验"统计必须按库分开"(⑧)
 *  runnerText  给定时写成一份 fixture runner 并让工具去读它
 */
function makeFixture({
  days = 3,
  brokenDay = null,
  skipDay = null,
  truncateDay = null,
  cloud = true,
  cloudSkip = null,
  sizeShrinkDay = null,
  databases = ['ihui_dev'],
  extraDb = null,
  extraDbDays = null,
  extraSize = 300,
  cloudExtraSkip = null,
  runnerText: runner = null,
} = {}) {
  const dir = mkScratch('pg-cadence-test')
  const backup = join(dir, 'pg')
  const cloudDir = join(dir, 'cloud')
  mkdirSync(backup, { recursive: true })
  mkdirSync(cloudDir, { recursive: true })
  const window = Array.from({ length: days }, (_, i) => A.shiftYmd(TODAY, -(days - 1 - i)))
  const mainDb = (Array.isArray(databases) ? databases : ['ihui_dev'])[0] || 'ihui_dev'
  const write = (db, ymd, size, hms = '030003', magic = 'PGDMP') => {
    const name = `${db}_${ymd}_${hms}.dump`
    const buf = Buffer.concat([Buffer.from(magic, 'latin1'), Buffer.alloc(size)])
    writeFileSync(join(backup, name), buf)
    if (cloud && ymd !== cloudSkip && !(db === extraDb && ymd === cloudExtraSkip)) writeFileSync(join(cloudDir, name), buf)
    return name
  }
  for (const ymd of window) {
    if (ymd === skipDay) continue
    write(mainDb, ymd, ymd === sizeShrinkDay ? 400 : 9000)
    if (ymd === brokenDay) write(mainDb, ymd, 1200, '090000')
  }
  for (const ymd of extraDbDays || []) write(extraDb, ymd, extraSize)
  let execCandidates
  if (runner) {
    const p = join(dir, 'pg-backup.ps1')
    writeFileSync(p, runner)
    execCandidates = [p]
  }
  const seen = []
  const run = (argv) => {
    seen.push(argv.at(-1))
    const base = argv.at(-1).split(/[\\/]/).pop()
    const ymd = /^.+_(\d{8})_(\d{6})\.dump$/.exec(base)?.[1]
    const bad = ymd === truncateDay
    return { rc: bad ? 1 : 0, stdout: bad ? '' : TOC_OK, stderr: bad ? 'pg_restore: error: could not read TOC' : '' }
  }
  return {
    cleanup: () => rmScratch(dir),
    deps: {
      backupDir: backup,
      cloudDir: cloud ? cloudDir : '',
      scheduleHour: 3,
      ymd: TODAY,
      now: new Date('2026-09-27T12:00:00'),
      binExists: true,
      bins: { pgRestore: join(dir, 'pg_restore.exe') },
      run,
      ...(databases === 'omit' ? {} : { databases }),
      ...(execCandidates ? { execCandidates } : {}),
    },
    window,
    seen,
    name: (db, ymd, hms = '030003') => `${db}_${ymd}_${hms}.dump`,
  }
}
const cli = (extra = {}) => ({ ...A.parseCliArgs([]), ...extra })

test('端到端:三天齐全且完整 ⇒ verdict=ok、exit 0,且真的派生了 pg_restore -l(不是没跑)', () => {
  const t = makeFixture({ days: 3 })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  assert.equal(r.verdict, 'ok', JSON.stringify(r.findings))
  assert.equal(r.exitCode, 0)
  assert.equal(r.dayRows.length, 3)
  assert.equal(r.dayRows.every((d) => d.status === 'ok'), true)
  assert.equal(t.seen.length, 3, '每份 dump 都必须真跑一次 TOC 解析 —— 否则绿灯只是没看过')
  assert.equal(r.findings.length, 0)
  t.cleanup()
})

test('端到端·阳性对照:同一套夹具把一天改成 TOC 解析失败 ⇒ 结论必须从 ok 翻成 broken', () => {
  const good = makeFixture({ days: 3 })
  assert.equal(A.buildReport({ cli: cli({ days: 3 }), deps: good.deps }).verdict, 'ok')
  good.cleanup()

  const bad = makeFixture({ days: 3, truncateDay: '20260926' })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: bad.deps })
  assert.equal(r.verdict, 'broken', '判据若看不见截断,上一条 ok 就是假绿')
  assert.equal(r.exitCode, 1)
  const day = r.dayRows.find((d) => d.ymd === '20260926')
  assert.equal(day.status, 'TRUNCATED')
  assert.match(A.renderHuman(r), /▶ 结论: broken/)
  bad.cleanup()
})

test('端到端:窗口内某日整日无文件 ⇒ MISSING + broken + exit 1', () => {
  const t = makeFixture({ days: 3, skipDay: '20260926' })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  assert.equal(r.dayRows.find((d) => d.ymd === '20260926').status, 'MISSING')
  assert.equal(r.verdict, 'broken')
  assert.ok(r.findings.some((x) => x.code === 'MISSING'))
  assert.equal(r.exitCode, 1)
  t.cleanup()
})

test('端到端·⑤ 窗口外的缺席不进结论(把 --days 收窄后同一目录不得凭空多出 MISSING)', () => {
  const t = makeFixture({ days: 5 })
  const wide = A.buildReport({ cli: cli({ days: 5 }), deps: t.deps })
  assert.equal(wide.verdict, 'ok', JSON.stringify(wide.findings))
  // 只审最近 3 天:更早那两天连"缺席"这一维都不该被问
  const narrow = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  assert.equal(narrow.dayRows.length, 3)
  assert.equal(narrow.dayRows.some((d) => d.status === 'MISSING'), false)
  t.cleanup()
})

test('端到端:缺 pg_restore ⇒ 全部未判定,结论 undetermined(默认 exit 2 / --strict 1),绝不记为 ok', () => {
  const t = makeFixture({ days: 3 })
  const deps = { ...t.deps, binExists: false }
  const r = A.buildReport({ cli: cli({ days: 3 }), deps })
  assert.equal(r.verdict, 'undetermined')
  assert.equal(r.exitCode, 2)
  assert.equal(r.files.every((x) => x.verdict === 'undetermined'), true)
  const strict = A.buildReport({ cli: cli({ days: 3, strict: true }), deps })
  assert.equal(strict.exitCode, 1)
  assert.match(strict.binariesMissingNote, /找不到 pg_restore/)
  assert.match(r.files[0].reasons.join(' '), /pg_restore 不在位/, '逐文件也要写明为什么判不出,不得只留一个 verdict 词')
  t.cleanup()
})

test('端到端:备份目录不可读 ⇒ 致命"无法判定",不是一份空报告', () => {
  const t = makeFixture({ days: 2 })
  const r = A.buildReport({ cli: cli({ days: 2 }), deps: { ...t.deps, backupDir: join(t.deps.backupDir, 'nope-not-here') } })
  assert.equal(r.verdict, 'undetermined')
  assert.equal(r.fatal.code, 'NO_DIR')
  assert.equal(r.exitCode, 2)
  assert.match(A.renderHuman(r), /无法判定/)
  t.cleanup()
})

test('端到端:本地有而云同步目录没有 ⇒ CLOUD_COPY_ABSENT,且云腿的未判定措辞不得被省略', () => {
  const t = makeFixture({ days: 3, cloudSkip: '20260926' })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  const cloud = r.findings.filter((x) => x.code === 'CLOUD_COPY_ABSENT')
  assert.equal(cloud.length, 1, `夹具里刻意让 20260926 不进云目录:${JSON.stringify(r.findings)}`)
  assert.equal(cloud[0].day, '20260926')
  assert.equal(r.verdict, 'degraded')
  assert.equal(r.exitCode, 0, '默认档只点名;问责走 --strict')
  assert.equal(A.buildReport({ cli: cli({ days: 3, strict: true }), deps: t.deps }).exitCode, 1)
  assert.match(r.cloud.note, /未判定/)
  t.cleanup()
})

test('端到端:云目录读不到 ⇒ 该腿判"未判定",不得静默当成没有这条腿', () => {
  const t = makeFixture({ days: 3 })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: { ...t.deps, cloudDir: join(t.deps.backupDir, 'cloud-missing') } })
  assert.equal(r.cloud.state, 'undetermined')
  assert.match(r.cloud.note, /未判定/)
  assert.equal(r.verdict, 'undetermined', '一整条腿没看着,结论就不能是 ok')
  t.cleanup()
})

test('端到端:同日多份且第二份骤缩 ⇒ INTRA_DAY_SHRINK 被点名', () => {
  const t = makeFixture({ days: 3, brokenDay: WINDOW[WINDOW.length - 2] })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  const f2 = r.files.find((x) => x.name === dumpName(WINDOW[WINDOW.length - 2], '090000'))
  assert.ok(f2, '夹具的第二份要在清单里')
  assert.ok(r.findings.some((x) => x.code === 'INTRA_DAY_SHRINK'), r.findings.map((x) => x.code).join(','))
  t.cleanup()
})

test('人读报告不得出现 [object / undefined 之类没装配好的占位', () => {
  const t = makeFixture({ days: 3 })
  const text = A.renderHuman(A.buildReport({ cli: cli({ days: 3 }), deps: t.deps }))
  assert.doesNotMatch(text, /\[object|undefined|null/, text.slice(0, 400))
  assert.match(text, /窗口: 最近 3 天/)
  assert.match(text, /天数出处/)
  t.cleanup()
})

test('反向锁:报告里的 findings 与结论同源,不得一处说没事另一处说坏了', () => {
  const t = makeFixture({ days: 3, truncateDay: '20260925' })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  assert.ok(r.findings.length > 0)
  assert.notEqual(r.verdict, 'ok')
  assert.equal(r.reasons.length > 0, true)
  t.cleanup()
})

// ──────────────────── 端到端:⑦⑧⑨ 三个缺陷各自的有牙证明 ────────────────────

test('端到端⑦·反例:fixture runner 里没有 $backupDatabases 行 ⇒ 未判定,绝不静默 ok', () => {
  const t = makeFixture({ days: 3, databases: 'omit', runnerText: runnerText({ withList: false }) })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  assert.equal(r.databasesParsed, false)
  assert.equal(r.verdict, 'undetermined', JSON.stringify(r.findings))
  assert.ok(r.findings.some((x) => x.code === 'BACKUP_LIST_UNDETERMINED'), '这一句必须进 findings,不只是打印一行提示')
  assert.equal(r.exitCode, 2)
  assert.equal(A.buildReport({ cli: cli({ days: 3, strict: true }), deps: t.deps }).exitCode, 1, '--strict 下 undetermined 归 1,但原判读仍写 undetermined')
  assert.match(r.databasesNote, /未判定:备份清单无从解析/)
  assert.match(A.renderHuman(r), /未判定:备份清单无从解析/)
  // **不许退回单库**:审计面直接为空,一个库都不审
  assert.deepEqual(r.databases, [], '解析不出 ⇒ 空面,而不是偷偷填一台库')
  assert.equal(r.databasesAudited, 0)
  assert.equal(r.byDatabase.length, 0)
  assert.deepEqual(r.dayRows.map((d) => d.status), ['UNAUDITED', 'UNAUDITED', 'UNAUDITED'], '没看着的日子不得被 worstStatus([])="ok" 冒充成"齐了"')
  assert.ok(!r.dayRows.some((d) => d.status === 'ok'), '逐日表里出现一个 ok 就等于给未审的面发了合格证')
  assert.ok(!r.findings.some((x) => x.code === 'MISSING'), '面都没定,谈什么缺席?MISSING 只能是假结论')
  // 目录里真有的档必须报名(不能因为"没审"就静默消失)
  const obs = r.observations.join('\n')
  assert.match(obs, /目录里 3 个长得像备份档的文件全部未参与判定/, '报名要带数量,不能只说"这些"')
  assert.match(obs, new RegExp(`${MAIN}_20260927_030003\\.dump`), '报名要点名到文件')
  const text = A.renderHuman(r)
  assert.match(text, /一个都没有/, '人读报告也要说清"没有可审的库"')
  assert.match(text, /UNAUDITED/)
  t.cleanup()
})

test('反向锁(G-297 正身):源码里不得再出现"默认库名"这种形态 —— 静默缩面的载体', () => {
  // 判据的对象是**真实文件的形态**(§22c),不是夹具:把兜底库名加回源码即红。
  const src = readFileSync(new URL('../pg-backup-cadence-audit.mjs', import.meta.url), 'utf8')
  // 剥掉注释与字符串再找,免得把"解释这条禁令的注释"读成违规(本仓同型:门给自己发合格证)
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""')
  assert.doesNotMatch(code, /LEGACY_CHAIN_DB/, '兜底库名的标识符不得回来')
  assert.doesNotMatch(code, /\bDEFAULT_DB\b|\bfallbackDb\b/i, '换个名字的默认库同样是默认库')
  // normalizeDatabases 的函数体里不得出现任何字面库名(空进空出,由上一条单元锁钉住)
  const fn = /function normalizeDatabases\([\s\S]*?\n\}/.exec(code)
  assert.ok(fn, 'normalizeDatabases 必须还在(判据没有旁路出口)')
  assert.doesNotMatch(fn[0], /[A-Za-z][A-Za-z0-9]*_(dev|db|database)\b/i, '归一函数不得凭空长出一个库名')
})

test('反向锁:注入空清单也不等于"全都齐了"—— 一律按未判定处理', () => {
  const t = makeFixture({ days: 3, databases: [] })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  assert.equal(r.databasesParsed, false)
  assert.equal(r.verdict, 'undetermined', JSON.stringify(r.findings))
  assert.ok(r.findings.some((x) => x.code === 'BACKUP_LIST_UNDETERMINED'))
  assert.match(r.findings.find((x) => x.code === 'BACKUP_LIST_UNDETERMINED').text, /空清单/)
  t.cleanup()
})

test('端到端⑦·A/B:同一套夹具唯一差别是有没有那一行 ⇒ 另一臂的结论换成"这个库真没档",不再是"清单读不出"', () => {
  const t = makeFixture({ days: 3, databases: 'omit', runnerText: runnerText({ withList: true }) })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  assert.equal(r.databasesParsed, true)
  assert.deepEqual(r.databases, ['ihui_dev', 'keycloak'], '清单必须来自 fixture runner 原文,不是本工具写死')
  assert.match(r.databasesSource, /pg-backup\.ps1:\$backupDatabases/, '报告要点名读的是哪一份文件')
  assert.ok(!r.findings.some((x) => x.code === 'BACKUP_LIST_UNDETERMINED'), '清单解析出来了就不该再喊解析不出')
  // runner 声明要备 keycloak,而目录里一份都没有 ⇒ 这是真缺失(broken),不是"还没开始备"
  const kc = r.byDatabase.find((d) => d.db === 'keycloak')
  assert.equal(kc.startMode, 'NO_FILE')
  assert.equal(r.verdict, 'broken')
  assert.ok(r.findings.some((x) => x.code === 'MISSING' && x.db === 'keycloak'), JSON.stringify(r.findings))
  t.cleanup()
})

test('端到端⑨:keycloak 自其第一份档起判,更早的日子记 PRE_START(既不算缺席也不算齐)', () => {
  const t = makeFixture({ days: 4, databases: ['ihui_dev', 'keycloak'], extraDb: 'keycloak', extraDbDays: ['20260926', '20260927'] })
  const r = A.buildReport({ cli: cli({ days: 4 }), deps: t.deps })
  const kc = r.byDatabase.find((d) => d.db === 'keycloak')
  assert.equal(kc.startYmd, '20260926')
  assert.equal(kc.startMode, 'DERIVED')
  assert.deepEqual(kc.dayRows.map((x) => `${x.ymd}:${x.status}`), ['20260924:PRE_START', '20260925:PRE_START', '20260926:ok', '20260927:ok'])
  assert.equal(r.verdict, 'ok', '两库各自起判之后都齐 ⇒ 不得因为 keycloak 头两天"还没有它"而报 broken(那正是追溯性假红)')
  assert.match(A.renderHuman(r), /库 keycloak —— 起判日 20260926/, '起判日必须写进报告,不能留给读的人自己推断')
  t.cleanup()
})

test('端到端⑨·有牙:起判日之后缺一天 ⇒ 该库 MISSING,且当天汇总不得被另一库的 ok 盖掉', () => {
  const t = makeFixture({ days: 4, databases: ['ihui_dev', 'keycloak'], extraDb: 'keycloak', extraDbDays: ['20260925', '20260927'] })
  const r = A.buildReport({ cli: cli({ days: 4 }), deps: t.deps })
  const kc = r.byDatabase.find((d) => d.db === 'keycloak')
  assert.equal(kc.startYmd, '20260925')
  assert.deepEqual(Object.fromEntries(kc.dayRows.map((x) => [x.ymd, x.status])), { '20260924': 'PRE_START', '20260925': 'ok', '20260926': 'MISSING', '20260927': 'ok' })
  const ihui = r.byDatabase.find((d) => d.db === 'ihui_dev')
  assert.equal(ihui.dayRows.every((x) => x.status === 'ok'), true, '对照:大库那一条腿这四天本来就齐')
  const roll = r.dayRows.find((d) => d.ymd === '20260926')
  assert.equal(roll.status, 'MISSING')
  assert.deepEqual(roll.perDatabase.map((x) => `${x.db}=${x.status}`).sort(), ['ihui_dev=ok', 'keycloak=MISSING'], '汇总要能看出是哪一库坏的')
  assert.equal(r.verdict, 'broken')
  t.cleanup()
})

test('端到端⑧:小库(300 B)不得被大库(9 KB)的中位数判成骤缩 —— 统计按库分开', () => {
  const t = makeFixture({ days: 4, databases: ['ihui_dev', 'keycloak'], extraDb: 'keycloak', extraDbDays: ['20260924', '20260925', '20260926', '20260927'], extraSize: 300 })
  const r = A.buildReport({ cli: cli({ days: 4 }), deps: t.deps })
  assert.equal(r.findings.filter((x) => x.code === 'SIZE_SHRINK').length, 0, `按库分开后不该有任何骤缩:${JSON.stringify(r.findings)}`)
  assert.equal(r.verdict, 'ok', '两库四天天天齐、各自大小稳定 ⇒ 差两个数量级不是故障')
  // 阳性对照:同样量级的大小差塞进**同一个库**的序列 ⇒ 必须命中,否则上面那条"没红"只是判据没在看
  const mixed = makeFixture({ days: 4, sizeShrinkDay: '20260926' })
  const rm = A.buildReport({ cli: cli({ days: 4 }), deps: mixed.deps })
  assert.ok(rm.findings.some((x) => x.code === 'SIZE_SHRINK'), JSON.stringify(rm.findings))
  mixed.cleanup()
  t.cleanup()
})

test('端到端·G-297 主案·正例:两个库(9 KB + 300 B)里小库缺一天 ⇒ 点名小库,大库齐不得顶成满分', () => {
  // 这正是修掉的那一型:keycloak 曾被判 unrelated,于是"某天一份都没有"在账面上是 ok
  const t = makeFixture({
    days: 4,
    databases: ['ihui_dev', 'keycloak'],
    extraDb: 'keycloak',
    extraDbDays: ['20260924', '20260925', /* 缺 20260926 */ '20260927'],
    extraSize: 300,
  })
  const r = A.buildReport({ cli: cli({ days: 4 }), deps: t.deps })
  const miss = r.findings.filter((x) => x.code === 'MISSING')
  assert.equal(miss.length, 1, JSON.stringify(r.findings))
  assert.equal(miss[0].db, 'keycloak', '缺席必须归属到缺的那一库')
  const kc = r.byDatabase.find((d) => d.db === 'keycloak')
  assert.deepEqual(
    Object.fromEntries(kc.dayRows.map((x) => [x.ymd, x.status])),
    { '20260924': 'ok', '20260925': 'ok', '20260926': 'MISSING', '20260927': 'ok' },
    '缺的正是那一天,且前后照常 ok(不是整库被判坏)',
  )
  assert.equal(r.verdict, 'broken', '另一库天天齐 ⇒ 绝不能记 ok')
  assert.notEqual(r.exitCode, 0)
  const ihui = r.byDatabase.find((d) => d.db === 'ihui_dev')
  assert.deepEqual(ihui.dayRows.map((x) => x.status), ['ok', 'ok', 'ok', 'ok'], '对照:大库这一条腿本来就没问题')
  // 大小差两个数量级也不得顺手把小库自己那条序列判成骤缩(它四天都是 300 B)
  assert.equal(r.findings.filter((x) => x.code === 'SIZE_SHRINK').length, 0, JSON.stringify(r.findings))
  assert.match(A.renderHuman(r), /keycloak 20260926 保留窗口内无任何 dump/, '人读报告要点名到库 + 日')
  const strict = A.buildReport({ cli: cli({ days: 4, strict: true }), deps: t.deps })
  assert.equal(strict.exitCode, 1)
  assert.equal(strict.verdict, 'broken', '--strict 只改退出码,不改判读')
  t.cleanup()
})

test('端到端:量不到的格子必须点名 —— 表数 / 骤缩各自的"未判定"不得静默', () => {
  // 20260926 那一份 TOC 解析失败 ⇒ 表数量不到;20260925 整天无档 ⇒ 代表档大小量不到、骤缩也判不出
  const t = makeFixture({ days: 4, truncateDay: '20260926', skipDay: '20260925' })
  const r = A.buildReport({ cli: cli({ days: 4 }), deps: t.deps })
  const obs = r.observations.join('\n')
  assert.match(obs, /TABLE DATA 条数在 2 个日子量不到:/, JSON.stringify(r.observations))
  assert.match(obs, /20260926\(TOC 未判\)/, '量不到的原因要点名,不能只给一个数')
  assert.match(obs, /20260925\(当日无代表档\)/)
  assert.match(obs, /骤缩规则在 1 个日子判不出:20260925\(代表文件量不到大小\)/)
  assert.match(obs, /不算通过/)
  assert.ok(r.findings.some((x) => x.code === 'MISSING' && x.db === 'ihui_dev'), '跳过的那天仍要判缺席 —— 点名未判定不等于放过缺失')
  const d = r.dayRows.find((x) => x.ymd === '20260926')
  assert.notEqual(d.status, 'ok', '量不到的那一天不得被算成通过')
  t.cleanup()
})

test('--self-test 是一条真出路,不是一枚冒充"已验证"的空开关', () => {
  // 它刻意不在本进程跑判据(判据要注入假 pg_restore 与临时目录,那都在镜像测试里)
  const r = A.main(['--self-test'])
  assert.equal(r.code, 0)
  assert.match(r.out.help, /node --test scripts\/tests\/pg-backup-cadence-audit\.test\.mjs/, '打印的必须是能真跑通的那条命令')
  assert.match(r.out.help, /不构成"已验证"/, '这一枚 0 不得被读成合格证')
  assert.ok(!r.out.verdict, '自测档不得顺手产出一份审计结论')
})

test('端到端:--json 的输出必须真能被 JSON.parse(且与 --strict 差的是退出码不是判读)', () => {
  const t = makeFixture({ days: 3, cloudSkip: '20260926' })
  const plain = A.main(['--json', '--days', '3'], t.deps)
  assert.equal(plain.json, true, 'json 标志要随返回值出去,否则 --json 形同没实现')
  const parsed = JSON.parse(JSON.stringify(plain.out))
  assert.equal(parsed.days, 3)
  assert.deepEqual(parsed.databases, ['ihui_dev'], '审计面必须在 json 里也如实给出')
  assert.equal(parsed.verdict, 'degraded')
  assert.equal(parsed.exitCode, 0, '默认档:degraded 只点名')
  const strict = A.main(['--json', '--days', '3', '--strict'], t.deps)
  const sp = JSON.parse(JSON.stringify(strict.out))
  assert.equal(sp.exitCode, 1)
  assert.equal(sp.verdict, parsed.verdict, '--strict 不得改判读,只改退出码')
  assert.deepEqual(sp.reasons, parsed.reasons)
  t.cleanup()
})

test('端到端:云腿也逐库 —— 小库没同步到云盘,不得被大库那一份"有"遮住', () => {
  const t = makeFixture({ days: 3, databases: ['ihui_dev', 'keycloak'], extraDb: 'keycloak', extraDbDays: ['20260925', '20260926', '20260927'], cloudExtraSkip: '20260926' })
  const r = A.buildReport({ cli: cli({ days: 3 }), deps: t.deps })
  const cf = r.findings.filter((x) => x.code === 'CLOUD_COPY_ABSENT')
  assert.equal(cf.length, 1, JSON.stringify(r.findings))
  assert.equal(cf[0].db, 'keycloak')
  assert.equal(cf[0].day, '20260926')
  assert.equal(r.verdict, 'degraded')
  const today = r.cloud.perDay.find((p) => p.ymd === '20260927')
  assert.equal(today.byDatabase.find((b) => b.db === 'keycloak').present, true, '云识别式必须也认小库的命名 —— 否则它每天都"缺",那是假红不是覆盖')
  t.cleanup()
})

test('反向锁:旁族(dash)档只替它自己那个库作证', () => {
  const dir = mkScratch('pg-cadence-foreign')
  const backup = join(dir, 'pg')
  const cloud = join(dir, 'cloud')
  mkdirSync(backup, { recursive: true })
  mkdirSync(cloud, { recursive: true })
  const win = ['20260925', '20260926', '20260927']
  for (const ymd of win) {
    const n = `ihui_dev_${ymd}_030003.dump`
    writeFileSync(join(backup, n), Buffer.concat([Buffer.from('PGDMP', 'latin1'), Buffer.alloc(9000)]))
    writeFileSync(join(cloud, n), Buffer.alloc(9005))
  }
  writeFileSync(join(backup, 'keycloak-20260927-073532.dump'), Buffer.alloc(500))
  const run = () => ({ rc: 0, stdout: TOC_OK, stderr: '' })
  const r = A.buildReport({
    cli: cli({ days: 3 }),
    deps: { backupDir: backup, cloudDir: cloud, databases: ['ihui_dev', 'keycloak'], scheduleHour: 3, ymd: TODAY, now: new Date('2026-09-27T12:00:00'), binExists: true, bins: { pgRestore: join(dir, 'pg_restore.exe') }, run },
  })
  const kc = r.byDatabase.find((d) => d.db === 'keycloak')
  assert.equal(kc.startYmd, '20260927', '起判日派生自"该库有任何实存档",旁族也算它存在过')
  assert.equal(kc.dayRows.find((x) => x.ymd === '20260927').status, 'FOREIGN_ONLY')
  const ihui = r.byDatabase.find((d) => d.db === 'ihui_dev')
  assert.equal(ihui.dayRows.every((x) => x.status === 'ok'), true, 'keycloak 只有旁族命名,不得反过来把 ihui_dev 的日子也搅浑')
  assert.equal(r.verdict, 'degraded', '数据在、只是不来自每晚那条链 ⇒ 点名,但不是 MISSING')
  rmScratch(dir)
})

// ─────────── 落点反向锁(§15b):盘根只许有一个出口,本模块不得再自己推导 ───────────
// 判据对象是**真实源文件的形态**(§22c),不是夹具:把旧写法放回源码即红。
// 遮噪只遮**注释**、保留字符串 —— 要禁的那两型("仓根上跳两级"、"字面量 DevEnv")
// 恰恰活在字符串里,连字符串一起抹会让本锁对立项要防的形态全盲(与本仓多处"遮噪方向
// 不同"的教训同族:判据问什么,就只许抹掉问不到的那一层)。
test("落点反向锁:私有数层推导不得回来,必须真的 import 共用出口 devEnvRoot()", () => {
  const src = readFileSync(new URL('../pg-backup-cadence-audit.mjs', import.meta.url), 'utf8')
  const code = maskComments(src)
  assert.doesNotMatch(code, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/, '不得再出现"仓根上跳两级"那一份盘根推导(工作树落在夹具里时它会把落点带进夹具)')
  assert.doesNotMatch(code, /['"]\\{0,2}DevEnv['"]/, '不得再出现 DevEnv 字面量档位 —— 它住在共用出口里')
  assert.doesNotMatch(code, /slice\(\s*0\s*,\s*1\s*\)/, '不得再用截盘符首字符那一份实现(同一件事不得有两个答案)')
  assert.doesNotMatch(code, /function\s+devEnvRoot\s*\(/, '本模块不得再声明私有 devEnvRoot —— 落点只许有一个出口')
  assert.match(
    code,
    /import\s*\{[^}]*\bdevEnvRoot\b[^}]*\}\s*from\s*'\.\/seal-c-root-stray\.mjs'/,
    '必须真的 import 共用出口(§22c 装车证明:只写注释不接线,等于这句话是假的)',
  )
  // 环境变量覆盖名是本工具的契约,共用出口不得把它们挤掉(IHUI_DEVENV_ROOT 只是第三档兜底)
  assert.match(code, /process\.env\.IHUI_PG_BIN_DIR\s*\|\|/, 'IHUI_PG_BIN_DIR 必须仍优先于任何推导')
  assert.match(code, /process\.env\.IHUI_BACKUP_PG_DIR\s*\|\|/, 'IHUI_BACKUP_PG_DIR 必须仍优先于任何推导')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as A } from '../pg-backup-cadence-audit.mjs'

const TODAY = '20260927'
const WINDOW = A.enumerateWindow(TODAY, 7)

/** 构造"文件"记录(纯数据,决策层只吃这些) */
function f(name, over = {}) {
  const cls = A.classifyFileName(name)
  return { name, family: cls.family, ymd: cls.ymd, hms: cls.hms, stamp: (cls.ymd || '') + (cls.hms || ''), size: 90_000_000, verdict: 'complete', reasons: [], ...over }
}
const dumpName = (ymd, hms = '030003') => `ihui_dev_${ymd}_${hms}.dump`

// ──────────────────────────── ① 命名族识别 ────────────────────────────

test('家族分类:下划线族=每晚链、连字符族=旁生产者、.sql.gz=旧形态、其余不相关', () => {
  assert.equal(A.classifyFileName(dumpName('20260927', '030003')).family, 'dump')
  assert.equal(A.classifyFileName('ihui-dev-20260924-073532.dump').family, 'dump-foreign')
  assert.equal(A.classifyFileName('ihui_dev-20260906-065559.sql.gz').family, 'sqlgz')
  assert.equal(A.classifyFileName('backup.log').family, 'unrelated')
  assert.equal(A.classifyFileName('pg_hba.conf.pre-admin-20260925-031645').family, 'unrelated')
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

test('延迟落盘 ⇒ LATE_LAND(degraded),它不是 MISSING 但必须被看见', () => {
  const d = A.judgeDay({ ymd: '20260926', files: [f(dumpName('20260926', '113000'))], window: WINDOW, todayStr: TODAY, nowHour: 12, schedHour: 3 })
  assert.equal(d.status, 'ok', '文件在且完整 —— 日状态与"是否在点"是两个维度,不得混成一个')
  assert.ok(d.findings.some((x) => x.code === 'LATE_LAND'))
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

function makeFixture({ days = 3, brokenDay = null, skipDay = null, truncateDay = null, cloud = true, cloudSkip = null, sizeShrinkDay = null } = {}) {
  const dir = mkScratch('pg-cadence-test')
  const backup = join(dir, 'pg')
  const cloudDir = join(dir, 'cloud')
  mkdirSync(backup, { recursive: true })
  mkdirSync(cloudDir, { recursive: true })
  const window = Array.from({ length: days }, (_, i) => A.shiftYmd(TODAY, -(days - 1 - i)))
  for (const ymd of window) {
    if (ymd === skipDay) continue
    const size = ymd === sizeShrinkDay ? 400 : 9000
    const buf = Buffer.concat([Buffer.from(ymd === truncateDay ? 'XXXXX' : 'PGDMP', 'latin1'), Buffer.alloc(size)])
    writeFileSync(join(backup, dumpName(ymd)), buf)
    if (ymd === brokenDay) writeFileSync(join(backup, dumpName(ymd, '090000')), Buffer.concat([Buffer.from('PGDMP', 'latin1'), Buffer.alloc(1200)]))
    if (cloud && ymd !== cloudSkip) writeFileSync(join(cloudDir, dumpName(ymd)), buf)
  }
  const seen = []
  const run = (argv) => {
    seen.push(argv.at(-1))
    const base = argv.at(-1).split(/[\\/]/).pop()
    const ymd = /^ihui_dev_(\d{8})_/.exec(base)?.[1]
    return { rc: ymd === truncateDay ? 1 : 0, stdout: TOC_OK, stderr: ymd === truncateDay ? 'pg_restore: error: could not read TOC' : '' }
  }
  return {
    cleanup: () => rmScratch(dir),
    deps: { backupDir: backup, cloudDir: cloud ? cloudDir : '', scheduleHour: 3, ymd: TODAY, now: new Date('2026-09-27T12:00:00'), binExists: true, bins: { pgRestore: join(dir, 'pg_restore.exe') }, run },
    window,
    seen,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815927 的 §22c 镜像测试。
 *
 * 为什么这里有几条**纯文本形状锁**(而不是全部交给真库跑):
 *  ① 本仓的离线迁移判据(守门 49 B1-B5)只核 journal 与 .sql 的结构,核不出 PL/pgSQL 的语法错。
 *     实测第一版写的是 RAISE EXCEPTION 'a' || 'b', n; —— PG 直接报 syntax error at or near "||",
 *     而离线档一路 rc=0。**一枚从没被真跑过的迁移与一枚能用的迁移,在账面上长得一模一样**,
 *     所以这一型必须有一把不需要 PG 也永远会响的锁(T1)。
 *  ② 键的选择是这张票最容易写错的地方:台账标题写的是 (platform, platform_message_id),
 *     而那个形状会把「同一条消息的出站回执 vs 入站镜像」与「两个用户各自绑定同一租户」这两种
 *     **合法行**判成重复,症状是 webhook 收得到而库里落不下。真库的正反对照在行为验证器里
 *     (probe 的 ③/⑥),这里再加一条文本锁,保证没有 PG 的机器上也拦得住"顺手把键改窄"(T3)。
 *  ③ "没跑到"与"跑过了"必须可分:readDsn 的三态用构造输入证明(T5),不等真库。
 *  ④ §22d:被 import 时不得跑真库(T6)—— 否则 node --test 一 import 就建库删库。
 *
 * 写这份测试时它自己咬到的两条(留在这里,免得下一个人重踩):
 *  · 判"某关键字有没有出现在代码里"**必须先在注释面上判** —— 本文件头注与 probe 头注都逐字写着
 *    生产端口那两个数字(§5 铁律的说明),不遮注释直接 grep 会把自己的说明当成违规
 *    (守门 131/70 同型);
 *  · 取 CREATE UNIQUE INDEX 不能 indexOf —— 头注里就有一句"CREATE UNIQUE INDEX 会当场失败",
 *    于是 T2/T3 第一版量到的是散文的位置与散文的括号(症状是"顺序反了""列名奇怪",
 *    而真相是尺子读错了行)。现一律按**语句锚点**取(行首 + 多行旗标)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as probe } from '../../packages/database/scripts/im-messages-unique-index-probe.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const PROBE_PATH = join(ROOT, 'packages', 'database', 'scripts', 'im-messages-unique-index-probe.mjs')
const MIG_PATH = join(ROOT, 'packages', 'database', 'drizzle', '20261002033500_im_messages_platform_msg_unique.sql')
const JOURNAL_PATH = join(ROOT, 'packages', 'database', 'drizzle', 'meta', '_journal.json')
const mig = readFileSync(MIG_PATH, 'utf8')
const probeSrc = readFileSync(PROBE_PATH, 'utf8')

/** 只取**语句级**的 CREATE UNIQUE INDEX(跳过头注里那句散文)。 */
function createIndexStmt(text) {
  const m = text.match(/^CREATE UNIQUE INDEX[\s\S]*?;$/m)
  assert.ok(m, '迁移里必须有一条以行首开始的 CREATE UNIQUE INDEX 语句')
  return m[0]
}

test('T1 RAISE 的格式位必须是单个 % 占位(离线判据看不见 PL/pgSQL 的拼接语法错)', () => {
  const line = mig
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /^RAISE EXCEPTION/.test(l))
  assert.ok(line, '迁移里必须有一处 RAISE EXCEPTION,否则"体检失败"就是静默通过')
  assert.match(line, /^RAISE EXCEPTION '%',\s*\w+;$/, '实得: ' + line)
  const brokenLine = "RAISE EXCEPTION '存在 % 组重复' || ' 需人工裁决', dup_groups;"
  assert.doesNotMatch(brokenLine, /^RAISE EXCEPTION '%',\s*\w+;$/, '当年那行坏写法必须被同一条判据点名')
})

test('T2 前置体检必须排在建索引语句之前(顺序反了就是"先建再查",等于没查)', () => {
  const stmt = createIndexStmt(mig)
  const at = mig.indexOf(stmt)
  const guard = mig.indexOf('IF dup_groups > 0')
  assert.ok(guard > 0 && guard < at, '体检=' + guard + ' 建索引语句=' + at)
  assert.ok(mig.slice(0, at).includes('DO $$'), '建索引之前的 DO 块必须在')
})

test('T3 唯一键必须是四列,不得退化成台账标题里那个两列简化形', () => {
  const stmt = createIndexStmt(mig)
  const raw = (stmt.match(/\(([^)]*)\)/) || [])[1]
  assert.ok(raw, '找不到列清单: ' + stmt.slice(0, 80))
  const cols = raw.split(',').map((c) => c.trim().replace(/"/g, ''))
  assert.deepEqual(cols, ['user_id', 'platform', 'direction', 'platform_message_id'])
  const narrow = 'CREATE UNIQUE INDEX "x" ON "im_messages" ("platform", "platform_message_id");'
  const narrowCols = (narrow.match(/\(([^)]*)\)/) || [])[1]
    .split(',')
    .map((c) => c.trim().replace(/"/g, ''))
  assert.notDeepEqual(narrowCols, cols, '判据必须能分辨四列与两列')
})

test('T4 journal tag 与 .sql 同 stem,idx 连续且本枚是末条', () => {
  const j = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'))
  const stem = '20261002033500_im_messages_platform_msg_unique'
  assert.ok(j.entries.some((e) => e.tag === stem), 'journal 必须登记这枚迁移')
  const idxs = j.entries.map((e) => e.idx)
  for (let i = 1; i < idxs.length; i++) assert.equal(idxs[i], idxs[i - 1] + 1, 'idx 必须逐条 +1,断在第 ' + i + ' 条')
  assert.equal(j.entries[j.entries.length - 1].tag, stem, '追加顺序不能插队(末条必须是本枚)')
})

test('T5 readDsn 三态:非开发库名 / 缺 DATABASE_URL 都是"未判定",不得被读成通过', () => {
  const wrong = probe.readDsn('DATABASE_URL=postgresql://u:p@127.0.0.1:5432/production_like\n')
  assert.equal(wrong.ok, false)
  assert.match(wrong.reason, /不是预期的 ihui/)
  const missing = probe.readDsn('# 没有这一行\n')
  assert.equal(missing.ok, false)
  assert.match(missing.reason, /DATABASE_URL/)
  const ok = probe.readDsn('DATABASE_URL=postgresql://u:p@127.0.0.1:5432/ihui\n')
  assert.equal(ok.ok, true)
  assert.match(ok.withDb('ihui_probe_x'), /\/ihui_probe_x$/, '换库名必须只换路径,凭据沿用')
})

test('T6 §22d:被 import 时 isDirectRun=false ⇒ 测试进程不会建库删库', () => {
  assert.equal(probe.isDirectRun, false, '本文件是 import 进来的,守卫必须判假')
  assert.equal(typeof probe.main, 'function')
})

test('T7 隔离纪律形状锁:临时库名带 probe 前缀、回收写在 finally 块内、代码面不引用生产端口', () => {
  assert.match(probeSrc, /DROP DATABASE IF EXISTS \$\{TMPDB\}/)
  const finallyAt = probeSrc.indexOf('} finally {')
  assert.ok(finallyAt > 0, '找不到 finally 块')
  assert.ok(finallyAt < probeSrc.lastIndexOf('DROP DATABASE IF EXISTS'), '回收必须在 finally 块内,不是只在注释里承诺')
  assert.equal(probe.TMPDB, 'ihui_g815927_probe')
  const codeFace = maskCommentsAndStrings(probeSrc)
  assert.ok(!/8810|8811/.test(codeFace), '生产端口出现在代码面就说明它打算直连生产(§5 铁律)')
  assert.notEqual(codeFace, probeSrc, '遮罩必须真的遮到了东西(否则这条断言恒真,和没写一样)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

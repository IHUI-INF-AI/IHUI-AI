// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 gb22「活文档被体积清偿压好后又被归并档原样拉回」—— **根因档**(`merge-live-doc.mjs` 两处取材面)的接线锁。
 *
 * 立因(2026-10-28 实测,不是推断):11:40 把 `AGENTS.md` 从 105115 压到 95336,被摘的正文逐字迁进
 * `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`;11:51:57 `auto-commit-quiet` 派生
 * `merge-live-doc --file AGENTS.md --apply`,把盘上那份 95336 顶回 **102352**。两处错位都在归并器自己:
 *   甲 归档件清单只取被审面(HEAD 树)⇒ §1 两步走的在飞窗口里(先写归档件、再压正文、最后一起入库)
 *     迁出批次只在盘上 ⇒ 凭据 0 份 ⇒ 判 lost ⇒ 插回;
 *   乙 `readArchivedForDoc` 的"本侧正文"传的是**旧 HEAD** ⇒ 那份旧正文按定义逐字含着刚被搬走的行,
 *     lib 的整篇复制件判别拿它一比就把迁出批次读成复制件(实测 overlap=0.515 ≥ 0.5)⇒ 补上磁盘清单也救不回。
 * 本文件钉住五格:
 *   T1 修后(甲、乙两臂各一次):迁出行当场不插回,而别人真新增的那一行(正向对照)照样插回 —— 归并职责没被关掉;
 *   T2 判据层对照:老基准认不出迁出批次、处置侧基准认得出(证明 T1 的结论来自这次改面,不是夹具本来就没行);
 *   T3 反控:处置侧取不到 ⇒ 磁盘面一律不取用,读数与改前逐字同形(判据不得反向变松);
 *   T4 反向变松哨兵:把**整篇复制件**摆上磁盘也不许成为凭据(否则别人真加回来的行会被"已归档"吞掉);
 *   T5 形状锁:复制件判据与磁盘枚举仍只在 lib 一份(§0.6/§22c)。
 *
 * §22c:判据全部 import 生产实现(`selectMovedOut` / `selectMovedOutForDisposition`),本文件不复制
 * 任何一条阈值或正则。夹具落 `mkScratch()`(§15b/§15c:仓库树内禁止 `git init`)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
// 被测判据的唯一来源 = 生产 lib(改前基准 selectMovedOut 与改后基准 selectMovedOutForDisposition 同处一份实现)
import { selectMovedOut, selectMovedOutForDisposition } from '../lib/live-doc-archive-drops.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GIT = 'git'
const ARCHIVE_REL = '.ihui-agent/archive'
// 夹具文件名一律 ASCII:被审面枚举走 `git ls-tree --name-only`,而 `core.quotePath` 默认把非 ASCII
// 路径转成八进制带引号形态 ⇒ 非 ASCII 名会让"面里有名字却读不到正文"这一档伪装成"没有归档件",
// 缺陷乙的对照就读不出真值(现读本机 git 配置所得,不当别机事实)。
const DISK_BATCH = `${ARCHIVE_REL}/AGENTS_trim-fixture-inflight.md`
const HEAD_BATCH = `${ARCHIVE_REL}/AGENTS_trim-fixture-committed.md`
const SNAPSHOT = `${ARCHIVE_REL}/AGENTS_full-pre-compact-fixture.md`

const HEADINGS = Array.from(
  { length: 10 },
  (_, i) => `# 第${i + 1}节 夹具章节正文,处置侧与 HEAD 都留着它,长度足够进入判定集合 zzz${i}`,
)
const KEEP_A = '- 甲:文档里一直在册的一行正文,长度足够避开短行过滤,任何一维都不该碰到它'
const KEEP_B = '- 乙:另一行一直在册的正文,同样够长,用来证明归档这一维不会连坐整篇文档'
const MOVED_1 =
  '- **迁出丙**(1):这一整行在清偿那一刻被逐字搬进 archive 的迁出批次,文档里只留指针注记'
const MOVED_2 = '- **迁出丁**(2):第二行迁出正文,搬走之后原位换成一行短指针,长度也避开短行过滤'
const XCONTROL =
  '- XCONTROL 别人本轮真新增的一行正文:不在任何归档批次里,归并必须照样补回,否则等于把归并关了'
const POINTER =
  '> 迁出批次逐字见 `.ihui-agent/archive/AGENTS_trim-fixture-inflight.md`(§1 整区迁出,原位留指针)'

/** HEAD = 未压版(含两行迁出正文 + 一行别人真新增);处置侧 = 压好版(摘掉两行迁出正文并留指针)。 */
const HEAD_DOC = [
  HEADINGS[0],
  KEEP_A,
  HEADINGS[1],
  MOVED_1,
  MOVED_2,
  HEADINGS[2],
  XCONTROL,
  KEEP_B,
  ...HEADINGS.slice(3),
].join('\n')
const COMPRESSED_DOC = [
  HEADINGS[0],
  KEEP_A,
  HEADINGS[1],
  POINTER,
  HEADINGS[2],
  KEEP_B,
  ...HEADINGS.slice(3),
].join('\n')
const BATCH_TEXT = [MOVED_1, MOVED_2].join('\n')

/**
 * @param {{diskBatch?:boolean, headBatch?:boolean, snapshot?:boolean, wt?:'compressed'|'head'|'empty'}} opts
 *   `diskBatch` = 迁出批次只在盘上(§1 两步走的在飞窗口);`headBatch` = 同批已入库;
 *   `snapshot` = 盘上还摆一份整篇复制件;`wt='empty'` = 处置侧正文取不到(反控用)。
 */
function seed({ diskBatch = true, headBatch = false, snapshot = false, wt = 'compressed' } = {}) {
  const dir = mkScratch('merge-live-doc-disposition-')
  const g = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1 << 28,
      // §12g:派生 git 必须显式接管 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const write = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text, 'utf8')
  }
  g('init', '-q', '--initial-branch=main')
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  g('config', 'core.autocrlf', 'false')
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  // 被测对象 = 仓库里那份 CLI(闭包按生产文件的 import 语句现算,测试里没有第二份清单)
  copyScriptWithClosure(join(REPO, 'scripts'), 'merge-live-doc.mjs', join(dir, 'scripts'))
  write('.gitignore', '.ihui-agent/tmp/\n')
  if (headBatch) write(HEAD_BATCH, BATCH_TEXT)
  write('AGENTS.md', HEAD_DOC)
  g('add', '-A')
  g('commit', '-qm', 'seed: HEAD = 未压版(两行迁出正文 + 一行别人真新增)')
  write('AGENTS.md', wt === 'compressed' ? COMPRESSED_DOC : wt === 'empty' ? '' : HEAD_DOC)
  if (diskBatch) write(DISK_BATCH, BATCH_TEXT)
  // 缺陷乙臂:批次只在**被审面**上、盘上没有这一份 ⇒ 唯一能变的就是"基准正文",把两维隔开测
  if (headBatch && !diskBatch) rmSync(join(dir, HEAD_BATCH))
  if (snapshot) write(SNAPSHOT, HEAD_DOC)
  const run = (extra = []) => {
    try {
      return {
        code: 0,
        out: execFileSync(
          process.execPath,
          [join(dir, 'scripts/merge-live-doc.mjs'), '--file', 'AGENTS.md', ...extra],
          {
            cwd: dir,
            encoding: 'utf8',
            windowsHide: true,
            timeout: 120000,
            maxBuffer: 1 << 28,
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        ),
      }
    } catch (e) {
      return { code: e.status ?? 1, out: String(e.stdout || '') + String(e.stderr || '') }
    }
  }
  const doc = () => readFileSync(join(dir, 'AGENTS.md'), 'utf8')
  /** 被审面(HEAD)上的归档件清单与正文 —— 与归并器同一取法,测试只把它喂给 lib 判据。 */
  const headFace = () =>
    g('ls-tree', '-r', '--name-only', 'HEAD', '--', ARCHIVE_REL)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => {
        let text = null
        try {
          text = g('show', `HEAD:${p}`)
        } catch {
          text = null // 面里有名字却读不到 ⇒ 该份不构成凭据(lib 逐份点名)
        }
        return { path: p, text }
      })
  return { dir, run, doc, headFace, write, g }
}

const num = (out, re) => Number(re.exec(out)?.[1] ?? -1)

/** 修后必须成立的四条,缺陷甲/缺陷乙两臂共用同一组断言(区别只在批次住在哪个面)。 */
function assertFixHolds(label, opts) {
  const { dir, run, doc } = seed(opts)
  try {
    const before = doc()
    assert.equal(before, COMPRESSED_DOC, `${label}:起点必须就是压好版(处置侧)`)
    const r = run(['--apply'])
    const after = doc()
    console.log(
      `  读数[${label}] 移入 archive=${num(r.out, /移入 archive\(不插回\)= (\d+)/)} 真丢失=${num(r.out, /真丢失\(需插回\)= (\d+)/)} 插入行=${num(r.out, /插入行=(\d+)/)} 字节 ${Buffer.byteLength(before)} → ${Buffer.byteLength(after)}`,
    )
    assert.equal(
      num(r.out, /移入 archive\(不插回\)= (\d+)/),
      2,
      `${label}:两行迁出正文须当场判"已按 §1 移入 archive"`,
    )
    assert.equal(num(r.out, /真丢失\(需插回\)= (\d+)/), 1, `${label}:除迁出行外只剩正向对照该补回`)
    assert.match(r.out, /已写回:段=1 插入行=1/, `${label}:插回动作必须只发生在正向对照那一行`)
    assert.ok(
      !after.includes(MOVED_1) && !after.includes(MOVED_2),
      `${label}:迁出行被插回 = 2026-10-28 现场复发`,
    )
    // 正向对照必须活着:归并的职责没被这次改动关掉
    assert.ok(after.includes(XCONTROL), `${label}:别人真新增的行没被补回 ⇒ 等于把归并关了`)
    assert.ok(after.includes(KEEP_A) && after.includes(KEEP_B), `${label}:在册正文一行不许少`)
    assert.ok(after.includes(POINTER), `${label}:处置侧自己写的指针注记不许被吃掉`)
    assert.equal(
      after.split('\n').length,
      COMPRESSED_DOC.split('\n').length + 1,
      `${label}:只该多进正向对照那一行`,
    )
  } finally {
    rmScratch(dir)
  }
}

test('T1 修后:迁出行当场不插回、正向对照照样补回(缺陷甲=批次只在盘上 / 缺陷乙=批次已入库但 HEAD 仍旧版)', () => {
  assertFixHolds('缺陷甲(盘上未入库)', { diskBatch: true, headBatch: false })
  assertFixHolds('缺陷乙(已入库+旧HEAD基准)', { diskBatch: false, headBatch: true })
})

test('T2 判据层对照:老基准认不出迁出批次,处置侧基准认得出(证明 T1 的结论来自这次改面)', () => {
  const inFlight = seed({ diskBatch: true, headBatch: false })
  const committed = seed({ diskBatch: false, headBatch: true })
  try {
    // 缺陷甲:清单只取被审面 ⇒ 盘上那一份压根不在射程
    const faceA = inFlight.headFace()
    assert.equal(faceA.length, 0, '夹具自证:缺陷甲臂的被审面上必须一份归档件都没有')
    const legacyA = selectMovedOut('AGENTS.md', faceA, HEAD_DOC)
    assert.ok(
      !legacyA.trimmed.has(MOVED_1.trim()),
      '对照组失效:老基准若已认得盘上批次,T1 证明不了任何事',
    )
    const fixedA = selectMovedOutForDisposition(inFlight.dir, 'AGENTS.md', faceA, COMPRESSED_DOC)
    assert.ok(fixedA.ok, `处置侧基准必须给出凭据:${fixedA.reason}`)
    assert.ok(
      fixedA.trimmed.has(MOVED_1.trim()) && fixedA.trimmed.has(MOVED_2.trim()),
      '处置侧基准认不出迁出批次 ⇒ 根因档只是口号',
    )
    // 缺陷乙:批次虽在被审面上,拿旧 HEAD 正文当基准就被读成整篇复制件
    const faceB = committed.headFace()
    assert.equal(faceB.length, 1, '夹具自证:缺陷乙臂的批次必须在被审面上')
    const legacyB = selectMovedOut('AGENTS.md', faceB, HEAD_DOC)
    assert.equal(legacyB.snapshots.length, 1, '缺陷乙自证:旧 HEAD 当基准 ⇒ 迁出批次被读成复制件')
    assert.ok(!legacyB.trimmed.has(MOVED_1.trim()), '缺陷乙自证:被读成复制件就没有一条凭据')
    const fixedB = selectMovedOutForDisposition(committed.dir, 'AGENTS.md', faceB, COMPRESSED_DOC)
    assert.equal(fixedB.snapshots.length, 0, '换基准后不得再把这一批判成复制件')
    assert.ok(
      fixedB.trimmed.has(MOVED_1.trim()) && fixedB.trimmed.has(MOVED_2.trim()),
      '换基准后必须认得出这一批(与归并器同一条调用)',
    )
  } finally {
    rmScratch(inFlight.dir)
    rmScratch(committed.dir)
  }
})

test('T3 反控:处置侧取不到 ⇒ 磁盘面一律不取用,读数与改前逐字同形', () => {
  // 工作树副本为空 ⇒ dispositionText 不可用 ⇒ 逐字回落改前那一档(只用被审面清单 + 被审面正文)。
  // 同形性用"盘上有批次"与"盘上根本没有批次"两臂的 CLI 输出逐字节相等来钉 —— 老代码只看得到后者。
  const withDisk = seed({ wt: 'empty' })
  const withoutDisk = seed({ wt: 'empty', diskBatch: false })
  try {
    const a = withDisk.run()
    const b = withoutDisk.run()
    assert.equal(
      a.out,
      b.out,
      '处置侧取不到时磁盘面仍被取用 ⇒ 行为与改前不同形(判据反向变松的第一步)',
    )
    assert.match(a.out, /归档凭据未取得/, '取不到凭据必须点名说"未取得",不得静默当成"没有归档行"')
    assert.equal(num(a.out, /移入 archive\(不插回\)= (\d+)/), 0, '处置侧取不到时一条都不许豁免')
    assert.ok(
      num(a.out, /真丢失\(需插回\)= (\d+)/) >= 3,
      '两行迁出正文 + 正向对照都必须照旧按真丢失处置(失效方向恒为多插回一份让人复核)',
    )
  } finally {
    rmScratch(withDisk.dir)
    rmScratch(withoutDisk.dir)
  }
})

test('T4 反向变松哨兵:盘上的整篇复制件不构成凭据(别人真加回来的行不许被洗成"已归档")', () => {
  const only = seed({ snapshot: true, diskBatch: false })
  try {
    const r = only.run()
    assert.equal(
      num(r.out, /移入 archive\(不插回\)= (\d+)/),
      0,
      '整篇复制件被当成移出批次 ⇒ 真丢失会被静默吞掉(比误报更坏的一侧)',
    )
    assert.equal(num(r.out, /真丢失\(需插回\)= (\d+)/), 3, '两行迁出 + 正向对照都该照旧判 lost')
  } finally {
    rmScratch(only.dir)
  }
  const both = seed({ snapshot: true, diskBatch: true })
  try {
    const r = both.run()
    assert.equal(num(r.out, /移入 archive\(不插回\)= (\d+)/), 2, '复制件不得连坐真正的迁出批次')
    assert.equal(num(r.out, /真丢失\(需插回\)= (\d+)/), 1, '正向对照仍必须判 lost 并被补回')
  } finally {
    rmScratch(both.dir)
  }
})

test('T5 形状锁:复制件判据与磁盘枚举仍只在 lib 一份(§0.6/§22c)', () => {
  const src = readFileSync(join(REPO, 'scripts/merge-live-doc.mjs'), 'utf8')
  assert.match(
    src,
    /import \{ selectMovedOut, selectMovedOutForDisposition \} from '\.\/lib\/live-doc-archive-drops\.mjs'/,
    '归并器必须 import lib 的处置侧出口,而不是自己再装配一份清单与基准',
  )
  assert.doesNotMatch(
    src,
    /SNAPSHOT_OVERLAP|readdirSync/,
    '归并器内不得出现第二份复制件阈值/磁盘枚举',
  )
  assert.match(src, /readArchivedForDoc\(FILE, headText, wtText\)/, '基准必须传处置侧快照(wtText)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

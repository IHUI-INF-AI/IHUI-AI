// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/deploy-lock.mjs` 的镜像测试(§22c:直接 import 源脚本的 __test__,
 * **不在本文件里复制第二份判据实现**;判据变了而测试仍绿 = 测试在替缺陷背书)。
 *
 * 钉的是 A9-3「锁的状态认识论」那一条:**"缺席 / 读到空值 / 读到无效值"三态必须区分,
 * 取不到不得记为通过,也不得记为另一种结论。**
 *
 * 真机零副作用(本票最高红线):
 *   - 所有用例的锁目录都取自 `mkScratch()`(工作树同盘的 DevEnv/Temp,结构上不在仓库树内),
 *     绝不 acquire/release 真实项目根的 `.deploy.lock`(那是并发会话正在用的锁);
 *   - 抢占会写"现场归档",故本文件在**任何用例之前**把 `IHUI_DEPLOY_LOCK_ARCHIVE_DIR`
 *     指进夹具,否则测试会往仓库 `.ihui-agent/tmp/` 里堆归档目录。
 *
 * 另含一条**装车证明**:spawn 真实 CLI 跑 `--self-test`,必须 exit 0 ——
 * 镜像判据全绿而 `--self-test` 没接上/跑不起来,等于这道锁没人验过。
 */
import { spawn, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
// G-386:utimesSync 用于造"未来 mtime 的锁目录"(构造面取证;数值按**秒**解释,传 ms 会 EINVAL —— 本机实测)
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as L } from '../deploy-lock.mjs'
// G-653:两条锁 + 巡检状态件共用的那一个原子写出口。**判据住在 lib 里**,本文件只引它,
// 不在测试里再抄一份"什么叫合规写盘"(§22c:测试复制判据 = 判据漂了测试还绿)。
import { __test__ as AW } from '../lib/atomic-write.mjs'
// git-lock 没有自己的 --self-test 入口,也没有 `scripts/tests/git-lock.test.mjs`
// (本票禁止新建那个文件名,见交付报告"没做的部分")—— 它的**行为级**用例落在本文件,
// 因为被审的是同一个出口、同一种 meta 形态。
import { __test__ as G } from '../git-lock.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'deploy-lock.mjs')

// 必须在任何会触发归档的用例之前设置(见文件头注)
const ARCHIVE_BASE = mkScratch('deploy-lock-archive-')
process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR = join(ARCHIVE_BASE, 'scene')

/** 已确定不存在的 pid(用 isProcessAlive 自己反查,不写死数字 —— 写死的会在别的机器上复活) */
function deadPid() {
  for (let p = 999_000; p < 1_200_000; p += 13) {
    if (!L.isProcessAlive(p)) return p
  }
  throw new Error('夹具需要一个确定已死的 pid,但未找到')
}

/** 建一个"锁目录"(只建夹具内路径,永不碰真实仓库根) */
function lockFixture(base, metaText) {
  const dir = join(base, `lock-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(dir, { recursive: true })
  if (metaText !== undefined) writeFileSync(join(dir, 'meta.json'), metaText, 'utf8')
  return dir
}

const okMeta = (o) => JSON.stringify({ mode: 'build', pid: 4321, ts: 1_700_000_000_000, ...o })

// ───────────────────────── 一、四态勘验(纯判据,零 IO) ─────────────────────────
test('四态可分辨:absent / ok / invalid / unreadable 各自命中且互不折叠', () => {
  assert.equal(L.classifyMeta(null).kind, 'absent', 'raw=null 必须是"确实没有元数据"')
  assert.equal(L.classifyMeta(okMeta()).kind, 'ok')
  assert.equal(L.classifyMeta('').kind, 'invalid', '空文件不得折叠成 absent')
  assert.equal(L.classifyMeta('  \n\t ').kind, 'invalid')
  assert.equal(
    L.classifyMeta('{"mode":"build","pid":').kind,
    'invalid',
    '半个 JSON 不得当成 absent',
  )
  assert.equal(L.classifyMeta('[1,2]').kind, 'invalid')
  assert.equal(
    L.classifyMeta('{"mode":"build"}').kind,
    'invalid',
    '缺 pid ⇒ 无法判定持有者,不是"无持有者"',
  )
  assert.equal(L.classifyMeta('{"pid":0}').kind, 'invalid')
  assert.equal(L.classifyMeta('{"pid":"abc"}').kind, 'invalid')
  // absent 与 invalid 的处置动作不同(前者等 stale,后者也等 stale 但**绝不**按"无人持锁"抢占),
  // 所以两态必须可分辨 —— 折叠成一态就是旧实现的病灶。
  assert.notEqual(L.classifyMeta(null).kind, L.classifyMeta('{"pid":0}').kind)
})

test('ok 态容忍 ts 缺失(活性判据只看 pid,锁龄才需要 ts)', () => {
  const s = L.classifyMeta('{"mode":"dev","pid":99}')
  assert.equal(s.kind, 'ok')
  assert.equal(s.meta.ts, 0)
})

test('unreadable ≠ absent:meta.json 位置被目录占据时判"读不到"而非"没有"', () => {
  const base = mkScratch('dl-unreadable-')
  try {
    const dir = lockFixture(base)
    mkdirSync(join(dir, 'meta.json'), { recursive: true })
    const s = L.readMeta(dir)
    assert.equal(s.kind, 'unreadable', `实得 ${s.kind}`)
    assert.match(s.reason, /读取失败/)
  } finally {
    rmScratch(base)
  }
})

test('readMeta 这一层也不得把 invalid 折叠成 absent(变异对照的直落点,不依赖 self-test 装车)', () => {
  const base = mkScratch('dl-readmeta-collapse-')
  try {
    assert.equal(
      L.readMeta(lockFixture(base, '{"mode":"build","pid":')).kind,
      'invalid',
      '半个 JSON 在 readMeta 层被折成 absent ⇒ 本条必红',
    )
    assert.equal(L.readMeta(lockFixture(base, '')).kind, 'invalid', '空文件同')
    assert.equal(L.readMeta(lockFixture(base)).kind, 'absent', '只有文件真的不在才算 absent')
  } finally {
    rmScratch(base)
  }
})

// ───────────────── 二、acquire:抢占判据与"不许白拿" ─────────────────
test('readMeta 层必须分得清四态(不得在 IO 层把 invalid/unreadable 折成 absent)', () => {
  // 这一条是**变异对照的直落点**:classifyMeta 分得清而 readMeta 折叠成 null/absent,
  // 正是旧实现"坏锁与无锁不可区分"的病灶;若只靠下面的 --self-test 装车证明来发现,
  // 一旦 self-test 被摘线本文件就会一路报绿。
  const base = mkScratch('dl-readmeta-')
  try {
    assert.equal(
      L.readMeta(lockFixture(base, '{"mode":"build","pid":')).kind,
      'invalid',
      '半个 JSON',
    )
    assert.equal(L.readMeta(lockFixture(base, '')).kind, 'invalid', '空文件')
    assert.equal(L.readMeta(lockFixture(base, '{"mode":"build"}')).kind, 'invalid', '缺 pid')
    assert.equal(
      L.readMeta(lockFixture(base)).kind,
      'absent',
      '目录在而 meta 不存在 = 确定的否定事实',
    )
    const u = lockFixture(base)
    mkdirSync(join(u, 'meta.json'), { recursive: true })
    assert.equal(L.readMeta(u).kind, 'unreadable', '读不到内容 = 无法判定,不是"没有内容"')
  } finally {
    rmScratch(base)
  }
})

test('absent(什么锁都没有)⇒ acquire 直接获取', async () => {
  const base = mkScratch('dl-free-')
  try {
    const dir = join(base, 'lock')
    assert.equal(await L.acquire({ mode: 'build', timeoutMs: 3000, dir }), true)
    assert.equal(L.readMeta(dir).meta.pid, process.pid, '获取后 meta 必须记着自己的 pid')
  } finally {
    rmScratch(base)
  }
})

test('完好 + 持有者存活 ⇒ 等待到超时,且锁的字节一字未变(不得覆盖别人正在用的锁)', async () => {
  const base = mkScratch('dl-alive-')
  try {
    const dir = lockFixture(base, okMeta({ pid: process.pid, ts: Date.now() }))
    const before = readFileSync(join(dir, 'meta.json'), 'utf8')
    await assert.rejects(
      () => L.acquire({ mode: 'build', timeoutMs: 900, staleMs: 600_000, dir }),
      /等待部署锁超时/,
    )
    assert.equal(readFileSync(join(dir, 'meta.json'), 'utf8'), before)
  } finally {
    rmScratch(base)
  }
})

test('回归对照(2026-08-27 那条行为):持有者已退出 + 锁龄 1s ⇒ 秒抢占,不许等 stale', async () => {
  const base = mkScratch('dl-dead-')
  try {
    const dir = lockFixture(base, okMeta({ mode: 'dev', pid: deadPid(), ts: Date.now() - 1000 }))
    const t0 = Date.now()
    // timeoutMs / staleMs 都给满 600s:唯一能让它成功的路径就是"持有者已退出 ⇒ 不限锁龄抢占"
    assert.equal(await L.acquire({ mode: 'dev', timeoutMs: 600_000, staleMs: 600_000, dir }), true)
    assert.ok(Date.now() - t0 < 4000, `秒抢占被拖到 ${Date.now() - t0}ms,2026-08-27 的修复被改坏了`)
    assert.ok(
      readdirSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).length >= 1,
      '抢占前必须归档现场',
    )
  } finally {
    rmScratch(base)
  }
})

for (const [name, bad] of [
  ['半个 JSON', '{"mode":"build","pid":'],
  ['空文件', ''],
  ['缺 pid 的合法 JSON', '{"mode":"build","ts":1}'],
]) {
  test(`不可判定(${name})⇒ 不得立即抢占;只有锁龄超 stale 才归档抢占`, async () => {
    const base = mkScratch('dl-bad-')
    try {
      // (a) 未超 stale:必须等待并超时,锁现场仍在(旧实现这里会死等 600s 且文案撒谎)
      const dirA = lockFixture(base, bad)
      const ageA = L.lockAgeMs(dirA, L.readMeta(dirA)).ageMs
      let msg = ''
      await L.acquire({ mode: 'build', timeoutMs: 900, staleMs: ageA + 600_000, dir: dirA }).catch(
        (e) => {
          msg = e.message
        },
      )
      assert.match(msg, /无法判定/, `超时文案必须如实说明"无法判定",实得:${msg}`)
      assert.match(
        msg,
        /stale/,
        '必须点名真实出路(锁龄超 stale 才抢占),不得写"会自动抢占"这种无条件承诺',
      )
      assert.doesNotMatch(msg, /会自动抢占/, '旧文案在该形态下是假的')
      assert.ok(existsSync(join(dirA, 'meta.json')), '未超 stale 时不得删别人可能正在用的锁')

      // (b) 已超 stale:归档 + 抢占成功,且归档的是**原字节**
      const dirB = lockFixture(base, bad)
      const rawB = readFileSync(join(dirB, 'meta.json'), 'utf8')
      const ageB = L.lockAgeMs(dirB, L.readMeta(dirB)).ageMs
      assert.equal(
        await L.acquire({
          mode: 'build',
          timeoutMs: 5000,
          staleMs: Math.max(-1, ageB - 1),
          dir: dirB,
        }),
        true,
      )
      const sceneRoot = process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR
      const hit = readdirSync(sceneRoot).some((n) => {
        const f = join(sceneRoot, n, 'meta.json')
        try {
          return readFileSync(f, 'utf8') === rawB
        } catch {
          return false
        }
      })
      assert.ok(hit, `现场未按原字节归档(${sceneRoot})`)
    } finally {
      rmScratch(base)
    }
  })
}

test('空锁目录(meta 从未写下)不等价于"无人持锁":未超 stale 时不得删', async () => {
  const base = mkScratch('dl-emptydir-')
  try {
    const dir = lockFixture(base) // 目录在、meta 不在
    let threw = false
    await L.acquire({ mode: 'build', timeoutMs: 900, staleMs: 600_000, dir }).catch(() => {
      threw = true
    })
    assert.ok(threw, '未超 stale 的 absent 态必须继续等待而不是抢删')
    assert.ok(existsSync(dir), '锁目录必须仍在(可能正有人处于 mkdir 与写 meta 的两步窗口)')
  } finally {
    rmScratch(base)
  }
})

test('isProcessAlive:EPERM 含义是"进程存在但不可管",不得判成已退出', () => {
  assert.equal(L.isProcessAlive(process.pid), true, '自己的 pid 必须算活着')
  assert.equal(L.isProcessAlive(0), false, '无 pid ⇒ 判不了 ⇒ 不得凭此删锁')
  assert.equal(L.isProcessAlive(deadPid()), false)
})

// ───────────────── 三、check / release 的三态如实 ─────────────────
test('check:无锁 exit 0;完好持锁打印 pid/alive', () => {
  const base = mkScratch('dl-check-')
  try {
    assert.equal(L.check({ dir: join(base, 'nothing'), log: () => {} }), 0)
    const dir = lockFixture(base, okMeta({ pid: process.pid, ts: Date.now() }))
    let out = ''
    assert.equal(L.check({ dir, log: (s) => (out += s) }), 1)
    assert.match(out, /alive=true/)
  } finally {
    rmScratch(base)
  }
})

test('check:invalid ⇒ 打印"无法判定"+原因,禁止打印成空字段(读报告的人会当成"没进程持锁")', () => {
  const base = mkScratch('dl-check-bad-')
  try {
    for (const bad of ['{"mode":"build","pid":', '', '{"mode":"build"}']) {
      const dir = lockFixture(base, bad)
      let out = ''
      const code = L.check({ dir, log: (s) => (out += s) })
      assert.equal(code, 1)
      assert.match(out, /无法判定/, `实得:${out}`)
      assert.match(
        out,
        /invalid/,
        `必须点名到底是哪一态(否则 absent/invalid/unreadable 又混成一锅):${out}`,
      )
      assert.doesNotMatch(out, /mode=\s+pid=\s+alive=/, `出现空字段形态:${out}`)
      assert.doesNotMatch(out, /ts=\s*$/, `ts 被打成空:${out}`)
    }
  } finally {
    rmScratch(base)
  }
})

test('release:元数据不可判定 ⇒ 拒绝释放(旧实现这里两个 meta&& 短路 = 坏锁白拿)', () => {
  const base = mkScratch('dl-release-bad-')
  try {
    const dir = lockFixture(base, 'not json at all')
    const r = L.release({ mode: 'build', dir })
    assert.equal(r.released, false)
    assert.ok(existsSync(dir), '不可判定时不得删锁')
  } finally {
    rmScratch(base)
  }
})

test('release:自持锁正常释放;他人悬挂锁可代为收口并留现场', () => {
  const base = mkScratch('dl-release-ok-')
  try {
    const mine = lockFixture(base, okMeta({ pid: process.pid, ts: Date.now() }))
    assert.equal(L.release({ mode: 'build', dir: mine }).released, true)
    assert.ok(!existsSync(mine))
    const orphan = lockFixture(base, okMeta({ pid: deadPid(), ts: Date.now() }))
    assert.equal(L.release({ mode: 'build', dir: orphan }).released, true)
    assert.ok(!existsSync(orphan))
  } finally {
    rmScratch(base)
  }
})

test('release:mode 不匹配时不得释放他人的另一种锁', () => {
  const base = mkScratch('dl-release-mode-')
  try {
    const dir = lockFixture(base, okMeta({ mode: 'dev', pid: process.pid, ts: Date.now() }))
    assert.equal(L.release({ mode: 'build', dir }).released, false)
    assert.ok(existsSync(dir))
  } finally {
    rmScratch(base)
  }
})

// ─────────────  四、G-653:meta/state 落盘必须原子替换(唯一出口 lib/atomic-write.mjs)  ─────────────
//
// 病灶形状(现读复核,不是假想):`writeFileSync` 覆盖写一个已存在的文件是 **truncate → 再写**
// 两步,而读者(`git-lock check` / `deploy-lock check` / 计划任务守护每 2 分钟一轮 / 下一轮凭据
// 巡检)随时可能落在这两步之间 ⇒ 它读到的是**半截 JSON**。本仓对"读不懂 meta / 读不到 meta"的
// 既有处置恰恰是「absent / invalid ⇒ 锁龄超 stale 即归档抢占」—— 于是**一个活着的持锁者会被
// 读成"无 meta / 已退出"并被抢走锁**(§5b / §12d 记过:判活判错 ⇒ 并发写坏 `.git`)。
// 这一节钉的是"**怎么写**",不是"写什么":成对两条(正向 + 反向对照)+ 失败路径 + 链接拒绝 +
// 装车锁。载荷内容一律不变。

const AW_LIB = resolve(HERE, '..', 'lib', 'atomic-write.mjs')
const AW_A = 'v1|' + 'x'.repeat(200_000)
const AW_B = 'v2|' + 'y'.repeat(150_000)

/**
 * 写手夹具(判岔协议,2026-09-29 G-653):在**另一个进程**里反复整写同一个文件,并把
 * 每一次**成功发布**的绝对时刻记进 `eventsFile` —— 这是"发布点信号"的落载体。
 * 必须跨进程 —— 同一进程内同步读、同步写不会交错,那种"并发测试"结构上恒绿。
 *
 * 三段时序(全部有界,禁止用 sleep 消抖):
 *   alt   A/B 交替整写,直到第一枚 B 发布成功;
 *   hold  首枚 B 发布后**只重写 B**,直到看见读者的 ack —— 于是"B 在盘上持续存在"是构造保证,
 *         不是概率。读者在有界采样内仍看不见它 ⇒ 那只剩两种解释,都由判决点名(见 coverageVerdict);
 *   alt'  ack 之后恢复交替,尾随窗口继续施加真实写压(撕裂机会与改前同源,判据不放弱)。
 * A/B 两份载荷由本文件写进 `payloads.json` 交给它 ⇒ 定义只有一份,不在两侧各拼一遍
 * (拼错的那一侧断言永远绿,同 `lock-atomic-init.pendingPathFor` 那条理由)。
 */
const AW_WRITER_SRC = `import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const [target, kind, durMs, payloadFile, libPath, ackFile, stopFile, eventsFile] = process.argv.slice(2)
const [A, B] = JSON.parse(readFileSync(payloadFile, 'utf8'))
let write
if (kind === 'atomic') {
  const mod = await import(pathToFileURL(libPath).href)
  // 夹具自己的发布预算(2026-09-29 G-653 复跑量到的):生产退避表 8 档在**整机高负载**下 9 次就用尽,
  // 于是这一条用例只在"同时还有别的测试/构建在跑"时红 —— 只在负载下红的用例等于一台恒红门(§12e 同型)。
  // 放宽的只是夹具写手的活性(它必须活到读者 ack);撕裂判据、生产表 RENAME_BACKOFF_MS、
  // atomic-write.mjs 一字未动,且写手永不成功时仍会落 no-publish-in-window 那支点名红。
  // 档数 ×40 而不是单次时长 ×N:竞争来自读者瞬时持柄,缺的是尝试次数不是睡眠总量。
  const HARNESS_BACKOFF = new Array(40).fill(20)
  write = (s) => mod.atomicWriteFileSync(target, s, { backoff: HARNESS_BACKOFF })
} else {
  write = (s) => writeFileSync(target, s, 'utf8')
}
const t0abs = Date.now()
let i = 0
let firstBAtAbs = null
const bTimes = []
let fatal = null
try {
  while (Date.now() - t0abs < Number(durMs) && !existsSync(stopFile)) {
    // hold:第一枚 B 已发布而读者还没 ack ⇒ 只重写 B,让新值在盘上持续存在(构造保证)。
    const holding = firstBAtAbs !== null && !existsSync(ackFile)
    const isB = holding || i % 2 !== 0
    write(isB ? B : A)
    const at = Date.now()
    if (isB) {
      bTimes.push(at)
      if (firstBAtAbs === null) firstBAtAbs = at
    }
    i++
  }
} catch (e) {
  fatal = String((e && (e.code || e.name)) + ':' + (e && e.message)).slice(0, 300)
}
// 遥测件(不是生产 meta)⇒ 走裸 writeFileSync 是有意例外:装车锁只审三个生产脚本的 meta 写。
writeFileSync(eventsFile, JSON.stringify({ t0abs, writes: i, firstBAtAbs, bTimes: bTimes.slice(0, 400), fatal }), 'utf8')
process.stdout.write(JSON.stringify({ writes: i }))
process.exit(fatal ? 1 : 0)
`

/**
 * 撕裂读探测器(判岔版):先把目标预置成**合法旧值**,于是任何"既不是 A 也不是 B"的读数都是坏状态。
 *
 * 与旧形态的唯一区别在**窗口的造法**,判式一字未放宽:
 *   - 旧:读者固定采 700ms。实测(2026-09-29 判岔,8 连跑)原子臂首枚 B 发布落点
 *     +42…+1090ms —— Windows 下读者持续持柄会让 rename 撞 EPERM 进退避,发布可以被挤到窗口外;
 *     落点 ≤600ms 的 6 次全部 sawB≥1 且 torn/missing/readErr=0,落点 749/1090ms 的 2 次 sawB=0
 *     而**没有任何一次"发布在窗口内却看不见"** ⇒ 红的是探测没覆盖,不是原子性。
 *   - 新:读者采到"看见新值"为止(有界 sightCapMs),看见后再续采 windowMs 尾随窗口;
 *     写手 hold-B 直到 ack ⇒ "看见了却没覆盖"在构造上不存在,覆盖与否由发布日志**逐条对表**。
 *
 * 三条反空转判据原样保留(否则"0 次撕裂"可能只是"什么都没发生"):
 *   - `writes`:写手自己报它完成了多少次整写;
 *   - `sawA` / `sawB`:读者**确实两种值都看见过**;
 *   - `exitCode`:写手必须退 0 —— 它在高并发读下会撞 EPERM 并重试,一旦重试用尽就是
 *     `AtomicReplaceFailedError`(= 心跳没续上 ts,锁可能被误判悬挂),那是新的故障,必须当场可见。
 * 计数一律现量,不写"应该有多少次"。
 */
async function tornReadProbe({ base, kind, windowMs = 700, sightCapMs = 6000, holdMarginMs = 50, libPath = AW_LIB }) {
  const dir = join(base, `aw-${kind}`)
  mkdirSync(dir, { recursive: true })
  const target = join(dir, 'meta.json')
  const payloadFile = join(dir, 'payloads.json')
  const writerFile = join(dir, 'writer.mjs')
  const ackFile = join(dir, 'reader.ack')
  const stopFile = join(dir, 'reader.stop')
  const eventsFile = join(dir, 'writer-events.json')
  writeFileSync(payloadFile, JSON.stringify([AW_A, AW_B]), 'utf8')
  writeFileSync(writerFile, AW_WRITER_SRC, 'utf8')
  writeFileSync(target, AW_A, 'utf8')
  const child = spawn(
    process.execPath,
    [
      writerFile,
      target,
      kind,
      String(sightCapMs + windowMs + 800),
      payloadFile,
      libPath,
      ackFile,
      stopFile,
      eventsFile,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }, // windowsHide:§5b,漏了就是反复弹窗(守门 52)
  )
  let out = ''
  let err = ''
  child.stdout.on('data', (d) => (out += d))
  child.stderr.on('data', (d) => (err += d))
  const rStart = Date.now()
  let readEndAt = rStart + sightCapMs
  let reads = 0
  let torn = 0
  let missing = 0
  let readErr = 0
  let sawA = 0
  let sawB = 0
  let firstBAt = null
  while (Date.now() < readEndAt) {
    reads++
    let s
    try {
      s = readFileSync(target, 'utf8')
    } catch (e) {
      if (e && e.code === 'ENOENT') missing++
      else readErr++
      continue
    }
    if (s === AW_A) sawA++
    else if (s === AW_B) {
      sawB++
      if (firstBAt === null) {
        firstBAt = Date.now()
        // 覆盖达成 ⇒ 再采 windowMs 尾随窗口(写手 ack 后恢复交替,写压与改前同源)
        readEndAt = firstBAt + windowMs
        writeFileSync(ackFile, String(firstBAt), 'utf8') // 解除写手的 hold-B
      }
    } else torn++
  }
  const rEnd = Date.now()
  writeFileSync(stopFile, String(rEnd), 'utf8') // 有界收尾:写手最迟 durMs 自退,这里只是提前让位
  // 等 **close** 而不是 exit:exit 只保证进程退了,stdout 最后一块可能还没喂给本进程,
  // 那样 `writes` 会 parse 失败 ⇒ 把"跑过了"读成"没跑"。
  const exitCode = await new Promise((res) => child.once('close', res))
  let writes = 0
  let firstBAtAbs = null
  let bTimesLen = 0
  let fatal = null
  try {
    const ev = JSON.parse(readFileSync(eventsFile, 'utf8'))
    writes = ev.writes
    firstBAtAbs = typeof ev.firstBAtAbs === 'number' ? ev.firstBAtAbs : null
    bTimesLen = Array.isArray(ev.bTimes) ? ev.bTimes.length : 0
    fatal = ev.fatal ?? null
  } catch {
    /* 写手没给汇总 ⇒ writes 留 0,由下面两条下限断言各自点名,绝不静默当成"跑过了" */
  }
  return {
    kind,
    reads,
    torn,
    missing,
    readErr,
    sawA,
    sawB,
    writes,
    exitCode,
    firstBAt,
    rStart,
    rEnd,
    holdMarginMs,
    firstBAtAbs,
    bTimesLen,
    fatal,
    stderr: err.slice(0, 400),
    tmpLeftovers: readdirSync(dir).filter((n) => n.includes(AW.TMP_INFIX)),
  }
}

/**
 * 覆盖判决(判岔的另一半):把"一次都没见过新值"从一句笼统红拆成**两种语义不同的红**。
 * 拆的依据是写手自己的发布日志:hold-B 协议保证首枚 B 发布之后、读者 ack 之前,盘上一直是 B
 * (或裸写形态的半截 B),所以:
 *   - `published-invisible` ⇒ B 落进读者采样区间且持续到区间末(减 holdMarginMs),而读者没看见
 *     ⇒ 这是**出口侧可见性缺陷**,修 `scripts/lib/atomic-write.mjs`,不得动这里;
 *   - `no-publish-in-window` ⇒ 写手从未在读者区间内落地过任何 B ⇒ 探测没造出覆盖,
 *     **这一发证不了任何事,当场红并点名窗口,不得静默、不得降级成"观察不到就当通过"**。
 * 纯函数 + 构造面(不读仓库瞬时状态 —— 守门 103 T12 那一课);可达性由 phantom 用例端到端证明。
 */
function coverageVerdict(r) {
  if (r.sawB >= 1) return { covered: true, verdict: 'covered' }
  const boundary = r.rEnd - r.holdMarginMs
  const rel = r.firstBAtAbs === null ? null : r.firstBAtAbs - r.rStart
  if (r.firstBAtAbs !== null && r.firstBAtAbs <= boundary) {
    return { covered: false, verdict: 'published-invisible', relMs: rel, boundaryMs: boundary - r.rStart }
  }
  return { covered: false, verdict: 'no-publish-in-window', relMs: rel, boundaryMs: boundary - r.rStart }
}

const coverageFailMessage = (r, cov) =>
  cov.verdict === 'published-invisible'
    ? `B 首枚发布落在 +${cov.relMs}ms(写手 hold-B 直到读者 ack,新值在盘上持续存在),读者在 ${r.rEnd - r.rStart}ms 里采样 ${r.reads} 次仍一次没见过 ⇒ 这是出口侧可见性缺陷,修 scripts/lib/atomic-write.mjs,不得改这里`
    : `读者区间 ${r.rEnd - r.rStart}ms / ${r.reads} 次采样,写手首枚 B 发布 ${cov.relMs === null ? '从未发生' : `落在 +${cov.relMs}ms`}(窗口边界 +${cov.boundaryMs}ms)⇒ 探测未覆盖,这一发证不了任何事(no-publish-in-window,不得静默)`

test('原子写·成对①(正向):并发读者在写中途读 ⇒ 永远只拿到完整旧值或完整新值', async () => {
  const base = mkScratch('dl-atomic-pair-')
  try {
    const r = await tornReadProbe({ base, kind: 'atomic' })
    assert.equal(r.exitCode, 0, `写手进程退出码 ${r.exitCode}:${r.stderr}${r.fatal ? ' / fatal: ' + r.fatal : ''}`)
    // 判岔前置:覆盖必须成立,否则 torn=0 是一句"没看见"而不是一个测量。两种未覆盖各归各的侧,
    // 都不许被降级成 warn、不许 skip、不许把 sawB>=1 放宽 —— 红就是要人来看是谁的红。
    const cov = coverageVerdict(r)
    assert.ok(cov.covered, coverageFailMessage(r, cov))
    assert.ok(r.writes >= 1, `写手完成 0 次整写(${r.stderr})⇒ 探测没跑起来,0 次撕裂不算证据`)
    assert.ok(r.reads >= 50, `读者只采到 ${r.reads} 个样本 ⇒ 探测器空转`)
    assert.equal(r.torn, 0, `${r.reads} 次读里有 ${r.torn} 次读到"既非旧值也非新值"的半截内容`)
    assert.equal(r.missing, 0, '替换不得让目标短暂消失(读成 absent ⇒ 活锁会被归档抢占)')
    assert.equal(r.readErr, 0, `非 ENOENT 的读失败 ${r.readErr} 次 ⇒ 写入期间读者根本打不开目标(也是半截态)`)
    assert.deepEqual(r.tmpLeftovers, [], '替换完成后不得留下孤儿临时文件')
  } finally {
    rmScratch(base)
  }
})

test('原子写·成对②(反向对照):同一条判式喂裸 writeFileSync ⇒ 必须抓到撕裂读', async () => {
  // 这条存在的唯一理由:①是一条"期望 0"的断言 —— 探测器若看不见任何东西,它就一直报 0。
  // 把写手换成裸 writeFileSync(本票要换掉的那个形态),同一条判式**必须**抓到坏读数;
  // 它一旦绿不起来,①的"0"就重新变成一句话而不是一个测量。
  // 判岔实验后复验(2026-09-29,同机 5 连跑):裸写臂 tear 持续 >0(每枚 truncate→重写都在读者的
  // 亚毫秒采样周期里留缝),尾随窗口把测量从"一次发布"扩成"看见后 700ms 连续写压" ⇒ 牙没有钝。
  const base = mkScratch('dl-atomic-teeth-')
  try {
    const r = await tornReadProbe({ base, kind: 'bare' })
    assert.equal(r.exitCode, 0, `写手进程退出码 ${r.exitCode}:${r.stderr}${r.fatal ? ' / fatal: ' + r.fatal : ''}`)
    const cov = coverageVerdict(r)
    assert.ok(cov.covered, coverageFailMessage(r, cov))
    assert.ok(r.writes >= 1, `写手完成 0 次裸写 ⇒ 探测没跑起来`)
    assert.ok(r.reads >= 50, `读者只采到 ${r.reads} 个样本 ⇒ 探测器空转,不能拿它给①背书`)
    assert.ok(r.torn > 0, '裸 writeFileSync 一次都没被读到半截 ⇒ ①那条断言是恒真的,它没有牙')
    assert.ok(r.torn < r.reads, `每次读都算撕裂(${r.torn}/${r.reads})⇒ 是判式算错,不是抓到坏状态`)
  } finally {
    rmScratch(base)
  }
})

test('原子写·判决有牙:phantom 发布(记账了却从未改盘)⇒ 必须落 published-invisible,不得落成"未覆盖"', async () => {
  // 拆岔的两支如果有一支是死代码,另一支的红/绿就都读不出语义。这里用 stub 出口"成功发布"
  // 却不碰磁盘 ⇒ 写手日志里 B 发布全在窗口内,读者永远只看见旧值 —— 这正是"出口侧可见性缺陷"
  // 的形状,判决必须点名它(落进 no-publish-in-window = 判决失明)。
  const base = mkScratch('dl-atomic-phantom-')
  try {
    const stub = join(base, 'stub-atomic-write.mjs')
    writeFileSync(stub, 'export function atomicWriteFileSync() { return { bytes: 0, renameAttempts: 0 } }\n', 'utf8')
    const r = await tornReadProbe({ base, kind: 'atomic', libPath: stub, windowMs: 300, sightCapMs: 1500 })
    assert.equal(r.exitCode, 0, `phantom 写手必须正常收尾:退出码 ${r.exitCode} ${r.stderr}${r.fatal ? ' / ' + r.fatal : ''}`)
    assert.equal(r.sawB, 0, 'phantom 发布根本没改盘,读者不该看见新值 —— 看见即夹具坏')
    const cov = coverageVerdict(r)
    assert.equal(cov.covered, false, 'phantom 发布不得被判成"覆盖达成"')
    assert.equal(cov.verdict, 'published-invisible', `发布在窗口内而读者永不可见只能落 W2(实得 ${cov.verdict})—— 落别的分支就是判决失明`)
    assert.ok(r.bTimesLen >= 1, '写手日志必须真记到 B 发布,否则上面那条等式没有证据面')
  } finally {
    rmScratch(base)
  }
})

test('原子写·失败路径:rename 反复 EPERM ⇒ 磁盘仍是完整旧值,且不留下孤儿临时文件', () => {
  // 注入面只覆盖 renameSync 这一个函数(其余照用 NODE_FS 那一份真实袋)——
  // 在测试里手抄一整份 fs 袋,断言就落在一个生产代码不走的对象上了。
  const base = mkScratch('dl-atomic-fail-')
  try {
    const dir = join(base, 'l')
    mkdirSync(dir, { recursive: true })
    const target = join(dir, 'meta.json')
    writeFileSync(target, '{"old":1}', 'utf8')
    const boom = () => {
      const e = new Error('模拟 Windows「目标已被别的句柄打开」')
      e.code = 'EPERM'
      throw e
    }
    let caught = null
    try {
      AW.atomicWriteFileSync(target, '{"new":2}', {
        fs: { ...AW.NODE_FS, renameSync: boom },
        sleep: () => {},
      })
    } catch (e) {
      caught = e
    }
    assert.ok(caught, 'rename 用尽重试必须抛出,不得静默当成写成功')
    assert.equal(caught.name, 'AtomicReplaceFailedError')
    assert.equal(
      caught.attempts,
      AW.RENAME_BACKOFF_MS.length + 1,
      '尝试次数必须是量出来的退避轮数(把一次没重试的失败报成"重试了 8 次"就是假证据)',
    )
    assert.equal(readFileSync(target, 'utf8'), '{"old":1}', '失败必须留**完整旧值**,而不是半截或空')
    assert.deepEqual(readdirSync(dir).filter((n) => n.includes(AW.TMP_INFIX)), [], '失败路径不得留临时文件')
  } finally {
    rmScratch(base)
  }
})

test('原子写·临时名撞车:同名临时件属于别人 ⇒ 拒绝写入且不删它、不截目标', () => {
  // 'wx' 独占创建那一格的反向对照:崩溃残留 / 并发撞名时,绝不能"复用一个不受本进程控制的
  // 既有文件",也绝不能把它当自己的垃圾删掉(与本仓"不删别人的锁"是同一条禁令)。
  const base = mkScratch('dl-atomic-tmpname-')
  try {
    const dir = join(base, 'l')
    mkdirSync(dir, { recursive: true })
    const target = join(dir, 'meta.json')
    const otherTmp = join(dir, '.meta.json.tmp-somebody-else')
    writeFileSync(target, '{"old":1}', 'utf8')
    writeFileSync(otherTmp, 'OTHER-PROCESS-DATA', 'utf8')
    assert.throws(
      () => AW.atomicWriteFileSync(target, '{"new":2}', { tmpName: otherTmp }),
      (e) => e && e.code === 'EEXIST',
      '撞名必须抛 EEXIST(不是静默改写别人的临时文件)',
    )
    assert.equal(readFileSync(target, 'utf8'), '{"old":1}', '撞名失败不得碰目标')
    assert.equal(readFileSync(otherTmp, 'utf8'), 'OTHER-PROCESS-DATA', '不得顺手删别人那份同名临时件')
  } finally {
    rmScratch(base)
  }
})

test('原子写·绝不跟随符号链接:两条锁的 writeMeta 都必须拒绝,链接真身一字未动', (t) => {
  // **行为级**接线证明:裸 writeFileSync 会穿透链接改真身(本机实测),而出口拒绝。
  // 所以"这一发被拒 + 真身未变"只有 writeMeta 真的走了出口才会发生 —— 它不是读源码的装车锁。
  const base = mkScratch('dl-atomic-symlink-')
  try {
    const mk = (name) => {
      const dir = join(base, name)
      mkdirSync(dir, { recursive: true })
      const real = join(dir, 'real-owner.txt')
      writeFileSync(real, 'REAL-ORIGINAL', 'utf8')
      const link = join(dir, 'meta.json')
      try {
        symlinkSync(real, link, 'file')
      } catch (e) {
        return { skip: e.code ?? String(e) }
      }
      return { dir, real, link }
    }
    for (const [label, writeIt] of [
      ['deploy-lock.writeMeta', (d) => L.writeMeta(d, 'build', { ownerPid: process.pid, run: () => null })],
      ['git-lock.writeMeta', (d) => G.writeMeta(d, 'unit-x', { run: () => null })],
    ]) {
      const fx = mk(label.replace(/[^a-z]/gi, '-'))
      if (fx.skip) {
        // 平台不给建符号链接 ⇒ 这一格**未取证**,必须报成 skip(不得静默走过去)
        t.skip(`${label}:本机不允许建文件符号链接(${fx.skip})⇒ 未取证`)
        return
      }
      assert.throws(
        () => writeIt(fx.dir),
        (e) => e && e.name === 'SymlinkTargetError',
        `${label}:meta.json 是链接时必须拒绝,不得穿透`,
      )
      assert.equal(readFileSync(fx.real, 'utf8'), 'REAL-ORIGINAL', `${label}:穿透改了真身`)
      assert.ok(existsSync(fx.link), `${label}:拒绝写入不得顺手把那条链接删掉`)
    }
  } finally {
    rmScratch(base)
  }
})

test('原子写·git-lock writeMeta 的落盘形态一字未变(本票只改"怎么写"),且不留临时文件', () => {
  const base = mkScratch('gl-writemeta-shape-')
  try {
    const dir = join(base, 'ihui-git-write.lock')
    mkdirSync(dir, { recursive: true })
    // run 桩 ⇒ 量不到 pidStart:身份两元"取不到就整键不写"这条既有语义必须照旧成立
    G.writeMeta(dir, 'unit-x', { run: () => null })
    const raw = readFileSync(join(dir, 'meta.json'), 'utf8')
    const m = JSON.parse(raw)
    assert.equal(m.unitId, 'unit-x')
    assert.equal(m.pid, process.pid)
    assert.ok(Number.isFinite(m.ts) && m.ts > 0, 'ts 是判活的年龄锚点,必须落')
    assert.ok(typeof m.host === 'string' && m.host.length > 0, 'host 缺失 ⇒ 跨机判活会落 unverifiable')
    assert.equal(m.pidStart, undefined, '量不到就整键不写 —— 伪造一个启动时刻等于给判据喂假证据')
    assert.deepEqual(G.readMeta(dir), m, '读侧必须拿回同一份(出口不得改字节)')
    assert.deepEqual(readdirSync(dir).filter((n) => n.includes(AW.TMP_INFIX)), [], '不得留孤儿临时文件')
    // 心跳搬的仍是那份身份两元(既有镜像测试 proc-identity 钉的那一格的同一条底线)
    const hb = join(base, 'hb')
    mkdirSync(hb, { recursive: true })
    G.writeMeta(hb, 'unit-hb', { run: () => null })
    assert.match(readFileSync(join(hb, 'meta.json'), 'utf8'), /"host":/)
  } finally {
    rmScratch(base)
  }
})

test('原子写·装车锁:三处调用点必须引唯一出口,代码面不得再有裸写 meta/state', () => {
  // 判据住在 lib(`auditAtomicWriteSource`),本文件只调它 —— 在测试里另写一遍正则,
  // 就是把"合规"定义养成第二份真相(§22c)。
  const codeOnly = (src) =>
    src
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
  const targets = [
    ['../deploy-lock.mjs', 'scripts/deploy-lock.mjs'],
    ['../git-lock.mjs', 'scripts/git-lock.mjs'],
    ['../check-credential-health.mjs', 'scripts/check-credential-health.mjs'],
  ]
  const problems = []
  for (const [rel, label] of targets) {
    const file = new URL(rel, import.meta.url)
    assert.ok(existsSync(fileURLToPath(file)), `${label}:被审文件不在位 ⇒ 这条装车锁失效,不得静默通过`)
    problems.push(...AW.auditAtomicWriteSource(codeOnly(readFileSync(file, 'utf8')), label))
  }
  assert.deepEqual(problems, [], `装车判据点名:\n${problems.join('\n')}`)
})
// ───────────────── 五、默认语义与红线不变量 ─────────────────
test('默认锁目录仍是项目根 .deploy.lock(CLI 语义未变)', () => {
  assert.equal(L.lockDir(), join(L.repoRoot, '.deploy.lock'))
})

test('红线:夹具落点结构上不在仓库树内 ⇒ 用例不可能碰到真锁', () => {
  const base = mkScratch('dl-redline-')
  const norm = (p) => resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  try {
    assert.ok(!norm(base).startsWith(`${norm(L.repoRoot)}/`), `夹具落在仓库树内:${base}`)
    assert.ok(
      !norm(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).startsWith(`${norm(L.repoRoot)}/`),
      '归档落点必须也在仓库外',
    )
  } finally {
    rmScratch(base)
  }
})

test('装车证明:`node scripts/deploy-lock.mjs --self-test` 必须 exit 0', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
  })
  assert.equal(
    r.status,
    0,
    `self-test 退出码 ${r.status}\n${r.stdout?.slice(-2000)}\n${r.stderr?.slice(-800)}`,
  )
  assert.match(r.stdout, /自检 \d+ 条:pass \d+ \/ fail 0/)
  assert.doesNotMatch(r.stdout, /^❌/m, '自检输出里不得出现失败行')
})

// ─────────────  六、身份:pid 会被人复用,锁龄与"活着"矛盾时必须有一方认账  ─────────────
//
// 2026-09-25 实测事故:`.deploy.lock/meta.json` 记着 pid=888 / ts=11:16:32,而当时占着 888 号的是
// `C:\Windows\System32\nssm.exe`(StartTime=11:19:13,比锁晚 160 秒)。`isProcessAlive(888)` 恒真,
// 旧 decideSteal 在"活着"这一支无条件 `wait` ⇒ 部署环每轮白等 600s 后 exit=1,**冻结 11h50m**,
// 而 `release` 也因为同一个"活着"拒绝代为收口。两条判据都是量出来的,却没有任何一条问
// "这个 pid 还是当初那个持锁过程吗"。

test('身份·硬上限:名义存活 + 锁龄超上限 ⇒ steal,并点名"复用"', () => {
  const base = mkScratch('dl-reuse-')
  try {
    // pid 用本测试进程自己,保证 isProcessAlive 一定为真 ⇒ 唯一能翻案的证据只剩锁龄。
    const dir = lockFixture(base, okMeta({ pid: process.pid, ts: Date.now() - L.HARD_CAP_MS - 5_000 }))
    const d = L.decideSteal({ dir, mode: 'build', staleMs: 600_000, hardCapMs: L.HARD_CAP_MS })
    assert.equal(d.action, 'steal', `超上限仍 wait ⇒ 冻结会重演。why=${d.why}`)
    assert.match(d.why, /硬上限/)
    assert.equal(d.immediate, false, '复用兜底属于"先归档现场"那一档,不得走秒抢通道')
  } finally {
    rmScratch(base)
  }
})

test('身份·反向对照:锁龄在上限内且存活 ⇒ wait(硬上限不得变成秒抢)', () => {
  const base = mkScratch('dl-in-cap-')
  try {
    const dir = lockFixture(base, okMeta({ pid: process.pid, ts: Date.now() - 30_000 }))
    const d = L.decideSteal({ dir, mode: 'build', staleMs: 600_000, hardCapMs: L.HARD_CAP_MS })
    assert.equal(d.action, 'wait', d.why)
  } finally {
    rmScratch(base)
  }
})

test('身份·ownerPid 才是判活对象(CLI 自己立刻退出,不是构建)', () => {
  const base = mkScratch('dl-owner-')
  try {
    const dead = deadPid()
    // CLI pid 已死、构建 owner 还活着 ⇒ 这是"构建进行中",不是悬挂锁。
    // ts 必须给"刚刚":okMeta 的默认 ts 是 2023 年,那会先被硬上限判成复用,测不到 owner 这一格。
    const held = lockFixture(base, okMeta({ pid: dead, ownerPid: process.pid, ts: Date.now() }))
    assert.equal(L.decideSteal({ dir: held, mode: 'build', staleMs: 600_000 }).action, 'wait')
    // 反过来:CLI pid 恰好还"活着"(复用),而声明的 owner 已退出 ⇒ 构建结束了,可抢。
    const freed = lockFixture(base, okMeta({ pid: process.pid, ownerPid: dead, ts: Date.now() }))
    const d = L.decideSteal({ dir: freed, mode: 'build', staleMs: 600_000 })
    assert.equal(d.action, 'steal', `owner 已退出却因 CLI pid 活着而等 ⇒ 就是本次冻结的形态(${d.why})`)
    assert.match(d.why, /owner pid=/)
    assert.equal(L.holderPid({ pid: 7, ownerPid: 4242 }), 4242)
    assert.equal(L.holderPid({ pid: 7, ownerPid: 0 }), 7, '旧 meta 没有 owner 时退回 CLI pid(向后兼容)')
  } finally {
    rmScratch(base)
  }
})

test('身份·writeMeta 必须落 ownerPid,check 的打印要给出"判活对象"', () => {
  const base = mkScratch('dl-meta-shape-')
  try {
    const dir = join(base, 'l')
    mkdirSync(dir, { recursive: true })
    L.writeMeta(dir, 'build', { ownerPid: 4242 })
    const m = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
    assert.equal(m.ownerPid, 4242, 'ownerPid 没落盘 ⇒ 判活只能看到早已退出的 CLI pid')
    assert.equal(m.pid, process.pid)
    let out = ''
    L.check({ dir, log: (s) => (out += s) })
    assert.match(out, /ownerPid=4242/)
    assert.match(out, /判活对象=4242/, '打印必须说清"我问的是哪个 pid",否则读报告的人会把复用当存活')
  } finally {
    rmScratch(base)
  }
})

test('身份·release 遇到"名义存活但超上限":不代删别人的锁,但出路必须指向自动档', () => {
  const base = mkScratch('dl-release-reuse-')
  try {
    // 必须用**不是自己**的存活 pid:pid===process.pid 会被 release 认成"持有者自释",
    // 测的就不是这一格了。父进程(npm/node --test 那层)在跑测期间一定活着。
    assert.ok(L.isProcessAlive(process.ppid), '夹具需要父进程在位;拿不到就换判据,不要放行')
    const dir = lockFixture(base, okMeta({ pid: process.ppid, ts: Date.now() - L.HARD_CAP_MS - 5_000 }))
    const r = L.release({ mode: 'build', dir })
    assert.equal(r.released, false, 'release 不得因为"看起来超上限"就删锁——删锁是持有者的动作')
    assert.ok(existsSync(dir), '锁目录必须原样在位')
    assert.match(r.why, /复用/, `拒绝理由要点名真实形态,实得 ${r.why}`)
  } finally {
    rmScratch(base)
  }
})

// ─────────  七、G-412 单调量第二判据:"锁龄恒 0"换成"锁永远新"也不许没有出路  ─────────
//
// clamp(`max(0, now - ts)`)只解决"算出负数"这一半;另一半是**未来 ts 让硬上限永不触发**。
// 现判据用 `os.uptime()`(单调钟)反推开机时刻做对账,三态:contradiction / consistent /
// unverifiable。镜像测试直接 import `__test__`(§22c:不在这里复制第二份判据实现),
// 并成对钉:①未来 ts ⇒ 判"不可信"且出路点名(绝不 wait);②正常 ts ⇒ **与改动前逐字同结论**。
const G412_NOW = 1_800_000_000_000
const G412_MIN = 60_000
const G412_UP = 3_600_000
const G412_BOOT = G412_NOW - G412_UP

test('G-412·成对:注入未来 ts ⇒ "ts 不可信(未来 N 秒)"+出路,而正常 ts 与改动前逐字同结论(wait)', () => {
  const base = mkScratch('dl-g412-pair-')
  try {
    const aliveMeta = (ts, extra = {}) => okMeta({ pid: process.pid, ownerPid: process.pid, ts, ...extra })

    // ① 未来 ts(旧形态 meta:无 host/bootMs ⇒ 单调对账必须**报名**"无法核对",不许静默)
    const dFuture = lockFixture(base, aliveMeta(G412_NOW + 10 * G412_MIN))
    const ageF = L.lockAgeMs(dFuture, L.readMeta(dFuture), G412_NOW)
    assert.equal(ageF.clockAnomalous, true)
    assert.equal(ageF.futureMs, 10 * G412_MIN, '未来多少秒必须作为**量**随读数带走,不是只进文案')
    assert.match(ageF.source, /ts 不可信\(未来 600s/)
    const decF = L.decideSteal({ dir: dFuture, mode: 'build', staleMs: 600_000, hardCapMs: L.HARD_CAP_MS, now: G412_NOW })
    assert.equal(decF.action, 'steal', '年龄维失效时不得无限 wait(这正是冻结 11h50m 的那一型)')
    assert.equal(decF.immediate ?? false, false, '先归档现场再抢,不走秒抢通道')
    assert.match(decF.why, /ts 不可信\(未来 600s/)
    assert.match(decF.why, /单调判据=无法核对/, '没有单调凭据时必须喊出来,不得读成"已核过没问题"')
    assert.match(decF.why, /break-stale/, '结论里要带人工出口,不是一句"判不出来"')

    // ② 回归对照:同夹具只把 ts 改回正常 ⇒ 读数与结论必须**与改动前同形**(meta.ts / wait)
    const dCalm = lockFixture(base, aliveMeta(G412_NOW - 60_000))
    const ageC = L.lockAgeMs(dCalm, L.readMeta(dCalm), G412_NOW)
    assert.equal(ageC.ageMs, 60_000)
    assert.equal(ageC.source, 'meta.ts', '正常读数的来源文案一字不许动(镜像代读判据漂移的直落点)')
    assert.equal(ageC.clockAnomalous, undefined)
    const decC = L.decideSteal({ dir: dCalm, mode: 'build', staleMs: 600_000, hardCapMs: L.HARD_CAP_MS, now: G412_NOW })
    assert.equal(decC.action, 'wait')
    assert.match(decC.why, /仍在运行\(锁龄 60000ms/, `wait 文案必须与改动前同形,实得 ${decC.why}`)
  } finally {
    rmScratch(base)
  }
})

test('G-412·单调三态是纯判据:同机未来 ⇒ contradiction;别机/无 host/量不到 ⇒ unverifiable;一致 ⇒ consistent', () => {
  const HOST = 'this-machine'
  const v = (meta, over = {}) =>
    L.monotonicAgeVerdict({ meta: { ts: 0, host: HOST, bootMs: 0, ...meta }, now: G412_NOW, uptimeMs: G412_UP, localHost: HOST, ...over })
  assert.equal(v({ ts: G412_NOW + 10 * G412_MIN }).mode, 'future-ts')
  assert.equal(v({ ts: G412_NOW - 1000, bootMs: G412_BOOT }).kind, 'consistent', '同会话一致时第二判据不得凭空造出抢占')
  assert.equal(v({ ts: G412_NOW - 1000, bootMs: G412_BOOT - 60_000 }).kind, 'consistent', '容差内的 NTP 微步进不得读成重启(否则秒抢活锁)')
  assert.match(v({ ts: G412_NOW + 10 * G412_MIN, host: 'other' }).reason, /别机持有/)
  assert.equal(v({ ts: G412_NOW - 1000, host: '' }).kind, 'unverifiable', '旧 meta 没记 host ⇒ 不冒用本机单调钟')
  assert.equal(v({ ts: G412_NOW - 1000 }, { uptimeMs: NaN }).kind, 'unverifiable', 'uptime 量不到 ⇒ 报名,不折叠成 consistent')
  const se = v({ ts: G412_NOW - 1000, bootMs: G412_BOOT - 10 * G412_MIN })
  assert.equal(se.mode, 'session-ended', '墙钟正常而开机锚点前移超容差 ⇒ 第二判据独立生效(旧判据在这一格只会 wait)')
  assert.match(se.why, /绝对存活时刻/)
})

test('G-412·记录侧:writeMeta 落 bootMs=now-uptime;量不到 ⇒ 整键不写(读侧落 unverifiable,不造假锚点)', () => {
  const base = mkScratch('dl-g412-write-')
  try {
    const d1 = join(base, 'w1')
    mkdirSync(d1, { recursive: true })
    L.writeMeta(d1, 'build', { ownerPid: process.pid, now: G412_NOW, uptimeMs: G412_UP, run: () => null })
    const m1 = JSON.parse(readFileSync(join(d1, 'meta.json'), 'utf8'))
    assert.equal(m1.bootMs, G412_BOOT)
    const d2 = join(base, 'w2')
    mkdirSync(d2, { recursive: true })
    L.writeMeta(d2, 'build', { ownerPid: process.pid, now: G412_NOW, uptimeMs: NaN, run: () => null })
    const m2 = JSON.parse(readFileSync(join(d2, 'meta.json'), 'utf8'))
    assert.equal(m2.bootMs, undefined, '量不到就不写 —— 伪造一个锚点等于给判据喂假证据')
    assert.equal(L.classifyMeta(JSON.stringify(m2)).meta.bootMs, 0, '缺省归一为 0 = "没有锚点"')
  } finally {
    rmScratch(base)
  }
})

test('G-412·break-stale 人工出口成对:空理由 ⇒ 拒绝且字节一字不动;带理由 ⇒ 活锁也先归档再原子断', () => {
  const base = mkScratch('dl-g412-break-')
  try {
    // 名义**存活**的持有者(自己的 pid):自动档在这一格绝不抢,人工出口的语义正是"人确认后断"。
    const raw = okMeta({ pid: process.pid, ownerPid: process.pid, ts: Date.now() })
    const dir = lockFixture(base, raw)
    const denied = L.breakStale({ dir, reason: '   ', log: () => {} })
    assert.equal(denied.ok, false, '空/纯空白理由必须即拒绝 —— 破坏性动作没有理由不改任何状态')
    assert.equal(readFileSync(join(dir, 'meta.json'), 'utf8'), raw, '拒绝分支不得碰锁的字节')
    assert.ok(existsSync(dir))
    const done = L.breakStale({ dir, reason: '镜像测试夹具:人工确认后的断锁出路对照', log: () => {} })
    assert.equal(done.ok, true, `带理由应断锁成功,实得 ${JSON.stringify(done)}`)
    assert.ok(!existsSync(dir), '断锁 = 原子改名到归档面,原路径必须消失(不是 removeLock 的直删)')
    const scene = readdirSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).filter((n) => n.includes('break-stale'))
    assert.ok(scene.length >= 1, '现场必须落进归档面(改名后的目录本身就带现场说明)')
  } finally {
    rmScratch(base)
  }
})

// ─────────  八、G-386(孪生 G-779):不可判定三态的"时钟倒挂"必须单独成档  ─────────
//
// 票面症状原话:「meta.ts(mtime/记录时刻)晚于当前时刻 ⇒ `Date.now() - ts` 为负 ⇒ 判据形如
// `age > staleMs` 恒 false ⇒ 锁永远活着」。G-412(上一节)修的是 **ok 态** 的未来 ts;
// 而 `age > staleMs` 这个谓词形状**只剩住在不可判定分支** —— 那面的年龄降级取锁目录 mtime,
// mtime 超容差落在未来 ⇒ `ageMs` 钳成 0 ⇒ `0 > staleMs` 恒假 ⇒ 该面无限 wait 到超时,
// 且旧文案把"超 stale"称作唯一自动出路(该形态下是撒谎)。
// 本节成对钉:①未来 mtime ⇒ 落进新档并**点名**(独立旗标 clockAnomalous,不与活着/已退出/等待并桶);
// ②正常新建 ⇒ 仍 wait;③正常陈旧 ⇒ 仍走原 stale 档且 why 不冒出倒挂措辞;④容差内 ⇒ 不记异常。
// 真实时钟倒挂事件未在本机复现,取证是**构造面**(utimesSync 造未来 mtime + 注入固定 now),不冒充实测。
const G386_NOW = 1_800_000_000_000
/** utimesSync 数值按秒解释(本机 Node v24 实测 ms 会 EINVAL)—— 统一在这里换算,调用方只给 ms 偏移 */
function setMtimeMs(dir, ms) {
  const sec = Math.round(ms / 1000)
  utimesSync(dir, sec, sec)
}
/** 不可判定面夹具:metaText=null ⇒ absent(不写 meta);deltaMs 相对 G386_NOW 的 mtime 偏移。
 *  ⚠️ 用 null 而不是 undefined 当哨兵:JS 默认参数对 undefined 生效,拿 undefined 传"absent"会
 *  被默认值吃掉、静默把 absent 臂写成 invalid(断言照绿,测的却是别的态)。 */
function undeterminedLock(base, deltaMs, metaText = '{"mode":"build","pid":') {
  const dir = lockFixture(base, metaText === null ? undefined : metaText)
  setMtimeMs(dir, G386_NOW + deltaMs)
  return dir
}

test('G-386·正向:不可判定(invalid/empty/absent)× 未来 mtime ⇒ 时钟倒挂独立档 steal+immediate:false,点名档位/态名/无锚点/人工出口', () => {
  const base = mkScratch('dl-g386-future-')
  try {
    for (const [label, text] of [
      ['invalid(半截 JSON)', '{"mode":"build","pid":'],
      ['invalid(空文件)', ''],
      ['absent(meta 从未写下)', null],
    ]) {
      const dir = undeterminedLock(base, L.FUTURE_TS_TOLERANCE_MS + 120_000, text)
      const d = L.decideSteal({ dir, mode: 'build', staleMs: 600_000, hardCapMs: L.HARD_CAP_MS, now: G386_NOW })
      assert.equal(d.action, 'steal', `${label}:年龄维被钉成恒假后不得无限 wait(这正是冻结 11h50m 那一型的另一面)。实得 ${d.action} / ${d.why}`)
      assert.equal(d.immediate, false, `${label}:必须"先归档现场再抢",不走秒抢通道`)
      assert.equal(d.clockAnomalous, true, `${label}:独立档必须自带旗标,不得与"活着/已退出/不可判定即等待"并桶`)
      assert.ok(Math.abs(d.futureMs - (L.FUTURE_TS_TOLERANCE_MS + 120_000)) < 2_000, `${label}:futureMs 是量出来的数,不是文案 —— 实得 ${d.futureMs}`)
      assert.match(d.why, /时钟倒挂档/, label)
      assert.match(d.why, /单调对账=无锚点/, `${label}:不可判定面没有 ts/host/bootMs,必须如实写无锚点,不硬凑`)
      assert.match(d.why, /break-stale/, `${label}:结论要带人工出口,不止"判不出来"`)
      assert.match(d.why, new RegExp(label.split('(')[0]), `${label}:why 必须点名到底是哪一态`)
    }
    // ok 态那一半(G-412 已修)顺带复验一次:本票说"可立即修"的前提是它没被回退 —— 回退即红。
    const okFuture = lockFixture(base, okMeta({ pid: process.pid, ownerPid: process.pid, ts: G386_NOW + 10 * 60_000 }))
    const dOk = L.decideSteal({ dir: okFuture, mode: 'build', staleMs: 600_000, hardCapMs: L.HARD_CAP_MS, now: G386_NOW })
    assert.equal(dOk.action, 'steal', 'ok 态未来 ts 若被改回 wait,G-412 的修复即被本票回退 —— 这条是防回退的对照')
  } finally {
    rmScratch(base)
  }
})

test('G-386·反向对照三支:正常新建 wait / 正常陈旧走 stale 档且无倒挂措辞 / 容差内不记异常(新档不得变成秒抢判据)', () => {
  const base = mkScratch('dl-g386-control-')
  try {
    // ① 正常新建(mtime 比 now 早 1s)⇒ wait,文案与改动前同形
    const w = L.decideSteal({ dir: undeterminedLock(base, -1000), mode: 'build', staleMs: 600_000, now: G386_NOW })
    assert.equal(w.action, 'wait', `正常新建的坏锁不该被动它 —— 为什么别人可能正崩在两步之间:${w.why}`)
    assert.equal(w.clockAnomalous, undefined, '不异常就不带异常旗标(否则"已核过"与"没核"在账面同形)')
    assert.match(w.why, /未超 stale/, `wait 文案保持原形:${w.why}`)
    // ② 正常陈旧(超 stale 1 分钟)⇒ 仍走**原 stale 档**,why 里不得冒出"时钟倒挂档"(两档各归各的措辞)
    const s = L.decideSteal({ dir: undeterminedLock(base, -(600_000 + 60_000)), mode: 'build', staleMs: 600_000, now: G386_NOW })
    assert.equal(s.action, 'steal', s.why)
    assert.match(s.why, /stale 阈值/, s.why)
    assert.doesNotMatch(s.why, /时钟倒挂档/, `旧出路不得被新档顶名(顶了 S63b 与本案就分不出是谁的红):${s.why}`)
    assert.equal(s.clockAnomalous, undefined)
    // ③ 未来但在容差内(半容差,如 NTP 微步进)⇒ 不记异常 ⇒ wait(容差语义一字未放宽)
    const within = L.decideSteal({ dir: undeterminedLock(base, Math.floor(L.FUTURE_TS_TOLERANCE_MS / 2)), mode: 'build', staleMs: 600_000, now: G386_NOW })
    assert.equal(within.action, 'wait', `容差内的未来读数不得升格成抢占:${within.why}`)
    assert.equal(within.clockAnomalous, undefined, within.why)
  } finally {
    rmScratch(base)
  }
})

test('G-386·端到端:acquire 经时钟倒挂档拿到锁并先按原字节归档现场(改前该形态只会 wait 到超时抛错)', async () => {
  const base = mkScratch('dl-g386-e2e-')
  try {
    const dir = lockFixture(base, '{"mode":"build","pid":')
    const raw = readFileSync(join(dir, 'meta.json'), 'utf8')
    // acquire 内部 now=Date.now() 不可注入 ⇒ 这一臂按真实时钟造未来 mtime(超容差 + 120s 余量)
    setMtimeMs(dir, Date.now() + L.FUTURE_TS_TOLERANCE_MS + 120_000)
    assert.equal(await L.acquire({ mode: 'build', timeoutMs: 5000, staleMs: 600_000, dir }), true)
    assert.equal(L.readMeta(dir).meta.pid, process.pid, '取得后锁必须是本次调用自己的')
    const sceneRoot = process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR
    const hit = readdirSync(sceneRoot).some((n) => {
      try {
        return readFileSync(join(sceneRoot, n, 'meta.json'), 'utf8') === raw
      } catch {
        return false
      }
    })
    assert.ok(hit, `抢占前必须按原字节归档现场(${sceneRoot}) —— immediate:false 的"先归档"不许被顺手削掉`)
  } finally {
    rmScratch(base)
  }
})

test('G-386·check 文案对账:异常面点名"时钟倒挂档"+人工出口;正常不可判定面不得被印成倒挂(防 S-正向恒真)', () => {
  const base = mkScratch('dl-g386-check-')
  try {
    let outA = ''
    assert.equal(
      L.check({ dir: undeterminedLock(base, L.FUTURE_TS_TOLERANCE_MS + 120_000), log: (s) => (outA += s), now: G386_NOW }),
      1,
    )
    assert.match(outA, /时钟倒挂档/, outA)
    assert.match(outA, /break-stale/, outA)
    let outB = ''
    L.check({ dir: undeterminedLock(base, -1000), log: (s) => (outB += s), now: G386_NOW })
    assert.doesNotMatch(outB, /时钟倒挂档/, `正常不可判定面被印成倒挂档 ⇒ 上面那条正向断言恒真,等于没有:${outB}`)
    assert.match(outB, /无法判定/, `基础三态如实打印不得被本票改动:${outB}`)
  } finally {
    rmScratch(base)
  }
})

// ─────────────────────  心跳(2026-10-01 补 §12 那格空白)  ─────────────────────
// 这把尺子判的是"锁的持有者活着时谁来刷新 ts、死了谁来交还"。dev 侧此前没有答案:
// predev 那条生命周期脚本在 dev server 起来之前就退了,它写下的 owner 一落地就是死的,
// 于是那把锁从第一步起就是可被立即抢占的悬挂锁(见 dev-with-warmup.mjs 第 0 步头注)。
const HB = { mode: 'dev', token: 't'.repeat(32), ownerPid: 4242 }
const hbMeta = (over = {}) =>
  JSON.stringify({ mode: 'dev', pid: 4242, ownerPid: 4242, ts: 1_700_000_000_000, token: HB.token, ...over })
const hbArgs = (over = {}) => ({
  state: { kind: 'ok', meta: JSON.parse(hbMeta(over.meta)) },
  mode: 'dev',
  token: HB.token,
  watchPid: 4242,
  watchAlive: true,
  ...over,
})

test('HB-M1 五档处置互斥:凭据/归属/存活/身份/寿命各管一头,不得互相顶', () => {
  const A = L.heartbeatAction
  assert.equal(A(hbArgs()).action, 'renew', '全对时不续期 = 这台心跳根本没在动')
  assert.equal(A(hbArgs({ watchAlive: false })).action, 'release')
  assert.equal(A(hbArgs({ identityKind: 'mismatch' })).action, 'release')
  assert.equal(A(hbArgs({ identityKind: 'unverifiable' })).action, 'renew', '量不到身份不得多删一把锁')
  assert.equal(A(hbArgs({ token: 'x'.repeat(32) })).action, 'stop')
  const noCred = { kind: 'ok', meta: JSON.parse(hbMeta({ token: undefined })) }
  assert.equal(A(hbArgs({ state: noCred })).action, 'stop')
  assert.equal(A(hbArgs({ watchPid: 9999 })).action, 'stop')
  assert.equal(A(hbArgs({ state: { kind: 'absent', reason: 'x' } })).action, 'stop')
  assert.equal(A(hbArgs({ mode: 'build' })).action, 'stop')
  // 寿命到 ⇒ 只停手,不删(dev 还活着时删锁 = 自己撤保护)
  assert.equal(A(hbArgs({ ageMs: L.HEARTBEAT_DEFAULTS.maxLifetimeMs + 1 })).action, 'stop')
})

test('HB-M2 端到端真 CLI:活着就续、死了就交还,且只动夹具里的锁目录', async () => {
  const base = mkScratch('deploy-lock-hb-mirror-')
  let child = null
  try {
    const dir = join(base, 'lock')
    child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true })
    await new Promise((r) => setTimeout(r, 700))
    const cli = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', windowsHide: true, timeout: 30_000 })
    const ac = cli(['acquire', '--mode', 'dev', '--lock-dir', dir, '--owner-pid', String(child.pid), '--token', HB.token])
    assert.equal(ac.status, 0, `acquire 失败:${ac.stderr}`)
    const before = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
    assert.equal(before.pidStart > 0, true, 'owner 是真 pid ⇒ 必须留下身份锚点(否则下一轮无从判断是不是同一个进程)')
    const hb1 = cli(['heartbeat', '--mode', 'dev', '--lock-dir', dir, '--token', HB.token, '--watch-pid', String(child.pid), '--once'])
    assert.equal(hb1.status, 0, `心跳第一轮失败:${hb1.stdout}${hb1.stderr}`)
    const after = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
    assert.ok(after.ts >= before.ts, '续期没推进 ts')
    assert.equal(after.token, before.token, '续期换了凭据 ⇒ 下一轮自己都不认自己')
    assert.equal(after.ownerPid, before.ownerPid, '续期动了 owner = 心跳在改归属而不是在续期')
    // 交还的前提是"心跳盯的就是那个刚退场的主人":watch-pid 必须与 meta.ownerPid 同值,
    // 否则 heartbeatAction 会先落在"ownerPid 已漂 ⇒ 已被别人接管 → stop"那一档,
    // 测到的是接管判据而不是存活判据(生产代码没错,是这一格夹具曾错过)。
    const victim = child.pid
    child.kill()
    child = null
    await new Promise((r) => setTimeout(r, 700))
    const hb2 = cli(['heartbeat', '--mode', 'dev', '--lock-dir', dir, '--token', HB.token, '--watch-pid', String(victim), '--once'])
    assert.equal(hb2.status, 0, `主人退场后的收口失败:${hb2.stdout}${hb2.stderr}`)
    assert.equal(existsSync(dir), false, '主人已退出而锁还挂着 ⇒ 交还动作没发生')
  } finally {
    if (child) child.kill()
    rmScratch(base)
  }
})

test('HB-M3 接线锁:dev 启动器必须 acquire→派心跳→退出走 quit 交还', () => {
  const warm = readFileSync(resolve(HERE, '..', 'dev-with-warmup.mjs'), 'utf8')
  assert.match(warm, /import \{ acquire, release, lockOwnedBy \} from '\.\/deploy-lock\.mjs'/, '启动器自己拼锁路径 = 第二份归属判据')
  assert.match(warm, /await acquire\(\{[\s\S]{0,240}mode: 'dev'[\s\S]{0,240}token: LOCK_TOKEN/, '没在起 dev 之前拿锁')
  assert.match(warm, /lockOwnedBy\(LOCK_TOKEN\)/, 'acquire 在共存档也返回 true ⇒ 不核归属就派心跳会替别人的锁永久续期')
  assert.match(warm, /'heartbeat'[\s\S]{0,420}--watch-pid[\s\S]{0,90}String\(process\.pid\)/, '心跳没盯启动器自己')
  assert.match(warm, /windowsHide: true/, 'detached 派生控制台程序不带 windowsHide ⇒ 用户桌面反复弹窗(§5b)')
  assert.match(warm, /dev\.on\('exit',\s*\(code\)\s*=>\s*quit\(/, 'dev 退出没走 quit ⇒ 锁留在原地等着被抢')
  assert.match(warm, /const quit = \(code\)/, 'quit 出口不见了')
})

test('HB-M4 反向锁:裸 process.exit 与"predev 再拿一次锁"都必须被读出', () => {
  const warm = readFileSync(resolve(HERE, '..', 'dev-with-warmup.mjs'), 'utf8')
  // 判"接线在位"的断言必须有牙:把 quit 换回裸 process.exit,上面那条就该不成立
  assert.doesNotMatch(warm.replace(/dev\.on\('exit',\s*\(code\)\s*=>\s*quit\(/, "dev.on('exit', (code) => process.exit("), /dev\.on\('exit',\s*\(code\)\s*=>\s*quit\(/)
  // predev 不得再 acquire:它的 shell 在 dev 起来前就退,留下的是一副可被立即抢占的悬挂锁,
  // 而 warmup 会去抢它 ⇒ 每次起 dev 都刷一条"抢占悬挂锁"的假事故。
  const pkg = JSON.parse(readFileSync(resolve(HERE, '..', '..', 'apps', 'web', 'package.json'), 'utf8'))
  assert.doesNotMatch(String(pkg.scripts?.predev ?? ''), /deploy-lock\.mjs acquire/, 'predev 又拿了一次锁(与启动器的锁互抢)')
  // 但另两条不经启动器的入口必须自己拿 —— 它们的 shell 与 next dev 同生死,是有效持有者
  assert.match(String(pkg.scripts?.['dev:clean'] ?? ''), /deploy-lock\.mjs acquire --mode dev/, 'dev:clean 丢了锁')
  assert.match(String(pkg.scripts?.['dev:stable'] ?? ''), /deploy-lock\.mjs acquire --mode dev/, 'dev:stable 丢了锁')
})

test('HB-M5 装车证明:deploy-lock --self-test 必须真跑得过(镜像绿而自检没接=没验过)', async () => {
  const r = await new Promise((res) => {
    const c = spawn(process.execPath, [SCRIPT, '--self-test'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let out = ''
    c.stdout.on('data', (d) => (out += d))
    c.stderr.on('data', (d) => (out += d))
    c.on('exit', (code) => res({ code, out }))
  })
  assert.equal(r.code, 0, `自检没通过:\n${r.out.slice(-800)}`)
  assert.match(r.out, /HB1\b.*⇒ 续期/s, 'HB 那一族没被跑到(名字不在输出里)= 判据写出来无人调')
  assert.match(r.out, /HB15d[^\n]*✅|✅ HB15d/, '接线共存档那一档没落地')
})

// ─────────── 2026-10-02 补锁票:`acquire --with-heartbeat` 与 `run`(镜像层) ───────────
// 判据一律引 `L.*`(源脚本的 __test__),本文件不重写"什么算该派心跳/退出码怎么收口"。
const HB2_TOKEN = 'c'.repeat(32)
const hb2Meta = (over = {}) => ({ mode: 'dev', pid: 4242, ownerPid: 4242, ts: 1, token: HB2_TOKEN, ...over })
const hb2Plan = (over = {}) =>
  L.heartbeatSpawnPlan({ mode: 'dev', dir: over.dir ?? 'X:/fixture/lock-dir', token: HB2_TOKEN, meta: hb2Meta(), owned: true, ...over })

test('HB-M6 派生判据四档互斥:该派时 argv 逐字钉死,不该派的三种各有各的 kind(不得并成一档)', () => {
  const p = hb2Plan()
  assert.equal(p.spawn, true)
  assert.equal(p.file, process.execPath, '派生必须用当前 node 可执行文件(裸 "node" 在服务/CI 身份下不可解析)')
  const args = p.args
  assert.equal(args[1], 'heartbeat', 'argv[0] 是自脚本,第二项才是子命令')
  assert.ok(args.includes('--lock-dir'), '不带 --lock-dir ⇒ 心跳会去刷项目根的真锁(测试夹具吃掉真锁 = 并发事故)')
  assert.equal(args[args.indexOf('--lock-dir') + 1], resolve('X:/fixture/lock-dir'))
  assert.equal(args[args.indexOf('--watch-pid') + 1], '4242', '盯的必须是落盘 ownerPid,不是 CLI 自己的 pid')
  assert.equal(args[args.indexOf('--token') + 1], HB2_TOKEN)
  // 三档"不该派"各有各的原因,合并成一档就说明判据丢了维度
  assert.equal(hb2Plan({ owned: false }).kind, 'not-owned')
  assert.equal(hb2Plan({ token: '' }).kind, 'no-credential')
  assert.equal(hb2Plan({ meta: hb2Meta({ ownerPid: 0 }) }).kind, 'no-watch-pid')
})

test('HB-M7 run 端到端真 CLI:退出码透传 + 跑完交还;上层持锁时子层不自锁、也不碰别人的锁', () => {
  const base = mkScratch('deploy-lock-run-mirror-')
  try {
    const cli = (args, env) =>
      spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', windowsHide: true, timeout: 90_000, env })
    const dir = join(base, 'lock')
    const r = cli([
      'run', '--mode', 'build', '--lock-dir', dir, '--timeout', '20000', '--stale', '20000', '--',
      process.execPath, '-e', 'process.exit(3)',
    ])
    assert.equal(r.status, 3, `退出码没透传(实得 ${r.status}):${r.stdout}${r.stderr}`)
    assert.equal(existsSync(dir), false, '命令跑完了锁还在 ⇒ 下一位要么白等、要么按悬挂锁抢,两种都不对')
    const ok = cli(['run', '--mode', 'build', '--lock-dir', join(base, 'lock2'), '--timeout', '20000', '--stale', '20000', '--', process.execPath, '-e', 'process.exit(0)'])
    assert.equal(ok.status, 0, `成功路径被改坏了:${ok.stdout}${ok.stderr}`)
    // 再入:别人的活锁在场 + 环境里已声明上层持有 ⇒ 不得 acquire(否则会等满 timeout 再失败)。
    const foreign = join(base, 'lock3')
    mkdirSync(foreign, { recursive: true }) // writeMeta 只写目录里那份 meta,不替调用方建目录
    L.writeMeta(foreign, 'build', { ownerPid: process.pid, token: 'f'.repeat(32) })
    const nested = cli(
      ['run', '--mode', 'build', '--lock-dir', foreign, '--timeout', '20000', '--stale', '20000', '--', process.execPath, '-e', 'process.exit(0)'],
      { ...process.env, IHUI_DEPLOY_LOCK_HELD: 'build:上层已持' },
    )
    assert.equal(nested.status, 0, `带再入标记仍去抢锁(等满超时的话这里就是 1):${nested.stdout}${nested.stderr}`)
    assert.equal(L.readMeta(foreign).meta.token, 'f'.repeat(32), '子层把别人的锁交还了 = 上层还在跑,锁却没了')
    assert.match(nested.stdout, /IHUI_DEPLOY_LOCK_HELD/, '走了再入通道却没喊出来 = 下一次没人知道它为什么没拿锁')
  } finally {
    rmScratch(base)
  }
})

test('HB-M8 接线锁:apps/web 的 build 走 run、prebuild 不再 acquire、dev:clean/dev:stable 带心跳旗(含反向对照)', () => {
  const pkg = JSON.parse(readFileSync(resolve(HERE, '..', '..', 'apps', 'web', 'package.json'), 'utf8'))
  const s = (k) => String(pkg.scripts?.[k] ?? '')
  assert.match(s('build'), /deploy-lock\.mjs run --mode build/, 'build 又变成裸 next build ⇒ 锁与命令分家,prebuild 那把锁的主人一落地就是死的')
  assert.match(s('build'), /-- node --max-old-space-size=8192 node_modules\/next\/dist\/bin\/next build$/, '搬进 run 的必须是原来那条命令,一字不改(堆参数丢了会 OOM)')
  assert.doesNotMatch(s('prebuild'), /deploy-lock\.mjs acquire/, 'prebuild 还留着 acquire = 每次构建都去拿一把它带不走的锁')
  assert.match(s('prebuild'), /pnpm --filter @ihui\/extension build/, 'prebuild 的正事不能被动到')
  assert.match(s('dev:clean'), /acquire --mode dev --with-heartbeat/)
  assert.match(s('dev:stable'), /acquire --mode dev --with-heartbeat/)
  // 反向对照:上面这些正则必须是**有牙的** —— 把形态改回旧样,断言就该不成立
  assert.doesNotMatch(s('build').replace('deploy-lock.mjs run', 'node'), /deploy-lock\.mjs run/)
  assert.doesNotMatch(s('dev:clean').replace(' --with-heartbeat', ''), /--with-heartbeat/)
})

test('HB-M9 装车证明:--self-test 里 AH/RU 两族真被跑到并全绿(判据写了没人登记=没验过)', async () => {
  const r = await new Promise((res) => {
    const c = spawn(process.execPath, [SCRIPT, '--self-test'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let out = ''
    c.stdout.on('data', (d) => (out += d))
    c.stderr.on('data', (d) => (out += d))
    c.on('exit', (code) => res({ code, out }))
  })
  assert.equal(r.code, 0, `自检没通过:\n${r.out.slice(-600)}`)
  for (const name of ['AH1', 'AH7', 'AH8', 'RU1', 'RU3', 'RU4', 'RU6']) {
    assert.match(r.out, new RegExp(`✅ ${name}\\b`), `${name} 这一档没出现在自检输出里 = 判据写了没人登记/没人调`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

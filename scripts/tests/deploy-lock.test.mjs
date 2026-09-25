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
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as L } from '../deploy-lock.mjs'

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

// ───────────────── 四、默认语义与红线不变量 ─────────────────
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

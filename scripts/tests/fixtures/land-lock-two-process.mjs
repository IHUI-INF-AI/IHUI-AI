// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单实例闸的双进程夹具(供 object-space-land-single-instance.test.mjs ⑪ 使用)。
 *
 * 为什么必须用两个真进程:`tryAcquireSingleInstance` 的三条核心规矩里有两条**在同一进程内证不出来**——
 *  ① "持有者活着的锁绝不抢"要问的是另一个 pid 的死活;
 *  ② "跳过者拿不到 release、也删不掉别人的活锁"要防的正是同 unit 误交。
 * 单进程里注入假 acquireOnce 只能证算术,证不了这两条,所以这一枚走真进程 + 真锁目录。
 *
 * 用法:node land-lock-two-process.mjs <A|B> <夹具根>
 * B 侧等待上限由 IHUI_LAND_SINGLE_INSTANCE_WAIT_MS 控制(测试里给 1ms ⇒ 一枚都不等)。
 */
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { acquireLandLock, landLockDirOf } from '../../object-space-land.mjs'

const ROLE = process.argv[2]
const FIXTURE_ROOT = process.argv[3]
if (!ROLE || !FIXTURE_ROOT) {
  console.error('用法: node land-lock-two-process.mjs <A|B> <夹具根>')
  process.exit(9)
}
// 夹具根刻意**不预建** `.ihui-agent/state`:那正是把 105 项套件顶红 61 项的那一格现场,
// 留着它才证得出"父层缺失由闸自己补",而不是由测试替它补好。
const repo = join(FIXTURE_ROOT, 'repo')
mkdirSync(repo, { recursive: true })
const lockDir = landLockDirOf(repo)

const hold = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

if (ROLE === 'A') {
  const a = acquireLandLock({ dir: lockDir })
  console.log(`A acquired=${a.acquired} kind=${a.kind} attempts=${a.attempts}`)
  if (!a.acquired) {
    console.error(`A 为什么拿不到:${String(a.why).slice(0, 200)}`)
    process.exit(3)
  }
  try {
    const meta = JSON.parse(readFileSync(join(lockDir, 'meta.json'), 'utf8'))
    console.log(`A 持有中 unit=${meta.unitId} pid=${meta.pid}`)
  } catch {
    console.log('A 的 meta 读不到(不致命,但 B 侧读数会落到"未报到")')
  }
  hold(6_000) // 攥住 6 秒,期间 B 来抢
  const rel = a.release()
  console.log(`A released=${rel?.released} why=${String(rel?.why ?? '')}`)
  process.exit(rel?.released ? 0 : 4)
}

const b = acquireLandLock({ dir: lockDir })
console.log(
  `B acquired=${b.acquired} kind=${b.kind} timedOut=${b.timedOut} attempts=${b.attempts} ` +
    `release=${b.release === null ? 'null(对)' : '非null(错)'} ` +
    `持有者 pid=${b.holder?.pid ?? '(未报)'}`,
)
console.log(`B why=${String(b.why).slice(0, 200)}`)
console.log(`锁仍在(${existsSync(lockDir) ? '对' : '错:被抢删了'})`)
if (b.release) {
  console.log('❌ B 拿到了 release ⇒ 它会交还一把不是它的锁')
  process.exit(5)
}
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

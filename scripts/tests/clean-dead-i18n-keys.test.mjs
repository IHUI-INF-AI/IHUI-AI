// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「删键之前先验消费者」这道防线的回归钉(2026-10-05 立)。
 * 跑法:node --test scripts/tests/clean-dead-i18n-keys.test.mjs
 *
 * 钉的是 2026-09-26 那次真实事故:`154f407499`「摘除 8 条零消费者死腿 + 同批清 12 个语言包死键」
 * 一批删掉 miniapp-taro 12 个**仍被消费**的键,而删除动作没有任何出口会验证这件事。
 * 伤到用户的形式有两种,本票两种都钉:
 *   ① 带兜底文案的 `tt(key, '中文')` ⇒ 缺键不报错,回退显示中文
 *      ⇒ 中文界面毫无异样,en/ja/ko 三个非中语言静默显示中文(G-1058616 那一族);
 *   ② 单参 `t(key)` ⇒ 兜底文案压根没有,`translate()` 直接返回 key 字面量
 *      ⇒ 界面显示「tail.8」(`PageLoading.tsx:12` 那一族)。
 * 两者都靠"本机语言看不出来"活过了 9 天。
 *
 * 断言:
 *   T1 阳性对照 —— 事故同族里载体仍在取词面的 2 个键逐条现读,必须**全部**判为"仍被消费";
 *   T1c 载体位置锁 —— 其余 9 枚的载体已随 `9936c8b41e` 从提交面删除(`verify.getCode` 只剩
 *       承载闭包外的 mobile-rn 副本),必须逐条判死,且用 git 提交面取证载体位置,不是放宽判据;
 *   T2 反向证明 —— 真死的键必须放行(否则这把刀变成"什么都删不掉"的恒红面,下一个人会绕开它);
 *   T3 fail-closed —— 取材失败(consumers 为 null)按"还有消费者"处理,不许当"无消费者"放行;
 *   T4 取材面同源 —— 守卫扫的目录必须覆盖事故文件的所在目录(apps/miniapp-taro/src),
 *      否则 T1 会在"扫错面"的前提下也变绿,变成一把量不到自己的尺。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectConsumers, verifyAllDead, isStillConsumed } from '../clean-dead-i18n-keys.mjs'
import { TARGETS } from '../lib/i18n-scan-targets.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const TARGETS_PATH = resolve(HERE, '../lib/i18n-scan-targets.mjs')

/**
 * 事故同族:154f407499 删掉的 12 个键(第 12 个 tail.8 由 G-1058616 之后单独查出并补回)。
 * 2026-10-16 现读更正:`Menu.d1` 从本清单摘出 —— 它的载体 `apps/miniapp-taro/src/components/Menu.tsx`
 * 已随 `a86e4cc821`(摘除零消费者跨端死载体)从提交面删除,键因此成真孤儿,五语言同批清掉。
 * 该事实另由 T1b 反向钉住(键不在词包 ⇒ 删键防线必须放行),不是把判据放宽。
 */
// 2026-11-04 现读更正:事故同族仍存 11 枚,按「载体还在不在取词面」拆两档(总数不变)。
//  · 载体仍在:miniapp 的 components/VoiceInput.tsx:12 与 components/PageLoading.tsx:12;
//  · 载体已删:`9936c8b41e` 把 24 件零运行时 import 的孤儿副本整批摘出提交面,VerifyCodeModal /
//    Toast / Tooltip 等原件随之消失;`verify.getCode` 只剩 apps/mobile-rn 的同名组件,而该文件
//    不在 miniapp 承载闭包里(闭包只取 @rn-shells 可达的 184 枚),对本端是真孤儿。
// 摘出没有放宽判据:下面的 T1c 反而把「载体位置」也钉住(含 git 提交面取证)。
const INCIDENT_KEYS_STILL_CONSUMED = [
  ['VoiceInput', 'p1'],
  ['tail', '8'],
]
const INCIDENT_KEYS_CARRIER_REMOVED = [
  ['VerifyCodeModal', 'p2'],
  ['VerifyCodeModal', 'p3'],
  ['verify', 'phoneEmpty'],
  ['verify', 'phoneInvalid'],
  ['verify', 'codeSent'],
  ['verify', 'codeIncomplete'],
  ['verify', 'verifySuccess'],
  ['tail', '12'],
]
const INCIDENT_KEYS_CARRIER_OUT_OF_SURFACE = [['verify', 'getCode']]

/** 提交面取证:HEAD 上该路径是否存在(不受盘上残留影响)。 */
function fileAtHead(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${rel}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

test('T1 阳性对照:事故同族里载体仍在取词面的键必须逐条判为「仍被消费」', () => {
  const consumers = collectConsumers('miniapp-taro')
  assert.ok(consumers && consumers.scanned > 0, '取材失败:扫到 0 个文件 ⇒ 下面全是空断言')
  const stillAlive = INCIDENT_KEYS_STILL_CONSUMED.filter(([ns, key]) =>
    isStillConsumed(`${ns}.${key}`, consumers),
  ).map(([ns, key]) => `${ns}.${key}`)
  assert.deepEqual(
    stillAlive.sort(),
    INCIDENT_KEYS_STILL_CONSUMED.map(([ns, key]) => `${ns}.${key}`).sort(),
    '有键被判成"没人消费"⇒ 删键防线在这条上不咬,等于没装',
  )
})

test('T1c 载体位置锁:载体已不在取词面的 9 枚必须逐条放行,且载体位置可证', () => {
  const consumers = collectConsumers('miniapp-taro')
  assert.ok(consumers && consumers.scanned > 0, '取材失败:扫到 0 个文件 ⇒ 下面全是空断言')
  const orphans = [...INCIDENT_KEYS_CARRIER_REMOVED, ...INCIDENT_KEYS_CARRIER_OUT_OF_SURFACE]
  const stillAlive = orphans
    .filter(([ns, key]) => isStillConsumed(`${ns}.${key}`, consumers))
    .map(([ns, key]) => `${ns}.${key}`)
  assert.deepEqual(
    stillAlive,
    [],
    '载体已不在取词面却被判"仍被消费"⇒ 取材面读到了承载闭包外的 RN 文件,删键防线会恒红',
  )
  // 载体位置取证 ①:原件已从提交面删除(9936c8b41e),故这 8 枚是真孤儿。
  assert.equal(
    fileAtHead('apps/miniapp-taro/src/components/VerifyCodeModal.tsx'),
    false,
    'VerifyCodeModal.tsx 必须已不在 HEAD,否则该组键应按"仍被消费"处理',
  )
  // 载体位置取证 ②:verify.getCode 的载体还在,但只在 mobile-rn 且不在 miniapp 承载闭包的扫描面里。
  assert.equal(
    fileAtHead('apps/mobile-rn/src/components/VerifyCodeModal.tsx'),
    true,
    'mobile-rn 的 VerifyCodeModal.tsx 必须仍在 HEAD,证明该键的引用点确实存在而非凭空判死',
  )
  assert.equal(
    TARGETS['miniapp-taro'].scanTargets.includes('apps/mobile-rn/src/components/VerifyCodeModal.tsx'),
    false,
    '该文件不在 miniapp 承载闭包 ⇒ 对本端是真孤儿;若哪天进了闭包,本组要并回 T1',
  )
  assert.equal(
    verifyAllDead(
      { verify: ['phoneEmpty'], VerifyCodeModal: ['p2', 'p3'], tail: ['12'] },
      consumers,
      'miniapp-taro',
    ),
    true,
    '载体已删的键必须放行,否则清死键的人只能绕过这道防线',
  )
})

test('T1b 反向锁:载体被摘除的那枚键必须放行(2026-10-16 现读,Menu.d1 ⇒ a86e4cc821)', () => {
  const miniapp = collectConsumers('miniapp-taro')
  assert.equal(
    isStillConsumed('Menu.d1', miniapp),
    false,
    'Menu.tsx 已从提交面摘除,Menu.d1 若还被判"仍被消费"说明取材面读到了盘上残留 ⇒ 删键防线会被顶绿',
  )
  assert.equal(
    verifyAllDead({ Menu: ['d1'] }, miniapp, 'miniapp-taro'),
    true,
    '真孤儿键必须放行,否则清键的人只能绕过这道防线',
  )
})

test('T2 反向证明:真死的键必须放行(不能变成什么都删不掉)', () => {
  // `news.views` 是本仓清单里唯一一个至今仍判死的键(2026-10-05 现读:mobile-rn 46 键 +
  // miniapp-taro 1 键全部判死,news.views 是其中之一)。若这道防线只会拒不会放,
  // 下一个要清死键的人会直接绕过它 ⇒ 那才是真隐患。
  const miniapp = collectConsumers('miniapp-taro')
  assert.equal(
    verifyAllDead({ news: ['views'] }, miniapp, 'miniapp-taro'),
    true,
    'news.views 现读判死,应放行',
  )
  assert.equal(
    verifyAllDead({ tail: ['8'] }, miniapp, 'miniapp-taro'),
    false,
    'tail.8 载体仍在取词面,必须拒删',
  )
  assert.equal(
    verifyAllDead({ tail: ['12'] }, miniapp, 'miniapp-taro'),
    true,
    'tail.12 的载体已随 9936c8b41e 删除,必须放行',
  )
})

test('T3 fail-closed:取材失败按「还有消费者」处理,不得当无消费者放行', () => {
  // 判不出 ⇒ 未判定;未判定不得被读成"死"。这一格若折成"没扫到就是没人用",
  // 一次取材失败就能把整批活键删掉 —— 与本仓"未判定≠通过"同一条纪律。
  assert.equal(isStillConsumed('anything.atAll', null), true)
  assert.equal(verifyAllDead({ anything: ['atAll'] }, null, 'x'), false)
})

test('T4 取材面同源:守卫扫的目录覆盖事故文件所在目录(否则 T1 是量不到自己的尺)', () => {
  // 事故文件:apps/miniapp-taro/src/components/{Menu,VerifyCodeModal,VoiceInput,PageLoading}.tsx
  // 若哪天有人把 apps/miniapp-taro/src 从取材面里摘掉(为别的目的),T1 会因为"扫不到消费方"
  // 而翻红 —— 但那时它翻红的原因是扫错面,不是判据坏;反过来若有人只改判定不改面,
  // T1 就可能在面不全的情况下**假绿**。故把面本身也钉住。
  assert.ok(
    TARGETS['miniapp-taro'].scanTargets.includes('apps/miniapp-taro/src'),
    'miniapp-taro 取材面必须含 apps/miniapp-taro/src',
  )
  const src = readFileSync(TARGETS_PATH, 'utf8')
  assert.match(src, /apps\/miniapp-taro\/src/, '配置的唯一出处里必须逐字写着该目录')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

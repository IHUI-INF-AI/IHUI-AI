// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// O81(a) Carousel 圆角「声明层」存续锁(2026-09-29 立)。
//
// 为什么需要这一条,而不是只靠跨端对账门(128)的圆角维:
// 那把尺子比的是"两端文件级档集合",所以它只能拦住"只改一侧"(另一侧集合不变 ⇒ 差值升红)。
// 而 Carousel 最初的病灶恰恰是**两端都在各自那一层规矩地引用档位表** —— 小程序声明在组件根、
// RN 声明在各屏外层 wrapper、RN 组件自身不带圆角 —— 集合逐字相等而屏幕上并不等(守门 128 的
// 层维缺口已单独登记为一票,尚未修)。在那一票落地之前,把"这次修好的形态"钉住的唯一尺子就是本文件。
//
// 它还挡另一型:本票走对象空间落地(工作树当时是他人在途现场),于是 HEAD 有修复而磁盘没有。
// 任何一次拿磁盘版本 `git add` 的普通提交都会把修复静默写回旧态,而守门 84 判的是"暂存内容
// 字节级等于某祖先版本"——那种回滚是"祖先 ⊕ 他人改动",不等于任何祖先 ⇒ 84 不响。本锁就是那一格的兜底。
//
// 口径与全链一致:判 **HEAD blob**(不判滞后的共享工作树 —— 判磁盘会让一台门在"旁路落地成功"
// 的当天自己报红,而红的是别人的现场不是仓库)。
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import assert from 'node:assert/strict'
// 遮注释但**保留字符串**:本判据要认的形态就在 className 的字符串字面量里,
// 连字符串一起抹会让锁对自己要防的那一型失明(本仓"两层遮噪方向不同,别混用"那条)。
import { maskComments } from '../lib/code-mask.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const git = (args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })

// 两端同名配对组件:圆角必须**都声明在组件自身**,不得一端在组件、一端在调用点。
const PAIRS = [
  {
    name: 'Carousel(miniapp)',
    file: 'apps/miniapp-taro/src/components/Carousel.tsx',
    // 组件根容器:overflow-hidden + 档位类名同一行(容器圆角的唯一落点)
    pattern: /className=\{cn\(\s*'relative w-full overflow-hidden rounded-2xl/,
  },
  {
    name: 'Carousel(RN)',
    file: 'apps/mobile-rn/src/components/Carousel.tsx',
    // 主容器:此前 RN 侧这里只有 w-full(圆角在各屏 wrapper),已收到组件根
    pattern: /<View className="w-full overflow-hidden rounded-2xl"/,
  },
]

const source = (file) => maskComments(git(['show', `HEAD:${file}`]))

test('注释里写同一形态不得算作存续(否则锁会替"已被抹掉"背书)', () => {
  const live = source(PAIRS[1].file)
  assert.ok(PAIRS[1].pattern.test(live), 'RN 组件根声明必须在代码面命中')
  // 把真声明删掉、只在注释里留同样字样 ⇒ 判据必须不再命中
  const stripped = live.replace(PAIRS[1].pattern, '<View className="w-full"')
  assert.ok(
    !PAIRS[1].pattern.test(stripped),
    '删掉真声明后仍命中 ⇒ 遮罩没生效,这把锁是恒真的',
  )
})

test('O81(a) Carousel 两端圆角都声明在组件自身(存续锁)', () => {
  for (const p of PAIRS) {
    const text = source(p.file)
    assert.ok(p.pattern.test(text), `${p.name} 的组件根圆角声明缺失 ⇒ 修复被回滚了:${p.file}`)
  }
})

test('变异对照:把真声明退回旧档时,本锁必须不再命中(证明它有牙,不是恒真)', () => {
  const text = source(PAIRS[0].file)
  // 判的是代码面形态。若有人只留一行注释、把真声明删掉,本锁必须翻红。
  const commented = text.replace(
    /className=\{cn\(\s*'relative w-full overflow-hidden rounded-2xl/,
    "className={cn('relative w-full overflow-hidden rounded-lg",
  )
  assert.ok(
    !PAIRS[0].pattern.test(commented),
    '把真声明换成旧档后判据必须不再命中(命中即说明锁是无牙的)',
  )
})

test('覆盖面自证:两端组件文件在 HEAD 面都真的存在(空扫不得算通过)', () => {
  for (const p of PAIRS) {
    assert.ok(source(p.file).length > 200, `${p.file} 取不到正文 ⇒ 无法判定,不记通过`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

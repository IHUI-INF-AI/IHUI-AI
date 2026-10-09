// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-611 闭环夹具 —— 它**不带 .test 后缀**:vitest 的 include 只收 tests 目录下的
 * test 文件,本文件不被当套件,而是被 tests/shutdown-signals.test.ts spawn 的**子进程入口**。
 * 被 spawn 的形态复刻 index.ts 的注册方式:带闩的 handler 装进
 * process.on('SIGTERM'/'SIGINT')。第一下走"慢停机"(400ms 后才 exit(0))—— 刻意异步:
 * 若把 exit(0) 排在同步路径里,emit-twice 那两下之间就没有挂起窗口,"二信号强杀"那一支
 * 会退化成恒成立。第二下必须被闩接住并产出 128+N —— 父侧读到的退出码就是产出侧存在的证据。
 *
 * arms:
 *   emit-once       首信号(事件层 emit,监听器与真信号走同一入口)⇒ 有序停机 ⇒ exit 0
 *                   (对照臂:第一下不得被强杀、不得挂死)
 *   emit-twice      连着两下 ⇒ 第二下产出 143(票面"父侧读到 143 判临时失败"的进程臂)
 *   selfterm-once   真信号(POSIX:process.kill 投给 self)⇒ 被捕获、有序停机 ⇒ exit 0
 *   selfterm-twice  真信号连两下 ⇒ 第二下产出 143
 *   hold            只注册不触发(留给需要外部连杀的臂)
 *
 * selfterm 两臂在 Windows 上机制性不可用(process.kill 自杀 = TerminateProcess,
 * 监听器不会跑),由调用侧跳过并写明原因;emit 两臂覆盖的是同一监听器与同一个闩。
 *
 * 注释卫生(本文件被自己咬过一次):块注释里写出 glob 的"双星斜杠"序列会**提前闭合注释**
 * (esbuild 报 Unexpected "*"),tsx 子进程整个起不来 —— 所以这里的注释不写那个序列。
 */
import { createShutdownSignalHandler } from '../../src/lib/shutdown-signals.js'

const arm = process.argv[2] ?? 'hold'

const handler = createShutdownSignalHandler({
  shutdown: () =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
        // 与 index.ts 的 shutdown 同形:有序停机以 exit(0) 收尾
        process.exit(0)
      }, 400)
    }),
  exit: (code) => process.exit(code),
  warn: (message) => console.error(`[fixture] ${message}`),
})

process.on('SIGTERM', () => handler('SIGTERM'))
process.on('SIGINT', () => handler('SIGINT'))

if (arm === 'emit-once') {
  // Node 内部信号投递就是 process.emit(信号名) —— 从这里走与真信号同一条监听器路径
  process.emit('SIGTERM')
} else if (arm === 'emit-twice') {
  process.emit('SIGTERM')
  process.emit('SIGTERM')
} else if (arm === 'selfterm-once' || arm === 'selfterm-twice') {
  // 握手行必须走 **stdout**(父进程读的就是 stdout);console.info 走 stderr 会把握手打断,
  // 所以这里不经 console 直接写 stdout —— 既守 no-console,也保住"ready"这条进程间协议。
  process.stdout.write('ready\n')
  process.kill(process.pid, 'SIGTERM')
  if (arm === 'selfterm-twice') process.kill(process.pid, 'SIGTERM')
  // 保持存活等投递(装了监听器 ⇒ 默认动作已被抑制)
  setInterval(() => {}, 1000)
} else if (arm === 'hold') {
  setInterval(() => {}, 1000)
} else {
  console.error(`[fixture] 未知 arm: ${arm}`)
  process.exit(9)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

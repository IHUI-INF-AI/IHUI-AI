// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 真 PTY 取证(G-329:alt-screen / 鼠标滚轮 / resize)。
 *
 * 这一组与 tui-fullscreen-terminal.test.ts 的分工:那边用**假 io** 断言
 * "发出配对的还原动作",本组接**真伪终端**(node-pty → Windows 上是 ConPTY),
 * 断言的是终端读端实际收到的字节。判据全部来自真跑出来的字节,禁止"读源码常量"冒充。
 *
 * 环境事实(现读,不承诺恒在):node-pty@1.1.0 是 apps/api 的直接依赖,本包不持有;
 * 夹具按 `import('node-pty')` → `createRequire(apps/api/package.json)` 两通道解析,
 * 两条都取不到 ⇒ 整组 skip 并在 stderr 点名"未判定(缺 node-pty 解析通道)"。
 *
 * ConPTY 取证口径(2026-10-28 真跑实测,不是猜的):
 *  - 模式类序列 `\x1b[?1049h/l`、`\x1b[?25l/h` 原样到达读端 ⇒ alt-screen 进出可直接断言;
 *  - 子进程写出的绝对光标定位 CUP **不**被透传(ConPTY 做单元格差分合成,首帧用相对移动),
 *    所以"按新尺寸重画"不能用 CUP 行号断言(Windows 实测恒缺席,只有 POSIX 裸管道才有)——
 *    改用**宽度决定性探针**:输入 90 个 'x',80 列下读端最长连续串只可能是 78("❯ " 占 2 格),
 *    82+ 连串只可能在按 100 列重画后出现;
 *  - SIGWINCH 通道"新尺寸真进了应用布局判定"用太窄自退路径取证:20×10 下应用按设计退出,
 *    并在主屏回显 `terminal too small (20x10)` —— 文本字节跨平台都可达;
 *  - 退出通知的 onExit 事件可能先于尾字节冲刷到达(实测竞态),凡"退出后断言文本"
 *    一律走 settle 等待窗,不拿 onExit 时刻的快照说事。
 */
import { afterEach, describe, expect, it } from 'vitest'

import { quitByEsc, resolvePtyModule, settleExitCode, spawnTuiInPty, type PtyModule, type TuiPtySession } from './helpers/pty-fixture.js'

const ENTER = '\x1b[?1049h'
const LEAVE = '\x1b[?1049l'
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ENTER_RE = new RegExp(escapeRe(ENTER))
const LEAVE_RE = new RegExp(escapeRe(LEAVE))

const ptyModule = await resolvePtyModule()
if (!ptyModule) {
  console.warn('[G-329] 未判定:node-pty 两条解析通道均不可达(本包无直接依赖,apps/api 通道也未命中)——全屏真 PTY 取证未运行,不得读成通过')
}
function needPty(): PtyModule {
  if (!ptyModule) throw new Error('node-pty 未解析(见套件顶部"未判定"点名)')
  return ptyModule
}

/** tsx 冷转译 + CLI 启动在慢机上可到几十秒,进入全屏的等待窗给足。 */
const STARTUP_TIMEOUT_MS = 120_000
const PTY_TEST_TIMEOUT_MS = 150_000
/** 子进程 exit 后尾字节冲刷的容忍窗。 */
const SETTLE_MS = 8_000

const suite = ptyModule ? describe : describe.skip

suite('全屏 TUI × 真 PTY(G-329)', () => {
  const live: TuiPtySession[] = []

  async function startTui(size = { cols: 80, rows: 24 }): Promise<TuiPtySession> {
    const session = await spawnTuiInPty(needPty(), size)
    live.push(session)
    await session.waitFor(ENTER_RE, 0, STARTUP_TIMEOUT_MS)
    return session
  }

  afterEach(async () => {
    // 无论断言走到哪一步,PTY 子进程一律收干净:漏一个就是 vitest worker 挂死。
    const sessions = live.splice(0)
    for (const s of sessions) await s.dispose(3_000)
  })

  it(
    '进入/离开 alt-screen:1049h 于进入时、1049l 于退出时,顺序配对,退出通知落在 alt-screen 之外',
    async () => {
      const session = await startTui()
      const enterAt = await session.waitFor(ENTER_RE, 0, 1_000)

      const exitInfo = await quitByEsc(session, 15_000)
      const leaveAt = await session.waitFor(LEAVE_RE, enterAt, SETTLE_MS)
      expect(exitInfo.exitCode, `ESC 退出应为 0,实测 ${String(exitInfo.exitCode)}`).toBe(0)
      // 退出通知打在 alt-screen 之外:leave 之后(允许冲刷竞态)还能读到那句交代。
      await session.waitFor(/left fullscreen/, leaveAt, SETTLE_MS)
    },
    PTY_TEST_TIMEOUT_MS,
  )

  it(
    '滚轮字节不得打崩全屏:注入 SGR 鼠标事件(64/65 上下滚)后仍能被 ESC 正常退出并配对还原',
    async () => {
      const session = await startTui()
      const beforeWheel = session.mark()
      session.write('\x1b[<64;10;10M\x1b[<65;10;10M'.repeat(3))
      const exitInfo = await quitByEsc(session, 15_000)
      const leaveAt = await session.waitFor(LEAVE_RE, beforeWheel, SETTLE_MS)
      expect(leaveAt, '注入滚轮字节后 TUI 必须还活着并能配对还原终端').toBeGreaterThan(beforeWheel)
      expect(exitInfo.exitCode, `注入滚轮后 ESC 退出应按 0 收尾,实测 ${String(exitInfo.exitCode)}`).toBe(0)
    },
    PTY_TEST_TIMEOUT_MS,
  )

  it(
    '全屏开启鼠标上报(1000+1006),滚轮有解码通道(G-329 原缺陷格,2026-10-28 补齐)',
    async () => {
      const session = await startTui()
      await quitByEsc(session, 15_000)
      await session.exited
      await session.waitFor(/left fullscreen/, 0, SETTLE_MS)
      // 真 PTY 读端全量流里找鼠标上报开关:进全屏必须开、退全屏必须关。
      // ConPTY 自身会开 ?1004(焦点上报)与 ?9001,那不是鼠标模式,判据不含它们。
      const mouseModeOn = /\x1b\[\?(?:1000|1006)h/.test(session.stream)
      const mouseModeOff = /\x1b\[\?(?:1000|1006)l/.test(session.stream)
      expect(mouseModeOn, '全屏会话应开启鼠标上报(滚轮翻页)能力').toBe(true)
      expect(mouseModeOff, '退出全屏必须关掉鼠标上报,否则滚轮会污染 shell').toBe(true)
    },
    PTY_TEST_TIMEOUT_MS,
  )

  it(
    'resize 通道:80×24 输入 90 连 x 后 (a)放大到 100×40 读端出现 82+ 连串=按新宽度重画,(b)压到 20×10 应用按新尺寸退出并回显 20x10',
    async () => {
      const session = await startTui({ cols: 80, rows: 24 })
      session.write('x'.repeat(90))
      // 输入回显进帧(等最长 x 串出现),否则"重画"没有可断言的内容。
      await session.waitFor(/x{50,}/, 0, 15_000)
      // 基线:80 列下"❯ "+78 个 x 恰占一行,读端不可能出现 82+ 连串。
      const maxRunBefore = maxCharRun(session.stream, 'x')
      expect(maxRunBefore, '基线:旧宽度下不应已出现 82+ 连串').toBeLessThanOrEqual(80)

      const mark = session.mark()
      session.resize(100, 40)
      await session.waitFor(/x{82,}/, mark, 20_000)
      expect(session.stream.indexOf(LEAVE), '放大 resize 不应触发退出').toBe(-1)

      // SIGWINCH 通道正向证据:压到撑不起布局的 20×10,应用按设计自退并**回显新尺寸**。
      session.resize(20, 10)
      const exitInfo = await settleExitCode(session)
      expect(exitInfo.exitCode, `太窄自退应按 0 收尾,实测 ${String(exitInfo.exitCode)}`).toBe(0)
      await session.waitFor(/terminal too small \(20x10\)/, 0, SETTLE_MS)
    },
    PTY_TEST_TIMEOUT_MS,
  )
})

/** 流中最长连续串(只数目标字符;ANSI 穿插会自然截断串 —— 与"一行装得下多少个"同向保守)。 */
function maxCharRun(stream: string, ch: string): number {
  let max = 0
  let cur = 0
  for (const c of stream) {
    if (c === ch) {
      cur += 1
      if (cur > max) max = cur
    } else {
      cur = 0
    }
  }
  return max
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

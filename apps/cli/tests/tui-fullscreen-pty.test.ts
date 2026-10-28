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
 * ConPTY 取证口径(2026-10-28 本机真跑实测,不是猜的;探针逐轮记录见 commit message):
 *  - 模式类序列 `\x1b[?1049h/l` 原样到达读端 ⇒ alt-screen 进出可直接断言;
 *    进入侧 `\x1b[?1049h`+清屏+`\x1b[?1000h`+`\x1b[?1006h` 实测连续到达(偏移 75/156/164,3/3 同形),
 *    所以"全屏确实把鼠标上报打开了"能在真终端读端取证(滚轮字节才有解码通道);
 *  - **退出侧不可取证的那两格**(实测 4/4 轮次同形,不是竞态):
 *    ① `leaveSequence()` 写出的 `\x1b[?1000l\x1b[?1006l` 与重复的 `\x1b[?25h` 被 ConPTY 折叠吞掉,
 *       读端永远只剩 `\x1b[?25h\x1b[?1049l`;
 *    ② 退出后打在**主屏**的那句交代(`left fullscreen …`)也进不了读端 —— 流恰好以 `1049l` 的最后
 *       8 字节结束(total == leaveAt + 8;vitest 侧只有靠 retry 撞中过一次,首跑 3/3 超时)。
 *    ⇒ 本组**不再**断言这两格(断言了就是一道本机恒红门,§12e)。鼠标开关的写侧配对已改由
 *    `tui-fullscreen-keys.test.ts` 的 `enterSequence()/leaveSequence()` 用例逐字节断言,
 *    主屏交代的写出归 `tui-fullscreen-terminal.test.ts`(假 io 断言"发出的还原动作")。
 *    削弱的是"取证面",不是判据本身:这里只留读端真能到达的不变量,且不得改成条件断言冒充绿。
 *  - 子进程写出的绝对光标定位 CUP **不**被透传(ConPTY 做单元格差分合成,首帧用相对移动),
 *    所以"按新尺寸重画"不能用 CUP 行号断言(Windows 实测恒缺席,只有 POSIX 裸管道才有)——
 *    改用**宽度决定性探针**:输入 90 个 'x',80 列下读端最长连续串只可能是 78("❯ " 占 2 格),
 *    82+ 连串只可能在按 100 列重画后出现;
 *  - SIGWINCH 通道"新尺寸真进了应用布局判定"用太窄自退路径取证:20×10 下应用按设计退出,
 *    并在主屏回显 `terminal too small (20x10)` —— 文本字节跨平台都可达;
 *  - 退出通知的 onExit 事件可能先于尾字节冲刷到达(实测竞态),凡"退出后断言文本"
 *    一律走 settle 等待窗,不拿 onExit 时刻的快照说事。
 *  - 滚轮那一格 2026-10-28 由"字节不打崩"升级为**因果断言**:注入 `\x1b[<64;10;10M`(上滚)/
 *    `\x1b[<65;10;10M`(下滚)后,状态栏读数必须真的从 `LIVE` 翻成 `SCROLL` 再翻回 `LIVE`
 *    (实测上滚 3 枚→110 字节新帧含 `SCROLL`,下滚 6 枚→99 字节新帧含 `LIVE`),
 *    这才算"滚轮事件进了应用、并被重绘到真终端"。
 */
import { afterEach, describe, expect, it } from 'vitest'

import { quitByEsc, resolvePtyModule, settleExitCode, spawnTuiInPty, type PtyModule, type TuiPtySession } from './helpers/pty-fixture.js'

const ENTER = '\x1b[?1049h'
const LEAVE = '\x1b[?1049l'
const CLEAR = '\x1b[2J'
const MOUSE_PRESS_ON = '\x1b[?1000h'
const MOUSE_SGR_ON = '\x1b[?1006h'
const MOUSE_ON = [MOUSE_PRESS_ON, MOUSE_SGR_ON] as const
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ENTER_RE = new RegExp(escapeRe(ENTER))
const LEAVE_RE = new RegExp(escapeRe(LEAVE))
const MOUSE_ENABLE_RE = /\x1b\[\?(?:1000|1006)h/
/** 整枚序列在流里出现了几次(序列含转义字节,必须按字面量数,不能按正则类匹配数)。 */
const countOf = (stream: string, seq: string): number => stream.split(seq).length - 1

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
    'alt-screen 进出配对:1049h/1049l 各恰好一枚、先进后出;还原之后读端不得再被拉回全屏',
    async () => {
      const session = await startTui()
      const enterAt = await session.waitFor(ENTER_RE, 0, 1_000)
      expect(countOf(session.stream, ENTER), '一次会话只允许进入 alt-screen 一枚 1049h(重复进入=反复掀屏)').toBe(1)
      expect(session.stream.indexOf(LEAVE), '还没退出,读端不该出现 1049l').toBe(-1)

      const exitInfo = await quitByEsc(session, 15_000)
      const leaveAt = await session.waitFor(LEAVE_RE, enterAt, SETTLE_MS)
      expect(exitInfo.exitCode, `ESC 退出应为 0(取不到即未判定,不得当 0),实测 ${String(exitInfo.exitCode)}`).toBe(0)
      expect(countOf(session.stream, LEAVE), '1049l 必须且只能有一枚').toBe(1)
      expect(leaveAt, '还原必须排在进入之后').toBeGreaterThan(enterAt)
      // 还原之后不得再出现任何"把终端重新拉回 alt-screen / 重新打开鼠标上报"的开关字节。
      // (主屏那句退出交代在 ConPTY 读端取不到,依据见文件头口径;这里断言可达的那一半。)
      const afterLeave = session.stream.slice(leaveAt + LEAVE.length)
      expect(ENTER_RE.test(afterLeave) || MOUSE_ENABLE_RE.test(afterLeave), `1049l 之后残留重新开启的开关字节:${JSON.stringify(afterLeave.slice(0, 120))}`).toBe(false)
    },
    PTY_TEST_TIMEOUT_MS,
  )

  it(
    '滚轮事件端到端:注入 SGR 上滚(64)/下滚(65)后读数必须 LIVE→SCROLL→LIVE 真重绘,收尾仍配对还原',
    async () => {
      const session = await startTui()
      await session.waitFor(/LIVE/, 0, 15_000)
      expect(session.stream.includes('SCROLL'), '基线:未滚轮之前不该已经是 SCROLL 态').toBe(false)

      const upMark = session.mark()
      session.write('\x1b[<64;10;10M'.repeat(3))
      await session.waitFor(/SCROLL/, upMark, 10_000)
      expect(session.stream.indexOf(LEAVE), '滚轮不得把全屏弄退出').toBe(-1)

      const downMark = session.mark()
      session.write('\x1b[<65;10;10M'.repeat(6))
      await session.waitFor(/LIVE/, downMark, 10_000)

      const exitInfo = await quitByEsc(session, 15_000)
      await session.waitFor(LEAVE_RE, downMark, SETTLE_MS)
      expect(exitInfo.exitCode, `滚轮之后 ESC 退出应按 0 收尾,实测 ${String(exitInfo.exitCode)}`).toBe(0)
    },
    PTY_TEST_TIMEOUT_MS,
  )

  it(
    '进入全屏必须把鼠标上报开启字节送到读端(1049h→清屏→1000h→1006h 同串有序),否则滚轮没有解码通道',
    async () => {
      const session = await startTui()
      const enterAt = await session.waitFor(ENTER_RE, 0, 1_000)
      // 开启鼠标上报只算"进入全屏"这个动作的一部分:必须落在 1049h 之后的同一串里,
      // 而不是会话中途某处冒出来(实测三枚序列都在 1049h 后 32 字节窗口内)。
      const window = session.stream.slice(enterAt, enterAt + 64)
      const atClear = window.indexOf(CLEAR)
      const [atPress, atSgr] = [window.indexOf(MOUSE_PRESS_ON), window.indexOf(MOUSE_SGR_ON)]
      expect(atClear, `1049h 之后应紧跟清屏,窗口实测 ${JSON.stringify(window)}`).toBeGreaterThanOrEqual(0)
      expect(atPress, `窗口内应出现 1000h(按下/释放上报),实测 ${JSON.stringify(window)}`).toBeGreaterThanOrEqual(0)
      expect(atSgr, '窗口内应出现 1006h(SGR 扩展编码,滚轮键码 64/65 只在它之下无歧义)').toBeGreaterThan(atPress)
      expect(atPress).toBeGreaterThan(atClear)
      for (const seq of MOUSE_ON) expect(countOf(session.stream, seq), `${JSON.stringify(seq)} 只应开启一次`).toBe(1)

      const exitInfo = await quitByEsc(session, 15_000)
      expect(exitInfo.exitCode, `退出码取不到即未判定,实测 ${String(exitInfo.exitCode)}`).toBe(0)
      await session.waitFor(LEAVE_RE, enterAt, SETTLE_MS)
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

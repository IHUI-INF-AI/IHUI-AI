// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 真 PTY 夹具(G-329)—— 用 node-pty 起一个真伪终端,驱动 `ihui tui` 全屏会话。
 *
 * 为什么单独成文件:转义字节流的采集/等待/清理三件事只要写错一处,
 * 测试结果就只剩"看起来绿"(例如 ConPTY 的输出是合成态、不是原字节,直接
 * substring 断言会假阴性;退出后不 kill 会挂住 vitest worker)。
 *
 * node-pty 的取用通道(诚实交代):它不在本包依赖里(仓是 pnpm isolated 布局,
 * node-pty@1.1.0 是 apps/api 的直接依赖)。本夹具按两条通道解析——① 直接
 * `import('node-pty')`(布局变为 hoist 时生效);② `createRequire(apps/api/package.json)`。
 * 两条都取不到 ⇒ 返回 null,由测试侧显式落"未判定(skip)",绝不伪造通过。
 * 禁止为此改 package.json 加依赖——那是另一张票的范围。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

/** node-pty 的结构声明(只为夹具用到的四个动作;不做整包类型复刻)。 */
export interface PtyChild {
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
  onData(cb: (chunk: string) => void): void
  onExit(cb: (info: { exitCode: number | undefined; signal?: number }) => void): void
  /** ConPTY 前端代理上的退出码 getter(known issue #493:close 事件可能先于进程退出回调,读不到就返回 undefined) */
  readonly exitCode?: number | undefined
}

export interface PtyModule {
  spawn(
    command: string,
    args: string[],
    opts: { name: string; cols: number; rows: number; cwd: string; env: { [key: string]: string } },
  ): PtyChild
}

/** 夹具所在包根(apps/cli)—— 由本文件自身位置推导,不用 cwd 定根。 */
const here = path.dirname(fileURLToPath(import.meta.url))
const appsCliRoot = path.resolve(here, '..', '..')
const repoRoot = path.resolve(appsCliRoot, '..', '..')

/** node-pty 的解析器名:非字面量说明符,避开本包 typecheck 的 TS2307(本包确实不持有该依赖,这是事实)。 */
const NODE_PTY = 'node-pty'

/** 探测 node-pty 解析通道;取不到返回 null(调用方必须落"未判定",不得回落假实现)。 */
export async function resolvePtyModule(): Promise<PtyModule | null> {
  try {
    const mod = (await import(NODE_PTY)) as unknown as { default?: PtyModule } & PtyModule
    const api = (mod.default ?? mod) as PtyModule
    if (typeof api.spawn === 'function') return api
    return null
  } catch {
    /* 通道一不可用:落到通道二 */
  }
  try {
    const req = createRequire(path.join(repoRoot, 'apps', 'api', 'package.json'))
    const api = req(NODE_PTY) as PtyModule
    return typeof api.spawn === 'function' ? api : null
  } catch {
    return null
  }
}

/**
 * 探测用的假凭据:全屏会话只在 Enter/绘制阶段被驱动,永远不会 submit,
 * 所以 AgentCore 只到构造为止(setBaseUrl/registerProvider,零网络)。
 * 这里禁止出现任何真实凭据;api-url 指向 discard 端口兜住"万一发了请求"。
 */
const PROBE_MODEL = 'pty-probe-model-not-a-secret'
const PROBE_API_KEY = 'pty-probe-key-not-a-secret'
const PROBE_API_URL = 'http://127.0.0.1:9'

export interface PtyExitInfo {
  /** ConPTY 竞态下可能取不到(known issue node-pty#493:socket close 先于原生退出回调);null = 未判定,不得冒充 0 */
  exitCode: number | null
  signal?: number
}

export interface TuiPtySession {
  child: PtyChild
  /** 截至目前收到的全部字节流(含 ConPTY 合成态转义) */
  readonly stream: string
  /** 当前流长度,用作"事件发生点"的偏移标记 */
  mark(): number
  /** 等待 stream[from..] 中出现 pattern;超时抛错(不静默) */
  waitFor(pattern: RegExp, from: number, timeoutMs: number): Promise<number>
  /** 子进程退出 Promise(onExit 首达即 resolve;退出码另走 settleExitCode) */
  readonly exited: Promise<{ exitCode: number | undefined; signal?: number }>
  write(data: string): void
  resize(cols: number, rows: number): void
  /** 收尾:kill + 等退出;vitest worker 不挂靠这一步 */
  dispose(timeoutMs: number): Promise<void>
}

/**
 * 量到"稳定形态"的退出码:exit 事件先到但值可能是 undefined(node-pty ConPTY 前端的
 * close/exit 竞态,issue #493),原生进程退出回调随后续 libuv 轮次补上 agent._exitCode。
 * 这里在事件后短轮询 agent getter;到点仍取不到 ⇒ 返回 null(未判定),
 * 由断言方如实报"退出码通道未测到" —— 不拿 undefined 当 0,也不当非 0。
 */
export async function settleExitCode(session: TuiPtySession, pollMs = 3_000): Promise<PtyExitInfo> {
  const first = await session.exited
  if (typeof first.exitCode === 'number') return { exitCode: first.exitCode, signal: first.signal }
  const agent = (session.child as unknown as { _agent?: { exitCode?: number } })._agent
  const t0 = Date.now()
  while (agent && typeof agent.exitCode !== 'number' && Date.now() - t0 < pollMs) {
    await new Promise((r) => setTimeout(r, 50))
  }
  const code = typeof agent?.exitCode === 'number' ? agent.exitCode : first.exitCode
  return { exitCode: typeof code === 'number' ? code : null, signal: first.signal }
}

/** 起一个真 PTY 里的 `ihui tui` 会话(等价手工:终端下 `ihui tui`)。 */
export async function spawnTuiInPty(pty: PtyModule, size: { cols: number; rows: number }): Promise<TuiPtySession> {
  const env: { [key: string]: string } = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') env[k] = v
  }
  // 钉死探测环境:TERM 必须像真终端(能力判定按 TERM 排除 dumb),
  // 更新检查/首次引导/语言档全部关闭或固定,字节流才可比。
  env.TERM = 'xterm-256color'
  env.IHUI_NO_UPDATE_CHECK = '1'
  env.IHUI_LOCALE = 'zh-CN'
  env.IHUI_API_KEY = PROBE_API_KEY
  const child = pty.spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      'src/index.ts',
      'tui',
      '--no-setup',
      '--workspace',
      appsCliRoot,
      '--model',
      PROBE_MODEL,
      '--api-url',
      PROBE_API_URL,
      '--api-key',
      PROBE_API_KEY,
    ],
    { name: 'xterm-256color', cols: size.cols, rows: size.rows, cwd: appsCliRoot, env },
  )
  let stream = ''
  child.onData((chunk) => {
    stream += chunk
  })
  const exited = new Promise<{ exitCode: number | undefined; signal?: number }>((resolve) => {
    child.onExit((info) => resolve({ exitCode: info.exitCode, signal: info.signal }))
  })
  return {
    child,
    exited,
    get stream() {
      return stream
    },
    mark: () => stream.length,
    waitFor: (pattern, from, timeoutMs) =>
      new Promise<number>((resolve, reject) => {
        const t0 = Date.now()
        const tick = (): void => {
          const m = pattern.exec(stream.slice(from))
          if (m) {
            resolve(from + m.index)
            return
          }
          if (Date.now() - t0 > timeoutMs) {
            reject(new Error(`等待 ${String(pattern)} 超时(${timeoutMs}ms,自偏移 ${from},累计 ${stream.length} 字节)`))
            return
          }
          setTimeout(tick, 50)
        }
        tick()
      }),
    write: (data) => child.write(data),
    resize: (cols, rows) => child.resize(cols, rows),
    dispose: async (timeoutMs) => {
      try {
        child.kill()
      } catch {
        /* 已退出 */
      }
      await Promise.race([exited, new Promise<void>((r) => setTimeout(r, timeoutMs))])
    },
  }
}

/** ESC 单独成键 = 全屏 TUI 的 quit;退出码走 settle 通道量稳值(取不到如实落 null)。 */
export async function quitByEsc(session: TuiPtySession, timeoutMs: number): Promise<PtyExitInfo> {
  session.write('\x1b')
  await Promise.race([
    session.exited,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ESC 退出超时')), timeoutMs)),
  ])
  return settleExitCode(session)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

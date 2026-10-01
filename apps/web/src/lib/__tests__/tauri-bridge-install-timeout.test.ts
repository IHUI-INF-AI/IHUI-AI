// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type {
  QuitUpdateStatus,
  UpdateProgress,
  UpdateSession,
} from '../tauri-bridge'

/**
 * P1 残余① —— 桌面端「下载并安装」的超时与取消回归锁。
 *
 * 判的是这条:自动更新里最慢最容易挂死的一步(downloadAndInstall)必须有**终态**。
 * 修前它是全仓唯一一处"既不 resolve 也不 reject 的 await",挂住时 UI 停在
 * "正在更新…"、账面零错误 —— 与本仓登记过的"退出链永久转圈"同一型。
 *
 * 四条成对用例(缺一不可):
 *  ① 下载挂死 ⇒ 有界 reject(不是永悬)
 *  ② 正向对照:正常完成路径的 progress 序列与 resolve 值,逐字等于**修前算法**的参照实现
 *  ②b 插件自身失败 ⇒ 原样上抛,不被超时逻辑折叠/改写
 *  ③ 主动 abort ⇒ 终态是「已取消」这条具名 reason,而不是「失败」
 *  ④ 反向锁(源码级):插件句柄的那一次调用必须住在 withTimeout 里;
 *     把"裸 await"喂给同一条判据必须判红(证明这条锁有牙,不是恒绿)
 *  外加:check() 那一档的行为与调用形态逐字不变(本票不得顺手改坏已修好的第一条卡死路径)
 *
 * 计时一律用 vi.useFakeTimers():默认预算是 20 分钟量级,用例不 sleep、不等"自己变完"
 * (本仓纪律:vi.waitFor 式"等它自己跑完"不构成证明)。
 */

// ================== 模块边界 mock ==================
// tauri-bridge 顶层 import 的三件 + checkForUpdates 内部动态 import 的 plugin-updater。
// 动态 import 同样被 vi.mock 拦截(同一模块 id),因此测试里不需要真实 Tauri 运行时。
const invokeMock = vi.hoisted(() => vi.fn(async (..._args: unknown[]): Promise<unknown> => undefined))
const checkMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onStartDragging: vi.fn(), close: vi.fn() }),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: checkMock,
  // 被测代码只取 check;运行时仍走 `await import('@tauri-apps/plugin-updater')`
}))

/**
 * 本用例只依赖这四个出口。**刻意显式列出**而不是写 `typeof import('../tauri-bridge')`:
 * ① 仓库 eslint 禁 `import()` 类型标注;② 显式清单让"导出被改名/被摘线"在编译期就红,
 * 而不是留到运行时拿到 undefined —— 后者正是本仓记过的"看起来有、其实没装车"那一型。
 */
interface BridgeSurface {
  checkForUpdates: () => Promise<UpdateSession | null>
  quitAndUpdateIfNeeded: (
    onProgress?: (p: UpdateProgress) => void,
    onStatus?: (status: QuitUpdateStatus) => void,
    signal?: AbortSignal,
  ) => Promise<void>
  UPDATE_DOWNLOAD_TIMEOUT_REASON: string
  UPDATE_DOWNLOAD_CANCELLED_REASON: string
}

let bridge: BridgeSurface

/** 每个用例取一份**全新模块**:tauri-bridge 有模块级状态(_updateInstalledPendingRestart /
 *  _availableSession),共用缓存模块会让上一条用例的余温短路下一条的分支。 */
async function loadFresh(): Promise<BridgeSurface> {
  vi.resetModules()
  return await import('../tauri-bridge')
}

/** 一个最小的 Tauri Update 句柄:downloadAndInstall 的行为由入参决定。 */
function fakeUpdate(
  install: (emit: (event: { event: string; data: unknown }) => void) => Promise<void>,
) {
  return {
    version: '0.2.0',
    date: '2026-09-29T00:00:00Z',
    body: 'notes-under-test',
    downloadAndInstall: async (cb?: (event: { event: string; data: unknown }) => void) => {
      await install((event) => cb?.(event))
    },
  }
}

/** 永挂:模拟 GitHub feed 的 TCP 层黑洞 —— 既不 resolve 也不 reject。 */
const hangForever = () => new Promise<void>(() => {})

beforeEach(async () => {
  vi.useFakeTimers()
  invokeMock.mockClear()
  invokeMock.mockImplementation(async () => undefined)
  checkMock.mockReset()
  // isTauri() 的判据是 `'__TAURI_INTERNALS__' in window`(happy-dom 提供 window)
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  bridge = await loadFresh()
})

afterEach(() => {
  vi.useRealTimers()
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
})

/**
 * 参照实现 = **修前**那份函数体的逐字搬运(不 await 超时、只做事件→进度映射)。
 * ②用它做正向对照,防的是"改判据时顺手改了进度语义"而账面仍全绿。
 * 刻意留在这里而不是从 git 取:参照物必须与被审对象同时可读。
 */
function referenceOldMapping(
  events: Array<{ event: string; data: unknown }>,
): UpdateProgress[] {
  let downloaded = 0
  let total = 0
  const out: UpdateProgress[] = []
  for (const event of events) {
    switch (event.event) {
      case 'Started': {
        const d = event.data as { contentLength?: number }
        total = d.contentLength ?? 0
        out.push({ downloaded: 0, total })
        break
      }
      case 'Progress': {
        const d = event.data as { chunkLength?: number }
        downloaded += d.chunkLength ?? 0
        out.push({ downloaded, total })
        break
      }
      case 'Finished':
        out.push({ downloaded: total || downloaded, total })
        break
    }
  }
  return out
}

describe('① 下载挂死 —— 必有终态(有界 reject,不是永悬)', () => {
  it('挂死的 downloadAndInstall 在推进过默认预算后 reject,且 reason 是具名超时', async () => {
    checkMock.mockResolvedValue(fakeUpdate(() => hangForever()))
    const session = await bridge.checkForUpdates()
    expect(session).not.toBeNull()

    const promise = session!.downloadAndInstall()
    let settled = 'pending'
    void promise.then(
      () => {
        settled = 'resolved'
      },
      (e: unknown) => {
        settled = `rejected:${e instanceof Error ? e.message : String(e)}`
      },
    )

    // 下界:推进 1 分钟仍未收口 —— 证明它没有把"真在慢慢下的 230MB 包"误杀
    await vi.advanceTimersByTimeAsync(60_000)
    expect(settled).toBe('pending')

    // 上界:推进到远超默认预算(20 分钟量级;用例不硬编码那个数,只证"有界")
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(settled).toBe(`rejected:${bridge.UPDATE_DOWNLOAD_TIMEOUT_REASON}`)
    await expect(promise).rejects.toThrow(bridge.UPDATE_DOWNLOAD_TIMEOUT_REASON)
  })

  it('超时之后底层那次下载迟到 reject,不得把已交出的超时终态换成别的结论', async () => {
    let lateReject: ((reason: Error) => void) | undefined
    checkMock.mockResolvedValue(
      fakeUpdate(
        () =>
          new Promise<void>((_resolve, reject) => {
            lateReject = reject
          }),
      ),
    )
    const session = await bridge.checkForUpdates()
    const promise = session!.downloadAndInstall()
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    await expect(promise).rejects.toThrow(bridge.UPDATE_DOWNLOAD_TIMEOUT_REASON)

    // 插件层不认 cancel,超时后它还会自己失败。那已经是**第二条**结论,
    // 迟到的 rejection 既不能改写已交出的超时终态,也不能变成 unhandled rejection
    // (Promise.race 已给输入挂上处理器 —— 这里断言已 settle 的终态纹丝不动)。
    lateReject?.(new Error('late plugin failure'))
    await vi.advanceTimersByTimeAsync(10)
    await expect(promise).rejects.toThrow(bridge.UPDATE_DOWNLOAD_TIMEOUT_REASON)
  })
})

describe('② 正向对照 —— 正常完成路径逐字同形', () => {
  it('resolve 值为 undefined,且进度序列与修前参照实现逐字等值', async () => {
    const events: Array<{ event: string; data: unknown }> = [
      { event: 'Started', data: { contentLength: 1000 } },
      { event: 'Progress', data: { chunkLength: 400 } },
      { event: 'Progress', data: { chunkLength: 350 } },
      { event: 'Finished', data: {} },
    ]
    checkMock.mockResolvedValue(
      fakeUpdate((emit) => {
        for (const e of events) emit(e)
        return Promise.resolve()
      }),
    )
    const session = await bridge.checkForUpdates()
    const seen: UpdateProgress[] = []
    const result = await session!.downloadAndInstall((p) => seen.push(p))

    expect(result).toBeUndefined()
    expect(seen).toEqual(referenceOldMapping(events))
    // 阳性对照:参照实现本身必须产出非空且分档正确的序列,否则上面那条等值是空的
    expect(seen).toHaveLength(4)
    expect(seen[2]).toEqual({ downloaded: 750, total: 1000 })
  })

  it('②b 插件自身失败 ⇒ 原样上抛(不折叠成超时、不改写 message)', async () => {
    const boom = new Error('signature verification failed')
    checkMock.mockResolvedValue(fakeUpdate(() => Promise.reject(boom)))
    const session = await bridge.checkForUpdates()
    await expect(session!.downloadAndInstall()).rejects.toBe(boom)
  })

  it('已是最新(check() 返回 null)时 session 为 null —— check 档行为未被改动', async () => {
    checkMock.mockResolvedValue(null)
    expect(await bridge.checkForUpdates()).toBeNull()
  })
})

describe('③ 主动取消 —— 终态是「已取消」而不是「失败」', () => {
  it('abort 后立刻以 UPDATE_DOWNLOAD_CANCELLED_REASON 拒绝(不需要等到超时)', async () => {
    checkMock.mockResolvedValue(fakeUpdate(() => hangForever()))
    const session = await bridge.checkForUpdates()
    const controller = new AbortController()

    let settled = 'pending'
    const promise = session!.downloadAndInstall(undefined, { signal: controller.signal })
    void promise.then(
      () => {
        settled = 'resolved'
      },
      (e: unknown) => {
        settled = `rejected:${e instanceof Error ? e.message : String(e)}`
      },
    )

    await vi.advanceTimersByTimeAsync(5_000)
    expect(settled).toBe('pending') // 取消之前它确实在等(不是瞬间 resolve)

    controller.abort()
    await vi.advanceTimersByTimeAsync(10)
    expect(settled).toBe(`rejected:${bridge.UPDATE_DOWNLOAD_CANCELLED_REASON}`)
    // 两个终态必须可区分:UI 才能说"已取消"而不是"更新失败"
    expect(bridge.UPDATE_DOWNLOAD_CANCELLED_REASON).not.toBe(bridge.UPDATE_DOWNLOAD_TIMEOUT_REASON)
  })

  it('已经 abort 过的 signal 传进去 ⇒ 同样立刻拿到「已取消」终态', async () => {
    checkMock.mockResolvedValue(fakeUpdate(() => hangForever()))
    const session = await bridge.checkForUpdates()
    const controller = new AbortController()
    controller.abort()
    await expect(
      session!.downloadAndInstall(undefined, { signal: controller.signal }),
    ).rejects.toThrow(bridge.UPDATE_DOWNLOAD_CANCELLED_REASON)
  })

  it('退出链:下载挂死 ⇒ 用更紧的预算收口,并且终态是 quitting + 真的 quit_app', async () => {
    // 挂死场景:被全屏遮罩阻塞的一方不能拿后台那 20 分钟当兜底
    checkMock.mockResolvedValue(fakeUpdate(() => hangForever()))
    const statuses: string[] = []
    invokeMock.mockImplementation(async () => undefined)

    const promise = bridge.quitAndUpdateIfNeeded(undefined, (s) => statuses.push(s))
    // 推进 5 分钟:退出链必须早已收口(它的预算是 90s 量级,远紧于默认 20min)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    await expect(promise).resolves.toBeUndefined()

    expect(statuses).toContain('downloading')
    expect(statuses[statuses.length - 1]).toBe('quitting')
    expect(invokeMock.mock.calls.map((c) => c[0])).toContain('quit_app')
  })

  it('退出链:abort ⇒ 终态同样是 quitting(在这一条链上「取消」就是「别等了,直接退」)', async () => {
    checkMock.mockResolvedValue(fakeUpdate(() => hangForever()))
    const statuses: string[] = []
    const controller = new AbortController()

    const promise = bridge.quitAndUpdateIfNeeded(undefined, (s) => statuses.push(s), controller.signal)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(statuses[statuses.length - 1]).toBe('downloading')

    controller.abort()
    await vi.advanceTimersByTimeAsync(10)
    await expect(promise).resolves.toBeUndefined()
    expect(statuses[statuses.length - 1]).toBe('quitting')
    expect(invokeMock.mock.calls.map((c) => c[0])).toContain('quit_app')
  })
})

// ================== ④ 反向锁(源码级) ==================
// 判据输入 = 被审文件的**注释遮罩面**:注释里解释"修前怎么写"的散文不得被判成违规
// (守门 131 第一次自跑就是被自己写的说明咬到的;遮罩只在这一份小实现里做,
//  因为它只服务这条锁,不构成第二套超时实现)。
//
// 取路径用 `import.meta.dirname` + 固定跳数(本仓既有源码级锁的同款写法,
// 见 apps/web/src/lib/__tests__/auto-submit-gate-wiring.test.ts 的头注),
// **不用 process.cwd()** —— 那会让"扫的是哪棵树"取决于调用者站哪(守门 70 的 13/14 恒红即此型)。
const BRIDGE_PATH = path.resolve(import.meta.dirname, '../tauri-bridge.ts')
const BRIDGE_SOURCE = readFileSync(BRIDGE_PATH, 'utf8')

/**
 * 取材自检:路径算歪一格,锁就会去读另一份文件(或读不到)而**账面仍然全绿** ——
 * 这条断言把"读到了对的东西"变成用例的前置,而不是留给下一个人去猜。
 */
describe('④-0 取材自检 —— 这条锁读的确实是 tauri-bridge 本体', () => {
  it('文件存在且含被审判的两个标识(少一跳就会读错文件)', () => {
    expect(BRIDGE_SOURCE).toContain('export async function checkForUpdates')
    expect(BRIDGE_SOURCE).toContain('export async function quitAndUpdateIfNeeded')
    expect(BRIDGE_SOURCE).toContain('function withTimeout')
  })
})

/** 等长遮罩:块注释与行注释变空格,行号与字符位置不变(锁要点名行号)。 */
function maskComments(src: string): string {
  const out: string[] = []
  let i = 0
  let inBlock = false
  while (i < src.length) {
    if (!inBlock && src[i] === '/' && src[i + 1] === '*') {
      inBlock = true
      out.push('  ')
      i += 2
      continue
    }
    if (inBlock && src[i] === '*' && src[i + 1] === '/') {
      inBlock = false
      out.push('  ')
      i += 2
      continue
    }
    if (inBlock) {
      out.push(src[i] === '\n' ? '\n' : ' ')
      i += 1
      continue
    }
    if (src[i] === '/' && src[i + 1] === '/') {
      // 行注释:遮到行尾。**先看引号状态** —— 本仓的 watermark 横幅里就有
      // `https://aizhs.top`,按裸 `//` 切断会把 URL 后半截当成注释抹掉;
      // 这条锁只找 `downloadAndInstall(` 形态,URL 里不可能有,
      // 所以这里刻意做**简单**遮罩即可,但不得反过来把真代码遮掉(见下方正例)。
      let j = i
      while (j < src.length && src[j] !== '\n') {
        out.push(' ')
        j += 1
      }
      i = j
      continue
    }
    out.push(src.charAt(i)) // charAt 恒返回 string(方括号取值在 noUncheckedIndexedAccess 下是 string | undefined)
    i += 1
  }
  return out.join('')
}

const MASKED_BRIDGE = maskComments(BRIDGE_SOURCE)

/** 这条锁的本体:导出给用例复用,禁止在断言里再抄一份正则(§22c)。 */
function findUnguardedInstalls(code: string): string[] {
  const bad: string[] = []
  // (a) 插件句柄的那一次调用必须是"赋值给局部变量 + 交给 withTimeout"的形态。
  //     裸 `await update.downloadAndInstall(` 一律红 —— 那正是修前的形态。
  if (/await\s+update\.downloadAndInstall\s*\(/.test(code)) {
    bad.push('裸 await update.downloadAndInstall( —— 未过 withTimeout 的插件层调用')
  }
  const handle = /const\s+(\w+)\s*=\s*update\.downloadAndInstall\s*\(/.exec(code)
  if (!handle) {
    // 找不到调用点 ⇒ 判据失明,不得被读成"通过"(本仓纪律:枚举到 0 个候选判死)
    bad.push('找不到 update.downloadAndInstall 的调用点(判据失明,不算通过)')
  } else {
    const varName = handle[1]
    const wired = new RegExp(`withTimeout\\(\\s*${varName}\\s*,`).test(code)
    if (!wired) bad.push(`update.downloadAndInstall 的结果 ${varName} 没有被交给 withTimeout`)
  }
  // (b) 退出链必须显式带上自己的预算与取消信号,不得退回"裸调用"。
  if (!/session\.downloadAndInstall\([\s\S]{0,400}?\{\s*signal[,\s]*timeoutMs:.*?\}/.test(code)) {
    bad.push('quit 链的 session.downloadAndInstall 未传 {signal,timeoutMs}')
  }
  return bad
}

describe('④ 反向锁 —— 不得再出现裸 await 的 downloadAndInstall', () => {
  it('真仓源码(遮罩注释后)零违规', () => {
    expect(findUnguardedInstalls(MASKED_BRIDGE)).toEqual([])
  })

  it('阳性对照:把"裸 await"喂回同一条判据必须判红(锁有牙,不是恒绿)', () => {
    const regressed = MASKED_BRIDGE.replace(
      /const install = update\.downloadAndInstall\s*\(/,
      'await update.downloadAndInstall(',
    )
    expect(regressed).not.toBe(MASKED_BRIDGE) // 替换必须真命中(否则这条对照是空转)
    expect(findUnguardedInstalls(regressed).length).toBeGreaterThan(0)
  })

  it('阳性对照:超时出口摘线(变量没交给 withTimeout)必须判红', () => {
    const unwired = MASKED_BRIDGE.replace(/withTimeout\(\s*install\s*,/, 'withTimeout(\n        install2,')
    expect(unwired).not.toBe(MASKED_BRIDGE)
    expect(findUnguardedInstalls(unwired).length).toBeGreaterThan(0)
  })

  it('阳性对照:调用点整块消失 ⇒ 判"判据失明",绝不静默算通过', () => {
    const vanished = MASKED_BRIDGE.replace(
      /const install = update\.downloadAndInstall\s*\(/,
      'const install = somethingElse(',
    )
    expect(vanished).not.toBe(MASKED_BRIDGE)
    expect(findUnguardedInstalls(vanished).join('|')).toContain('判据失明')
  })

  it('遮罩确实关掉注释里的违规形态,而不是关掉判据(构造面,不依赖本文件散文)', () => {
    // 同一句"裸 await"分别写在注释里和写在代码里:
    //   写在代码里 ⇒ 必须红;写在注释里 ⇒ 必须绿。
    // 只留其中一边就等于"把误报和漏报一起修没了"——那正是本仓记过的恒绿形态。
    const inCode = 'export async function f() {\n  await update.downloadAndInstall(cb)\n}\n'
    const inComment = 'export async function f() {\n  // await update.downloadAndInstall(cb)\n}\n'
    expect(findUnguardedInstalls(inCode)).toContain(
      '裸 await update.downloadAndInstall( —— 未过 withTimeout 的插件层调用',
    )
    const maskedCommentFace = maskComments(inComment)
    expect(maskedCommentFace).not.toContain('await update.downloadAndInstall')
    // 注释那一面不再命中裸 await(a) —— 它只剩"找不到调用点"这一条失明告警,
    // 也就是说遮罩把误报关掉了,却没有把判据本身关掉。
    expect(findUnguardedInstalls(maskedCommentFace)).not.toContain(
      '裸 await update.downloadAndInstall( —— 未过 withTimeout 的插件层调用',
    )
  })

  it('check() 那一档的调用形态逐字未变(本票不得顺手改坏已修好的路径)', () => {
    expect(MASKED_BRIDGE).toContain(
      'const result = await withTimeout(check(), CHECK_UPDATE_TIMEOUT_MS)',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

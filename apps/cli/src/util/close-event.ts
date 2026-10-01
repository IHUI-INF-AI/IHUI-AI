// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 关闭事件补发器(G-695)— "晚订阅者补发最近一次值 + 同一值只 fire 一次"的通用件。
 *
 * 立因(不是假想,是现仓实测的坏状态):`child.once('close')` 这类"等 close"的写法,
 * 一旦订阅发生在事件已经发出之后,EventEmitter 不会补发 ⇒ 那个 await 永不结算。
 * `apps/cli/src/util/spawn-isolated.ts` 的成功路径就是这么活的:close 已被 exitPromise
 * 观察到,其后兜底的 awaitReap 再挂一次 once('close'),只能等满整段 reap 预算
 * (现测一次 `node -e void 0` 的 spawnIsolated 耗时 2073ms,而真实执行只有几十毫秒)。
 * 票面那句"泛化补发器不存在 ⇒ 任何'等子进程 close'的形态一旦落地会永久挂"指的就是这一格。
 *
 * 判据(三条都写成可测的行为,不是风格):
 *  - **A 晚订阅补发**:先 fire 后 subscribe ⇒ 监听者在**微任务**内收到那一次的值,不经过任何定时器。
 *  - **B 单次 fire**:第一次 fire 之后,任何后续 fire 一律整块丢弃(不覆盖已记录的值、不再分发)。
 *    与 A 合起来才判得出"补发的是最近一次、且只补一次":只留 A 就无法证明"不重放旧的"。
 *  - **C 在途只一次**:fire 之前订阅的监听者当场同步收到一次,此后该订阅者不会再收到第二次
 *    (含 dispose 前/后);dispose 也撤销尚未执行的补发微任务。
 *
 * 与上游 `remote/closeEvent.ts:13-35` 同语义(那份额外用 Emitter 承载监听者,本仓无该运行时,
 * 故用一份自有监听集实现);刻意不做的事:不重放历史序列(只记最近一个值)、不加超时档
 * (超时是调用方的兜底策略,不属于"这一件事有没有发生过"的判据)。
 */

/** 关闭事件的监听者:收到那一次 fire 的值。 */
export type CloseListener<T> = (value: T) => void

/** 一次订阅的注销口:dispose 后监听者不再被调用(含尚未执行的补发微任务)。 */
export interface CloseSubscription {
  dispose(): void
}

/** 关闭事件的订阅面(可传给"只读这一面"的消费者,fire 权留在持有者)。 */
export interface CloseEvent<T> {
  (listener: CloseListener<T>): CloseSubscription
}

/** 关闭事件的持有者面:订阅 + 唯一一次 fire。 */
export interface CloseEventController<T> {
  /** 订阅口:晚订阅者会被微任务补发最近一次值。 */
  event: CloseEvent<T>
  /** 结算这一次关闭;第二次及以后的调用是 no-op(判据 B)。 */
  fire(value: T): void
  /** 是否已经结算(只读,供调用方判"要不要再等")。 */
  readonly closed: boolean
}

/**
 * 创建一个关闭事件补发器。
 *
 * @example
 *   const close = createCloseEventController<number | null>()
 *   child.once('close', (code) => close.fire(code ?? null))
 *   // 晚到的人:即使 close 已经发生,也会在微任务里拿到那一次的 code
 *   close.event((code) => console.log(code))
 */
export function createCloseEventController<T>(): CloseEventController<T> {
  const listeners = new Set<CloseListener<T>>()
  // settled 而非 (closed + lastValue) 两个变量:值与"有没有值"由同一个对象承载,
  // 于是读侧不需要 `as T` 断言,也不存在"标记已置而值还没写"的中间帧。
  let settled: { value: T } | undefined

  const event: CloseEvent<T> = (listener) => {
    if (settled) {
      const value = settled.value
      let active = true
      queueMicrotask(() => {
        // 判据 C:补发在微任务里跑,期间被 dispose 的订阅者不得再被调用。
        if (active) listener(value)
      })
      return {
        dispose(): void {
          active = false
        },
      }
    }
    listeners.add(listener)
    return {
      dispose(): void {
        listeners.delete(listener)
      },
    }
  }

  const fire = (value: T): void => {
    if (settled) return
    settled = { value }
    // 快照后清空:在途监听者只被同步调用这一次,后续 fire/订阅都不再触及它们(判据 B+C)。
    const current = [...listeners]
    listeners.clear()
    for (const listener of current) {
      listener(value)
    }
  }

  return {
    event,
    fire,
    get closed(): boolean {
      return settled !== undefined
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

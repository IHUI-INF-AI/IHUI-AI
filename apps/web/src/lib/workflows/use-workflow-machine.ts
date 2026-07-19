'use client'

import * as React from 'react'
import { createActor, type AnyStateMachine, type SnapshotFrom, type EventFromLogic } from 'xstate'

/**
 * XState v5 通用 React hook 包装器(无 @xstate/react 依赖)。
 *
 * 用法:
 * ```ts
 * const [snapshot, send, can] = useWorkflowMachine(approvalMachine)
 * send({ type: 'APPROVE', approverId: 'u-1' })
 * can({ type: 'APPROVE' }) // true if event type is allowed in current state
 * snapshot.value // 当前 state
 * snapshot.context // 当前 context
 * ```
 *
 * 行为:
 * - 仅在 client 端创建 actor(避免 SSR 报错)
 * - subscribe 同步状态变更 → useState 触发 rerender
 * - 组件卸载时 stop actor,清理 subscription
 */
export function useWorkflowMachine<M extends AnyStateMachine>(
  machine: M,
): [
  SnapshotFrom<M>,
  (event: EventFromLogic<M>) => void,
  (event: { type: EventFromLogic<M>['type'] }) => boolean,
] {
  const actorRef = React.useRef<ReturnType<typeof createActor<M>> | null>(null)
  const [snapshot, setSnapshot] = React.useState<SnapshotFrom<M> | null>(null)

  React.useEffect(() => {
    const actor = createActor(machine)
    actor.start()
    actorRef.current = actor
    setSnapshot(actor.getSnapshot())
    const sub = actor.subscribe((snap) => {
      setSnapshot(snap as SnapshotFrom<M>)
    })
    return () => {
      sub.unsubscribe()
      actor.stop()
      actorRef.current = null
      setSnapshot(null)
    }
  }, [machine])

  const send = React.useCallback((event: EventFromLogic<M>) => {
    actorRef.current?.send(event as never)
  }, [])

  // can({ type }):宽松检查当前状态是否接受该事件类型。
  //
  // 设计取舍:
  // - xstate 原生 `snap.can(event)` 会执行 guard 严格校验,会因缺 approverId 等
  //   必填字段而返回 false。这对 UI 按钮 enablement 不友好——按钮永远 disabled。
  // - 此处改为检查"事件类型在当前状态是否有 transition",忽略 guard 字段。
  //   实际 dispatch 时仍由 xstate 严格校验 guard,不会绕过业务约束。
  // - 适用于"按钮是否可点"的 UX 场景,不适用于"事件能否安全 dispatch"的断言场景。
  const can = React.useCallback(
    (event: { type: EventFromLogic<M>['type'] }): boolean => {
      const actor = actorRef.current
      if (!actor) return false
      const snap = actor.getSnapshot() as unknown as { value: string | object } | undefined
      if (!snap) return false
      const stateValue = snap.value
      if (typeof stateValue !== 'string') {
        // 并行状态(如 {a: 'b'})暂不处理
        return false
      }
      // 从 machine config 直接探测状态转移表(忽略 guard)
      const machineConfig = (machine as unknown as { config?: { states?: Record<string, { on?: Record<string, unknown> | ((...args: unknown[]) => unknown) }> } }).config
      const stateConfig = machineConfig?.states?.[stateValue]
      if (!stateConfig) return false
      const on = stateConfig.on
      if (!on) return false
      if (typeof on === 'function') return true
      return event.type in on
    },
    [machine],
  )

  return [
    (snapshot ?? ({} as SnapshotFrom<M>)),
    send,
    can,
  ]
}

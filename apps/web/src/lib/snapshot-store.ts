// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通用快照 store:Last Known Good / revision 单调 / connection generation
 * (机制吸收 G-977971;上游出处 zcode packages/ui/src/lib/providerSettingsSnapshot.ts:36-80,
 * 上游绑定 provider settings 域,本仓抽象成不绑域的工厂)。
 *
 * 核心规则:
 *  1. connectionGeneration 防旧连接 commit:每次 connect 递增代数,旧连接迟到的
 *     视图提交一律拒绝(换服务实例后,旧源的推送不得串写新状态);
 *  2. revision 单调 + 等值去重:回退的 revision 被拒(迟到旧包),等值 revision
 *     不重复广播(等值即不写,防订阅者空转重渲);
 *  3. Last Known Good:已有成功快照时读取失败保留旧数据不进 error 态,只有
 *     "从未成功过"的失败才落 error(reload 照常把错误抛给调用方自行处理);
 *  4. 先订阅再读:connect 时先把 reader 的变更订阅挂上,再发起首次读 ——
 *     防止 read 与服务端更新之间的事件窗口把推送丢掉;
 *  5. 同一时刻只有一个活跃连接的 reload 出口(单飞),无连接时 reload 拒绝。
 */

export type SnapshotState<TView> =
  | { status: 'loading' }
  | { status: 'ready'; view: TView }
  | { status: 'error'; error: Error }

/** 视图读取源:read 拉全量,subscribe 挂推送;connect 保证 subscribe 先于 read */
export interface SnapshotReader<TView> {
  read(): Promise<TView>
  subscribe(onChange: (view: TView) => void): () => void
}

export interface SnapshotConnection {
  ready: Promise<void>
  reload(): Promise<void>
  dispose(): void
}

export interface SnapshotStore<TView> {
  getSnapshot(): SnapshotState<TView>
  subscribe(listener: () => void): () => void
  connect(reader: SnapshotReader<TView>): SnapshotConnection
  /** 当前无连接时拒绝(没有连接就没有可重读的源) */
  reload(): Promise<void>
}

/** 视图必须自带单调 revision(上游同契约:revision 由服务端视图给出) */
export function createSnapshotStore<TView extends { revision: number }>(): SnapshotStore<TView> {
  let snapshot: SnapshotState<TView> = { status: 'loading' }
  let connectionGeneration = 0
  let activeReload: (() => Promise<void>) | null = null
  const listeners = new Set<() => void>()

  const publish = (): void => {
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    connect(reader) {
      connectionGeneration += 1
      const generation = connectionGeneration
      snapshot = { status: 'loading' }
      publish()

      const commit = (view: TView): void => {
        // 旧连接迟到的提交一律拒绝:换源后旧推送不得串写新状态
        if (generation !== connectionGeneration) return
        if (snapshot.status === 'ready') {
          const currentRevision = snapshot.view.revision
          const nextRevision = view.revision
          // revision 回退被拒(迟到旧包);等值不重复广播(等值即不写)
          if (nextRevision <= currentRevision) return
        }
        snapshot = { status: 'ready', view }
        publish()
      }

      const read = async (): Promise<void> => {
        try {
          commit(await reader.read())
        } catch (cause) {
          if (generation !== connectionGeneration) throw cause
          const error = cause instanceof Error ? cause : new Error(String(cause))
          // Last Known Good:已有成功快照时保留旧数据不进 error;
          // 只有从未成功过的失败才把 UI 推进可重试 error 态。
          if (snapshot.status !== 'ready') {
            snapshot = { status: 'error', error }
            publish()
          }
          throw error
        }
      }

      // 先订阅再读:防 read 与服务端更新之间丢事件
      const unsubscribe = reader.subscribe(commit)
      const ready = read()
      activeReload = read

      return {
        ready,
        reload: read,
        dispose() {
          unsubscribe()
          // 只清自己代数的 reload 出口,不动更新连接的
          if (generation === connectionGeneration) activeReload = null
        },
      }
    },

    reload() {
      return activeReload ? activeReload() : Promise.reject(new Error('快照源尚未连接,无可重读的源'))
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

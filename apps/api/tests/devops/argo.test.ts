import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ArgoCD GitOps 测试 — 用 mock 模拟 Application 同步 / 自动化 / 重试 / 回滚 / 多环境.
 *
 * 覆盖场景:
 *   - Application 定义: name + repoURL + path + targetRevision + syncPolicy
 *   - sync(application) 同步应用, 返回 syncStatus (Healthy/Progressing/Degraded)
 *   - 自动同步: syncPolicy.automated.enabled=true 时 webhook 触发自动同步
 *   - 同步失败重试: 最多 5 次指数退避
 *   - 回滚: rollbackTo(revision) 回滚到指定版本
 *   - 多环境: dev/staging/prod 不同 path, 不同 syncPolicy
 *   - 资源健康检查: deployment replicas 可用率
 */

// ---------- 类型定义 ----------
type SyncStatus = 'Healthy' | 'Progressing' | 'Degraded' | 'OutOfSync'
type OperationPhase = 'Succeeded' | 'Running' | 'Failed' | 'Error'

interface SyncPolicy {
  automated: {
    enabled: boolean
    prune: boolean // 自动删除孤儿资源
    selfHeal: boolean // 自动纠正漂移
  }
  retry: {
    limit: number // 最大重试次数
    backoff: {
      duration: number // 基础退避(秒)
      factor: number // 退避倍数
      maxDuration: number // 最大退避(秒)
    }
  }
}

interface Application {
  name: string
  repoURL: string
  path: string
  targetRevision: string
  syncPolicy: SyncPolicy
  env: 'dev' | 'staging' | 'prod'
}

interface SyncResult {
  app: string
  syncStatus: SyncStatus
  revision: string
  phase: OperationPhase
  attempts: number
  message: string
}

// ---------- mock: ArgoCD 控制器 ----------
class ArgoController {
  // 应用注册表
  private apps = new Map<string, Application>()
  // 历史同步记录(用于回滚)
  private history: Record<string, { revision: string; syncedAt: number }[]> = {}
  // 当前部署的 revision(模拟 git HEAD)
  private currentRevision = 'rev-1'
  // 资源状态模拟表: appName → { ready, desired }
  private resourceState: Record<string, { ready: number; desired: number }> = {}

  /** 注册应用 */
  register(app: Application): void {
    this.apps.set(app.name, app)
    this.history[app.name] = [{ revision: this.currentRevision, syncedAt: Date.now() }]
    // 初始假设所有副本就绪
    this.resourceState[app.name] = { ready: 3, desired: 3 }
  }

  /** 设置应用副本状态(模拟健康检查) */
  setReplicas(appName: string, ready: number, desired: number): void {
    this.resourceState[appName] = { ready, desired }
  }

  /** 推进 git revision(模拟 push) */
  advanceRevision(): string {
    const n = parseInt(this.currentRevision.split('-')[1], 10) + 1
    this.currentRevision = `rev-${n}`
    return this.currentRevision
  }

  /** 同步应用, 支持重试 + 指数退避 */
  sync(app: Application, opts: { forceFail?: boolean } = {}): SyncResult {
    const retry = app.syncPolicy.retry
    const maxAttempts = retry.limit + 1 // limit 是重试次数, 不含首次
    let attempts = 0
    let phase: OperationPhase = 'Running'
    let lastError = ''

    while (attempts < maxAttempts) {
      attempts += 1
      // 模拟同步逻辑: 失败则重试
      if (opts.forceFail) {
        // 强制失败(测试重试用)
        phase = 'Failed'
        lastError = `apply manifests failed (attempt ${attempts})`
        if (attempts < maxAttempts) {
          // 指数退避: duration * factor^(attempt-1)
          const backoff = Math.min(
            retry.backoff.duration * Math.pow(retry.backoff.factor, attempts - 1),
            retry.backoff.maxDuration,
          )
          // 不真正 sleep, 仅计算退避时长(测试中不需要真正等待)
          void backoff
          continue
        }
        break
      }
      // 成功
      phase = 'Succeeded'
      lastError = ''
      break
    }

    // 计算最终状态
    let syncStatus: SyncStatus
    if (phase === 'Succeeded') {
      syncStatus = this.computeHealth(app)
      this.history[app.name].push({ revision: app.targetRevision, syncedAt: Date.now() })
    } else {
      syncStatus = 'Degraded'
    }

    return {
      app: app.name,
      syncStatus,
      revision: app.targetRevision,
      phase,
      attempts,
      message: lastError || `synced to ${app.targetRevision}`,
    }
  }

  /** 资源健康检查: 根据 replicas 可用率返回 Healthy/Degraded/Progressing */
  private computeHealth(app: Application): SyncStatus {
    const s = this.resourceState[app.name]
    if (!s) return 'Degraded'
    if (s.ready === s.desired) return 'Healthy'
    if (s.ready === 0) return 'Degraded'
    return 'Progressing'
  }

  /** 自动同步: 仅当 syncPolicy.automated.enabled=true 才执行 */
  onGitPush(app: Application): SyncResult | null {
    if (!app.syncPolicy.automated.enabled) {
      return null
    }
    // 自动同步会先 prune + selfHeal
    return this.sync(app)
  }

  /** 回滚到指定 revision(从历史记录中找) */
  rollbackTo(app: Application, revision: string): SyncResult {
    const hist = this.history[app.name] || []
    const found = hist.find((h) => h.revision === revision)
    if (!found) {
      return {
        app: app.name,
        syncStatus: 'Degraded',
        revision,
        phase: 'Error',
        attempts: 1,
        message: `revision ${revision} not found in history`,
      }
    }
    // 回滚视为一次新同步
    const result: SyncResult = {
      app: app.name,
      syncStatus: this.computeHealth(app),
      revision,
      phase: 'Succeeded',
      attempts: 1,
      message: `rolled back to ${revision}`,
    }
    this.history[app.name].push({ revision, syncedAt: Date.now() })
    return result
  }

  /** 获取应用当前同步状态 */
  getStatus(appName: string): SyncStatus {
    const app = this.apps.get(appName)
    if (!app) return 'OutOfSync'
    return this.computeHealth(app)
  }
}

// ---------- mock: webhook 触发器 ----------
class WebhookTrigger {
  public onPush = vi.fn()
  emit(app: Application, controller: ArgoController): SyncResult | null {
    this.onPush(app)
    return controller.onGitPush(app)
  }
}

// ---------- 工具函数: 默认 syncPolicy ----------
function defaultSyncPolicy(over: Partial<SyncPolicy> = {}): SyncPolicy {
  return {
    automated: { enabled: false, prune: false, selfHeal: false },
    retry: {
      limit: 5,
      backoff: { duration: 5, factor: 2, maxDuration: 300 },
    },
    ...over,
  }
}

// ---------- 工具函数: 构造 Application ----------
function makeApp(over: Partial<Application> = {}): Application {
  return {
    name: 'ihui-api',
    repoURL: 'https://github.com/ihui/ihui-ai.git',
    path: 'k8s/api',
    targetRevision: 'main',
    syncPolicy: defaultSyncPolicy(),
    env: 'dev',
    ...over,
  }
}

// ---------- 测试 ----------
describe('argo — ArgoCD GitOps', () => {
  let controller: ArgoController
  let webhook: WebhookTrigger

  beforeEach(() => {
    controller = new ArgoController()
    webhook = new WebhookTrigger()
  })

  describe('Application 定义', () => {
    it('构造一个完整的 Application', () => {
      const app = makeApp({
        name: 'ihui-web',
        path: 'k8s/web',
        targetRevision: 'v1.2.0',
        env: 'prod',
        syncPolicy: defaultSyncPolicy({
          automated: { enabled: true, prune: true, selfHeal: true },
        }),
      })
      expect(app.name).toBe('ihui-web')
      expect(app.repoURL).toBe('https://github.com/ihui/ihui-ai.git')
      expect(app.path).toBe('k8s/web')
      expect(app.targetRevision).toBe('v1.2.0')
      expect(app.env).toBe('prod')
      expect(app.syncPolicy.automated.enabled).toBe(true)
      expect(app.syncPolicy.automated.prune).toBe(true)
      expect(app.syncPolicy.retry.limit).toBe(5)
    })

    it('syncPolicy 默认 retry.limit=5 + 指数退避', () => {
      const app = makeApp()
      expect(app.syncPolicy.retry.limit).toBe(5)
      expect(app.syncPolicy.retry.backoff.duration).toBe(5)
      expect(app.syncPolicy.retry.backoff.factor).toBe(2)
      expect(app.syncPolicy.retry.backoff.maxDuration).toBe(300)
    })
  })

  describe('sync(app) 同步状态', () => {
    it('副本全部就绪 → Healthy', () => {
      const app = makeApp()
      controller.register(app)
      controller.setReplicas(app.name, 3, 3)
      const r = controller.sync(app)
      expect(r.phase).toBe('Succeeded')
      expect(r.syncStatus).toBe('Healthy')
      expect(r.attempts).toBe(1)
    })

    it('副本部分就绪 → Progressing', () => {
      const app = makeApp()
      controller.register(app)
      controller.setReplicas(app.name, 1, 3)
      const r = controller.sync(app)
      expect(r.syncStatus).toBe('Progressing')
    })

    it('副本全部不可用 → Degraded', () => {
      const app = makeApp()
      controller.register(app)
      controller.setReplicas(app.name, 0, 3)
      const r = controller.sync(app)
      expect(r.syncStatus).toBe('Degraded')
    })
  })

  describe('自动同步 (syncPolicy.automated.enabled=true)', () => {
    it('automated=true 时 webhook 触发自动同步', () => {
      const app = makeApp({
        syncPolicy: defaultSyncPolicy({
          automated: { enabled: true, prune: false, selfHeal: false },
        }),
      })
      controller.register(app)
      const r = webhook.emit(app, controller)
      expect(webhook.onPush).toHaveBeenCalledTimes(1)
      expect(r).not.toBeNull()
      expect(r!.phase).toBe('Succeeded')
    })

    it('automated=false 时 webhook 不触发同步', () => {
      const app = makeApp({
        syncPolicy: defaultSyncPolicy({
          automated: { enabled: false, prune: false, selfHeal: false },
        }),
      })
      controller.register(app)
      const r = webhook.emit(app, controller)
      expect(webhook.onPush).toHaveBeenCalledTimes(1)
      expect(r).toBeNull()
    })
  })

  describe('同步失败重试 (最多 5 次, 指数退避)', () => {
    it('强制失败时重试 6 次 (1 次初始 + 5 次重试)', () => {
      const app = makeApp()
      controller.register(app)
      const r = controller.sync(app, { forceFail: true })
      expect(r.phase).toBe('Failed')
      expect(r.syncStatus).toBe('Degraded')
      // 1 次初始 + 5 次重试 = 6 次
      expect(r.attempts).toBe(6)
      expect(r.message).toContain('attempt 6')
    })

    it('retry.limit=2 时只重试 2 次 (共 3 次尝试)', () => {
      const app = makeApp({
        syncPolicy: {
          automated: { enabled: false, prune: false, selfHeal: false },
          retry: { limit: 2, backoff: { duration: 1, factor: 2, maxDuration: 10 } },
        },
      })
      controller.register(app)
      const r = controller.sync(app, { forceFail: true })
      expect(r.attempts).toBe(3) // 1 + 2
      expect(r.phase).toBe('Failed')
    })

    it('退避时长按 factor 指数增长 (5, 10, 20, 40, 80)', () => {
      // 计算理论退避: duration=5, factor=2 → 5, 10, 20, 40, 80 (均未超过 maxDuration=300)
      const backoff = defaultSyncPolicy().retry.backoff
      const expected = [5, 10, 20, 40, 80]
      expected.forEach((val, i) => {
        const actual = Math.min(backoff.duration * Math.pow(backoff.factor, i), backoff.maxDuration)
        expect(actual).toBe(val)
      })
    })
  })

  describe('回滚 rollbackTo(revision)', () => {
    it('回滚到历史存在的 revision → 成功', () => {
      const app = makeApp({ targetRevision: 'rev-1' })
      controller.register(app)
      // 推进 revision + 同步到 rev-2
      const rev2 = controller.advanceRevision()
      app.targetRevision = rev2
      controller.sync(app)
      // 回滚到 rev-1
      const r = controller.rollbackTo(app, 'rev-1')
      expect(r.phase).toBe('Succeeded')
      expect(r.syncStatus).toBe('Healthy')
      expect(r.message).toContain('rolled back to rev-1')
    })

    it('回滚到不存在的 revision → Error', () => {
      const app = makeApp()
      controller.register(app)
      const r = controller.rollbackTo(app, 'rev-999')
      expect(r.phase).toBe('Error')
      expect(r.syncStatus).toBe('Degraded')
      expect(r.message).toContain('not found')
    })
  })

  describe('多环境 (dev/staging/prod 不同 path 与 syncPolicy)', () => {
    it('dev: path=k8s/dev, automated=true, prune=true (允许自动清理)', () => {
      const app = makeApp({
        name: 'ihui-dev',
        path: 'k8s/dev',
        env: 'dev',
        syncPolicy: defaultSyncPolicy({
          automated: { enabled: true, prune: true, selfHeal: true },
        }),
      })
      controller.register(app)
      expect(app.path).toBe('k8s/dev')
      expect(app.syncPolicy.automated.enabled).toBe(true)
      expect(app.syncPolicy.automated.prune).toBe(true)
    })

    it('staging: path=k8s/staging, automated=true, prune=false (保守)', () => {
      const app = makeApp({
        name: 'ihui-staging',
        path: 'k8s/staging',
        env: 'staging',
        syncPolicy: defaultSyncPolicy({
          automated: { enabled: true, prune: false, selfHeal: false },
        }),
      })
      controller.register(app)
      expect(app.path).toBe('k8s/staging')
      expect(app.syncPolicy.automated.enabled).toBe(true)
      expect(app.syncPolicy.automated.prune).toBe(false)
    })

    it('prod: path=k8s/prod, automated=false (手动审批)', () => {
      const app = makeApp({
        name: 'ihui-prod',
        path: 'k8s/prod',
        env: 'prod',
        syncPolicy: defaultSyncPolicy({
          automated: { enabled: false, prune: false, selfHeal: false },
          retry: { limit: 10, backoff: { duration: 10, factor: 2, maxDuration: 600 } },
        }),
      })
      controller.register(app)
      expect(app.path).toBe('k8s/prod')
      expect(app.syncPolicy.automated.enabled).toBe(false)
      // prod 配置更高重试上限 + 更长退避
      expect(app.syncPolicy.retry.limit).toBe(10)
      expect(app.syncPolicy.retry.backoff.maxDuration).toBe(600)
    })

    it('prod 自动同步禁用时, git push 不触发同步', () => {
      const app = makeApp({
        name: 'ihui-prod',
        path: 'k8s/prod',
        env: 'prod',
        syncPolicy: defaultSyncPolicy({
          automated: { enabled: false, prune: false, selfHeal: false },
        }),
      })
      controller.register(app)
      const r = webhook.emit(app, controller)
      expect(r).toBeNull()
    })
  })

  describe('资源健康检查: deployment replicas 可用率', () => {
    it('可用率 100% → Healthy', () => {
      const app = makeApp()
      controller.register(app)
      controller.setReplicas(app.name, 3, 3)
      expect(controller.getStatus(app.name)).toBe('Healthy')
    })

    it('可用率 0% → Degraded', () => {
      const app = makeApp()
      controller.register(app)
      controller.setReplicas(app.name, 0, 3)
      expect(controller.getStatus(app.name)).toBe('Degraded')
    })

    it('可用率 50% → Progressing (滚动发布中)', () => {
      const app = makeApp()
      controller.register(app)
      controller.setReplicas(app.name, 2, 4)
      expect(controller.getStatus(app.name)).toBe('Progressing')
    })

    it('未注册应用 → OutOfSync', () => {
      expect(controller.getStatus('not-exists')).toBe('OutOfSync')
    })
  })
})

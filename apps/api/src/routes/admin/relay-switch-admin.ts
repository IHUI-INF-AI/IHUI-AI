// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/relay/switch-targets 本机登录态一键切换管理面(2026-10-27 立,对标 workbuddy-switch「换号」)。
 *
 * 端点清单:
 * 1. GET    /admin/relay/switch-targets                     — 列出本机全部可切号目标现状(零凭据)
 * 2. POST   /admin/relay/switch-targets/:id/capture         — 登记当前登录态为命名快照(body:{name})
 * 3. POST   /admin/relay/switch-targets/:id/switch          — 切到指定快照(body:{name,apply?},默认 dry-run)
 *
 * 安全纪律(高危操作:直接改写本机客户端凭据):
 * - 全程 requireAdmin 鉴权(与号池 admin 路由同级);审计由 plugins/audit.ts 的 onResponse 钩子自动写入。
 * - 响应/错误**绝不回显任何凭据内容**(token/refreshToken/cookie/密钥);只报形状、路径、计数。
 * - 同目标切换串行化:进程内互斥,防同一目标并发改写造成半切换态。
 * - 修改本地文件前 core 层已做:名称校验、完整性校验、pre-switch 自动备份、临时名→rename→sha256 全量对账。
 *
 * 能力边界:codearts-agent 等 supported===false 的目标,list 如实标注"未支持(原因)",写操作直接 400 拒绝。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import os from 'node:os'
import { join } from 'node:path'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { resolveTargets, type SwitchTarget } from '../../services/relay-switch/profiles.js'
import {
  loadExternalTargets,
  readCurrentState,
  listSnapshots,
  captureCurrent,
  planSwitch,
  applySwitch,
  type SwitchPaths,
} from '../../services/relay-switch/core.js'

/** 外部自定义 profile 默认目录(与 CLI relay-switch.ts 一致) */
function defaultProfileDir(home: string): string {
  return join(home, '.wb-switch', 'switch-profiles')
}

/** 测试注入缝:用一组合成目标覆盖本机探测(仅测试,生产恒为 null) */
let __catalogOverride: SwitchTarget[] | null = null
export function __test_setCatalogOverride(targets: SwitchTarget[] | null): void {
  __catalogOverride = targets
}

interface CatalogResult {
  targets: SwitchTarget[]
  errors: { file: string; error: string }[]
  builtinCount: number
  externalCount: number
}

function buildCatalog(): CatalogResult {
  if (__catalogOverride) {
    return {
      targets: __catalogOverride,
      errors: [],
      builtinCount: __catalogOverride.length,
      externalCount: 0,
    }
  }
  const home = os.homedir()
  const builtin = resolveTargets(home, process.env['APPDATA'])
  const profileDir = defaultProfileDir(home)
  const external = loadExternalTargets(profileDir, { reservedIds: builtin.map((t) => t.id) })
  return {
    targets: [...builtin, ...external.targets],
    errors: external.errors,
    builtinCount: builtin.length,
    externalCount: external.targets.length,
  }
}

function pathsOf(target: SwitchTarget): SwitchPaths {
  return { target, snapDir: target.snapRoot }
}

/** 目标 → 安全 DTO(零凭据:只形状/路径/状态计数/摘要哈希) */
function targetToDto(t: SwitchTarget, withSnapshots: boolean) {
  const state = readCurrentState(t)
  const dto: Record<string, unknown> = {
    id: t.id,
    label: t.label,
    kind: t.kind,
    supported: t.supported !== false,
    unsupportedReason: t.supported === false ? (t.unsupportedReason ?? '未实现') : null,
    requiresStoppedApp: t.requiresStoppedApp !== false,
    hintMode: t.hintMode,
    baseDirCandidates: t.baseDirCandidates,
    files: t.files,
    auxFiles: t.auxFiles ?? [],
    snapRoot: t.snapRoot,
    loginHints: t.loginHints,
    notes: t.notes ?? [],
    state: {
      installed: state.installed,
      complete: state.complete,
      missingFiles: state.missingFiles,
      hintHits: state.hintHits,
      sha12s: state.sha12s,
      modifiedAt: state.modifiedAt ?? null,
      auxPresent: state.auxPresent ?? [],
      coherenceOk: state.coherenceOk ?? null,
      coherenceDetail: state.coherenceDetail ?? null,
    },
  }
  if (withSnapshots) {
    dto.snapshots = listSnapshots(pathsOf(t)).map((s) => ({
      name: s.name,
      capturedAt: s.capturedAt,
      sameAsCurrent: s.sameAsCurrent,
      sha12s: s.sha12s,
    }))
  }
  return dto
}

/** 同目标切换串行化(进程内互斥,防并发半切换态) */
const switchLocks = new Map<string, Promise<unknown>>()

const relaySwitchAdminRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/relay/switch-targets — 目标总览(零凭据) =====
  server.get('/admin/relay/switch-targets', async (_request, reply) => {
    const catalog = buildCatalog()
    return reply.send(
      success({
        builtinCount: catalog.builtinCount,
        externalCount: catalog.externalCount,
        profileErrors: catalog.errors,
        targets: catalog.targets.map((t) => targetToDto(t, true)),
      }),
    )
  })

  // ===== 2. POST /admin/relay/switch-targets/:id/capture — 登记当前登录态为快照 =====
  server.post('/admin/relay/switch-targets/:id/capture', async (request, reply) => {
    const params = z.object({ id: z.string().min(1).max(64) }).safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, '非法目标 id'))
    const body = z
      .object({ name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, '快照名非法') })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '快照名只允许字母数字._-,1~64 位'))
    const catalog = buildCatalog()
    const target = catalog.targets.find((t) => t.id === params.data.id)
    if (!target) return reply.status(404).send(error(404, `未知目标:${params.data.id}`))
    if (target.supported === false)
      return reply
        .status(400)
        .send(error(400, `目标未支持:${target.unsupportedReason ?? '未实现'}`))
    const out = captureCurrent(pathsOf(target), body.data.name)
    if (!out.ok) return reply.status(400).send(error(400, out.error ?? 'capture 失败'))
    return reply.send(success({ snapshotDir: out.snapshotDir, name: body.data.name }))
  })

  // ===== 3. POST /admin/relay/switch-targets/:id/switch — 切到指定快照(默认 dry-run) =====
  server.post('/admin/relay/switch-targets/:id/switch', async (request, reply) => {
    const params = z.object({ id: z.string().min(1).max(64) }).safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, '非法目标 id'))
    const body = z
      .object({
        name: z.string().min(1).max(64),
        apply: z.boolean().optional().default(false),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '请求体非法'))
    const catalog = buildCatalog()
    const target = catalog.targets.find((t) => t.id === params.data.id)
    if (!target) return reply.status(404).send(error(404, `未知目标:${params.data.id}`))
    if (target.supported === false)
      return reply
        .status(400)
        .send(error(400, `目标未支持:${target.unsupportedReason ?? '未实现'}`))

    const run = async () => {
      try {
        const paths = pathsOf(target)
        let plan
        try {
          plan = planSwitch(paths, body.data.name)
        } catch (e) {
          return reply.status(400).send(error(400, e instanceof Error ? e.message : '计划生成失败'))
        }
        if (!body.data.apply) {
          return reply.send(
            success({ dryRun: true, plan, snapshots: listSnapshots(paths).map((s) => s.name) }),
          )
        }
        const res = applySwitch(paths, plan)
        if (!res.ok) return reply.status(400).send(error(400, res.error ?? '切换失败'))
        return reply.send(
          success({
            dryRun: false,
            applied: true,
            preSwitchBackupDir: res.preSwitchBackupDir,
            newSha12s: res.newSha12s,
          }),
        )
      } catch (e) {
        if (!reply.sent)
          return reply.status(500).send(error(500, e instanceof Error ? e.message : '切换异常'))
        return undefined
      }
    }

    // 同目标串行化
    const prev = switchLocks.get(target.id) ?? Promise.resolve()
    const next = prev.then(run, run)
    switchLocks.set(
      target.id,
      next.catch(() => {}),
    )
    return next
  })
}

export default relaySwitchAdminRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import type {
  AgentTeam,
  AgentTeamInboxEntry,
  AgentTeamInboxKind,
  AgentTeamMember,
  AgentTeamMemberKind,
  AgentTeamRole,
} from '@ihui/database'
import {
  postgresAgentTeamRepository,
  type AgentTeamMemberRef,
  type AgentTeamRepository,
} from '../db/agent-team-queries.js'

/** 生产默认产物根:只允许转交该目录内的文件,避免 API 变成任意路径读取器 */
const DEFAULT_ARTIFACT_ROOT = resolve(process.cwd(), '.ihui-agent', 'team-artifacts')

export type AgentTeamErrorCode =
  | 'TEAM_NOT_FOUND'
  | 'NOT_TEAM_MEMBER'
  | 'NOT_TEAM_LEAD'
  | 'MEMBER_ALREADY_IN_ACTIVE_TEAM'
  | 'MEMBER_ALREADY_IN_TEAM'
  | 'LAST_LEAD_REQUIRED'
  | 'HANDOFF_REQUIRES_ENDPOINT'
  | 'ARTIFACT_NOT_FOUND'
  | 'ARTIFACT_PATH_OUT_OF_SCOPE'
  | 'ARTIFACT_SHA256_MISMATCH'
  | 'INBOX_ENTRY_NOT_FOUND'
  | 'TEAM_NAME_INVALID'

export class AgentTeamError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: AgentTeamErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AgentTeamError'
  }
}

export interface AgentTeamServiceOptions {
  repo?: AgentTeamRepository
  /** 产物根目录;缺省取 env IHUI_TEAM_ARTIFACT_ROOT,再退到 .ihui-agent/team-artifacts */
  artifactRoot?: string
}

export interface TeamView {
  team: AgentTeam
  members: AgentTeamMember[]
}

export interface SendInboxInput {
  fromMember: AgentTeamMemberRef
  toMember: AgentTeamMemberRef
  kind: AgentTeamInboxKind
  payload: Record<string, unknown>
  idempotencyKey: string
}

export interface HandoffInput {
  artifactPath: string
  sha256: string
  fromMember: AgentTeamMemberRef
  toMember: AgentTeamMemberRef
  idempotencyKey: string
}

export interface InboxSendResult {
  entry: AgentTeamInboxEntry
  duplicated: boolean
}

function memberLabel(ref: AgentTeamMemberRef): string {
  return `${ref.memberKind}:${ref.memberId}`
}

function isUniqueViolation(error: unknown): error is { code: string; constraint?: string } {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  )
}

/**
 * 多 Agent 协作服务:团队 / 成员 / 持久收件箱 / 产物转交。
 *
 * 权限判据只在服务层落地(不靠 UI):
 * - 建队:调用者已在任一 active team → 409,保证成员同一时刻只归一个团队;
 * - 增删成员 / 解散:调用者必须是该团队的 lead,member 一律 403;
 * - 团队读写:调用者必须是该团队的 active human 成员,否则 404(不泄露团队是否存在)。
 *
 * 收件箱幂等由存储层唯一键兜底,服务层只负责把"已存在"翻译成 duplicated=true。
 */
export function createAgentTeamService(options: AgentTeamServiceOptions = {}) {
  const repo = options.repo ?? postgresAgentTeamRepository
  const artifactRoot = resolve(
    options.artifactRoot ?? process.env.IHUI_TEAM_ARTIFACT_ROOT ?? DEFAULT_ARTIFACT_ROOT,
  )

  async function loadActiveTeam(actorUserId: string, teamId: string): Promise<TeamView> {
    const team = await repo.findTeamById(teamId)
    // 不存在与"不是本团队成员"统一回 404:跨租户不得通过状态码差异探测团队存在性。
    if (!team || team.status !== 'active') {
      throw new AgentTeamError(404, 'TEAM_NOT_FOUND', '团队不存在或已解散')
    }
    const actor = await repo.findMember(teamId, { memberKind: 'human', memberId: actorUserId })
    if (!actor) throw new AgentTeamError(404, 'TEAM_NOT_FOUND', '团队不存在或无权访问')
    const members = await repo.listMembers(teamId)
    return { team, members }
  }

  async function requireLead(actorUserId: string, teamId: string): Promise<TeamView> {
    const view = await loadActiveTeam(actorUserId, teamId)
    const actor = view.members.find((m) => m.memberKind === 'human' && m.memberId === actorUserId)
    if (!actor || actor.role !== 'lead') {
      throw new AgentTeamError(403, 'NOT_TEAM_LEAD', '只有 lead 可以管理团队与成员')
    }
    return view
  }

  async function requireActiveMember(
    teamId: string,
    ref: AgentTeamMemberRef,
  ): Promise<AgentTeamMember> {
    const member = await repo.findMember(teamId, ref)
    if (!member) {
      throw new AgentTeamError(403, 'NOT_TEAM_MEMBER', `成员 ${memberLabel(ref)} 不在该团队`)
    }
    return member
  }

  return {
    /** 创建团队并把 owner 落成 lead;已在任一 active team 的人/Agent 不得再建队 */
    async createTeam(actorUserId: string, name: string): Promise<TeamView> {
      const trimmed = name.trim()
      if (trimmed.length === 0 || trimmed.length > 128) {
        throw new AgentTeamError(400, 'TEAM_NAME_INVALID', '团队名称长度必须在 1-128 之间')
      }
      const existing = await repo.findActiveTeamByMember({
        memberKind: 'human',
        memberId: actorUserId,
      })
      if (existing) {
        throw new AgentTeamError(
          409,
          'MEMBER_ALREADY_IN_ACTIVE_TEAM',
          '当前主体已属于一个 active 团队,先退出或解散后才能新建',
          { teamId: existing.team.id },
        )
      }
      try {
        const { team } = await repo.createTeamWithLead({ ownerId: actorUserId, name: trimmed })
        const members = await repo.listMembers(team.id)
        return { team, members }
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AgentTeamError(
            409,
            'MEMBER_ALREADY_IN_ACTIVE_TEAM',
            '当前主体已属于一个 active 团队,先退出或解散后才能新建',
          )
        }
        throw error
      }
    },

    async getTeam(actorUserId: string, teamId: string): Promise<TeamView> {
      return loadActiveTeam(actorUserId, teamId)
    },

    async addMember(
      actorUserId: string,
      teamId: string,
      input: { memberKind: AgentTeamMemberKind; memberId: string; role: AgentTeamRole },
    ): Promise<AgentTeamMember> {
      await requireLead(actorUserId, teamId)
      const ref: AgentTeamMemberRef = { memberKind: input.memberKind, memberId: input.memberId }
      const existing = await repo.findActiveTeamByMember(ref)
      if (existing) {
        const code =
          existing.team.id === teamId ? 'MEMBER_ALREADY_IN_TEAM' : 'MEMBER_ALREADY_IN_ACTIVE_TEAM'
        throw new AgentTeamError(
          409,
          code,
          code === 'MEMBER_ALREADY_IN_TEAM'
            ? `成员 ${memberLabel(ref)} 已在当前团队`
            : `成员 ${memberLabel(ref)} 已属于另一个 active 团队`,
          { teamId: existing.team.id },
        )
      }
      try {
        return await repo.insertMember({ teamId, ...input })
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AgentTeamError(
            409,
            'MEMBER_ALREADY_IN_ACTIVE_TEAM',
            `成员 ${memberLabel(ref)} 已属于一个 active 团队`,
          )
        }
        throw error
      }
    },

    async removeMember(
      actorUserId: string,
      teamId: string,
      ref: AgentTeamMemberRef,
    ): Promise<AgentTeamMember> {
      await requireLead(actorUserId, teamId)
      const target = await repo.findMember(teamId, ref)
      if (!target) {
        throw new AgentTeamError(404, 'NOT_TEAM_MEMBER', `成员 ${memberLabel(ref)} 不在该团队`)
      }
      if (target.role === 'lead' && (await repo.countActiveLeads(teamId)) <= 1) {
        throw new AgentTeamError(409, 'LAST_LEAD_REQUIRED', '团队至少需要保留一名 lead')
      }
      const row = await repo.markMemberLeft(teamId, ref)
      if (!row)
        throw new AgentTeamError(404, 'NOT_TEAM_MEMBER', `成员 ${memberLabel(ref)} 不在该团队`)
      return row
    },

    async dissolveTeam(actorUserId: string, teamId: string): Promise<AgentTeam> {
      await requireLead(actorUserId, teamId)
      const team = await repo.dissolveTeam(teamId)
      if (!team) throw new AgentTeamError(404, 'TEAM_NOT_FOUND', '团队不存在或已解散')
      return team
    },

    /**
     * 发送收件箱消息(幂等)。from/to 都必须是当前 active 成员。
     * handoff 不允许走本入口:产物转交必须带 sha256 校验,只能走 handoff()。
     */
    async sendInbox(
      actorUserId: string,
      teamId: string,
      input: SendInboxInput,
    ): Promise<InboxSendResult> {
      await loadActiveTeam(actorUserId, teamId)
      if (input.kind === 'handoff') {
        throw new AgentTeamError(400, 'HANDOFF_REQUIRES_ENDPOINT', '产物转交请走 handoff 端点')
      }
      await requireActiveMember(teamId, input.fromMember)
      await requireActiveMember(teamId, input.toMember)
      return repo.insertInbox({
        teamId,
        fromMemberKind: input.fromMember.memberKind,
        fromMemberId: input.fromMember.memberId,
        toMemberKind: input.toMember.memberKind,
        toMemberId: input.toMember.memberId,
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
      })
    },

    /** 拉取收件箱:固定按 teamId + toMember 过滤;越权在进入查询前已被 404 拦下 */
    async listInbox(
      actorUserId: string,
      teamId: string,
      to?: AgentTeamMemberRef,
    ): Promise<AgentTeamInboxEntry[]> {
      await loadActiveTeam(actorUserId, teamId)
      if (to) await requireActiveMember(teamId, to)
      return repo.listInbox(teamId, to)
    },

    async markInboxRead(
      actorUserId: string,
      teamId: string,
      entryId: string,
    ): Promise<AgentTeamInboxEntry> {
      await loadActiveTeam(actorUserId, teamId)
      const row = await repo.markInboxRead(teamId, entryId, new Date())
      if (!row) throw new AgentTeamError(404, 'INBOX_ENTRY_NOT_FOUND', '收件箱条目不存在')
      return row
    },

    /**
     * 产物转交:先校验路径在允许根内,再重算文件 sha256;
     * 与请求声明不一致时拒绝,并把 expected/actual 两个值原样带回。
     */
    async handoff(
      actorUserId: string,
      teamId: string,
      input: HandoffInput,
    ): Promise<InboxSendResult> {
      await loadActiveTeam(actorUserId, teamId)
      await requireActiveMember(teamId, input.fromMember)
      await requireActiveMember(teamId, input.toMember)

      const fullPath = isAbsolute(input.artifactPath)
        ? resolve(input.artifactPath)
        : resolve(artifactRoot, input.artifactPath)
      const rel = relative(artifactRoot, fullPath)
      if (rel.startsWith('..') || isAbsolute(rel)) {
        throw new AgentTeamError(
          403,
          'ARTIFACT_PATH_OUT_OF_SCOPE',
          '产物路径不在允许的转交根目录内',
          { artifactRoot },
        )
      }

      let content: Buffer
      try {
        content = await readFile(fullPath)
      } catch {
        throw new AgentTeamError(404, 'ARTIFACT_NOT_FOUND', '产物文件不存在或不可读', {
          artifactPath: input.artifactPath,
        })
      }
      const actualSha256 = createHash('sha256').update(content).digest('hex')
      if (actualSha256 !== input.sha256.toLowerCase()) {
        throw new AgentTeamError(409, 'ARTIFACT_SHA256_MISMATCH', '产物完整性校验失败', {
          expectedSha256: input.sha256.toLowerCase(),
          actualSha256,
        })
      }

      const transferredAt = new Date().toISOString()
      return repo.insertInbox({
        teamId,
        fromMemberKind: input.fromMember.memberKind,
        fromMemberId: input.fromMember.memberId,
        toMemberKind: input.toMember.memberKind,
        toMemberId: input.toMember.memberId,
        kind: 'handoff',
        idempotencyKey: input.idempotencyKey,
        payload: {
          artifactPath: input.artifactPath,
          sha256: actualSha256,
          fromMember: memberLabel(input.fromMember),
          toMember: memberLabel(input.toMember),
          transferredAt,
          sizeBytes: content.byteLength,
        },
      })
    },
  }
}

export type AgentTeamService = ReturnType<typeof createAgentTeamService>

/** 路由层默认实例(真实 PostgreSQL 仓库 + 环境产物根) */
export const agentTeamService = createAgentTeamService()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

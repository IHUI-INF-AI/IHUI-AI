// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0-8 第十二批:仓库路径登记面(2026-11-23)。
 *
 * 钉住四件事:
 * ① `repoId` 不可逆 ⇒ 必须有登记面,否则"该重建哪些"的清单到不了"能重建";
 * ② 登记是 upsert,归属取自认证身份且 NOT NULL;
 * ③ 清单真的拼上 `localPath`(未登记 = null),不是只在服务里存着;
 * ④ 装车:三端点(GET 清单 / PUT 登记 / DELETE 摘除)与 401/400 拒绝路径。
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { judgeRebuildCandidates } from '../codebase-index-service.js'

const REPO_ROOT = path.resolve(__dirname, '../../../../..')
const SCHEMA = fs.readFileSync(path.join(REPO_ROOT, 'packages/database/src/schema/codebase-index.ts'), 'utf8')
const SERVICE = fs.readFileSync(path.join(REPO_ROOT, 'apps/api/src/services/codebase-index-service.ts'), 'utf8')
const ROUTE = fs.readFileSync(path.join(REPO_ROOT, 'apps/api/src/routes/v1-codebase-search.ts'), 'utf8')
const JOURNAL = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'packages/database/drizzle/meta/_journal.json'), 'utf8'),
) as { entries: { idx: number; tag: string }[] }

describe('P0-8l 仓库路径登记面', () => {
  it('schema:codebase_repos 表 + (owner, repo) 唯一索引,ownerUuid NOT NULL', () => {
    expect(SCHEMA).toMatch(/pgTable\(\s*\n?\s*'codebase_repos'/)
    expect(SCHEMA).toMatch(/uniqueIndex\('ux_codebase_repos_owner_repo'\)\.on\(t\.ownerUuid, t\.repoId\)/)
    expect(SCHEMA).toMatch(/ownerUuid: uuid\('owner_uuid'\)\.notNull\(\)/)
    expect(SCHEMA).toMatch(/localPath: text\('local_path'\)\.notNull\(\)/)
  })

  it('迁移只建表与索引,不写 UPDATE(不编造存量路径)', () => {
    const sql = fs.readFileSync(
      path.join(REPO_ROOT, 'packages/database/drizzle/20261123210000_codebase_repos.sql'),
      'utf8',
    )
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "codebase_repos"/)
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "ux_codebase_repos_owner_repo"/)
    expect(sql).not.toMatch(/UPDATE\s+"codebase_repos"/)
  })

  it('journal 已登记末条迁移', () => {
    const last = JOURNAL.entries[JOURNAL.entries.length - 1]
    expect(last?.tag).toBe('20261123210000_codebase_repos')
    expect(last?.idx).toBe(453)
  })

  it('服务:登记归属缺失即抛错,upsert 走 onConflictDoUpdate', () => {
    expect(SERVICE).toMatch(
      /registerRepoPath 缺少 ownerUuid:拒绝登记无归属的仓库路径/,
    )
    expect(SERVICE).toMatch(
      /codebaseRepos[\s\S]{0,420}onConflictDoUpdate\(\{[\s\S]{0,220}target: \[codebaseRepos\.ownerUuid, codebaseRepos\.repoId\]/,
    )
  })

  it('服务:listRepoPaths 归属缺失零 DB(先 return 空 Map)', () => {
    expect(SERVICE).toMatch(
      /async listRepoPaths\([\s\S]{0,240}if \(!ownerUuid\) return out/,
    )
  })

  it('服务:清单拼上 localPath,未登记为 null', () => {
    expect(SERVICE).toMatch(/const paths = await this\.listRepoPaths\(ownerUuid\)/)
    expect(SERVICE).toMatch(/localPath: paths\.get\(c\.repoId\)\?\.localPath \?\? null/)
  })

  it('纯判据不读 DB:judgeRebuildCandidates 仍只产四态与时刻', () => {
    const out = judgeRebuildCandidates(
      [{ repoId: 'r1', state: null }],
      'fp',
      Date.now(),
      0,
    )
    expect(out).toHaveLength(1)
    expect(out[0]?.localPath).toBeUndefined()
  })

  it('路由:三端点接线 + 401/400 拒绝路径', () => {
    expect(ROUTE).toMatch(/server\.get\('\/repos'/)
    expect(ROUTE).toMatch(/server\.put\('\/repos\/:repoId\/path'/)
    expect(ROUTE).toMatch(/server\.delete\('\/repos\/:repoId\/path'/)
    expect(ROUTE).toMatch(/无法确定调用者身份:仓库登记按归属隔离/)
    expect(ROUTE).toMatch(/拒绝登记无归属的仓库路径/)
    expect(ROUTE).toMatch(/缺少 repoId/)
    expect(ROUTE).toMatch(/codebaseIndexService\.registerRepoPath\(\{[\s\S]{0,180}ownerUuid: req\.userId/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

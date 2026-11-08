// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-08 / DB-10 静态接线夹具(不连库、不跑 CI)。
 *
 * DB-08: 全新库首启(`docker compose up` → migrate 服务)必须真正走到
 *        pre-migrate-fresh-db-guard.mjs,而不是只留一句头注。
 * DB-10: migration-tests.yml 不得监听不存在的 packages/database/migrations/**,
 *        不得用 `drizzle-kit push --force` 绕过迁移链,基础镜像必须带 pgvector。
 *
 * 全部判据都是"读文件文本",改前必红、改后必绿。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

describe('DB-08 全新库守卫接线', () => {
  it('Dockerfile.migrate: 镜像必须带 guard 脚本且默认命令走 fresh 两遍链路', () => {
    const text = read('deploy/docker/Dockerfile.migrate')
    assert.match(text, /COPY packages\/database\/scripts/, '镜像未 COPY packages/database/scripts,guard 不存在于容器内')
    assert.match(text, /db:migrate:fresh/, '镜像 CMD 未走 db:migrate:fresh(守卫始终不会被调用)')
    assert.doesNotMatch(text, /^CMD \["pnpm", "run", "db:migrate"\]$/m, '镜像 CMD 仍是裸 db:migrate')
  })

  it('package.json: db:migrate:fresh 必须由守卫编排(而非裸 drizzle-kit migrate)', () => {
    const text = read('packages/database/package.json')
    const pkg = JSON.parse(text)
    const fresh = pkg.scripts['db:migrate:fresh']
    assert.ok(fresh, '缺少 db:migrate:fresh 脚本')
    assert.match(fresh, /pre-migrate-fresh-db-guard\.mjs/, 'db:migrate:fresh 未调用守卫')
    assert.match(fresh, /--orchestrate/, 'db:migrate:fresh 未启用两遍编排模式')
  })

  it('guard 脚本:具备 --orchestrate 两遍迁移编排(第一遍失败→守卫→第二遍)', () => {
    const text = read('packages/database/scripts/pre-migrate-fresh-db-guard.mjs')
    assert.match(text, /--orchestrate/, '守卫未实现 --orchestrate 模式')
    assert.match(text, /spawnSync/, '守卫未真正拉起 drizzle-kit migrate')
    assert.match(text, /db:migrate/, '守卫未把第一遍/第二遍交给 db:migrate')
  })

  it('docker-compose.yml: migrate 服务显式引用 fresh 链路', () => {
    const text = read('docker-compose.yml')
    const migrateBlock = text.split(/^  migrate:/m)[1]?.split(/^  [a-zA-Z0-9_-]+:/m)[0] ?? ''
    assert.match(migrateBlock, /db:migrate:fresh/, 'compose 的 migrate 服务未接线 fresh-db 守卫链路')
  })
})

describe('DB-10 migration-tests.yml 不再空转', () => {
  const text = () => read('.github/workflows/migration-tests.yml')

  it('触发路径监听真实存在的迁移/脚本目录,不再监听空目录', () => {
    const yml = text()
    assert.match(yml, /packages\/database\/drizzle\/\*\*/, '未监听 packages/database/drizzle/**')
    assert.match(yml, /packages\/database\/scripts\/\*\*/, '未监听 packages/database/scripts/**')
    assert.doesNotMatch(yml, /packages\/database\/migrations\/\*\*/, '仍在监听不存在的 packages/database/migrations/**')
  })

  it('基础镜像带 pgvector(postgres:18 不含 vector 扩展)', () => {
    const yml = text()
    assert.match(yml, /image:\s*pgvector\/pgvector:pg18/, 'service 镜像未换成 pgvector/pgvector:pg18')
    assert.doesNotMatch(yml, /image:\s*postgres:18\b/, '仍在用不含 pgvector 的 postgres:18')
  })

  it('步骤走空库 migrate + 守卫 + 第二遍,而不是 push --force', () => {
    const yml = text()
    // 注释里会解释"为何不用 push --force",判据只看可执行行
    const executable = yml
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n')
    assert.doesNotMatch(executable, /push\s+--force/, '仍在用 drizzle-kit push --force 绕过迁移链')
    assert.match(yml, /pre-migrate-fresh-db-guard\.mjs/, '未调用 pre-migrate-fresh-db-guard.mjs')
    const migrateRuns = yml.match(/drizzle-kit migrate/g) ?? []
    assert.ok(migrateRuns.length >= 2, `drizzle-kit migrate 只出现 ${migrateRuns.length} 次,未做两遍`)
    assert.match(yml, /DATABASE_URL:/, '迁移步骤未注入 DATABASE_URL')
  })
})

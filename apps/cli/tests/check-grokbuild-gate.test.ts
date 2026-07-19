/**
 * grokbuild 守门脚本自测(check-grokbuild-integration-completeness.mjs)。
 *
 * 设计:
 *   - 在临时目录里构造伪项目(fakeroot),覆写 .ts/.js 文件用纯字符串桩
 *   - 跑守门脚本(子进程 spawn node + SCRIPT_PATH + fakeroot)
 *   - 断言 exit code + stdout 关键字
 *
 * 场景 1-7:基础守门(子目录文件存在/缺失 → pass/fail)
 * 场景 8:--staged 在非 git 环境
 * 场景 9:防御性测试 — P47 8 项 CLAIM 必须入库
 * 场景 10:防御性测试 — P48 4 项 CLAIM 必须入库
 *
 * 防御性测试目的:任何 P-轮若忘记把 CLAIM 项加入守门脚本,
 * 该场景失败阻断 commit,防止"虚假声明"漂移模式再次出现。
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = path.resolve(__dirname, '../../../scripts/check-grokbuild-integration-completeness.mjs')

// ==================== 工具函数 ====================

/**
 * 构造伪项目目录,按路径创建文件,内容由文件路径 hash 给出。
 * 返回目录路径(测试结束后需 cleanup)。
 */
function setupProject(files: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-integration-'))
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
  }
  return root
}

function cleanup(root: string): void {
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

/**
 * 跑守门脚本(子进程),返回 { code, stdout, stderr }。
 */
function runGatekeeper(
  fakeroot: string,
  extraArgs: string[] = [],
): { code: number; stdout: string; stderr: string } {
  const result = spawnSync('node', [SCRIPT_PATH, fakeroot, ...extraArgs], {
    encoding: 'utf-8',
    timeout: 30_000,
    windowsHide: true,
  })
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

// ==================== 基础守门场景 ====================

/**
 * 场景 1:全 8 项 INTEGRATED_CLAIMS 都具备真实接入,守门通过。
 * 这是 happy path。
 */
describe('场景 1: 全 8 项 INTEGRATED_CLAIMS 都有真实接入 → 守门通过', () => {
  let root: string
  beforeAll(() => {
    root = setupProject({
      'apps/api/src/utils/circuit-breaker.ts': 'export const circuitBreaker = 1',
      'apps/api/src/utils/circuit-breaker.test.ts': 'export const t = 1',
      'apps/api/src/services/hook-trust.ts': 'export const hookTrust = 1',
      'apps/api/src/services/hook-trust.test.ts': 'export const t = 1',
      'apps/api/src/middleware/json-repair.ts': 'export const jsonRepair = 1',
      'apps/api/src/middleware/json-repair.test.ts': 'export const t = 1',
      'apps/api/src/middleware/image-validate.ts': 'export const imageValidate = 1',
      'apps/api/src/middleware/image-validate.test.ts': 'export const t = 1',
      'apps/cli/src/compaction-v2.ts': 'export const compactionV2 = 1',
      'apps/cli/src/compaction-v2.test.ts': 'export const t = 1',
      'apps/cli/src/checkpoints/hunk-tracker.ts': 'export const hunkTracker = 1',
      'apps/cli/src/checkpoints/hunk-tracker.test.ts': 'export const t = 1',
      'apps/cli/src/doom-loop-detector.ts': 'export const doomLoopDetector = 1',
      'apps/cli/src/doom-loop-detector.test.ts': 'export const t = 1',
      'apps/cli/src/interjection.ts': 'export const interjection = 1',
      'apps/cli/src/interjection.test.ts': 'export const t = 1',
    })
  })
  afterAll(() => cleanup(root))

  it('exit code 0 + 报告通过', () => {
    const r = runGatekeeper(root)
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/守门通过|gate.*pass|CLAIMED.*8.*PASS/i)
  })
})

/**
 * 场景 2:CLAIMED 项 1 个文件缺失 → 守门失败。
 */
describe('场景 2: CLAIMED 项 1 个文件缺失 → 守门失败', () => {
  let root: string
  beforeAll(() => {
    root = setupProject({
      'apps/api/src/utils/circuit-breaker.ts': 'export const circuitBreaker = 1',
      'apps/api/src/utils/circuit-breaker.test.ts': 'export const t = 1',
      'apps/api/src/services/hook-trust.ts': 'export const hookTrust = 1',
      'apps/api/src/services/hook-trust.test.ts': 'export const t = 1',
      'apps/api/src/middleware/json-repair.ts': 'export const jsonRepair = 1',
      'apps/api/src/middleware/json-repair.test.ts': 'export const t = 1',
      'apps/api/src/middleware/image-validate.ts': 'export const imageValidate = 1',
      // 故意少 .test.ts
      'apps/cli/src/compaction-v2.ts': 'export const compactionV2 = 1',
      'apps/cli/src/compaction-v2.test.ts': 'export const t = 1',
      'apps/cli/src/checkpoints/hunk-tracker.ts': 'export const hunkTracker = 1',
      'apps/cli/src/checkpoints/hunk-tracker.test.ts': 'export const t = 1',
      'apps/cli/src/doom-loop-detector.ts': 'export const doomLoopDetector = 1',
      'apps/cli/src/doom-loop-detector.test.ts': 'export const t = 1',
      'apps/cli/src/interjection.ts': 'export const interjection = 1',
      'apps/cli/src/interjection.test.ts': 'export const t = 1',
    })
  })
  afterAll(() => cleanup(root))

  it('exit code 1 + 报告缺 image-validate.test.ts', () => {
    const r = runGatekeeper(root)
    expect(r.code).toBe(1)
    expect(r.stdout).toMatch(/image-validate\.test\.ts|FAIL/)
  })
})

// ==================== 防御性测试:CLAIMED 项入库 ====================

/**
 * 场景 9:防御性测试 — 防止"PROJECT_PLAN.md 声称 P47 已交付但 CLAIMED_CAPABILITIES
 * 守门清单未加入 P47 项"这种"虚假声明"再次出现。
 *
 * 校验方式:从守门脚本源文件中解析出 CLAIMED_CAPABILITIES 数组,
 * 检查 P47-1/P47-2/P47-3/P47-4 + 4 个 integration items(P47-1b/2b/3b/4b)都存在。
 *
 * 若该测试失败,说明 P47 的真实接入文件已落地但守门未更新,
 * 必须同步修改 scripts/check-grokbuild-integration-completeness.mjs 的
 * CLAIMED_CAPABILITIES 数组,否则 pre-commit 钩子不会检查 P47 的回归。
 */
describe('场景 9: CLAIMED_CAPABILITIES 必须含 P47 全部 8 项(防御性)', () => {
  it('守门脚本 CLAIMED_CAPABILITIES 数组含 CLAIM-P47-1/2/3/4 + 1b/2b/3b/4b', () => {
    const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8')
    const requiredIds = [
      'CLAIM-P47-1',
      'CLAIM-P47-2',
      'CLAIM-P47-3',
      'CLAIM-P47-4',
      'CLAIM-P47-1b',
      'CLAIM-P47-2b',
      'CLAIM-P47-3b',
      'CLAIM-P47-4b',
    ]
    const missing: string[] = []
    for (const id of requiredIds) {
      // 匹配 `id: 'CLAIM-P47-X'` 形式(排除注释中的字符串引用)
      const re = new RegExp(`id:\\s*['"]${id}['"]`)
      if (!re.test(scriptContent)) {
        missing.push(id)
      }
    }
    expect(missing).toEqual([])
  })
})

/**
 * 场景 10:防御性测试 — P48 Tool call JSON Schema validator 4 项 CLAIM 强制入库。
 *
 * 与场景 9 同源思路:任何后续 P-轮若忘记把 CLAIM 项加入守门脚本,
 * 测试失败阻断 commit,防止"虚假声明"漂移模式再次出现。
 *
 * P48 4 项:
 *   - CLAIM-P48-1: argument-validator.ts 纯函数校验器
 *   - CLAIM-P48-2: parseToolCalls 用 repairJson 替代 raw JSON.parse
 *   - CLAIM-P48-3: executeToolCall 集成 validateToolArguments 早期 fail-fast
 *   - CLAIM-P48-4: ErrorType 扩展 validation_failed
 */
describe('场景 10: CLAIMED_CAPABILITIES 必须含 P48 全部 4 项(防御性)', () => {
  it('守门脚本 CLAIMED_CAPABILITIES 数组含 CLAIM-P48-1/2/3/4', () => {
    const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8')
    const requiredIds = ['CLAIM-P48-1', 'CLAIM-P48-2', 'CLAIM-P48-3', 'CLAIM-P48-4']
    const missing: string[] = []
    for (const id of requiredIds) {
      const re = new RegExp(`id:\\s*['"]${id}['"]`)
      if (!re.test(scriptContent)) {
        missing.push(id)
      }
    }
    expect(missing).toEqual([])
  })
})

/**
 * 场景 11:防御性测试 — P49 seed 幂等化 CLAIM 强制入库。
 *
 * 与场景 9/10 同源思路:CLAIM-P49-1 描述"seed/_utils/upsert-by-unique.ts
 * 通用幂等工具 + 全 seed 目录扫除 if(ex) 旧模式",如果未来有人删除
 * 该 CLAIM 或删除 seed 文件,测试失败阻断 commit。
 *
 * P49 1 项:
 *   - CLAIM-P49-1: 8 个文件 (upsert 工具 + 单元测试 + 6 个 seed 文件)
 */
describe('场景 11: CLAIMED_CAPABILITIES 必须含 P49 全部 1 项(防御性)', () => {
  it('守门脚本 CLAIMED_CAPABILITIES 数组含 CLAIM-P49-1', () => {
    const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8')
    const re = new RegExp(`id:\\s*['"]CLAIM-P49-1['"]`)
    expect(re.test(scriptContent)).toBe(true)
  })

  it('CLAIM-P49-1 必须列出 8 个 seed 文件(防 CLAIM 浮于表面)', () => {
    const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8')
    const requiredFiles = [
      'packages/database/seed/_utils/upsert-by-unique.ts',
      'packages/database/seed/_utils/upsert-by-unique.test.ts',
      'packages/database/seed/ai-fresh-2026.ts',
      'packages/database/seed/ai-categories.ts',
      'packages/database/seed/ai-courses-2026.ts',
      'packages/database/seed/ai-tutorials.ts',
      'packages/database/seed/lessons.ts',
      'packages/database/seed/seed-cross-domain.ts',
    ]
    const missing: string[] = []
    for (const f of requiredFiles) {
      if (!scriptContent.includes(f)) {
        missing.push(f)
      }
    }
    expect(missing).toEqual([])
  })

  it('CLAIM-P49-1 守门要求 upsertByUnique() 至少 1 次调用', () => {
    const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8')
    expect(scriptContent).toMatch(/upsertByUnique\\(\\)/)
  })
})

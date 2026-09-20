// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生成对外开放能力清单 capabilities.json。
 *
 * 单一事实源是 packages/types/src/capability-catalog.ts(TS)。本脚本把它导出为 JSON，
 * 供三处消费：apps/ai-service 的 MCP 工具门禁(capability_gate.load_capability_manifest)、
 * 开发者文档/OpenAPI 生成、以及 scripts/check-capability-catalog.mjs 的覆盖率比对。
 *
 * 用法：pnpm --filter @ihui/api exec tsx scripts/export-capabilities.ts [--check]
 *   --check  只校验并比对，不写盘(CI 用)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { API_KEY_PERMISSIONS, buildManifest, unregisteredScopes } from '@ihui/types'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')
const outFile = join(repoRoot, 'packages', 'types', 'generated', 'capabilities.json')

function main(): number {
  const checkOnly = process.argv.includes('--check')
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    version?: string
  }

  const manifest = buildManifest(String(pkg.version ?? '0.0.0'))
  const gaps = unregisteredScopes()

  console.log(
    `[capabilities] scope 枚举 ${API_KEY_PERMISSIONS.length} 个 / 已登记 ${manifest.capabilities.length} 个 / 工具映射 ${Object.keys(manifest.toolScopeMap).length} 条`,
  )
  if (gaps.length > 0) {
    console.error(`[capabilities] ✗ 以下 scope 未在能力目录登记：${gaps.join(', ')}`)
    return 1
  }

  const platform = manifest.capabilities
    .filter((c) => c.dataClass === 'platform')
    .map((c) => c.scope)
  const ineligible = manifest.capabilities.filter((c) => !c.thirdPartyEligible).map((c) => c.scope)
  console.log(`[capabilities] platform 域(机器凭据永不放行)：${platform.join(', ') || '无'}`)
  console.log(`[capabilities] 非第三方可申请：${ineligible.join(', ') || '无'}`)

  if (checkOnly) {
    let current: string | null = null
    try {
      current = readFileSync(outFile, 'utf8')
    } catch {
      current = null
    }
    if (current === null) {
      console.error('[capabilities] ✗ 产物缺失，请运行 pnpm capabilities:export')
      return 1
    }
    const same = JSON.stringify(JSON.parse(current), null, 2) === JSON.stringify(manifest, null, 2)
    if (!same) {
      console.error('[capabilities] ✗ 产物与目录漂移，请重新生成并提交')
      return 1
    }
    console.log('[capabilities] ✓ 产物与能力目录一致')
    return 0
  }

  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  // 溯源注入：watermark 对 .json 属 skip-type(非源码类型)会返回非零，不该因此打断生成
  try {
    execFileSync(
      process.execPath,
      [join(repoRoot, 'scripts', 'watermark.mjs'), 'inject', outFile],
      {
        stdio: 'pipe',
      },
    )
  } catch {
    console.log('[capabilities] 提示：产物为 JSON，水印工具按类型跳过（非覆盖范围）')
  }
  console.log(`[capabilities] ✓ 已写出 ${relative(outFile)}`)
  return 0
}

function relative(p: string): string {
  return p.startsWith(repoRoot) ? p.slice(repoRoot.length + 1).replace(/\\/g, '/') : p
}

process.exitCode = main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

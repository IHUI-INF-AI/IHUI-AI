// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// arch-exempt: 夹具唯一落点 scripts/lib/scratch-dir.mjs(§15b 禁 os.tmpdir),测试面单向借用 tooling 层;正解=下沉可依赖包,期限 2027-01-31
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'
import { buildRunManifest, findProjectRoot, projectIdOf, runsRootFor, writeRunManifest } from '../src/runs/manifest.js'

function makeRepo(root: string): string {
  mkdirSync(join(root, '.git'), { recursive: true })
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  const deep = join(root, 'apps', 'cli', 'src')
  mkdirSync(deep, { recursive: true })
  return deep
}

describe('run manifest', () => {
  it('从子目录向上找到项目根', () => {
    const root = mkScratch('run-manifest-')
    try {
      const deep = makeRepo(root)
      expect(findProjectRoot(deep)).toBe(root)
    } finally {
      rmScratch(root)
    }
  })

  it('落 manifest.json 与 latest.json,字段齐备', () => {
    const root = mkScratch('run-manifest-')
    try {
      const deep = makeRepo(root)
      const out = writeRunManifest({
        cwd: deep,
        argv: ['agent', '--json'],
        ppid: 1234,
        env: { CI: '1', NO_COLOR: '1' } as unknown as NodeJS.ProcessEnv,
        cliVersion: '9.9.9',
      })
      expect(out).not.toBeNull()
      const manifestPath = join(root, '.ihui-agent', 'state', 'runs', out!.manifest.runId, 'manifest.json')
      expect(existsSync(manifestPath)).toBe(true)
      const saved = JSON.parse(readFileSync(manifestPath, 'utf8'))
      expect(saved).toMatchObject({
        runId: out!.manifest.runId,
        argv: ['agent', '--json'],
        ppid: 1234,
        cliVersion: '9.9.9',
        projectRoot: root,
      })
      expect(saved.envFlags.ci).toBe(true)
      expect(saved.envFlags.noColor).toBe(true)
      expect(saved.nodeVersion).toBe(process.version)
      expect(saved.projectId).toBe(projectIdOf(root))
    } finally {
      rmScratch(root)
    }
  })

  it('latest 指向最近一次运行', () => {
    const root = mkScratch('run-manifest-')
    try {
      const deep = makeRepo(root)
      const first = writeRunManifest({ cwd: deep, cliVersion: '1.0.0' })
      const second = writeRunManifest({ cwd: deep, cliVersion: '1.0.1' })
      expect(first && second).toBeTruthy()
      expect(second!.manifest.runId).not.toBe(first!.manifest.runId)
      const latest = JSON.parse(
        readFileSync(join(root, '.ihui-agent', 'state', 'runs', 'latest.json'), 'utf8'),
      )
      expect(latest.runId).toBe(second!.manifest.runId)
      expect(existsSync(join(first!.dir, 'manifest.json'))).toBe(true)
    } finally {
      rmScratch(root)
    }
  })

  it('projectId 对同一根稳定、对不同根不同', () => {
    const a = mkScratch('run-manifest-')
    const b = mkScratch('run-manifest-')
    try {
      expect(projectIdOf(a)).toBe(projectIdOf(a))
      expect(projectIdOf(a)).not.toBe(projectIdOf(b))
      expect(projectIdOf(null)).toBeNull()
    } finally {
      rmScratch(a)
      rmScratch(b)
    }
  })

  it('无项目根时运行清单落用户目录(纯函数,不写盘)', () => {
    const m = buildRunManifest({ cwd: process.cwd(), env: {} as unknown as NodeJS.ProcessEnv })
    const fake = { ...m, projectRoot: null }
    const dir = runsRootFor(fake)
    expect(dir).toContain('.ihui')
    expect(dir.endsWith(join('', 'runs'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

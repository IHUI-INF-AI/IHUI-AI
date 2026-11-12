// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-115 — `/config set` 只把用户显式设置的那一项写入全局层。
 *
 * 判据:项目层(cwd 的 .claude/settings.json)存在 defaultModel/maxIterations/sampler 覆盖时,
 * 执行 `set locale en`;全局 ~/.ihui/settings.json 只应多出 locale 一项,
 * 项目层其他键不得被合并结果固化进全局。同时读取/展示仍是多源合并语义。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs' // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边

import { handleConfigCommand } from '../src/commands/config-cmd.js'
import { loadSettings } from '../src/commands/settings.js'

describe('F-115 /config set 只写全局层显式设置项', () => {
  let tmpHome: string
  let tmpProject: string
  let originalCwd: string
  let savedHome: string | undefined
  let savedProfile: string | undefined

  beforeEach(() => {
    tmpHome = mkScratch('cli-f115-home-')
    tmpProject = mkScratch('cli-f115-proj-')
    originalCwd = process.cwd()
    savedHome = process.env.HOME
    savedProfile = process.env.USERPROFILE
    process.env.HOME = tmpHome
    process.env.USERPROFILE = tmpHome
    process.chdir(tmpProject)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    if (savedHome === undefined) delete process.env.HOME
    else process.env.HOME = savedHome
    if (savedProfile === undefined) delete process.env.USERPROFILE
    else process.env.USERPROFILE = savedProfile
    rmScratch(tmpProject)
    rmScratch(tmpHome)
  })

  it('项目层有覆盖时执行 global set,全局文件只多出被设置的那一项', () => {
    const globalPath = path.join(tmpHome, '.ihui', 'settings.json')
    fs.mkdirSync(path.dirname(globalPath), { recursive: true })
    fs.writeFileSync(globalPath, JSON.stringify({ apiUrl: 'http://global', locale: 'zh-CN' }))

    const projectPath = path.join(tmpProject, '.claude', 'settings.json')
    fs.mkdirSync(path.dirname(projectPath), { recursive: true })
    const projectBody = JSON.stringify({
      locale: 'ja',
      defaultModel: 'project-model',
      maxIterations: 66,
      sampler: { temperature: 0.1 },
    })
    fs.writeFileSync(projectPath, projectBody)

    const out = handleConfigCommand('set locale en')
    expect(out).toContain('locale = en')

    const global = JSON.parse(fs.readFileSync(globalPath, 'utf-8')) as Record<string, unknown>
    // 全局层原有 apiUrl 保留;只多出被显式设置的 locale,
    // 项目层的 defaultModel/maxIterations/sampler 不得泄漏进全局文件。
    expect(global).toEqual({ apiUrl: 'http://global', locale: 'en' })

    // 项目层文件本身不被改写
    expect(fs.readFileSync(projectPath, 'utf-8')).toBe(projectBody)

    // 读取/展示语义不变:仍是多源合并,项目层覆盖生效
    const merged = loadSettings()
    expect(merged.defaultModel).toBe('project-model')
    expect(merged.maxIterations).toBe(66)
    expect(merged.sampler?.temperature).toBe(0.1)
  })
})

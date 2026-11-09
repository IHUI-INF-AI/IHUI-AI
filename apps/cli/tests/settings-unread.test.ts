// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { needsFirstRunSetup, runFirstRunSetup } from '../src/commands/first-run.js'
import { handleConfigCommand } from '../src/commands/config-cmd.js'
import { getSettingsPath, mergeSettingsFromCwd, readSettingsObjectForUpdate, saveSettingsTemplate } from '../src/commands/settings.js'

describe('配置读不到不能覆盖', () => {
  it('目录不是空配置,缺失和损坏仍按原口径', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-settings-unread-'))
    const blocked = path.join(dir, 'settings.json')
    const missing = path.join(dir, 'missing.json')
    const corrupt = path.join(dir, 'corrupt.json')
    const ok = path.join(dir, 'ok.json')
    fs.mkdirSync(blocked)
    fs.writeFileSync(corrupt, '[1,2]', 'utf-8')
    fs.writeFileSync(ok, JSON.stringify({ apiUrl: 'http://local', keep: true }), 'utf-8')
    try {
      expect(() => readSettingsObjectForUpdate(blocked)).toThrow(/不能把它覆盖成新内容/)
      expect(fs.statSync(blocked).isDirectory()).toBe(true)
      expect(readSettingsObjectForUpdate(missing)).toEqual({ state: 'missing' })
      expect(readSettingsObjectForUpdate(corrupt)).toEqual({ state: 'corrupt' })
      fs.writeFileSync(path.join(dir, 'empty.json'), '  \n', 'utf-8')
      expect(readSettingsObjectForUpdate(path.join(dir, 'empty.json'))).toEqual({ state: 'missing' })
      const read = readSettingsObjectForUpdate(ok)
      expect(read.state).toBe('ok')
      if (read.state === 'ok') expect(read.settings.apiUrl).toBe('http://local')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('模板写入遇到读不到的设置文件时不覆盖', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-settings-template-'))
    const previousHome = process.env.HOME
    const previousProfile = process.env.USERPROFILE
    process.env.HOME = dir
    process.env.USERPROFILE = dir
    const blocked = getSettingsPath()
    fs.mkdirSync(blocked, { recursive: true })
    try {
      expect(() => saveSettingsTemplate(true)).toThrow(/不能把它覆盖成新内容/)
      expect(fs.statSync(blocked).isDirectory()).toBe(true)
    } finally {
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
      if (previousProfile === undefined) delete process.env.USERPROFILE
      else process.env.USERPROFILE = previousProfile
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('首次引导读不到配置时不生成新文件', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-first-run-unread-'))
    const previousHome = process.env.HOME
    const previousProfile = process.env.USERPROFILE
    process.env.HOME = dir
    process.env.USERPROFILE = dir
    const target = getSettingsPath()
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, '{"apiKey":"keep"}\n', 'utf-8')
    const original = fs.readFileSync(target)
    const denied = () => {
      const err = new Error('denied') as NodeJS.ErrnoException
      err.code = 'EACCES'
      throw err
    }
    try {
      expect(() => needsFirstRunSetup(denied)).toThrow(/读不到/)
      await expect(runFirstRunSetup(denied)).rejects.toThrow(/读不到/)
      expect(fs.readFileSync(target)).toEqual(original)
      expect(needsFirstRunSetup()).toBe(false)
    } finally {
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
      if (previousProfile === undefined) delete process.env.USERPROFILE
      else process.env.USERPROFILE = previousProfile
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('合并读不到的配置时抛错且文件字节不变', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-settings-merge-unread-'))
    const target = path.join(dir, '.ihui', 'settings.json')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, '{"apiUrl":"http://settings-unread-keep"}\n', 'utf-8')
    const original = fs.readFileSync(target)
    const denied = (p: string): fs.Stats => {
      const err = new Error('denied') as NodeJS.ErrnoException
      err.code = path.resolve(p) === path.resolve(target) ? 'EACCES' : 'ENOENT'
      throw err
    }
    try {
      let thrown: Error | undefined
      try {
        mergeSettingsFromCwd(dir, denied)
      } catch (error) {
        thrown = error as Error
      }
      expect(thrown).toBeInstanceOf(Error)
      expect(thrown?.message).toContain('读不到')
      expect(thrown?.message).toContain('EACCES')
      expect(fs.readFileSync(target)).toEqual(original)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('损坏的设置不会被 /config set 收成只剩新的一项', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-settings-set-'))
    const previousHome = process.env.HOME
    const previousProfile = process.env.USERPROFILE
    process.env.HOME = dir
    process.env.USERPROFILE = dir
    const file = getSettingsPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const body = '{not json'
    fs.writeFileSync(file, body, 'utf-8')
    try {
      expect(() => handleConfigCommand('set locale zh-CN')).toThrow(/不能把它覆盖成新内容 \(corrupt\)/)
      expect(fs.readFileSync(file, 'utf-8')).toBe(body)
    } finally {
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
      if (previousProfile === undefined) delete process.env.USERPROFILE
      else process.env.USERPROFILE = previousProfile
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

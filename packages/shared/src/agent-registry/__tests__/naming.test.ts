// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P2-08 名称规则测试：大小写/空格/下划线归一、保留名拒绝、克隆后缀、长度上限。
 * 验收样例：`Master`/`master` 都拒；`coder-copy` 可用。
 */

import { describe, expect, it } from 'vitest'
import {
  AGENT_NAME_MAX_LENGTH,
  BUILTIN_AGENT_NAMES,
  MASTER_AGENT_NAME,
  RESERVED_AGENT_NAMES,
  buildCloneAgentName,
  canonicalAgentName,
  isAvailableAgentName,
  isReservedAgentName,
  isValidAgentName,
  normalizeAgentName,
} from '../naming'

describe('canonicalAgentName', () => {
  it('大小写、首尾空格、内部空格归一', () => {
    expect(canonicalAgentName('  Frontend Dev ')).toBe('frontend-dev')
    expect(canonicalAgentName('CODER')).toBe('coder')
  })

  it('下划线转连字符并折叠', () => {
    expect(canonicalAgentName('coder_copy')).toBe('coder-copy')
    expect(canonicalAgentName('coder__copy')).toBe('coder-copy')
    expect(canonicalAgentName('a - b')).toBe('a-b')
  })

  it('全角字符 NFKC 归一', () => {
    expect(canonicalAgentName('ＣＯＤＥＲ')).toBe('coder')
  })

  it('非法字符剥离，空结果为 empty', () => {
    expect(canonicalAgentName('!!!')).toBe('')
    expect(canonicalAgentName('我的智能体')).toBe('')
  })
})

describe('normalizeAgentName', () => {
  it('普通名称合法', () => {
    const result = normalizeAgentName('  Frontend Widget ')
    expect(result.name).toBe('frontend-widget')
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.reserved).toBe(false)
    expect(result.cloned).toBe(false)
  })

  it('master / Master 都判保留名（AGENT_NAME_RESERVED 依据）', () => {
    for (const raw of ['master', 'Master', ' MASTER ']) {
      const result = normalizeAgentName(raw)
      expect(result.name).toBe('master')
      expect(result.reserved).toBe(true)
      expect(result.valid).toBe(false)
      expect(result.issues).toContain('reserved')
    }
  })

  it('10 个内置名全部判保留', () => {
    for (const name of BUILTIN_AGENT_NAMES) {
      expect(isReservedAgentName(name)).toBe(true)
      expect(normalizeAgentName(name.toUpperCase()).valid).toBe(false)
    }
    expect(RESERVED_AGENT_NAMES).toHaveLength(11)
    expect(RESERVED_AGENT_NAMES[0]).toBe(MASTER_AGENT_NAME)
  })

  it('保留名可显式 suffix 规避', () => {
    const result = normalizeAgentName('master', { onReserved: 'suffix' })
    expect(result.name).toBe('master-agent')
    expect(result.valid).toBe(true)
    expect(result.reserved).toBe(false)
  })

  it('克隆生成 -copy（验收样例）', () => {
    const result = normalizeAgentName('coder', { cloneOf: 'coder' })
    expect(result.name).toBe('coder-copy')
    expect(result.valid).toBe(true)
    expect(result.cloned).toBe(true)
  })

  it('克隆冲突递增 -copy-2 / -copy-3', () => {
    expect(normalizeAgentName('coder', { cloneOf: 'coder', taken: ['coder-copy'] }).name).toBe(
      'coder-copy-2',
    )
    expect(
      normalizeAgentName('coder', {
        cloneOf: 'coder',
        taken: ['coder-copy', 'CODER-COPY-2'],
      }).name,
    ).toBe('coder-copy-3')
  })

  it('非克隆命中已占用名判 taken', () => {
    const result = normalizeAgentName('coder', { taken: ['coder'] })
    expect(result.name).toBe('coder')
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('taken')
  })

  it('超长截断并标记 truncated', () => {
    const long = 'a'.repeat(40)
    const result = normalizeAgentName(long)
    expect(result.name).toHaveLength(AGENT_NAME_MAX_LENGTH)
    expect(result.truncated).toBe(true)
    expect(result.valid).toBe(true)
  })

  it('空输入判 empty', () => {
    const result = normalizeAgentName('   ')
    expect(result.name).toBe('')
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(['empty'])
  })

  it('下划线输入归一为连字符后合法', () => {
    const result = normalizeAgentName('security_guard')
    expect(result.name).toBe('security-guard')
    expect(result.valid).toBe(true)
  })
})

describe('名称校验辅助', () => {
  it('isValidAgentName 兼容 DB 规则（含下划线旧名）', () => {
    expect(isValidAgentName('coder_copy')).toBe(true)
    expect(isValidAgentName('-coder')).toBe(false)
    expect(isValidAgentName('Coder')).toBe(false)
    expect(isValidAgentName('a'.repeat(33))).toBe(false)
  })

  it('isAvailableAgentName 同时判格式/保留/占用', () => {
    expect(isAvailableAgentName('coder-copy')).toBe(true)
    expect(isAvailableAgentName('master')).toBe(false)
    expect(isAvailableAgentName('coder-copy', ['coder-copy'])).toBe(false)
    expect(isAvailableAgentName('坏名字')).toBe(false)
  })

  it('buildCloneAgentName 快捷入口', () => {
    expect(buildCloneAgentName('reviewer')).toBe('reviewer-copy')
    expect(buildCloneAgentName('reviewer', ['reviewer-copy'])).toBe('reviewer-copy-2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

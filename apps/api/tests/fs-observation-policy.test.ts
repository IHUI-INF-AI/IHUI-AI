// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 读前写保护单测（2026-11-19，对照 dsh-fs-observation-policy）。
 *
 * 钉住四件事：① 新建放行；② 已存在未读 ⇒ FS_NOT_OBSERVED；
 * ③ 读过且内容一致放行；④ 读后被外部改动 ⇒ FS_STALE_VERSION；
 * 另钉「上次确认不存在、现在却存在」按过期处理，以及应急开关只认 off。
 */
import { describe, expect, it } from 'vitest'
import {
  contentHash,
  FS_NOT_OBSERVED,
  FS_STALE_VERSION,
  FsObservationStore,
  isFsObservationEnforced,
  observationKey,
} from '../src/services/fs-observation-policy.js'

describe('FsObservationStore 写前判定', () => {
  it('A1 目标不存在（null）⇒ 放行，不要求先读', () => {
    const store = new FsObservationStore()
    expect(store.checkWrite('/work/new.txt', null)).toBeNull()
  })

  it('A2 目标已存在且本次会话未观察 ⇒ FS_NOT_OBSERVED', () => {
    const store = new FsObservationStore()
    const denial = store.checkWrite('/work/exists.txt', 'old content')
    expect(denial?.code).toBe(FS_NOT_OBSERVED)
    expect(denial?.remedy).toContain('read_file')
  })

  it('A3 读过且磁盘未变 ⇒ 放行', () => {
    const store = new FsObservationStore()
    store.observePresent('/work/a.txt', 'v1')
    expect(store.checkWrite('/work/a.txt', 'v1')).toBeNull()
  })

  it('A4 读后磁盘被改 ⇒ FS_STALE_VERSION', () => {
    const store = new FsObservationStore()
    store.observePresent('/work/a.txt', 'v1')
    const denial = store.checkWrite('/work/a.txt', 'v2-from-someone-else')
    expect(denial?.code).toBe(FS_STALE_VERSION)
    expect(denial?.error).toContain('摘要不一致')
  })

  it('A5 观察的「不存在」与后到文件冲突 ⇒ FS_STALE_VERSION', () => {
    const store = new FsObservationStore()
    store.observeAbsent('/work/late.txt')
    expect(store.checkWrite('/work/late.txt', 'created elsewhere')?.code).toBe(FS_STALE_VERSION)
  })

  it('A6 同路径不同写法归一到同一观察记录', () => {
    const store = new FsObservationStore()
    const canonical = '/work/dir/../dir/same.txt'
    store.observePresent(canonical, 'v1')
    expect(store.inspect('/work/dir/same.txt')).toEqual({
      state: 'present',
      hash: contentHash('v1'),
    })
    expect(store.size).toBe(1)
  })

  it('A7 Windows 下大小写折叠为同一键', () => {
    if (process.platform !== 'win32') return
    const store = new FsObservationStore()
    store.observePresent('C:/Work/Case.TXT', 'v1')
    expect(store.inspect('c:/work/case.txt')?.state).toBe('present')
  })

  it('A8 observationKey 对同一文件稳定', () => {
    expect(observationKey('/work/x.txt')).toBe(observationKey('/work/./x.txt'))
  })
})

describe('应急开关', () => {
  it('B1 默认 enforce', () => {
    expect(isFsObservationEnforced({} as NodeJS.ProcessEnv)).toBe(true)
  })

  it('B2 off 才关闭', () => {
    expect(
      isFsObservationEnforced({ IHUI_FS_OBSERVATION_POLICY: 'off' } as NodeJS.ProcessEnv),
    ).toBe(false)
    expect(
      isFsObservationEnforced({ IHUI_FS_OBSERVATION_POLICY: 'enforce' } as NodeJS.ProcessEnv),
    ).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

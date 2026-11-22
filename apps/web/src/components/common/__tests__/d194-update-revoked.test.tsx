// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D194 桌面更新「版本撤回」态:分类器 + 上屏判据。
//
// 钉三件事,缺一条就退化成"文案存在但没人接":
//  ① classifyUpdateError 的正反成对(撤回信号判 revoked;检查失败与通用失败不得误判)——
//     反向对照是必要的,否则任何错误都会被读成"这个版本已不再提供";
//  ② 撤回态真的上屏:status='error' + 撤回类错误串时,屏幕上必须出现 t('revoked') 的文案,
//     且**不得**同时出现通用失败文案(errorDesc);
//  ③ 五语种齐:同一挂载在 zh-CN / zh-TW / en / ja / ko 各跑一次,取词表与
//     .ihui-agent/tmp/d175-cont/laneA-spec.json 逐字同形(语言包此刻是他人 in-flight,
//     本票只交 blob,所以这里用注入取词表中屏,不读盘上的包)。
//
// 接线的是哪条信号(不得读成"检查阶段也已收口"):
//   ① feed 的 platforms 少当前 target(生成侧对空签名不写键)→ "Unsupported target …";
//   ② feed / 资产 404(本站 feed 路由无资产时即回 404)→ 串里带 404 / Not Found。
//   check 阶段的错误串被 apps/web/src/lib/tauri-bridge.ts 压成 'check_failed',
//   该文件此刻由他人持有在飞,本票未动它 ⇒ check 链继续走 checkFailed 文案。

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const { TABLES, updaterMock } = vi.hoisted(() => {
  // 与 laneA-spec.json 逐字同形的五语种取词表(键:common.update.*)
  const revoked: Record<string, string> = {
    'zh-CN': '这个版本已不再提供。',
    'zh-TW': '這個版本已不再提供。',
    en: 'This version is no longer available.',
    ja: 'このバージョンは現在提供されていません。',
    ko: '이 버전은 더 이상 제공되지 않습니다.',
  }
  // 既有文案(HEAD 面现读,用于反向对照:撤回态不得顺手显示这两条)
  const errorDesc: Record<string, string> = {
    'zh-CN': '更新过程中出现错误,请重试',
    'zh-TW': '更新過程中出現錯誤,請重試',
    en: 'An error occurred during the update. Please retry.',
    ja: '更新中にエラーが発生しました。再試行してください。',
    ko: '업데이트 중 오류가 발생했습니다. 다시 시도해 주세요.',
  }
  const checkFailed: Record<string, string> = {
    'zh-CN': '检查更新失败,请检查网络后重试',
    'zh-TW': '檢查更新失敗,請檢查網絡後重試',
    en: 'Failed to check for updates. Please check your network.',
    ja: '更新の確認に失敗しました。ネットワークを確認して再試行してください。',
    ko: '업데이트 확인에 실패했습니다. 네트워크를 확인 후 재시도해 주세요.',
  }
  const tables: Record<string, Record<string, string>> = {}
  for (const lang of Object.keys(revoked)) {
    tables[lang] = {
      'common.update.revoked': revoked[lang]!,
      'common.update.errorDesc': errorDesc[lang]!,
      'common.update.checkFailed': checkFailed[lang]!,
      'common.update.autoRetrying': `${lang}:autoRetrying`,
    }
  }
  return {
    TABLES: tables,
    updaterMock: {
      current: {
        status: 'idle',
        session: null,
        progress: 0,
        downloaded: 0,
        total: 0,
        error: null,
        retryCount: 3,
        maxRetries: 3,
        restartCountdown: 0,
        restartNow: () => {},
        postponeRestart: () => {},
      } as Record<string, unknown>,
    },
  }
})

let lang = 'zh-CN'
const t = (key: string, values?: Record<string, string | number>) => {
  let out = TABLES[lang]?.[key] ?? key
  for (const [k, v] of Object.entries(values ?? {})) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, string | number>) =>
    t(ns ? `${ns}.${key}` : key, values),
}))

vi.mock('@/hooks/use-updater', () => ({
  useUpdater: () => updaterMock.current,
}))

// UpdatePrompt 只借 formatFileSize 量下载量;桥接件静态 import @tauri-apps/*,测试面必须换掉
vi.mock('@/lib/tauri-bridge', () => ({
  formatFileSize: (n: number) => `${n}B`,
  isTauri: () => true,
}))

import { UpdatePrompt, classifyUpdateError } from '../UpdatePrompt'

function mountError(error: string | null, retryCount = 3) {
  updaterMock.current.status = 'error'
  updaterMock.current.error = error
  updaterMock.current.retryCount = retryCount
  return render(<UpdatePrompt />)
}

/** 撤回/失败文案会同时出现在"错误信息段"与"重试耗尽后的底部状态条",按处数断言而不是按存在。 */
const countOf = (text: string) => screen.queryAllByText(text).length

afterEach(() => {
  cleanup()
  lang = 'zh-CN'
})

describe('classifyUpdateError —— 撤回态的判据', () => {
  it('正向:feed/资产 404 与平台键缺失都判 revoked', () => {
    expect(classifyUpdateError('Invalid response status 404 Not Found')).toBe('revoked')
    expect(classifyUpdateError('error downloading update: 404')).toBe('revoked')
    expect(classifyUpdateError('Unsupported target windows-aarch64')).toBe('revoked')
    expect(classifyUpdateError('this package is no longer available')).toBe('revoked')
  })

  it('反向对照:检查失败与通用失败不得被读成撤回', () => {
    expect(classifyUpdateError('check_failed')).toBe('check-failed')
    expect(classifyUpdateError('check_timeout')).toBe('check-failed')
    expect(classifyUpdateError('更新失败: 网络不可达')).toBe('generic')
    expect(classifyUpdateError('invalid signature minisign bad key')).toBe('generic')
    expect(classifyUpdateError(null)).toBe('generic')
  })
})

describe('UpdatePrompt —— 撤回态上屏', () => {
  it('zh-CN:撤回类错误显示"这个版本已不再提供。",且不并显通用失败与检查失败文案', () => {
    lang = 'zh-CN'
    mountError('Invalid response status 404 Not Found')
    expect(countOf('这个版本已不再提供。')).toBe(2) // 错误信息段 + 重试耗尽后的状态条
    expect(countOf('更新过程中出现错误,请重试')).toBe(0)
    expect(countOf('检查更新失败,请检查网络后重试')).toBe(0)
  })

  it('正向对照:平台键缺失(Unsupported target)同样走撤回文案', () => {
    lang = 'zh-CN'
    mountError('Unsupported target windows-aarch64')
    expect(countOf('这个版本已不再提供。')).toBeGreaterThan(0)
  })

  it('反向对照:check_failed 仍走 checkFailed,不出现撤回文案', () => {
    lang = 'zh-CN'
    mountError('check_failed')
    expect(countOf('检查更新失败,请检查网络后重试')).toBe(2)
    expect(countOf('这个版本已不再提供。')).toBe(0)
  })

  it('反向对照:通用失败仍走 errorDesc,不出现撤回文案', () => {
    lang = 'zh-CN'
    mountError('invalid signature minisign bad key')
    expect(countOf('更新过程中出现错误,请重试')).toBe(2)
    expect(countOf('这个版本已不再提供。')).toBe(0)
  })

  it('重试未耗尽时:正文给撤回事实,底部仍是既有"自动重试中"', () => {
    lang = 'zh-CN'
    mountError('Invalid response status 404 Not Found', 1)
    expect(countOf('这个版本已不再提供。')).toBe(1)
    expect(countOf('zh-CN:autoRetrying')).toBe(1)
  })

  it('五语种齐:每种语言挂载后都上屏撤回文案', () => {
    for (const l of Object.keys(TABLES)) {
      cleanup()
      lang = l
      mountError('Invalid response status 404 Not Found')
      expect(countOf(TABLES[l]!['common.update.revoked']!)).toBeGreaterThan(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 更新提示「标题随阶段走」+ 进度环无障碍语义(2026-11-12 立)。
//
// 立因(真机 ?dev-update=1 逐帧观察):
//  ① 下载阶段进度环跑到 44%,标题仍是"发现新版本" —— 描述的是已经完成的动作,
//     而 i18n 里五语种都有的 downloading 键无人引用(死键);
//  ② 进度那一行刻意 aria-live="off"(百分比每 tick 变一次),进度环 svg 又无 role/aria-value,
//     于是下载阶段**唯一会被读屏播报的就是标题**。标题写错 = 整段下载静音。
// 故本文件同时钉:标题取词表、进度环 role 与 aria-valuenow、以及"标题与 aria-label 不得互相矛盾"。

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const { TABLES, updaterMock } = vi.hoisted(() => {
  // 与 packages/i18n/messages/web/*.json 的 common.update.* 逐字同形(五语种)
  const titles: Record<string, Record<string, string>> = {
    'zh-CN': {
      available: '发现新版本',
      downloading: '下载中',
      installing: '安装中',
      done: '更新完成',
      upToDate: '已是最新版本',
      error: '更新失败',
    },
    'zh-TW': {
      available: '發現新版本',
      downloading: '下載中',
      installing: '安裝中',
      done: '更新完成',
      upToDate: '已是最新版本',
      error: '更新失敗',
    },
    en: {
      available: 'New Version Available',
      downloading: 'Downloading',
      installing: 'Installing',
      done: 'Update Complete',
      upToDate: 'Up to date',
      error: 'Update Failed',
    },
    ja: {
      available: '新バージョンがあります',
      downloading: 'ダウンロード中',
      installing: 'インストール中',
      done: '更新が完了しました',
      upToDate: '最新バージョンです',
      error: '更新に失敗しました',
    },
    ko: {
      available: '새 버전이 있습니다',
      downloading: '다운로드 중',
      installing: '설치 중',
      done: '업데이트 완료',
      upToDate: '최신 버전입니다',
      error: '업데이트 실패',
    },
  }
  const tables: Record<string, Record<string, string>> = {}
  for (const [lang, t] of Object.entries(titles)) {
    tables[lang] = {
      'common.update.available': t.available!,
      'common.update.downloading': t.downloading!,
      'common.update.installing': t.installing!,
      'common.update.done': t.done!,
      'common.update.upToDate': t.upToDate!,
      'common.update.error': t.error!,
      // 其余键:本文件不断言,给稳定占位避免落到「键名上屏」
      'common.update.preparing': `${lang}:preparing`,
      'common.update.upToDateDesc': `${lang}:upToDateDesc`,
      'common.update.autoRestartIn': `${lang}:autoRestartIn`,
      'common.update.restartLater': `${lang}:restartLater`,
      'common.update.restartNow': `${lang}:restartNow`,
      'common.update.autoRetrying': `${lang}:autoRetrying`,
      'common.update.errorDesc': `${lang}:errorDesc`,
      'common.update.checkFailed': `${lang}:checkFailed`,
      'common.update.revoked': `${lang}:revoked`,
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
        restartCountdown: 60,
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

vi.mock('@/lib/tauri-bridge', () => ({
  formatFileSize: (n: number) => `${n}B`,
  isTauri: () => true,
}))

import { UpdatePrompt, updateTitleKey } from '../UpdatePrompt'

type UpdaterLike = Record<string, unknown>

function mount(patch: UpdaterLike) {
  const base = updaterMock.current
  updaterMock.current = { ...base, ...patch }
  return render(<UpdatePrompt />)
}

const titleOf = (key: string) => TABLES[lang]![`common.update.${key}`]!

afterEach(() => {
  cleanup()
  lang = 'zh-CN'
})

describe('updateTitleKey —— 标题按阶段取词', () => {
  it('每个可观察状态取自己的键,不回落成 available', () => {
    expect(updateTitleKey('available')).toBe('available')
    expect(updateTitleKey('downloading')).toBe('downloading')
    expect(updateTitleKey('installing')).toBe('installing')
    expect(updateTitleKey('done')).toBe('done')
    expect(updateTitleKey('up-to-date')).toBe('upToDate')
    expect(updateTitleKey('error')).toBe('error')
  })

  it('idle / checking 属过渡态:统一取 available(此态不出弹窗,取词只为穷尽类型)', () => {
    expect(updateTitleKey('idle')).toBe('available')
    expect(updateTitleKey('checking')).toBe('available')
  })
})

describe('UpdatePrompt —— 下载中标题', () => {
  it('下载中必须写"下载中",不得继续写"发现新版本"', () => {
    lang = 'zh-CN'
    mount({ status: 'downloading', progress: 0.44, session: { info: { version: '0.2.0' } } })
    expect(screen.getByText(titleOf('downloading'))).toBeTruthy()
    expect(screen.queryByText(titleOf('available'))).toBeNull()
  })

  it('反向对照:available 态仍写"发现新版本"(没有把两种态混成一个词)', () => {
    lang = 'zh-CN'
    mount({ status: 'available', session: { info: { version: '0.2.0' } } })
    expect(screen.getByText(titleOf('available'))).toBeTruthy()
    expect(screen.queryByText(titleOf('downloading'))).toBeNull()
  })

  it('五语种齐:下载中标题都取本语种 downloading 词,不串语种', () => {
    for (const l of Object.keys(TABLES)) {
      cleanup()
      lang = l
      mount({ status: 'downloading', progress: 0.2, session: { info: { version: '0.2.0' } } })
      expect(screen.getByText(titleOf('downloading')), l).toBeTruthy()
      expect(screen.queryByText(titleOf('available')), l).toBeNull()
    }
  })
})

describe('UpdatePrompt —— 进度环无障碍语义', () => {
  it('进度环是标准 progressbar,aria-valuenow 跟随真实百分比', () => {
    lang = 'zh-CN'
    mount({ status: 'downloading', progress: 0.44, session: { info: { version: '0.2.0' } } })
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('44')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })

  it('aria-label 与标题同词:读屏听到的进度名不能和标题互相矛盾', () => {
    lang = 'zh-CN'
    mount({ status: 'downloading', progress: 0.1, session: { info: { version: '0.2.0' } } })
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe(titleOf('downloading'))
  })

  it('百分比四舍五入到整数(0.999 不得读成 100 之外的越界值)', () => {
    lang = 'zh-CN'
    mount({ status: 'downloading', progress: 0.999, session: { info: { version: '0.2.0' } } })
    const now = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThanOrEqual(0)
    expect(now).toBeLessThanOrEqual(100)
    expect(now).toBe(100)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

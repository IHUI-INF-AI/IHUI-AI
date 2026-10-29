// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对标 Qoder 借鉴清单第 10 项的 web 呈现层钉。
//
// 钉四件(纯逻辑,不渲染组件):
// ① 命名码 ⇒ 标题 / 具体建议 / 动作按钮,三样全部来自词包而非硬编码;
// ② 未收录码 ⇒ 保持既有兜底文案,`retryable` 是 `null`(未判定),动作与按钮都不给;
// ③ `none` 档不给按钮 —— 给了等于承诺一个做不到的出路;
// ④ 五语言词表 9 动作 + 5 准入态 + nextStepLabel 全非空(缺任一语言即红)。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  __test__,
  actionText,
  admissionPhaseText,
  assertLabelCoverage,
  buildStreamErrorView,
  type StreamErrorLabelSet,
} from '@/lib/stream-error-view'
import {
  ADMISSION_PHASES,
  STREAM_ERROR_ACTIONS,
  type AdmissionPhase,
  type StreamErrorAction,
} from '@ihui/shared/chat'

// 词包真源在 packages/i18n/messages/{shared,web}/(apps/web/messages/ 不存在)。
// 本票的 streamErrors 住 **shared**(web 那五个文件正被并行工作流整文件暂存,追加会被覆盖;
// shared 是 web 端 mergeMessages 的上游,端上取词同样可达 —— 实测见 check-i18n-keys 的合并集口径)。
// 路径按 __dirname 相对推导:vitest 在 web 端把 import.meta.url 给成 http 形态,
// fileURLToPath 会抛 "URL must be of scheme file"(实测踩过)。
const SHARED_MESSAGES = join(__dirname, '..', '..', '..', '..', '..', 'packages/i18n/messages/shared')
// 标题/具体建议的既有 139 码表住在 web 包(别人的在飞面;本票只**读**它,不写)
const WEB_MESSAGES = join(__dirname, '..', '..', '..', '..', '..', 'packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

type Pack = Record<string, unknown>

function readPack(locale: (typeof LOCALES)[number]): Pack {
  // 端上真取词时两层是 mergeMessages 深合并(shared 在下、web 在上),故这里同样合并 ——
  // streamErrors 在 shared、ai.pane.errorCatalog 在 web,单读任何一层都会假红。
  const shared = JSON.parse(readFileSync(join(SHARED_MESSAGES, `${locale}.json`), 'utf8')) as Pack
  const web = JSON.parse(readFileSync(join(WEB_MESSAGES, `${locale}.json`), 'utf8')) as Pack
  return deepMerge(shared, web)
}

function deepMerge(a: Pack, b: Pack): Pack {
  const out: Pack = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k]
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      prev &&
      typeof prev === 'object' &&
      !Array.isArray(prev)
    ) {
      out[k] = deepMerge(prev as Pack, v as Pack)
    } else {
      out[k] = v
    }
  }
  return out
}

function leafAt(doc: Pack, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((node, seg) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[seg]
    return undefined
  }, doc)
}

/** 用真词包拼出一套 labels(缺键返回 `MISSING:<键>`,断言能一眼看出是取词失败)。 */
function realLabels(locale: (typeof LOCALES)[number]): StreamErrorLabelSet {
  const pack = readPack(locale)
  const t = (key: string): string => {
    const v = leafAt(pack, `${__test__.STREAM_ERRORS_NS}.${key}`)
    return typeof v === 'string' ? v : `MISSING:${key}`
  }
  const catalog = (key: string): string => {
    const v = leafAt(pack, `${__test__.ERROR_CATALOG_NS}.${key}`)
    return typeof v === 'string' ? v : `MISSING:${key}`
  }
  const actions = Object.fromEntries(STREAM_ERROR_ACTIONS.map((a) => [a, t(`action.${a}`)])) as Record<
    StreamErrorAction,
    string
  >
  const admission = Object.fromEntries(ADMISSION_PHASES.map((p) => [p, t(`admission.${p}`)])) as Record<
    AdmissionPhase,
    string
  >
  return { actions, admission, nextStepLabel: t('nextStepLabel'), catalog }
}

const zh = realLabels('zh-CN')

describe('buildStreamErrorView:命名码走分类处置表', () => {
  const view = (code: string) =>
    buildStreamErrorView({
      errorCode: code,
      fallbackTitle: '出错了',
      fallbackMessage: 'raw',
      labels: zh,
    })

  it('INTERNAL_ERROR ⇒ 重试档,详情取目录表 action 键', () => {
    const v = view('INTERNAL_ERROR')
    expect(v.code).toBe('INTERNAL_ERROR')
    expect(v.title).toBe(zh.catalog('INTERNAL_ERROR.title'))
    expect(v.detail).toBe(zh.catalog('INTERNAL_ERROR.action'))
    expect(v.action).toBe('retry')
    expect(v.actionLabel).toBe(zh.actions.retry)
    expect(v.retryable).toBe(true)
  })

  it('BUDGET_EXHAUSTED ⇒ 查额度,不给重试(retryable=false)', () => {
    const v = view('BUDGET_EXHAUSTED')
    expect(v.action).toBe('checkQuota')
    expect(v.actionLabel).toBe(zh.actions.checkQuota)
    expect(v.retryable).toBe(false)
  })

  it('TOKEN_EXPIRED ⇒ 重新登录(不是找管理员)', () => {
    expect(view('TOKEN_EXPIRED').action).toBe('relogin')
    expect(view('TOKEN_EXPIRED').retryable).toBe(false)
  })

  it('CONTEXT_TOO_LONG ⇒ 精简上下文(原样重发必撞)', () => {
    expect(view('CONTEXT_TOO_LONG').action).toBe('trimContext')
    expect(view('CONTEXT_TOO_LONG').retryable).toBe(false)
  })

  it('MODEL_REFUSED ⇒ 换模型', () => {
    expect(view('MODEL_REFUSED').action).toBe('switchModel')
  })

  it('ACCOUNT_RESTRICTED ⇒ 联系管理员', () => {
    expect(view('ACCOUNT_RESTRICTED').action).toBe('contactAdmin')
  })

  it('RATE_LIMITED 与 BUDGET_EXHAUSTED 同分类但处置相反(HTTP 码做不到的那一格)', () => {
    expect(view('RATE_LIMITED').action).toBe('waitAndRetry')
    expect(view('RATE_LIMITED').retryable).toBe(true)
    expect(view('BUDGET_EXHAUSTED').retryable).toBe(false)
  })
})

describe('buildStreamErrorView:none 档不给按钮', () => {
  it('表里 action=none 的码,actionLabel 是 null 但动作本身仍可读', () => {
    // 先找一个真实落 none 档的码(目录表内 resourceNotFound 类默认就是 none)
    const candidates = ['FILE_NOT_FOUND', 'NOT_FOUND', 'TASK_NOT_FOUND']
    const hit = candidates
      .map((c) => buildStreamErrorView({ errorCode: c, fallbackTitle: 'x', fallbackMessage: 'y', labels: zh }))
      .find((v) => v.action === 'none')
    expect(hit, '目录表里应至少有一码落 none 档').toBeDefined()
    expect(hit?.actionLabel).toBeNull()
    expect(hit?.retryable).toBe(false)
    expect(hit?.title.startsWith('MISSING:')).toBe(false)
  })
})

describe('buildStreamErrorView:未收录码保持既有行为(零兜底)', () => {
  it('码不存在 ⇒ 用调用方兜底文案,动作与按钮都不给,retryable 是 null', () => {
    const v = buildStreamErrorView({
      errorCode: 'TOTALLY_UNKNOWN_CODE',
      fallbackTitle: 'AI 服务异常',
      fallbackMessage: '请稍后重试',
      labels: zh,
    })
    expect(v.title).toBe('AI 服务异常')
    expect(v.detail).toBe('请稍后重试')
    expect(v.action).toBeNull()
    expect(v.actionLabel).toBeNull()
    // null 不是 false:未判定 ≠ 不能重试
    expect(v.retryable).toBeNull()
  })

  it('没有 errorCode ⇒ 同上,且 code 是 undefined(不是空串)', () => {
    const v = buildStreamErrorView({
      errorCode: null,
      fallbackTitle: '网络错误',
      fallbackMessage: '',
      labels: zh,
    })
    expect(v.code).toBeUndefined()
    // 空正文 ⇒ null(空串会渲染成一个空行)
    expect(v.detail).toBeNull()
    expect(v.retryable).toBeNull()
  })
})

describe('词表:五语言 15 键全非空', () => {
  it.each(LOCALES)('%s:9 动作 + 5 准入态 + nextStepLabel 都取得到真值', (locale) => {
    const labels = realLabels(locale)
    expect(assertLabelCoverage(labels)).toEqual([])
    for (const a of STREAM_ERROR_ACTIONS) {
      const text = actionText(a, labels)
      expect(text.startsWith('MISSING:'), `${locale}/${a}`).toBe(false)
      expect(text.trim().length, `${locale}/${a}`).toBeGreaterThan(0)
    }
    for (const p of ADMISSION_PHASES) {
      const text = admissionPhaseText(p, labels)
      expect(text.startsWith('MISSING:'), `${locale}/${p}`).toBe(false)
      expect(text.trim().length, `${locale}/${p}`).toBeGreaterThan(0)
    }
  })

  it('准入五态与动作九档不共享文案(避免"已收下"被渲染成"重试")', () => {
    const labels = realLabels('en')
    const phaseTexts = ADMISSION_PHASES.map((p) => admissionPhaseText(p, labels))
    const actionTexts = STREAM_ERROR_ACTIONS.map((a) => actionText(a, labels))
    for (const p of phaseTexts) expect(actionTexts).not.toContain(p)
    expect(new Set(phaseTexts).size).toBe(phaseTexts.length)
    expect(new Set(actionTexts).size).toBe(actionTexts.length)
  })

  it('标题/建议键在 ai.pane.errorCatalog 五语言里都取得到', () => {
    for (const locale of LOCALES) {
      const labels = realLabels(locale)
      for (const code of ['INTERNAL_ERROR', 'BUDGET_EXHAUSTED', 'TOKEN_EXPIRED', 'ACCOUNT_RESTRICTED']) {
        const v = buildStreamErrorView({
          errorCode: code,
          fallbackTitle: '',
          fallbackMessage: '',
          labels,
        })
        expect(v.title.startsWith('MISSING:'), `${locale}/${code}`).toBe(false)
      }
    }
  })

  it('label 缺一档时 assertLabelCoverage 会点名(空白字符串不算有词)', () => {
    const broken: StreamErrorLabelSet = {
      ...zh,
      actions: { ...zh.actions, retry: '  ' },
      admission: { ...zh.admission, queued: '' },
    }
    expect(assertLabelCoverage(broken).sort()).toEqual(['action.retry', 'admission.queued'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { AGENT_REPORT_COPY_KEYS } from '@ihui/shared/reports'
import { resolveReportTranslate } from '../src/commands/report-copy-dict.js'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const ALL_KEYS = Object.values(AGENT_REPORT_COPY_KEYS)

describe('诊断报告词典:五语言同批补齐(AGENTS §19 的机器锁)', () => {
  it.each(LOCALES)('① %s 下 49 个键每一个都取得到真值(取不到即回显键名 ⇒ 本例翻红)', (locale) => {
    const t = resolveReportTranslate(locale)
    const missing = ALL_KEYS.filter((key) => t(key) === key)
    expect(missing, `${locale} 缺键: ${missing.join(', ')}`).toEqual([])
  })

  it('② 未知语言显式落英文兜底,不返回空串也不抛(空串会把"没翻译"洗成"就是这样")', () => {
    const t = resolveReportTranslate('fr-CA')
    expect(t(AGENT_REPORT_COPY_KEYS.kpiTitle)).not.toBe('')
    expect(t(AGENT_REPORT_COPY_KEYS.kpiTitle)).toBe('Key readouts')
  })

  it('③ 缺参时占位符原样保留(不把"少给参数"伪装成空值)', () => {
    const t = resolveReportTranslate('en')
    const key = AGENT_REPORT_COPY_KEYS.waterfallHiddenCount
    expect(t(key)).toContain('{hidden}')
    expect(t(key, { hidden: 3, shown: 5 })).toBe('3 hidden / 5 shown')
  })

  it('④ 语言纯度:ko 正文不得夹汉字(本仓 zh-TW/ko 阻塞中文残留的同一条口径)', () => {
    const t = resolveReportTranslate('ko')
    const withHan = ALL_KEYS.filter((k) => /[\u4e00-\u9fff]/.test(t(k)))
    // 术语 finding / durationMs 这类拉丁词允许;汉字一律不许出现在韩语正文里
    expect(withHan, `ko 含汉字: ${withHan.map((k) => `${k}=${t(k)}`).join(' | ')}`).toEqual([])
  })

  it('⑤ 繁中纯度:zh-TW 不得出现简体专用字形(表内逐字都是繁简同形的不算,别拿它自证)', () => {
    const t = resolveReportTranslate('zh-TW')
    // 只挑**简体专用**字形:这些字在正体里必被替换(報/語/總/測/篩/複/術/關/時/區/負/載/錄/說/讀/變/對/歸)。
    // 反例教训:第一版把「量」写进名单 —— 它繁简同形,抓到的是假阳性。
    const simplifiedOnly = ['报', '语', '总', '测', '筛', '复', '术', '关', '时', '区', '负', '载', '录', '说', '读', '变', '对', '归', '应', '图', '册']
    const hits = ALL_KEYS.flatMap((k) =>
      simplifiedOnly.filter((c) => t(k).includes(c)).map((c) => `${k} 含简体「${c}」: ${t(k)}`),
    )
    expect(hits, hits.join(' | ')).toEqual([])
  })

  it('⑥ 词典不许成为第二份判据:shared 层缺键回显与本词典同口径(都回显键名,不出空串)', () => {
    const t = resolveReportTranslate('en')
    expect(t('agentReport.notARealKey')).toBe('agentReport.notARealKey')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#!/usr/bin/env node
/**
 * 用 StepFun AI 批量翻译 i18n 未翻译键
 * 读取 4 语言未翻译键,收集唯一英文值,批量调用 StepFun API 翻译,写回翻译映射文件
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const RUNTIME_DIR = join(ROOT, '.trae-cn/goal-runtime')

const LANGS = ['ja', 'ko', 'zh-CN', 'zh-TW']
const LANG_NAMES = {
  ja: '日语',
  ko: '韩语',
  'zh-CN': '简体中文',
  'zh-TW': '繁体中文(台湾)',
}

const STEPFUN_API_BASE = process.env.STEPFUN_API_BASE || 'https://api.stepfun.com/step_plan/v1'
const STEPFUN_API_KEY = process.env.STEPFUN_API_KEY
const MODEL = 'step-3.7-flash'

function readJSONStripBOM(filePath) {
  let text = readFileSync(filePath, 'utf8')
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  return JSON.parse(text)
}

function collectLeafValues(obj, prefix = '') {
  const map = new Map()
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [p, val] of collectLeafValues(v, path)) {
        map.set(p, val)
      }
    } else {
      map.set(path, v)
    }
  }
  return map
}

const ASCII_RE = /^[-A-Za-z0-9 ._!?'",:;()&+@#$%^*=]+$/

const uniqueEnValues = new Set()
for (const lang of LANGS) {
  const untranslated = readJSONStripBOM(join(RUNTIME_DIR, `i18n-untranslated-${lang}.json`))
  const untranslatedLeaves = collectLeafValues(untranslated)
  for (const [, value] of untranslatedLeaves) {
    if (typeof value === 'string' && value.length >= 2 && ASCII_RE.test(value)) {
      uniqueEnValues.add(value)
    }
  }
}

const valuesToTranslate = [...uniqueEnValues]
console.log(`待翻译唯一英文值: ${valuesToTranslate.length} 个`)

if (!STEPFUN_API_KEY) {
  console.error('STEPFUN_API_KEY 未配置,请设置环境变量后重试')
  process.exit(1)
}

async function translateBatch(values, targetLang) {
  const prompt = `你是一位专业的软件国际化翻译专家。请将以下英文软件界面文本翻译为${LANG_NAMES[targetLang]}。

要求:
1. 保持软件 UI 文本风格(简洁、专业、用户友好)
2. 保留占位符(如 {name}、{count}、%s、%d 等)不翻译
3. 保留专有名词(如 API、SDK、OAuth、MCP、AI、PDF 等)不翻译
4. 返回 JSON 对象,键为原文,值为翻译结果
5. 不要添加任何解释说明

待翻译文本(JSON 数组):
${JSON.stringify(values, null, 2)}

请返回 JSON 对象格式:
{"原文1": "翻译1", "原文2": "翻译2", ...}`

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: '你是专业的软件国际化翻译专家,只返回JSON对象,不添加任何其他内容。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 8000,
  }

  const resp = await fetch(`${STEPFUN_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STEPFUN_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`StepFun API ${resp.status}: ${errText.substring(0, 200)}`)
  }

  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content || ''

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`无法从响应中提取 JSON: ${content.substring(0, 200)}`)
  }

  return JSON.parse(jsonMatch[0])
}

const BATCH_SIZE = 50

for (const lang of LANGS) {
  console.log(`\n=== 翻译 ${LANG_NAMES[lang]} ===`)
  const translationFile = join(RUNTIME_DIR, `i18n-translation-${lang}.json`)
  const existing = readJSONStripBOM(translationFile)

  const untranslated = readJSONStripBOM(join(RUNTIME_DIR, `i18n-untranslated-${lang}.json`))
  const untranslatedLeaves = collectLeafValues(untranslated)
  const needed = new Set()
  for (const [, value] of untranslatedLeaves) {
    if (typeof value === 'string' && value.length >= 2 && ASCII_RE.test(value)) {
      if (!(value in existing) || existing[value] === value) {
        needed.add(value)
      }
    }
  }

  const neededArr = [...needed]
  console.log(`需要翻译: ${neededArr.length} 个值`)

  if (neededArr.length === 0) {
    console.log('无需翻译,跳过')
    continue
  }

  let translatedCount = 0
  let failedCount = 0

  for (let i = 0; i < neededArr.length; i += BATCH_SIZE) {
    const batch = neededArr.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(neededArr.length / BATCH_SIZE)
    console.log(`  批次 ${batchNum}/${totalBatches} (${batch.length} 个值)...`)

    try {
      const result = await translateBatch(batch, lang)
      for (const [k, v] of Object.entries(result)) {
        if (typeof v === 'string' && v !== k) {
          existing[k] = v
          translatedCount++
        }
      }
      writeFileSync(translationFile, JSON.stringify(existing, null, 2) + '\n', 'utf8')
      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      console.log(`  批次 ${batchNum} 失败: ${err.message}`)
      failedCount += batch.length
    }
  }

  console.log(`${lang}: 翻译 ${translatedCount} 个, 失败 ${failedCount} 个`)
}

console.log('\n=== 翻译完成,运行 apply-i18n-translations.mjs 应用翻译 ===')

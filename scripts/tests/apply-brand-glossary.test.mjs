/**
 * @file apply-brand-glossary.mjs 回归测试基线
 * @description 本测试覆盖 scripts/apply-brand-glossary.mjs 的核心规则:
 *   1. en/ko/ja 默认处理,zh-CN 跳过(基准语言),zh-TW 默认跳过(需 --locale=zh-TW 显式)
 *   2. 安全过滤:只处理 key 含中文的映射,跳过纯英文 key(避免误改合法英文)
 *   3. 路径/扩展名保护:value 是文件路径或 URL 时不替换
 *   4. key 长度降序排序:避免短 key 先替换破坏长 key(智谱清言 vs 智谱)
 *   5. zh-TW 专用:简→繁字形转换匹配 + 只用 brands/fonts 子集(排除 terms)
 *   6. dry-run 模式只打印不写回
 *   7. --locale=<x> 单语言处理
 *
 * 测试策略:spawnSync 子进程运行原脚本,cwd=临时目录,fixture 完全隔离不污染项目。
 * 路径推导用 import.meta.url(AGENTS.md §15)。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = path.join(__dirname, '..', 'apply-brand-glossary.mjs')
const GLOSSARY_SRC = path.join(__dirname, '..', 'brand-glossary.json')

// ─── 辅助:创建临时项目根目录(含 apps/web/messages/ 结构 + 复制 brand-glossary.json) ───
function createTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-brand-gloss-'))
  fs.mkdirSync(path.join(root, 'apps', 'web', 'messages'), { recursive: true })
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  // 复制真实 brand-glossary.json(测试真实映射数据)
  fs.copyFileSync(GLOSSARY_SRC, path.join(root, 'scripts', 'brand-glossary.json'))
  return root
}

// 辅助:写入指定 locale 的 i18n 文件
function writeLocale(root, locale, obj) {
  fs.writeFileSync(
    path.join(root, 'apps', 'web', 'messages', `${locale}.json`),
    JSON.stringify(obj, null, 2),
    'utf8',
  )
}

// 辅助:读取指定 locale 的 i18n 文件
function readLocale(root, locale) {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'apps', 'web', 'messages', `${locale}.json`), 'utf8'),
  )
}

// 辅助:运行 apply-brand-glossary.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

describe('CLI 基础行为 — 退出码 + 空目录不崩溃', () => {
  test('无 i18n 文件 → exit 0,输出"跳过 (文件不存在)"', () => {
    const root = createTempProject()
    try {
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `无文件应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert.match(r.stdout, /跳过|文件不存在/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('无替换需求时 → exit 0,输出"0 处需替换"', () => {
    const root = createTempProject()
    try {
      writeLocale(root, 'en', { common: { save: 'Save', cancel: 'Cancel' } })
      writeLocale(root, 'ko', { common: { save: '저장' } })
      writeLocale(root, 'ja', { common: { save: '保存' } })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `无替换应 exit 0,实际 ${r.status}`)
      assert.match(r.stdout, /0 处需替换/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('dry-run 模式 — 只打印不写回', () => {
  test('--dry-run 打印替换信息但文件不变', () => {
    const root = createTempProject()
    try {
      const original = { title: '欢迎使用智谱清言', save: 'Save' }
      writeLocale(root, 'en', original)
      const r = runScript(['--dry-run', '--locale', 'en'], { cwd: root })
      assert.equal(r.status, 0, `dry-run 应 exit 0,实际 ${r.status}`)
      assert.match(r.stdout, /dry-run/)
      assert.match(r.stdout, /智谱清言 → Zhipu AI/)
      // 文件未被写回
      assert.deepEqual(readLocale(root, 'en'), original)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('无 --dry-run 实际写回文件', () => {
    const root = createTempProject()
    try {
      writeLocale(root, 'en', { title: '欢迎使用智谱清言' })
      const r = runScript(['--locale', 'en'], { cwd: root })
      assert.equal(r.status, 0)
      assert.match(r.stdout, /已写回/)
      const after = readLocale(root, 'en')
      assert.equal(after.title, '欢迎使用Zhipu AI')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('核心替换规则 — 中文品牌 → canonical 英文名', () => {
  test('en.json: "智谱清言" → "Zhipu AI"', () => {
    const root = createTempProject()
    try {
      writeLocale(root, 'en', { brand: '智谱清言' })
      runScript(['--locale', 'en'], { cwd: root })
      assert.equal(readLocale(root, 'en').brand, 'Zhipu AI')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('同一 value 中多次出现全部替换(智谱清言由智谱清言开发)', () => {
    const root = createTempProject()
    try {
      writeLocale(root, 'en', { desc: '智谱清言由智谱清言开发' })
      runScript(['--locale', 'en'], { cwd: root })
      assert.equal(readLocale(root, 'en').desc, 'Zhipu AI由Zhipu AI开发')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('key 长度降序排序:长 key 先替换,避免短 key 破坏(智谱清言 vs 智谱)', () => {
    // 关键:智谱清言(4字)→Zhipu AI,智谱(2字)→Zhipu AI
    // 若短 key 先替换,"智谱清言"会变成"Zhipu AI清言"(错误)
    // 修复:按 key 长度降序排序,智谱清言先替换
    const root = createTempProject()
    try {
      writeLocale(root, 'en', { desc: '智谱清言是智谱的产品' })
      runScript(['--locale', 'en'], { cwd: root })
      // 期望:智谱清言 → Zhipu AI,智谱 → Zhipu AI
      assert.equal(readLocale(root, 'en').desc, 'Zhipu AI是Zhipu AI的产品')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('嵌套对象 + 数组递归遍历替换', () => {
    const root = createTempProject()
    try {
      writeLocale(root, 'en', {
        page: { title: '智谱清言', list: ['智谱清言', '百度文心', 'plain'] },
      })
      runScript(['--locale', 'en'], { cwd: root })
      const after = readLocale(root, 'en')
      assert.equal(after.page.title, 'Zhipu AI')
      assert.deepEqual(after.page.list, ['Zhipu AI', 'Baidu ERNIE', 'plain'])
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('安全过滤规则 — 跳过纯英文 key + 路径保护', () => {
  test('纯英文 key 跳过:Moonshot 不被替换为 Moonshot AI', () => {
    // brand-glossary.json 中 "Moonshot": "Moonshot AI" 的 key 无中文,被 CHINESE_RE 过滤
    // 避免把 en.json 中合法英文 "Moonshot" 错误替换
    const root = createTempProject()
    try {
      writeLocale(root, 'en', { model: 'Moonshot is a LLM provider' })
      runScript(['--locale', 'en'], { cwd: root })
      assert.equal(readLocale(root, 'en').model, 'Moonshot is a LLM provider')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('路径/扩展名保护:SVG 路径中的"大模型"不被替换', () => {
    // PATH_RE 匹配 /xxx.svg 后缀,value 是文件路径不替换
    const root = createTempProject()
    try {
      writeLocale(root, 'en', {
        icon: '/images/svg/大模型.svg',
        logo: '/icons/智谱清言.png',
      })
      runScript(['--locale', 'en'], { cwd: root })
      const after = readLocale(root, 'en')
      assert.equal(after.icon, '/images/svg/大模型.svg', 'SVG 路径不应被替换')
      assert.equal(after.logo, '/icons/智谱清言.png', 'PNG 路径不应被替换')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('非字符串值(number/boolean/null)不受影响', () => {
    const root = createTempProject()
    try {
      const original = {
        count: 42,
        enabled: true,
        empty: null,
        nested: { num: 100, bool: false },
      }
      writeLocale(root, 'en', original)
      runScript(['--locale', 'en'], { cwd: root })
      assert.deepEqual(readLocale(root, 'en'), original)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('locale 处理范围 — zh-CN 跳过 + zh-TW 默认跳过 + --locale 单语言', () => {
  test('zh-CN.json 跳过(基准语言不替换)', () => {
    const root = createTempProject()
    try {
      const zhCN = { title: '智谱清言是基准语言' }
      writeLocale(root, 'zh-CN', zhCN)
      writeLocale(root, 'en', { title: '智谱清言' })
      runScript([], { cwd: root }) // 默认 en/ko/ja,不含 zh-CN
      assert.deepEqual(readLocale(root, 'zh-CN'), zhCN, 'zh-CN.json 应保持不变')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('zh-TW.json 默认跳过(需 --locale=zh-TW 显式执行)', () => {
    const root = createTempProject()
    try {
      const zhTW = { title: '智譜清言是繁體' }
      writeLocale(root, 'zh-TW', zhTW)
      writeLocale(root, 'en', { title: '智谱清言' })
      runScript([], { cwd: root }) // 默认 en/ko/ja,不含 zh-TW
      assert.deepEqual(readLocale(root, 'zh-TW'), zhTW, 'zh-TW.json 默认应保持不变')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('--locale=en 只处理 en.json,ko/ja 不受影响', () => {
    const root = createTempProject()
    try {
      writeLocale(root, 'en', { title: '智谱清言' })
      const koOriginal = { title: '智谱清言 한국어' }
      const jaOriginal = { title: '智谱清言 日本語' }
      writeLocale(root, 'ko', koOriginal)
      writeLocale(root, 'ja', jaOriginal)
      runScript(['--locale', 'en'], { cwd: root })
      assert.equal(readLocale(root, 'en').title, 'Zhipu AI')
      assert.deepEqual(readLocale(root, 'ko'), koOriginal, 'ko.json 不应被 --locale=en 触及')
      assert.deepEqual(readLocale(root, 'ja'), jaOriginal, 'ja.json 不应被 --locale=en 触及')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('zh-TW 专用规则 — 繁体字形匹配 + brands/fonts 子集', () => {
  test('--locale=zh-TW:简体 key 转繁体后匹配(value 是繁体字形)', () => {
    // brand-glossary.json key 是简体"智谱清言",zh-TW value 是繁体"智譜清言"
    // 脚本用 OpenCC 转换 key 为繁体"智譜清言"后再匹配
    const root = createTempProject()
    try {
      writeLocale(root, 'zh-TW', { title: '歡迎使用智譜清言' })
      const r = runScript(['--locale', 'zh-TW'], { cwd: root })
      assert.equal(r.status, 0, `zh-TW 处理应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
      assert.equal(readLocale(root, 'zh-TW').title, '歡迎使用Zhipu AI')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('zh-TW 只用 brands/fonts 子集:terms(大模型→LLM)不被替换', () => {
    // zh-TW 保留繁体中文术语表达,不应将"大模型"改为"LLM"
    const root = createTempProject()
    try {
      writeLocale(root, 'zh-TW', {
        brand: '智譜清言',
        term: '大模型是技術術語',
      })
      runScript(['--locale', 'zh-TW'], { cwd: root })
      const after = readLocale(root, 'zh-TW')
      assert.equal(after.brand, 'Zhipu AI', 'brand 应被替换')
      assert.equal(after.term, '大模型是技術術語', 'term 不应被替换(zh-TW 保留繁体术语)')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('边界场景 — 不存在 locale + 退出码', () => {
  test('--locale=fr 文件不存在 → 输出"跳过"且 exit 0', () => {
    const root = createTempProject()
    try {
      const r = runScript(['--locale', 'fr'], { cwd: root })
      assert.equal(r.status, 0, `不存在 locale 应 exit 0,实际 ${r.status}`)
      assert.match(r.stdout, /跳过/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('默认 3 语言(en/ko/ja)全有替换 → exit 0 + 总计输出', () => {
    const root = createTempProject()
    try {
      writeLocale(root, 'en', { title: '智谱清言' })
      writeLocale(root, 'ko', { title: '智谱清言' })
      writeLocale(root, 'ja', { title: '智谱清言' })
      const r = runScript([], { cwd: root })
      assert.equal(r.status, 0, `正常替换应 exit 0,实际 ${r.status}`)
      assert.match(r.stdout, /总计: \d+ 处替换/)
      assert.equal(readLocale(root, 'en').title, 'Zhipu AI')
      assert.equal(readLocale(root, 'ko').title, 'Zhipu AI')
      assert.equal(readLocale(root, 'ja').title, 'Zhipu AI')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

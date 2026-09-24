// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-tool-display-resolvable.mjs 的镜像逻辑自检(§22c 精神:直接 import 源函数,不复制实现)。
 * 跑法:node --test scripts/tests/check-tool-display-resolvable.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import {
  mergeMessages,
  extractDisplayKeys,
  extractMcpActivityKeys,
  remoteLocaleList,
  decodeTaroBundle,
} from '../check-tool-display-resolvable.mjs'

test('mergeMessages 保留仅存在于 override 的顶层命名空间(CLI 踩过的坑)', () => {
  const base = { taskStatus: { toolReadFile: '读取文件内容' }, a11y: { x: 'y' } }
  const override = {
    cli: { errorFileNotFound: '文件不存在: {path}' },
    taskStatus: { toolReadFile: '端内改写' },
  }
  const merged = mergeMessages(base, override)
  assert.equal(
    merged.cli.errorFileNotFound,
    '文件不存在: {path}',
    '只遍历 base 键会把 cli.* 整块吞掉',
  )
  assert.equal(merged.taskStatus.toolReadFile, '端内改写', 'override 优先')
  assert.equal(merged.taskStatus.a11y, undefined)
  assert.deepEqual(Object.keys(merged).sort(), ['a11y', 'cli', 'taskStatus'])
})

test('extractDisplayKeys 只认词表对象字面量里的映射行', () => {
  const src = [
    'const TOOL_DISPLAY_KEYS = {',
    "  read_file: 'toolReadFile',",
    "  browser_click_element: 'toolBrowserClickElement',",
    '}',
    'export function toolDisplayKey(n) { return TOOL_DISPLAY_KEYS[n] ?? null }',
  ].join('\n')
  assert.deepEqual(extractDisplayKeys(src), ['toolBrowserClickElement', 'toolReadFile'])
})

test('remoteLocaleList 从生成器源码取远程语言(离线包不含 zh-CN)', () => {
  const gen =
    "const REMOTE_LOCALES = ['en', 'ja', 'ko', 'zh-TW']\nfor (const l of REMOTE_LOCALES) {}"
  assert.deepEqual(remoteLocaleList(gen), ['en', 'ja', 'ko', 'zh-TW'])
  assert.equal(remoteLocaleList('没有常量'), null, '解析不到时返回 null 由调用方兜底,不得静默放行')
})

test('decodeTaroBundle 认裸键与加引号键,并对坏载荷返回 null(不假装通过)', () => {
  const payload = (obj) => gzipSync(Buffer.from(JSON.stringify(obj), 'utf8')).toString('base64')
  const gen = [
    'export const remoteLocales = {',
    `  en: '${payload({ taskStatus: { toolReadFile: 'Read file contents' } })}',`,
    `  'zh-TW': '${payload({ taskStatus: { toolReadFile: '讀取檔案內容' } })}',`,
    '}',
  ].join('\n')
  const out = decodeTaroBundle(gen, ['en', 'zh-TW'])
  assert.equal(out.en.taskStatus.toolReadFile, 'Read file contents')
  assert.equal(out['zh-TW'].taskStatus.toolReadFile, '讀取檔案內容')
  assert.equal(decodeTaroBundle(gen, ['ja']).ja, null, '匹配不到载荷必须是 null,让守门判失败')
  assert.equal(
    decodeTaroBundle("en: 'H4sIAAAAAAAA-not-base64!!'", ['en']).en,
    null,
    '坏载荷不得抛错,必须判 null',
  )
})

test('extractMcpActivityKeys 只认 toolMcp 前缀的登记键,并对结构变更显式抛错', () => {
  const src = [
    'const SERVER_TOOL_ACTIVITY_KEYS = {',
    "const A = { x: { base: 'toolMcpGithubCreateIssueActivity' } }",
    "const B = { y: 'toolMcpServerGithubActivity', z: 1 }",
    "const noise = 'toolReadFile' // 非 toolMcp 前缀不算本表取材",
    "export const EXPORTED = 'toolMcpToolGetFileActivity'",
  ].join('\n')
  assert.deepEqual(extractMcpActivityKeys(src), [
    'toolMcpGithubCreateIssueActivity',
    'toolMcpServerGithubActivity',
    'toolMcpToolGetFileActivity',
  ])
  assert.deepEqual(
    extractMcpActivityKeys('const SERVER_TOOL_ACTIVITY_KEYS = { x: 1 }'),
    [],
    '锚点在但一个键都没取到必须返回空数组,由调用方判失败(不得静默通过)',
  )
  assert.throws(
    () => extractMcpActivityKeys('没有锚点的源码'),
    /SERVER_TOOL_ACTIVITY_KEYS/,
    '锚点丢失必须抛错(格式变更不得静默放行),0 键由调用方判失败',
  )
})

test('装车证明:真仓 MCP 三层表的每个登记键都在 5 语言 shared taskStatus 取到值', () => {
  const root = new URL('../../', import.meta.url)
  const sourceFile = (rel) => readFileSync(new URL(rel, root), 'utf8')
  const mcpSource = sourceFile('packages/shared/src/chat/mcp-tool-activity.ts')
  const keys = extractMcpActivityKeys(mcpSource)
  assert.ok(keys.length >= 29, `取材不得为空表(实际 ${keys.length})`)
  for (const lang of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
    const pack =
      JSON.parse(sourceFile(`packages/i18n/messages/shared/${lang}.json`)).taskStatus ?? {}
    for (const key of keys) {
      const value = pack[key]
      assert.equal(typeof value, 'string', `${lang}.${key} 必须存在`)
      assert.notEqual(value, key, `${lang}.${key} 不得回显键名`)
      assert.match(value, /^\{\s*state,\s*select,/, `${lang}.${key} 必须是 state select 形态`)
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

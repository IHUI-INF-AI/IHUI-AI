// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 占位：水印头由 scripts/lib/doubao-carry.mjs 逐字节拼接（见落盘步骤）
/**
 * 豆包归档 → ChatGPT conversations.json(留档格式,不是「官方导入已可用」承诺)。
 *
 * 用法:
 *   node scripts/doubao-build-import.mjs --archive <归档目录> --out <输出文件> [--apply]
 *   不带 --apply = 干跑,只报将导出的会话/消息数,不写文件。
 *
 * 2026-11-24 二次取证:豆包 2.37.16「设置 → 数据导入与同步」的安装包文案是
 * 「正在扫描你安装的应用」,不是文件选择/上传;手搓 conversations.json 没有可用
 * 入口。本 CLI 只负责把归档转成结构公开、可外部工具读的留档文件;要跨号续聊,
 * 用同目录 `handoff.md` 交接单(见 scripts/lib/doubao-handoff.mjs)。
 *
 * 纯本地文件操作:不读 cookie、不发网络、不碰任何账号。
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  buildConversationsJson,
  buildStoreZip,
  validateConversationsJson,
  zipPathFor,
} from './lib/doubao-chatgpt-format.mjs'

// 对外再导出:CLI 与切号腿都从单一真相源 lib 取,测试可直接从 CLI 导入
export { buildStoreZip, zipPathFor }

export function argValue(argv, name) {
  const i = argv.indexOf(name)
  if (i < 0) return undefined
  const v = argv[i + 1]
  return v && !v.startsWith('--') ? v : undefined
}

/** 归档 index.json + 逐会话正文 → ChatGPT conversations.json（纯本地,注入式 fs） */
export function readArchiveBodies(dir, fsImpl = fs) {
  let index
  try {
    index = JSON.parse(fsImpl.readFileSync(path.join(dir, 'index.json'), 'utf8'))
  } catch (e) {
    throw new Error(`读归档 index.json 失败:${e instanceof Error ? e.message : String(e)}`)
  }
  const readBody = (entry) => {
    if (!entry?.file) return null
    try {
      return JSON.parse(fsImpl.readFileSync(path.join(dir, entry.file), 'utf8'))
    } catch {
      return null
    }
  }
  return buildConversationsJson(index, readBody)
}

export function run(argv = process.argv.slice(2), deps = {}) {
  const fsImpl = deps.fs ?? fs
  const archiveDir = argValue(argv, '--archive')
  const outFile = argValue(argv, '--out')
  const apply = argv.includes('--apply')
  if (!archiveDir || !outFile) {
    return { code: 'bad-arg', message: '需 --archive <归档目录> --out <输出文件>' }
  }
  let built
  try {
    built = readArchiveBodies(archiveDir, fsImpl)
  } catch (e) {
    return { code: 'archive-read-failed', message: e instanceof Error ? e.message : String(e) }
  }
  const validation = validateConversationsJson(built.conversations)
  if (!validation.ok) {
    return { code: 'format-invalid', message: `生成的导入文件格式不合法:${validation.code}` }
  }
  const zFile = zipPathFor(outFile)
  const summary = {
    code: 'ok',
    archiveDir,
    outFile,
    zipFile: zFile,
    conversations: built.conversations.length,
    skipped: built.skipped.length,
    messages: built.conversations.reduce(
      (n, c) => n + Object.values(c.mapping).filter((x) => x?.message).length,
      0,
    ),
    applied: false,
  }
  if (!apply) return summary
  try {
    fsImpl.mkdirSync(path.dirname(outFile), { recursive: true })
    const json = Buffer.from(`${JSON.stringify(built.conversations, null, 2)}\n`, 'utf8')
    fsImpl.writeFileSync(outFile, json)
    // 双格式:ZIP 内 conversations.json 与 ChatGPT 原生导出同形(根目录裸文件名)
    const zip = buildStoreZip([{ name: 'conversations.json', data: json }])
    fsImpl.writeFileSync(zFile, zip)
  } catch (e) {
    return { ...summary, code: 'write-failed', message: e instanceof Error ? e.message : String(e) }
  }
  return { ...summary, applied: true }
}

function main() {
  const r = run()
  if (r.code !== 'ok') {
    process.stderr.write(`${r.code}: ${r.message ?? ''}\n`)
    process.exit(1)
  }
  process.stdout.write(
    `豆包留档文件: 会话 ${r.conversations} / 消息 ${r.messages} / 跳过 ${r.skipped}` +
      `\n裸 JSON: ${r.outFile}` +
      `\nZIP: ${r.zipFile}` +
      `\n${r.applied ? '已写入(--apply)' : '干跑:未写文件,加 --apply 落盘'}` +
      '\n注意:当前 2.37.16 的「数据导入与同步」是扫描式入口,不收手搓文件;跨号续聊用 handoff.md\n',
  )
}

const isDirect = typeof process.argv[1] === 'string' && /doubao-build-import\.mjs$/.test(process.argv[1])
if (isDirect) main()

export const __test__ = { readArchiveBodies, buildStoreZip, zipPathFor, run }

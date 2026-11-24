// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 占位：水印头由 scripts/lib/doubao-carry.mjs 逐字节拼接（见落盘步骤）
/**
 * 豆包归档 → 豆包「数据导入与同步」可识别的 ChatGPT conversations.json。
 *
 * 用法:
 *   node scripts/doubao-build-import.mjs --archive <归档目录> --out <输出文件> [--apply]
 *   不带 --apply = 干跑,只报将导入的会话/消息数,不写文件。
 *
 * 为什么是 ChatGPT 格式:豆包 2.37.16「设置 → 数据导入与同步」支持导入
 * ChatGPT 本地备份(conversations.json),导入后会话进入原生列表、逐条保留上下文、
 * 打开即可接着聊 —— 这是豆包唯一能拿到「逐条原生可续聊会话」的官方通道。
 *
 * 纯本地文件操作:不读 cookie、不发网络、不碰任何账号。
 */
import fs from 'node:fs'
import path from 'node:path'

import { buildConversationsJson, validateConversationsJson } from './lib/doubao-chatgpt-format.mjs'

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
  const summary = {
    code: 'ok',
    archiveDir,
    outFile,
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
    fsImpl.writeFileSync(outFile, `${JSON.stringify(built.conversations, null, 2)}\n`, 'utf8')
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
    `豆包导入文件: 会话 ${r.conversations} / 消息 ${r.messages} / 跳过 ${r.skipped}` +
      `\n输出: ${r.outFile}` +
      `\n${r.applied ? '已写入(--apply)' : '干跑:未写文件,加 --apply 落盘'}\n`,
  )
}

const isDirect = typeof process.argv[1] === 'string' && /doubao-build-import\.mjs$/.test(process.argv[1])
if (isDirect) main()

export const __test__ = { readArchiveBodies, run }

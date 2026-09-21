#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-i18n-duplicate-namespaces.mjs — i18n JSON 重复命名空间/重复键守门
 *
 * 背景(两次同款真实事故,2026-09-08 立规则):
 *   ① automations 命名空间重复 → JSON last-wins 静默遮蔽,块独占的 delete 键全部丢失;
 *   ② en.json 尾部重复 repoWiki 块(zh-TW 值) → 遮蔽文件头部的正确英文块,
 *      check-i18n-broken-en 才间接暴露。
 *   根因:标准 JSON.parse 对重复键静默取最后一个,reviver 也无济于事
 *   (Walk 阶段重复键已被 parser 去重)→ 写入侧(会话追加块而非编辑既有块)零反馈。
 *
 * 原理:字符级扫描 — 维护对象深度栈,每层一个已见键集合;
 *   捕获每一段完整字符串(处理反斜杠转义),若其后下一个非空白字符为 ":" 则判定为键,
 *   在当前层查重。与嵌套/数组无关,不依赖 JSON.parse 语义。
 *
 * 扫描范围:packages/i18n/messages 下全部 .json 文件(递归,全部语言 × 全部端)
 *
 * 退出码:
 *   0 — 无重复
 *   1 — 发现重复命名空间/重复键(blocking)
 *   2 — 脚本自身异常
 *
 * 调用方:scripts/guardian-runner.mjs 第 2f 项(blocking)
 * 跳过:HUSKY_SKIP_I18N_DUP_NS=1
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SKIP_ENV = 'HUSKY_SKIP_I18N_DUP_NS'
const ROOT = process.cwd()
const MESSAGES_DIR = join(ROOT, 'packages', 'i18n', 'messages')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** 收集 messages 目录下全部 .json 文件 */
function listJsonFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...listJsonFiles(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

/**
 * 字符级重复键检测。
 * 返回 Array<{ line, key }>:重复键及其所在行号。
 */
function findDuplicateKeys(text) {
  const duplicates = []
  /** 每层对象的已见键集合;栈顶 = 当前层 */
  const stack = []
  let line = 1
  let i = 0
  const n = text.length

  const peekNonWs = (from) => {
    let j = from
    while (j < n) {
      const ch = text[j]
      if (ch === '\n') { /* 行号在主循环统一推进,这里只跳过 */ }
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') j++
      else break
    }
    return j
  }

  while (i < n) {
    const ch = text[i]
    if (ch === '\n') { line++; i++; continue }
    if (ch === '{') { stack.push(new Set()); i++; continue }
    if (ch === '}') { stack.pop(); i++; continue }
    if (ch === '"') {
      // 读取完整字符串(处理转义)
      let j = i + 1
      let raw = ''
      while (j < n) {
        const c = text[j]
        if (c === '\\') { raw += c + (text[j + 1] ?? ''); j += 2; continue }
        if (c === '"') break
        raw += c
        j++
      }
      // j 指向收尾引号;下一个非空白字符为 ":" → 这是键
      const after = peekNonWs(j + 1)
      if (text[after] === ':' && stack.length > 0) {
        const keys = stack[stack.length - 1]
        if (keys.has(raw)) duplicates.push({ line, key: raw.slice(0, 60) })
        else keys.add(raw)
      }
      i = j + 1
      continue
    }
    i++
  }
  return duplicates
}

function main() {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 i18n 重复命名空间守门(不推荐)${C.reset}`)
    process.exit(0)
  }
  if (!statSync(MESSAGES_DIR, { throwIfNoEntry: false })?.isDirectory()) {
    console.log(`${C.yellow}⚠ 未找到 ${relative(ROOT, MESSAGES_DIR)},跳过${C.reset}`)
    process.exit(0)
  }

  const files = listJsonFiles(MESSAGES_DIR)
  const offenders = []

  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join('/')
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch (e) {
      offenders.push({ rel, detail: `读取失败: ${e.message}` })
      continue
    }
    try {
      JSON.parse(text) // 合法性顺带校验(重复键对 JSON.parse 合法,但语法错误要报)
    } catch (e) {
      offenders.push({ rel, detail: `JSON 解析失败: ${e.message.slice(0, 120)}` })
      continue
    }
    const duplicates = findDuplicateKeys(text)
    if (duplicates.length > 0) {
      offenders.push({
        rel,
        detail: duplicates.map((d) => `L${d.line} "${d.key}" 重复`).join(', '),
      })
    }
  }

  console.log(`${C.cyan}${C.bold}🔎 i18n 重复命名空间守门(packages/i18n/messages, ${files.length} 文件)${C.reset}`)
  if (offenders.length === 0) {
    console.log(`${C.green}✅ 无重复命名空间/重复键${C.reset}`)
    process.exit(0)
  }
  console.log(`${C.red}${C.bold}❌ 发现 ${offenders.length} 个文件存在重复键(JSON last-wins 静默遮蔽;历史事故:automations delete 键丢失 / repoWiki 英文块被遮蔽)${C.reset}`)
  for (const o of offenders) {
    console.log(`  ${C.red}❌ ${o.rel}${C.reset}`)
    console.log(`     ${C.dim}${o.detail}${C.reset}`)
  }
  console.log(`\n${C.yellow}修复:删除重复块,只保留正确的一份(编辑既有块,禁止文件尾部追加同名块)${C.reset}`)
  console.log(`紧急跳过(不推荐):${C.cyan}${SKIP_ENV}=1 git commit ...${C.reset}`)
  process.exit(1)
}

main()

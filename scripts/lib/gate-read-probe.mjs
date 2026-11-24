#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gate-read-probe.mjs — 门的读取面探针(2026-11-07,feat/tree-materialize-1107)。
 *
 * 只做一件事:记录门(及其 node 子进程)对**物化树**里哪些路径做了内容读取/存在性检查/
 * 目录枚举,交给 gate-worker 判定「子集物化是否够用」。它不改变门的任何判断,不写
 * stdout/stderr;探针自身失败一律静默(调用方会把「没有探针输出」当失败兜底走全树)。
 *
 * 启用方式:NODE_OPTIONS=--import <本文件> 且设 IHUI_READ_PROBE_BASE / IHUI_READ_PROBE_ROOT。
 * 每个进程写 `<BASE>.<pid>.json`(父子进程互不覆盖)。
 *
 * 盲区(如实记录):原生二进制(git/tar/esbuild 等)的读取不可见;Node 子进程经
 * NODE_OPTIONS 继承本探针。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncBuiltinESMExports } from 'node:module'

const BASE = process.env.IHUI_READ_PROBE_BASE
const ROOT_RAW = process.env.IHUI_READ_PROBE_ROOT
if (BASE && ROOT_RAW) {
  const ROOT = path.resolve(ROOT_RAW)
  const ROOT_LOW = ROOT.toLowerCase()
  const orig = {
    readFileSync: fs.readFileSync.bind(fs),
    readFile: fs.readFile.bind(fs),
    createReadStream: fs.createReadStream.bind(fs),
    openSync: fs.openSync.bind(fs),
    open: fs.open.bind(fs),
    statSync: fs.statSync.bind(fs),
    stat: fs.stat.bind(fs),
    existsSync: fs.existsSync.bind(fs),
    accessSync: fs.accessSync.bind(fs),
    readdirSync: fs.readdirSync.bind(fs),
    opendirSync: fs.opendirSync.bind(fs),
    readdir: fs.readdir.bind(fs),
    opendir: fs.opendir.bind(fs),
    writeFileSync: fs.writeFileSync.bind(fs),
    appendFileSync: fs.appendFileSync.bind(fs),
    mkdirSync: fs.mkdirSync.bind(fs),
    rmSync: fs.rmSync.bind(fs),
    unlinkSync: fs.unlinkSync.bind(fs),
    copyFileSync: fs.copyFileSync.bind(fs),
    renameSync: fs.renameSync.bind(fs),
    createWriteStream: fs.createWriteStream.bind(fs),
  }
  const reads = new Set()
  const stats = new Set()
  const dirs = new Set()
  // 写面:门会往物化树里落「状态文件 / 账本」——缓存条目被复用后这些会跨轮残留。
  // 记下来由 gate-worker 清掉(不记 ⇒ 无法保证与"整树全新解包"同形)。
  const writes = new Set()

  const norm = (p) => {
    if (p && typeof p === 'object') {
      if (p instanceof URL || typeof p.href === 'string') {
        try {
          p = fileURLToPath(p)
        } catch {
          return null
        }
      } else {
        return null
      }
    }
    return typeof p === 'string' ? path.resolve(p) : null
  }
  const inRoot = (abs) => {
    if (!abs || !ROOT_LOW) return false
    const low = abs.toLowerCase()
    if (!low.startsWith(ROOT_LOW)) return false
    return !(low.includes('\\node_modules\\') || low.includes('/node_modules/'))
  }
  const markFile = (set, p) => {
    const abs = norm(p)
    if (abs && inRoot(abs)) set.add(abs)
  }
  const markDir = (p) => {
    const abs = norm(p)
    if (!abs) return
    const low = abs.toLowerCase()
    if (low.startsWith(ROOT_LOW)) dirs.add(abs)
  }
  const isRead = (flags) => {
    const f = typeof flags === 'string' ? flags : 'r'
    return f.startsWith('r') || f === 'a+' || f === 'r+'
  }

  fs.readFileSync = (p, ...rest) => {
    markFile(reads, p)
    return orig.readFileSync(p, ...rest)
  }
  fs.readFile = (p, ...rest) => {
    markFile(reads, p)
    return orig.readFile(p, ...rest)
  }
  fs.createReadStream = (p, ...rest) => {
    markFile(reads, p)
    return orig.createReadStream(p, ...rest)
  }
  fs.openSync = (p, flags, ...rest) => {
    if (isRead(flags)) markFile(reads, p)
    return orig.openSync(p, flags, ...rest)
  }
  fs.open = (p, flags, ...rest) => {
    if (isRead(flags)) markFile(reads, p)
    return orig.open(p, flags, ...rest)
  }
  fs.statSync = (p, ...rest) => {
    markFile(stats, p)
    return orig.statSync(p, ...rest)
  }
  fs.stat = (p, ...rest) => {
    markFile(stats, p)
    return orig.stat(p, ...rest)
  }
  fs.existsSync = (p) => {
    markFile(stats, p)
    return orig.existsSync(p)
  }
  fs.accessSync = (p, ...rest) => {
    markFile(stats, p)
    return orig.accessSync(p, ...rest)
  }
  fs.readdirSync = (p, ...rest) => {
    markDir(p)
    return orig.readdirSync(p, ...rest)
  }
  fs.opendirSync = (p, ...rest) => {
    markDir(p)
    return orig.opendirSync(p, ...rest)
  }
  // 回调式 readdir/opendir 也要记:不少门(含 glob 类库)走的是这条路径,
  // 只盯 readdirSync 会让"目录枚举"变成盲区 —— 覆盖判定就会漏掉少文件的目录。
  fs.readdir = (p, ...rest) => {
    markDir(p)
    return orig.readdir(p, ...rest)
  }
  fs.opendir = (p, ...rest) => {
    markDir(p)
    return orig.opendir(p, ...rest)
  }
  const markWrite = (p) => {
    const abs = norm(p)
    if (!abs) return
    const low = abs.toLowerCase()
    if (low.startsWith(ROOT_LOW)) writes.add(abs)
  }
  fs.writeFileSync = (p, ...rest) => {
    markWrite(p)
    return orig.writeFileSync(p, ...rest)
  }
  fs.appendFileSync = (p, ...rest) => {
    markWrite(p)
    return orig.appendFileSync(p, ...rest)
  }
  fs.mkdirSync = (p, ...rest) => {
    markWrite(p)
    return orig.mkdirSync(p, ...rest)
  }
  fs.rmSync = (p, ...rest) => {
    markWrite(p)
    return orig.rmSync(p, ...rest)
  }
  fs.unlinkSync = (p, ...rest) => {
    markWrite(p)
    return orig.unlinkSync(p, ...rest)
  }
  fs.copyFileSync = (p, ...rest) => {
    markWrite(p)
    return orig.copyFileSync(p, ...rest)
  }
  fs.renameSync = (p, ...rest) => {
    markWrite(p)
    return orig.renameSync(p, ...rest)
  }
  fs.createWriteStream = (p, ...rest) => {
    markWrite(p)
    return orig.createWriteStream(p, ...rest)
  }
  if (fs.promises) {
    const pReadFile = fs.promises.readFile.bind(fs.promises)
    fs.promises.readFile = (p, ...rest) => {
      markFile(reads, p)
      return pReadFile(p, ...rest)
    }
    const pOpen = fs.promises.open.bind(fs.promises)
    fs.promises.open = (p, flags, ...rest) => {
      if (isRead(flags)) markFile(reads, p)
      return pOpen(p, flags, ...rest)
    }
    const pReaddir = fs.promises.readdir.bind(fs.promises)
    fs.promises.readdir = (p, ...rest) => {
      markDir(p)
      return pReaddir(p, ...rest)
    }
    if (typeof fs.promises.opendir === 'function') {
      const pOpendir = fs.promises.opendir.bind(fs.promises)
      fs.promises.opendir = (p, ...rest) => {
        markDir(p)
        return pOpendir(p, ...rest)
      }
    }
    for (const name of ['writeFile', 'appendFile', 'mkdir', 'rm', 'unlink', 'copyFile', 'rename']) {
      const origName = fs.promises[name]
      if (typeof origName !== 'function') continue
      const bound = origName.bind(fs.promises)
      fs.promises[name] = (p, ...rest) => {
        markWrite(p)
        return bound(p, ...rest)
      }
    }
  }
  try {
    syncBuiltinESMExports()
  } catch {
    /* 老 Node:退化为 CJS 可见 */
  }

  process.on('exit', () => {
    try {
      orig.writeFileSync(
        `${BASE}.${process.pid}.json`,
        JSON.stringify({
          pid: process.pid,
          root: ROOT,
          reads: [...reads],
          stats: [...stats],
          dirs: [...dirs],
          writes: [...writes],
        }),
        'utf8',
      )
    } catch {
      /* 探针失败不改变门结论;调用方按"无输出"兜底 */
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#!/usr/bin/env node
/**
 * 扫描后端路由文件，输出按 method+path 分组后的真实重复路由。
 *
 * 策略：
 * 1. 解析 server.ts，得到 pluginName -> file -> prefixes。
 * 2. 对每个路由文件，按 `export const pluginName = async (server) => { ... }`
 *    划分插件块，把 server.get/post/... 归属到具体插件。
 * 3. 生成 (pluginName, prefix, method, localPath) -> fullPath。
 * 4. 只有“同一个 fullPath 由多个不同的 plugin+prefix 组合提供”才算冲突。
 *
 * 这样可以避免：
 * - 同一文件内多个插件 export（如 public/admin）被错误叠加 prefix。
 * - 同一插件被注册到 /api 与 /api/admin 被误判为冲突。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const API_SRC_DIR = join(ROOT, 'apps/api/src')
const SERVER_FILE = join(API_SRC_DIR, 'server.ts')

function resolveTsPath(importPath) {
  if (!importPath.startsWith('.')) return null
  const base = importPath.replace(/\.js$/, '')
  const candidates = [`${base}.ts`, `${base}/index.ts`]
  for (const c of candidates) {
    const full = join(API_SRC_DIR, c)
    if (existsSync(full)) return relative(ROOT, full)
  }
  return relative(ROOT, join(API_SRC_DIR, `${base}.ts`))
}

function extractImportMap() {
  const src = readFileSync(SERVER_FILE, 'utf8')
  const map = new Map()
  const re = /import\s+(?:(\w+)\s*,\s*)?\{?([^}]+)\}?\s*from\s+['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(src)) !== null) {
    const defaultName = m[1]?.trim()
    const namedList = m[2]
    const path = m[3]
    const file = resolveTsPath(path)
    if (!file) continue
    if (defaultName) map.set(defaultName, file)
    if (namedList) {
      for (const raw of namedList.split(',')) {
        const name = raw.trim()
        if (name && !name.startsWith('type ')) map.set(name, file)
      }
    }
  }
  return map
}

function extractPluginPrefixes() {
  const src = readFileSync(SERVER_FILE, 'utf8')
  const map = new Map()
  const re = /server\.register\(\s*(\w+)\s*(?:,\s*\{\s*prefix:\s*['"`]([^'"`]+)['"`]\s*\})?\s*\)/g
  let m
  while ((m = re.exec(src)) !== null) {
    const pluginName = m[1]
    const prefix = m[2] ?? ''
    if (!map.has(pluginName)) map.set(pluginName, new Set())
    map.get(pluginName).add(prefix)
  }
  return map
}

function extractPluginsFromFile(file) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const plugins = []

  // 匹配 export const name = async (server) => { 或 export const name: FastifyPluginAsync = async (server) => {
  const exportRe = /export\s+(?:const|function)\s+(\w+)\s*[:=].*\(\s*server\b/ // 仅用于定位行
  const defaultRe = /export\s+default\s+(\w+)/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const exportMatch = exportRe.exec(line)
    if (exportMatch) {
      const pluginName = exportMatch[1]
      const startLine = i
      // 找到本行或后续行第一个 '{'
      let braceStart = line.indexOf('{')
      let scan = i
      let tail = line
      while (braceStart === -1 && scan < lines.length - 1) {
        scan++
        tail = lines[scan]
        braceStart = tail.indexOf('{')
      }
      if (braceStart === -1) continue
      const endLine = findClosingBrace(lines, scan, braceStart)
      plugins.push({ name: pluginName, startLine, endLine })
    }

    const defaultMatch = defaultRe.exec(line)
    if (defaultMatch) {
      // 对 default export，需要在文件内找到该变量定义的作用域
      const varName = defaultMatch[1]
      const varRe = new RegExp(`(?:const|let|var|function)\\s+${varName}\\s*[:=].*\\(`)
      for (let j = 0; j < lines.length; j++) {
        if (varRe.test(lines[j])) {
          let braceStart = lines[j].indexOf('{')
          let scan = j
          while (braceStart === -1 && scan < lines.length - 1) {
            scan++
            braceStart = lines[scan].indexOf('{')
          }
          if (braceStart === -1) continue
          const endLine = findClosingBrace(lines, scan, braceStart)
          plugins.push({ name: `default:${varName}`, startLine: j, endLine })
          break
        }
      }
    }
  }

  return plugins
}

function findClosingBrace(lines, startLine, startCol) {
  let depth = 0
  let inString = null
  let escaped = false
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]
    const begin = i === startLine ? startCol : 0
    for (let j = begin; j < line.length; j++) {
      const ch = line[j]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (ch === '\\') {
          escaped = true
        } else if (ch === inString) {
          inString = null
        }
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch
        continue
      }
      if (ch === '/' && j + 1 < line.length) {
        const next = line[j + 1]
        if (next === '/') break // 行注释，跳过本行剩余
        if (next === '*') {
          // 块注释，简单跳过到 */
          let found = false
          for (let k = j + 2; k < line.length - 1; k++) {
            if (line[k] === '*' && line[k + 1] === '/') {
              j = k + 1
              found = true
              break
            }
          }
          if (!found) {
            // 跨行块注释，继续扫描下一行
            let done = false
            for (let k = i + 1; k < lines.length && !done; k++) {
              for (let l = 0; l < lines[k].length - 1; l++) {
                if (lines[k][l] === '*' && lines[k][l + 1] === '/') {
                  i = k
                  j = l + 1
                  done = true
                  break
                }
              }
            }
          }
          continue
        }
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return i
      }
    }
  }
  return lines.length - 1
}

function extractRoutesFromFile(file, plugins) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const routes = []
  const re = /server\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(src)) !== null) {
    const pos = m.index
    let lineIdx = 0
    let acc = 0
    for (let i = 0; i < lines.length; i++) {
      if (acc + lines[i].length + 1 > pos) {
        lineIdx = i
        break
      }
      acc += lines[i].length + 1
    }
    const plugin = plugins.find((p) => lineIdx >= p.startLine && lineIdx <= p.endLine)
    routes.push({
      method: m[1].toUpperCase(),
      localPath: m[2],
      pluginName: plugin ? plugin.name : '<unknown>',
    })
  }
  return routes
}

function normalizePath(prefix, localPath) {
  if (localPath === '/' || localPath === '') return prefix || '/'
  const sep = prefix.endsWith('/') ? '' : '/'
  const lp = localPath.startsWith('/') ? localPath : sep + localPath
  return `${prefix}${lp}`
}

const importMap = extractImportMap()
const pluginPrefixes = extractPluginPrefixes()

const routeEntries = []
for (const [pluginName, prefixes] of pluginPrefixes) {
  const file = importMap.get(pluginName)
  if (!file) continue
  const plugins = extractPluginsFromFile(join(ROOT, file))
  // 单个文件可能 export 多个 plugin，但 server.ts 里注册的 pluginName 只对应其中一个。
  // 这里按插件名精确匹配：找到名字等于 pluginName 的 plugin 块。
  const targetPlugin = plugins.find((p) => p.name === pluginName)
  if (!targetPlugin) {
    // 可能是 default export（如 import name from './file'）
    const defaultPlugin = plugins.find((p) => p.name.startsWith('default:'))
    if (!defaultPlugin) continue
    const routes = extractRoutesFromFile(join(ROOT, file), plugins)
    for (const r of routes) {
      if (r.pluginName !== defaultPlugin.name) continue
      for (const prefix of prefixes) {
        routeEntries.push({
          pluginName,
          prefix,
          method: r.method,
          localPath: r.localPath,
          full: `${r.method} ${normalizePath(prefix, r.localPath)}`,
        })
      }
    }
    continue
  }

  const routes = extractRoutesFromFile(join(ROOT, file), plugins)
  for (const r of routes) {
    if (r.pluginName !== targetPlugin.name) continue
    for (const prefix of prefixes) {
      routeEntries.push({
        pluginName,
        prefix,
        method: r.method,
        localPath: r.localPath,
        full: `${r.method} ${normalizePath(prefix, r.localPath)}`,
      })
    }
  }
}

const counts = new Map()
for (const entry of routeEntries) {
  if (!counts.has(entry.full)) counts.set(entry.full, [])
  counts.get(entry.full).push({
    pluginName: entry.pluginName,
    prefix: entry.prefix,
    localPath: entry.localPath,
  })
}

const duplicates = []
for (const [full, sources] of counts) {
  if (sources.length > 1) {
    // 去重展示
    const keySet = new Set(sources.map((s) => `${s.pluginName}:${s.prefix}:${s.localPath}`))
    if (keySet.size > 1) {
      duplicates.push({ full, sources })
    }
  }
}

if (duplicates.length === 0) {
  console.log('未发现重复路由')
  process.exit(0)
}

console.log(`发现 ${duplicates.length} 条重复路由：\n`)
for (const d of duplicates) {
  console.log(d.full)
  for (const s of d.sources) {
    console.log(`  - ${s.pluginName} @ ${s.prefix || '/'} (${s.localPath})`)
  }
}

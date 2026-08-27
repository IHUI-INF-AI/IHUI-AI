#!/usr/bin/env node
/**
 * 从 remote-icons.ts 提取所有远程 URL 路径,生成占位图并初始化 CDN 部署目录
 * 用法: node ./deploy/generate-placeholders.js --out ./deploy/server-root
 */
const fs = require('fs')
const path = require('path')

const remoteIconsFile = 'apps/miniapp-taro/src/constants/remote-icons.ts'
const src = fs.readFileSync(remoteIconsFile, 'utf8')

// 提取所有 aizhsUrl('...') 和 bspappUrl('...') 中的路径
const regex = /(?:aizhsUrl|bspappUrl)\('([^']+)'[)]/g
const paths = []
let m
while ((m = regex.exec(src)) !== null) {
  const p = m[1].replace(/^\//, '').replace(/\\/g, '/')
  if (p && p !== m[1]) paths.push(p)
  else if (p) paths.push(p)
}

const unique = [...new Set(paths)]
console.log(`[提取] ${unique.length} 个远程路径,去重后`)

const outArgIdx = process.argv.indexOf('--out')
const outDir = outArgIdx >= 0 ? process.argv[outArgIdx + 1] : './deploy/server-root'
fs.mkdirSync(outDir, { recursive: true })

let created = 0
let alreadyExists = 0
for (const p of unique) {
  const dest = path.join(outDir, p)
  const dir = path.dirname(dest)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (fs.existsSync(dest)) {
    alreadyExists++
    continue
  }
  fs.writeFileSync(dest, Buffer.alloc(0)) // 空文件,由服务器生成占位 PNG
  created++
}

console.log(`[创建] ${created} 个占位文件, ${alreadyExists} 个已存在`)
console.log(`[输出] ${outDir}`)

// 输出清单
fs.writeFileSync(
  path.join(outDir, 'MANIFEST.txt'),
  `[IHUI-AI] 占位图清单 - ${new Date().toISOString()}\n` +
    `总计: ${unique.length} 个文件(均为占位,等待真图替换)\n\n` +
    unique.map((p, i) => `${i + 1}. ${p}`).join('\n') +
    '\n',
)
console.log(`[清单] ${path.join(outDir, 'MANIFEST.txt')}`)

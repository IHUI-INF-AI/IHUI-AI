import fs from 'node:fs'

const msgs = JSON.parse(fs.readFileSync('.ihui-agent/tmp/q2-web-msgs.json', 'utf8'))
const LANGS = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko']

/** web 命名空间 → 移动端命名空间(值逐字照抄,只做前缀改名以避开 q1 的 knowledge* 命名) */
const NS_MAP = [
  ['knowledgeCard', 'knowledgeCardPage'],
  ['knowledgeGraph', 'knowledgeGraphPage'],
  ['memoryManager', 'memoryManagerPage'],
]

export function buildI18n(enabledNamespaces) {
  const out = {}
  for (const lang of LANGS) {
    out[lang] = {}
    for (const [webNs, mobileNs] of NS_MAP) {
      if (!enabledNamespaces.includes(webNs)) continue
      out[lang][mobileNs] = msgs[lang][webNs]
    }
  }
  return out
}

export function readManifest(file) {
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function writeManifest(file, manifest) {
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
}

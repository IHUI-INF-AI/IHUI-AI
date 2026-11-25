#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 门需要 stdout 诊断 */
/**
 * 容器构建面硬化检查(2026-11-24 立)。
 *
 * 威胁模型:镜像一旦逃逸/被投毒,容器里的 root 就是宿主机 root 的跳板;构建参数里的
 * 密钥会永久留在镜像层(即使后续 ENV 删掉也能被 `docker history` 挖出)。
 *
 * 判据只看「能直接放大成宿主机风险」的项,不追 CIS 全量(全量在单机部署里没有执行者,
 * 会变成恒红)。缺 USER 是**全文判据**而不是逐行:它不是"某行写错",而是"整份没写"。
 *
 * 用法: node scripts/security/check-container-hardening.mjs [--update-baseline] [--json]
 * 退出码: 0 无新增 | 1 新增 | 2 未判定
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultBaselinePath, listRepoFiles, readText, redactSnippet, runScanCli } from './lib/scan-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

export const DOCKER_RULES = Object.freeze([
  { id: 'root-user', severity: 'high', re: /^\s*USER\s+(?:root|0)\s*$/i, message: '容器以 root 运行' },
  { id: 'latest-tag', severity: 'medium', re: /^\s*FROM\s+\S+:latest(?:\s|$)/i, message: '基础镜像用 latest（不可复现）' },
  { id: 'add-remote', severity: 'high', re: /^\s*ADD\s+https?:\/\//i, message: 'ADD 远程 URL（内容不可校验）' },
  { id: 'curl-pipe-shell', severity: 'critical', re: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sh|bash)\b/i, message: '下载即执行（供应链投毒入口）' },
  { id: 'chmod-777', severity: 'medium', re: /chmod\s+(?:-R\s+)?777\b/, message: 'chmod 777 放开全部权限' },
  { id: 'build-secret', severity: 'high', re: /^\s*(?:ARG|ENV)\s+[^\n]*(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|API_KEY)/i, message: '构建参数/环境变量含密钥（会留在镜像层）' },
  { id: 'apt-no-slim', severity: 'medium', re: /apt-get\s+install(?![^\n]*--no-install-recommends)/, message: 'apt 安装未加 --no-install-recommends（扩大攻击面）' },
])

const USER_EXEMPT_RE = /#\s*security-exempt\s*:\s*container-user\s+(\S.{7,})/i

export function scanDockerfile(file, text) {
  const findings = []
  const skipped = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (/security-exempt\s*:/.test(line)) continue
    for (const rule of DOCKER_RULES) {
      if (rule.re.test(line)) {
        findings.push({ file, line: i + 1, rule: rule.id, severity: rule.severity, message: rule.message, snippet: redactSnippet(line) })
      }
    }
  }
  const meaningful = lines.filter((l) => l.trim() && !l.trim().startsWith('#')).join('\n')
  const userMatch = meaningful.match(/^\s*USER\s+(\S*)/im)
  const userIsRoot = !userMatch || /^(?:root|0)$/i.test(String(userMatch[1]).trim())
  // 豁免必须带 container-user 关键词 + ≥8 字理由:一句"我不用"不能免。
  const exempt = lines.map((l) => USER_EXEMPT_RE.exec(l)).find(Boolean)
  if (userIsRoot) {
    if (exempt) skipped.push({ file, reason: `exempt: ${exempt[1].slice(0, 60)}` })
    else findings.push({ file, line: 1, rule: 'no-user', severity: 'high', message: '整份 Dockerfile 没有 USER 指令（默认 root）', snippet: 'FROM …' })
  }
  // 加了 USER 却绑特权端口 = 容器起不来:这是非 root 加固最常踩的坑,必须单独判。
  if (userMatch && !userIsRoot) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      if (!line.trim() || line.trim().startsWith('#')) continue
      const m = /\blisten\s+([\d.]+(?::\d+)?)\s*(?:ssl\s*)?[;{]?/.exec(line)
      const e = /^\s*EXPOSE\s+(\d+)/i.exec(line)
      const port = m ? Number(String(m[1]).split(':').pop()) : e ? Number(e[1]) : null
      if (port !== null && port < 1024) {
        findings.push({ file, line: i + 1, rule: 'privileged-port', severity: 'high', message: `非 root 用户无法绑定特权端口 ${port}`, snippet: redactSnippet(line) })
      }
    }
    // 降权后仍要写的目录必须被 chown 过,否则容器启动即 EACCES ——
    // 这一条是"能起来"的必要条件:本仓**不引入任何容器运行时依赖**(机主 2026-11-24 定死
    // "永不安装或使用 Docker"),所以降权可启动性的验证只能由静态判据承担 ——
    // 判据覆盖"该交的权限都交了",不承诺"镜像已被真跑过"。
    if (/^CMD\s*\[?\s*["']?nginx/mi.test(meaningful) || /nginx/i.test(meaningful)) {
      for (const dir of ['/var/cache/nginx', '/var/log/nginx', '/var/run']) {
        const re = new RegExp(`chown[^\\n]*${dir.replace(/\//g, '\\/')}`)
        if (!re.test(meaningful)) {
          findings.push({ file, line: 1, rule: 'nonroot-writable-paths', severity: 'high', message: `降权运行 nginx 但 ${dir} 未 chown（启动即 Permission denied）`, snippet: `USER ${userMatch[1]}` })
        }
      }
    }
  }
  return { findings, skipped }
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const updateBaseline = argv.includes('--update-baseline')
  const strict = !argv.includes('--no-strict')
  const baselinePath = defaultBaselinePath(ROOT, 'container-hardening')

  const { files, error } = listRepoFiles(ROOT, { exts: [] })
  const dockerfiles = files.filter((f) => /(?:^|\/)Dockerfile[^/]*$/.test(f))
  if (!dockerfiles.length) {
    console.log('[container-hardening] ❔ 未判定：仓库内没有 Dockerfile')
    return 2
  }
  let findings = []
  const skipped = []
  for (const file of dockerfiles) {
    const { text, skipped: why } = readText(ROOT, file)
    if (why) {
      skipped.push({ file, reason: why })
      continue
    }
    const r = scanDockerfile(file, text)
    findings = findings.concat(r.findings)
    skipped.push(...r.skipped)
  }

  const result = runScanCli({
    name: 'container-hardening',
    findings,
    skipped,
    baselinePath,
    strict,
    updateBaseline,
    root: ROOT,
    extraLines: [`扫描面 ${dockerfiles.length} 份 Dockerfile`],
    unjudged: error,
  })
  if (json) console.log(JSON.stringify({ ok: result.code === 0, ...result.counts, findings }, null, 2))
  return result.code
}

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('check-container-hardening.mjs')
if (IS_MAIN) process.exit(main())

export const __test__ = { DOCKER_RULES, scanDockerfile }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

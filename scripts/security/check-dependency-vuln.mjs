#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 stdout 输出判定 */
/**
 * 依赖漏洞版本守卫(2026-11-24 立)。
 *
 * 判的是**实际装进 node_modules 的版本**,不是 package.json 里的声明 ——
 * `"next": "^16.0.0"` 解析到 16.0.2 一样会被 React2Shell 打穿,而声明面看着像 16。
 * 取不到安装版本时落「未判定」,不用声明版本冒充。
 *
 * 用法:
 *   node scripts/security/check-dependency-vuln.mjs           # 审计 apps/web
 *   node scripts/security/check-dependency-vuln.mjs --json
 *   node scripts/security/check-dependency-vuln.mjs --dir apps/api
 * 退出码: 0 安全 | 1 需要升级(附 fix plan) | 2 未判定
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFixPlan, judgeNext, judgeReact } from './lib/vuln-policy.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

function installedVersion(appDir, pkg) {
  try {
    const req = createRequire(join(appDir, 'package.json'))
    const p = req.resolve(`${pkg}/package.json`)
    return JSON.parse(readFileSync(p, 'utf8')).version ?? null
  } catch {
    return null
  }
}

function declaredVersion(appDir, pkg) {
  try {
    const pj = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'))
    return pj.dependencies?.[pkg] ?? pj.devDependencies?.[pkg] ?? null
  } catch {
    return null
  }
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const dirArg = argv.indexOf('--dir') >= 0 ? argv[argv.indexOf('--dir') + 1] : 'apps/web'
  const appDir = resolve(ROOT, dirArg)

  if (!existsSync(join(appDir, 'package.json'))) {
    console.error(`未判定: ${appDir} 下没有 package.json`)
    return 2
  }

  const checks = []
  for (const [pkg, judge] of [['next', judgeNext], ['react', judgeReact]]) {
    const installed = installedVersion(appDir, pkg)
    const declared = declaredVersion(appDir, pkg)
    if (!installed) {
      checks.push({ pkg, declared, installed: null, safe: null, reason: `取不到 ${pkg} 安装版本(node_modules 缺失?)`, required: null })
      continue
    }
    const v = judge(installed)
    checks.push({ pkg, declared, installed, safe: v.safe, reason: v.reason, required: v.required })
  }
  const reactDom = installedVersion(appDir, 'react-dom') || ''
  const next = checks.find((c) => c.pkg === 'next')?.installed
  const react = checks.find((c) => c.pkg === 'react')?.installed
  const fixPlan = buildFixPlan({ next, react, reactDom })

  const unsafe = checks.filter((c) => c.safe === false)
  const unjudged = checks.filter((c) => c.safe === null)
  const result = { dir: appDir, checks, fixPlan, ok: unsafe.length === 0 && unjudged.length === 0 }

  if (json) console.log(JSON.stringify(result, null, 2))
  else {
    for (const c of checks) {
      const mark = c.safe === true ? '✓' : c.safe === false ? '✗' : '?'
      console.log(`${mark} ${c.pkg}: 实装 ${c.installed ?? '未判定'} / 声明 ${c.declared ?? '-'} — ${c.reason}`)
    }
    if (fixPlan.length) {
      console.log('修复计划(只生成,不执行;生产升级走部署环):')
      for (const cmd of fixPlan) console.log(`  ${cmd}`)
    }
  }

  if (unjudged.length === checks.length) return 2
  if (unsafe.length) return 1
  return unjudged.length ? 2 : 0
}

process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

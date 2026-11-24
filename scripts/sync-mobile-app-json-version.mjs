#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 生成器为 CLI 工具,需 console 输出诊断信息 */
/**
 * sync-mobile-app-json-version.mjs — 把 `apps/mobile-rn/app.json` 的 `expo.version`
 * 变成 `apps/mobile-rn/package.json` 的**派生产物**(单一真源 = package.json)。
 *
 * 立因(2026-11-07):CI 门 `check-version-drift.mjs` 的 I 维在 main 上红了 ——
 *   `[version-drift] ✗ I 移动端版本双写不一致: app.json=0.0.5 而 apps/mobile-rn/package.json=0.0.12`
 * 而该漂移在父提交上逐字相同(存量,不是本笔引入)。根因不是"数字写错了",是
 * **app.json 的版本号不由任何东西驱动**:bump package.json 之后没人记得同步它,
 * 于是下一次发版必然再漂一次。手改一次数字只是把一个会复发的事故按下去。
 *
 * 口径(与 `check-version-drift` 的 I 维判据完全一致,不改门的比较字段、不放宽判据):
 *   - 真源 = `apps/mobile-rn/package.json` 的 `version`;
 *   - 派生 = `apps/mobile-rn/app.json` 的 `expo.version`(app.config.js 在该值缺省时回落 package.json;
 *     app.json 里这份是"看起来像版本号、却不被任何东西驱动"的死字面量,正是本门要消灭的形态);
 *   - 本脚本只做一件事:把派生值写成真源的值,**逐字节只动那一处字符串**。
 *
 * 稳定性(可复现):
 *   - 默认写模式是**幂等**的:已一致时不写盘(不产生 mtime/字节变化);
 *   - 同一输入跑两次输出字节完全一致(其余文本一个字符都不重排,不做 JSON 重新序列化);
 *   - 落盘前用"改后重新解析 + 与期望对象深比较"自校验,替换点错一处就拒绝写盘(exit 2)。
 *
 * 接线:
 *   - 根 package.json `postinstall` 调用(仓内既有的 prepare 类钩子),bump 后跑一次安装即自动跟;
 *   - CI `.github/workflows/ci.yml` 在 `pnpm install` **之前**用 `--check` 断言提交里的派生值不陈旧
 *     (放在 install 之后就等于让 postinstall 先自愈,`check-version-drift` 的 I 维再也抓不到"提交漂了"这件事)。
 *
 * 用法:
 *   node scripts/sync-mobile-app-json-version.mjs            # 写入(默认)
 *   node scripts/sync-mobile-app-json-version.mjs --check    # 只读校验:陈旧 exit 1
 *   node scripts/sync-mobile-app-json-version.mjs --json     # 机器可读结果
 *
 * 退出码:
 *   0 — 已一致 / 已写入 / 目标文件不在场(部分构建上下文,如 Docker deps 阶段)而跳过
 *   1 — --check 档发现派生值陈旧
 *   2 — 结构错误(JSON 读不动、package.json 版本不是语义版本、app.json 缺 expo.version、替换点不唯一)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MOBILE_DIR = join(ROOT, 'apps', 'mobile-rn')
const PKG_PATH = join(MOBILE_DIR, 'package.json')
const APP_JSON_PATH = join(MOBILE_DIR, 'app.json')

/** 语义版本的宽松口径:与 package.json 里实际会出现的形态对齐(允许 prerelease/build 后缀)。 */
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

/** 把字符串原样写成 JSON 字符串字面量(只用于替换值 token,不重排任何其它字节)。 */
function jsonString(value) {
  return JSON.stringify(value)
}

/** 深比较用:解析顺序即对象键序,重新序列化即可逐字比对。 */
function canonical(value) {
  return JSON.stringify(value)
}

/**
 * 计算派生结果(纯函数,镜像测试直接 import 它)。
 *
 * @param {string} appJsonText  app.json 原文
 * @param {string} pkgVersion   `apps/mobile-rn/package.json` 的 version(真源)
 * @returns {{ ok: boolean, changed: boolean, text: string, error: string | null, from: string | null, to: string | null }}
 */
export function deriveAppJsonVersion(appJsonText, pkgVersion) {
  const fail = (error) => ({
    ok: false,
    changed: false,
    text: appJsonText,
    error,
    from: null,
    to: null,
  })
  const version = typeof pkgVersion === 'string' ? pkgVersion.trim() : ''
  if (!SEMVER.test(version)) {
    return fail(`package.json 的 version 不是语义版本: ${JSON.stringify(pkgVersion)}`)
  }

  let doc
  try {
    doc = JSON.parse(appJsonText)
  } catch (err) {
    return fail(`app.json 不是合法 JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
  const expo = doc && typeof doc === 'object' ? doc.expo : null
  if (!expo || typeof expo !== 'object') return fail('app.json 缺 expo 对象')
  if (typeof expo.version !== 'string' || expo.version.trim() === '') {
    return fail('app.json 缺 expo.version(派生目标不在场,拒绝猜测写入位置)')
  }

  const from = expo.version
  if (from === version) {
    return { ok: true, changed: false, text: appJsonText, error: null, from, to: version }
  }

  // 只替换 `expo` 键之后、与旧值逐字相同的第一个 `"version": "<旧值>"`。
  // 不重排 JSON(重新序列化会把 `["weixin", ...]` 这类行内数组展开,产出与门无关的巨大 diff)。
  const expoAt = appJsonText.search(/"expo"\s*:\s*\{/)
  const needle = new RegExp(
    `"version"\\s*:\\s*${jsonString(from).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'g',
  )
  let target = null
  for (const m of appJsonText.matchAll(needle)) {
    if (expoAt >= 0 && m.index < expoAt) continue
    target = m
    break
  }
  if (!target) {
    return fail(`app.json 里找不到与 expo.version 同形的 "version": ${jsonString(from)} 字面量`)
  }

  const literalStart = target.index + target[0].indexOf(jsonString(from))
  const literalEnd = literalStart + jsonString(from).length
  const text =
    appJsonText.slice(0, literalStart) + jsonString(version) + appJsonText.slice(literalEnd)

  // 自校验:改后重新解析,除 expo.version 外必须与改前逐值一致 —— 替换点错位就拒绝写盘。
  let after
  try {
    after = JSON.parse(text)
  } catch (err) {
    return fail(
      `替换后 app.json 无法解析(替换点错位): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  const expected = JSON.parse(appJsonText)
  expected.expo.version = version
  if (canonical(after) !== canonical(expected)) {
    return fail('替换后 app.json 与期望对象不一致(替换点不唯一或错位)')
  }

  return { ok: true, changed: true, text, error: null, from, to: version }
}

/** 目标目录不在场(部分构建上下文,例如 Docker deps 阶段只 COPY 清单文件)⇒ 明确跳过,不制造假失败。 */
function targetsPresent() {
  return existsSync(PKG_PATH) && existsSync(APP_JSON_PATH)
}

function readInputs() {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'))
  const text = readFileSync(APP_JSON_PATH, 'utf8')
  return { version: pkg && pkg.version, text }
}

function main(argv = process.argv.slice(2)) {
  const check = argv.includes('--check')
  const asJson = argv.includes('--json')

  if (!targetsPresent()) {
    if (asJson)
      console.log(JSON.stringify({ ok: true, skipped: true, reason: 'apps/mobile-rn 清单不在场' }))
    else
      console.log(
        '[version-sync] 跳过:apps/mobile-rn 的 package.json/app.json 不在场(部分构建上下文)',
      )
    return 0
  }

  let inputs
  try {
    inputs = readInputs()
  } catch (err) {
    console.error(
      `[version-sync] ✗ 读输入失败: ${err instanceof Error ? err.message : String(err)}`,
    )
    return 2
  }

  const result = deriveAppJsonVersion(inputs.text, inputs.version)
  if (!result.ok) {
    console.error(`[version-sync] ✗ ${result.error}`)
    return 2
  }

  if (check) {
    if (result.changed) {
      if (asJson) {
        console.log(JSON.stringify({ ok: false, stale: true, from: result.from, to: result.to }))
      } else {
        console.error(
          `[version-sync] ✗ 派生值陈旧: apps/mobile-rn/app.json expo.version=${result.from} 而 package.json version=${result.to}`,
        )
        console.error(
          '[version-sync] 修法: node scripts/sync-mobile-app-json-version.mjs 后随同版本改动一并提交',
        )
      }
      return 1
    }
    if (asJson) console.log(JSON.stringify({ ok: true, stale: false, version: result.to }))
    else console.log(`[version-sync] ✓ app.json expo.version 与 package.json 一致: ${result.to}`)
    return 0
  }

  if (result.changed) {
    writeFileSync(APP_JSON_PATH, result.text, 'utf8')
    if (asJson)
      console.log(JSON.stringify({ ok: true, wrote: true, from: result.from, to: result.to }))
    else console.log(`[version-sync] ✓ 已写入 app.json expo.version: ${result.from} → ${result.to}`)
  } else {
    if (asJson) console.log(JSON.stringify({ ok: true, wrote: false, version: result.to }))
    else console.log(`[version-sync] ✓ 无需写入,已是 ${result.to}`)
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

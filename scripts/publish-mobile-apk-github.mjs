#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub Releases 下载腿(2026-11-18 立)
 *
 * ## 为什么需要这条腿
 *
 * 现有三条腿各有死结:
 *   · 站点腿(`www.aizhs.top/remote-images/download`,Cloudflare/EdgeOne)—— 稳定但对终端用户
 *     是单流低速(实测 EdgeOne 单流 0.28MB/s,80MB 包要 4.7 分钟);
 *   · Gitee 分片腿 —— 仓库是**全栈源码仓**且 private,附件对外一律 403(`EXIT_PRIVATE_REPO`);
 *     改 public 等于把整个 monorepo 历史提交暴露出去,不可接受;
 *   · OSS 快腿(`apk.aizhs.top`)—— 生产 `apps/ai-service/.env` 里 `OSS_ACCESS_KEY_ID` /
 *     `OSS_ACCESS_KEY_SECRET` / `OSS_BUCKET` **全是空值**(2026-11-18 逐行量过 len=0),
 *     即阿里云 AK 在整个系统里都不存在,不是"没回填本机"。
 *
 * GitHub 仓 `IHUI-INF-AI/IHUI-AI` 本身是 **public** 且已有正式 release,其 Releases 附件
 * 天然匿名可下载(实测匿名 HEAD 200 / 长度一致)、单附件上限 2GB、走全球 CDN —— 这是
 * **零新增凭据**就能拿到的第四条腿,既绕开 Gitee 的可见性决策,也不依赖阿里云 AK。
 *
 * ## 为什么用固定 tag 而不是 `/releases/latest/`
 *
 * `https://github.com/<o>/<r>/releases/latest/download/<name>` 只认**全仓最新一个** release
 * (按 created_at,且非 draft/prerelease)。同仓另有 `desktop-v*` 系列在发版,谁的 release
 * 建成时刻更晚,`latest` 就指向谁 —— 那会让手机端下载指针在 desktop 发版后直接 404。
 * 所以本腿钉**固定 tag** `mobile-apk-latest`(与 Gitee 腿的 `cnLegTag` 同名同义),下载地址
 * 恒为 `https://github.com/<o>/<r>/releases/download/mobile-apk-latest/<asset>`。
 *
 * ## 用法
 *
 *   node scripts/publish-mobile-apk-github.mjs --apk <path> [--version 0.0.30] [--version-code 26111807]
 *   node scripts/publish-mobile-apk-github.mjs --verify            # 只做匿名 HEAD 自证(不写)
 *   node scripts/publish-mobile-apk-github.mjs --self-test         # 纯函数夹具,不联网
 *
 * 令牌来源优先级:`GITHUB_TOKEN` → `GH_TOKEN` → `git credential fill`(host=github.com)。
 * 令牌**只走内存**,不落盘、不打印、不写日志。
 *
 * ## 退出码
 *
 *   0 = 已上传且匿名自证通过(或 `--verify` 自证通过)
 *   1 = 上传/自证失败
 *   2 = 未判定(缺输入:没 APK、没令牌、网络取不到)
 *
 * 上传后必跑匿名 HEAD 自证:长度必须等于本地 APK 字节数。**传上去但读不回来不算成功**。
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import https from 'node:https'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const EXIT = { ok: 0, fail: 1, undetermined: 2 }
export const OWNER = process.env.IHUI_GH_LEG_OWNER || 'IHUI-INF-AI'
export const REPO = process.env.IHUI_GH_LEG_REPO || 'IHUI-AI'
export const LEG_TAG = process.env.IHUI_GH_LEG_TAG || 'mobile-apk-latest'
export const LATEST_ASSET = 'ihui-ai-latest.apk'
export const API_HOST = 'api.github.com'
export const UPLOAD_HOST = 'uploads.github.com'
const UA = 'ihui-mobile-release-gh-leg'

export function legUrl(asset = LATEST_ASSET, { owner = OWNER, repo = REPO, tag = LEG_TAG } = {}) {
  return `https://github.com/${owner}/${repo}/releases/download/${tag}/${asset}`
}

export function versionedAssetName(version, versionCode) {
  const v = String(version || '').trim()
  if (!v) return null
  const c = versionCode === null || versionCode === undefined || versionCode === '' ? '' : `-${versionCode}`
  return `ihui-ai-${v}${c}.apk`
}

/** 令牌只进内存:环境变量优先,其次 git credential(绝不回显) */
export function readToken({ env = process.env, gitCred = true } = {}) {
  const fromEnv = (env.GITHUB_TOKEN || env.GH_TOKEN || '').trim()
  if (fromEnv) return { token: fromEnv, source: 'env' }
  if (!gitCred) return { token: null, source: 'none' }
  try {
    const out = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const m = out.match(/^password=(.+)$/m)
    const tok = m ? m[1].trim() : ''
    if (tok) return { token: tok, source: 'git-credential' }
  } catch {
    /* 取不到就是未判定,不回落空串 */
  }
  return { token: null, source: 'none' }
}

function httpsJson({ host, method, urlPath, token, body, timeoutMs = 60000 }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': UA, 'X-GitHub-Api-Version': '2022-11-28' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (payload) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = payload.length
    }
    const req = https.request({ host, method, path: urlPath, headers, timeout: timeoutMs }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (text += c))
      res.on('end', () => {
        let json = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = null
        }
        resolve({ status: res.statusCode, json, text })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error(`${method} ${urlPath} 超时`)))
    req.end(payload || undefined)
  })
}

function uploadAsset({ token, releaseId, name, file, timeoutMs = 900000 }) {
  return new Promise((resolve, reject) => {
    const size = statSync(file).size
    const req = https.request(
      {
        host: UPLOAD_HOST,
        method: 'POST',
        path: `/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': UA,
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': size,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (text += c))
        res.on('end', () => {
          let json = null
          try {
            json = text ? JSON.parse(text) : null
          } catch {
            json = null
          }
          resolve({ status: res.statusCode, json, text })
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error(`上传 ${name} 超时`)))
    const rs = createReadStream(file)
    rs.on('error', reject)
    rs.pipe(req)
  })
}

function headOnce(url, timeoutMs) {
  return new Promise((resolve) => {
    const u = new URL(url)
    const req = https.request(
      { method: 'HEAD', host: u.host, path: u.pathname + u.search, headers: { 'User-Agent': UA }, timeout: timeoutMs },
      (res) => {
        res.resume()
        const raw = res.headers['content-length']
        resolve({ status: res.statusCode, length: raw ? Number(raw) : null, location: res.headers.location || null })
      }
    )
    req.on('error', () => resolve({ status: 0, length: null, location: null }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ status: 0, length: null, location: null })
    })
    req.end()
  })
}

// GitHub release 附件下载不是直出:它先 302 到 `objects.githubusercontent.com`(或
// `github.com/.../releases/download` 同源跳转)。不跟随跳转就只会读到 302/length=0,
// 把"已上传且可匿名下载"误判成失败(2026-11-18 首次实测命中)。
async function headLen(url, timeoutMs = 120000, maxHops = 5) {
  let target = url
  for (let hop = 0; hop <= maxHops; hop += 1) {
    const r = await headOnce(target, timeoutMs)
    if (r.status >= 300 && r.status < 400 && r.location) {
      target = new URL(r.location, target).href
      continue
    }
    return { ...r, finalUrl: target }
  }
  return { status: 0, length: null, location: null, finalUrl: target }
}

export function parseArgs(argv) {
  const opts = { apk: null, version: null, versionCode: null, verify: false, selfTest: false, dryRun: false, withVersioned: false }
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i]
    if (k === '--apk') opts.apk = argv[++i] ?? null
    else if (k === '--version') opts.version = argv[++i] ?? null
    else if (k === '--version-code') opts.versionCode = argv[++i] ?? null
    else if (k === '--verify') opts.verify = true
    else if (k === '--self-test') opts.selfTest = true
    else if (k === '--dry-run') opts.dryRun = true
    else if (k === '--with-versioned') opts.withVersioned = true
    else if (k.startsWith('--')) throw new Error(`未知参数 ${k}`)
  }
  return opts
}

/** 确保固定 tag 的 release 存在(不存在则建;存在则把标题/说明改到当前版本) */
async function ensureRelease({ token, version, versionCode, dryRun }) {
  const got = await httpsJson({ host: API_HOST, method: 'GET', urlPath: `/repos/${OWNER}/${REPO}/releases/tags/${LEG_TAG}`, token })
  if (got.status === 200 && got.json) return { release: got.json, created: false }
  if (got.status !== 404) throw new Error(`读 release 失败 status=${got.status} ${got.text.slice(0, 200)}`)
  if (dryRun) return { release: null, created: true }
  const title = version ? `IHUI Mobile ${version}${versionCode ? ` / ${versionCode}` : ''}` : 'IHUI Mobile APK (latest)'
  const body = [
    'Android 直装包(gh 腿)。固定 tag:`' + LEG_TAG + '`,每次发版替换同名附件。',
    version ? `- version: ${version}` : null,
    versionCode ? `- versionCode: ${versionCode}` : null,
    '',
    '下载:`' + legUrl() + '`',
  ]
    .filter((x) => x !== null)
    .join('\n')
  const created = await httpsJson({
    host: API_HOST,
    method: 'POST',
    urlPath: `/repos/${OWNER}/${REPO}/releases`,
    token,
    body: { tag_name: LEG_TAG, name: title, body, draft: false, prerelease: false },
  })
  if (created.status !== 201 || !created.json) throw new Error(`建 release 失败 status=${created.status} ${created.text.slice(0, 300)}`)
  return { release: created.json, created: true }
}

async function replaceAsset({ token, releaseId, name, file, dryRun }) {
  const list = await httpsJson({ host: API_HOST, method: 'GET', urlPath: `/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?per_page=100`, token })
  if (list.status !== 200) throw new Error(`列附件失败 status=${list.status}`)
  const dup = (list.json || []).filter((a) => a.name === name)
  for (const a of dup) {
    if (dryRun) continue
    const del = await httpsJson({ host: API_HOST, method: 'DELETE', urlPath: `/repos/${OWNER}/${REPO}/releases/assets/${a.id}`, token })
    if (del.status !== 204) throw new Error(`删旧附件 ${name} 失败 status=${del.status}`)
  }
  if (dryRun) return { uploaded: false, size: statSync(file).size }
  const up = await uploadAsset({ token, releaseId, name, file })
  if (up.status !== 201) throw new Error(`上传 ${name} 失败 status=${up.status} ${up.text.slice(0, 300)}`)
  return { uploaded: true, size: statSync(file).size, id: up.json?.id }
}

function selfTest() {
  const rows = []
  const expect = (name, fn) => {
    try {
      const got = fn()
      rows.push({ name, ok: got === true, detail: got === true ? '' : `got=${JSON.stringify(got)}` })
    } catch (e) {
      rows.push({ name, ok: false, detail: e.message })
    }
  }
  expect('leg-url-fixed-tag', () => legUrl() === `https://github.com/${OWNER}/${REPO}/releases/download/${LEG_TAG}/${LATEST_ASSET}`)
  expect('leg-url-versioned', () => legUrl('a.apk').endsWith('/a.apk'))
  expect('versioned-name', () => versionedAssetName('0.0.30', '26111807') === 'ihui-ai-0.0.30-26111807.apk')
  expect('versioned-name-nocode', () => versionedAssetName('0.0.30', null) === 'ihui-ai-0.0.30.apk')
  expect('versioned-name-empty', () => versionedAssetName('', '1') === null)
  expect('token-from-env', () => readToken({ env: { GITHUB_TOKEN: 'x' }, gitCred: false }).source === 'env')
  expect('token-none', () => readToken({ env: {}, gitCred: false }).source === 'none')
  expect('args-verify', () => parseArgs(['--verify']).verify === true)
  expect('args-apk', () => parseArgs(['--apk', 'a.apk']).apk === 'a.apk')
  expect('args-unknown-throw', () => {
    try {
      parseArgs(['--nope'])
      return false
    } catch {
      return true
    }
  })
  const bad = rows.filter((r) => !r.ok)
  for (const r of rows) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  console.log(`SELF-TEST ${bad.length === 0 ? 'ok' : 'fail'} ${rows.length - bad.length}/${rows.length}`)
  return bad.length === 0 ? EXIT.ok : EXIT.fail
}

async function main(argv) {
  const opts = parseArgs(argv)
  if (opts.selfTest) return selfTest()

  if (opts.verify) {
    const r = await headLen(legUrl())
    console.log(`[gh-leg] 匿名 HEAD ${legUrl()}`)
    console.log(`[gh-leg] status=${r.status} length=${r.length}`)
    return r.status === 200 && r.length ? EXIT.ok : EXIT.undetermined
  }

  if (!opts.apk || !existsSync(opts.apk)) {
    console.error(`[gh-leg] 未判定:缺 --apk 或文件不存在 (${opts.apk || 'null'})`)
    return EXIT.undetermined
  }
  const size = statSync(opts.apk).size
  if (size <= 0) {
    console.error('[gh-leg] 未判定:APK 空文件')
    return EXIT.undetermined
  }

  const { token, source } = readToken()
  if (!token) {
    console.error('[gh-leg] 未判定:取不到 GitHub 令牌(设 GITHUB_TOKEN 或让 git credential 覆盖 github.com)')
    return EXIT.undetermined
  }

  console.log(`[gh-leg] apk=${path.basename(opts.apk)} size=${(size / 1048576).toFixed(1)}MB token来源=${source}`)
  const { release, created } = await ensureRelease({ token, version: opts.version, versionCode: opts.versionCode, dryRun: opts.dryRun })
  console.log(`[gh-leg] release tag=${LEG_TAG} ${created ? '新建' : '已有'} id=${release?.id ?? '(dry-run)'}`)

  const names = [LATEST_ASSET]
  const vName = versionedAssetName(opts.version, opts.versionCode)
  if (opts.withVersioned && vName) names.push(vName)
  if (opts.dryRun) {
    console.log(`[gh-leg] dry-run: 将替换附件 ${names.join(', ')}`)
    return EXIT.ok
  }

  for (const name of names) {
    const r = await replaceAsset({ token, releaseId: release.id, name, file: opts.apk, dryRun: false })
    console.log(`[gh-leg] 已上传 ${name} ${(r.size / 1048576).toFixed(1)}MB id=${r.id}`)
  }

  const proof = await headLen(legUrl())
  console.log(`[gh-leg] 匿名自证 HEAD status=${proof.status} length=${proof.length} (本地 ${size})`)
  if (proof.status !== 200 || proof.length !== size) {
    console.error(`[gh-leg] 自证失败:匿名读回与本地不一致(url=${legUrl()})`)
    return EXIT.fail
  }
  console.log(`[gh-leg] ✅ 腿可用 ${legUrl()}`)
  return EXIT.ok
}

const isDirectRun = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((rc) => {
      process.exitCode = rc
    })
    .catch((e) => {
      console.error(`[gh-leg] ${e.message}`)
      process.exitCode = EXIT.fail
    })
}

export const __test__ = { readToken, versionedAssetName, legUrl, parseArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

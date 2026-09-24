#!/usr/bin/env node
/* eslint-disable no-console -- 发布脚本为 CLI 工具,需 console 输出诊断信息 */
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * generate-latest-json.mjs — 聚合多平台 .sig 文件生成 Tauri updater latest.json
 * v0.1.14 — retry round 8
 *
 * 背景:tauri-action 在多平台矩阵构建时,每个 job 只生成当前平台的 latest.json
 * 并上传到 Release,后上传的会覆盖先上传的,最终 latest.json 只包含最后一个平台。
 * 本脚本在所有平台构建完成后运行,从 Release assets 收集所有 .sig 文件和对应
 * 安装包,生成包含全部平台的统一 latest.json。
 *
 * 用法(在 GitHub Actions workflow 中):
 *   node scripts/generate-latest-json.mjs
 *
 * 环境变量:
 *   GITHUB_TOKEN      — GitHub API token(workflow 自动注入 ${{ secrets.GITHUB_TOKEN }})
 *   GITHUB_REPOSITORY — owner/repo(workflow 自动注入)
 *   RELEASE_TAG       — Release tag name(如 desktop-v0.1.14)
 */

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPOSITORY
const tag = process.env.RELEASE_TAG
const FEED_TAG = 'desktop-updater-feed'

if (!token || !repo || !tag) {
  console.error('Missing required env: GITHUB_TOKEN, GITHUB_REPOSITORY, RELEASE_TAG')
  process.exit(1)
}

// 从 tag 提取版本号(desktop-v0.1.14 → 0.1.14)
const version = tag.replace(/^desktop-v/, '')
if (!version || version === tag) {
  console.error(`Cannot extract version from tag: ${tag}`)
  process.exit(1)
}

const apiHeaders = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

/** 带 rate limit handling 的 GitHub API 调用，403 时自动 exponential backoff 重试 */
async function githubApi(path, init, attempt = 0) {
  const MAX_RETRIES = 5
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...apiHeaders, ...(init?.headers || {}) },
  })
  if (res.status === 403) {
    const retryAfter = res.headers.get('Retry-After')
    const waitMs = retryAfter
      ? parseInt(retryAfter) * 1000
      : Math.min(1000 * Math.pow(2, attempt), 30000)
    if (attempt < MAX_RETRIES) {
      console.log(
        `[api] 403 rate limited, waiting ${waitMs}ms before retry (attempt ${attempt + 1}/${MAX_RETRIES})...`,
      )
      await new Promise((r) => setTimeout(r, waitMs))
      return githubApi(path, init, attempt + 1)
    }
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API ${path} failed: ${res.status} ${text}`)
  }
  // 204 No Content / HEAD 等无 body 响应直接返回 undefined，避免 JSON.parse('') 报错
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined
  return res.json()
}

// 单版本 4 平台标准产出(不含 latest.json):windows(4)+linux(6)+macos×2(3+3)=16
// 注意:历史 Release 可能累积旧版本残留文件(如 desktop-v0.1.14 同时含 0.1.13 残留共 29),
// 阈值须基于「单版本干净产出」设定,勿按累积 Release 设高 ——否则干净的单版本发布会因
// assets<阈值被误判未就绪而等待 12 次超时失败(2026-09-01 实证:0.1.15 单版本仅 17 assets 却卡死)
// 2026-09-17:矩阵 4→3 job(macOS Universal 合并 arm64+Intel)后单版本产出 = exe+sig(2) +
// AppImage+deb+sig(3~4) + universal dmg+app.tar.gz+sig(3) ≈ 9~10 资产/3 签名。
const EXPECTED_MIN_ASSETS = 8
const EXPECTED_MIN_SIGS = 3
/** 等待 release assets 达到预期数量,防止竞态条件导致 sig 文件未上传完成 */
async function waitForRelease(
  tag,
  expectedMinAssets = EXPECTED_MIN_ASSETS,
  maxRetries = 36,
  retryInterval = 15000,
) {
  for (let i = 0; i < maxRetries; i++) {
    const release = await githubApi(`/repos/${repo}/releases/tags/${tag}`)
    const sigCount = release.assets.filter((a) => a.name.endsWith('.sig')).length
    console.log(
      `[poll] Attempt ${i + 1}/${maxRetries}: release has ${release.assets.length} assets, ${sigCount} sig files`,
    )
    if (release.assets.length >= expectedMinAssets && sigCount >= EXPECTED_MIN_SIGS) {
      console.log(`[poll] Release ready: ${release.assets.length} assets, ${sigCount} sig files`)
      return release
    }
    if (i < maxRetries - 1) {
      console.log(`[poll] Waiting ${retryInterval / 1000}s for assets to finish uploading...`)
      await new Promise((resolve) => setTimeout(resolve, retryInterval))
    }
  }
  // 超时:输出实际资产清单辅助诊断(2026-09-16:run#41 失败时无任何资产可见性,无法定位是上传慢还是上传缺)
  const release = await githubApi(`/repos/${repo}/releases/tags/${tag}`).catch(() => null)
  const names = release ? release.assets.map((a) => a.name) : []
  console.error(`[poll] Assets at timeout (${names.length}):`)
  for (const n of names) console.error(`  - ${n}`)
  throw new Error(
    `Release assets not ready after ${maxRetries} retries (waited ~${Math.round((maxRetries * retryInterval) / 1000)}s). Expected >= ${expectedMinAssets} assets / ${EXPECTED_MIN_SIGS} sigs.`,
  )
}

// 平台判定/择优/URL 白名单/歧义探测的唯一真相源在 scripts/lib/tauri-updater-platforms.mjs
// (站点 feed 快照 scripts/resolve-desktop-download.mjs 与本脚本共用同一份,不得在此二次实现)。
import {
  inferPlatform,
  buildUpdaterPlatforms,
  findPlatformAmbiguity,
} from './lib/tauri-updater-platforms.mjs'

/**
 * 采集 Release 里「有配套 .sig ∧ 平台可判定 ∧ 签名非空」的产物条目。
 * 只负责 IO,择优与建表一律交给共享判据 —— 本脚本自行 shouldReplace 会造出第二份真相,
 * 而那份历史上就没有 URL 白名单与稳定键序(2026-09-24 登记的未闭环 ④)。
 */
async function collectUpdaterEntries(release) {
  const entries = []
  for (const asset of release.assets) {
    if (!asset.name.endsWith('.sig')) continue
    if (!inferPlatform(asset.name)) {
      console.warn(`Skip unknown platform sig: ${asset.name}`)
      continue
    }
    // 签名对象是安装包本身:去 .sig 后缀即配套产物名(dmg 无 sig,天然不进入)
    const pkgName = asset.name.replace(/\.sig$/, '')
    const urlAsset = release.assets.find((a) => a.name === pkgName)
    if (!urlAsset) {
      console.warn(`Corresponding asset not found for ${asset.name}: ${pkgName}`)
      continue
    }
    // 下载 .sig 文件内容(公开 repo 可直接 fetch,私有 repo 需带 token)
    const sigRes = await fetch(asset.browser_download_url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!sigRes.ok) {
      console.warn(`Failed to download sig ${asset.name}: ${sigRes.status}`)
      continue
    }
    const signature = (await sigRes.text()).trim()
    if (!signature) {
      console.warn(`Skip empty signature: ${asset.name}`)
      continue
    }
    entries.push({ name: pkgName, url: urlAsset.browser_download_url, signature })
    console.log(`Collected candidate: ${pkgName}`)
  }
  return entries
}

async function main() {
  // 1. 等待 release assets 全部上传完成(防止竞态条件)
  console.log('Waiting for release assets to be ready...')
  const release = await waitForRelease(tag)
  console.log(`Release: ${release.name} (id=${release.id}, assets=${release.assets.length})`)

  // 2. 采集候选产物 → 共享判据建表(同平台多产物按 PLATFORM_PRIORITY 择优,版本匹配压残留)
  const entries = await collectUpdaterEntries(release)

  // 归属只由采集顺序决定的争抢必须喊出来:那种 feed 看起来完全正常,
  // 却可能把平台键锁到旧签名(2026-09-24 Gitee 双 exe 实案)。
  for (const a of findPlatformAmbiguity(entries, { version })) {
    console.warn(
      `[latest.json] ⚠ 平台键歧义 ${a.platform}:保留 ${a.kept},弃 ${a.dropped}` +
        `(两者签名不同、优先级相同 —— 请清掉多余产物,勿依赖采集顺序)`,
    )
  }
  const platforms = buildUpdaterPlatforms(entries, { version })

  if (Object.keys(platforms).length === 0) {
    console.error(`No valid platform sigs found (${entries.length} candidates collected):`)
    for (const e of entries) console.error(`  - ${e.name} ${e.url}`)
    process.exit(1)
  }

  // 3. 生成 latest.json
  const latestJson = {
    version,
    notes: release.body || `IHUI AI Desktop ${version}`,
    pub_date: new Date().toISOString(),
    platforms,
  }

  const jsonStr = JSON.stringify(latestJson, null, 2)
  console.log('Generated latest.json:')
  console.log(jsonStr)

  // 4. 上传到发版 Release
  await uploadLatestJson(release, jsonStr)

  // 5. 同步到固定 feed release(updater endpoint 指向它;首次运行自动创建)
  const feedRelease = await ensureFeedRelease()
  await uploadLatestJson(feedRelease, jsonStr)
}

/** 删除指定 release 上的旧 latest.json 并上传新内容 */
async function uploadLatestJson(release, jsonStr) {
  const oldAsset = release.assets.find((a) => a.name === 'latest.json')
  if (oldAsset) {
    await githubApi(`/repos/${repo}/releases/assets/${oldAsset.id}`, { method: 'DELETE' })
    console.log(`Deleted old latest.json (id=${oldAsset.id}) from release ${release.tag_name}`)
  }

  const uploadUrl = release.upload_url.replace('{?name,label}', '?name=latest.json')
  const buffer = Buffer.from(jsonStr, 'utf-8')
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...apiHeaders,
      'Content-Type': 'application/json',
      'Content-Length': buffer.length,
    },
    body: buffer,
  })
  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    throw new Error(`Upload latest.json to ${release.tag_name} failed: ${uploadRes.status} ${text}`)
  }
  console.log(`Uploaded latest.json to release ${release.tag_name} successfully`)
}

/** 获取固定 feed release;不存在则自动创建(tag 挂在默认分支) */
async function ensureFeedRelease() {
  try {
    return await githubApi(`/repos/${repo}/releases/tags/${FEED_TAG}`)
  } catch (err) {
    if (!/\b404\b/.test(String(err))) throw err
    console.log(`Feed release ${FEED_TAG} not found, creating...`)
    return githubApi(`/repos/${repo}/releases`, {
      method: 'POST',
      body: JSON.stringify({
        tag_name: FEED_TAG,
        name: 'Desktop Updater Feed',
        body: '桌面端自动更新 feed,由 release-desktop workflow 自动维护,请勿手动修改。latest.json 始终指向最新桌面版。',
        draft: false,
        prerelease: false,
      }),
    })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

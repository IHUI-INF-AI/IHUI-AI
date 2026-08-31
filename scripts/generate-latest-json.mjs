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
    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000)
    if (attempt < MAX_RETRIES) {
      console.log(`[api] 403 rate limited, waiting ${waitMs}ms before retry (attempt ${attempt + 1}/${MAX_RETRIES})...`)
      await new Promise(r => setTimeout(r, waitMs))
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

/** 等待 release assets 达到预期数量,防止竞态条件导致 sig 文件未上传完成 */
async function waitForRelease(tag, expectedMinAssets = 20, maxRetries = 12, retryInterval = 10000) {
  for (let i = 0; i < maxRetries; i++) {
    const release = await githubApi(`/repos/${repo}/releases/tags/${tag}`)
    const sigCount = release.assets.filter(a => a.name.endsWith('.sig')).length
    console.log(`[poll] Attempt ${i + 1}/${maxRetries}: release has ${release.assets.length} assets, ${sigCount} sig files`)
    if (release.assets.length >= expectedMinAssets && sigCount >= 8) {
      console.log(`[poll] Release ready: ${release.assets.length} assets, ${sigCount} sig files`)
      return release
    }
    if (i < maxRetries - 1) {
      console.log(`[poll] Waiting ${retryInterval / 1000}s for assets to finish uploading...`)
      await new Promise(resolve => setTimeout(resolve, retryInterval))
    }
  }
  throw new Error(`Release assets not ready after ${maxRetries} retries. Expected >= ${expectedMinAssets} assets, got what was available.`)
}

// 根据 .sig 文件名推断 Tauri updater 平台标识 + 产物类型(kind)。
// 同一平台存在多种安装包(如 Windows 的 exe/msi,Linux 的 AppImage/deb/rpm)时,
// 由 PLATFORM_PRIORITY 决定写入 latest.json 的优先级,避免后遍历者覆盖先遍历者。
const PLATFORM_PRIORITY = {
  'windows-x86_64': { exe: 10, msi: 5 },
  'linux-x86_64': { AppImage: 10, deb: 7, rpm: 5 },
}

function inferPlatform(sigName) {
  // Windows: exe.sig / msi.sig — 优先 NSIS exe(与 tauri-action updaterJsonPreferNsis 语义一致),
  // MSI 仅作为无 exe 时的 fallback(MSI 需管理员权限且 NSIS/MSI 安装类型混用有已知坑)。
  if (sigName.endsWith('.exe.sig')) return { platform: 'windows-x86_64', kind: 'exe' }
  if (sigName.endsWith('.msi.sig')) return { platform: 'windows-x86_64', kind: 'msi' }
  // macOS: app.tar.gz.sig (aarch64 or x64)
  if (sigName.endsWith('.app.tar.gz.sig')) {
    if (sigName.includes('aarch64') || sigName.includes('arm64')) return { platform: 'darwin-aarch64', kind: 'app' }
    return { platform: 'darwin-x86_64', kind: 'app' }
  }
  // Linux: AppImage.sig / deb.sig / rpm.sig — 优先 AppImage(通用性最高,无需系统包管理器)
  if (sigName.endsWith('.AppImage.sig')) return { platform: 'linux-x86_64', kind: 'AppImage' }
  if (sigName.endsWith('.deb.sig')) return { platform: 'linux-x86_64', kind: 'deb' }
  if (sigName.endsWith('.rpm.sig')) return { platform: 'linux-x86_64', kind: 'rpm' }
  return null
}

/**
 * 判断新产物是否应替换已有平台条目。
 * 规则(按优先级):
 *  1. 产物版本与 release 版本(tag 提取)匹配的优先——同一 release 可能混有历史版本产物
 *     (如 desktop-v0.1.14 资产中残留 0.1.13 的 exe/msi),必须选与 version 一致的;
 *  2. 版本匹配相同时,按 PLATFORM_PRIORITY 择优(exe > msi,AppImage > deb > rpm);
 *  3. 单产物平台(如 darwin app),保留首个。
 * @param {string} platform
 * @param {string} newKind
 * @param {boolean} newVerMatch - 新产物文件名是否含 release 版本号
 * @param {string | undefined} existingKind
 * @param {boolean} existingVerMatch - 现有产物文件名是否含 release 版本号
 * @returns {boolean} true 表示写入新条目
 */
function shouldReplacePlatform(platform, newKind, newVerMatch, existingKind, existingVerMatch) {
  if (!existingKind) return true
  // 版本匹配不一致时:优先版本匹配的产物(与 latest.json 的 version 保持一致)
  if (newVerMatch !== existingVerMatch) return newVerMatch
  const priority = PLATFORM_PRIORITY[platform]
  if (!priority) return false // 单产物平台(如 darwin),保留首个
  return (priority[newKind] ?? 0) > (priority[existingKind] ?? 0)
}

/**
 * 从安装包文件名提取 SemVer 版本号(如 "IHUI.AI_0.1.14_x64-setup.exe" → "0.1.14")。
 * @param {string} assetName
 * @returns {string | null}
 */
function extractVersion(assetName) {
  const m = assetName.match(/(\d+\.\d+\.\d+)/)
  return m ? m[1] : null
}

async function main() {
  // 1. 等待 release assets 全部上传完成(防止竞态条件)
  console.log('Waiting for release assets to be ready...')
  const release = await waitForRelease(tag)
  console.log(`Release: ${release.name} (id=${release.id}, assets=${release.assets.length})`)

  // 2. 遍历 .sig 文件,收集各平台 signature + url。
  //    同平台多产物时优先版本匹配(release 版本)的,其次按 PLATFORM_PRIORITY 择优。
  const platforms = {}
  const platformKinds = {}
  const platformVerMatch = {}
  for (const asset of release.assets) {
    if (!asset.name.endsWith('.sig')) continue
    const inferred = inferPlatform(asset.name)
    if (!inferred) {
      console.warn(`Skip unknown platform sig: ${asset.name}`)
      continue
    }
    const { platform, kind } = inferred
    // 安装包文件名(去 .sig 后缀)中的版本号,用于版本匹配判断
    const pkgName = asset.name.replace(/\.sig$/, '')
    const assetVersion = extractVersion(pkgName)
    const verMatch = assetVersion === version
    // 同平台已有更高优先级产物时跳过(如已有 0.1.14 exe 时忽略 msi/旧版 exe)
    if (!shouldReplacePlatform(platform, kind, verMatch, platformKinds[platform], platformVerMatch[platform])) {
      console.log(`Skip lower-priority sig: ${asset.name} (platform=${platform}, kind=${kind}, verMatch=${verMatch}, existing=${platformKinds[platform] ?? 'none'}/${platformVerMatch[platform] ?? 'none'})`)
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

    // 找到对应的安装包文件(去掉 .sig 后缀)
    const urlAsset = release.assets.find((a) => a.name === pkgName)
    if (!urlAsset) {
      console.warn(`Corresponding asset not found for ${asset.name}: ${pkgName}`)
      continue
    }

    platforms[platform] = {
      signature,
      url: urlAsset.browser_download_url,
    }
    platformKinds[platform] = kind
    platformVerMatch[platform] = verMatch
    console.log(`Added platform ${platform} (${kind}, verMatch=${verMatch}): ${urlAsset.name}`)
  }

  if (Object.keys(platforms).length === 0) {
    console.error('No valid platform sigs found')
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

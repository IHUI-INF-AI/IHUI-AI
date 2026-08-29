#!/usr/bin/env node
/**
 * generate-latest-json.mjs — 聚合多平台 .sig 文件生成 Tauri updater latest.json
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
 *   RELEASE_TAG       — Release tag name(如 desktop-v0.1.13)
 */

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPOSITORY
const tag = process.env.RELEASE_TAG

if (!token || !repo || !tag) {
  console.error('Missing required env: GITHUB_TOKEN, GITHUB_REPOSITORY, RELEASE_TAG')
  process.exit(1)
}

// 从 tag 提取版本号(desktop-v0.1.13 → 0.1.13)
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

async function githubApi(path, init) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...apiHeaders, ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API ${path} failed: ${res.status} ${text}`)
  }
  return res.json()
}

// 根据 .sig 文件名推断 Tauri updater 平台标识
function inferPlatform(sigName) {
  if (sigName.endsWith('.msi.zip.sig')) return 'windows-x86_64'
  if (sigName.endsWith('.app.tar.gz.sig')) {
    if (sigName.includes('aarch64') || sigName.includes('arm64')) return 'darwin-aarch64'
    return 'darwin-x86_64'
  }
  if (sigName.endsWith('.AppImage.tar.gz.sig')) return 'linux-x86_64'
  return null
}

async function main() {
  // 1. 获取 Release
  const release = await githubApi(`/repos/${repo}/releases/tags/${tag}`)
  console.log(`Release: ${release.name} (id=${release.id}, assets=${release.assets.length})`)

  // 2. 遍历 .sig 文件,收集各平台 signature + url
  const platforms = {}
  for (const asset of release.assets) {
    if (!asset.name.endsWith('.sig')) continue
    const platform = inferPlatform(asset.name)
    if (!platform) {
      console.warn(`Skip unknown platform sig: ${asset.name}`)
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
    const urlAssetName = asset.name.replace(/\.sig$/, '')
    const urlAsset = release.assets.find((a) => a.name === urlAssetName)
    if (!urlAsset) {
      console.warn(`Corresponding asset not found for ${asset.name}: ${urlAssetName}`)
      continue
    }

    platforms[platform] = {
      signature,
      url: urlAsset.browser_download_url,
    }
    console.log(`Added platform ${platform}: ${urlAsset.name}`)
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

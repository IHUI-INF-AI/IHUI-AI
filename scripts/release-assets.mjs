// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 发布资产准备器(O14:SDK 真正发布)—— 只做"本地可复现产物 + 真实 sha256 + 命令清单",
// 绝不 push / 绝不 tag / 绝不 gh release create。所有写操作只落在 .ihui-agent/tmp/o14-prep/。
//
// 用法:
//   node scripts/release-assets.mjs                  # 从当前 HEAD 构建资产 + 打印 gh 命令
//   node scripts/release-assets.mjs --ref <sha|tag>  # 指定 tree-ish(默认 HEAD)
//   node scripts/release-assets.mjs --print-only     # 只打印计划与命令,不写文件
//
// 为什么用 git archive:产物只来自 commit 的 tree,**免疫工作区里几十个他人在途脏文件**;
// 实测同一 commit 连续两次 `git archive --format=tar.gz` 字节完全一致(gzip 头不含时间戳)。

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(REPO_ROOT, '.ihui-agent', 'tmp', 'o14-prep', 'assets')
const NOTES_FILE = join(REPO_ROOT, '.ihui-agent', 'tmp', 'o14-prep', 'release-notes.md')
const REPO_SLUG = 'IHUI-INF-AI/IHUI-AI'

/** 与 check-stale-stashes.mjs 同款:Windows 下直调 cmd\git.exe,绕开 MSYS shim。 */
const GIT_BIN = (() => {
  if (process.platform !== 'win32') return 'git'
  try {
    const whereOut = execFileSync('where', ['git'], { encoding: 'utf8', windowsHide: true })
    for (const raw of whereOut.split('\n')) {
      if (/\\cmd\\git\.exe$/i.test(raw.trim())) return raw.trim()
    }
    for (const raw of whereOut.split('\n')) {
      const p = raw.trim()
      if (/git\.exe$/i.test(p) && !/\\usr\\bin\\/i.test(p)) return p
    }
  } catch {
    /* where 失败回退裸 git */
  }
  return 'git'
})()

function git(args, allowFail = false) {
  const r = spawnSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', REPO_ROOT, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
  if (r.status !== 0) {
    if (allowFail) return null
    throw new Error(`git ${args.join(' ')} 失败: ${r.stderr || r.stdout || String(r.status)}`)
  }
  return (r.stdout ?? '').trim()
}

function readJson(relPath) {
  return JSON.parse(readFileSync(join(REPO_ROOT, relPath), 'utf8'))
}

/** release-sdk.yml 的 extract job 同款剥前缀规则(见该文件 L100)。 */
export function semverFromTag(tag) {
  return tag.replace(/^sdk-v/, '').replace(/^v/, '')
}

/**
 * Go 子目录模块的 tag 前缀 = 模块路径去掉仓库根前缀后的**完整剩余路径**。
 * 实证:github.com/open-telemetry/opentelemetry-go-contrib/instrumentation/github.com/gorilla/mux/otelmux
 * 的版本来自 tag `instrumentation/github.com/gorilla/mux/otelmux/v0.71.0`(多级斜杠,不是 otelmux/v…)。
 */
export function moduleTagFor(modulePath, repoPrefix, version) {
  if (!modulePath.startsWith(`${repoPrefix}/`)) {
    throw new Error(`模块路径 ${modulePath} 不在仓库前缀 ${repoPrefix} 下,Go 无法按 tag 解析`)
  }
  return `${modulePath.slice(repoPrefix.length + 1)}/v${version}`
}

/** 从 go.mod 读 module 路径(文件带零宽水印行,必须逐行过滤)。 */
export function parseGoModule(gomodText) {
  for (const line of gomodText.split('\n')) {
    const m = /^module\s+(\S+)\s*$/.exec(line.trim())
    if (m) return m[1]
  }
  throw new Error('go.mod 未找到 module 行')
}

/** 挂在 GitHub Release 上的资产清单:文件名 + tar 内前缀 + git archive 的 pathspec。 */
export function assetSpecs(sdkVersion, cliVersion) {
  return [
    { file: `ihui-sdk-ts-${sdkVersion}.tar.gz`, prefix: `ihui-sdk-ts-${sdkVersion}/`, paths: ['packages/sdk', ':!packages/sdk/go', ':!packages/sdk/python', ':!packages/sdk/java', ':!packages/sdk/dotnet'] },
    { file: `ihui-sdk-go-v${sdkVersion}.tar.gz`, prefix: `ihui-sdk-go-v${sdkVersion}/`, paths: ['packages/sdk/go'] },
    { file: `ihui-sdk-python-${sdkVersion}.tar.gz`, prefix: `ihui-sdk-python-${sdkVersion}/`, paths: ['packages/sdk/python'] },
    { file: `ihui-sdk-java-${sdkVersion}.tar.gz`, prefix: `ihui-sdk-java-${sdkVersion}/`, paths: ['packages/sdk/java'] },
    { file: `ihui-sdk-dotnet-${sdkVersion}.tar.gz`, prefix: `ihui-sdk-dotnet-${sdkVersion}/`, paths: ['packages/sdk/dotnet'] },
    // 与 deploy/homebrew/ihui.rb 的 url 逐字符串同名(注意:CI 不产出此名,见报告结论)
    { file: `ihui-src-${cliVersion}.tar.gz`, prefix: `ihui-src-${cliVersion}/`, paths: ['apps/cli'] },
  ]
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function buildAsset(spec, ref) {
  const target = join(OUT_DIR, spec.file)
  git(['archive', `--format=tar.gz`, `--prefix=${spec.prefix}`, `-o`, target, ref, '--', ...spec.paths])
  if (!existsSync(target)) throw new Error(`git archive 未产出 ${target}`)
  return { ...spec, path: target, sha256: sha256File(target), bytes: readFileSync(target).byteLength }
}

function buildNotes(sdkVersion, goTag, cliVersion, ref, rows) {
  return [
    `# IHUI AI SDK ${sdkVersion}`,
    '',
    `> 构建自 commit \`${ref}\`(git archive 产物,与工作区脏文件无关)。`,
    '',
    '## 本次真正发布 / 未发布',
    '',
    '| 通道 | 状态 | 说明 |',
    '| --- | --- | --- |',
    `| Go module | ✅ 可 go get | tag \`${goTag}\`(Go 子目录模块必须带完整子路径前缀) |`,
    '| npm `@ihui/sdk` | ❌ 未发布 | 缺 NPM_TOKEN / 首包无法走 OIDC,见 docs/RELEASE.md |',
    '| PyPI `ihui-ai` | ❌ 未发布 | 缺 PYPI_TOKEN |',
    '| Maven `com.ihui:ihui-ai-java` | ❌ 未发布 | 缺 MAVEN_USERNAME / MAVEN_TOKEN |',
    '| .NET | ❌ 无通道 | 仓库未配 NuGet 发布 workflow |',
    '',
    '## 资产 sha256(与 Release 附件一一对应)',
    '',
    '| 文件 | 字节 | sha256 |',
    '| --- | --- | --- |',
    ...rows.map((r) => `| ${r.file} | ${r.bytes} | \`${r.sha256}\` |`),
    '',
    `## CLI(另一条发布线,当前未发)`,
    '',
    `- \`cli-v${cliVersion}\` 尚未打过;Homebrew / winget / scoop 三个 manifest 全部指向该 release,`,
    '  且 sha 均为占位 `0000…`,在该 release 真实产出前不得填。',
    '',
  ].join('\n')
}

function printCommands({ sdkVersion, cliVersion, goTag, tag, ref, rows }) {
  console.log('\n=== 主 agent 执行序列(本脚本一律不执行)===\n')
  console.log(`# 0) 预检:确认 origin 无同名 tag、工作区只读命令可用`)
  console.log(`git ls-remote --tags origin "refs/tags/${tag}" "refs/tags/${goTag}"`)
  console.log(`node scripts/git-lock.mjs check`)
  console.log(`\n# 1) 打 tag 并推送(Go 模块真正生效的是 ${goTag})`)
  console.log(`git tag -a ${tag} ${ref} -m "SDK ${sdkVersion}(source assets)"`)
  console.log(`git tag -a ${goTag} ${ref} -m "Go module ${sdkVersion}"`)
  console.log(`git push origin "refs/tags/${tag}:refs/tags/${tag}" "refs/tags/${goTag}:refs/tags/${goTag}"`)
  console.log(`node scripts/git-refs-heal.mjs   # 嵌套 tag(refs/tags/${goTag})本地必被宿主清理,固化进 packed-refs`)
  console.log(`\n# 2) 建 GitHub Release + 附件(附件名与 sha 必须与本脚本产物一致)`)
  for (const r of rows) console.log(`#   ${r.file}  ${r.sha256}`)
  const assetArgs = rows.map((r) => `"${r.path}"`).join(' \\\n  ')
  console.log(`gh release create ${tag} \\\n  --repo ${REPO_SLUG} \\\n  --target ${ref} \\\n  --verify-tag \\\n  --title "IHUI AI SDK ${sdkVersion}" \\\n  --notes-file "${NOTES_FILE}" \\\n  ${assetArgs}`)
  console.log(`\n# 3) 回读校验(全绿才算发布完成)`)
  console.log(`gh release view ${tag} --repo ${REPO_SLUG} --json tagName,isDraft,assets --jq '{tag:.tagName,draft:.isDraft,assets:[.assets[].name]}'`)
  console.log(`curl -fsSI "https://github.com/${REPO_SLUG}/releases/download/${tag}/${rows[0].file}" | head -5`)
  console.log(`git ls-remote --tags origin "refs/tags/${goTag}"   # 必须返回 sha == ${ref}`)
  console.log(`GOPROXY=https://proxy.golang.org,direct go list -m -versions github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go   # 收录后须含 v${sdkVersion}`)
  console.log(`# 兜底(不经代理,直连仓库):GOPROXY=direct GOSUMDB=off go list -m -versions github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go`)
  console.log(`# 真实拉取验证:mkdir /tmp/gocheck && cd /tmp/gocheck && go mod init probe && go get github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go@v${sdkVersion}`)
  console.log(`\n# 4) 已知会红的 CI(push ${tag} 必然触发 release-sdk.yml 并在 gate 判红:凭据缺失)`)
  console.log(`gh run list --workflow release-sdk.yml --limit 3`)
  console.log(`# 想让 Go 那条走 CI 而不是手工 push:gh workflow run release-sdk.yml -f language=go -f dry_run=false -f confirm_real_release=yes -f tag=${tag}`)
}

function main() {
  const argv = process.argv.slice(2)
  const refIdx = argv.indexOf('--ref')
  const ref = refIdx >= 0 ? argv[refIdx + 1] : 'HEAD'
  const printOnly = argv.includes('--print-only')
  const sha = git(['rev-parse', ref])

  const sdkPkg = readJson('packages/sdk/package.json')
  const cliPkg = readJson('apps/cli/package.json')
  const goModule = parseGoModule(readFileSync(join(REPO_ROOT, 'packages/sdk/go/go.mod'), 'utf8'))
  const sdkVersion = String(sdkPkg.version)
  const cliVersion = String(cliPkg.version)
  const goRepoPrefix = `github.com/${REPO_SLUG}`
  const goTag = moduleTagFor(goModule, goRepoPrefix, sdkVersion)
  const tag = `sdk-v${sdkVersion}`

  console.log(`commit        : ${sha}`)
  console.log(`npm/PyPI 版本 : ${sdkVersion} (packages/sdk/package.json)`)
  console.log(`go module     : ${goModule}`)
  console.log(`go 必需 tag   : ${goTag}   ← release-sdk.yml 现推的是 sdk/v${sdkVersion}(形态错误,go get 解析不到)`)
  console.log(`CI 触发 tag   : ${tag}     ← release-sdk.yml on.push.tags: 'sdk-v*'`)
  console.log(`brew/winget   : 资产挂在 cli-v${cliVersion}(该 tag 从未打过)`)

  const specs = assetSpecs(sdkVersion, cliVersion)
  if (printOnly) {
    for (const s of specs) console.log(`  plan: ${s.file}`)
    return
  }
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })
  const rows = specs.map((s) => buildAsset(s, sha))
  writeFileSync(NOTES_FILE, buildNotes(sdkVersion, goTag, cliVersion, sha, rows), 'utf8')
  console.log(`\n=== 资产(${OUT_DIR})===`)
  console.log(rows.map((r) => `${r.sha256}  ${r.file}`).join('\n'))
  printCommands({ sdkVersion, cliVersion, goTag, tag, ref: sha, rows })
}

// §22d 双形态入口守护:被测试 import 时绝不触发 main()(Windows 路径必须经 pathToFileURL 归一)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e instanceof Error ? e.message : String(e)}`)
    process.exit(2)
  }
}

export const __test__ = { semverFromTag, moduleTagFor, parseGoModule, assetSpecs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

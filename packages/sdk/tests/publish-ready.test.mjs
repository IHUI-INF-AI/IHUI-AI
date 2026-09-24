// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D18「Agent SDK 对外开放(G-23)」可发布性回归 —— 跨通道发布就绪性(判 HEAD 内容,零副作用)。
//
// 与既有权威入口的分工(不得重复造轮子,AGENTS.md §3 共享层优先):
//   - `node scripts/check-pkg-installable.mjs packages/sdk` 是 npm 通道 **产物面** 的唯一权威
//     (真 `npm pack` + 解包 8 项判据)。本文件**不**重复那些判据。
//   - 本文件守的是那个入口结构上看不见的那一半:**从干净 checkout 出发、四通道同时发布时的
//     一致性**。npm 的自检是在本机工作树上跑的 —— 工作树里 `packages/sdk/LICENSE` 早已被
//     `prepack` 复制好,所以它永远看不出"仓库根许可证没入库 → CI 干净检出时 prepack 必失败"
//     这一型;同理它完全不看 python / go / java 三份清单与 CI 声明的坐标是否同名。
//     这正是本仓守门 72 / 78 反复记过的"本地全绿、出事的是别人"族。
//
// 运行:`node --test packages/sdk/tests/publish-ready.test.mjs`
//   (不要 `node --test packages/sdk/tests/` —— 同目录的 *.test.ts 归 vitest 管,
//    其 include 为 `tests/**/*.test.ts`,Node 直跑会因找不到 vitest 运行时而红。)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 由测试自身位置推导仓库根,不写死盘符(AGENTS.md §15)。 */
const REPO_ROOT = resolve(HERE, '..', '..', '..')

/**
 * git 二进制优先用仓库共享解析器(scripts/lib/gitdir.mjs 的 resolveGitBin);
 * 解析不到时退回 PATH 上的 git,并在结论里如实说明用的是哪一条 —— 不得静默。
 * @type {string}
 */
let GIT = 'git'
try {
  const mod = await import(new URL('../../../scripts/lib/gitdir.mjs', import.meta.url).href)
  if (typeof mod.resolveGitBin === 'function') {
    const found = mod.resolveGitBin()
    if (found) GIT = found
  }
} catch {
  // 共享解析器不可用(如被移出 workspace 单独跑)—— 退回 PATH,下方 gitShow 仍会带 safe.directory
}

/**
 * 取 HEAD 版本的文件内容(不读工作树:共享工作树常年滞后,按磁盘判会产出与事实相反的结论)。
 * 只读调用必须带 timeout 与 windowsHide(AGENTS.md §5b;守门 52 / 80)。
 * @param {string} relPath 仓库根相对路径(正斜杠)
 * @returns {string|null} 该路径在 HEAD 中不存在时返回 null
 */
function headFile(relPath) {
  try {
    return execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `HEAD:${relPath}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 16 * 1024 * 1024,
      // 必须显式 pipe:默认 stdio 会把 git 的 "exists on disk, but not in 'HEAD'" 直接打到
      // 父进程 stderr,让"该文件按设计不入库"这条**预期内**的判定看起来像一次失败。
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    const stderr = String(err?.stderr ?? '')
    if (/exists on disk, but not in|does not exist|pathspec .* did not match/i.test(stderr)) return null
    throw new Error(`git show HEAD:${relPath} 失败:${stderr || err?.message || err}`)
  }
}

/** @param {string} relPath @returns {string[]} HEAD 该目录下的全部路径 */
function headList(relPath) {
  const out = execFileSync(GIT, ['-c', 'safe.directory=*', 'ls-tree', '-r', '--name-only', 'HEAD', '--', relPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20_000,
    maxBuffer: 16 * 1024 * 1024,
  })
  return out.split(/\r?\n/).filter(Boolean)
}

/** 读并 parse 一份 JSON 清单(HEAD 版)。 */
function headJson(relPath) {
  const raw = headFile(relPath)
  assert.notEqual(raw, null, `HEAD 中缺少 ${relPath} —— SDK 发布链的基础清单被删除,必须先恢复再放行`)
  return JSON.parse(raw)
}

const RELEASE_WORKFLOW = '.github/workflows/release-sdk.yml'
const PY_PYPROJECT = 'packages/sdk/python/pyproject.toml'
const GO_GOMOD = 'packages/sdk/go/go.mod'
const JAVA_POM = 'packages/sdk/java/pom.xml'

test('npm 清单:发布形态齐备且不外泄内部依赖', () => {
  const pkg = headJson('packages/sdk/package.json')
  assert.notEqual(pkg.private, true, '@ihui/sdk 仍为 private,任何通道都发不出去')
  assert.match(String(pkg.name), /^@ihui\/sdk$/, 'npm 包名漂移(CI 的 `npm view` 回读按此名判红)')
  assert.match(String(pkg.version), /^\d+\.\d+\.\d+/, 'version 必须是合法 semver(tag 解析依赖它)')

  // files 白名单:必须同时含编译产物与 Apache-2.0 要求的两份法律文本
  for (const need of ['dist', 'LICENSE', 'NOTICE', 'README.md']) {
    assert.ok((pkg.files ?? []).includes(need), `files 未含 ${need} —— 发出去的包不满足 Apache-2.0 随附声明要求`)
  }
  // 兄弟语言切片与源码都不得进 npm 包(历史上曾被打进 1.39MB 的包)
  for (const banned of ['src', 'python', 'go', 'java', 'dotnet', 'tests']) {
    assert.ok(
      !(pkg.files ?? []).includes(banned),
      `files 混入 ${banned}/ —— npm 产物泄漏源码或夹带其他语言 SDK`,
    )
  }

  // 运行时依赖必须全为公网可解析的包:workspace: 协议与未入库的 @ihui/* 发出去即 404
  for (const [field, deps] of Object.entries({ dependencies: pkg.dependencies, peerDependencies: pkg.peerDependencies })) {
    for (const [dep, spec] of Object.entries(deps ?? {})) {
      assert.ok(!String(spec).startsWith('workspace:'), `${field}.${dep}=${spec} 是 workspace 协议,外部装不到`)
      assert.notMatch(dep, /^@ihui\//, `${field}.${dep} 是内部包,@ihui scope 未公开 → 消费者 404`)
    }
  }

  // 入口一律指 dist,指回 src 即外部不可用
  for (const [field, val] of Object.entries({ main: pkg.main, module: pkg.module, types: pkg.types })) {
    assert.ok(typeof val === 'string' && val.length > 0, `缺 ${field} 字段`)
    assert.doesNotMatch(val, /(^|\/)src\//, `${field}=${val} 指向 src,外部安装不可用`)
  }
})

test('prepack 的输入在 HEAD 齐备(仓库根许可证必须入库)', () => {
  // packages/sdk/scripts/prepack.mjs 从**仓库根**复制 LICENSE/NOTICE,取不到就 process.exit(1)。
  // 本机工作树看永远"存在",CI 干净检出时若根许可证未入库则发布 job 必红 —— 正是本文件存在的理由。
  for (const name of ['LICENSE', 'NOTICE']) {
    const rootText = headFile(name)
    assert.notEqual(rootText, null, `仓库根 ${name} 未入库:CI 干净检出时 prepack 必失败`)
    assert.ok(rootText.trim().length > 200, `仓库根 ${name} 内容为空/过短,不是完整法律文本`)
  }
})

test('包内 LICENSE / NOTICE 按设计不入库(避免法律文本漂移的第二份真相)', () => {
  // 二者由 prepack 生成、被 packages/sdk/.gitignore 忽略;若有人把它们提交,
  // 就等于在仓库里存了第二份许可证副本 —— 根文件一改,包内副本立刻过期。
  const ignore = headFile('packages/sdk/.gitignore')
  assert.notEqual(ignore, null, 'packages/sdk/.gitignore 缺失')
  for (const name of ['LICENSE', 'NOTICE']) {
    assert.match(ignore, new RegExp(`^/${name}$`, 'm'), `.gitignore 未忽略 /${name}:prepack 生成物会污染 git status`)
    assert.equal(headFile(`packages/sdk/${name}`), null, `packages/sdk/${name} 竟已入库:与根文件构成两份真相`)
  }
})

test('四通道坐标:清单声明与 release-sdk.yml 逐一同名(改名即发错包)', () => {
  const workflow = headFile(RELEASE_WORKFLOW)
  assert.notEqual(workflow, null, `${RELEASE_WORKFLOW} 缺失 —— 没有任何通道能发布`)

  const pkg = headJson('packages/sdk/package.json')
  const py = headFile(PY_PYPROJECT)
  assert.notEqual(py, null, `${PY_PYPROJECT} 缺失`)
  const pom = headFile(JAVA_POM)
  assert.notEqual(pom, null, `${JAVA_POM} 缺失`)
  const gomod = headFile(GO_GOMOD)
  assert.notEqual(gomod, null, `${GO_GOMOD} 缺失`)

  const pyName = /^\s*name\s*=\s*"([^"]+)"/m.exec(py)?.[1]
  assert.ok(pyName, 'pyproject.toml 的 [project].name 解析不到')

  // CI 的"发布成功"唯一判据就是回读这些 URL;URL 里的坐标必须等于清单坐标,否则
  // 名字一改 → 回读查不到 → 恒红,或更糟:发到同名别人包上。
  const expectations = [
    { channel: 'npm', needle: `npm view ${pkg.name} version`, src: 'packages/sdk/package.json name' },
    { channel: 'PyPI', needle: `pypi.org/pypi/${pyName}/`, src: 'pyproject.toml [project].name' },
  ]

  // Maven:groupId/artifactId 取项目级 —— 先剥掉 <parent> 块,否则会把父 POM 坐标当自己的。
  const pomSelf = pom.replace(/<parent>[\s\S]*?<\/parent>/gi, '')
  const groupId = /<groupId>\s*([^<\s]+)\s*<\/groupId>/.exec(pomSelf)?.[1]
  const artifactId = /<artifactId>\s*([^<\s]+)\s*<\/artifactId>/.exec(pomSelf)?.[1]
  assert.ok(groupId && artifactId, 'pom.xml 解析不到项目级 groupId/artifactId')
  expectations.push({
    channel: 'Maven',
    needle: `repo1.maven.org/maven2/${groupId.replace(/\./g, '/')}/${artifactId}/`,
    src: 'pom.xml groupId:artifactId',
  })

  // Go 的"发布"= 往 origin 推 <go 目录>/v* tag,CI 文本里必须写着同一目录前缀。
  expectations.push({ channel: 'Go', needle: 'packages/sdk/go/v', src: 'go module 所在目录' })

  for (const { channel, needle, src } of expectations) {
    assert.ok(
      workflow.includes(needle),
      `${channel} 通道:CI 中找不到 "${needle}",而清单坐标(${src})为 "${needle}" —— 两边已漂移`,
    )
  }

  // go.mod 的模块路径必须落在本仓库内,否则推的 tag 永远不会被该模块解析到。
  const modulePath = /^\s*module\s+(\S+)/m.exec(gomod)?.[1]
  assert.ok(modulePath, 'go.mod 解析不到 module 路径')
  assert.match(modulePath, /IHUI-AI\/packages\/sdk\/go$/, `Go 模块路径 ${modulePath} 与仓库内目录不匹配`)
})

test('版本单列:npm / PyPI / Maven 三份清单版本一致(一条发布列车)', () => {
  const npmVersion = headJson('packages/sdk/package.json').version
  const py = headFile(PY_PYPROJECT)
  const pyVersion = /^\s*version\s*=\s*"([^"]+)"/m.exec(py)?.[1]
  const pomSelf = headFile(JAVA_POM).replace(/<parent>[\s\S]*?<\/parent>/gi, '')
  // 剥 parent 后第一个 <version> 即项目版本(依赖块的 version 都在更后面)
  const javaVersion = /<version>\s*([^<\s]+)\s*<\/version>/.exec(pomSelf)?.[1]

  assert.ok(pyVersion && javaVersion, 'PyPI / Maven 版本解析不到')
  assert.equal(String(pyVersion), String(npmVersion), `pyproject 版本 ${pyVersion} ≠ npm ${npmVersion}`)
  assert.equal(String(javaVersion), String(npmVersion), `pom 版本 ${javaVersion} ≠ npm ${npmVersion}`)
})

test('PyPI 随包附带 Apache-2.0 声明(与 npm 通道同标准)', () => {
  const py = headFile(PY_PYPROJECT)
  assert.match(py, /^\s*license\s*=\s*"Apache-2\.0"/m, 'pyproject 未声明 Apache-2.0')
  const licenseFiles = /^\s*license-files\s*=\s*\[([^\]]*)\]/m.exec(py)?.[1]
  assert.ok(licenseFiles, 'pyproject 缺 license-files —— wheel 不带许可证即不满足分发条款')
  for (const need of ['LICENSE', 'NOTICE']) {
    assert.ok(licenseFiles.includes(need), `license-files 未含 ${need}`)
  }
})

test('.NET 通道:存在工程文件就必须存在 nuget 发布 job(反向守卫,防清单腐烂)', () => {
  // 现状:packages/sdk/dotnet 有 44 个 .cs 源文件,但没有 .csproj/.nuspec → CI 明文登记"无 NuGet 通道"。
  // 本断言只锁未来那一半:谁补了工程文件却没接发布 job,dotnet 切片就会重新变成"造好没装车"。
  const dotnetFiles = headList('packages/sdk/dotnet')
  const projectFiles = dotnetFiles.filter((p) => /\.(csproj|nuspec)$/i.test(p))
  if (projectFiles.length === 0) {
    console.log('  · .NET:HEAD 无 .csproj/.nuspec,NuGet 通道仍未建立(与 CI 登记一致,属待人工项)')
    return
  }
  const workflow = headFile(RELEASE_WORKFLOW) ?? ''
  assert.match(
    workflow,
    /nuget-publish|dotnet nuget push/i,
    `dotnet 已有工程文件(${projectFiles.join(', ')})但 CI 无 NuGet 发布 job —— 切片又被造好没装车`,
  )
})

test('发布链引用的每一条 CI 判据脚本在 HEAD 都在位', () => {
  // release-sdk.yml 与 prepack 都会引用仓库内文件;引用不存在的文件 = 只在 CI 才炸。
  const workflow = headFile(RELEASE_WORKFLOW) ?? ''
  const prepack = headFile('packages/sdk/scripts/prepack.mjs')
  assert.notEqual(prepack, null, 'packages/sdk/scripts/prepack.mjs 缺失')
  assert.match(headJson('packages/sdk/package.json').scripts?.prepack ?? '', /prepack\.mjs/, 'prepack 钩子未接')
  for (const rel of ['packages/sdk/scripts/prepack.mjs', 'packages/sdk/tsconfig.json']) {
    assert.notEqual(headFile(rel), null, `${rel} 缺失,但发布链引用它`)
  }
  assert.match(workflow, /gate/, 'release-sdk.yml 缺少 gate job(凭据有效性判定层,防"未配凭据也印成 Real release")')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

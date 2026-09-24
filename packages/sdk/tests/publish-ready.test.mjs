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
import { readFileSync } from 'node:fs'
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
 *
 * 变异对照通道:`IHUI_PR_WORKFLOW_FILE=<磁盘文件>` 时,release-sdk.yml 的文本改从该文件取。
 * 与守门 70 的 `--root <dir>`、守门 94 的 `--worktree` 同一形态 —— **默认口径不变(判 HEAD),
 * 语义不变**,只是给"把 nuget job 那几行删掉后本门必须变红"这类对照开一条不碰 git 索引的入口。
 * 不设置该变量时,本函数行为与改前逐字一致。
 * @param {string} relPath 仓库根相对路径(正斜杠)
 * @returns {string|null} 该路径在 HEAD 中不存在时返回 null
 */
function headFile(relPath) {
  if (relPath === '.github/workflows/release-sdk.yml' && process.env.IHUI_PR_WORKFLOW_FILE) {
    return readFileSync(process.env.IHUI_PR_WORKFLOW_FILE, 'utf8')
  }
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
const DOTNET_DIR = 'packages/sdk/dotnet'
/** 一个 .NET 包的"工程文件"只有这两种形态;同目录同时/重复出现即为第二份真相。 */
const NET_PROJECT_RE = /\.(csproj|nuspec)$/i

/** 剥掉 YAML 整行注释 —— 注释里写"已接 nuget-publish"不构成接线(本仓"造好没装车"同族)。 */
function withoutYamlComments(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
}

/** 取出 workflow 里 nuget-publish 这个 job 的正文(剥注释后,按 2 空格缩进的 job 键切边界)。 */
function nugetJobBlock(workflowText) {
  const body = withoutYamlComments(workflowText)
  const m = /^ {2}nuget-publish:[\s\S]*?(?=^ {2}[a-z][\w-]*:)/m.exec(body)
  return m ? m[0] : null
}

/**
 * .NET 通道的**双向**判据(纯函数:这样变异对照能钉成用例,而不是靠人偶尔手删一次)。
 *
 * 为什么不能沿用旧写法 `/nuget-publish|dotnet nuget push/i`:本文件 HEAD 版实测就是被它骗绿的 ——
 * release-sdk.yml 顶部那段"当前无通道 … 仿照 npm-publish job 另立 nuget-publish job(dotnet pack →
 * dotnet nuget push)"的**待办注释**同时命中两个分支,于是"job 不存在"被报成"job 已接线"。
 * 判据必须只认结构化 job 键,并且自带"注释里出现字样仍须判红"的阳性对照。
 *
 * @param {string[]} projectFiles dotnet 目录下的工程文件(csproj / nuspec)
 * @param {string} workflowText   release-sdk.yml 全文
 * @param {string} channel        仅用于报错文案
 */
function assertNetChannelBidirectional(projectFiles, workflowText, channel = '.NET') {
  const job = nugetJobBlock(workflowText)
  if (projectFiles.length === 0) {
    assert.equal(
      job,
      null,
      `${channel}:CI 已有 nuget-publish job,但 ${DOTNET_DIR} 下没有任何 .csproj/.nuspec —— ` +
        `job 发不出任何东西,清单与接线又分叉了(反向对照)`,
    )
    return
  }
  assert.notEqual(
    job,
    null,
    `${channel}:${DOTNET_DIR} 已有工程文件(${projectFiles.join(', ')}),而 workflow 里` +
      '不存在名为 nuget-publish 的 job 键(剥掉 YAML 整行注释后按 ^  nuget-publish: 查找)' +
      ' —— 切片又被造好没装车',
  )
  // 工程文件唯一性:两个 csproj 会让 `dotnet pack <目录>` 直接报 More than one project file,
  // 也是 PackageId 的第二份真相源。
  const projects = projectFiles.filter((p) => NET_PROJECT_RE.test(p))
  assert.equal(projects.length, 1, `${channel}:${DOTNET_DIR} 下工程文件必须恰好 1 个,实测 ${projects.length} 个:${projects.join(', ')}`)
  // 发布动作 + 凭据 + 回读三件套缺一不可;"接了 job 但不回读"= 把"没发"印成"已发"。
  for (const [needle, why] of [
    ['dotnet pack', '不打包就没有产物'],
    ['dotnet nuget push', '不推送就不是发布通道'],
    ['NUGET_API_KEY', '未接 gate 的凭据判定 —— 无凭据也会跑出绿 job'],
    ['needs: [extract, gate]', '绕过 gate(凭据有效性判定层)'],
    ['outputs.proof', '不交回读证据,release-summary 的硬闸形同虚设'],
    ["needs.extract.outputs.dry_run == 'true'", '缺 dry-run 分支:真发布路径从未被演练'],
    ["needs.extract.outputs.dry_run == 'false'", '缺真发布分支:job 绿着什么都不发'],
    ['v3-flatcontainer/', '缺发布后回读判红 —— "命令没报错"不能当"已发布"'],
  ]) {
    assert.ok(job.includes(needle), `${channel}:nuget-publish job 缺 "${needle}"(${why})`)
  }
}

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

test('五通道坐标:清单声明与 release-sdk.yml 逐一同名(改名即发错包)', () => {
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

  // NuGet:寻址按"工程文件名推导的 PackageId(小写)"。CI 的 dotnet pack 用同一条规则,
  // 所以这条 needle 同时钉住"CI 里那句 EXPECTED_ID 字面量"与"csproj 文件名"不许分叉。
  const netProjectFiles = headList(DOTNET_DIR).filter((p) => NET_PROJECT_RE.test(p))
  if (netProjectFiles.length === 1) {
    const pkgId = netProjectFiles[0].split('/').pop().replace(NET_PROJECT_RE, '')
    assert.ok(pkgId, `${netProjectFiles[0]} 推不出 PackageId`)
    expectations.push({
      channel: 'NuGet',
      needle: `v3-flatcontainer/${pkgId.toLowerCase()}/`,
      src: `${DOTNET_DIR} 工程文件名推导的 PackageId(${pkgId})`,
    })
  }

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

test('版本单列:npm / PyPI / Maven / .NET 四份清单版本一致(一条发布列车)', () => {
  const npmVersion = headJson('packages/sdk/package.json').version
  const py = headFile(PY_PYPROJECT)
  const pyVersion = /^\s*version\s*=\s*"([^"]+)"/m.exec(py)?.[1]
  const pomSelf = headFile(JAVA_POM).replace(/<parent>[\s\S]*?<\/parent>/gi, '')
  // 剥 parent 后第一个 <version> 即项目版本(依赖块的 version 都在更后面)
  const javaVersion = /<version>\s*([^<\s]+)\s*<\/version>/.exec(pomSelf)?.[1]

  assert.ok(pyVersion && javaVersion, 'PyPI / Maven 版本解析不到')
  assert.equal(String(pyVersion), String(npmVersion), `pyproject 版本 ${pyVersion} ≠ npm ${npmVersion}`)
  assert.equal(String(javaVersion), String(npmVersion), `pom 版本 ${javaVersion} ≠ npm ${npmVersion}`)

  // .NET 纳入同一判据:csproj 的 <Version> 是第四个通道,不得成为手工第四份真相。
  // 解析口径与 Maven 同形(<Version> 大写才是程序集版本,<version> 小写是依赖版本,不能混)。
  const csprojPath = headList(DOTNET_DIR).find((p) => /\.csproj$/i.test(p))
  if (!csprojPath) {
    // 不放宽:缺失由下面的 .NET 通道用例判红,这里只说明本用例当前实际核了三份清单。
    console.error('  · .NET:HEAD 无 .csproj,本轮版本单列实际只核了 npm/PyPI/Maven 三份')
  } else {
    const csproj = headFile(csprojPath)
    const netVersion = /<Version>\s*([^<\s]+)\s*<\/Version>/.exec(csproj)?.[1]
    assert.ok(netVersion, `${csprojPath} 解析不到 <Version> —— 该通道一旦发布就会带着 MSBuild 默认值 1.0.0 上 NuGet`)
    assert.equal(String(netVersion), String(npmVersion), `csproj 版本 ${netVersion} ≠ npm ${npmVersion}`)
  }
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

test('.NET 通道:工程文件与 nuget-publish job 必须同时成立(双向对账,不再"仅提示待人工")', () => {
  // 旧写法在这里是"没工程文件 → console.log 一句待人工然后 return",且反向分支用的正则
  // `/nuget-publish|dotnet nuget push/i` 会被 CI 顶部那段待办注释直接喂绿 —— 即 HEAD 改前
  // 实测的假绿:44 个 dotnet 文件在库、job 一个没有,本门照样报 ✔。现改为双向硬判据。
  const projectFiles = headList(DOTNET_DIR).filter((p) => NET_PROJECT_RE.test(p))
  const workflow = headFile(RELEASE_WORKFLOW)
  assert.notEqual(workflow, null, `${RELEASE_WORKFLOW} 缺失,却存在 ${projectFiles.length} 个 .NET 工程文件`)
  assertNetChannelBidirectional(projectFiles, workflow)
})

test('.NET 通道·变异对照 A:把 nuget-publish job 删掉,本门必须判红(证明断言真咬住接线)', () => {
  const projectFiles = headList(DOTNET_DIR).filter((p) => NET_PROJECT_RE.test(p))
  assert.ok(projectFiles.length > 0, '本用例前提是 HEAD 里 .NET 工程文件在位')
  const workflow = headFile(RELEASE_WORKFLOW) ?? ''
  const block = nugetJobBlock(workflow)
  assert.notEqual(block, null, '前提不成立:HEAD 的 workflow 里找不到 nuget-publish job —— 上一用例应当已判红')
  const mutated = withoutYamlComments(workflow).replace(block, '')
  // 注意:`assert.throws(fn)` **不返回**被抛的错误(返回 undefined),要校验文案只能把正则当
  // 第二参数传进去 —— 写成 `const err = assert.throws(...)` 再读 err.message 必 TypeError。
  assert.throws(() => assertNetChannelBidirectional(projectFiles, mutated), /nuget-publish/)
})

test('.NET 通道·变异对照 B:只在 YAML 注释里写 nuget-publish 仍必须判红(钉死改前那个假绿)', () => {
  const projectFiles = headList(DOTNET_DIR).filter((p) => NET_PROJECT_RE.test(p))
  const workflow = headFile(RELEASE_WORKFLOW) ?? ''
  const block = nugetJobBlock(workflow)
  // 复刻改前状态:job 不在,但注释里有"nuget-publish job(dotnet pack → dotnet nuget push)"字样
  const prose = `# 待办:仿照 npm-publish job 另立 nuget-publish job(dotnet pack → dotnet nuget push)\n${withoutYamlComments(workflow).replace(block ?? '', '')}`
  // 旧判据在同样输入下会命中 → 这正是它当时报绿的原因;新判据必须判红。
  assert.match(prose, /nuget-publish|dotnet nuget push/i, '前提:该文本必须能骗过旧判据')
  assert.throws(() => assertNetChannelBidirectional(projectFiles, prose))
})

test('.NET 通道·变异对照 C:有 job 而无工程文件也必须判红(反向,防"接了个发不出去的 job")', () => {
  const workflow = headFile(RELEASE_WORKFLOW) ?? ''
  assert.notEqual(nugetJobBlock(workflow), null, '前提:HEAD 的 nuget-publish job 在位')
  assert.throws(() => assertNetChannelBidirectional([], workflow))
})

test('.NET 工程文件自洽(结构层面)—— 与"可构建"刻意分开判', () => {
  const csprojFiles = headList(DOTNET_DIR).filter((p) => /\.csproj$/i.test(p))
  assert.equal(csprojFiles.length, 1, `.NET 工程文件必须恰好 1 个,实测 ${csprojFiles.length}:${csprojFiles.join(', ')}`)
  const rel = csprojFiles[0]
  const csproj = headFile(rel)
  assert.notEqual(csproj, null, `${rel} 不在 HEAD`)
  assert.match(csproj, /<Project\s+Sdk="Microsoft\.NET\.Sdk"/, `${rel} 不是 SDK 式工程,dotnet pack 走不了现代打包`)
  const tfms = [...csproj.matchAll(/<TargetFramework[s]?>([^<]+)<\/TargetFramework[s]?>/g)].map((m) => m[1].trim())
  assert.equal(tfms.length, 1, `TargetFramework 必须单一,实测:${tfms.join(', ')}`)
  assert.match(tfms[0], /^net\d+(\.\d+)?$/, `TargetFramework=${tfms[0]} 不是现代 .NET(应为 net8.0 一类)`)
  assert.match(csproj, /<Version>\s*\d+\.\d+\.\d+\s*<\/Version>/, `${rel} 缺 <Version>(与其余通道同一枚 semver)`)

  // CI 装的 SDK 大版本必须与目标框架同源:装 6.0 打 net8 的包是"CI 红在无关处"那一型。
  const workflow = headFile(RELEASE_WORKFLOW) ?? ''
  const major = /net(\d+)/.exec(tfms[0])?.[1]
  const ciPin = new RegExp(`DOTNET_VERSION:[^\\n]*'${major}\\.`).exec(withoutYamlComments(workflow))
  assert.ok(
    ciPin,
    `release-sdk.yml 的 DOTNET_VERSION 未与 ${rel} 的 ${tfms[0]} 同大版本(改 TFM 必须同批改 CI)`,
  )

  // 许可证:与 npm/PyPI 同标准,但 .NET 的合法形态是 nuspec 表达式(见上方 Inspect 步骤),
  // 刻意**不**要求 packages/sdk/**/LICENSE 入库 —— 那是"包内法律文本不入库"那条双向断言的对面。
  assert.match(
    csproj,
    /<PackageLicenseExpression>\s*Apache-2\.0\s*<\/PackageLicenseExpression>/,
    `${rel} 未声明 Apache-2.0 许可证表达式`,
  )
  // 打包产物不得入库(bin/obj/nupkg),否则共享工作树里会冒出第二份"发布物"。
  const ignore = headFile(`${DOTNET_DIR}/.gitignore`) ?? ''
  for (const need of ['bin/', 'obj/']) {
    assert.ok(ignore.includes(need), `${DOTNET_DIR}/.gitignore 未忽略 ${need}`)
  }
})

test('.NET 可构建性:本文件不下结论,判据只在 CI 的 nuget-publish job', () => {
  // 为什么单列一条:上面的用例只证明"结构自洽"。"能否 dotnet build/pack"需要真跑一次,
  // 而在测试里跑它会把 bin/obj 写进共享工作树(并行会话可见),并且本机常常根本没有 SDK ——
  // 那种情况下把"跑不了"写成"通过"就是本仓反复记过的"本地全绿、出事的是别人"。
  let detail = ''
  let sdkPresent = false
  try {
    const out = execFileSync('dotnet', ['--list-sdks'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    detail = out.trim()
    sdkPresent = detail.length > 0 && !/No SDKs? were found/i.test(detail)
  } catch (err) {
    detail = `dotnet CLI 不可用:${String(err?.message ?? err).split(/\r?\n/)[0]}`
  }
  if (sdkPresent) {
    console.error('  · .NET 可构建性:本机有 SDK,但构建/打包判据落在 CI(nuget-publish 的 build+pack 步)')
  } else {
    console.error(`  · .NET 可构建性 **未判定**(本机实测:${detail})—— 不得据此声称通道已可构建`)
  }
  // 唯一硬判据:CI 里必须真的有人跑构建。缺了它,"可构建"就永远没有任何地方被证明过。
  const job = nugetJobBlock(headFile(RELEASE_WORKFLOW) ?? '') ?? ''
  assert.match(job, /dotnet build/, 'nuget-publish job 未跑 dotnet build —— 可构建性没有任何判据现场')
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

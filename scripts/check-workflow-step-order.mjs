#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub Actions 步骤顺序 + 权限声明守门(blocking)
 *
 * 规则 A(原有): 同一 job 内, 若 `actions/setup-node` 使用 `cache: pnpm`, 则
 *       `pnpm/action-setup` 必须出现在它 **之前**。
 *
 * 原因: setup-node 的 pnpm 缓存功能需要 pnpm 已就绪, 否则报
 *       "Unable to locate executable file: pnpm" —— 2026-09-10 实测
 *       导致 mobile-apk-build / mobile-ios-ipa-build 两个 workflow 永久失败。
 *
 * 规则 B(2026-11-01 安全强化新增,绝对零容忍,非差值棘轮):
 *       每枚 workflow 必须有**顶层** `permissions:` 块,且不得写 `permissions: write-all`。
 *
 * 原因: 不声明时,GITHUB_TOKEN 拿到的是**仓库/组织默认档位**——那个档位不在本仓任何文件里,
 *       由 GitHub 侧决定且随时可被管理员改成"Read and write all"。于是一枚被外部事件
 *       (star / issue_comment / pull_request)触发的作业,可能带着写权跑在别人的代码上;
 *       而 `write-all` 更是把整片 scope 一次授予。声明之后未列出的 scope 一律降为 none,
 *       写权就必须逐条点名 —— 这正是本仓 release-desktop.yml 头注早就记下、却无人机器化
 *       强制的那条事实。两维现读存量均为 0(49 枚已入库 workflow 全部有顶层声明,
 *       write-all 零命中)⇒ 按 §0.2/§12e,只有存量归零才允许直接上 blocking。
 *       刻意**不**加"不可信触发面不得有顶层写权"那第三维:实测存量 3 枚
 *       (pr-review / style-spec / thank-star),三者都是该作业的正当需要,装上即恒红门。
 *
 * 用法:
 *   node scripts/check-workflow-step-order.mjs
 *   node scripts/check-workflow-step-order.mjs --self-test   # 规则 B 的成对夹具
 * 跳过: HUSKY_SKIP_WORKFLOW_ORDER=1 git commit ...
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WF_DIR = join(ROOT, '.github', 'workflows')

const STEP_RE = /^(\s*)-\s+(?:name|uses):/
const JOB_RE = /^  ([A-Za-z0-9_-]+):\s*$/

/** 顶层键必须落在第 0 列;缩进的同名键是 job 级声明,不算地板。 */
const TOP_PERMISSIONS_RE = /^permissions:/m
const WRITE_ALL_RE = /^permissions:\s*write-all\s*$/m

/**
 * 规则 B 的唯一判据(纯函数:进 YAML 文本,出违规说明数组)。
 *
 * 抽成纯函数是为了让镜像测试把夹具文本直接喂给**这条**判据跑,而不是在测试里复制一份
 * 规则(§22c)。只认顶层而放过 job 级是刻意的:job 级声明救不了"下一个新 job 忘了写"
 * 那一型 —— 忘了写的那一枚又退回默认档位;顶层是地板,job 级只能在地板之上继续收窄。
 */
export function judgePermissionsDeclaration(text) {
  if (WRITE_ALL_RE.test(text)) {
    return ['permissions: write-all(一次授予整片 scope;写权必须逐条点名)']
  }
  if (!TOP_PERMISSIONS_RE.test(text)) {
    return [
      '缺顶层 permissions: 块(不声明 ⇒ 拿仓库/组织默认档位,那档位可能含写权且不在本仓任何文件里)',
    ]
  }
  return []
}

function scan() {
  const violations = []

  for (const file of readdirSync(WF_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
    const abs = join(WF_DIR, file)
    const text = readFileSync(abs, 'utf8')
    const rel = relative(ROOT, abs).replaceAll('\\', '/')

    // 规则 B:权限声明
    for (const why of judgePermissionsDeclaration(text))
      violations.push(`${rel} [permissions] ${why}`)

    // 规则 C:安装命令逐字钉版(2026-11-01)
    for (const why of judgeInstallPins(text)) violations.push(`${rel} [install-pin] ${why}`)

    // 规则 A:步骤顺序
    const lines = text.split('\n')
    const jobStarts = []
    lines.forEach((l, i) => {
      if (JOB_RE.test(l)) jobStarts.push(i)
    })
    for (let k = 0; k < jobStarts.length; k++) {
      const js = jobStarts[k]
      const je = k + 1 < jobStarts.length ? jobStarts[k + 1] : lines.length
      const starts = []
      for (let i = js; i < je; i++) if (STEP_RE.test(lines[i])) starts.push(i)
      let nodeLine = -1
      let pnpmLine = -1
      for (let b = 0; b < starts.length; b++) {
        const s = starts[b]
        const e = b + 1 < starts.length ? starts[b + 1] : je
        const body = lines.slice(s, e).join('\n')
        if (
          nodeLine < 0 &&
          body.includes('actions/setup-node') &&
          /cache:\s*['"]?pnpm/.test(body)
        ) {
          nodeLine = s
        }
        if (pnpmLine < 0 && body.includes('pnpm/action-setup')) pnpmLine = s
      }
      if (nodeLine >= 0 && pnpmLine > nodeLine) {
        violations.push(
          `${rel}:${nodeLine + 1} (setup-node cache:pnpm 在第 ${pnpmLine + 1} 行的 pnpm/action-setup 之前)`,
        )
      }
    }
  }

  const buildFiles = listBuildFiles()
  if (buildFiles === null) {
    violations.push('[build-pin] 取不到 deploy/ 目录 ⇒ 未判定(§0.3),不记绿')
  } else if (buildFiles.length === 0) {
    violations.push('[build-pin] deploy/ 下枚举到 0 个构建文件 ⇒ 判死,不记绿(§0.3)')
  } else {
    const pm = readPackageManagerPnpm()
    for (const abs of buildFiles) {
      let text
      try {
        text = readFileSync(abs, 'utf8')
      } catch {
        violations.push(
          `${relative(ROOT, abs).replaceAll('\\', '/')} [build-pin] 读不到 ⇒ 未判定,不记绿`,
        )
        continue
      }
      const rel = relative(ROOT, abs).replaceAll('\\', '/')
      for (const why of judgeBuildToolPins(text, pm)) violations.push(`${rel} [build-pin] ${why}`)
    }
  }

  return violations
}

/**
 * 规则 C(2026-11-01 供给链新增,绝对零容忍):安装类命令的目标包必须**逐字**带版本。
 *
 * 为什么这条必须是机器闸而不是纪律:一枚 `pip install uv` / `npm install -g autocannon`
 * 在两个时间点能装出两个不同的东西,而它常常就站在握着发布凭据的那条链的第一格
 * (release-cli.yml 的 npm、release-sdk.yml 的 build/twine)。上游任意一次投毒或坏版本,
 * 不需要碰本仓任何一行代码就能进到产物里 —— 本仓的 diff 里**什么都看不见**。
 *
 * 三种合法形态:
 *   ① `==x.y(.z)` / `@x.y(.z)` 逐字钉版;
 *   ② `@$VAR` / `@${VAR}` 由仓内现读值供版(release-desktop.yml 取的是 app 自己的
 *      @tauri-apps/cli 版本 —— 那比写死的字面量更严格,不是豁免);
 *   ③ 走锁文件/本地件(`--frozen-lockfile`、`-e .`、`-r requirements*.txt`、`.whl`、`file:`)
 *      —— 版本由锁或清单决定,不在这一行表达。
 * 其余一律判红。存量:本枚改动后现读 0 条 ⇒ 按 §12e 可直接 blocking,非恒红门。
 */
const INSTALL_CMD_RE =
  /^\s*(?:-\s+)?(?:run:\s*)?(?:[\w.-]+\s+)?(?:python -m pip|pip3?|npm i|npm install|pnpm add|yarn add|uv pip install|pipx install)(?:\s|$)/
const EXPLICIT_PIN_RE = /(?:==|@)\d+\.\d+(?:\.\d+)?/
const DERIVED_VERSION_RE = /@(?:\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)/
const LOCKED_INSTALL_RE =
  /--frozen-lockfile|(?:^|\s)-(?:e|r)\s|(?:^|\s)\.\/|(?:^|\s)\.(?:\s|$)|file:|\.whl\b|requirements[\w.-]*\.txt/

export function judgeInstallPins(text) {
  const out = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (!INSTALL_CMD_RE.test(line)) return
    if (
      EXPLICIT_PIN_RE.test(line) ||
      DERIVED_VERSION_RE.test(line) ||
      LOCKED_INSTALL_RE.test(line)
    ) {
      return
    }
    // `--upgrade pip` 那一型:命令里没有目标包,升的是"当时最新"的同一个东西,同样判红
    out.push(`第 ${i + 1} 行安装命令未逐字钉版:${line.trim().slice(0, 100)}`)
  })
  return out
}

/**
 * 规则 D(2026-11-01 供给链新增,绝对零容忍):`deploy/**` 的构建文件里,**装工具链的那一行**
 * 必须逐字钉版,且凡写到 pnpm 版本的地方必须等于根 `package.json` 的 `packageManager`。
 *
 * 为什么单独一条维:规则 C 的射程是 `.github/workflows/`,而容器/快照/SaaS 模板这些构建文件
 * 不在里面。实测漏网的正是 `corepack prepare pnpm@latest --activate` —— 同一枚提交两次构建
 * 能拿到两个不同的 pnpm,而 pnpm 直接读 `pnpm-lock.yaml` 并执行 `postinstall` 生命周期脚本,
 * 它站在"任意依赖投毒 ⇒ 进产物"这条链的第一格。三处 `Dockerfile.cli` /
 * `deploy/saas/admin-api/Dockerfile` / `deploy/snap/snapcraft.yaml` 全是这一型,且其中一处还挂着
 * `|| true`(连"钉不上"都不响)。
 *
 * 判什么:
 *   D1 `corepack prepare <tok> --activate` / `npm i -g <tok>` / `pnpm add -g <tok>` /
 *      `yarn global add <tok>` ⇒ `<tok>` 必须带 `@x.y(.z)`(或 `@$VAR` 这种由仓内现读值供版);
 *   D2 文本里出现的每个 `pnpm@x.y.z` 字面量必须等于 `packageManager` 里的同一值 —— 钉了版
 *      但钉成另一个版本,同样是"两次构建不同东西",只是换了个更隐蔽的形态。
 * 不判什么(刻意留出,不是豁免):`FROM node:22-alpine` 这类基础镜像按大版本走、
 * `apk add` / `apt-get install` 不带 `=` —— 把它们一起纳进来会立刻造出恒红门(§12e),
 * 而钉这些需要先在真构建里验"该版本在该仓库快照里存在",本仓无 docker 可用(实测
 * `docker: command not found`)⇒ 记为待办,不在本维赌。
 * 存量:本枚改动后现读 0 条 ⇒ blocking 合法。
 */
const BUILD_INSTALL_RE =
  /(?:corepack\s+prepare|npm\s+(?:i|install|add)\s+-{1,2}(?:g|global)|pnpm\s+add\s+-{1,2}(?:g|global)|yarn\s+global\s+add)\s+([^\s|;&)]+)/g
const D2_VERSIONED_RE = /pnpm@(\d+\.\d+\.\d+)/g
const CONCRETE_VERSION_RE = /^\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?$/
const DERIVED_SPEC_RE = /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/

/** 去掉行注释(Dockerfile 与 YAML 都以 `#` 起行);历史说明注释里写过旧版本号,不能当判红目标。 */
function stripBuildComments(text) {
  return text
    .split(/\r?\n/)
    .map((l) => (/^\s*#/.test(l) ? '' : l))
    .join('\n')
}

/**
 * @param text 构建文件全文
 * @param packageManagerPnpm 根 package.json `packageManager` 里的 pnpm 版本(现读传入,本函数不读盘)
 */
export function judgeBuildToolPins(text, packageManagerPnpm) {
  const body = stripBuildComments(text)
  const out = []
  for (const m of body.matchAll(BUILD_INSTALL_RE)) {
    const token = m[1].replace(/^['"]|['"]$/g, '')
    const at = token.lastIndexOf('@')
    const spec = at > 0 ? token.slice(at + 1) : ''
    if (!spec) {
      out.push(`装工具链没带版本:${token}(浮动 ⇒ 同一枚提交两次构建能拿到两个不同的东西)`)
      continue
    }
    if (CONCRETE_VERSION_RE.test(spec) || DERIVED_SPEC_RE.test(spec)) continue
    out.push(`装工具链的版本位不是具体版本:${token}(要 x.y.z 或 @$VAR)`)
  }
  if (packageManagerPnpm) {
    for (const m of body.matchAll(D2_VERSIONED_RE)) {
      if (m[1] !== packageManagerPnpm) {
        out.push(`pnpm 钉的是 ${m[1]},与根 packageManager 的 ${packageManagerPnpm} 不同值`)
      }
    }
  }
  return out
}

/** 构建文件面:deploy/ 下的 Dockerfile* 与 *.yaml/*.yml(README 等散文不在射程)。 */
function listBuildFiles() {
  const dir = join(ROOT, 'deploy')
  let entries
  try {
    entries = readdirSync(dir, { recursive: true, encoding: 'utf8' })
  } catch {
    return null // 取不到 ⇒ 未判定(§0.3),由调用方顶红而不是默默放行
  }
  return entries
    .filter((e) => typeof e === 'string')
    .map((e) => e.replaceAll('\\', '/'))
    .filter((p) => !p.endsWith('/'))
    .filter((p) => /(^|\/)Dockerfile[\w.]*$|\.ya?ml$/.test(p))
    .map((p) => join(dir, p))
}

/** 根 package.json 的 packageManager 里的 pnpm 版本(读不到返回 null ⇒ D2 不判,只判 D1)。 */
function readPackageManagerPnpm() {
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const m = /pnpm@(\d+\.\d+\.\d+)/.exec(String(pkg.packageManager ?? ''))
    return m ? m[1] : null
  } catch {
    return null
  }
}

/**
 * 规则 B 的成对夹具:每条"放行"都配一条"必须翻红"的反证。
 *
 * 只验放行形态的判据等于没判 —— 本仓反复栽在"自检全绿而主判定是哑的"那一型,所以
 * 除了四档文本夹具,再加一条**摘掉即翻红**的自证:拿本仓真实 workflow 文件,把 permissions
 * 块整体删掉后必须判红;若仍放行,说明这条维根本没在判东西。
 */
export function selfTest() {
  const body = 'on:\n  push:\n    branches: [main]\njobs:\n  a:\n    runs-on: ubuntu-latest\n'
  const cases = [
    { name: '顶层块放行', text: 'permissions:\n  contents: read\n' + body, want: 0 },
    { name: '无声明判红', text: body, want: 1 },
    { name: 'write-all 判红', text: 'permissions: write-all\n' + body, want: 1 },
    {
      name: '缩进进 jobs 不算顶层(反证)',
      text: body + '  a:\n    permissions:\n      contents: read\n',
      want: 1,
    },
  ]
  const failures = []
  for (const c of cases) {
    const got = judgePermissionsDeclaration(c.text).length
    if (got !== c.want) failures.push(`${c.name}: 期望 ${c.want} 条,实得 ${got} 条`)
  }

  const real = readFileSync(join(WF_DIR, 'guardian-full.yml'), 'utf8') // 规则 C 的成对夹具(npm 区间那一型是 2026-11-01 实测抓出来的:它满足人眼的"钉过了",
  // 但不满足"逐字"—— 同一枚提交在两个时间点能拿到两个不同的 npm。)
  const pinCases = [
    { name: 'C① 逐字钉版放行', text: '        run: pip install uv==0.12.1\n', want: 0 },
    { name: 'C② 完全未钉判红', text: '        run: pip install uv\n', want: 1 },
    {
      name: 'C③ 区间(@^11.15.0)不算逐字',
      text: '        run: npm install -g npm@^11.15.0\n',
      want: 1,
    },
    {
      name: 'C④ 仓内现读值供版放行',
      text: '        run: npm i -g "@tauri-apps/cli@$V"\n',
      want: 0,
    },
    {
      name: 'C⑤ 锁文件/可编辑安装放行',
      text: '        run: uv pip install --system -e ".[dev]"\n',
      want: 0,
    },
    {
      name: 'C⑥ 裸 --upgrade 判红',
      text: '          python -m pip install --upgrade pip\n',
      want: 1,
    },
    { name: 'C⑦ 非安装命令不参与', text: '        run: pnpm install --frozen-lockfile\n', want: 0 },
    {
      name: 'C⑧ 装本仓自身目录放行',
      text: '        run: uv pip install --system --no-cache-dir .\n',
      want: 0,
    },
    {
      name: 'C⑨ 变异:同一行去掉结尾的 . 仍判红',
      text: '        run: uv pip install --system --no-cache-dir\n',
      want: 1,
    },
  ]
  for (const c of pinCases) {
    const got = judgeInstallPins(c.text).length
    if (got !== c.want) failures.push(`${c.name}: 期望 ${c.want} 条,实得 ${got} 条`)
  }

  // 变异自证(规则 C 档):真实文件里把已钉的枚摘回未钉,必须翻红;摘不到样本本身就算失败。
  const ciText = readFileSync(join(WF_DIR, 'ci.yml'), 'utf8')
  if (judgeInstallPins(ciText).length !== 0) {
    failures.push('真实样本 ci.yml 本应零违规(本枚已逐字钉版)⇒ 有新的未钉安装步混进来了')
  }
  // 变异自证只动**命令行**,不动散文:ci.yml 的注释里就写着 `pip install uv==0.12.1` 这串字面量,
  // 拿裸字符串 replace 会命中注释那一枚,于是"摘掉了版本钉"其实摘的是散文 ⇒ 本维看起来在自证,实际是哑的。
  const unpinCi = ciText.replace(/^(\s*)run: pip install uv==0\.12\.1$/m, '$1run: pip install uv')
  if (unpinCi === ciText) {
    failures.push('规则 C 的反向自证未取到样本:ci.yml 里没剥掉任何 uv 版本钉')
  } else if (judgeInstallPins(unpinCi).length === 0) {
    failures.push('规则 C 反向自证不过:摘掉版本钉后仍放行 ⇒ 本维是哑的')
  }

  if (judgePermissionsDeclaration(real).length !== 0) {
    failures.push('真实样本 guardian-full.yml 本应放行 ⇒ 判据或该文件已变形')
  }
  const stripped = real.replace(/^permissions:\n(?:\s{2}\S.*\n)+/m, '')
  if (stripped === real) {
    failures.push('反向自证未取到样本:真实文件里没剥掉任何 permissions 块,这一格不成对照')
  } else if (judgePermissionsDeclaration(stripped).length === 0) {
    failures.push('反向自证不过:删掉 permissions 块后仍放行 ⇒ 本维是哑的')
  }

  // 规则 D 的成对夹具:每一条放行都配一条必须翻红的反证(§22c 用生产判据本身跑)。
  const dCases = [
    {
      name: 'D① corepack 钉到具体版本放行',
      text: 'RUN corepack enable && corepack prepare pnpm@11.18.0 --activate\n',
      pm: '11.18.0',
      want: 0,
    },
    {
      name: 'D② corepack @latest 判红(2026-11-01 实测三处即此型)',
      text: 'RUN corepack enable && corepack prepare pnpm@latest --activate\n',
      pm: '11.18.0',
      want: 1,
    },
    {
      name: 'D③ corepack 不带版本判红',
      text: 'RUN corepack prepare pnpm --activate\n',
      pm: '11.18.0',
      want: 1,
    },
    {
      name: 'D④ npm -g 具体版本放行',
      text: 'RUN npm install -g pnpm@11.18.0\n',
      pm: '11.18.0',
      want: 0,
    },
    {
      name: 'D⑤ 钉成另一个版本判红(与 packageManager 不同值;版本位本身是合法的,只违 D2)',
      text: 'RUN npm install -g pnpm@9.15.0\n',
      pm: '11.18.0',
      want: 1,
    },
    {
      name: 'D⑥ 注释里的历史版本号不判(只裁命令行)',
      text: '# 原为 node:20-alpine + pnpm@9.15.0,与根 package.json engines 冲突\nRUN apk add --no-cache tini\n',
      pm: '11.18.0',
      want: 0,
    },
    {
      name: 'D⑦ 区间(^11)不算具体版本',
      text: 'RUN npm i -g pnpm@^11.18.0\n',
      pm: '11.18.0',
      want: 1,
    },
    {
      name: 'D⑧ snapcraft 的缩进形态同样在射程',
      text: '    steps:\n      corepack prepare pnpm@latest --activate\n',
      pm: '11.18.0',
      want: 1,
    },
  ]
  for (const c of dCases) {
    const got = judgeBuildToolPins(c.text, c.pm).length
    if (got !== c.want) failures.push(`${c.name}: 期望 ${c.want} 条,实得 ${got} 条`)
  }
  // 反向自证:拿本仓真实构建文件,把已钉的 pnpm 摘回 @latest ⇒ 必须翻红;摘不到样本即本维是哑的。
  const cliDocker = readFileSync(join(ROOT, 'deploy', 'docker', 'Dockerfile.cli'), 'utf8')
  if (judgeBuildToolPins(cliDocker, readPackageManagerPnpm()).length !== 0) {
    failures.push('真实样本 Dockerfile.cli 本应零违规 ⇒ 有新的浮动工具链安装混进来了')
  }
  const floatBack = cliDocker.replace(
    'corepack prepare pnpm@11.18.0',
    'corepack prepare pnpm@latest',
  )
  if (floatBack === cliDocker) {
    failures.push('规则 D 反向自证未取到样本:Dockerfile.cli 里没摘掉任何 pnpm 版本钉')
  } else if (judgeBuildToolPins(floatBack, '11.18.0').length === 0) {
    failures.push('规则 D 反向自证不过:摘掉版本钉后仍放行 ⇒ 本维是哑的')
  }
  return failures
}

function main() {
  if (process.argv.includes('--self-test')) {
    const failures = selfTest()
    if (failures.length === 0) {
      console.log(
        '[workflow-step-order] ✅ 规则 B 自检通过(含"删掉 permissions 块即翻红"的成对自证)',
      )
      process.exit(0)
    }
    console.error(`[workflow-step-order] ❌ 规则 B 自检 ${failures.length} 条不过:`)
    for (const f of failures) console.error('  - ' + f)
    process.exit(1)
  }

  if (process.env.HUSKY_SKIP_WORKFLOW_ORDER === '1') {
    console.log('[skip] HUSKY_SKIP_WORKFLOW_ORDER=1, 跳过 workflow 步骤顺序/权限声明守门')
    process.exit(0)
  }

  const violations = scan()

  if (violations.length === 0) {
    console.log(
      '[workflow-step-order] ✅ setup-node(cache: pnpm) 均位于 pnpm/action-setup 之后;每枚 workflow 都有顶层 permissions 声明且无 write-all',
    )
    process.exit(0)
  }

  console.error(`[workflow-step-order] ❌ ${violations.length} 处违规:`)
  for (const v of violations) console.error('  - ' + v)
  console.error('')
  console.error(
    '  修复(顺序维): 把 pnpm/action-setup 步骤移到 actions/setup-node 之前(同一 job 内)。',
  )
  console.error(
    '  修复(权限维): 在文件顶层(第 0 列)写 permissions: 块,写权逐条点名;禁止 write-all。',
  )
  console.error('  跳过: HUSKY_SKIP_WORKFLOW_ORDER=1 git commit ...')
  process.exit(1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}

export const __test__ = {
  judgePermissionsDeclaration,
  judgeInstallPins,
  judgeBuildToolPins,
  listBuildFiles,
  readPackageManagerPnpm,
  selfTest,
  scan,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

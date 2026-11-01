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

export const __test__ = { judgePermissionsDeclaration, judgeInstallPins, selfTest, scan }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

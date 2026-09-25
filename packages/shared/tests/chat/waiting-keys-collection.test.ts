// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D79 装载证明(vitest 收集面)· 2026-09-25 立
//
// 起因:packages/shared/vitest.config.ts 此前**只写了 exclude**,收集全靠 vitest 默认 glob,
// 而那份注释却写着"只跑 src 下的测试" —— 注释与行为相反。`tests/chat/waiting-keys-in-end-packages.test.ts`
// 当天刚从 `packages/i18n/tests/` 搬进本包(架构契约门 103 判 D2 只看层序 rank,i18n(20) 反向依赖
// shared(30) 即红;搬进同包 = 零跨模块边,它读各端词包用 readFileSync 不构成 import 边),
// 搬来后"能跑"完全靠默认 glob 沉默地成立。下一个人若相信那句注释把 include 真收成 src/**,
// tests/ 下所有用例就**静默不再执行** —— 文件还在、全链照样绿,只是没人跑它(本仓称"造好没装车")。
//
// 于是本文件把三件事变成机器判据:
//  1. 配置必须**显式**声明 include,且 src/** 与 tests/** 两棵子树都在面内(不得退回"靠默认 glob");
//  2. `vitest list --filesOnly` 的真实收集结果里**必须**含那枚搬来的测试(证明它真被装载,不是口头判断);
//  3. 磁盘上的每一份测试文件都必须被收集,且收集面不得凭空多出磁盘上没有的路径
//     —— 这一条同时钉死"显式 include 把原有测试挤出"和"新增用例落在两棵子树之外"两种形态。
// 结论数字(55 = src 39 + tests 16)刻意不写死进断言:那会在别人加用例时把本门钉成恒红,
// 恒红门的唯一结局是逼人跳门。判据是集合关系,不是某个快照计数。
//
// 本文件的**已知局限**(实测过,不是推测):证明自己躺在 tests/** 下,所以"有人把 include 收成 src/**"
// 这一种变异**不会**让它变红 —— 收窄后 `npx vitest run` 只收集 src 的 39 份(830 例)并**照样 exit 0**,
// 本文件连同另外 15 份用例一起静默消失。挡这一型的是配置里的 assertCollectionSurface:它在**收集之前**
// 随配置文件被加载,缺子树即抛错 ⇒ 整包直接红。两把尺子各挡一侧:配置侧挡"收窄",本文件挡"收窄之外的
// 一切静默漏装"(新用例落在两棵子树之外、include 写了却写错 glob、收集面与磁盘面异形)。

import { execFile } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import vitestConfig from '../../vitest.config'

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CONFIG_PATH = join(PKG_ROOT, 'vitest.config.ts')
/** 那枚搬来的测试(相对本包根),必须出现在真实收集结果里 */
const MOVED_TEST_FILE = 'tests/chat/waiting-keys-in-end-packages.test.ts'
/** vitest 冷启动 + 依赖图解析的预算;实测本机 `vitest list --filesOnly` 约 1.8s */
const LIST_TIMEOUT_MS = 90_000

const TEST_FILE_RE = /\.(?:test|spec)\.(?:c|m)?[jt]sx?$/
/**
 * 与 vitest.config.ts 的 exclude 同义:dist 是 tsc 产物(里面躺着 src 用例的编译副本,
 * 按 D75 判据必须不跑),node_modules/.turbo/coverage 非源码。
 * 漏掉任何一项,本文件的"磁盘全集 ⇄ 收集全集"对账就会在跑过 build 的机器上恒红。
 */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo', 'coverage', '.git'])

/** vitest CLI 入口:bin=./vitest.mjs,而 exports 未放行该子路径 ⇒ 先按 './package.json' 定位包目录 */
function resolveVitestCli(): string {
  const req = createRequire(import.meta.url)
  return join(dirname(req.resolve('vitest/package.json')), 'vitest.mjs')
}

function toPosix(rel: string): string {
  return rel.split(sep).join('/')
}

/** 磁盘上真实存在的测试文件全集(相对本包根,posix 分隔符) */
function collectDiskTestFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      found.push(...collectDiskTestFiles(join(dir, entry.name)))
    } else if (entry.isFile() && TEST_FILE_RE.test(entry.name)) {
      found.push(toPosix(relative(PKG_ROOT, join(dir, entry.name))))
    }
  }
  return found
}

let listedOnce: Promise<string[]> | undefined

/** 派生 vitest 自己的收集结论(权威口径),而不是我们替它算 glob */
function listCollectedFiles(): Promise<string[]> {
  if (!listedOnce) {
    const cli = resolveVitestCli()
    listedOnce = new Promise<string[]>((fulfill, reject) => {
      execFile(
        process.execPath,
        [cli, 'list', '--filesOnly'],
        {
          cwd: PKG_ROOT,
          timeout: LIST_TIMEOUT_MS,
          // §5b:Windows 下派生控制台程序漏 windowsHide 会弹窗;守门 52 拦同一型
          windowsHide: true,
          // §5b:热路径 git/派生调用无 timeout 会把一次挂起变成全局阻塞(守门 80)
          maxBuffer: 16 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            // 子进程 stderr 由 execFile 捕获,不会漏进父进程输出面;失败原因必须带出来才好归因
            reject(new Error(`vitest list 失败: ${error.message}\n${String(stderr).trim()}`))
            return
          }
          fulfill(
            stdout
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line.length > 0 && TEST_FILE_RE.test(line)),
          )
        },
      )
    })
  }
  return listedOnce
}

describe('vitest 收集面装载证明(packages/shared)', () => {
  it('配置显式声明 include,且 src/** 与 tests/** 两棵子树都在面内', () => {
    const include = vitestConfig.test?.include
    expect(Array.isArray(include), 'test.include 必须显式存在(不得退回 vitest 默认 glob)').toBe(
      true,
    )
    const patterns = (include ?? []).map((p) => String(p))
    const coversSrc = patterns.some((p) => p.startsWith('src/'))
    const coversTests = patterns.some((p) => p.startsWith('tests/'))
    expect(coversSrc, `include 必须覆盖 src/**,现值: ${patterns.join(' | ')}`).toBe(true)
    expect(coversTests, `include 必须覆盖 tests/**,现值: ${patterns.join(' | ')}`).toBe(true)
  })

  it('配置注释不得再写回那句谎话(它正是本门的立门原因)', () => {
    // 钉的是 HEAD 里那句谎话的**完整句子形态**(`只跑 src 下的测试。`),而不是"只跑 src"三个字:
    // 上面第 1/3/4 条判据已经守住行为(include 必须双覆盖 + 磁盘⇄收集逐路径等值),这里只防同一句
    // 谎话被原样写回。needle 带句末句号 ⇒ 本文件与配置注释里"引用那句谎话并驳它"的说明文字不受伤。
    const source = readFileSync(CONFIG_PATH, 'utf8')
    expect(source).not.toContain('只跑 src 下的测试。')
  })

  it(
    '真实收集结果含那枚从 packages/i18n/tests 搬来的测试(搬完必须仍在装载面上)',
    { timeout: LIST_TIMEOUT_MS },
    async () => {
      const files = await listCollectedFiles()
      expect(files, `收集结果为空 ⇒ vitest list 没真跑出东西`).not.toHaveLength(0)
      expect(
        files.includes(MOVED_TEST_FILE),
        `${MOVED_TEST_FILE} 未被收集 = 造好没装车(见本文件头注)`,
      ).toBe(true)
      const srcCount = files.filter((f) => f.startsWith('src/')).length
      const testsCount = files.filter((f) => f.startsWith('tests/')).length
      expect(srcCount, 'src/** 一份用例都没被收集').toBeGreaterThan(0)
      expect(testsCount, 'tests/** 一份用例都没被收集').toBeGreaterThan(0)
    },
  )

  it(
    '磁盘全集 ⇄ 收集全集逐路径等值(显式 include 没把任何原有测试挤出去)',
    { timeout: LIST_TIMEOUT_MS },
    async () => {
      const disk = collectDiskTestFiles(PKG_ROOT).sort()
      const collected = [...(await listCollectedFiles())].sort()
      const dropped = disk.filter((f) => !collected.includes(f))
      const phantom = collected.filter((f) => !disk.includes(f))
      expect(
        dropped,
        `被收集面漏掉的用例(须搬进 src/**|tests/** 或加一档 glob): ${dropped.join(', ')}`,
      ).toEqual([])
      expect(phantom, `收集到磁盘上不存在的路径: ${phantom.join(', ')}`).toEqual([])
      // 磁盘侧本身必须同时含两棵子树,否则上面的等值会退化成"两边都空"的假绿
      expect(
        disk.some((f) => f.startsWith('src/')),
        '磁盘上 src/** 没有任何用例',
      ).toBe(true)
      expect(
        disk.some((f) => f.startsWith('tests/')),
        '磁盘上 tests/** 没有任何用例',
      ).toBe(true)
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

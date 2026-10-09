// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:批外 blocking 守门步的**判定面**(2026-09-28 立)。
 *
 * 守的是哪一型:`scripts/lib/pre-commit-hook.js` 在守门批(guardian-runner)**之外**还直接调
 * 若干 blocking 步。这些步旧形态按**磁盘**读被审内容,于是并行会话一个未暂存的编辑就能把无关
 * 提交钉红 —— 而恒红 blocking 的唯一结局是各会话 `--no-verify`,一次绕过约等于链上全部守门对
 * 该提交作废(AGENTS §12e/§12f;2026-09-27 的「i18n 死 key 扫描」即此型,由 `735f320c46` 收口)。
 * 本测试把那次的口径钉成四条可复用的判据:
 *
 *   F-A 索引面干净而**磁盘脏** ⇒ `--staged` 必须绿(本次修复的全部理由);
 *   F-B 索引面脏、随后把磁盘改回干净 ⇒ `--staged` 必须**仍然红**并点名 —— 这一条专门防
 *       "看着接了 --staged、实则仍读磁盘"的半接线(守门 118 的 half-wired 同型);
 *   F-C 面上取材不到(非 git 目录)/ 两面旗同给 ⇒ **exit 2「未判定」**,不得记为通过;
 *   F-D 钩子源码必须真给该步传 `--staged`(逐门一条:摘掉某一门的旗,只有那一门的那条翻红)。
 *
 * 取证纪律(§22c):判据不在测试里重写 —— 把真脚本派生起来跑,读退出码与输出;夹具走
 * `scripts/lib/scratch-dir.mjs`(不得 os.tmpdir()、不得 process.cwd() 定根);git 用绝对二进制
 * + `-c safe.directory=*` + windowsHide + timeout(只读派生,AGENTS §5b)。
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
// 守门 118 的判据**唯一实现**(§22c:测试不得再抄一份"怎样算走了取材层")。
import { usesLayerRead } from '../check-gate-face-discipline.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GIT = gitBinary()

/** 只在直接执行时跑 CLI 副作用(main() 会 process.exit)—— 本文件是测试,不触发任何门。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

function git(args, cwd) {
  return spawnSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
}

/** 造一个自带索引的小仓:files 全量写入 → add → commit(⇒ 索引面 = 好状态)。 */
function makeRepo(dir, files) {
  mkdirSync(dir, { recursive: true })
  assert.equal(git(['init', '-q'], dir).status, 0)
  git(['config', 'user.email', 't@example.com'], dir)
  git(['config', 'user.name', 'fixture'], dir)
  writeSet(dir, files)
  assert.equal(git(['add', '-A'], dir).status, 0)
  assert.equal(git(['commit', '-q', '-m', 'fixture'], dir).status, 0)
}

function writeSet(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
}

/** 只改磁盘、不 add ⇒ 索引面不动(这正是"别人的在飞编辑"的形态)。 */
function dirtyOnly(dir, rel, text) {
  writeFileSync(join(dir, rel), text, 'utf8')
}

/** 派生真门脚本:ROOT 走 --root 测试通道,git 一律 `-C <root>` ⇒ 用的是夹具自己的索引。 */
function runGate(script, args, cwd) {
  const r = spawnSync(process.execPath, [resolve(REPO, 'scripts', script), ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

/**
 * 钩子形状判据(纯函数,不碰磁盘):这一步的调用串里必须带 `--staged`。
 * @param {string} hookSource
 * @param {string} scriptName
 * @returns {{found:boolean, call:string}}
 */
export function hookFaceFlag(hookSource, scriptName) {
  const re = new RegExp(`node scripts/${scriptName.replace('.', '\\.')}[^'"]*`)
  const m = hookSource.match(re)
  return { found: !!m, call: m ? m[0] : '' }
}

const fwd = (p) => p.replace(/\\/g, '/')
const needleRe = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

// ───────────────────────── 四门的夹具内容 ─────────────────────────
// 每门:good(索引 = 磁盘 = 好状态)/ bad(同一批文件里,只有 rel 换成脏内容)。
const GATES = [
  {
    name: 'check-miniapp-taro-style-parity.mjs',
    label: 'miniapp-taro 跨端样式一致性守门',
    badNeedle: 'index.css',
    good: {
      'apps/miniapp-taro/src/app.config.ts':
        "export default defineAppConfig({ pages: ['pages/home/index'] })",
      'apps/miniapp-taro/src/app.css': '.a{color:var(--color-text)}',
      'apps/miniapp-taro/src/pages/home/index.tsx':
        "import { ThemeRoot } from '@/components/ThemeRoot'\nexport default function P(){return <ThemeRoot><View/></ThemeRoot>}\n",
      'apps/miniapp-taro/src/pages/home/index.css': '.b{color:var(--color-brand)}\n',
    },
    bad: {
      rel: 'apps/miniapp-taro/src/pages/home/index.css',
      text: '.b{color:#00f2ff}\n', // RULE-1a 禁用色板回潮
    },
  },
  {
    name: 'check-cross-store-parity.mjs',
    label: '跨端 storage-adapter parity',
    badNeedle: 'storage-adapter.ts',
    good: (() => {
      const mk = (fn) =>
        "import type { PersistTransport } from '@ihui/shared'\n" +
        `export function ${fn}(): PersistTransport { return { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } }\n`
      return {
        'apps/web/src/stores/storage-adapter.ts':
          mk('createLocalStorageTransport') + mk('createSSRSafeWebTransport'),
        'apps/mobile-rn/src/stores/storage-adapter.ts': mk('createAsyncStorageTransport'),
        'apps/miniapp-taro/src/stores/storage-adapter.ts': mk('createTaroStorageTransport'),
        'apps/extension/src/stores/storage-adapter.ts': mk('createChromeStorageTransport'),
        'packages/shared/src/stores/auth-store.ts':
          // 必须写成**今天的契约形状**(partialize 返回一份 Pick 收窄的落盘键集),不是旧的门所要求的裸字面串。
          // 门 2026-09-28/29 两度改判据(G-456 收严键集、G-601 把键集绑到 partialize 的返回值上)之后,
          // 这份桩就一直"找不到 partialize" ⇒ F-A 的 good 面本身不合规,那一条绿永远拿不到,
          // 而它要证的"索引干净而磁盘脏 ⇒ --staged 不得红"就从此没被证明过。
          "userPersistKey = 'ihui-auth-user'\n" +
          'export interface AuthStoreState<TUser> { user: TUser | null; token: string | null }\n' +
          'export function buildAuthStorePersistOptions<TUser>() { return { partialize: (state: AuthStoreState<TUser>) => {\n' +
          "  const persisted: Pick<AuthStoreState<TUser>, 'user'> = { user: state.user }\n" +
          '  return persisted\n' +
          '} } }\n',
      }
    })(),
    bad: {
      rel: 'apps/miniapp-taro/src/stores/storage-adapter.ts',
      // 缺 setItem/removeItem 且不再引用 transport 契约
      text: "export function createTaroStorageTransport(): unknown { return { getItem: async () => null } }\n",
    },
  },
  {
    name: 'check-capability-matrix.mjs',
    label: '能力矩阵对账',
    badNeedle: 'FIXTURE_NEW_OFF_ENABLED',
    good: {
      'apps/ai-service/app/core/capability_matrix.py':
        'CAPABILITIES = [\n    {"env": "FIXTURE_REAL_ENABLED", "category": "flag", "reason": "x"},\n]\n',
      'apps/ai-service/app/services/a.py':
        'import os\nFLAG = os.environ.get("FIXTURE_REAL_ENABLED", "false")\n',
    },
    bad: {
      rel: 'apps/ai-service/app/services/a.py',
      text:
        'import os\nFLAG = os.environ.get("FIXTURE_REAL_ENABLED", "false")\nNEW = os.environ.get("FIXTURE_NEW_OFF_ENABLED", "false")\n',
    },
  },
  {
    name: 'check-site-footer.mjs',
    label: 'SiteFooter 守门',
    badNeedle: 'footer.companyName',
    good: (() => {
      const SF =
        'className="py-2 md:py-3 h-7 w-7 h-16 w-16 h-5 w-5 object-contain xl:grid-cols-5"\n' +
        "useTranslations('footer')\nINTERNATIONAL_MODELS\nCHINESE_MODELS\n" +
        "titleKey: 'internationalModels'\ntitleKey: 'chineseModels'\ntitleKey: 'a'\ntitleKey: 'b'\ntitleKey: 'c'\n"
      const FD =
        'export const INTERNATIONAL_MODELS = [\n  {nameKey:"a"},\n  {nameKey:"b"},\n  {nameKey:"c"},\n  {nameKey:"d"},\n]\n' +
        'export const CHINESE_MODELS = [\n  {nameKey:"e"},\n  {nameKey:"f"},\n  {nameKey:"g"},\n  {nameKey:"h"},\n]\n' +
        'export const MODELS = []\n'
      const pack = (lang) =>
        JSON.stringify({
          footer: {
            internationalModels: 'i',
            chineseModels: 'c',
            agreementSubtitle: 'a',
            contactSubtitle: 'k',
            userAgreement: 'u',
            privacyPolicy: 'p',
            aboutUs: 'o',
            contactUs: 'n',
            companyName: 'IHUI',
            icp: '1',
            copyright: '2',
            modelItems: Object.fromEntries(
              ['claude', 'gpt', 'gemini', 'deepseek', 'qwen', 'doubao', 'llama', 'mistral'].map(
                (k) => [k, 'v'],
              ),
            ),
            databases: Object.fromEntries(
              ['mongodb', 'mysql', 'postgresql', 'redis', 'sqlite'].map((k) => [k, 'v']),
            ),
          },
          other: { hi: lang },
        })
      const files = {
        'apps/web/src/components/marketing/SiteFooter.tsx': SF,
        'apps/web/src/components/marketing/footer-data.ts': FD,
      }
      for (const l of ['zh-CN', 'en', 'zh-TW', 'ko', 'ja'])
        files[`packages/i18n/messages/web/${l}.json`] = pack(l)
      return files
    })(),
    bad: {
      rel: 'packages/i18n/messages/web/ko.json',
      text: JSON.stringify({ footer: { modelItems: {}, databases: {} }, other: { hi: 'x' } }),
    },
  },
]

let tmp = null
before(() => {
  tmp = mkScratch('hook-outside-batch-face-')
})
after(() => {
  if (tmp) rmScratch(tmp)
})

for (const g of GATES) {
  const dir = () => join(tmp, g.name.replace(/[^a-z]/gi, '_'))
  const faceArgs = (extra = []) => ['--root', fwd(dir()), '--staged', ...extra]

  test(`[${g.label}] F-A 索引面干净而磁盘脏 ⇒ --staged 必须绿(修复的全部理由)`, () => {
    rmSync(dir(), { recursive: true, force: true })
    makeRepo(dir(), g.good)
    dirtyOnly(dir(), g.bad.rel, g.bad.text)
    const { status, out } = runGate(g.name, faceArgs(['--quiet']), dir())
    assert.equal(status, 0, `别人未暂存的磁盘改动不得钉红本次提交,实得:\n${out}`)
    assert.match(out, /索引 blob/, '结论行必须自报判定面(否则绿也读不出判的是哪一份)')
  })

  test(`[${g.label}] F-B 违规已进索引而磁盘已洗白 ⇒ 仍须红并点名 ${g.badNeedle}`, () => {
    rmSync(dir(), { recursive: true, force: true })
    makeRepo(dir(), { ...g.good, [g.bad.rel]: g.bad.text })
    // 索引里是脏的那一份,磁盘改回干净 ⇒ 只有真按索引面判才会红。
    dirtyOnly(dir(), g.bad.rel, g.good[g.bad.rel])
    const { status, out } = runGate(g.name, faceArgs(['--quiet']), dir())
    assert.equal(status, 1, '面上有违规而磁盘"洗白" ⇒ 必须仍红,否则就是仍读磁盘的半接线')
    assert.match(out, needleRe(g.badNeedle), `红必须点名被违反的文件/条目,实得:\n${out}`)
    assert.match(out, /不回退磁盘|判定面:索引 blob|索引 blob/)
  })

  test(`[${g.label}] F-C 面上取不到 / 两面旗同给 ⇒ exit 2 未判定,绝不记为通过`, () => {
    const plain = join(dir(), '_plain')
    rmSync(dir(), { recursive: true, force: true })
    mkdirSync(plain, { recursive: true })
    writeSet(plain, g.good) // 磁盘一切齐备,但**没有 git 仓** ⇒ 索引面根本不存在
    const noRepo = runGate(g.name, ['--root', fwd(plain), '--staged', '--quiet'], plain)
    assert.equal(noRepo.status, 2, `非 git 目录跑 --staged ⇒ 未判定,实得 ${noRepo.status}:\n${noRepo.out}`)
    assert.match(noRepo.out, /无法判定|未判定/)
    assert.doesNotMatch(noRepo.out, /✅|通过 \(0|无违规/, '不得把"没判"印成"判过了且干净"')

    makeRepo(dir(), g.good)
    const both = runGate(g.name, ['--root', fwd(dir()), '--staged', '--worktree', '--quiet'], dir())
    assert.equal(both.status, 2, '两面旗同给 = 判据互斥,必须判死而不是任选一面')
  })

  test(`[${g.label}] F-D 钩子必须给这一步传 --staged(摘掉旗只让这一条翻红)`, () => {
    const hook = readHookSource()
    const real = hookFaceFlag(hook, g.name)
    assert.ok(real.found, `钩子里找不到对 ${g.name} 的调用 ⇒ 门已脱钩(判据存在而无人调度 = 没有)`)
    assert.match(
      real.call,
      /--staged/,
      `${g.name} 在提交链上仍按磁盘判 ⇒ 别人的在飞改动能钉红无关提交`,
    )
    // 变异自证:同一把尺子喂"摘掉 --staged 的内存副本"必须翻红 —— 否则 F-D 只是恒真断言。
    const mutated = hook.replace(real.call, real.call.replace(' --staged', ''))
    assert.notEqual(mutated, hook, '构造变异失败(串没换掉),这条锁等于没有')
    assert.doesNotMatch(hookFaceFlag(mutated, g.name).call, /--staged/, '变异后仍判绿 ⇒ 本锁无牙')
  })

  test(`[${g.label}] F-E 门体必须真的调用取材层读取入口(否则 = 半接线,守门 118 判红那一型)`, () => {
    // 判据不在这里重写:直接喂守门 118 自己的 usesLayerRead —— "引了 face-reader 却没用它读内容"
    // 正是该门 2026-09-26 收紧要防的那一型(门 36 / 124 当时的实证)。
    const src = readFileSync(resolve(REPO, 'scripts', g.name), 'utf8')
    assert.ok(/face-reader\.mjs/.test(src), `${g.name} 未引入 scripts/lib/face-reader.mjs`)
    assert.equal(usesLayerRead(src), true, `${g.name} 引了层却没有真的调用其读取入口 ⇒ half-wired`)
  })
}

/** 钩子源码现读:它判的是"接线形状",工作树面即可(索引/HEAD 面滞后反而看不见本次收口)。 */
function readHookSource() {
  const p = join(REPO, 'scripts', 'lib', 'pre-commit-hook.js')
  assert.ok(existsSync(p), `钩子文件不在位:${p}`)
  return readFileSync(p, 'utf8')
}

if (isDirectRun) {
  // 本文件只由 `node --test` 驱动;直接执行时不跑任何门,给出可诊断提示。
  console.log('用 `node --test scripts/tests/check-hook-outside-batch-face.test.mjs` 跑本套。')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

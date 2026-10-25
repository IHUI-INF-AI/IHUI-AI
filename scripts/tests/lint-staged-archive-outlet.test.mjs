// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 归档件 lint-staged 就近出口(2026-10-20 立)的镜像测试 —— 本文件不复制任何 glob 语义,
// 判据一律 import lint-staged 自己的导出(matchFiles / groupFilesByConfig / validateConfigLogic)。
//
// 立项原因(实锤,现读 .ihui-agent/state/hook-logs/pre-commit.log:106281-106284):`.gitignore` 第 167/169 行
// 忽略 `.ihui-agent/*` 与 `.ihui-agent/archive/`,而 archive 下的 .md 是**已跟踪**的归档凭据(守门 71/166
// 拿它们当"正当删行"依据)。任何经 `node scripts/safe-commit.mjs` 的提交,只要声明集里含
// `.ihui-agent/archive/*.md`,根 package.json 的 lint-staged glob `*.{ts,tsx,js,jsx,json,md,yml,yaml,css,scss}`
// 就把它们纳入任务集;收尾那次 `git add -- <绝对路径>`(不带 -f,lint-staged@17.3.0 `lib/gitWorkflow.js:381-400`,
// 且它 add 的是"进过任务集的全部文件",与内容有没有被改无关)被 git 拒绝:
//   `The following paths are ignored by one of your .gitignore files: .ihui-agent/archive` + `hint: Use -f`
//   ⇒ `✖ lint-staged failed due to a git error` ⇒ 整批 264 道守门一道都没跑。
// 唯一官方出口 = 就近配置文件:`lib/searchConfigs.js` 用
// `git ls-files -z --full-name -t --cached --others --exclude-standard -- ':(glob)**/.lintstagedrc.json'`
// 找各目录的就近 config,`lib/groupFilesByConfig.js` 再把该目录下的文件整体划给它(glob 一条都不匹配
// ⇒ 既不跑任务也不 re-stage)。CLI 没有"跳过 ignored 文件"的开关,也没有 `--no-restage`;函数式配置的
// 筛选只影响命令行、不影响 re-stage,救不了。
//
// 端到端实测(2026-10-20,结论 = 成立,未证伪)。夹具落在 `mkScratch()`(工作树外,
// G:/DevEnv/Temp/ihui-scratch/ls-archive-outlet-*,§15c/门 208 禁止仓库树内 git init);驱动件
// `.ihui-agent/tmp/lint-staged-archive-outlet/exp.mjs`(gitignored,不入库)。夹具复刻本仓形状:`.gitignore`
// 写 `.agent/*` + `.agent/archive/`,archive 下两枚已跟踪 md 改写后 `git add -f` 暂存,另放一枚不受影响的
// `root.md` 作正向对照;根配置 `{ "*.md": "node mutate.mjs" }`,mutate 真改文件(否则走不到 updateIndex)。
// 走 lint-staged 编程入口(cwd = 夹具,**不传** config/configPath —— 传了会进 singleConfigMode、跳过就近
// 发现逻辑,等于自废实测),末行读数:
//   A 基线(无就近 config):result=false;任务集 `*.md — 3 files`;
//     `✖ Failed to stage changes from tasks!` / `✖ lint-staged failed due to a git error.`
//     stderr:`The following paths are ignored by one of your .gitignore files: .agent/archive`
//   B 对照(archive/.lintstagedrc.json 已 `git add -f`):result=true;任务集 `package.json — 1 file` /
//     `*.md — 1 file`(只剩 root.md ⇒ archive 两枚整体被跳过);
//     `✔ Done staging changes from tasks!` / `✔ Done cleaning up temporary files!`
//     索引读数:`root.md` = `# root\nsecond line\nx`(任务照旧生效)、`archive/a.md` = `# a\nsecond line`
//     (未被改写也未被重复 add)⇒ 出口只把 archive 划走,不缩小根配置射程。
//   C 反证(就近 config 只在盘上、未入库):result=false,与 A 同形炸 ⇒ ① 的"已跟踪"是承重条件:
//     被忽略的未跟踪文件进不了 `--others --exclude-standard`,而 `listConfigFilesFromFs` 只从 cwd **向上**找、
//     不会向下发现子目录 config ⇒ 没入库的就近 config 对 lint-staged 等于不存在。
// 写法可用性实测(lint-staged 自己的 validateConfigLogic + matchFiles,输入 = archive 下 11 枚已跟踪文件):
//   `{ "*.archive-noop": "node -e 0" }` → 校验原样通过、命中 0;
//   `_comment` 型字符串字段**也**能通过校验,但它的值被登记成"该 pattern 对应的命令"(实测 keys =
//   `['*.archive-noop','_comment']`,值原样当命令留着)⇒ 一句说明变成一条潜在可执行命令,不采用;
//   说明只写在本文件。
//   水印:JSON 不在 `scripts/watermark.mjs` 的 EXT_MAP 内,`inject` 实报 `skip-type`、`verify` 实报
//   `覆盖 0/0 个指定文件`(故出口件天然不进水印覆盖面,由下面 T5 的 `injectableRel` 钉住),只给本 .mjs 注入。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { __test__ as WM } from '../watermark.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ARCHIVE_REL = '.ihui-agent/archive'
const OUTLET_REL = `${ARCHIVE_REL}/.lintstagedrc.json`
const OUTLET_ABS = path.join(ROOT, ...OUTLET_REL.split('/'))
const ROOT_PKG_ABS = path.join(ROOT, 'package.json')

const posix = (p) => p.replace(/\\/g, '/')
const ROOT_POSIX = posix(ROOT)

/** 派生 git 必须显式接管 stdio(AGENTS §12g);本文件全程只读,零写操作。 */
function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
}

const lib = async (name) =>
  import(pathToFileURL(path.join(ROOT, 'node_modules/lint-staged/lib', name)).href)

const { matchFiles } = await lib('matchFiles.js')
const { groupFilesByConfig } = await lib('groupFilesByConfig.js')
const { validateConfigLogic } = await lib('validateConfig.js')
const { searchConfigs } = await lib('searchConfigs.js')

const silentLogger = { error: () => {}, warn: () => {}, log: () => {} }

/** archive 目录下全部**已跟踪**文件(含出口件本身),即 lint-staged 会划进任务集的候选集。 */
function trackedArchiveFiles() {
  const out = git(['ls-files', '-z', '--', ARCHIVE_REL])
    .split('\0')
    .filter(Boolean)
    .map((rel) => ({ filepath: `${ROOT_POSIX}/${rel}`, status: 'M' }))
  if (!out.some((f) => f.filepath.endsWith(`/${OUTLET_REL}`)) && existsSync(OUTLET_ABS)) {
    out.push({ filepath: `${ROOT_POSIX}/${OUTLET_REL}`, status: 'M' })
  }
  return out
}

function rootConfig() {
  const cfg = JSON.parse(readFileSync(ROOT_PKG_ABS, 'utf8'))['lint-staged']
  assert.ok(
    cfg && typeof cfg === 'object',
    `取材不到根 package.json 的 lint-staged 配置 ⇒ 未判定(§0.3)`,
  )
  return validateConfigLogic(cfg, ROOT_PKG_ABS, silentLogger)
}

function outletConfig() {
  assert.ok(existsSync(OUTLET_ABS), `就近出口文件不在盘上:${OUTLET_REL}`)
  const raw = JSON.parse(readFileSync(OUTLET_ABS, 'utf8'))
  return validateConfigLogic(raw, OUTLET_ABS, silentLogger)
}

test('① 就近出口存在且已在索引里跟踪(未入库 = 对 lint-staged 等于不存在)', async () => {
  const tracked = git(['ls-files', '--', OUTLET_REL]).trim()
  assert.ok(
    tracked.length > 0,
    `${OUTLET_REL} 不在索引里 ⇒ searchConfigs 的 git 枚举(--cached ∪ --others --exclude-standard)看不见它` +
      `(该目录被 .gitignore 忽略),就近出口整体失效、事故照旧。出路:git add -f ${OUTLET_REL}`,
  )
  // 端到端:用 lint-staged 自己的发现逻辑复证,而不是只看 ls-files
  const found = Object.keys(
    await searchConfigs({ cwd: ROOT, topLevelDir: ROOT }, silentLogger),
  ).map(posix)
  assert.ok(
    found.some((k) => k.endsWith(OUTLET_REL)),
    `lint-staged 自己没发现就近出口(config 枚数 ${found.length}:${found.join(', ')})`,
  )
  const files = trackedArchiveFiles()
  assert.ok(files.length > 0, `${ARCHIVE_REL} 下已跟踪文件枚举到 0 ⇒ 本测试无输入,不记绿(§0.3)`)
})

test('② 出口声明的 glob 对 archive 下任何已跟踪文件一条都不命中,且射程不外溢', async () => {
  const cfg = outletConfig()
  const patterns = Object.keys(cfg)
  assert.ok(
    patterns.length > 0,
    '空配置会被 validateConfig 拒(lib/validateConfig.js:40),这里必须非空',
  )
  const archive = trackedArchiveFiles()
  for (const pattern of patterns) {
    const hits = matchFiles(archive, pattern, ROOT_POSIX)
    assert.equal(
      hits.length,
      0,
      `出口的 glob "${pattern}" 命中了 archive 下 ${hits.length} 枚已跟踪文件(${hits
        .map((h) => path.posix.basename(h.filepath))
        .join(', ')})⇒ 它又开始跑任务、又会 re-stage 失败`,
    )
  }
  // 用 lint-staged 自己的分组逻辑证"不外溢":桶里只准装 archive 的文件
  const rootCfg = rootConfig()
  const bystander = { filepath: `${ROOT_POSIX}/AGENTS.md`, status: 'M' }
  const grouped = await groupFilesByConfig({
    configs: { [posix(OUTLET_ABS)]: cfg, [posix(ROOT_PKG_ABS)]: rootCfg }, // 深者在前,同 searchConfigs
    files: [...archive, bystander],
  })
  const outletBucket = grouped[posix(OUTLET_ABS)].files
  assert.deepEqual(
    outletBucket.map((f) => f.filepath),
    archive.map((f) => f.filepath),
    '出口桶必须恰好等于 archive 全集(少一枚 = 那枚又回到根配置)',
  )
  assert.ok(
    !outletBucket.some((f) => f.filepath === bystander.filepath),
    '出口把 archive 之外的文件也划走了(glob 以 .. 开头或写了全域 pattern)= 整仓守门静默失效',
  )
  assert.deepEqual(
    grouped[posix(ROOT_PKG_ABS)].files.map((f) => f.filepath),
    [bystander.filepath],
    '根配置桶只准留下 archive 之外的文件',
  )
})

test('③ 前提仍在:根配置的 md 档确实覆盖 archive/*.md(别人改了根配置就当场点名,不放空转)', () => {
  const cfg = rootConfig()
  const archiveMd = trackedArchiveFiles().filter((f) => f.filepath.endsWith('.md'))
  assert.ok(archiveMd.length > 0, 'archive 下枚举不到已跟踪 .md ⇒ 未判定(§0.3),不得记绿')
  const covering = Object.keys(cfg).filter(
    (pattern) => matchFiles(archiveMd, pattern, ROOT_POSIX).length > 0,
  )
  assert.ok(
    covering.length > 0,
    `根配置里已无任何 glob 命中 ${ARCHIVE_REL}/*.md(实测 ${archiveMd.length} 枚 .md 全不命中)。` +
      `此时"没有就近 config 必炸"这一前提不再成立,应连出口件一起撤掉,而不是留着让本测试空转`,
  )
})

test('④ 反证:抽掉就近 config(纯函数,不真删文件),archive 文件必须落回根配置任务集', async () => {
  const archive = trackedArchiveFiles()
  const withOutlet = await groupFilesByConfig({
    configs: { [posix(OUTLET_ABS)]: outletConfig(), [posix(ROOT_PKG_ABS)]: rootConfig() },
    files: archive,
  })
  const withoutOutlet = await groupFilesByConfig({
    configs: { [posix(ROOT_PKG_ABS)]: rootConfig() },
    files: archive,
  })
  const leakedBack = withoutOutlet[posix(ROOT_PKG_ABS)].files.length
  assert.equal(
    leakedBack,
    archive.length,
    '抽掉出口后 archive 文件没有全部回到根配置 ⇒ 本反证没有牙',
  )
  assert.ok(
    withOutlet[posix(ROOT_PKG_ABS)].files.length === 0 &&
      (withOutlet[posix(OUTLET_ABS)]?.files.length ?? 0) === archive.length,
    '装载态与缺失态必须形状相反,否则 ④ 与 ② 判的是同一件事',
  )
})

test('⑤ 出口件写法被 lint-staged 校验接受,且天然不进水印覆盖面(说明只许写在这里)', () => {
  const raw = JSON.parse(readFileSync(OUTLET_ABS, 'utf8'))
  const keys = Object.keys(raw)
  assert.equal(
    keys.length,
    1,
    '出口只留一条哑任务;多一条就多一次"值被当命令"的机会(见头注 _comment 实测)',
  )
  assert.equal(typeof raw[keys[0]], 'string')
  const validated = validateConfigLogic(raw, OUTLET_ABS, silentLogger)
  assert.deepEqual(
    Object.keys(validated),
    keys,
    'validateConfig 改写了 pattern ⇒ 命中集与本测试判的不是同一份',
  )
  for (const pattern of keys) {
    assert.ok(
      !pattern.startsWith('..'),
      `pattern "${pattern}" 以 .. 开头 = 接管全仓文件(groupFilesByConfig)`,
    )
  }
  assert.equal(
    WM.injectableRel(OUTLET_REL),
    false,
    '水印层认为 .json 可注入 ⇒ 出口件必须带载荷,而 inject 实报 skip-type;两头对不上要先改一处',
  )
})

const OUTLET_BASENAME = '.lintstagedrc.json'
const ROOT_KEY = posix(ROOT_PKG_ABS)
const asCandidates = (rels) =>
  rels.map((rel) => ({ filepath: `${ROOT_POSIX}/${rel}`, status: 'M' }))

/** 全仓「已跟踪却被 .gitignore 覆盖」集(现读,不写死枚数)。 */
function ignoredTrackedFiles() {
  return git(['ls-files', '-ci', '--exclude-standard', '-z']).split('\0').filter(Boolean).map(posix)
}

const hitByRoot = (rel, patterns) =>
  patterns.some((p) => matchFiles(asCandidates([rel]), p, ROOT_POSIX).length > 0)

/**
 * 仍会炸的目录集:目录下存在"已跟踪 ∧ 被忽略 ∧ 被根 glob 命中"的文件。
 * 它由现读现算得出 ⇒ 任何**新增目录**会自动进入 ⑥ 的四臂检查,不需要人工往本文件补名录;
 * 反过来,某目录若已按 (b) 路线脱离忽略形态(或根 glob 不再覆盖),它就自动退出,不空转。
 */
function explosionDirs() {
  const patterns = Object.keys(rootConfig())
  return [
    ...new Set(
      ignoredTrackedFiles()
        .filter((rel) => hitByRoot(rel, patterns))
        .map((rel) => path.posix.dirname(rel)),
    ),
  ].sort()
}

async function discoveredConfigMap() {
  const found = await searchConfigs({ cwd: ROOT, topLevelDir: ROOT }, silentLogger)
  const out = {}
  for (const [k, v] of Object.entries(found)) out[posix(k)] = v
  return out
}

function trackedUnder(dir) {
  return git(['ls-files', '-z', '--', dir])
    .split('\0')
    .filter(Boolean)
    .map((rel) => ({ filepath: `${ROOT_POSIX}/${rel}`, status: 'M' }))
}

const relFromAbs = (abs) => posix(path.relative(ROOT, abs))

test('⑥ 新增目录的出口件同样满足①②③④(仍会炸的目录自动纳入,无需人工补名录)', async () => {
  const patterns = Object.keys(rootConfig())
  const dirs = explosionDirs()
  assert.ok(
    dirs.length > 0,
    '现读没有任何目录仍含"已跟踪 ∧ 被忽略 ∧ 被根 glob 命中"的文件 ⇒ 前提消失,应连出口件一起撤,而不是空转',
  )
  assert.ok(
    dirs.includes(ARCHIVE_REL),
    `archive 已不在仍会炸的目录集(现读 ${dirs.join(', ')})⇒ 本文件的 archive 四臂失去对象,要先对账`,
  )
  const configs = await discoveredConfigMap()
  const bystander = { filepath: `${ROOT_POSIX}/AGENTS.md`, status: 'M' }
  for (const dir of dirs) {
    const outletRel = `${dir}/${OUTLET_BASENAME}`
    const outletAbs = path.join(ROOT, ...outletRel.split('/'))
    const sub = trackedUnder(dir)
    const boom = ignoredTrackedFiles().filter(
      (rel) => rel.startsWith(`${dir}/`) && hitByRoot(rel, patterns),
    )
    assert.ok(sub.length > 0, `${dir}: 子树枚举不到已跟踪文件 ⇒ 无输入,不记绿(§0.3)`)
    assert.ok(
      boom.length > 0,
      `${dir}: 枚举不到根 glob 能命中的 ignored-tracked 文件 ⇒ 出口件已无对象`,
    )

    // ① 出口件存在、已在索引里、且被 lint-staged 自己的 searchConfigs 发现
    assert.ok(existsSync(outletAbs), `新增目录缺就近出口:${outletRel}(照 archive 同形同写法建)`)
    assert.ok(
      git(['ls-files', '--', outletRel]).trim().length > 0,
      `${outletRel} 不在索引里 ⇒ 对被忽略目录等于不存在。出路:git add -f ${outletRel}`,
    )
    assert.ok(
      Object.keys(configs).some((k) => k.endsWith(`/${outletRel}`)),
      `lint-staged 没发现就近出口:${outletRel}`,
    )

    // ② 出口 glob 对本目录已跟踪文件一条都不命中,且出口桶恰等于本目录全集(不外溢)
    const cfg = validateConfigLogic(
      JSON.parse(readFileSync(outletAbs, 'utf8')),
      outletAbs,
      silentLogger,
    )
    for (const pattern of Object.keys(cfg)) {
      const hits = matchFiles(sub, pattern, ROOT_POSIX)
      assert.equal(
        hits.length,
        0,
        `${outletRel}: glob "${pattern}" 命中本目录 ${hits.length} 枚已跟踪文件 ⇒ 又跑任务又 re-stage 失败`,
      )
    }
    const grouped = await groupFilesByConfig({
      configs,
      files: [...sub, bystander],
    })
    assert.deepEqual(
      (grouped[posix(outletAbs)]?.files ?? []).map((f) => f.filepath).sort(),
      sub.map((f) => f.filepath).sort(),
      `${outletRel}: 出口桶 ≠ 本目录全集(少一枚 = 那枚回根配置继续炸;多一枚 = 射程外溢)`,
    )
    assert.deepEqual(
      (grouped[ROOT_KEY]?.files ?? []).map((f) => f.filepath),
      [bystander.filepath],
      `${outletRel}: 根配置桶应只剩本目录之外的对照文件`,
    )

    // ③ 前提仍在:根配置确实覆盖本目录下那批 ignored-tracked 文件的扩展名
    const covering = Object.keys(rootConfig()).filter(
      (pattern) => matchFiles(asCandidates(boom), pattern, ROOT_POSIX).length > 0,
    )
    assert.ok(
      covering.length > 0,
      `${dir}: 根配置已无任何 glob 命中该目录 ${boom.length} 枚 ignored-tracked 文件 ⇒ 出口件已无对象,应撤`,
    )

    // ④ 变异对照(纯函数,不真删文件):抽掉本目录出口 ⇒ 本目录已跟踪文件全部落回根配置
    const withoutOutlet = { ...configs }
    delete withoutOutlet[posix(outletAbs)]
    const leaked = await groupFilesByConfig({ configs: withoutOutlet, files: sub })
    assert.equal(
      (leaked[ROOT_KEY]?.files ?? []).length,
      sub.length,
      `${outletRel}: 抽掉出口后本目录文件没有全部回根配置 ⇒ 本目录的 ④ 没有牙`,
    )
  }
})

test('⑦ 收口复量:被根 glob 命中的 ignored-tracked 文件必须被现役出口件全部中和(残留=0)', async () => {
  const patterns = Object.keys(rootConfig())
  const boom = ignoredTrackedFiles().filter((rel) => hitByRoot(rel, patterns))
  assert.ok(boom.length > 0, '现读没有会炸的 ignored-tracked 文件 ⇒ 前提消失,应连本测试一起撤')
  const configs = await discoveredConfigMap()
  const bystander = { filepath: `${ROOT_POSIX}/AGENTS.md`, status: 'M' }
  const grouped = await groupFilesByConfig({
    configs,
    files: [...asCandidates(boom), bystander],
  })
  const leaked = (grouped[ROOT_KEY]?.files ?? [])
    .map((f) => relFromAbs(f.filepath))
    .filter((rel) => boom.includes(rel))
  assert.deepEqual(
    leaked,
    [],
    `${leaked.length} 枚仍会被根 lint-staged glob 命中且没被任何现役出口件中和(${leaked.slice(0, 8).join(', ')})` +
      '⇒ 谁把它们带进声明集,那枚提交的整批守门就在 lint-staged 一步全废',
  )
  assert.ok(
    (grouped[ROOT_KEY]?.files ?? []).some((f) => f.filepath === bystander.filepath),
    '对照文件也被出口件划走了 ⇒ 射程外溢',
  )
})

/** 核心取材/判定小工具,供别处 import(§22d 双形态:被 import 时不触发任何 CLI 动作)。 */
export const __test__ = {
  trackedArchiveFiles,
  rootConfig,
  outletConfig,
  ignoredTrackedFiles,
  explosionDirs,
  discoveredConfigMap,
  OUTLET_REL,
  ARCHIVE_REL,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// 被 `node --test` 拉起时 NODE_TEST_CONTEXT 已在,不当作 CLI 直跑 ⇒ 不往测试输出里插一行噪声。
if (isDirectRun && !process.env.NODE_TEST_CONTEXT) {
  console.info(
    '本文件是 node:test 用例,请用 `node --test scripts/tests/lint-staged-archive-outlet.test.mjs` 跑(§22d 双形态守卫)。',
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

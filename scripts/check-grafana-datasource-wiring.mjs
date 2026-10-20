#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 222 · Grafana 大屏 ↔ 数据源 接线对账
 *
 * 立因(2026-10-17 量出来的同型病,和门 220 是一棵树上两颗果子):
 *   门 220 管的是「大屏查的指标名在代码里有没有发射点」;本门管的是**再上一层**——
 *   「大屏引用的数据源本身存不存在」。实测:24 张大屏 100% 只引用 Prometheus,
 *   而 provisioning 里 Loki 与 Jaeger 声明了三年、零个面板使用(死配置);
 *   反向的风险同样真:面板里写个 uid 打错字,Grafana 只会静静显示 "Datasource not found",
 *   不报错、不告警,和"这业务本来就没流量"看起来一模一样。
 *
 * 两条判据,刻意分成两种后果:
 *   A(判红 / blocking)面板引用了 provisioning 里不存在的数据源 uid。
 *     这是纯静态的、100% 确定的错 —— 引用的那一刻就注定是块空板,没有"也许它以后会有"的余地。
 *   B(只报数 / 不判红)provisioning 声明了、但没有任何面板在用的数据源。
 *     不判红是因为"基建没部署"是合法状态(本机 Jaeger 就只在 docker-compose 的
 *     observability profile 里存在,原生 nssm 部署没有它),把它判红就是 §12e 恒红门。
 *     但它必须被**报出来**——死配置正是这次要根治的东西,不报就等于默许它继续躺着。
 *
 * 判据复用:数据源块的切分与 uid 推导一律 import `sync-grafana-live-provisioning.mjs`
 * 的 splitBlocks(§22c 同一件事只许一份实现)。本文件不复制第二份 YAML 解析。
 *
 * 覆盖面(2026-10-17 扩面;2026-10-17 补齐第三棵树):仓里全部三棵 Grafana 树(现读
 * `git ls-files | grep grafana/dashboards/` 目录集合,自检 S5 做覆盖锁),都要对账 ——
 *   · monitoring/grafana(本机 Grafana 直载,含 Loki 数据源)
 *   · deploy/observability/grafana(部署环,只有 Prometheus + Jaeger)
 *   · deploy/saas/grafana(SaaS 托管环,P1-2.3;**曾因不在覆盖面而对 CI 失明**:
 *     两份大屏共 10 处硬编码 Grafana 样例数据源 uid "PBFA97CFB590B2093",
 *     该 uid 在全仓任何 provisioning 里都不存在,这 10 处引用无一能解析)
 * 对账按**树**分组:每棵树的面板只对本树的 provisioning 负责。合并成一个大池会
 * 假放行 —— 部署环根本没配 Loki,它的面板若引 Loki 就是悬空的,拿 monitoring 的
 * Loki 配置给它背书等于放死配置过关(2026-10-17 实测:agent-runtime.json 8 处
 * 小写 "prometheus" 全部悬空,Grafana 静静显示 Datasource not found)。
 *
 * 判定面取材(2026-10-17 收口,本案自带教训):
 *   全量档 = HEAD blob、`--staged` = **索引 blob**、`--worktree` = 磁盘(人工逃生舱)。
 *   本文件一律经 `scripts/lib/face-reader.mjs` 取材,不自己派生 git 取 blob 正文
 *   (门 118 明确禁止)。这里踩过的坑值得留档:第一版把 `--staged` **错映射成 'HEAD'**,
 *   于是提交链判的根本不是索引 —— 工作树明明改对了 uid,门却红在 HEAD 的旧内容上,
 *   读者会误以为"改了没用"。这不是判据错,是取材错:判据面 ≠ 提交面。
 *
 * 用法:
 *   node scripts/check-grafana-datasource-wiring.mjs            # 全量档(HEAD blob)
 *   node scripts/check-grafana-datasource-wiring.mjs --staged   # 索引面(提交链用)
 *   node scripts/check-grafana-datasource-wiring.mjs --worktree # 工作树(本地自查)
 *   node scripts/check-grafana-datasource-wiring.mjs --self-test
 */
import { readdirSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'
import { splitBlocks } from './sync-grafana-live-provisioning.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 三棵 Grafana 树。dashboards = 面板目录(仓库内相对路径前缀);
 * provisioning = 该树自己的数据源 provisioning(相对路径)。
 * 覆盖锁见 selfTest S5 与镜像测试(仓里任何 grafana/dashboards 目录都必须在此登记)。
 */
const DASHBOARD_TREES = [
  {
    label: 'monitoring',
    dashboards: 'monitoring/grafana/dashboards',
    provisioning: 'monitoring/grafana/provisioning/datasources/datasources.yml',
  },
  {
    label: 'deploy/observability',
    dashboards: 'deploy/observability/grafana/dashboards',
    provisioning: 'deploy/observability/grafana/provisioning/datasources/datasources.yml',
  },
  {
    label: 'deploy/saas',
    dashboards: 'deploy/saas/grafana/dashboards',
    provisioning: 'deploy/saas/grafana/provisioning/datasources/prometheus.yml',
  },
]

/** uid 未显式声明时,Grafana 会用 name 当 uid(与派生器的补 uid 规则同源)。 */
function collectProvisionedUids(text) {
  const { blocks } = splitBlocks(text)
  const out = new Map()
  for (const b of blocks) {
    const uidLine = b.lines.find((l) => /^\s*uid:\s*/.test(l))
    const uid = uidLine ? uidLine.match(/^\s*uid:\s*(.+?)\s*$/)[1].replace(/^['"]|['"]$/g, '') : b.name
    out.set(uid, b.name)
  }
  return out
}

function walkPanels(panels, fn) {
  for (const p of panels || []) {
    if (Array.isArray(p.panels) && p.panels.length) walkPanels(p.panels, fn)
    fn(p)
  }
}

function collectPanelRefs(readDashboard) {
  const refs = []
  const files = readDashboard ? readDashboard() : []
  for (const { file, json } of files) {
    walkPanels(json.panels, (p) => {
      const ds = p.datasource
      if (!ds || typeof ds !== 'object') return
      if (!ds.uid) return
      refs.push({ file, title: p.title || '(无标题)', uid: String(ds.uid), type: p.type })
    })
    // 模板变量也能带数据源(下钻用),一并纳入对账。
    for (const v of (json.templating && json.templating.list) || []) {
      if (v.datasource && v.datasource.uid) {
        refs.push({ file, title: `变量 ${v.name}`, uid: String(v.datasource.uid), type: 'templating' })
      }
    }
  }
  return refs
}

/**
 * 面内的路径清单。一律经取材层 `gitRaw`(绝对路径 git + safe.directory + windowsHide +
 * timeout),不裸派生子进程 —— 裸 `execFileSync('git', …)` 在 GUI 宿主/服务账户下会弹黑窗
 * (门 52),且 PATH 与交互终端不通(AGENTS §5b)。
 * @returns {string[]} 仓库相对路径
 */
function listFacePaths(face) {
  const args = face === 'staged' ? ['ls-files', '-z'] : ['ls-tree', '-r', '--name-only', '-z', face]
  return gitRaw(args, ROOT, { timeout: 120000 })
    .split('\0')
    .filter(Boolean)
}

/**
 * 一次 batch 读齐各棵树的面板与 provisioning(取材层 `catBatch` 单次派生,
 * 不做 N 次逐文件 git 调用 —— 那是 §5b 的 fork 风暴同型)。
 *
 * @param {string} face 'head' | 'staged'
 * @returns {{dashboards: Array<{tree,file,json}>, provisioning: Map<string,string|null>}}
 */
function readFromFace(face) {
  const paths = listFacePaths(face)
  const out = { dashboards: [], provisioning: new Map() }
  const want = []
  for (const tree of DASHBOARD_TREES) {
    const prefix = tree.dashboards + '/'
    want.push(...paths.filter((s) => s.startsWith(prefix) && s.endsWith('.json')))
    want.push(tree.provisioning)
  }
  const specs = want.map((p) => `${face === 'staged' ? ':' : 'HEAD:'}${p}`)
  const blobs = specs.length ? catBatch(ROOT, specs, { timeout: 120000 }) : new Map()
  for (const tree of DASHBOARD_TREES) {
    out.provisioning.set(tree.label, blobs.get(`${face === 'staged' ? ':' : 'HEAD:'}${tree.provisioning}`) ?? null)
    const prefix = tree.dashboards + '/'
    for (const p of paths.filter((s) => s.startsWith(prefix) && s.endsWith('.json'))) {
      const text = blobs.get(`${face === 'staged' ? ':' : 'HEAD:'}${p}`)
      if (typeof text !== 'string') continue
      try {
        out.dashboards.push({ tree: tree.label, file: p.slice(prefix.length), json: JSON.parse(text) })
      } catch {
        /* 解析不了的面板由别的门负责,这里跳过 */
      }
    }
  }
  return out
}

function readFromWorktree() {
  const out = []
  for (const tree of DASHBOARD_TREES) {
    const dir = join(ROOT, tree.dashboards)
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      try {
        out.push({ tree: tree.label, file, json: JSON.parse(readWorktreeFile(ROOT, `${tree.dashboards}/${file}`)) })
      } catch {
        /* 解析不了的面板由别的门负责,这里跳过 */
      }
    }
  }
  return out
}

function readProvisioning(face, tree) {
  if (face === 'worktree') return readWorktreeFile(ROOT, tree.provisioning)
  return null // 由 readFromFace 一次 batch 预取,main 里从 map 取
}

function selfTest() {
  // 断言必须"有牙":console.assert 只打日志不改退出码,失败照样 exit 0 —— 这里收拢成
  // 失败清单,任一不过即 return 1(否则覆盖锁就是装饰)。
  const fails = []
  const req = (cond, msg) => {
    if (!cond) fails.push(msg)
  }
  const yaml = [
    'apiVersion: 1',
    'datasources:',
    '  - name: Prometheus',
    '    type: prometheus',
    '    url: http://prometheus:9090',
    '    uid: Prometheus',
    '  - name: Loki',
    '    type: loki',
    '    url: http://loki:3100',
    '',
  ].join('\n')
  const uids = collectProvisionedUids(yaml)
  req(uids.has('Prometheus'), 'S1 显式 uid 必须取到')
  req(uids.has('Loki'), 'S2 无显式 uid 时回落到 name')
  req(uids.size === 2, 'S3 块数必须是 2(不能把嵌套键认成数据源)')
  // S4 阳性对照:坏 uid 夹具必须被 auditTree 判成 dangling(判据本身有牙的证明)
  {
    const prov = collectProvisionedUids(yaml)
    const bad = collectPanelRefs(() => [
      { file: 'bad.json', json: { panels: [{ title: '坏板', datasource: { uid: 'PBFA97CFB590B2093' } }] } },
    ])
    req(auditTree(prov, bad).dangling.length === 1, 'S4 样例/未声明 uid 夹具必须判 dangling')
    const good = collectPanelRefs(() => [
      { file: 'ok.json', json: { panels: [{ title: '好板', datasource: { uid: 'Prometheus' } }] } },
    ])
    req(auditTree(prov, good).dangling.length === 0, 'S4b 已声明 uid 夹具不得误判')
  }
  // S5 覆盖锁:盘上(deploy/ 与 monitoring/ 两棵候选根下)凡是含 .json 面板的
  // grafana/dashboards 目录,必须在 DASHBOARD_TREES 里有登记 —— "清单静默漏掉一棵树"
  // 正是本次要闭的失明:saas 树曾带着 10 处悬空 uid 在 CI 视野外活了好久。
  const covered = new Set(DASHBOARD_TREES.map((t) => t.dashboards.replace(/\\/g, '/')))
  const strays = []
  const scan = (dir) => {
    let ents
    try {
      ents = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      if (!e.isDirectory()) continue
      const p = join(dir, e.name)
      if (p.replace(/\\/g, '/').endsWith('grafana/dashboards')) {
        const hasJson = readdirSync(p).some((f) => f.endsWith('.json'))
        const rel = relative(ROOT, p).replace(/\\/g, '/')
        if (hasJson && !covered.has(rel)) strays.push(rel)
      } else {
        scan(p)
      }
    }
  }
  for (const rootCandidate of ['deploy', 'monitoring']) scan(join(ROOT, rootCandidate))
  req(covered.has('deploy/saas/grafana/dashboards'), 'S5a deploy/saas 树必须在覆盖面清单里(2026-10-18 失明案)')
  req(strays.length === 0, `S5b 盘面存在未登记的 grafana/dashboards 目录: ${strays.join(', ')}`)

  // S6 版面坐标档:成对正反 + 一条"不同原点不得互比"的反证(它比漏判更贵,误咬会逼人跳门)
  const mkGrid = (y2) => [{ file: 'g.json', json: { panels: [{ type: 'stat', title: 'A', gridPos: { h: 3, w: 24, x: 0, y: 0 } }, { type: 'timeseries', title: 'B', gridPos: { h: 8, w: 12, x: 0, y: y2 } }] } }]
  req(auditGrid(mkGrid(0)).some((s) => s.why.includes('重叠')), 'S6a 同层两板相交必须判出重叠')
  req(auditGrid(mkGrid(3)).length === 0, 'S6b 错开 3 格后必须一条不判(反证不乱咬)')
  req(
    auditGrid([{ file: 'r.json', json: { panels: [{ type: 'row', title: 'R', id: 1, gridPos: { h: 1, w: 24, x: 0, y: 0 }, panels: [{ type: 'stat', title: 'C', gridPos: { h: 4, w: 12, x: 0, y: 1 } }] }, { type: 'stat', title: 'D', gridPos: { h: 4, w: 12, x: 0, y: 0 } }] } }]).every((s) => !s.why.includes('重叠')),
    'S6c 折叠行内子板(行内相对坐标)不得与行外板互比'
  )
  req(auditGrid([{ file: 'o.json', json: { panels: [{ type: 'stat', title: 'E', gridPos: { h: 4, w: 20, x: 8, y: 0 } }] } }]).some((s) => s.why.includes('24 列')), 'S6d 超出 24 列必须判出')
  req(auditGrid([{ file: 'n.json', json: { panels: [{ type: 'stat', title: 'F' }] } }]).some((s) => s.why.includes('没有 gridPos')), 'S6e 缺 gridPos 必须判出')
  req(
    auditGrid([{ file: 'v.json', json: { panels: [{ type: 'row', gridPos: { h: 1, w: 30, x: 0, y: 0 } }] } }]).length === 0,
    'S6f row 容器自身不参与格子判'
  )
  // 真面自证:仓里现存 24 张盘必须 0 异常 —— 存量没归零就不许占这个拦门档(§12e)
  req(auditGrid(readFromWorktree()).length === 0, 'S6g 现读仓内全部大盘必须 0 版面异常(存量归零才配占 blocking)')
  if (fails.length) {
    for (const f of fails) console.error(`❌ self-test 失败: ${f}`)
    return 1
  }
  console.info('✅ self-test 通过:uid 提取、块切分、dangling 阳性对照、树覆盖锁、版面坐标成对正反')
  return 0
}

const GRID_COLS = 24

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * 判据 C:版面坐标对账(纯函数,镜像测试与核验器直接取用,不许有第二份实现)。
 * 两型错:同层兄弟矩形相交 ⇒ 其中一块被压住,打开盘就是"面板不见了";x+w>24 ⇒ 右侧被裁出栅格。
 * **比只发生在同一容器内**,且 row 自身不参与 —— 折叠行里子板的 gridPos 是行内相对坐标,
 * 拿它跟行外的板比等于用两把不同原点的尺子对量,必然误咬(误咬的红比漏判更贵,它逼人跳门)。
 * 立因(2026-10-18 实测):hls 盘那块"面板调整说明"文本板 24×3@y0 正压在唯一图表 12×8@y0 上面;
 * 盘 JSON 合法、uid 对、指标名不幽灵 ⇒ 判据 A/B 一路绿灯,而肉眼看到的是"这盘只剩一段道歉"。
 */
function auditGrid(dashboards) {
  const out = []
  for (const { file, json } of dashboards) {
    const containers = [{ owner: `${file}`, panels: json.panels || [] }]
    for (const row of (json.panels || []).filter((p) => p.type === 'row')) {
      if (Array.isArray(row.panels) && row.panels.length)
        containers.push({ owner: `${file}#row:${row.title || row.id}`, panels: row.panels })
    }
    for (const { owner, panels } of containers) {
      const cells = []
      for (const p of panels) {
        if (p.type === 'row') continue
        const g = p.gridPos
        if (!g || typeof g !== 'object') {
          out.push({ file: owner, why: `「${p.title || '(无标题)'}」没有 gridPos` })
          continue
        }
        if (g.x + g.w > GRID_COLS) out.push({ file: owner, why: `「${p.title}」超出 ${GRID_COLS} 列(x=${g.x} w=${g.w})` })
        cells.push({ title: p.title || '(无标题)', x: g.x, y: g.y, w: g.w, h: g.h })
      }
      for (let i = 0; i < cells.length; i++)
        for (let k = i + 1; k < cells.length; k++)
          if (overlaps(cells[i], cells[k]))
            out.push({ file: owner, why: `「${cells[i].title}」与「${cells[k].title}」重叠(其中一块被压住看不见)` })
    }
  }
  return out
}

/**
 * 单树对账(纯函数,镜像测试直接取用):面板引用 ↔ 本树 provisioning。
 * 按树分组的意义全在这 —— 拿另一棵树的配置给本树背书就是放死配置过关。
 */
function auditTree(provisioned, refs) {
  const dangling = refs.filter((r) => !provisioned.has(r.uid))
  const used = new Set(refs.map((r) => r.uid))
  const unused = [...provisioned.keys()].filter((u) => !used.has(u))
  return { dangling, unused }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--help') || argv.includes('-h')) {
    console.info('用法: node scripts/check-grafana-datasource-wiring.mjs [--staged|--worktree|--head] [--self-test]')
    return 0
  }
  // 面必须**如实**映射:提交链判索引、全量判 HEAD。第一版把 --staged 映成 'HEAD',
  // 等于提交链判错面(工作树改对了,门还红在 HEAD 旧内容上)。
  const face = argv.includes('--staged') ? 'staged' : argv.includes('--worktree') ? 'worktree' : 'head'

  const fromFace = face === 'worktree' ? { dashboards: [], provisioning: new Map() } : readFromFace(face)
  const dashboards = face === 'worktree' ? readFromWorktree() : fromFace.dashboards
  let danglingTotal = 0
  let gridTotal = 0

  for (const tree of DASHBOARD_TREES) {
    let provText
    try {
      provText = face === 'worktree' ? readProvisioning('worktree', tree) : fromFace.provisioning.get(tree.label)
    } catch (e) {
      provText = null
      console.error(`⚠️  [${tree.label}] 取不到 provisioning(面=${face}):${e && e.message} ⇒ 本树未判定`)
      continue
    }
    if (typeof provText !== 'string') {
      // 树没入库(或 provisioning 不在面上) ⇒ 本树未判定,不记绿也不记红。
      console.error(`⚠️  [${tree.label}] 取不到 provisioning(面=${face}) ⇒ 本树未判定`)
      continue
    }
    const provisioned = collectProvisionedUids(provText)
    const treeDashboards = dashboards.filter((d) => d.tree === tree.label)
    const refs = collectPanelRefs(() => treeDashboards)

    console.info(`\n━━━ 树 ${tree.label} ━━━`)
    console.info(`面=${face}  provisioning 数据源 ${provisioned.size} 个: ${[...provisioned.keys()].join(', ')}`)
    console.info(`大屏 ${treeDashboards.length} 份,数据源引用 ${refs.length} 处`)

    // 判据 A:引用了本树 provisioning 里不存在的 uid(静态确定的错 ⇒ 判红)
    const { dangling, unused } = auditTree(provisioned, refs)
    if (dangling.length) {
      danglingTotal += dangling.length
      console.error(`❌ 判据 A[${tree.label}]:${dangling.length} 处引用了 provisioning 里不存在的数据源 uid(必定是空板)`)
      for (const d of dangling) console.error(`   · [${d.file}] ${d.title} → uid "${d.uid}"`)
      console.error('   本树可用 uid: ' + [...provisioned.keys()].join(', '))
    } else {
      console.info('✅ 判据 A:所有面板引用的数据源 uid 都在本树 provisioning 里')
    }

    // 判据 B:本树声明了却零面板使用(合法但必须报出来 —— 死配置就是这么躺三年的)
    if (unused.length) {      console.info(
        `\n⚠️  判据 B(只报数,不判红):${unused.length} 个已声明数据源无任何面板使用 —— ${unused.join(', ')}`
      )
      for (const u of unused) {
        console.info(`   · ${u}(provisioning name: ${provisioned.get(u)})`)
      }
      console.info('   若该基建确实未部署(本机 Jaeger 即如此:只在 docker-compose 的 observability profile 里),')
      console.info('   这是预期状态;派生器 sync-grafana-live-provisioning.mjs 会因探活不通自动跳过它。')
    } else {
      console.info('✅ 判据 B:本树已声明的数据源全部有面板在用')
    }

    // 判据 C:版面坐标(静态确定的错 ⇒ 判红)。存量已现读归零(24 张盘 0 处),按 §12e 才可占拦门档。
    const grid = auditGrid(treeDashboards)
    gridTotal += grid.length
    if (grid.length) {
      console.error(`❌ 判据 C[${tree.label}]:${grid.length} 处版面坐标异常(重叠=有面板被压住;超 24 列=右侧被裁)`)
      for (const g of grid) console.error(`   · [${g.file}] ${g.why}`)
    } else {
      console.info('✅ 判据 C:本树面板版面坐标无重叠、无栅格溢出')
    }
  }

  return danglingTotal || gridTotal ? 1 : 0
}

// 直接用 `file://${argv[1]}` 拼会在 Windows 上少一个斜杠(file://D:/… ≠ file:///D:/…),
// 于是 isDirect 恒 false、门体一次都不跑 —— 用 pathToFileURL 才与其余守门同形。
const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) process.exit(main())

// 镜像测试 scripts/tests/check-grafana-datasource-wiring.test.mjs 一律从这里取判据
// (§22c:同一份判据不许有第二份实现)。DASHBOARD_TREES 一并导出:覆盖面清单本身也是判据,
// 测试要能对账"树是否真的在扫",不许测试另抄一份树清单。
export const __test__ = { collectProvisionedUids, collectPanelRefs, auditTree, auditGrid, DASHBOARD_TREES }
export { collectProvisionedUids, collectPanelRefs, auditTree, auditGrid }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

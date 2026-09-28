#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-lock-manifest-consistency.mjs — package.json 依赖声明 ↔ pnpm-lock.yaml importer specifier 对账
 *
 * 立的因(2026-09-24 真实事故):apps/web/package.json 声明 `"xlsx": "^0.18.5"`,
 * 而 lock 的 importers.apps.web.dependencies.xlsx.specifier 记 `npm:@e965/xlsx@^0.20.3`。
 * 后果不是报错,而是 pnpm 整段跳过 apps/web 的链接步骤 —— install / install --force 都在
 * 285ms 内回 "Already up to date",三条依赖永不落地,生产 next build 报 Module not found,
 * 本机 typecheck 全绿。本地任何编译/ lint / 单测都看不见这一类缺陷,只有对账能看见。
 *
 * 判据:
 *   R1 声明了但 lock 的 importer 里没有 ⇒ 红(缺记账;workspace:/catalog: 协议声明同样参与比对)
 *   R2 specifier 字符串不相等 ⇒ 红(即本次事故形态,含 npm: 别名不一致)
 *   R3 lock importer 有、package.json 已不声明 ⇒ 不计红但如实报数(孤儿记账)
 *   解析不到 / 结构不认识 ⇒ exit 2 "无法判定",绝不静默记为通过
 *
 * 两个"pnpm 自己的合法记账行为"维度(2026-09-24 补,不加就会恒红 22 枚→逼人跳闸):
 *   R4 维度 A = pnpm-workspace.yaml 的 overrides 参与比对。被 override 的依赖,pnpm 写进
 *      lock 的 specifier 是 **override 后的目标值**,与 package.json 原始声明天然不等
 *      (真仓实测 19 枚,如 @types/node ^22/^26→26.1.2、postcss ^8.4.49→^8.5.23)。
 *      期望值改取 override 目标:lock == override 目标 ⇒ 绿;lock 既不等于 manifest 原值
 *      也不等于任何 override 目标 ⇒ **仍红**。反向半边由严格侧兜住:某依赖只有**唯一一条
 *      裸名 override**(无 @版本选择器)时,pnpm 必然把 override 目标落进 lock,于是
 *      "lock 仍等于 manifest 原值"本身即缺陷(kind=override-not-applied,lock 被手改/未跑
 *      全量 install)—— 所以 R4 不是"命中 override 就不判"的无条件豁免。
 *      键形态两种(真仓实测均为扁平 map):裸名 `ioredis: 6.0.0`,以及**名字前缀 + 版本选择器**
 *      `postcss@<=8.5.22: ^8.5.23` / `fast-uri@>=3.0.0 <3.1.6: ^3.1.6`。后者必须按"包名前缀"
 *      归属(scoped 名首个 @ 属于 scope,不得当作名字起点),裸等值比对会整类看不见。
 *      带选择器的条目刻意**不**去判"声明区间是否落在选择器内"(那要引 semver range 引擎):
 *      它只往"可接受的期望值"集合里加值,不会拿走 manifest 等值这条绿路,因此只会少判
 *      不会误红。父作用域键 `foo>bar`(真仓 0 条;`>=` 里的 > 不是分隔符,见 splitOverrideKey)
 *      只作用于传递依赖,不参与直接声明比对,如实计数。
 *   R5 维度 B = peerDependencies 的记账形态。**2026-09-27 真仓 HEAD 面逐条实测**(26 包 / 10 条 peer 声明):
 *      lock 的 importers 段集里**根本没有 peerDependencies 段**(该段出现 0 次),这 10 条实际落在
 *      dependencies(6 条:packages/eslint-config 的 eslint、packages/shared 与 ui-native 与 ui-react 的
 *      react 等)与 devDependencies(4 条:api-client 的 @tarojs/taro、packages/app 的 react /
 *      react-native、ui-react 的 react-dom),且 specifier 常被写成解析后的单值(实测 3 条与声明不等,
 *      即 @tarojs/taro >=4.0.0→4.2.1、packages/app 的 react / react-native)⇒ 值天然漂移。
 *      ⇒ **不比 specifier,但仍要求 lock 的任一段里有它的条目**(缺条目仍红)。
 *      R4 与 R5 同时命中时按 R5 放过值比对。
 *      ⚠️ 本维**刻意不参与 R6 的段位置对账**,理由不是"peer 记进 dev 段"这一条旧措辞(那句不准确,
 *      已按上面的实测就地改掉),而是**结构性的**:importers 没有 peer 段,于是"清单的 peer 段 ↔ 锁的
 *      peer 段"这个等式没有可比对象;若强行按"逐段键集等值"判,真仓 HEAD 会亮 14 条,而 14 条
 *      **全部是 peer 声明**(非 peer 侧 0 条)⇒ 那 14 条是尺子错,不是仓库债。
 *   R6 分区同形 = 依赖的**类型**也必须两侧一致(2026-09-26 补,立项即零容忍)。R1 只问"条目在不在",
 *      mismatch 只问"值对不对",于是"名字与值都对、但 lock 把它记在另一段"这一型两侧都不红。
 *      实测载体是那晚 CI 的 `@ihui/types`:package.json 声明在 devDependencies、lock 记在
 *      dependencies —— 安装面按 lock 走、打包闭包按 manifest 走,**红只在 CI,不在本机任何判据**。
 *      唯一豁免是 R5 的 peer(pnpm 把 peer 记进 dev 段是文档化行为);其余跨段一律判红。
 *      落地前置:真仓 HEAD 面 26 包 / 515 条声明实测 **0 条跨段** ⇒ 不需要棘轮,当场零容忍
 *      (带基线的分区判据等于把这一型留给下一个撞见它的人)。
 *   R4/R5 放过的每一条(仅统计"值确实不同却被放过"的那些)都进 overrideExempted /
 *   peerExempted,并在结论行报数与 --json 里可审计(含命中的 override key),不静默变绿。
 *   R6 的**覆盖面自证**(2026-09-27 补):结论行单独印
 *      `维度 R6 段位置对账:核 N 条非 peer 声明键 / 段位置违规 M / peer 声明 K 条不参与(实测 importer 段集 …)`。
 *   这一维若只混在"违规 N"里,读报告的人就分不开"判过且干净"与"一条都没核"—— 而后者正是本仓
 *   记过最多次的失效型("把没判写成判过了")。N 为 0 时该行显式追加"⚠️ 一条都没核,不得读成已通过"。
 *   R6 与维度 A/B 的**协调**(2026-09-28 L14030 续票逐条论证,不得读成"顺手放宽"):
 *     · **overrides 命中时同样按段判,override 不豁免段位置。** 理由:override 改写的是 lock 里
 *       `specifier` 的**值**(pnpm 把 override 目标写进该字段),它**不改这个键归属哪一段** —— 段
 *       由 manifest 里这个依赖写在哪个字段决定,与版本选择器无关。而 `--frozen-lockfile` 的比对
 *       是"取 `importers.<pkg>.<清单同名字段>` 里的 specifier":段错了连**条目都取不到**,那是
 *       整段跳过链接的成因,与"取到了但值不等"是两种病。所以段判必须排在 override 放过**之前**
 *       —— 代码顺序即判据,写成"先命中 override 就 continue"会让跨段被 overrideExempted 洗白
 *       (镜像 T31 用"被 override 的依赖 manifest 记 devDeps、lock 记 deps 且值恰等于目标"钉住)。
 *       **这一维的红与 pnpm 的拒装是同一件事(2026-09-28 双臂实测,临时仓零触碰真仓)**:
 *       同一份 manifest(`dependencies.dayjs`)配两份只差段名的 lock 跑 CI 那一跑
 *       `pnpm install --frozen-lockfile` ⇒ 跨段臂 RC=1 且回
 *       `[ERR_PNPM_OUTDATED_LOCKFILE] Cannot install with "frozen-lockfile" …not up to date with
 *       <ROOT>\package.json`,同段臂则先过 `Lockfile is up to date, resolution step is skipped`。
 *       ⚠️ 取证口径:`--dry-run` 那一档**两臂退出码都是 0**,判别只在文案上
 *       (`up to date; a real install would make no changes` ↔ `A real install would make the
 *       following changes`)—— 拿 dry-run 的 RC 当"CI 装得上"的结论就是一台恒绿的尺子。
 *     · **peer 落 dependencies/devDependencies 段不判段位置,是结构性的而不是措辞习惯**(维度 B):
 *       现审面实测 26 个 importer 的段集 = dependencies×17 / devDependencies×23 / optionalDependencies×1,
 *       **没有 peerDependencies 段**,于是"清单 peer 段 ↔ 锁 peer 段"没有可比对象;按逐段键集等值
 *       判会亮 14 条而 14 条全是 peer 声明 ⇒ 那是尺子错,不是仓库债。但这一条**豁免的前提是可测的**,
 *       所以它不再是前提时必须喊出来:若某一包的 importer **有** peerDependencies 段、而该 peer 声明
 *       不在其中,本门不再假定"放过是对的",落 U3 未判定(见下),而不是静默豁免。
 *   R6 的三型**判不准**(U1/U2/U3)—— 既不冒红也不记绿,一律点名:
 *     · **U1 value-unreadable**:命中的锁条目没有 `specifier` 字段 ⇒ 段维仍按"键在位"照判,
 *       但**值**维无从比对。旧写法会拿 `null` 去和声明值比,产出一枚 `locked: null` 的假 mismatch;
 *       peer 那一支还会把它计进"放过了一条值漂移",那是把没判写成判过了。
 *     · **U2 optional-placement-unmodeled**:正要判跨段,而该锁条目带 `optional:` 标记 ⇒ 本解析器
 *       不建模 pnpm 对 optional 条目的落段规则(现审面实测 `optional:` 出现 0 次,故这不是"已知
 *       无害"而是"没见过 ⇒ 不敢猜"),分不清"跨段漂移"与"optional 的合法落段",判不准。
 *     · **U3 peer-section-exists-but-skipped**:见上,维度 B 的豁免前提在被审面上不再成立。
 *   **--strict(2026-09-28 落地;此前该旗标在本门根本不存在,而 PROJECT_PLAN 已有条目按"跑了
 *   --strict 且 RC=0"当证据 —— 未知旗标被 argv 静默忽略,那句读数是空转得来的,属"文档写了
 *   跑不通的出路")**:语义 = **拒绝出具合格证**,不改判据。
 *     · 有违规 ⇒ 仍 exit 1(已判出的红必须点名,不能被"不出证"盖掉);
 *     · 无违规但 U1+U2+U3 > 0,**或段维一条都没核(sectionChecked=0)** ⇒ exit 2;
 *     · 无违规且未判定 0 ⇒ exit 0。
 *     默认档(提交链走这一档,runner `args: []`)**只报数不判红** —— 与改动无关的恒红门唯一结局
 *     是逼人 `--no-verify` 连带废掉全部守门(§12e);现审面实测 U1/U2/U3 = 0,所以 --strict
 *     今日 RC=0,不是出生即红。
 *
 * 模式与**判定面**(2026-09-24 收口到本仓对"读内容作判据"的既立口径,同守门 70/77/83/98):
 *   缺省(全量审计) 判 **HEAD blob**(`git show HEAD:<path>`)
 *   --staged        判**索引 blob**(`git show :<path>`)—— pre-commit 模式
 *   --head          显式判 HEAD(与缺省同,给测试/人工复验用)
 *   --worktree      显式判磁盘工作树,**只是人工排查的逃生舱**,不在提交链上
 *   为什么不得判盘(两条都是真失效,不是洁癖):
 *     · 假绿:`git add` 了一对不一致的 package.json/lock,作者随后又把磁盘文件改对 ⇒
 *       判盘全绿,而**提交进去的那一对是坏的** —— 今天卡死生产构建的正是这一形态。
 *     · 假红:共享工作区常年有几十个在途文件,盘上内容属于另一个会话的半编辑态;
 *       拿它判红会逼人 `--no-verify`,而跳闸一次等于全部守门作废(宁可不判,不产红到逼人跳闸)。
 *   三种模式下**所有**参与比对的文件(pnpm-workspace.yaml、pnpm-lock.yaml、每个包的
 *   package.json)一律经同一个出口 `reader.readFace(rel)` 取,不得一半读盘一半读 git ——
 *   混面会产出比读盘更糟的假结论。包清单的存在性/目录枚举同样取自该面。
 *   取不到(该面没这个路径 / 是二进制 / git 调用失败)⇒ 显式 exit 2 并点名路径,
 *   **绝不允许"取不到就跳过该包然后报绿"**。
 *   对账范围恒为全量:某包破损与"本次改了什么"无关,按暂存子集收窄会放过整类。
 *   取材实现所在(2026-09-25 收口):绝对路径 git、`-c safe.directory=*`、一次
 *   `cat-file --batch` 读完一批(不得逐文件派生 git)、batch 的 stdio[0] 必须是 'pipe'(设成
 *   'ignore' 会让 git 读到空输入,于是每个 rev 都"取不到" —— 本门第一次真仓自验就是被这一条
 *   咬出的假 exit 2)、junction 下的仓库根比较、64MB maxBuffer —— 全部由
 *   `scripts/lib/face-reader.mjs` 单点持有。本门只留自己需要的**形状适配**(`has` / `listDir`:
 *   94 要文件清单、101 要包清单,层刻意不统一对外形状)。再抄一份实现等于再抄一份风险。
 *   --json     机器可读输出(judgedFace 如实标面;含 undeterminedItems 逐条)
 *   --strict   拒绝出具合格证:未判定 > 0 或段维一条都没核 ⇒ exit 2(详见上段"--strict"条)。
 *              提交链**不带**这一档(runner `args: []`),默认档只报数
 *   --root <d> 显式指定仓库根(测试通道;缺省由脚本自身位置推导)。注意配 --worktree
 *              才按磁盘判 —— 磁盘夹具目录通常不是 git 仓,判 HEAD/索引会如实 exit 2。
 *   --self-test 临时目录小 fixture 正反成对自检(绝不扫真仓)
 *
 * 退出码:0 通过 / 1 业务违规 / 2 无法判定、脚本自身异常,或 --strict 下有未判定而拒绝出合格证
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 判定面取材的唯一实现(2026-09-25 收口)。本门此前自带一份 git 派生 + cat-file batch,而五处
// 易错点(裸 'git'、batch 的 stdio[0]='ignore'、逐文件派生、junction 下的仓库根比较、maxBuffer)
// 重复一份就是重复一份风险 —— 现在只从这里取。
import {
  FACES,
  FACE_LABEL,
  FACE_NOTE,
  Undetermined,
  catBatch,
  gitBinary,
  gitRaw,
  readWorktreeFile,
  sameDir,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEP_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
/** 夹具仓派生的超时(真仓取材的超时与 maxBuffer 由共用层自己兜) */
const GIT_TIMEOUT = 60000

/**
 * 单一取内容出口。`readFace(rel)` 是三态里**同一个面**的内容;`has`/`listDir` 让包清单的
 * 存在性与目录枚举也取自同一面(否则 glob 枚举读盘、内容读 git = 混面)。
 * git 调用一律惰性:失败抛 Undetermined ⇒ runCheck 收成 undetermined ⇒ exit 2,绝不记绿。
 *
 * 2026-09-25 起这一层只剩**本门特有的形状适配** —— 派生本体(绝对路径 git + safe.directory +
 * windowsHide + timeout + maxBuffer、`cat-file --batch`、穿 junction 的仓库根比较、磁盘面读取)
 * 全在 `scripts/lib/face-reader.mjs`;`has` / `listDir` 这两件套共用层刻意不提供(94 要文件
 * 清单、101 要包清单),所以由本门用它给的原语拼出来。
 */
export function makeFaceReader(face, root) {
  if (!FACES.includes(face))
    throw new Undetermined(`未知判定面 "${face}"(允许: ${FACES.join(' / ')})`)
  const cache = new Map()
  const label = FACE_LABEL[face]
  if (face === 'worktree') {
    return {
      face,
      label,
      root,
      has(rel) {
        return existsSync(join(root, rel))
      },
      listDir(dirRel) {
        const base = dirRel === '.' || dirRel === '' ? root : join(root, dirRel)
        if (!existsSync(base)) return []
        try {
          return readdirSync(base, { withFileTypes: true })
            .filter((c) => c.isDirectory())
            .map((c) => c.name)
        } catch (e) {
          throw new Undetermined(`${label} 列目录 ${dirRel} 失败: ${e.message}`)
        }
      },
      readFace(rel) {
        if (cache.has(rel)) return cache.get(rel)
        // 层的 readWorktreeFile 只在"读失败"时抛(编码/权限错误原样点名,不伪装成业务结论),
        // 文案与本门旧版逐字同;"不存在"与"含 NUL 的二进制"合并成 null —— 两种都必须在**这里**
        // 抛掉,不得让调用方当成"没有这个包"跳过后报绿。
        const text = readWorktreeFile(root, rel)
        if (text === null) {
          throw new Undetermined(`${label} 取不到 ${rel}(不存在、是目录或含 NUL 的二进制),无法比对`)
        }
        cache.set(rel, text)
        return text
      },
      prefetch() {},
    }
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  let tracked = null
  function loadTracked() {
    if (tracked) return tracked
    // 面判定的相对基准必须是"仓库根":`ls-files --full-name` 与 `cat-file :<rel>` 都按仓库根
    // 解释路径,而 root 若是仓库的**子目录**,两者与 join(root,rel) 的基准就会错位 ——
    // 那正好产出门最不该产出的东西:看起来自洽、实则混面的绿。故显式判死,不做静默容忍。
    let top
    try {
      top = gitRaw(['rev-parse', '--show-toplevel'], root).trim()
    } catch (e) {
      throw new Undetermined(
        `${e.message} —— ${label} 只在 git 仓库根可用,人工排查磁盘状态请用 --worktree`,
      )
    }
    const want = root.replace(/\\/g, '/')
    // 层的 sameDir 先各自 realpath 再比:§26 的 junction 改道让同一目录有两个字面写法,
    // 只比字面路径会把正常仓判成"基准错位"。
    if (!sameDir(top, root)) {
      throw new Undetermined(
        `${label} 只能在 git 仓库根判定:--root 给的是 ${want},而该目录的 toplevel 是 ${top}`,
      )
    }
    // 索引面不需要提交存在(`git add` 过、尚未 commit 的中间态正是要判的对象);
    // HEAD 面则必须显式失败,绝不退化成"扫到 0 个包所以绿"。
    // 这里不加 `--quiet`:git 那句 "fatal: Needed a single revision" 早先会直接写在本门
    // stderr 上(本门的输出即结论)。根因是派生层没接管 stdio —— 已在
    // `lib/face-reader.mjs` 的 gitRaw 里以显式 stdio 修掉,故门的绕行一并撤除。
    if (face === 'head') {
      try {
        gitRaw(['rev-parse', '--verify', 'HEAD'], root)
      } catch {
        throw new Undetermined(`git rev-parse --verify HEAD 在 ${root} 取不到:该面没有可用提交`)
      }
    }
    const raw =
      face === 'staged'
        ? gitRaw(['ls-files', '--full-name', '-z'], root)
        : gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root)
    tracked = new Set(raw.split('\0').filter(Boolean))
    if (tracked.size === 0) throw new Undetermined(`${label} 在 ${root} 下列出 0 个路径,无法判定`)
    return tracked
  }
  return {
    face,
    label,
    root,
    has(rel) {
      return loadTracked().has(rel)
    },
    listDir(dirRel) {
      const p = dirRel === '.' || dirRel === '' ? '' : `${dirRel}/`
      const out = new Set()
      for (const file of loadTracked()) {
        if (!file.startsWith(p)) continue
        const seg = file.slice(p.length).split('/')[0]
        if (seg) out.add(seg)
      }
      return [...out]
    },
    prefetch(rels) {
      const need = rels.filter((r) => !cache.has(r))
      if (need.length === 0) return
      const got = catBatch(
        root,
        need.map((r) => prefix + r),
      )
      for (const r of need) cache.set(r, got.get(prefix + r) ?? null)
    },
    readFace(rel) {
      if (!cache.has(rel)) this.prefetch([rel])
      const text = cache.get(rel)
      if (text === null || text === undefined) {
        throw new Undetermined(
          `${label} 取不到 ${rel}(该面没有此路径、是 unmerged 或不是 blob)—— 拒绝"取不到就跳过"再报绿`,
        )
      }
      if (text.includes('\u0000')) throw new Undetermined(`${label} 的 ${rel} 是二进制,无法比对`)
      return text
    },
  }
}

/** 共用层解析出的 git 绝对路径(§5b:GUI 宿主 / 服务账户的 PATH 与交互终端不通)。
 *  本门不再自己派生 git,这个名字保留给镜像测试与人工核验取用。 */
const GIT_BIN = gitBinary()

function unquoteScalar(raw) {
  let s = String(raw).trim()
  if (s === '') return ''
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'")
  }
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  const c = s.indexOf(' #')
  if (c > -1) s = s.slice(0, c).trimEnd()
  return s
}

export function parseWorkspaceGlobs(text) {
  const lines = String(text).split(/\r?\n/)
  const includes = []
  const excludes = []
  let inList = false
  for (const line of lines) {
    if (/^packages:\s*$/.test(line)) {
      inList = true
      continue
    }
    if (!inList) continue
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue
    if (/^\S/.test(line)) {
      inList = false
      continue
    }
    const m = line.match(/^\s*-\s*(.+?)\s*$/)
    if (!m) throw new Undetermined(`pnpm-workspace.yaml packages 列表项不认识: ${line}`)
    const value = unquoteScalar(m[1])
    if (!value) continue
    if (value.startsWith('!')) excludes.push(value.slice(1))
    else includes.push(value)
  }
  if (includes.length === 0) {
    throw new Undetermined('pnpm-workspace.yaml 没有可识别的 packages: 列表')
  }
  return { includes, excludes }
}

function globToRegExp(pattern) {
  const source = pattern
    .split('/')
    .map((seg) => (seg === '*' ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/')
  return new RegExp(`^${source}$`)
}

function discoverPackages(reader) {
  if (!reader.has('package.json')) {
    throw new Undetermined(
      `${reader.label} 的 ${reader.root} 下没有 package.json,不像 workspace 根`,
    )
  }
  const { includes, excludes } = parseWorkspaceGlobs(reader.readFace('pnpm-workspace.yaml'))
  const relSet = new Set(['.'])
  for (const pattern of includes) {
    if (pattern.endsWith('/*')) {
      const parent = pattern.slice(0, -2)
      for (const child of reader.listDir(parent)) {
        const rel = !parent || parent === '.' ? child : `${parent}/${child}`
        if (!reader.has(`${rel}/package.json`)) continue
        relSet.add(rel)
      }
    } else if (!pattern.includes('*')) {
      if (reader.has(`${pattern}/package.json`)) relSet.add(pattern)
    } else {
      throw new Undetermined(`不支持的 workspace glob 形态(只支持尾段 * 或字面路径): ${pattern}`)
    }
  }
  const excludeRes = excludes.map(globToRegExp)
  return [...relSet].filter((rel) => !excludeRes.some((re) => re.test(rel))).sort()
}

/** 只有 manifest 声明里的"非 registry 协议"值不参与 override 严格判(它们本就不由 override 改写) */
const NON_REGISTRY_PROTOCOL =
  /^(workspace:|catalog:|link:|file:|git:|git\+:|github:|gitlab:|https?:)/

export function isRegistryRange(spec) {
  return typeof spec === 'string' && spec !== '' && !NON_REGISTRY_PROTOCOL.test(spec)
}

/**
 * override 键归属拆分。真仓实测两种形态:
 *   `ioredis` / `@types/react`                → 裸名(selector = null,无条件生效)
 *   `postcss@<=8.5.22` / `fast-uri@>=3.0.0 <3.1.6` → 名字前缀 + 版本选择器
 * scoped 名的**首个** @ 属于 scope,故搜索起点必须跳过它(朴素 split('@')[0] 会把
 * `@types/react@^19` 拆成空名,整类 scoped override 就此隐身)。
 *
 * `>` 有两种语义,必须分清(建门实测踩到,真仓 13 条键全部带 `>=`):
 *   - 版本比较符 `>=` —— 属于选择器,**不是**父作用域
 *   - pnpm 的父作用域分隔符 `foo>bar` / `@scope/p>@scope/c` —— 只作用于传递依赖 bar,
 *     不得按名字命中"直接声明",否则等于凭空多一个可接受值
 * 判据:紧跟 `>` 的不是 `=` / 数字 / `v`(版本号起点)时才是父作用域分隔符。
 * 残余歧义(`foo>x-ray` 这类以 x/v 开头的子包名)一律**偏向"当作选择器"**:
 * 最坏结果只是给父包多一个可接受值(少判),绝不会产出假红。
 */
const PARENT_SCOPED_SEP = />(?![=\d*v])/

export function splitOverrideKey(key) {
  const k = String(key)
  if (PARENT_SCOPED_SEP.test(k)) return { name: k, selector: null, parentScoped: true }
  const at = k.indexOf('@', k.startsWith('@') ? 1 : 0)
  if (at <= 0) return { name: k, selector: null, parentScoped: false }
  return { name: k.slice(0, at), selector: k.slice(at + 1), parentScoped: false }
}

/**
 * 读 pnpm-workspace.yaml 的 overrides 扁平表(维度 A 的输入)。
 * 没有该段 ⇒ 空表(合法,退化为纯 manifest 比对);
 * 认识不了的形态(缩进非 2 / 无冒号 / 值为空 / 值为嵌套 map|list)⇒ Undetermined,
 * 因为 override 表读不全的直接后果是**产出假红**,与本文件 parseLockImporters 同一取向。
 */
export function parseWorkspaceOverrides(text, sourceLabel = 'pnpm-workspace.yaml') {
  const lines = String(text).split(/\r?\n/)
  const start = lines.findIndex((l) => /^overrides:(\s*\{\}\s*(#.*)?|\s*(#.*)?)?$/.test(l))
  if (start === -1) return []
  if (/^overrides:\s*\{\}/.test(lines[start])) return []
  const entries = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue
    if (/^\S/.test(line)) break
    const indent = line.length - line.trimStart().length
    if (indent !== 2) {
      throw new Undetermined(
        `${sourceLabel} overrides 段第 ${i + 1} 行缩进 ${indent} 不认识(只支持扁平 2 空格表)`,
      )
    }
    const m = line.match(/^ {2}(.+?):\s*(.*)$/)
    if (!m) throw new Undetermined(`${sourceLabel} overrides 条目行不认识(第 ${i + 1} 行): ${line}`)
    const key = unquoteScalar(m[1])
    const value = unquoteScalar(m[2])
    if (!key || !value || value.startsWith('{') || value.startsWith('[')) {
      throw new Undetermined(`${sourceLabel} overrides 第 ${i + 1} 行的键值形态不认识: ${line}`)
    }
    entries.push({ key, value })
  }
  return entries
}

/** 命中某个依赖名的全部 override 条目(裸名 + 该名字前缀的版本选择器) */
export function matchOverrideTargets(entries, name) {
  const out = []
  for (const e of entries) {
    const split = splitOverrideKey(e.key)
    if (split.parentScoped || split.name !== name) continue
    out.push({ key: e.key, value: e.value, selector: split.selector })
  }
  return out
}

/**
 * 只解析 importers: 块。lockfile v9 该块是高度规则的 YAML:
 * 缩进 2=包路径 / 4=依赖段 / 6=包名 / 8=specifier|version。
 * 任何认识不了的缩进、tab、未知段名一律 Undetermined —— 判据失效必须表现为红,不能表现为绿。
 */
export function parseLockImporters(text) {
  const lines = String(text).split(/\r?\n/)
  if (!lines.some((l) => /^lockfileVersion:/.test(l))) {
    throw new Undetermined("pnpm-lock.yaml 没有 'lockfileVersion:' 行")
  }
  const start = lines.findIndex((l) => /^importers:(\s+(#.*)?)?$/.test(l))
  if (start === -1) throw new Undetermined('pnpm-lock.yaml 里找不到 importers: 顶层块')
  const importers = new Map()
  let sections = null
  let sectionName = null
  let dep = null
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue
    if (/^\S/.test(line)) break
    const indent = line.length - line.trimStart().length
    if (line.slice(0, indent).includes('\t')) {
      throw new Undetermined(`importers 块第 ${i + 1} 行缩进含 tab`)
    }
    if (indent === 2) {
      const m = line.match(/^ {2}(.+?):\s*(\{\})?$/)
      if (!m) throw new Undetermined(`importer 路径行不认识(第 ${i + 1} 行): ${line}`)
      const map = new Map()
      importers.set(unquoteScalar(m[1]), map)
      sections = map
      sectionName = null
      dep = null
      continue
    }
    if (indent === 4) {
      if (!sections) throw new Undetermined(`第 ${i + 1} 行的依赖段出现在任何 importer 之前`)
      const m = line.match(/^ {4}(.+?):\s*(\{\})?$/)
      if (!m) throw new Undetermined(`依赖段行不认识(第 ${i + 1} 行): ${line}`)
      sectionName = unquoteScalar(m[1])
      if (!DEP_SECTIONS.includes(sectionName)) {
        throw new Undetermined(`importer 里出现未知依赖段 "${sectionName}"(第 ${i + 1} 行)`)
      }
      dep = null
      if (!sections.has(sectionName)) sections.set(sectionName, new Map())
      continue
    }
    if (indent === 6) {
      if (!sectionName) throw new Undetermined(`第 ${i + 1} 行的包名出现在任何依赖段之外`)
      const m = line.match(/^ {6}(.+?):\s*$/)
      if (!m) throw new Undetermined(`包名行不认识(第 ${i + 1} 行): ${line}`)
      dep = { specifier: null, optional: undefined }
      sections.get(sectionName).set(unquoteScalar(m[1]), dep)
      continue
    }
    if (indent === 8) {
      const m = line.match(/^ {8}([A-Za-z]+):\s*(.*)$/)
      if (!m || !dep) throw new Undetermined(`specifier/version 行不认识(第 ${i + 1} 行): ${line}`)
      if (m[1] === 'specifier') dep.specifier = unquoteScalar(m[2])
      // `optional` 过去被**静默丢弃**(只保证不报"未知字段")。丢弃的代价不是少一个信息,
      // 而是段维度在"条目带 optional 标记"时给出一个它没有资格给出的结论 —— 见头注 U2。
      // 现把它取进条目,判据据此把该条落"未判定",而不是冒红或记绿。
      else if (m[1] === 'optional') dep.optional = unquoteScalar(m[2]) !== 'false'
      else if (m[1] !== 'version') {
        throw new Undetermined(`importer 依赖项下出现未知字段 "${m[1]}"(第 ${i + 1} 行)`)
      }
      continue
    }
    throw new Undetermined(`importers 块第 ${i + 1} 行缩进 ${indent} 不认识`)
  }
  if (importers.size === 0) throw new Undetermined('importers: 块解析结果为 0 个 importer')
  return importers
}

/**
 * "这条锁条目到底读没读到值"的唯一判式。刻意写两档而不是 `== null`:本仓 eslint 开着
 * `eqeqeq`,`== null` 会在下一次 lint 里以**错误**形态挡下别人的提交(§12e:红在本任务
 * 之外照样逼人绕钩子)。语义就是"没取到 ⇒ 值维判不准"。
 */
const isUnset = (v) => v === null || v === undefined

export function compareDeclarations(declaredBySection, lockSections, overrideEntries = []) {
  const violations = []
  const orphans = []
  const overrideExempted = []
  const peerExempted = []
  /**
   * 三型**判不准**(U1 value-unreadable / U2 optional-placement-unmodeled /
   * U3 peer-section-exists-but-skipped),逐条点名。它们既不进 violations,也不进任何
   * "放过"清单 —— 本仓最高频的失效型是"把没判写成判过了",而"放过"与"没判"在账面上
   * 长得一模一样,所以必须分列(见头注 R6 的三型判不准)。
   */
  const undetermined = []
  const declaredNames = new Set()
  for (const section of DEP_SECTIONS) {
    for (const [name, spec] of Object.entries(declaredBySection[section] ?? {})) {
      declaredNames.add(name)
      const candidates = []
      const own = lockSections.get(section)?.get(name)
      if (own) candidates.push({ in: section, entry: own })
      for (const s of lockSections.keys()) {
        if (s === section) continue
        const e = lockSections.get(s).get(name)
        if (e) candidates.push({ in: s, entry: e })
      }
      if (candidates.length === 0) {
        violations.push({
          kind: 'missing',
          section,
          name,
          declared: spec,
          locked: null,
          lockedIn: null,
        })
        continue
      }
      const pick = candidates.find((c) => c.in === section) ?? candidates[0]
      // 维度 B:peer 的 lock 记账常在别的段且值是解析后的范围 ⇒ 不比值,只验条目在位(缺条目已红)
      if (section === 'peerDependencies') {
        // U3:维度 B 的豁免建立在一条**可测前提**上 —— 现审面实测 26 个 importer 里
        // 根本没有 peerDependencies 段,所以"清单 peer 段 ↔ 锁 peer 段"没有可比对象,只能放过。
        // 一旦被审面上这个段存在、而这条 peer 声明不在其中,前提就没了:此时继续"放过"
        // 等于替一个本可以比的形态背书。判不准,不冒红也不记绿(--strict 拒绝出合格证)。
        if (own === undefined && lockSections.has('peerDependencies')) {
          undetermined.push({
            reason: 'peer-section-exists-but-skipped',
            section,
            name,
            declared: spec,
            locked: pick.entry.specifier,
            lockedIn: pick.in,
          })
        } else if (isUnset(pick.entry.specifier) || typeof spec !== 'string') {
          // U1:键在位(段维照判完了),但值读不出。旧写法会拿 null 去比,把"没读到"
          // 计成"值漂移"并塞进 peerExempted —— 那是把没判写成判过了。
          undetermined.push({
            reason: 'value-unreadable',
            section,
            name,
            declared: spec,
            locked: pick.entry.specifier,
            lockedIn: pick.in,
          })
        } else if (pick.entry.specifier !== spec) {
          // 只把"值确实不同却被放过"计入报数,逐字相同的 peer 属于正常绿,不算豁免
          peerExempted.push({
            section,
            name,
            declared: spec,
            locked: pick.entry.specifier,
            lockedIn: pick.in,
          })
        }
        continue
      }
      // R6 分区漂移:条目在、specifier 也可能对,但**不在声明它的那一段**。
      // 这不是假想形态 —— 2026-09-26 那晚 CI 红的正是它(`@ihui/types` 声明在 devDependencies
      // 而 lock 记在 dependencies),而 R1(missing)与 mismatch 都看不见它,因为名字与值都对,
      // 只有"依赖类型"错了:devDependencies 里的包在 `pnpm install --prod` / 打包闭包里没有,
      // 而 bundler 按 manifest 读到的却是"生产依赖"。维度 B 只豁免 peer —— pnpm 把 peer 记进
      // 别的段是它文档化的行为,把 runtime 依赖记进 dev 段不是。
      if (!candidates.some((c) => c.in === section)) {
        // **这一支必须排在 override 放过之前**(代码顺序即判据,头注 R6 的"协调"条):
        // override 只改 lock 里 specifier 的**值**,不改这个键归属哪一段;跨段是"取不到条目"
        // 那一型,与"取到了但值不等"是两种病,所以被 override 命中的依赖**照样按段判**。
        // 写成"先命中 override 就 continue"会让跨段被 overrideExempted 洗白(镜像 T31 钉住)。
        //
        // U2:正要判跨段,而这条锁条目带 `optional:` 标记 ⇒ 本解析器**不建模** pnpm 对
        // optional 条目的落段规则(现审面实测 `optional:` 出现 0 次 —— "没见过"不等于"无害",
        // 没见过就说明无从判),分不清这是漂移还是 optional 的合法落段。判不准。
        if (pick.entry.optional) {
          undetermined.push({
            reason: 'optional-placement-unmodeled',
            section,
            name,
            declared: spec,
            locked: pick.entry.specifier,
            lockedIn: pick.in,
          })
          continue
        }
        violations.push({
          kind: 'section-drift',
          section,
          name,
          declared: spec,
          locked: pick.entry.specifier,
          lockedIn: pick.in,
        })
        continue
      }
      // U1(非 peer 支):段维这条已经判完了(同段有条目),但值维读不出 ——
      // 不得拿 null 与声明值比出一枚 `locked: null` 的假 mismatch,也不得算"绿"。
      if (isUnset(pick.entry.specifier) || typeof spec !== 'string') {
        undetermined.push({
          reason: 'value-unreadable',
          section,
          name,
          declared: spec,
          locked: pick.entry.specifier,
          lockedIn: pick.in,
        })
        continue
      }
      const targets = matchOverrideTargets(overrideEntries, name)
      const values = [...new Set(targets.map((t) => t.value))]
      // 维度 A(宽松侧):lock 等于任一 override 目标 ⇒ 绿(这正是 pnpm 该写的那个值)
      const byTarget = candidates.find((c) => values.includes(c.entry.specifier))
      if (byTarget) {
        if (byTarget.entry.specifier !== spec) {
          overrideExempted.push({
            section,
            name,
            declared: spec,
            locked: byTarget.entry.specifier,
            lockedIn: byTarget.in,
            overrideKeys: targets
              .filter((t) => t.value === byTarget.entry.specifier)
              .map((t) => t.key),
          })
        }
        continue
      }
      const asDeclared = candidates.find((c) => c.entry.specifier === spec)
      // 严格侧(防"命中 override 就不判"的阉割):唯一一条**裸名** override 必然被 pnpm 落进 lock,
      // 于是 lock 仍停在 manifest 原值本身就是缺陷(lock 被手改 / 没跑全量 install)。
      const soleUnscoped =
        targets.length === 1 && targets[0].selector === null ? targets[0].value : null
      if (asDeclared && soleUnscoped && isRegistryRange(spec)) {
        violations.push({
          kind: 'override-not-applied',
          section,
          name,
          declared: spec,
          locked: asDeclared.entry.specifier,
          lockedIn: asDeclared.in,
          overrideValue: soleUnscoped,
        })
        continue
      }
      if (asDeclared) continue
      violations.push({
        kind: 'mismatch',
        section,
        name,
        declared: spec,
        locked: pick.entry.specifier,
        lockedIn: pick.in,
        overrideTargets: values.length > 0 ? values : undefined,
      })
    }
  }
  for (const [s, m] of lockSections) {
    for (const [name, entry] of m) {
      if (!declaredNames.has(name)) orphans.push({ section: s, name, locked: entry.specifier })
    }
  }
  return { violations, orphans, overrideExempted, peerExempted, undetermined }
}

/** 维度 A 的输入:同一个面读 pnpm-workspace.yaml 的 overrides 段 */
function loadOverrides(reader) {
  const entries = parseWorkspaceOverrides(
    reader.readFace('pnpm-workspace.yaml'),
    'pnpm-workspace.yaml',
  )
  const parentScoped = entries.filter((e) => splitOverrideKey(e.key).parentScoped).length
  return { entries, parentScoped }
}

function readPkgJson(reader, rel) {
  const relPath = rel === '.' ? 'package.json' : `${rel}/package.json`
  const raw = reader.readFace(relPath)
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Undetermined(`${reader.label} 里的 ${relPath} 不是合法 JSON: ${e.message}`)
  }
}

export function runCheck(root, face = 'worktree') {
  try {
    const reader = makeFaceReader(face, root)
    const rels = discoverPackages(reader)
    // 枚举到 0 个包 ⇒ 判死,不得记绿(本仓口径:"扫到 0" 先怀疑尺子)。discoverPackages 恒含
    // 根包 '.',所以这一格正常仓永不触发;真触发只可能是 glob 解析或面取材出了岔口。
    if (rels.length === 0)
      throw new Undetermined(`${reader.label} 上枚举到 0 个 workspace 包,无法判定`)
    const { entries: overrideEntries, parentScoped } = loadOverrides(reader)
    reader.prefetch([
      ...rels.map((r) => (r === '.' ? 'package.json' : `${r}/package.json`)),
      'pnpm-lock.yaml',
    ])
    const importers = parseLockImporters(reader.readFace('pnpm-lock.yaml'))
    const violations = []
    const orphans = []
    const overrideExempted = []
    const peerExempted = []
    const undeterminedItems = []
    let declarations = 0
    let sectionChecked = 0
    let peerSectionSkipped = 0
    const lockSectionNames = new Map()
    for (const rel of rels) {
      const pkg = readPkgJson(reader, rel)
      const declaredBySection = {}
      let pkgDeclared = 0
      for (const s of DEP_SECTIONS) {
        declaredBySection[s] = pkg[s] && typeof pkg[s] === 'object' ? pkg[s] : {}
        pkgDeclared += Object.keys(declaredBySection[s]).length
      }
      declarations += pkgDeclared
      const lockSections = importers.get(rel)
      if (!lockSections) {
        if (pkgDeclared > 0) {
          violations.push({
            kind: 'missing-importer',
            pkg: rel,
            section: null,
            name: null,
            declared: `${pkgDeclared} 条`,
            locked: null,
            lockedIn: null,
          })
        }
        continue
      }
      for (const s of lockSections.keys())
        lockSectionNames.set(s, (lockSectionNames.get(s) ?? 0) + 1)
      // **段位置维度的覆盖面自证**:R6 逐段核的是"非 peer 的声明键"(peer 由维度 B 接管,且实测
      // lock 的 importer 里没有 peerDependencies 段可比)。不报这个数,"违规 0" 就与"这一维一条
      // 都没看"在账面上长得一模一样 —— 本仓把"把没判写成判过了"记为最高频失效型。
      for (const s of DEP_SECTIONS) {
        if (s === 'peerDependencies') peerSectionSkipped += Object.keys(declaredBySection[s]).length
        else sectionChecked += Object.keys(declaredBySection[s]).length
      }
      const r = compareDeclarations(declaredBySection, lockSections, overrideEntries)
      for (const v of r.violations) v.pkg = rel
      for (const o of r.orphans) o.pkg = rel
      for (const x of r.overrideExempted) x.pkg = rel
      for (const x of r.peerExempted) x.pkg = rel
      for (const u of r.undetermined) u.pkg = rel
      violations.push(...r.violations)
      orphans.push(...r.orphans)
      overrideExempted.push(...r.overrideExempted)
      peerExempted.push(...r.peerExempted)
      undeterminedItems.push(...r.undetermined)
    }
    return {
      undetermined: null,
      judgedFace: face,
      packagesScanned: rels.length,
      declarations,
      violations,
      orphans,
      overrideExempted,
      peerExempted,
      overridesLoaded: overrideEntries.length,
      parentScopedOverrides: parentScoped,
      sectionDrift: violations.filter((v) => v.kind === 'section-drift'),
      sectionChecked,
      peerSectionSkipped,
      // 三型判不准(U1/U2/U3)逐条点名 —— 它必须与"放过"分列,否则"没判"与"判过且干净"
      // 在账面上同形(本仓最高频失效型)。--strict 据此拒绝出具合格证。
      undeterminedItems,
      lockSectionNames: [...lockSectionNames.entries()].sort(),
    }
  } catch (e) {
    if (e instanceof Undetermined) {
      return {
        undetermined: e.message,
        judgedFace: FACES.includes(face) ? face : null,
        packagesScanned: 0,
        declarations: 0,
        violations: [],
        orphans: [],
        overrideExempted: [],
        peerExempted: [],
        overridesLoaded: 0,
        parentScopedOverrides: 0,
        sectionDrift: [],
        sectionChecked: 0,
        peerSectionSkipped: 0,
        undeterminedItems: [],
        lockSectionNames: [],
      }
    }
    throw e
  }
}

function formatViolation(v) {
  if (v.kind === 'missing-importer') {
    return `[缺记账] ${v.pkg}: lock 的 importers 里没有该包条目,而 package.json 声明了 ${v.declared}`
  }
  if (v.kind === 'missing') {
    return `[缺记账] ${v.pkg} ${v.section}.${v.name}: 声明 ${v.declared},lock importer 里无此条目`
  }
  if (v.kind === 'section-drift') {
    return (
      `[分区漂移] ${v.pkg} 把 ${v.name} 声明在 ${v.section},而 lock 只记在 ${v.lockedIn}` +
      `(specifier ${v.locked})。名字与值都对 ⇒ R1/mismatch 全盲,而依赖**类型**已经不一致:` +
      `安装面按 lock 走、打包闭包按 manifest 走。修法只有把两边摆回同一段 —— 通常是` +
      `在**干净检出**里跑一次全量 pnpm install(不带 --filter)重导出该 importer,而不是手改 lock`
    )
  }
  if (v.kind === 'override-not-applied') {
    return (
      `[override 未落 lock] ${v.pkg} ${v.section}.${v.name}: manifest 声明 ${v.declared} 且 lock 也记 ${v.locked},` +
      `但 pnpm-workspace.yaml 有裸名 override → ${v.overrideValue}。pnpm 必然把 override 目标写进 lock,` +
      `两者同时停在原值说明 lock 被手改或没跑全量 pnpm install`
    )
  }
  return (
    `[不一致] ${v.pkg} ${v.section}.${v.name}: 声明 ${v.declared} ≠ lock specifier ${v.locked}` +
    (v.lockedIn && v.lockedIn !== v.section ? `(记在 ${v.lockedIn} 段)` : '') +
    (v.overrideTargets && v.overrideTargets.length > 0
      ? `(该依赖有 override,期望值应为 ${v.overrideTargets.join(' | ')} 之一,两者都不是)`
      : '')
  )
}

/** 三型判不准的说辞(报告面与 --json 共用一份,不得两处各写一遍) */ const UNDET_REASON_TEXT = {
  'value-unreadable': '锁条目没有 specifier 字段 ⇒ 值维判不准(段维按键在位照判)',
  'optional-placement-unmodeled':
    '锁条目带 optional 标记 ⇒ 本判据不建模 optional 的落段规则,段维判不准',
  'peer-section-exists-but-skipped':
    'importer 有 peerDependencies 段而该 peer 声明不在其中 ⇒ 维度 B 的豁免前提不再成立',
}

/**
 * 合格证拒绝判据 —— **唯一一份**。报告文案与 --json 的退出码必须同源:两处各写一遍
 * "什么算不出证"必然漂移,而漂移的表现永远是"某一条路径悄悄放行"(本仓 §"两处算同一件事")。
 * 红(violations)优先于不出证:已判出的违规必须点名,不能被"不出合格证"盖掉。
 */
export function certRefusal(result, strict) {
  if (!strict) return null
  if (result.violations.length > 0) return null
  const undets = result.undeterminedItems ?? []
  if (undets.length > 0 || result.sectionChecked === 0)
    return { undets: undets.length, sectionChecked: result.sectionChecked }
  return null
}

/** 退出码的唯一算式(0 通过 / 1 业务违规 / 2 无法判定或 --strict 拒绝出合格证) */
export function decideExitCode(result, strict) {
  if (result.undetermined) return 2
  if (result.violations.length > 0) return 1
  if (certRefusal(result, strict)) return 2
  return 0
}

function report(result, mode, face, strict = false) {
  const judged = face ?? result.judgedFace ?? 'worktree'
  console.log(
    `🔍 lock↔manifest specifier 对账 [${mode}] | 判定面: ${FACE_LABEL[judged]} —— ${FACE_NOTE[judged]}`,
  )
  console.log('   对账恒为全量(某包破损与"本次改了什么"无关),但内容一律取自上述单一面,不混读盘')
  if (result.undetermined) {
    console.error(
      `❌ 无法判定: ${result.undetermined} —— 本门拒绝在判据失效时"静默记为通过"(exit 2)`,
    )
    return decideExitCode(result, strict)
  }
  console.log(
    `扫描包 ${result.packagesScanned} / 声明条目 ${result.declarations} / 违规 ${result.violations.length} / 孤儿记账 ${result.orphans.length}(反向条目不计红,如实报数)`,
  )
  console.log(
    `维度 A overrides 表 ${result.overridesLoaded} 条(父作用域 > 形态 ${result.parentScopedOverrides} 条不参与直接声明比对)` +
      ` / 因 override 目标值放过 ${result.overrideExempted.length} 条` +
      ` / 维度 B peer 只验条目在位(不比 specifier)${result.peerExempted.length} 条`,
  )
  // R6 必须单独报一行"核了多少 / 违规多少":它若只混在"违规 N"里,读报告的人无法区分
  // "这一维判过且干净"与"这一维根本没跑到"(例如整仓 peer 豁免写宽了、或 importer 段集变了)。
  console.log(
    `维度 R6 段位置对账:核 ${result.sectionChecked} 条非 peer 声明键(逐段比清单段↔锁段)` +
      ` / 段位置违规 ${result.sectionDrift.length}` +
      ` / peer 声明 ${result.peerSectionSkipped} 条不参与本维` +
      `(实测 lock 的 importer 段集 = [${result.lockSectionNames.map(([s, n]) => `${s}×${n}`).join(', ') || '空'}],` +
      `无 peerDependencies 段可比)` +
      (result.sectionChecked === 0 ? ' —— ⚠️ 一条都没核,不得把本维读成"已通过"' : ''),
  )
  // **未判定必须自成一维**,既不进 violations 也不进"放过"清单:"放过"是"判了、结论是合法",
  // "未判定"是"没判出结论"。两者同形就是把没判写成判过了(本仓记过最多次的失效型)。
  const undets = result.undeterminedItems ?? []
  console.log(
    `未判定 ${undets.length} 条(段/值判不准,既不记绿也不冒红${strict ? ';--strict 下拒绝出合格证' : ';默认档只报数'})` +
      (undets.length > 0 ? ':' : ' —— 本维全部判出结论'),
  )
  for (const u of undets) {
    console.log(
      `[未判定] ${u.pkg} ${u.section}.${u.name}: ${(UNDET_REASON_TEXT[u.reason] ?? u.reason).trim()}` +
        `(锁记在 ${u.lockedIn},specifier ${u.locked})`,
    )
  }
  for (const v of result.violations) console.log(formatViolation(v))
  for (const o of result.orphans) {
    console.log(
      `[孤儿] ${o.pkg} ${o.section}.${o.name}: lock 仍记 ${o.locked},package.json 已不声明`,
    )
  }
  if (result.violations.length === 0) {
    // --strict 的语义是**拒绝出具合格证**,不是加判据。判据只有一份(certRefusal),
    // 文案与退出码同源 —— 报告说"拒绝"而退出码给 0,就等于写了一条跑不通的出路。
    const refusal = certRefusal(result, strict)
    if (refusal) {
      console.error(
        `❌ --strict 拒绝出具合格证:未判定 ${refusal.undets} 条、段维核对 ${refusal.sectionChecked} 条` +
          `(要求未判定 = 0 且段维至少核过 1 条)—— "没判出结论"不得读成"通过"`,
      )
    } else {
      console.log(
        `✅ specifier 全部一致、段位置违规 ${result.sectionDrift.length}(孤儿记账 ${result.orphans.length} 条、override 放过 ${result.overrideExempted.length} 条、peer 放过 ${result.peerExempted.length} 条均不计红)`,
      )
    }
    return decideExitCode(result, strict)
  }
  console.log(
    '修复姿势: 改 package.json 后跑一次全量 `pnpm install`(不带 --filter)让 lock 重新记账,两者必须同 commit。',
  )
  return decideExitCode(result, strict)
}

function w(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

/**
 * 测试/自检通道:在**临时夹具仓**里跑 git —— 派生本体仍是共用层的那一处(`gitRaw` 自带绝对路径
 * git + `safe.directory` + windowsHide + 数字 timeout,并把 `-C <dir>` 拼在这些 args 之前)。
 * 只在 mkScratch 目录里调用,绝不碰真仓;`core.autocrlf=false` 保证索引/HEAD blob 与写入字节
 * 逐字相同(否则换行归一会让"同一面"的比对失去意义)。
 */
const FIXTURE_GIT_CONFIG = Object.entries({
  'init.defaultBranch': 'main',
  'user.name': 'gate-fixture',
  'user.email': 'gate-fixture@invalid',
  'commit.gpgsign': 'false',
  'core.autocrlf': 'false',
}).flatMap(([key, value]) => ['-c', `${key}=${value}`])

export function gitInFixture(dir, args) {
  return gitRaw([...FIXTURE_GIT_CONFIG, ...args], dir, { timeout: GIT_TIMEOUT })
}

/** 测试/自检通道:把磁盘夹具变成一个真 git 仓(init + add,可选 commit) */
export function gitifyFixture(dir, { commit = true } = {}) {
  gitInFixture(dir, ['init', '-q'])
  gitInFixture(dir, ['add', '-A'])
  if (commit) gitInFixture(dir, ['commit', '-q', '-m', 'gate fixture'])
  return dir
}

const DEFAULT_WORKSPACE_YAML = "packages:\n  - 'apps/*'\n"
const DEFAULT_DEV_DEPS_BLOCK =
  "      typescript:\n        specifier: 'catalog:'\n        version: 5.9.3"

function makeFixture(
  dir,
  { webPkg, lock, rootPkg = { name: 'fixture-root' }, workspace = DEFAULT_WORKSPACE_YAML },
) {
  w(join(dir, 'pnpm-workspace.yaml'), workspace)
  w(join(dir, 'package.json'), JSON.stringify(rootPkg, null, 2))
  w(join(dir, 'apps', 'web', 'package.json'), JSON.stringify({ name: 'web', ...webPkg }, null, 2))
  w(join(dir, 'pnpm-lock.yaml'), lock)
  return dir
}

function lockWith(webDepsBlock, webDevDepsBlock = DEFAULT_DEV_DEPS_BLOCK) {
  return [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  .: {}',
    '',
    '  apps/web:',
    '    dependencies:',
    webDepsBlock,
    '    devDependencies:',
    webDevDepsBlock,
    '',
    'packages:',
    '',
    "  '@e965/xlsx@0.20.3': {}",
    '',
  ].join('\n')
}

/** 按段生成 importer 块(维度 A/B 的夹具需要 devDependencies 段与 override 表成对出现) */
function lockFrom(sections) {
  const lines = ["lockfileVersion: '9.0'", '', 'importers:', '', '  .: {}', '', '  apps/web:']
  for (const [section, map] of Object.entries(sections)) {
    if (Object.keys(map).length === 0) continue
    lines.push(`    ${section}:`)
    for (const [name, spec] of Object.entries(map)) {
      lines.push(
        `      ${JSON.stringify(name)}:`,
        `        specifier: ${JSON.stringify(spec)}`,
        '        version: 0.0.0',
      )
    }
  }
  lines.push('', 'packages:', '')
  return lines.join('\n')
}

/** 维度 A 夹具用的 workspace 文件:扁平 overrides + 后续顶层段(同时验"块到哪结束") */
function wsWithOverrides(overrideLines) {
  return [
    'packages:',
    "  - 'apps/*'",
    '',
    'overrides:',
    ...overrideLines,
    '',
    'peerDependencyRules:',
    '  ignoreMissing:',
    "    - '@opentelemetry/api'",
    '',
  ].join('\n')
}

/**
 * 逐条控制 importer 条目字段的夹具构造器。
 * `lockFrom` 恒写 specifier+version,而三型判不准(U1 缺 specifier / U2 带 optional)
 * 恰恰要求"少写字段"与"多写字段"两种异形 —— 那种形状只能精确点出来,不得靠改
 * lockFrom 的默认行为去凑(那会把正常夹具一起改掉)。
 */
export function lockExact(sections) {
  const lines = ["lockfileVersion: '9.0'", '', 'importers:', '', '  .: {}', '', '  apps/web:']
  for (const [section, list] of Object.entries(sections)) {
    if (list.length === 0) continue
    lines.push(`    ${section}:`)
    for (const dep of list) {
      lines.push(`      ${JSON.stringify(dep.name)}:`)
      for (const [k, v] of Object.entries(dep)) {
        if (k === 'name') continue
        lines.push(`        ${k}: ${JSON.stringify(v)}`)
      }
    }
  }
  lines.push('', 'packages:', '')
  return lines.join('\n')
}

const ACCIDENT_DEPS_BLOCK = [
  '      xlsx:',
  '        specifier: npm:@e965/xlsx@^0.20.3',
  "        version: '@e965/xlsx@0.20.3'",
  "      '@ihui/shared':",
  '        specifier: workspace:*',
  '        version: link:../packages/shared',
  '      jszip:',
  '        specifier: ^3.10.1',
  '        version: 3.10.1',
].join('\n')

export function runSelfTest() {
  const results = []
  const t = (label, cond) => results.push({ label, ok: !!cond })
  const scratch = mkScratch('lock-manifest-consistency')
  try {
    const baseWeb = {
      dependencies: {
        xlsx: '^0.18.5',
        '@ihui/shared': 'workspace:*',
      },
    }
    const aligned = makeFixture(join(scratch, 'aligned'), {
      webPkg: { dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3', '@ihui/shared': 'workspace:*' } },
      lock: lockWith(ACCIDENT_DEPS_BLOCK),
    })
    const broken = makeFixture(join(scratch, 'broken'), {
      webPkg: baseWeb,
      lock: lockWith(ACCIDENT_DEPS_BLOCK),
    })

    const rAligned = runCheck(aligned)
    const rBroken = runCheck(broken)

    t(
      '①事故形态:声明 ^0.18.5 vs lock npm:@e965/xlsx@^0.20.3 必判红',
      rBroken.violations.length === 1 &&
        rBroken.violations[0].kind === 'mismatch' &&
        rBroken.violations[0].name === 'xlsx',
    )
    t('①反向对照:改一致后必绿', rAligned.violations.length === 0 && rAligned.undetermined === null)
    t(
      '⑥workspace:* 一致时绿(参与比对不跳过)',
      rAligned.violations.every((v) => v.name !== '@ihui/shared'),
    )
    t(
      '④孤儿(jszip)不判红但报数',
      rAligned.violations.length === 0 && rAligned.orphans.some((o) => o.name === 'jszip'),
    )

    const drift = makeFixture(join(scratch, 'ws-drift'), {
      webPkg: { dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3', '@ihui/shared': 'workspace:^' } },
      lock: lockWith(ACCIDENT_DEPS_BLOCK),
    })
    const rDrift = runCheck(drift)
    t(
      '⑥workspace: 协议 specifier 漂移(* vs ^)必判红',
      rDrift.violations.length === 1 && rDrift.violations[0].name === '@ihui/shared',
    )

    const missingPkg = makeFixture(join(scratch, 'missing'), {
      webPkg: {
        dependencies: {
          xlsx: 'npm:@e965/xlsx@^0.20.3',
          '@ihui/shared': 'workspace:*',
          'docx-preview': '^0.3.5',
        },
      },
      lock: lockWith(ACCIDENT_DEPS_BLOCK),
    })
    const rMissing = runCheck(missingPkg)
    t(
      '③声明了但 lock 无条目(docx-preview)必判红 kind=missing',
      rMissing.violations.length === 1 &&
        rMissing.violations[0].kind === 'missing' &&
        rMissing.violations[0].name === 'docx-preview',
    )

    const noImporters = makeFixture(join(scratch, 'no-importers'), {
      webPkg: { dependencies: { xlsx: '^0.18.5' } },
      lock: "lockfileVersion: '9.0'\n\npackages:\n\n  foo@1.0.0: {}\n",
    })
    const rNoImp = runCheck(noImporters)
    t(
      '⑤lock 无 importers 块 → 无法判定(非绿非红)',
      rNoImp.undetermined !== null && rNoImp.violations.length === 0,
    )

    const weird = makeFixture(join(scratch, 'weird'), {
      webPkg: { dependencies: { xlsx: '^0.18.5' } },
      lock: "lockfileVersion: '9.0'\n\nimporters:\n\n  apps/web:\n    dependencies:\n      xlsx:\n        specifier: ^0.18.5\n        version: 0.18.5\n      '@odd/key':\n        bogon: 1\n",
    })
    const rWeird = runCheck(weird)
    t('⑤结构不认识(未知字段 bogon)→ 无法判定,不静默记过', rWeird.undetermined !== null)

    const importerAbsent = makeFixture(join(scratch, 'importer-absent'), {
      webPkg: { dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3' } },
      lock: "lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n\npackages:\n",
    })
    const rAbsent = runCheck(importerAbsent)
    t(
      '包整个没进 importer(声明>0)→ 判红 kind=missing-importer',
      rAbsent.violations.length === 1 && rAbsent.violations[0].kind === 'missing-importer',
    )

    const peerMerged = makeFixture(join(scratch, 'peer-merged'), {
      webPkg: {
        peerDependencies: { react: '>=18.0.0' },
        devDependencies: { typescript: 'catalog:' },
      },
      lock: lockWith("      react:\n        specifier: '>=18.0.0'\n        version: 19.2.8"),
    })
    const rPeer = runCheck(peerMerged)
    t(
      'peer 被 pnpm 并进 dependencies 段且 specifier 相同 → 绿(不误报 missing)',
      rPeer.violations.length === 0 && rPeer.orphans.length === 0,
    )

    /* ---------- R6:分区漂移(名字与值都对,只有"依赖类型"不一致) ---------- */
    const secDrift = makeFixture(join(scratch, 'section-drift'), {
      // 声明在 dependencies,lock 只记在 devDependencies ⇒ 这正是 2026-09-26 CI 那晚的形状
      webPkg: { dependencies: { xlsx: '^0.18.5', '@ihui/shared': 'workspace:*' } },
      lock: lockFrom({ devDependencies: { xlsx: '^0.18.5', '@ihui/shared': 'workspace:*' } }),
    })
    const rSecDrift = runCheck(secDrift)
    t(
      'R6 阳性对照:声明段与 lock 段不同形必判红,并点名两侧段名',
      rSecDrift.violations.length === 2 &&
        rSecDrift.violations.every(
          (v) =>
            v.kind === 'section-drift' &&
            v.section === 'dependencies' &&
            v.lockedIn === 'devDependencies',
        ),
    )
    const driftFixed = makeFixture(join(scratch, 'section-drift-fixed'), {
      webPkg: { dependencies: { xlsx: '^0.18.5', '@ihui/shared': 'workspace:*' } },
      lock: lockFrom({ dependencies: { xlsx: '^0.18.5', '@ihui/shared': 'workspace:*' } }),
    })
    const rDriftFixed = runCheck(driftFixed)
    t(
      'R6 反向对照:把两边摆回同一段即绿(证明上一条不是恒真)',
      rDriftFixed.violations.length === 0 && rDriftFixed.undetermined === null,
    )
    t(
      'R6 不误伤 peer:lock 的 importer 里没有 peerDependencies 段可比 ⇒ 维度 B 的豁免面不能被 R6 吃回来',
      rPeer.violations.every((v) => v.kind !== 'section-drift'),
    )

    /* ---------- R6 的第二格方向:真事故那一条是 dev 声明 → lock 记 deps,不是只有 deps → dev ---------- */
    const secDriftToDeps = makeFixture(join(scratch, 'section-drift-to-deps'), {
      // 2026-09-26 那晚 CI 红的正是这个方向:清单把 @ihui/types 放 devDependencies,
      // 锁却记在 dependencies 段(`git show a980463fc^:pnpm-lock.yaml` 现读)。
      webPkg: { devDependencies: { '@ihui/types': 'workspace:*' } },
      lock: lockFrom({ dependencies: { '@ihui/types': 'workspace:*' } }),
    })
    const rDriftToDeps = runCheck(secDriftToDeps)
    t(
      'R6 反方向(声明 dev、锁记 deps)同样判红并点名两侧段 ⇒ 判据不依赖方向',
      rDriftToDeps.violations.length === 1 &&
        rDriftToDeps.violations[0].kind === 'section-drift' &&
        rDriftToDeps.violations[0].section === 'devDependencies' &&
        rDriftToDeps.violations[0].lockedIn === 'dependencies',
    )
    const driftToDepsFixed = makeFixture(join(scratch, 'section-drift-to-deps-fixed'), {
      webPkg: { devDependencies: { '@ihui/types': 'workspace:*' } },
      lock: lockFrom({ devDependencies: { '@ihui/types': 'workspace:*' } }),
    })
    t(
      'R6 反方向反向对照:摆回 dev 段即绿(证明上一条不是恒真)',
      runCheck(driftToDepsFixed).violations.length === 0,
    )

    /* ---------- R6 的豁免必须是"peer 一律不判段位置",不得写成"只认 dev 段" ---------- */
    const peerIntoDeps = makeFixture(join(scratch, 'peer-into-deps'), {
      // 真仓 HEAD 主导形态:纯 peer 声明被 pnpm 记进 **dependencies** 段
      // (实测 10 条 peer 声明里 6 条落 dependencies、4 条落 devDependencies,而 importer
      // 段集里根本没有 peerDependencies)。若把豁免收窄成"peer 只允许记 dev 段",
      // 这 6 条会在提交链上恒红 —— 那就是替自己的豁免面造假阳。
      webPkg: { peerDependencies: { react: '^18.0.0 || ^19.0.0' } },
      lock: lockFrom({ dependencies: { react: '^19.2.8' } }),
    })
    const rPeerIntoDeps = runCheck(peerIntoDeps)
    t(
      'R6 纯 peer 记进 dependencies 段必须放过(真仓 6/10 的主导形态),且仍计入 peerExempted',
      rPeerIntoDeps.violations.length === 0 && rPeerIntoDeps.peerExempted.length === 1,
    )
    const peerNotAtAll = makeFixture(join(scratch, 'peer-not-at-all'), {
      webPkg: { peerDependencies: { ghost: '^1.0.0' } },
      lock: lockFrom({ dependencies: { unrelated: '^1.0.0' } }),
    })
    t(
      'peer 在锁里彻底没有条目 ⇒ 仍判红 missing(豁免只救"落在哪一段",不救"没记账")',
      runCheck(peerNotAtAll).violations.some((v) => v.name === 'ghost' && v.kind === 'missing'),
    )

    /* ---------- R6 覆盖面:optionalDependencies 也是被审段,不得只认 deps/devDeps 两段 ---------- */
    const optDrift = makeFixture(join(scratch, 'optional-drift'), {
      webPkg: { optionalDependencies: { fsevents: '^2.3.0' } },
      lock: lockFrom({ dependencies: { fsevents: '^2.3.0' } }),
    })
    const rOptDrift = runCheck(optDrift)
    t(
      'R6 optionalDependencies 跨段必判红(真仓 importer 段集实测含 optionalDependencies×1,不能只判两段)',
      rOptDrift.violations.length === 1 &&
        rOptDrift.violations[0].kind === 'section-drift' &&
        rOptDrift.violations[0].section === 'optionalDependencies' &&
        rOptDrift.violations[0].lockedIn === 'dependencies',
    )
    const optOk = makeFixture(join(scratch, 'optional-ok'), {
      webPkg: { optionalDependencies: { fsevents: '^2.3.0' } },
      lock: lockFrom({ optionalDependencies: { fsevents: '^2.3.0' } }),
    })
    t(
      'R6 optionalDependencies 同段必绿(证明上一条是判据不是逢段即红)',
      runCheck(optOk).violations.length === 0,
    )

    /* ---------- R6 的覆盖面自证数字:报出来的"核了 N 条"必须真等于被审的声明槽位 ---------- */
    const counted = makeFixture(join(scratch, 'section-counted'), {
      webPkg: {
        dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3', '@ihui/shared': 'workspace:*' },
        devDependencies: { typescript: 'catalog:' },
        peerDependencies: { react: '^19.0.0' },
      },
      lock: lockFrom({
        dependencies: {
          xlsx: 'npm:@e965/xlsx@^0.20.3',
          '@ihui/shared': 'workspace:*',
          react: '^19.2.8',
        },
        devDependencies: { typescript: 'catalog:' },
      }),
    })
    const rCounted = runCheck(counted)
    t(
      'R6 覆盖面计数:sectionChecked = 非 peer 声明槽位数(peer 走 skipped)，不得把没核的算进核过的',
      rCounted.violations.length === 0 &&
        rCounted.sectionChecked === 3 &&
        rCounted.peerSectionSkipped === 1 &&
        rCounted.sectionDrift.length === 0,
    )
    const rDriftCount = runCheck(secDrift)
    t(
      'R6 的 sectionDrift 必须与实际 kind 逐条等值(报告行与判据不得各数各的)',
      rDriftCount.sectionDrift.length === 2 &&
        rDriftCount.sectionDrift.length ===
          rDriftCount.violations.filter((v) => v.kind === 'section-drift').length &&
        rDriftCount.lockSectionNames.some(([s]) => s === 'devDependencies'),
    )
    const rEmptyImporter = runCheck(importerAbsent)
    t(
      '包整个没进 importer 时"核 0 条"必须如实为 0(不得把缺记账的槽位算成已核过 ⇒ 覆盖面虚报)',
      rEmptyImporter.sectionChecked === 0 &&
        rEmptyImporter.violations[0].kind === 'missing-importer',
    )

    const quoted = makeFixture(join(scratch, 'quoted'), {
      webPkg: { devDependencies: { typescript: 'catalog:' } },
      lock: lockWith(
        ACCIDENT_DEPS_BLOCK.replace(
          "      '@ihui/shared':",
          "      jszip2:\n        specifier: '^3.10.1'\n        version: 3.10.1\n      '@ihui/shared':",
        ),
      ),
    })
    const rQuoted = runCheck(quoted)
    t("引号形态 specifier('catalog:')去引号后比对,不误报", rQuoted.violations.length === 0)

    t(
      '零声明包缺 importer 不判红',
      runCheck(
        makeFixture(join(scratch, 'zero-dep'), {
          webPkg: {},
          lock: "lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n\npackages:\n",
        }),
      ).violations.length === 0,
    )

    /* ---------- 维度 A:overrides 参与比对(R4) ---------- */
    t(
      'splitOverrideKey:scoped 名首个 @ 属 scope、版本选择器前缀归属、父作用域 > 识别',
      splitOverrideKey('@types/react@^19').name === '@types/react' &&
        splitOverrideKey('@types/react@^19').selector === '^19' &&
        splitOverrideKey('@types/react').name === '@types/react' &&
        splitOverrideKey('postcss@<=8.5.22').name === 'postcss' &&
        splitOverrideKey('foo>bar').parentScoped === true,
    )
    t(
      'splitOverrideKey:`>=` 里的 > 不是父作用域分隔符(真仓 13 条键带 >=,误判即整类 override 隐身)',
      splitOverrideKey('fast-uri@>=3.0.0 <3.1.6').parentScoped === false &&
        splitOverrideKey('fast-uri@>=3.0.0 <3.1.6').name === 'fast-uri' &&
        splitOverrideKey('fast-uri@>=3.0.0 <3.1.6').selector === '>=3.0.0 <3.1.6' &&
        splitOverrideKey('foo@>1.0.0').parentScoped === false &&
        splitOverrideKey('@scope/parent>@scope/child').parentScoped === true,
    )
    t(
      '无 overrides 段的 workspace 文件 → 空表(合法,不是无法判定)',
      parseWorkspaceOverrides(DEFAULT_WORKSPACE_YAML).length === 0,
    )

    const wsScoped = wsWithOverrides(["  '@types/react': 19.2.18", '  postcss@<=8.5.22: ^8.5.23'])
    const rOvrPass = runCheck(
      makeFixture(join(scratch, 'ovr-pass'), {
        webPkg: { devDependencies: { '@types/react': '^19.0.0', postcss: '^8.4.49' } },
        lock: lockFrom({ devDependencies: { '@types/react': '19.2.18', postcss: '^8.5.23' } }),
        workspace: wsScoped,
      }),
    )
    t(
      '维度 A:裸名 override 与 `名字@选择器` 两种键都命中,lock 等于 override 目标 → 绿且如实报数(真仓 19 枚的形状)',
      rOvrPass.undetermined === null &&
        rOvrPass.violations.length === 0 &&
        rOvrPass.overrideExempted.length === 2,
    )

    const wsStrict = wsWithOverrides(['  lodash-es: 9.9.9', '  webpack: 5.99.0'])
    const rOvrRed = runCheck(
      makeFixture(join(scratch, 'ovr-red'), {
        webPkg: { dependencies: { 'lodash-es': '^1.2.0' } },
        lock: lockFrom({ dependencies: { 'lodash-es': '^7.7.7' } }),
        workspace: wsStrict,
      }),
    )
    t(
      '维度 A 反向对照①:被 override 的依赖,manifest 与 lock 都不等于 override 目标 → 必红(点名期望值)',
      rOvrRed.violations.length === 1 &&
        rOvrRed.violations[0].kind === 'mismatch' &&
        rOvrRed.violations[0].overrideTargets?.join('|') === '9.9.9',
    )
    const rOvrNotApplied = runCheck(
      makeFixture(join(scratch, 'ovr-not-applied'), {
        webPkg: { dependencies: { webpack: '^5.10.0' } },
        lock: lockFrom({ dependencies: { webpack: '^5.10.0' } }),
        workspace: wsStrict,
      }),
    )
    t(
      '维度 A 反向对照②(防阉割):lock 被手改回 manifest 原值而裸名 override 未落进 lock → 必红 kind=override-not-applied',
      rOvrNotApplied.violations.length === 1 &&
        rOvrNotApplied.violations[0].kind === 'override-not-applied',
    )
    const rOvrAligned = runCheck(
      makeFixture(join(scratch, 'ovr-aligned'), {
        webPkg: { dependencies: { webpack: '5.99.0' } },
        lock: lockFrom({ dependencies: { webpack: '5.99.0' } }),
        workspace: wsStrict,
      }),
    )
    t(
      '维度 A 反向对照③:manifest 已等于 override 目标且 lock 一致 → 绿',
      rOvrAligned.violations.length === 0,
    )

    const rUntouched = runCheck(
      makeFixture(join(scratch, 'ovr-unaffected'), {
        webPkg: { dependencies: { jszip: '^3.10.0' } },
        lock: lockFrom({ dependencies: { jszip: '^3.10.1' } }),
        workspace: wsStrict,
      }),
    )
    t(
      '未被 override、非 peer 的依赖在"表里有别的 override"时仍走原判据 → 必红(今天的真事故形态)',
      rUntouched.violations.length === 1 &&
        rUntouched.violations[0].kind === 'mismatch' &&
        rUntouched.violations[0].overrideTargets === undefined,
    )
    t(
      '同一条依赖改一致后必绿',
      runCheck(
        makeFixture(join(scratch, 'ovr-unaffected-ok'), {
          webPkg: { dependencies: { jszip: '^3.10.1' } },
          lock: lockFrom({ dependencies: { jszip: '^3.10.1' } }),
          workspace: wsStrict,
        }),
      ).violations.length === 0,
    )

    const wsSelector = wsWithOverrides(['  vite@<=6.4.2: ^6.4.3'])
    const rSelectorOut = runCheck(
      makeFixture(join(scratch, 'selector-out'), {
        webPkg: { devDependencies: { vite: '^7.0.0' } },
        lock: lockFrom({ devDependencies: { vite: '^7.0.0' } }),
        workspace: wsSelector,
      }),
    )
    t(
      '带 @版本选择器的 override 不匹配声明区间时不得强判(lock 等于 manifest 原值 → 绿)',
      rSelectorOut.violations.length === 0 && rSelectorOut.overrideExempted.length === 0,
    )

    const rSelectorApplied = runCheck(
      makeFixture(join(scratch, 'selector-applied'), {
        webPkg: { dependencies: { 'lodash-es': '^4.17.20' } },
        lock: lockFrom({ dependencies: { 'lodash-es': '^4.17.24' } }),
        workspace: wsWithOverrides(['  lodash-es@>=4.0.0 <=4.17.23: ^4.17.24']),
      }),
    )
    t(
      '带 >= 的版本选择器 override 端到端生效(误判成父作用域就会假红)',
      rSelectorApplied.violations.length === 0 && rSelectorApplied.overrideExempted.length === 1,
    )

    const wsParent = wsWithOverrides(["  '@aws-sdk/client-sts>fast-xml-parser': ^4.0.0"])
    const rParentOk = runCheck(
      makeFixture(join(scratch, 'parent-ok'), {
        webPkg: { dependencies: { 'fast-xml-parser': '^5.0.0' } },
        lock: lockFrom({ dependencies: { 'fast-xml-parser': '^5.0.0' } }),
        workspace: wsParent,
      }),
    )
    const rParentRed = runCheck(
      makeFixture(join(scratch, 'parent-red'), {
        webPkg: { dependencies: { 'fast-xml-parser': '^5.0.0' } },
        lock: lockFrom({ dependencies: { 'fast-xml-parser': '^4.0.0' } }),
        workspace: wsParent,
      }),
    )
    t(
      '父作用域 override 键不参与直接声明比对(计数如实、既不豁免也不误伤)',
      rParentOk.violations.length === 0 &&
        rParentOk.parentScopedOverrides === 1 &&
        rParentOk.overrideExempted.length === 0 &&
        rParentRed.violations.length === 1,
    )

    const rBadOverrides = runCheck(
      makeFixture(join(scratch, 'ovr-unparsable'), {
        webPkg: { dependencies: { jszip: '^3.10.1' } },
        lock: lockFrom({ dependencies: { jszip: '^3.10.1' } }),
        workspace: "packages:\n  - 'apps/*'\n\noverrides:\n  foo:\n    bar: 1.0.0\n",
      }),
    )
    t(
      'overrides 表形态不认识(嵌套 map)→ 无法判定 exit 2,不得退化成"当作没有 override"产红',
      rBadOverrides.undetermined !== null && rBadOverrides.violations.length === 0,
    )

    /* ---------- 维度 B:peer 记账只验条目在位(R5) ---------- */
    const rPeerDevSection = runCheck(
      makeFixture(join(scratch, 'peer-dev-section'), {
        webPkg: {
          peerDependencies: { '@tarojs/taro': '>=4.0.0' },
          devDependencies: { '@tarojs/taro': '4.2.1' },
        },
        lock: lockFrom({ devDependencies: { '@tarojs/taro': '4.2.1' } }),
      }),
    )
    t(
      '维度 B:peer 记在 devDependencies 段、specifier 是解析后的范围 → 绿并计入 peerExempted(真仓 3 枚的形状)',
      rPeerDevSection.violations.length === 0 && rPeerDevSection.peerExempted.length === 1,
    )
    const rPeerMissing = runCheck(
      makeFixture(join(scratch, 'peer-missing'), {
        webPkg: { peerDependencies: { 'peer-only': '^1.0.0' } },
        lock: lockFrom({}),
      }),
    )
    t(
      '维度 B 反向对照:peer 在 lock 任一段都没有条目 → 仍判红 kind=missing(只放过值,不放过缺记账)',
      rPeerMissing.violations.length === 1 && rPeerMissing.violations[0].kind === 'missing',
    )
    const rPeerAndOverride = runCheck(
      makeFixture(join(scratch, 'peer-and-override'), {
        webPkg: { peerDependencies: { react: '^18.0.0 || ^19.0.0' } },
        lock: lockFrom({ devDependencies: { react: '^18.2.0' } }),
        workspace: wsWithOverrides(['  react: 19.0.0']),
      }),
    )
    t(
      'A 与 B 同时适用时按 B 放过值比对(既非红也不记 override 放过)',
      rPeerAndOverride.violations.length === 0 &&
        rPeerAndOverride.peerExempted.length === 1 &&
        rPeerAndOverride.overrideExempted.length === 0,
    )

    const rCatalogGuard = runCheck(
      makeFixture(join(scratch, 'catalog-guard'), {
        webPkg: { devDependencies: { typescript: 'catalog:' } },
        lock: lockFrom({ devDependencies: { typescript: 'catalog:' } }),
        workspace: wsWithOverrides(['  typescript: 5.9.3']),
      }),
    )
    t(
      'catalog: 协议声明不参与"裸名 override 必须落 lock"的严格判(否则会误红)',
      rCatalogGuard.violations.length === 0,
    )

    /* ---------- R6 与维度 A/B 的协调(L14030 续票:override 不豁免段、peer 只豁免"落哪段") ---------- */
    const ovrWs = wsWithOverrides(['  dayjs: 2.0.0'])
    // 被 override 的依赖:manifest 记 devDeps、lock 记 deps,而值**恰好等于 override 目标**
    // ⇒ 必须判 section-drift,不得被 overrideExempted 洗白(头注:"override 改的是值,不改归属段")。
    const ovrDrift = makeFixture(join(scratch, 'ovr-cross-section'), {
      webPkg: { devDependencies: { dayjs: '^1.11.0' } },
      lock: lockFrom({ dependencies: { dayjs: '2.0.0' } }),
      workspace: ovrWs,
    })
    const rOvrDrift = runCheck(ovrDrift)
    t(
      'R6×维度A:被 override 的依赖跨段仍判 section-drift(段判排在 override 放过之前,值等于目标也不豁免)',
      rOvrDrift.violations.length === 1 &&
        rOvrDrift.violations[0].kind === 'section-drift' &&
        rOvrDrift.violations[0].section === 'devDependencies' &&
        rOvrDrift.violations[0].lockedIn === 'dependencies' &&
        rOvrDrift.overrideExempted.length === 0,
    )
    const ovrSame = makeFixture(join(scratch, 'ovr-same-section'), {
      webPkg: { devDependencies: { dayjs: '^1.11.0' } },
      lock: lockFrom({ devDependencies: { dayjs: '2.0.0' } }),
      workspace: ovrWs,
    })
    const rOvrSame = runCheck(ovrSame)
    t(
      'R6×维度A 反向对照:同一段 + 值等于 override 目标 ⇒ 绿并计 overrideExempted(证明上一条不是逢 override 即红)',
      rOvrSame.violations.length === 0 &&
        rOvrSame.overrideExempted.length === 1 &&
        rOvrSame.undeterminedItems.length === 0,
    )

    /* ---------- 三型判不准:既不冒红也不记绿,且必须被点名 ---------- */
    const noSpec = makeFixture(join(scratch, 'u1-no-specifier'), {
      webPkg: { dependencies: { dayjs: '^1.11.0' } },
      // 同段、条目在位,但锁里根本没写 specifier ⇒ 值维判不准。旧写法会拿 null 去比,
      // 产出一枚 locked:null 的假 mismatch(把没读到写成"值漂移")。
      lock: lockExact({ dependencies: [{ name: 'dayjs', version: '1.11.1' }] }),
    })
    const rU1 = runCheck(noSpec)
    t(
      'U1 锁条目缺 specifier ⇒ 落未判定,不得产假 mismatch,也不得算绿',
      rU1.violations.length === 0 &&
        rU1.undeterminedItems.length === 1 &&
        rU1.undeterminedItems[0].reason === 'value-unreadable' &&
        rU1.undeterminedItems[0].pkg === 'apps/web',
    )
    const u1StillDrift = makeFixture(join(scratch, 'u1-peer-no-specifier'), {
      webPkg: { peerDependencies: { react: '>=18' } },
      lock: lockExact({ devDependencies: [{ name: 'react', version: '19.0.0' }] }),
    })
    const rU1Peer = runCheck(u1StillDrift)
    t(
      'U1 的 peer 一支:值读不出不得计进 peerExempted(那是把没判写成"放过了一条值漂移")',
      rU1Peer.violations.length === 0 &&
        rU1Peer.peerExempted.length === 0 &&
        rU1Peer.undeterminedItems.length === 1,
    )
    const optCross = makeFixture(join(scratch, 'u2-optional-cross'), {
      webPkg: { dependencies: { fsevents: '^2.3.0' } },
      // 正要判跨段,而该条目带 optional: ⇒ 本解析器不建模 optional 的落段规则(现审面实测 0 次,
      // 没见过不等于无害)⇒ 判不准,既不判 drift 也不放过。
      lock: lockExact({
        devDependencies: [
          { name: 'fsevents', specifier: '^2.3.0', version: '2.3.3', optional: true },
        ],
      }),
    })
    const rU2 = runCheck(optCross)
    t(
      'U2 跨段 + 锁条目带 optional ⇒ 落未判定(不冒红也不记绿),段维不得拿没建模的形状判红',
      rU2.violations.length === 0 &&
        rU2.undeterminedItems.length === 1 &&
        rU2.undeterminedItems[0].reason === 'optional-placement-unmodeled',
    )
    const optSame = makeFixture(join(scratch, 'u2-optional-same'), {
      webPkg: { optionalDependencies: { fsevents: '^2.3.0' } },
      lock: lockExact({
        optionalDependencies: [
          { name: 'fsevents', specifier: '^2.3.0', version: '2.3.3', optional: true },
        ],
      }),
    })
    t(
      'U2 反向对照:同段 + optional ⇒ 绿且无未判定(optional 只让"跨段"这一结论失去资格)',
      runCheck(optSame).violations.length === 0 && runCheck(optSame).undeterminedItems.length === 0,
    )
    const peerSectionExists = makeFixture(join(scratch, 'u3-peer-section'), {
      webPkg: { peerDependencies: { react: '>=18' } },
      // 维度 B 的豁免前提是"实测 importer 没有 peerDependencies 段可比"。夹具里这个段存在
      // 而该 peer 不在其中 ⇒ 前提不再成立 ⇒ 判不准(不得继续静默豁免)。
      lock: lockExact({
        peerDependencies: [{ name: 'vue', specifier: '^3.0.0', version: '3.4.0' }],
        devDependencies: [{ name: 'react', specifier: '19.0.0', version: '19.0.0' }],
      }),
    })
    const rU3 = runCheck(peerSectionExists)
    t(
      'U3 importer 有 peer 段而该 peer 不在其中 ⇒ 落未判定,不得静默按维度 B 放过',
      rU3.violations.length === 0 &&
        rU3.undeterminedItems.length === 1 &&
        rU3.undeterminedItems[0].reason === 'peer-section-exists-but-skipped',
    )
    t(
      '判不准不得串门:U1 与真 mismatch 是两件事(值不等仍判 mismatch,不进未判定)',
      (() => {
        const realMismatch = makeFixture(join(scratch, 'u1-vs-real-mismatch'), {
          webPkg: { dependencies: { dayjs: '^1.11.0' } },
          lock: lockExact({
            dependencies: [{ name: 'dayjs', specifier: '^2.0.0', version: '2.0.0' }],
          }),
        })
        const rm = runCheck(realMismatch)
        return (
          rm.violations.length === 1 &&
          rm.violations[0].kind === 'mismatch' &&
          rm.undeterminedItems.length === 0
        )
      })(),
    )

    /* ---------- --strict:拒绝出具合格证,而不是加判据 ---------- */
    const strictGreen = runCheck(driftFixed) // 全同段、零未判定
    t(
      '--strict 的真绿侧:未判定 0 且段维核过 ≥1 条 ⇒ decideExitCode = 0(不得出生即红)',
      strictGreen.violations.length === 0 &&
        strictGreen.undeterminedItems.length === 0 &&
        strictGreen.sectionChecked > 0 &&
        decideExitCode(strictGreen, true) === 0,
    )
    t(
      '--strict 的拒绝侧:有未判定 ⇒ 默认档 0(提交链不受影响)、strict 档 2',
      decideExitCode(rU1, false) === 0 && decideExitCode(rU1, true) === 2,
    )
    t(
      '--strict 的段维失明侧:一条都没核(缺 importer 那型)⇒ 即便违规为 0 也拒绝出证',
      (() => {
        const noKeys = makeFixture(join(scratch, 'strict-no-section-keys'), {
          webPkg: { peerDependencies: { react: '>=18' } },
          lock: lockExact({
            devDependencies: [{ name: 'react', specifier: '>=18', version: '19' }],
          }),
        })
        const r = runCheck(noKeys)
        return (
          r.violations.length === 0 &&
          r.sectionChecked === 0 &&
          decideExitCode(r, false) === 0 &&
          decideExitCode(r, true) === 2
        )
      })(),
    )
    t(
      '红优先于不出证:已判出的违规必须点名,strict 不得把它盖成 2',
      (() => {
        const withViolation = makeFixture(join(scratch, 'strict-with-violation'), {
          webPkg: { dependencies: { dayjs: '^1.11.0' } },
          lock: lockFrom({ devDependencies: { dayjs: '^1.11.0' } }),
        })
        const r = runCheck(withViolation)
        return r.violations.length === 1 && decideExitCode(r, true) === 1
      })(),
    )
    t(
      'certRefusal 与 decideExitCode 必须同源(报告文案与退出码不得各判各的)',
      certRefusal(rU1, true) !== null &&
        certRefusal(rU1, false) === null &&
        certRefusal(strictGreen, true) === null &&
        decideExitCode(rU1, true) === 2 &&
        decideExitCode(rU1, false) === 0,
    )
    t(
      '整面无法判定(取不到)时 strict 不得把它改判成 0 或 1 —— 仍是 2,且违规清单为空',
      (() => {
        const r = runCheck(join(scratch, 'not-a-repo-at-all'), 'head')
        return (
          r.undetermined !== null &&
          r.violations.length === 0 &&
          r.undeterminedItems.length === 0 &&
          decideExitCode(r, true) === 2 &&
          decideExitCode(r, false) === 2
        )
      })(),
    )
    // ⚠️ 刻意**不**在自检里读真仓:--self-test 的既有契约是"临时目录小 fixture 正反成对,
    // 绝不扫真仓",而"真仓 HEAD 面 --strict 必须 RC=0(不得出生即红,§12e)"是一条会随仓库
    // 移动的读数 —— 按守门 103 T12 那一课,证明这类行为只能用纯函数 + 构造面;真仓那一格
    // 归镜像测试(它本来就带只读的真仓取证 T26/T27,本次新增 T32)。

    /* ---------- 判定面(2026-09-24 收口:--staged 判索引、全量判 HEAD,不判滞后的工作树) ---------- */
    const BROKEN_WEB = { dependencies: { xlsx: '^0.18.5', '@ihui/shared': 'workspace:*' } }
    const OK_WEB = {
      dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3', '@ihui/shared': 'workspace:*' },
    }
    const webPkgFile = (dir) => join(dir, 'apps', 'web', 'package.json')

    // ① 假绿钉死:索引里那对**不一致**,盘上随后**改对**
    const fakeGreen = gitifyFixture(
      makeFixture(join(scratch, 'face-fake-green'), {
        webPkg: BROKEN_WEB,
        lock: lockWith(ACCIDENT_DEPS_BLOCK),
      }),
    )
    w(webPkgFile(fakeGreen), JSON.stringify({ name: 'web', ...OK_WEB }, null, 2))
    const fgStaged = runCheck(fakeGreen, 'staged')
    const fgWorktree = runCheck(fakeGreen, 'worktree')
    t(
      '判定面①假绿钉死:索引那对不一致而盘上已改对 ⇒ staged 面必红、worktree 面才绿(旧实现在这里判盘即放行坏提交)',
      fgStaged.undetermined === null &&
        fgStaged.violations.length === 1 &&
        fgStaged.violations[0].kind === 'mismatch' &&
        fgStaged.judgedFace === 'staged' &&
        fgWorktree.violations.length === 0,
    )

    // ② 假红钉死:索引里那对**一致**,盘上是**别人半编辑的不一致**
    const fakeRed = gitifyFixture(
      makeFixture(join(scratch, 'face-fake-red'), {
        webPkg: OK_WEB,
        lock: lockWith(ACCIDENT_DEPS_BLOCK),
      }),
    )
    w(webPkgFile(fakeRed), JSON.stringify({ name: 'web', ...BROKEN_WEB }, null, 2))
    t(
      '判定面②假红钉死:索引一致而盘上是并行会话的半编辑态 ⇒ staged 面必绿(不产红到逼人 --no-verify)',
      runCheck(fakeRed, 'staged').violations.length === 0 &&
        runCheck(fakeRed, 'worktree').violations.length === 1,
    )

    // ③ 该面取不到 ⇒ 无法判定并点名路径,绝不"跳过该包再报绿"
    const noLock = gitifyFixture(
      makeFixture(join(scratch, 'face-no-lock'), {
        webPkg: OK_WEB,
        lock: lockWith(ACCIDENT_DEPS_BLOCK),
      }),
      { commit: false },
    )
    gitInFixture(noLock, ['rm', '-q', '--cached', 'pnpm-lock.yaml'])
    const rNoLock = runCheck(noLock, 'staged')
    const rNoHead = runCheck(noLock, 'head')
    t(
      '判定面③取不到必判"无法判定"并点名路径,不得记绿:索引里没有 pnpm-lock.yaml ⇒ staged 面红在取材上;' +
        '尚无提交 ⇒ head 面同样无法判定',
      rNoLock.undetermined !== null &&
        /pnpm-lock\.yaml/.test(rNoLock.undetermined) &&
        rNoLock.violations.length === 0 &&
        rNoHead.undetermined !== null &&
        rNoHead.violations.length === 0,
    )
    t(
      '未知判定面 ⇒ 显式无法判定,不得静默退回读盘',
      runCheck(fakeGreen, 'nope').undetermined !== null,
    )
    t(
      '判定面④同一轮只读一个面:head 面取到自己那份内容(有提交后 0 违规、面标记正确)',
      (() => {
        const committed = gitifyFixture(
          makeFixture(join(scratch, 'face-head-ok'), {
            webPkg: OK_WEB,
            lock: lockWith(ACCIDENT_DEPS_BLOCK),
          }),
        )
        w(webPkgFile(committed), JSON.stringify({ name: 'web', ...BROKEN_WEB }, null, 2))
        const rh = runCheck(committed, 'head')
        return (
          rh.undetermined === null &&
          rh.violations.length === 0 &&
          rh.judgedFace === 'head' &&
          runCheck(committed, 'worktree').violations.length === 1
        )
      })(),
    )
  } finally {
    rmScratch(scratch)
  }
  let failed = 0
  for (const r of results) {
    if (!r.ok) failed++
    console.log(`${r.ok ? '✅' : '❌'} ${r.label}`)
  }
  console.log(`--self-test: ${results.length - failed}/${results.length} 通过`)
  return failed === 0 ? 0 : 1
}

const FACE_FLAGS = { '--staged': 'staged', '--head': 'head', '--worktree': 'worktree' }

/**
 * CLI → 判定面。缺省(全量)判 HEAD,--staged 判索引,--worktree 是人工排查的逃生舱。
 * 同时给两个面旗标 ⇒ 立即 exit 2 报错:静默取其一会让"这次到底判了哪一面"无法从命令里读出。
 */
export function resolveFace(argv) {
  const given = Object.entries(FACE_FLAGS).filter(([flag]) => argv.includes(flag))
  if (given.length > 1) {
    throw new Undetermined(`判定面互相冲突: ${given.map(([f]) => f).join(' 与 ')} 只能给一个`)
  }
  if (given.length === 1) return { face: given[0][1], mode: given[0][0] }
  return { face: 'head', mode: '--all' }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(runSelfTest())
  }
  let root = DEFAULT_ROOT
  const ri = argv.indexOf('--root')
  if (ri !== -1) {
    const arg = argv[ri + 1]
    if (!arg) {
      console.error('❌ --root 需要一个目录参数')
      process.exit(2)
    }
    root = resolve(arg)
    if (!existsSync(root)) {
      console.error(`❌ --root 指向的目录不存在: ${root}`)
      process.exit(2)
    }
  }
  let face
  let mode
  try {
    ;({ face, mode } = resolveFace(argv))
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(2)
  }
  const strict = argv.includes('--strict')
  const result = runCheck(root, face)
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ mode, strict, ...result, judgedFace: face }, null, 2))
    // 退出码走同一个算式(decideExitCode):此前 --json 与 report 各写一遍 ternary,
    // 加一档就只有一处会带上它 —— 两处算同一件事必漂移,是本仓记过最多次的形态。
    process.exit(decideExitCode(result, strict))
  }
  process.exit(report(result, mode, face, strict))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  Undetermined,
  unquoteScalar,
  parseWorkspaceGlobs,
  discoverPackages,
  parseWorkspaceOverrides,
  splitOverrideKey,
  matchOverrideTargets,
  isRegistryRange,
  parseLockImporters,
  compareDeclarations,
  runCheck,
  runSelfTest,
  makeFixture,
  lockWith,
  lockFrom,
  // 逐字段控制 importer 条目(构造 U1 缺 specifier / U2 带 optional 两种异形)
  lockExact,
  wsWithOverrides,
  DEFAULT_WORKSPACE_YAML,
  ACCIDENT_DEPS_BLOCK,
  // 退出码只有一份算式:镜像测试要能直接调用它,不得在测试里再抄一遍 ternary(§22c)
  certRefusal,
  decideExitCode,
  UNDET_REASON_TEXT,
  // 判定面(§22c:面选择本身要能被测试直接调用,不得只活在文件内部)
  makeFaceReader,
  resolveFace,
  catBatch,
  gitifyFixture,
  gitInFixture,
  FACES,
  FACE_LABEL,
  FACE_NOTE,
  GIT_BIN,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

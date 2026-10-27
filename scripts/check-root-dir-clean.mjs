#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 根目录整洁守门 — 防止乱七八糟文件在一级目录下随意生成/放置。
 *
 * 依据 AGENTS.md「根目录整洁铁律」(强制):
 *   一级目录只允许保留白名单内的配置文件 / 标准文档 / 项目强制文档 / 固定目录。
 *   任何新文件 / 新目录 / 新隐藏文件落地根目录,均触发本守门,commit 时阻断。
 *
 * 白名单在本文件内维护(4 组 Set),封闭集合。新增合法条目必须显式把条目加进白名单
 * 并随 commit 一起提交,视为"显式审批"。禁止以「看起来无害」为由跳过白名单。
 *
 * 用法:
 *   node scripts/check-root-dir-clean.mjs --staged   (提交链档,三档退出码见下)
 *   node scripts/check-root-dir-clean.mjs             (现场报告档,**不判红也不判绿** ⇒ 只报数,exit 0)
 *
 * 退出码(2026-10-27 把"红"与"未判定"拆成两个码位;此前两型挤在同一条输出流里,
 * 归因层只从 blocking 红名单取红 ⇒ 门自报"未判定"时无人可指 ⇒ 应急档成了默认出口):
 *   0 = 通过,或只剩"早在 HEAD 里的存量"(照点名、只报数,§12e)
 *   1 = 判红:本次新入库(索引有 ∧ HEAD 无)的白名单外条目
 *   2 = 未判定:白名单外条目**未被 git 跟踪** ⇒ 归属无从判定;本门没有对本枚提交下结论,
 *       既不记绿也不冒红(AGENTS §0.3)。仍非零 ⇒ §28 的交付判据与 runner 照样拦得住。
 *   1 与 2 同时在场 ⇒ **红优先取 1**,但末行必须把两档**分别报数并点名**(结论行不折叠,
 *   见 resultLine);折叠就是把"未判定"偷偷折进"红",正是本票要杀的形态。
 *
 * 判定对象:一级目录(非递归)。二级目录内容(如 tmp/*、logs/*、node_modules/*)不在本
 * 守门范围,由 .gitignore 与各自的临时产物目录语义兜底。
 *
 * §22d 双形态入口:判据(归属分流、结论行)一律住在导出的纯函数里,`main()` 只在
 * `isDirectRun` 时执行 —— 镜像测试 `import { __test__ }` 取的是**同一把尺子**,不是第二份。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describeFlagToken, flagValue } from './lib/flag-value.mjs'
import { gitRaw } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'
// 结论行上的"未判定"结构化键与归因层认的那个键必须是**同一个字面量**(§0.6 单一真相源):
// 门打一份、归因层认另一份 ⇒ 改一次措辞就静默失联。故从 lib 取常量,不在本文件写字面量。
import { GATE_UNDETERMINED_MARK } from './lib/commit-gate-attribution.mjs'

/**
 * 仓库根。生产路径 = 调用方所在目录(与本门历史上完全一致,不改语义);
 * `--root <dir>` 是**测试通道**,让镜像测试能在临时 git 仓上跑端到端 —— 加它的原因不是
 * 便利,是"守门 70 的镜像测试 13/14 恒红"那一型:脚本按定义忽略 cwd 时,靠 cwd 定位夹具的
 * 测试其实全在审真仓,账面绿而结论与夹具无关。
 */
function resolveRoot(argv) {
  // G-322 第十六批(B 档收口):--root 缺值/被顶值时点名判死(exit 2),不再裸 throw(rc=1 无点名)。
  const flag = flagValue(argv, '--root')
  if (flag.present) {
    if (!flag.valid) {
      console.error(`❌ --root 需要一个目录参数 —— 紧邻的 token 实得:${describeFlagToken(flag)}`)
      process.exit(2)
    }
    return resolve(flag.value)
  }
  return process.cwd()
}

const isStagedArg = (argv) => argv.includes('--staged')

// ============================================================================
// 归属面(G-268,2026-09-27 立)—— 本门的结论必须说清"它判的是哪一面"
//
// 病灶不是判据太严,是**差值归因拿两个不可比的面互相对照**:safe-commit 的基线面是
// `git worktree add --detach` 出来的检出,**物理上没有未跟踪文件**;而本门按
// `readdirSync(ROOT)` 判,我的面上有别人留在根目录的在飞文件 ⇒ 基线绿 / 我的面红
// ⇒ 归因层正确地按差分判成"这枚提交把跑绿的东西改红了"。那个结论是**错的**,
// 而差分本身没错 —— 错在把"我的磁盘现场"当成了"我这枚提交的内容"。
// 实测代价:2026-09-27 10:36~12:08 的 92 分钟里 12 次因此拒绝跳门,而那些红
// 没有一个是我能合法修的(动别人的文件在本仓算事故),终态只能是脱账的手工提交。
//
// 所以 --staged 档改判**索引面**(= 本次提交真正携带的东西;safe-commit 第 1 步
// `git reset HEAD` 后按声明文件 add,故批内 索引 ≡ 声明集),未跟踪那一份**照判、照点名、
// 但退成 exit 2(无法判定)**:
//   · 它没有对本枚提交下结论 ⇒ 归因层不得据差分定责(见 lib/commit-gate-attribution.mjs 态①b);
//   · 它仍然非零 ⇒ §28 那句"交付前跑 `--staged`,0 违规才算完成"照样拦得住我自己漏在根的垃圾,
//     也拦得住 runner(runner 对 blocking 门按"非 0 即失败"处理)—— **没有放开任何一条检测**。
// 〔更正@2026-10-19,上面"批内 索引 ≡ 声明集"按当次实现作废,原句逐字保留只作改判留痕〕
// `git ls-files` 列的是**全部跟踪条目**,`git reset HEAD` 不会把它们移出索引(它只清"暂存"这一层),
// 所以"名字在索引里"从来不等于"我这枚提交带了它"。实测后果:一枚早在 HEAD 里的自动化状态目录
// (现读 `git ls-tree --name-only HEAD` 命中 `.doc-autoupdate`)使每次提交的 --staged 档稳定 exit 1
// ⇒ 全场被迫跳门、连带废掉整条守门链(§12e 的恒红门)。正解=差值棘轮,锚点取"提交开始前那棵 HEAD 树",
// 实现与三档归属见 getHeadRootNames() 与下方归属分流。
// 全量档(不带 --staged)一字未改:它今天就是报告档(exit 0),本门刻意不动它,
// 免得顺手"修好"成一个谁碰谁红的档。
// 〔更正@2026-10-27,上一条"全量档一字未改"按当次实现作废,原句逐字保留只作改判留痕〕:
// 全量档**退出码**仍是一字未改(报告档 exit 0,P5 钉着),但它的**措辞**必须改 —— 它此前
// 打印 `❌ 根目录整洁守门失败…` 却 exit 0,"报了什么"与"退出码说什么"在同一门体里相反。
// 本档判的是磁盘现场(不属本枚提交、也非 HEAD blob),按 §0.3 它无权下"失败"结论 ⇒
// 改成显式只报数措辞(不再出现 ❌ / 失败字样),红与未判定都在 --staged 档判。
// ============================================================================

/** 索引里出现过的根级条目名(含"目录下有已跟踪文件"的目录名)。git 问不到 ⇒ null */
function getIndexedRootNames(root) {
  try {
    // 2026-10-26 G-54:git 派生收口到 face-reader。老注释记的"刻意不 import face-reader"
    // 只针对当时"引二进制名而不引派生"的半接线档(守门 118);本票把派生本身收口,顾虑消解,
    // 绝对路径化欠账一并清掉。
    const out = gitRaw(['ls-files', '-z'], root)
    const names = new Set()
    for (const p of out.split('\0')) {
      if (!p) continue
      const first = p.split('/')[0]
      if (first) names.add(first)
    }
    return names
  } catch {
    // 区分"索引里真没有"与"问不到":返回 null,由调用方退回全量拦截。
    // 把它退成空集 = git 一坏,我自己漏在根的垃圾就全被归成"别人的"了 —— 失效方向必须收紧。
    return null
  }
}

/**
 * HEAD 树里出现过的根级条目名(= 提交链**开始前**就已入库的那些)。问不到 ⇒ null。
 *
 * 为什么必须有这一维(2026-10-19 立,根因不在白名单而在归属判据):上面那段注记写的
 * "批内 索引 ≡ 声明集"是**假前提**——safe-commit 第 1 步 `git reset HEAD` 只是将改动移出暂存区,
 * `git ls-files` 照旧列出**全部跟踪条目**。于是"名字在索引里"等价于"这仓跟踪过它",而不是
 * "我这枚提交带了它"。后果实测:一个早在 HEAD 里的自动化状态目录(`.doc-autoupdate/last-sha`,
 * 2026-10-19 现读 git ls-tree HEAD 命中)让**每一次**提交的 --staged 档都稳定 exit 1 ⇒
 * 每个会话都被迫走 --no-verify,连带废掉整条守门链 —— 正是 §12e 禁的恒红门。
 * 前几次的处置是逐枚把新目录加进白名单(`.arts`/`.DevEnv`/`.codeartsdoer`…),那是消症状不是修根:
 * 只要跟踪集合里还剩一枚白名单外条目,门就永久红。
 *
 * 正解取本仓通用差值棘轮口径:**锚点 = 被审提交开始前那棵 HEAD 树**。
 *  - 违规名 ∈ 索引 ∧ ∉ HEAD ⇒ 本次新入库 ⇒ owned ⇒ exit 1(阳性对照 P1 同形,牙不钝);
 *  - 违规名 ∈ 索引 ∧ ∈ HEAD ⇒ 存量 ⇒ 照点名、不判红(§12e"存量只报数");
 *  - 违规名 ∉ 索引 ⇒ 未跟踪 ⇒ 照旧 exit 2(归属无从判定);
 *  - 本函数返回 null(HEAD 问不到,如空仓/无提交)⇒ **不得**把存量算成零 ⇒ 退回旧的全量拦截。
 */
function getHeadRootNames(root) {
  try {
    // 2026-10-26 G-54:git 派生收口到 face-reader(§12g 的显式 stdio 接管由 gitRaw 内部保证)
    const out = gitRaw(['ls-tree', '--name-only', '-z', 'HEAD'], root)
    const names = new Set()
    for (const p of out.split('\0')) {
      if (!p) continue
      const first = p.split('/')[0]
      if (first) names.add(first)
    }
    return names
  } catch {
    return null
  }
}

// 逃生舱(应急跳过,默认不推荐,与 check-pwsh-version 等守门脚本一致)—— 判据在 main() 内取,
// 不得留在顶层:顶层执行一次 import 就跑(P22d 的"双形态"红线,镜像测试 import 判据时会当场退出)。
// ============================================================================
// 白名单(一级目录合法条目,封闭集合)
// ============================================================================

/** 根目录合法文件(配置 + 标准文档 + 项目强制文档) */
const ALLOWED_FILES = new Set([
  // 项目强制文档
  'AGENTS.md',
  // 机主强制指令(apps/web/src/hooks/use-agent-md-reference.ts 与
  // packages/shared/src/chat/workspace-context-loader.ts 按名读取)
  'agent.md',
  'PROJECT_PLAN.md',
  // /goal 模式运行时文件(AGENTS.md §1 唯一例外条款:goal-runtime 状态与运行日志)
  'STATE.md',
  'loop-run-log.md',
  // 2026-10-15 显式审批:GAP-PLAN 远超对标路线图(/goal 激活的权威收敛文档,随执行迭代更新)
  'GAP-PLAN.md',
  // 开源标准文档(GitHub 官方识别)
  'README.md',
  'README.en.md',
  'README.ja.md',
  'README.ko.md',
  'LICENSE',
  // 2026-09-06 显式审批:Apache-2.0 标准伴生文档(引用版权所有者、须随再分发保留)
  'NOTICE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  // 构建 / 工具配置
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'eslint.config.mjs',
  'tsconfig.base.json',
  'knip.jsonc',
  // 2026-09-11 补登记:Knip 棘轮基线(4849fd076e4 已入库跟踪的 CI 配套产物)
  'knip-baseline.json',
  // 部署配置
  'docker-compose.yml',
  'railway.json',
  'render.yaml',
  'app.json',
  // 守门脚本产物
  '__gate_result.txt',
  // 既有跟踪脚本(chat 消息 key 校验,git 跟踪保证合法)
  'check-chat-keys.js',
  // 2026-09-04 显式审批:本地一键启动脚本(origin/main afc3255ebd 已入库跟踪)
  'start-all.bat',
  // 2026-09-04 显式审批:tag 分批同步运维工具(根治 push --tags 假死)
  'sync-tags.mjs',
  // 2026-09-04 显式审批:悬空 commit 备份运维工具(幂等)
  'backup-unreachable-commits.mjs',
  // 测试临时产物(Pytest quick fail 日志,后台进程持有)
  'tmp-qfr-err.log',
  'tmp-qfr-out.log',
])

/** 根目录合法目录(monorepo 标准结构 + 运行时目录) */
const ALLOWED_DIRS = new Set([
  'apps',
  'packages',
  'scripts',
  'docs',
  'deploy',
  'monitoring',
  // 2026-09-24 显式审批:架构策略声明表 config/architecture-policy.yaml(守门 103
  // check-architecture-policy.mjs 的唯一输入)。它是**被代码读取的配置**,不是临时产物,
  // 与 docs/ 的区别在于有判据依赖它 —— 挪进 docs/ 会让那道门的表路径与 AGENTS 的写法一起腐掉。
  'config',
  'reports',
  'sdks',
  // 2026-09-03 显式审批:评测基准套件(run.mjs/gen.mjs/tasks/reports),长期存在的合法一级目录
  'benchmarks',
  'cert',
  'products',
  'logs',
  // 2026-09-05 显式审批:交付物目录(双端一致性验收报告 M5 / mobile-rn release APK 等),长期合法
  'outputs',
  'node_modules',
  'tmp',
  'test-results',
  // 2026-09-08 显式审批:git worktree 注册目录(并行会话工作树基础设施,git worktree list 可见)
  'worktrees',
  // 2026-09-08 显式审批:团队记忆功能并行会话工作树(含未合并 WIP,暂留)
  'wt-teammem',
  // 2026-09-08 显式审批:用户产物目录(智汇AI 天使轮商业计划书等演示文稿)
  'output',
  // 2026-09-10 显式审批:wt-push 推送工具目录(批量推送运维工具)
  'wt-push',
])

/** 合法隐藏文件(.env / .gitignore 等) */
const ALLOWED_HIDDEN_FILES = new Set([
  '.actrc',
  // 2026-09-08 显式审批:EAS Build 上传排除规则(pnpm monorepo 云端构建必需,存在时 EAS 不再参考 .gitignore)
  '.easignore',
  '.check-api-routes-ignore.json',
  '.dockerignore',
  '.editorconfig',
  // 2026-09-04 显式审批:git commit -F 消息临时文件(PowerShell 无 heredoc,
  // 中文多行消息只能走文件;commit 完成后立即删除,不入库)
  '.git-commit-msg-tmp.txt',
  // 2026-09-10 立:.git 异常恢复时可能呈现为 gitdir 指针文件(非目录),白名单兼容
  '.git',
  '.env.act',
  '.env.example',
  '.env.production.example',
  // 2026-10-04 补登记:根级 `.env` 是本仓**受管的生产配置**(api 读它、护栏
  // `_sync_env_file_to_os()` 按它同步,本仓 100+ 道门与全部自愈链都靠它取凭据),
  // 长期存在且**必须**存在于根级 —— 但它此前只登记了 .env.example / .env.act / .env.production
  // 这一族,`.env` 本体漏在白名单外 ⇒ 守门 44 恒红 ⇒ 各会话被迫 --no-verify
  // (连带跳过全部 100+ 道门)。这正是 §12e「与提交无关的恒红门」那一族。
  // 登记它**不等于**放松别处:.env 仍被 .gitignore 覆盖、不入库;这里只放行"根级存在"这一形态。
  '.env',
  '.gitattributes',
  '.gitignore',
  '.npmrc',
  '.prettierignore',
  '.prettierrc',
  '.secrets.act.example',
])

/** 合法隐藏目录(git / IDE / 工具 / 运行时锁) */
const ALLOWED_HIDDEN_DIRS = new Set([
  '.git',
  '.github',
  '.husky',
  '.ihui',
  '.pnpm-store',
  '.qoder',
  '.ihui-agent',
  '.ihui-agent',
  '.html-share-packages',
  '.turbo',
  '.vscode',
  '.workbuddy',
  '.kc-tools', // 2026-09-19:并行会话 KC 工具脚本目录(根目录整洁守门白名单)
  // 2026-09-23 登记:第三方 IDE(CodeArts Doer)自管家目录的**运行态**——`.codeartsdoer/.codebase`
  // 是其代码索引、`.arts/settings.json` 是其设置,均被工具在会话中持续写入(实测今日仍在写)。
  // 与 `.vscode`/`.qoder`/`.workbuddy` 同类:只登记、不搬不删(删了会打断他人正在用的工具且索引需重建)。
  // 本条同时解除"守门 44 在 --staged 下恒红 ⇒ 各会话被迫 --no-verify 连带跳过全部守门"的系统性风险。
  '.arts',
  '.codeartsdoer',
  // 2026-10-21 登记:外部 spec 工作流在仓库根自管的会话目录(spec.md/tasks.md,实测 19:07 被重建、
  // 19:10 仍在写)。当天曾把它移进 .ihui-agent/tmp 隔离区,几分钟后工具又原地重建 ⇒ 搬/删都无效,
  // 与 `.arts`/`.codeartsdoer` 同类:只登记、不搬不删。本条解除守门 44 在 --staged 下点名该目录
  // ⇒ 各会话被迫 --no-verify 的系统性风险(§12e 同型)。
  '.spec-mode',
  // 2026-10-23 登记:qoder-chat-bridge(scripts/qoder-chat-bridge.mjs,并行会话在飞)的
  // 运行态目录(`.runtime/qoder-bridge-cwd`,实测今日 17:52 创建、桥在会话中持续写 cwd
  // 状态)。与 `.arts`/`.codeartsdoer`/`.spec-mode` 同类:只登记、不搬不删。它此前以
  // "未跟踪根条目"形态让守门 44 在 --staged 下 exit 2(归属无从判定)⇒ 批量按 blocking 计
  // ⇒ 每枚提交都被逼走应急旁路(连带跳过全部守门)—— §12e 恒红门同型,登记即解除。
  '.runtime',
  // 2026-10-24 登记:Loomy 会话附件目录(用户上传的附件/图片落 `<workspace>/.loomy-attachments/ses_*/`,
  // 跨会话长期驻留,后续上传仍会在根重建同名目录 ⇒ 搬/删无效,与 `.spec-mode`/`.runtime`/
  // `.codeartsdoer` 同类:只登记、不搬不删)。解除 §12e 同型恒红:本条缺失时守门 44 在 --staged 面
  // 对"未跟踪、非忽略"的它报"无法判定"(exit 2),safe-commit 归因算法证明不了差分 ⇒ 每枚提交都被
  // 逼走应急旁路 —— 2026-10-24 实测:提交 f2962f1ef91a 即由此走 `--no-verify` 留痕(undetermined-red)。
  '.loomy-attachments',
  // 2026-10-26 登记:并行会话截图产物目录(根级 `.screenshots/`,内含 `.tmp` 子目录,实测当日 15:28 仍在被写,
  // 物主为并行会话工具链,归属并行会话产物)。它以"未跟踪、非忽略"形态让守门 44 在 --staged 面报
  // "无法判定"(exit 2)⇒ 批量按 blocking 计 ⇒ 提交被阻(2026-10-26 实测:RAG 父子块提交链即由此受阻)。
  // 与 `.runtime`/`.loomy-attachments`/`.spec-mode` 同类:只登记、不搬不删(搬/删会打断在飞会话)。
  '.screenshots',
  // 2026-10-12 登记:IDE 工具态家目录(backups/cache/tools/Temp,实测 16GB,2026-09-30 起在盘)。
  // 与 `.vscode`/`.qoder`/`.workbuddy` 同类:只登记、不搬不删(删了会打断他人正在用的工具态)。
  // 本条同时解除守门 44 在 --staged 下点名该目录 ⇒ 提交链被迫 --no-verify 的系统性风险(§12e 同型)。
  '.DevEnv',
  // 2026-10-19 登记:文档自动更新器的运行态目录(现读 `git ls-tree --name-only HEAD` 命中,
  // 目录内只有 `last-sha` 一枚已入库文件,由自动化持续写入)。与 `.workbuddy`/`.turbo` 同类:
  // 只登记、不搬不删(删了就打断它自己的增量判定,下一轮又会重新生成)。
  // 同上一条注释所写的另一类风险也要一并记清:真正让本门恒红的不是"这个目录没进白名单",
  // 而是归属判据把"全部跟踪条目"当成"本次携带"——那一格已在 getHeadRootNames() 修掉;
  // 这里登记只是把**合法运行态**从存量告警里摘出来,不再每次刷屏。
  '.doc-autoupdate',
  '.deploy.lock',
  // 2026-10-19 登记:README 提交钩子 scripts/auto-update-readme-recent.mjs 的增量基线目录
  // (.doc-autoupdate/last-sha = 上次处理到的 commit,被 git 跟踪、随提交刷新)。与 .env/.DevEnv
  // 同类:合法工具态,只登记"根级存在"形态、不放松任何检测;漏收会使本门 --staged 恒红 ⇒
  // 各会话被迫 --no-verify 连带跳过全部守门(§12e 恒红门同型)。
  '.doc-autoupdate',
  // 2026-08-19 立:React Native C++ native 模块编译 staging 产物
  // (expo-modules-core / react-native-reanimated / react-native-screens 构建自动生成,
  //  已被 .gitignore 忽略,不参与 git 跟踪。不加入会在每次 C++ 构建后阻塞 commit)
  '.cxx-modules-staging',
  '.cxx-worklets-staging',
  // 2026-09-10 显式审批:Trae 编辑器工作目录(TraeCode 本地缓存与 IDE 运行时数据)
  '.trae',
  '.trae-cn',
  '.trae-html-share-packages',
  // 2026-09-10 显式审批:.kc-backup 提交备份目录
  '.kc-backup',
])

// ============================================================================
// 精确豁免(2026-09-03)
//
// 背景:守门原只按白名单硬匹配,导致两类「合法且必然存在」的一级条目被误报,
//       使所有人 commit 被无谓阻塞(曾连撞 .next + .wt6):
//   ① .next —— 已在 .gitignore 且 git 未跟踪的构建产物(跑过 next dev/build 必有);
//   ② .wt6  —— git worktree 目录,而 AGENTS.md §12d 明确鼓励用 worktree 做多会话隔离,
//              守门把它当垃圾目录与项目规范自相矛盾。
// 判定一律走 git 官方机制(check-ignore / worktree list),不靠名字猜测:
//   仍被拦截的是「未忽略、非 worktree 的白名单外条目」,即真正的随手垃圾。
// ============================================================================

/** git 已忽略的一级条目(.gitignore 覆盖 → 不参与跟踪,不该阻塞 commit) */
function getIgnoredEntries(names, root) {
  try {
    // 2026-10-26 G-54:git 派生收口到 face-reader(gitRaw 带 opts.input 时 stdio[0] 自动为 'pipe',
    // 喂入语义与原调用一致;无匹配 exit 1 经 err.status 抛 Undetermined,由下方 catch 兜住)
    const out = gitRaw(['check-ignore', '--stdin', '-z'], root, { input: names.join('\0') })
    return new Set(out.split('\0').filter(Boolean))
  } catch {
    // check-ignore 无匹配时 exit 1;git 不可用同理 → 空集合(维持原拦截行为)
    return new Set()
  }
}

/** git worktree 注册目录(仅取一级子目录,主 worktree 自身不计) */
function getWorktreeDirNames(root) {
  try {
    // 2026-10-26 G-54:git 派生收口到 face-reader(原 stderr 为 ignore,gitRaw 改捕获进异常对象,
    // 成功路径 stderr 本就为空,失败路径由下方 catch 吞掉 ⇒ 对外输出不变)
    const out = gitRaw(['worktree', 'list', '--porcelain'], root)
    const rootPosix = root.split('\\').join('/')
    const names = new Set()
    for (const line of out.split('\n')) {
      if (!line.startsWith('worktree ')) continue
      const p = line.slice('worktree '.length).trim().split('\\').join('/')
      if (p === rootPosix) continue // 主 worktree 自身
      if (!p.startsWith(rootPosix + '/')) continue // 仓库外的 worktree,不在一级目录范围
      const rel = p.slice(rootPosix.length + 1)
      if (rel && !rel.includes('/')) names.add(rel)
    }
    return names
  } catch {
    return new Set()
  }
}

// ============================================================================
// 扫描(判据住在 collectViolations,顶层不执行 —— §22d 双形态入口)
// ============================================================================

/**
 * 根级"临时产物"形态判据(仅用于告警,见下方收集处的说明)。
 * 形态取自 AGENTS.md §28 规则 2 的书面禁令:禁止在一级目录生成 .log / .html / cookies /
 * 截图 / ad-hoc 脚本。只判文件,不判目录(tmp/ logs/ 等是合法一级目录)。
 */
const ROOT_JUNK_PATTERNS = [
  /\.(log|tmp|bak|old|error)$/i,
  /\.html?$/i,
  /^cookies/i,
  /^verify-.*\.[cm]?js$/i,
  /^probe[-_].*\./i,
  /^search_.*\./i,
  /\.(png|jpe?g|webp|gif)$/i,
]

function isRootJunkArtifact(name) {
  // 白名单内的条目属已显式审批(如 tmp-qfr-err.log = 后台 pytest 持有),不重复告警
  if (ALLOWED_FILES.has(name) || ALLOWED_HIDDEN_FILES.has(name)) return false
  return ROOT_JUNK_PATTERNS.some((re) => re.test(name))
}

/**
 * 一级目录扫描(纯 IO + 白名单匹配,不做归属判定)。
 * `readdirSync` 抛错**不在此吞**:那是"取不到被审面",由 main() 显式落 exit 2 未判定,
 * 绝不回落另一个面(§0.4),也绝不枚举成 0 个候选后自称干净(§0.3)。
 */
function collectViolations(root) {
  const entries = readdirSync(root)
  const ignoredEntries = getIgnoredEntries(entries, root)
  const worktreeDirs = getWorktreeDirNames(root)

  const violations = []
  /** 被 git 忽略、但形态属 §28 禁令的根级临时产物(只告警) */
  const ignoredJunk = []

  for (const name of entries) {
    const isHidden = name.startsWith('.')
    const isDir = statSync(join(root, name)).isDirectory()

    // 精确豁免:git 已忽略的产物 / git worktree 注册目录(见上「精确豁免」注释)
    if (ignoredEntries.has(name) || worktreeDirs.has(name)) {
      // §28 规则 2 的禁令对**被 git 忽略**的根级产物零覆盖(上面直接 continue)。实测
      // 2026-09-22 一次性翻出 14 个此类残留(_knip.log / .tmp-tsc.log / build-oidc.log /
      // _i18n2.log …),守门恒绿、git status 也看不见,正是"静默累积"的那一类。
      // 刻意只告警不阻塞:忽略产物常被后台进程/构建持有,阻塞会误伤并行会话。
      if (!isDir && isRootJunkArtifact(name)) ignoredJunk.push(name)
      continue
    }

    if (isHidden) {
      if (isDir) {
        if (!ALLOWED_HIDDEN_DIRS.has(name)) violations.push({ name, kind: '隐藏目录' })
      } else if (
        !ALLOWED_HIDDEN_FILES.has(name) &&
        // 2026-09-14 显式豁免:workbuddy「发布为应用」(genie-baas)插件在项目根写入的
        // 应用配置标记,后缀为随机串(如 .wbapp_pXZ3aJucQJpY00VrF24uYs.genie),
        // 由插件生成与消费,不入库;并行会话发布期间合法存在。
        !/^\.wbapp_[A-Za-z0-9]+\.genie$/.test(name)
      ) {
        violations.push({ name, kind: '隐藏文件' })
      }
    } else if (isDir) {
      if (!ALLOWED_DIRS.has(name)) violations.push({ name, kind: '目录' })
    } else if (!ALLOWED_FILES.has(name)) {
      violations.push({ name, kind: '文件' })
    }
  }

  return { violations, ignoredJunk }
}

// ============================================================================
// 归属分流(判据单源:--staged 档的三档与全量档的两档都由下面的纯函数算)
// ============================================================================

/**
 * 把违规按"哪一面认得它"分档。**不碰 git**(面由调用方取好传进来),所以镜像测试能直接
 * import 它构造正反对照(§22c:判据只许一份,测试不许复制)。
 *
 * 三档归属(只在 --staged 档有意义):
 *  · owned       = 索引有 ∧ HEAD 无 ⇒ 本次才入库 ⇒ 判红(exit 1)
 *  · preexisting = 索引有 ∧ HEAD 有 ⇒ 存量 ⇒ 照点名、只报数(§12e)
 *  · untracked   = 索引无 ⇒ 不属任何提交、也不在 HEAD ⇒ **未判定**(exit 2,§0.3)
 *
 * `indexed.size === 0` 与 `indexed === null` **同档**(2026-10-27 补):空仓 / 坏 gitfile 边界
 * 会让 `git ls-files` 成功返回**空集**,而"索引里一条都没有"从来证明不了"这里没有我该拦的东西"
 * —— 按 §0.3「枚举到 0 个候选判死不记绿」,这一面不可信时退回全量拦截(失效方向=多要一次
 * 定向说明,绝不是多放一次跳门)。G-286 将 scratch 迁进 `.DevEnv` 后加了坏 gitfile 边界,
 * 夹具现场正是"ls-files 空成功 ∧ ls-tree 抛",旧 P4 因此从 exit 1 漂成 exit 2(现读实测)。
 */
function partitionByFace(violations, indexed, headNames) {
  if (indexed === null || indexed.size === 0) {
    return {
      owned: violations,
      preexisting: [],
      untracked: [],
      why:
        indexed === null
          ? '  ⚠️  索引面问不到(git ls-files 失败)⇒ 无从区分归属,本门**退回全量拦截**:所有违规一律按本次的红计'
          : '  ⚠️  索引面枚举到 0 条(空仓 / 坏 gitfile 边界 ⇒ 问到了但一份条目都没有)⇒ 这一面证明不了归属,' +
            '本门**退回全量拦截**:所有违规一律按本次的红计(§0.3 枚举到 0 不读成"这里没有我要拦的东西")',
    }
  }
  if (headNames === null) {
    return {
      owned: violations.filter((v) => indexed.has(v.name)),
      preexisting: [],
      untracked: violations.filter((v) => !indexed.has(v.name)),
      why: '  ⚠️  HEAD 树问不到(git ls-tree 失败或尚无提交)⇒ 无从证明哪几枚是存量,本门**退回全量拦截**:所有已跟踪违规一律按本次的红计',
    }
  }
  // 差值棘轮:只有"本次新入库"的那几枚算本次的红;早在 HEAD 里的照点名不判红(§12e)
  return {
    owned: violations.filter((v) => indexed.has(v.name) && !headNames.has(v.name)),
    preexisting: violations.filter((v) => indexed.has(v.name) && headNames.has(v.name)),
    untracked: violations.filter((v) => !indexed.has(v.name)),
    why: null,
  }
}

/**
 * 三档 ⇒ **结论档名 + 退出码**的唯一映射。两档同时在场时红优先,但档位名必须是
 * `red+undetermined`(不是将"未判定"折进红里,也不是将红折进未判定里)——
 * 归因层与席面都靠这一行分辨"到底有几种结论",折叠就是本次要修的病灶。
 */
function decideOutcome({ owned, untracked, preexisting }) {
  const hasRed = owned.length > 0
  const hasUndetermined = untracked.length > 0
  if (hasRed && hasUndetermined)
    return { name: 'red+undetermined', code: 1, note: '红优先取 exit 1;两档分别报数,**未折叠**' }
  if (hasRed) return { name: 'red', code: 1, note: '本次新入库的根级违规 ⇒ 判红' }
  if (hasUndetermined)
    return { name: 'undetermined', code: 2, note: '未判定(§0.3):既不记绿也不冒红,仍非零' }
  if (preexisting.length > 0)
    return { name: 'stock-only', code: 0, note: '只剩早在 HEAD 里的存量 ⇒ 只报数不判红(§12e)' }
  return { name: 'clean', code: 0, note: '一级目录无白名单外条目' }
}

/** 点名简报(逐枚名字;空档写「无」,不得留空 —— 留空读起来像"漏了一档") */
function briefNames(list) {
  return list && list.length > 0 ? list.map((v) => v.name).join(' , ') : '无'
}

/**
 * 末行结论(机读 + 人读共用一行)。三档**各自报数并点名**,一档也不折叠;
 * 归因层读这一行就能知道"本门究竟下的是哪种结论"。
 */
function resultLine(outcome, { owned, untracked, preexisting }) {
  const mark = outcome.code === 2 ? ` ${GATE_UNDETERMINED_MARK}` : ''
  return (
    `  结论[${outcome.name}] exit=${outcome.code}${mark} ` +
    `本次新入库红=${owned.length}(点名:${briefNames(owned)}) ` +
    `未判定=${untracked.length}(点名:${briefNames(untracked)}) ` +
    `存量只报数=${preexisting.length}(点名:${briefNames(preexisting)}) —— ${outcome.note}`
  )
}

/**
 * 全量档(不带 --staged)的两档分档:本档判的是**磁盘现场**,它既不是本枚提交的内容面、
 * 也不是 HEAD blob ⇒ 按 §0.3 无权下"失败"结论,只报数。
 */
function partitionForReport(violations, headNames) {
  if (headNames === null)
    return {
      inHead: [],
      offHead: violations,
      why: '  ℹ️  HEAD 面问不到(git ls-tree 失败或尚无提交)⇒ 无法区分已入库/未入库,全部按现场只报数',
    }
  return {
    inHead: violations.filter((v) => headNames.has(v.name)),
    offHead: violations.filter((v) => !headNames.has(v.name)),
    why: null,
  }
}

/** 全量档末行:**不出现 ❌ / 失败字样**(那是 exit 1 专属措辞),也不出现"未判定 ⇒ 非零"的档名 */
function reportResultLine({ inHead, offHead }) {
  return (
    `  结论[report-only] exit=0 ` +
    `已入库存量=${inHead.length}(点名:${briefNames(inHead)}) ` +
    `未入库现场=${offHead.length}(点名:${briefNames(offHead)}) —— ` +
    '本档判磁盘现场,**不判红也不判绿**;提交链的红与归属未定项由 `--staged` 档判(exit 1 / exit 2)'
  )
}

// ============================================================================
// 执行(顶层不执行任何判定:§22d 双形态入口,守卫在文件末尾)
// ============================================================================

function emitJunkWarning(ignoredJunk) {
  if (ignoredJunk.length === 0) return
  console.log('')
  console.log(
    `  ⚠️  根目录整洁守门[告警]:${ignoredJunk.length} 个被 git 忽略的根级临时产物(§28 规则 2 禁令对象,不计失败)`,
  )
  for (const n of ignoredJunk) console.log(`     - ${n}`)
  console.log('     处置:删除,或移入 tmp/ 与 logs/(一级目录只留白名单条目)')
}

function emitRemedyHint() {
  console.error('')
  console.error('  💡 处置(二选一):')
  console.error('     1. 临时/垃圾产物 → 删除,或移入 tmp/ 或 logs/')
  console.error(
    '     2. 合法新增(新配置/新文档/新目录) → 加入 scripts/check-root-dir-clean.mjs 白名单后重新 commit',
  )
  console.error('')
  console.error('  禁止在一级目录随意生成 .log / .html / cookies / 截图 / ad-hoc 脚本。')
}

/**
 * 判据自证(2026-10-27 立,票"门 44 输出与退出码三态化"·任务 C)。
 * 全部走**导出的纯函数**(partitionByFace / decideOutcome / resultLine / partitionForReport /
 * reportResultLine)—— 与 main() 同一把尺子,不复制第二份判据(§22c/§0.6),零 git、零磁盘写入。
 * 夹具四例(票面口径)+ 存量/面失效/报告档三例 + 归因层形状锁:
 *   S1 只红 ⇒ exit 1;S2 只未判定 ⇒ exit 2;S3 同在 ⇒ exit 1 且两档**分别点名不折叠**;
 *   S4 两面同形(净根目录)⇒ exit 0 不红;S5 只剩存量 ⇒ exit 0 只报数(§12e);
 *   S6 面问不到 ⇒ 提交链档退回全量拦截(失效方向=多要一次定向说明,绝不放开检测);
 *   S7 现场报告档 ⇒ 只报数、不出现 ❌/失败(exit 0 专属措辞,报什么与退出码不得相反);
 *   S8 形状锁 ⇒ 归因层必须存在「未判定 ⇒ 点名门 id」分支,并带反向对照(摘掉调用即翻红)。
 * 失效方向:任何一条不过 ⇒ 非零退出并逐条点名(§0.3);自检取不到归因层源码同样不记绿。
 */
function selfTest() {
  let pass = 0
  let fail = 0
  const assert = (cond, msg) => {
    if (cond) pass++
    else {
      fail++
      console.error(`  ❌ 根目录整洁守门自检失败:${msg}`)
    }
  }
  const V = (name, kind = '文件') => ({ name, kind })
  const HEAD = new Set(['README.md'])

  // ── S1 只红(索引有 ∧ HEAD 无 = 本次新入库)⇒ exit 1 ──
  const s1 = partitionByFace([V('stray.ps1')], new Set(['README.md', 'stray.ps1']), HEAD)
  const o1 = decideOutcome(s1)
  assert(
    o1.code === 1 && o1.name === 'red',
    `S1 只红必须 exit 1/name=red,实得 ${o1.code}/${o1.name}`,
  )
  const l1 = resultLine(o1, s1)
  assert(
    l1.includes('stray.ps1') && !l1.includes(GATE_UNDETERMINED_MARK),
    `S1 结论行要点名红、不得挂未判定键(红不冒充未判定),实得:${l1}`,
  )

  // ── S2 只未判定(索引无 ⇒ 归属无从判定,§0.3)⇒ exit 2 ──
  const s2 = partitionByFace([V('.uploads', '隐藏目录')], new Set(['README.md']), HEAD)
  const o2 = decideOutcome(s2)
  assert(
    o2.code === 2 && o2.name === 'undetermined',
    `S2 只未判定必须 exit 2(非零仍拦得住),实得 ${o2.code}/${o2.name}`,
  )
  const l2 = resultLine(o2, s2)
  assert(
    l2.includes(GATE_UNDETERMINED_MARK) && l2.includes('.uploads'),
    `S2 结论行必须带自述键并点名未跟踪条目,实得:${l2}`,
  )

  // ── S3 红 ∧ 未判定同在 ⇒ 红优先 exit 1,两档**分别报数并点名**(折叠=本票病灶)──
  const s3 = partitionByFace(
    [V('stray.ps1'), V('.uploads', '隐藏目录')],
    new Set(['README.md', 'stray.ps1']),
    HEAD,
  )
  const o3 = decideOutcome(s3)
  assert(
    o3.code === 1 && o3.name === 'red+undetermined',
    `S3 同在必须红优先且档名两栏齐,实得 ${o3.code}/${o3.name}`,
  )
  const l3 = resultLine(o3, s3)
  assert(
    /本次新入库红=1\(点名:stray\.ps1\)/.test(l3) && /未判定=1\(点名:\.uploads\)/.test(l3),
    `S3 末行必须两档分别报数并点名,实得:${l3}`,
  )

  // ── S4 两面同形(净根目录)⇒ exit 0 不红 ──
  const s4 = partitionByFace([], new Set(['README.md']), HEAD)
  const o4 = decideOutcome(s4)
  assert(o4.code === 0 && o4.name === 'clean', `S4 净面必须 exit 0,实得 ${o4.code}/${o4.name}`)

  // ── S5 只剩存量(HEAD 锚点内)⇒ exit 0、照点名只报数(§12e 恒红门禁令)──
  const s5 = partitionByFace(
    [V('.stray-state', '隐藏目录')],
    new Set(['README.md', '.stray-state']),
    new Set(['README.md', '.stray-state']),
  )
  const o5 = decideOutcome(s5)
  assert(
    o5.code === 0 && o5.name === 'stock-only',
    `S5 存量不得判红(与本次提交内容无关的红=逼人跳门),实得 ${o5.code}/${o5.name}`,
  )
  assert(resultLine(o5, s5).includes('.stray-state'), 'S5 存量也要点名(找得到物主才有出路)')

  // ── S6 索引面问不到 ⇒ 退回全量拦截(与镜像测试 P4 同形;失效方向=多要一次定向说明)──
  const s6 = partitionByFace([V('a.ps1')], null, null)
  assert(
    s6.owned.length === 1 && /退回全量拦截/.test(String(s6.why)) && decideOutcome(s6).code === 1,
    'S6 索引面问不到必须退回全量拦截,不得放绿',
  )
  const s6b = partitionByFace([V('a.ps1')], new Set(), HEAD)
  assert(
    /枚举到 0 条/.test(String(s6b.why)) && decideOutcome(s6b).code === 1,
    'S6b 索引枚举到 0 条与"问不到"同档(§0.3 枚举到 0 不读成"这里没有")',
  )

  // ── S7 现场报告档 ⇒ 只报数,不出现 ❌/失败(exit 0 档不得说失败话)──
  const r7 = partitionForReport(
    [V('stray.ps1'), V('.doc-autoupdate', '隐藏目录')],
    new Set(['README.md', '.doc-autoupdate']),
  )
  const line7 = reportResultLine(r7)
  assert(r7.inHead.length === 1 && r7.offHead.length === 1, 'S7 报告档须分已入库/未入库两栏报数')
  assert(
    !/❌/.test(line7) && !/失败/.test(line7),
    `S7 报告档结论行不得出现 ❌/失败字样(本票缺陷①的形态),实得:${line7}`,
  )
  assert(line7.includes('stray.ps1') && line7.includes('.doc-autoupdate'), 'S7 两栏都要逐条点名')
  const r7b = partitionForReport([V('a.ps1')], null)
  assert(
    r7b.offHead.length === 1 && /HEAD 面问不到/.test(String(r7b.why)),
    'S7b HEAD 面问不到⇒全部按现场只报数,不得冒充已入库对照',
  )

  // ── S8 形状锁:归因层必须存在「未判定 ⇒ 点名门 id」分支(反向对照防锁空转)──
  try {
    const libPath = join(
      dirname(fileURLToPath(import.meta.url)),
      'lib',
      'commit-gate-attribution.mjs',
    )
    const libSrc = maskComments(readFileSync(libPath, 'utf8'))
    const bodyStart = libSrc.indexOf('export function classifyHookFailure')
    const bodyEnd = libSrc.indexOf('export function verdictLine')
    const body = bodyStart >= 0 && bodyEnd > bodyStart ? libSrc.slice(bodyStart, bodyEnd) : ''
    const lockOk = (src) =>
      src.includes('parseUndeterminedGates(') &&
      /undeterminedGates:\s*undet/.test(src) &&
      /\[\$\{g\.id\}\]/.test(src) &&
      /kind:\s*'undetermined-red'/.test(src)
    assert(
      bodyStart >= 0 && bodyEnd > bodyStart,
      'S8 取不到归因层 classifyHookFailure 段(锚点漂移)',
    )
    assert(
      lockOk(body),
      'S8 归因层缺「未判定 ⇒ 点名门 id」分支:门交付 exit 2 时若无门级点名,应急档就成了无人可问责的默认出口',
    )
    assert(
      !lockOk(body.replace(/parseUndeterminedGates\(/g, 'void(')),
      'S8 反向对照失效:摘掉 parseUndeterminedGates 调用后锁仍为真 ⇒ 这条锁是空转',
    )
  } catch (e) {
    fail++
    console.error(`  ❌ 根目录整洁守门自检 S8 取不到归因层源码(未判定不记绿):${e?.message ?? e}`)
  }

  console.log(`  ${fail === 0 ? '✅' : '❌'} 根目录整洁守门自检:pass ${pass}/fail ${fail}`)
  return fail === 0 ? 0 : 1
}

function main(argv) {
  // 判据自证必须排在逃生舱**之前**:逃生舱跳过的是"对仓库的判定",而自检验证的是"判定本身"
  // —— 若开关先退 0,`--self-test` 就成了可以被人一键关掉的装饰(§0.9 判据必须在真跑它的一刻才成立)。
  if (argv.includes('--self-test')) process.exit(selfTest())

  // 逃生舱(应急跳过,默认不推荐,与 check-pwsh-version 等守门脚本一致)
  if (process.env.HUSKY_SKIP_ROOT_DIR_GUARD === '1') {
    console.log('  ⏭  根目录整洁守门(HUSKY_SKIP_ROOT_DIR_GUARD=1, 跳过)')
    process.exit(0)
  }

  const ROOT = resolveRoot(argv)
  const isStaged = isStagedArg(argv)

  let collected = null
  try {
    collected = { root: ROOT, ...collectViolations(ROOT) }
  } catch (e) {
    // 取不到被审面(一级目录读不出)⇒ 显式未判定,不回落另一个面、不枚举成 0 后自称干净(§0.3/§0.4)
    console.error(`⚠️ 根目录整洁守门[无法判定]:一级目录读不到(${ROOT}) —— ${e?.message ?? e}`)
    console.error(
      `  结论[undetermined] exit=2 ${GATE_UNDETERMINED_MARK} —— 取不到被审面,既不记绿也不冒红(§0.3)`,
    )
    process.exit(2)
  }

  const { violations, ignoredJunk } = collected
  emitJunkWarning(ignoredJunk)

  if (violations.length === 0) {
    console.log('  ✅ 根目录整洁守门通过:一级目录无白名单外条目')
    console.log('  结论[clean] exit=0 一级目录无白名单外条目')
    process.exit(0)
  }

  // ── 全量档(报告档):只报数,不打 ❌、不判红也不记绿 ──
  if (!isStaged) {
    const rep = partitionForReport(violations, getHeadRootNames(ROOT))
    if (rep.why) console.error(rep.why)
    if (rep.inHead.length > 0) {
      console.log('')
      console.log(
        `  ⚠️  根目录整洁守门[已入库存量·只报数]:${rep.inHead.length} 枚白名单外条目**在 HEAD 面上**` +
          `(§28 的出路=按显式审批登记白名单,或移进 tmp/ 与 logs/)`,
      )
      for (const v of rep.inHead) console.log(`     - ${v.name}  (${v.kind},已在 HEAD)`)
    }
    if (rep.offHead.length > 0) {
      console.log('')
      console.log(
        `  ⚠️  根目录整洁守门[未入库现场·只报数]:${rep.offHead.length} 枚白名单外条目**不在 HEAD 面上**` +
          `(在飞 / 未跟踪 / 已暂存待入库皆有可能 —— 本档不查索引面,所以不下"哪一种"的结论;` +
          `要红请跑 --staged)`,
      )
      for (const v of rep.offHead) console.log(`     - ${v.name}  (${v.kind},不在 HEAD)`)
    }
    emitRemedyHint()
    console.error(reportResultLine(rep))
    process.exit(0)
  }

  // ── 提交链档:三档归属 + 三档退出码 ──
  const indexed = getIndexedRootNames(ROOT)
  const headNames = indexed === null ? null : getHeadRootNames(ROOT)
  const part = partitionByFace(violations, indexed, headNames)
  const { owned, preexisting, untracked } = part
  if (part.why) console.error(part.why)

  if (preexisting.length > 0) {
    console.log('')
    console.log(
      `  ⚠️  根目录整洁守门[存量]:${preexisting.length} 枚白名单外条目**早在 HEAD 里** ⇒ 与本次提交内容无关,只报数不判红(§12e;出路=按 §28 显式登记白名单或移进 tmp/ 与 logs/)`,
    )
    for (const v of preexisting) console.log(`     - ${v.name}  (${v.kind},已在 HEAD)`)
  }

  if (owned.length > 0) {
    console.error('❌ 根目录整洁守门失败:一级目录存在白名单外条目')
    for (const v of owned) {
      console.error(`   - ${v.name}  (${v.kind})`)
    }
  }
  if (untracked.length > 0) {
    // 未跟踪:它不在任何提交里,既不是"我这枚提交带的",也不属于 HEAD —— 归属无从判定。
    // 照点名(让人能去找物主)、照非零(§28 的交付判据与 runner 都仍拦得住),但判 exit 2,
    // 使归因层不得把它写成"这枚提交引入了红"。
    console.error(
      '⚠️ 根目录整洁守门[无法判定]:存在白名单外条目,但它们**未被 git 跟踪**,归属无从判定',
    )
    for (const v of untracked) {
      console.error(`   - ${v.name}  (${v.kind},未跟踪 → 不属任何提交)`)
    }
    console.error(
      '     处置:这些文件不在本次提交内容里,也不在 HEAD 里 ⇒ 不得据此判定本枚提交引入红',
    )
    console.error('           但根目录整洁仍要清偿 —— 找物主移进 tmp/ 或 logs/,或按 §28 加白名单。')
  }
  emitRemedyHint()

  const outcome = decideOutcome({ owned, preexisting, untracked })
  // 末行现读:两档同时在场时**分别报数并点名**,红优先(绝不把未判定折进红,也绝不折进绿)
  console.error(resultLine(outcome, { owned, preexisting, untracked }))
  process.exit(outcome.code)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main(process.argv)
  } catch (e) {
    // 脚本自身异常(非判据结论)⇒ 显式未判定,不冒红也不记绿(§0.3)
    console.error(`❌ 根目录整洁守门自身异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

/** §22c/§22d 约定:判据一律经 __test__ 暴露,镜像测试直接 import,不抄第二份 */
export const __test__ = {
  resolveRoot,
  isStagedArg,
  collectViolations,
  partitionByFace,
  partitionForReport,
  decideOutcome,
  resultLine,
  reportResultLine,
  briefNames,
  isRootJunkArtifact,
  selfTest,
  ALLOWED_FILES,
  ALLOWED_DIRS,
  ALLOWED_HIDDEN_FILES,
  ALLOWED_HIDDEN_DIRS,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

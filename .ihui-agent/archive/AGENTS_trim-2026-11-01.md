<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md 逐字归档(2026-11-01)

> 本文件按 AGENTS.md §1「两步归档」规定保存从主文件整行移出的重复登记副本原文,逐字未改。
> 移出动因两条:(a) 守门 207 体积预算 —— HEAD 面现读 97,292 B 已超 96,000 B;
> (b) 同一事实五份表述互相矛盾:各枚对活 gitdir 形态的断言分别是「工作区外 gitfile」/
> 「工作区内实体目录」/「D:/IHUI-AI-git-repo 不存在」,而 2026-11-01 现读事实是:
> 工作区 .git 为 28 字节 gitfile,内容指向 D:/IHUI-AI-git-repo,该目录实体存在。
> 主文件只留 §5b 首条一份(其正文自带"按当次实测取值"口径)与一条纯指针,其余存本件。

---

### AGENTS.md 原第 29 行

- **结构与守护**:活 gitdir 形态按当次实测(本机 2026-10-30 现读 = 工作区 `.git` 是 gitfile(内容 `gitdir: D:/IHUI-AI-git-repo`)⇒ 活 gitdir 在工作区外;`.git-backup-20260912` 才是遗留,均禁删清)。守护 = `git-guardian.mjs`(daemon + 计划任务 `IHUI-AI git-guardian` 每 2 分钟),分层自愈 `指针→环境→HEAD→嵌套 ref→本地备份→远端`,破坏性覆盖前先归档到 `gitArchiveDir()`(现 `D:\DevEnv\backups\git\`),**手工抢修也不得把 `.git*` 归档 mv 到工作区根**。诊断:`node scripts/git-guardian.mjs --status|--check`;日志 `.ihui-agent/state/git-guardian.log`。

### AGENTS.md 原第 422 行

- **结构与守护**:活 gitdir 形态按当次实测(本机 = 工作区内 `.git` 实体目录;`D:/IHUI-AI-git-repo` 与 `D:/IHUI-AI.git-backup-20260912` 是另一形态的遗留,禁止删除/清理)。守护 = `git-guardian.mjs`(daemon + 计划任务 `IHUI-AI git-guardian` 每 2 分钟),分层自愈 `指针→环境→HEAD→嵌套 ref→本地备份→远端`,破坏性覆盖前先归档到 `gitArchiveDir()`(现 `D:\DevEnv\backups\git\`),**手工抢修也不得把 `.git*` 归档 mv 到工作区根**。诊断:`node scripts/git-guardian.mjs --status|--check`;日志 `.ihui-agent/state/git-guardian.log`。

### AGENTS.md 原第 424 行

- **结构与守护**:活 gitdir 形态按当次实测(本机 2026-10-31 实测 = 工作区 `.git` **实体目录**;`D:/IHUI-AI-git-repo` 不存在 ⇒ 活 gitdir 在工作区内;`.git-backup-20260912` 是遗留,禁删清)。守护 = `git-guardian.mjs`(daemon + 计划任务 `IHUI-AI git-guardian` 每 2 分钟),分层自愈 `指针→环境→HEAD→嵌套 ref→本地备份→远端`,破坏性覆盖前先归档到 `gitArchiveDir()`(现 `D:\DevEnv\backups\git\`),**手工抢修也不得把 `.git*` 归档 mv 到工作区根**。诊断:`node scripts/git-guardian.mjs --status|--check`;日志 `.ihui-agent/state/git-guardian.log`。

---

## 第二批(同日第二批):同题两版重复登记

### AGENTS.md 原第 401 行(端侧读数格)

- 端侧(RN / 共享源)同一约束,按宿主分档:**等分格**行加 `flexWrap: 'wrap'` + 格加 `minWidth`(=`最坏读数单行宽`,两条缺一不可:只给 minWidth 是溢出压邻格,只给 flexWrap 时 `flex:1` 的 `flexBasis` 是 0 永不触发);**`space-between` 行 / `absolute` 容器**内的读数加 `flexShrink: 0`;**定宽格(`width:NN%` / `flexBasis`)**只能靠 `minWidth`。守门 `check-rn-readout-cell.mjs`(blocking,AST 判 JSX 父子关系,存量现读),写法见 `docs/UI_GUIDELINES.md` §13.4。

### AGENTS.md 原第 404 行(跨端造页闭环腿)

- **跨端造页闭环腿(2026-10-26 立,巡检轮)**:`git-guardian.mjs` 的 `sweepCrossEndShellPages()` 把 `land-cross-end-shell-pages.mjs` 从「只能人工敲」变成定时自跑:blob = `git show HEAD:<file> ⊕ 本批行`,结论走 `--json` 的 summary;clean 即零写零推,blocked/pending 只写日志不喊人(§5e-1),取不到记未判定不记绿 ⇒ 不进提交链(§12e)。**容量上限**:单分包 2 MiB;判据 `scripts/lib/cross-end-subpackage-capacity.mjs`,门 110 **AB3** 兜底。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

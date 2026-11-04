<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 共享索引残留处置 Playbook

> **读者**:其他并行会话、将来接手本仓的人。
> **定位**:只写「看到什么形态、跑哪条命令、什么条件下才能动手」,不写事故叙事。
> **纪律基准**:一切提交纪律以 [AGENTS.md](../AGENTS.md) 为准;本文**不替代** AGENTS.md,不新增门判据,也不进 AGENTS.md(其体积余量约 134B)。
> **计数**:判据 13 条(形态识别 4 + 清理 3 + 不可用 2 + 共享索引取样 1 + 提交硬约束 2 + 取证 1)、禁令 12 条(§7)。
> **解释器**:以下命令均为 PowerShell 7(`pwsh`),在仓库根执行;路径写仓根相对或绝对均可。

## 0. 先取样,后判断

共享 `.git/index` 是**多会话共享的可变资源**,任何判断都必须基于**当次重新取样**的读数,不能沿用上一分钟的快照。

```powershell
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$idxPath = Join-Path (git rev-parse --absolute-git-dir) 'index'
"[$ts] index=$idxPath"
"indexHash=$((Get-FileHash $idxPath -Algorithm SHA256).Hash)"
git diff --cached --name-status
git status --porcelain=v1
```

本机实测真实 gitdir = `D:/IHUI-AI-git-repo`,工作区的 `.git` 只是 `gitdir: D:/IHUI-AI-git-repo` 指针文件。换机后以当次 `git rev-parse --absolute-git-dir` 读数为准,不要把本文的路径当本机事实。

## 1. 四种残留形态与区分(判据 1–4)

| 形态 | `git status --porcelain` 签名 | 本质 | 第一动作 |
|---|---|---|---|
| **AD** | `AD <path>`(索引=A、工作树=D) | 索引挂着「已加」条目,而 HEAD 已无此路径;整索引提交会把已删文件**复活** | 不要 `git add`,不要整索引提交;改走 §5 私有索引 |
| **MM** | `MM <path>` | 提交后共享索引仍挂**旧 blob 副本**,HEAD 已是新 blob | 不要用共享索引提交;旧 blob 不属于你时不要 `git add` 覆盖 |
| **`D ` + `??`** | 两行:`D  <path>` 与 `?? <path>` | 索引已删、工作树文件仍在:反向暂存删除 / 索引落后于 HEAD(与 `git rm --cached` 同形) | 只有 §2 三条同时成立才可清;否则视为他人在飞 |
| **私有索引回灌** | 状态面无异常;提交树里的 blob 不是定版 blob | 钩子内 lint-staged 的 `git add` 把工作树版本写回私有索引,令 `--cacheinfo` / `read-tree` 的定版失效 | 提交后用提交树反查 blob;见判据 4 |

### 判据 1 — `AD` 识别与「复活」复核

```powershell
$p = '<仓根相对路径>'
git status --porcelain=v1 -- $p            # 期望首两列 = AD
$idx = git ls-files -s -- $p
if ($idx) { "index blob=$(($idx -split '\s+')[1])" }
$head = git rev-parse --verify --quiet "HEAD:$p"
if (-not $head) { 'HEAD 已无此路径 ⇒ 索引里是“复活型”add 条目' }
git cat-file -e "HEAD:$p" 2>$null; "cat-file rc=$LASTEXITCODE"
```

区分正常新增:正常 `A ` 伴随工作树文件存在;`AD` 是工作树已删而索引仍有 add 条目。若用共享索引执行整索引提交,提交后复核是否真的复活:

```powershell
git cat-file -e "HEAD:$p"; "rc=$LASTEXITCODE"   # rc=0 ⇒ 已复活,残留已进 HEAD
```

### 判据 2 — `MM` 的「旧 blob 副本」识别

```powershell
$p = '<仓根相对路径>'
$st = git status --porcelain=v1 -- $p        # 期望 MM
$idxBlob  = ((git ls-files -s -- $p) -split '\s+')[1]
$wtBlob   = git hash-object -- $p
$headBlob = git rev-parse --verify --quiet "HEAD:$p"
[pscustomobject]@{ st=$st; idx=$idxBlob; wt=$wtBlob; head=$headBlob } | Format-List
```

判据:提交之后 `$idxBlob -ne $headBlob`,且 `$idxBlob` 等于**上一枚提交**的同路径 blob(`git rev-parse --verify --quiet "HEAD^:$p"`)⇒ 共享索引挂着旧副本。`MM` 也可能是「索引与工作树都改了」的正常态,必须用「提交后 + 旧 blob 等值」这一步区分。

### 判据 3 — `D ` + `??` 与真实删除的区分

```powershell
$p = '<仓根相对路径>'
git status --porcelain=v1 -- $p              # 期望两行:D  <path> / ?? <path>
"worktreeExists=$(Test-Path $p)"             # True ⇒ 不是真实删除
$ls = git ls-files -s -- $p
"indexEntry=$(if ($ls) { 'present' } else { 'absent' })"
```

真实 staged 删除的特征是:`D ` 一行,**工作树文件不存在**,不会同时出现 `??`。出现 `??` 说明文件仍在工作树里,才进入 §2 的三条判据。

### 判据 4 — 私有索引被钩子回灌的识别

提交前先记下**定版 blob**(HEAD blob 或你用 `git hash-object -w` 写入的 blob),提交后从提交树反查:

```powershell
$p = '<仓根相对路径>'
$sha = git rev-parse HEAD
$actual = git rev-parse "${sha}:$p"
# $expected = 提交前记录的定版 blob(全 40 位)
if ($actual -ne $expected) { '被回灌:提交内容 = 工作树版本,不是定版 blob' }
Select-String -Path .ihui-agent/state/hook-logs/pre-commit.log -Pattern '私有索引内容护栏'
```

机制(用于解释现象,不用于判据):`.husky/pre-commit:18-20` 在 `GIT_INDEX_FILE` 非空且文件存在时**保留**指针;钩子内 lint-staged 会对同一份私有索引执行 `git add`,从而用工作树版本覆盖你 pin 的条目。`scripts/isolated-git.mjs` 的快照护栏会在提交前比对并拒绝不一致,证据行在 `pre-commit.log` 的「私有索引内容护栏」段。

## 2. `D ` + `??` 的唯一可执行清理判据(判据 5–7)

**三条同时成立才动手**;任何一条不成立 ⇒ 标记「非本席 / 未判定」,不动共享索引。

### 判据 5 — 工作树内容就是 HEAD 内容(无内容损失)

```powershell
$p = '<仓根相对路径>'
$head = git rev-parse --verify --quiet "HEAD:$p"
if (-not $head) { throw '判据①未过:HEAD 无此路径' }
$wt = git hash-object -- $p
if ($head -ne $wt) { throw "判据①未过:工作树($wt) != HEAD($head) ⇒ 可能有内容损失" }
"① OK head=wt=$head"
```

### 判据 6 — 索引条目(若存在)的 blob 必等于 HEAD blob,且不是真实删除

```powershell
$p = '<仓根相对路径>'
$head = git rev-parse --verify --quiet "HEAD:$p"
$ls = git ls-files -s -- $p
if ($ls) {
  $idxBlob = ($ls -split '\s+')[1]
  if ($idxBlob -ne $head) { throw "判据②未过:索引($idxBlob) != HEAD($head)" }
} else {
  if (-not (Test-Path $p)) { throw '判据②未过:工作树文件消失 = 真实 staged 删除,不是残留' }
}
"② OK 索引条目与 HEAD blob 一致(或索引无条目且工作树文件仍在)"
```

### 判据 7 — 不在任何在飞声明集

「本席声明集」= 你自己本轮准备提交的路径清单;「历史声明集」= `.ihui-agent/state/hook-logs/pre-commit-rounds.jsonl` 每一条的 `declaredFiles`。

```powershell
$p = '<仓根相对路径>'
$own = @()                        # 填本席本轮声明路径;没有声明集就保持空数组
if ($own -contains $p) { throw '判据③未过:属本席声明路径,交给本席提交链,不进清理面' }

$rounds = '.ihui-agent/state/hook-logs/pre-commit-rounds.jsonl'
if (Test-Path $rounds) {
  $hits = Get-Content $rounds | ForEach-Object { $_ | ConvertFrom-Json } |
    Where-Object { $_.declaredFiles -contains $p }
  if ($hits) {
    $hits | Select-Object ts, headBefore, exitCode | Format-Table -AutoSize
    throw '判据③未过:某轮声明集包含该路径'
  }
} else {
  'rounds 文件不存在 ⇒ 无历史声明(记录在案,不作反证)'
}
"③ OK 不在任何在飞声明集"
```

### 执行(只有三条全过才跑)

固定只用 `git restore --staged -- <path>`,**仅这一条路径**;**禁通配、禁 `-- .`、禁 `git reset HEAD`**。每条路径单独执行一次,前后各取一次 `git diff --cached --name-status`:

```powershell
$p = '<仓根相对路径>'
$before = @(git diff --cached --name-status)
git restore --staged -- $p
if ($LASTEXITCODE -ne 0) { throw 'restore 失败(常见:并发 index.lock);重新取样后再试,不要换用 reset/通配' }
$after = @(git diff --cached --name-status)
Compare-Object $before $after | Format-Table -AutoSize
```

判读:
- 预期差异**只有一行**:`D  <path>` 从暂存面消失。
- 出现其他增删 = 并发会话造成的**成分漂移**,必须原样声明,不得算作本次 restore 的成果。
- 若 `$after` 里该路径仍在,或出现新的 `AD` / `MM`,停手并回到 §0 重新取样。

## 3. 两条明确「不可用作判据」的读数(判据 8–9)

### 判据 8 — 「索引 vs HEAD 两哈希相等」不能区分 `git rm --cached` 与索引落后

`git rm --cached -- <path>` 之后与「索引落后于 HEAD」两种状态,在工作树与暂存面上**逐字相同**(同为 `D ` + `??`,索引里同样没有该条目)。只看「索引 blob 与 HEAD blob 是否相等」,无法区分「合法清理过的反向暂存」与「他人在飞的删除意图」。

```powershell
$p = '<仓根相对路径>'
git status --porcelain=v1 -- $p   # 两种状态都可能是:D  <path> + ?? <path>
git ls-files -s -- $p             # 两种状态都可能是:无输出
```

结论:该比法**只能作为判据 6 的组成项**,不能单独当清理依据;必须叠加判据 5(工作树==HEAD)与判据 7(不在在飞声明集)。

### 判据 9 — 索引文件 mtime 不可信(会被 stat-cache 刷新重写)

`git status` 会刷新 stat-cache 并重写索引,导致 `index` 的 mtime 无条件变新,与「刚发生了提交/暂存」无关。

```powershell
$idxPath = Join-Path (git rev-parse --absolute-git-dir) 'index'
$b = (Get-FileHash $idxPath -Algorithm SHA256).Hash
git status --porcelain=v1 | Out-Null
$a = (Get-FileHash $idxPath -Algorithm SHA256).Hash
if ($b -ne $a) { 'index 被 stat-cache 刷新重写 ⇒ mtime 不可作为“谁刚刚写了索引”的证据' }
(Get-Item $idxPath).LastWriteTime
git log -1 --format='%H %ci'
```

**实测反例**:真实 gitdir = `D:/IHUI-AI-git-repo`;`index` 的 mtime 为 `20:23:34`,晚于提交 `dd18e2c2c23ef15dfaf90d24fca3886bc529a340` 的 `20:19:32`,纯属刷新假象,提交并未发生在 `20:23:34`。

## 4. 共享索引是共享可变资源(判据 10)

**实测**:同一分钟内的两次取样,基线成分就漂了——`M scripts/isolated-git.mjs` 消失,`M packages/i18n/messages/miniapp-taro/ko.json` 以 `MM` 新进。因此**不要**把「基线快照 → 事后比对」当作唯一证据;每次操作前重新取样。

```powershell
function Get-IndexFace {
  [pscustomobject]@{
    ts        = Get-Date -Format 'HH:mm:ss'
    indexHash = (Get-FileHash (Join-Path (git rev-parse --absolute-git-dir) 'index') -Algorithm SHA256).Hash
    staged    = @(git diff --cached --name-status)
    worktree  = @(git status --porcelain=v1 --untracked-files=no)
  }
}
Get-IndexFace
Start-Sleep -Seconds 30
Get-IndexFace
```

判读:两次 `indexHash` / `staged` / `worktree` 任一变化 ⇒ 期间有并发写入。你的 restore 前后对照必须以**紧邻执行的两次读数**为准;更早的快照只能当历史参考,不能当证据。

## 5. 提交纪律的推荐通道(判据 11–12)

| 优先级 | 通道 | 说明 |
|---|---|---|
| 1 | **自建私有 `GIT_INDEX_FILE`** + `IHUI_EXPECTED_PRIVATE_INDEX` 指向它 | 仓内现成实现:`node scripts/isolated-git.mjs commit -m "<标题>" -- <路径...>`;以 HEAD 为基只加声明集,共享索引全程不读写 |
| 2 | `git commit -m "<标题>" --only -- <路径...>` | 只提交 `--` 之后的路径;git 用临时索引,不把别席暂存一起带走 |
| ✗ | 共享索引上的裸 `git commit` / `git add -A` | 结构性不可用,见判据 11、12 |

### 判据 11 — 钩子会清掉「空/陈旧」的 `GIT_INDEX_FILE`

`.husky/pre-commit:18-20` 的判据是「非空**且文件确实存在**才保留」;指针为空或指向不存在的文件 ⇒ `unset`。所以只有环境变量、没有真实索引文件,钩子仍会落回共享索引。

```powershell
if ($env:GIT_INDEX_FILE) {
  "GIT_INDEX_FILE=$env:GIT_INDEX_FILE exists=$(Test-Path $env:GIT_INDEX_FILE)"
} else { 'GIT_INDEX_FILE 为空 ⇒ 钩子将使用共享索引' }
```

私有索引文件必须在本进程存续期间真实存在,不要先删文件再提交。

### 判据 12 — `IHUI_EXPECTED_PRIVATE_INDEX` 在 sh 层 fail-closed

`.husky/pre-commit:29-38`:调用方声明了 `IHUI_EXPECTED_PRIVATE_INDEX` 时,`GIT_INDEX_FILE` 必须**一字不差**(仅 `\` 与 `/` 归一等价)且文件可用;否则 `exit 1`。这一层在 **node 启动之前**执行,连 vbs 轮次标记、`pre-commit-rounds.jsonl` 都不会写。

```powershell
[pscustomobject]@{
  GIT_INDEX_FILE              = $env:GIT_INDEX_FILE
  IHUI_EXPECTED_PRIVATE_INDEX = $env:IHUI_EXPECTED_PRIVATE_INDEX
  indexExists                 = if ($env:GIT_INDEX_FILE) { Test-Path $env:GIT_INDEX_FILE } else { $false }
} | Format-List
```

结论:在共享索引上直接 `git commit` 一旦撞上这条守卫,唯一正确出路是**补成一对匹配的声明**(私有索引路径 + 存在的文件),不是 `--no-verify`、不是 `HUSKY=0`、不是清空变量假装没声明。仍不通就停手报告,别绕。

推荐调用(自带私有索引、自动声明、只交声明集):

```powershell
New-Item -ItemType Directory -Force .ihui-agent/tmp/index-residue | Out-Null
$log = ".ihui-agent/tmp/index-residue/commit-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
node scripts/isolated-git.mjs commit -m "<type(scope): 标题>" -- <路径...> 2>&1 |
  Tee-Object -FilePath $log
"exit=$LASTEXITCODE log=$log"
```

## 6. 失败时证据会消失:调用方必须自带日志(判据 13)

- `scripts/hook-run-hidden.vbs:97-103` 在 node 启动**之前**写一行 `==== <时间> :: <脚本> <参数> ====` 标记,随后 `cmd /s /c ... >> log 2>&1`。
- `.husky/pre-commit:50-54` 失败时只回显 `tail -40 .ihui-agent/state/hook-logs/pre-commit.log`。
- `scripts/lib/pre-commit-hook.js:386` 的 `pre-commit-rounds.jsonl` 只在 `process.on('exit')` 落盘;`SIGINT/SIGTERM` 可能走不到,记录缺失。

因此**直跑 `git commit` 的调用方必须自带 `2>&1 | Tee-Object -FilePath <file>`**;被拒后只看 exit code 等于没有证据。

```powershell
New-Item -ItemType Directory -Force .ihui-agent/tmp/index-residue | Out-Null
$log = ".ihui-agent/tmp/index-residue/commit-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
git commit -m "<type(scope): 标题>" --only -- <路径...> 2>&1 |
  Tee-Object -FilePath $log
if ($LASTEXITCODE -ne 0) {
  "exit=$LASTEXITCODE log=$log"
  Get-Content $log -Tail 60
  Select-String -Path .ihui-agent/state/hook-logs/pre-commit.log -Pattern '==== ' | Select-Object -Last 3
  Get-Content .ihui-agent/state/hook-logs/pre-commit.log -Tail 80
  Get-Content .ihui-agent/state/hook-logs/pre-commit-rounds.jsonl -Tail 1 | ConvertFrom-Json
}
```

判读:`pre-commit.log` 里**没有新标记** + exit 1 ⇒ 在 sh 层就被拒(判据 12),不是门体红;有新标记但末 40 行是门体输出 ⇒ 按门体原因处理。

## 7. 禁令清单(12 条)

1. 严禁 `--no-verify`;
2. 严禁 `HUSKY=0`(及任何等价关钩子环境);
3. 严禁 `git add -A` / `git add .`;
4. 严禁在共享索引上裸 `git commit`;
5. 严禁 `rebase`;
6. 严禁 force push;
7. 严禁 `object-space-land`;
8. 严禁 `commit-tree` 无钩落地;
9. 清理 `D ` + `??` 时严禁通配路径;
10. 清理时严禁 `git restore --staged -- .`;
11. 清理时严禁 `git reset HEAD`;
12. 多会话共享工作区严禁 `stash`(现场隔离用 worktree)。

## 8. 五分钟收口流程

1. **0:00 取样** — 跑 §0 四条命令,记录时间戳、`indexHash`、暂存面与工作树面。
2. **0:30 分类** — 用 §1 的表把每个异常路径标注为 `AD` / `MM` / `D ` + `??` / 私有索引回灌;判据 4 只在提交后复核。
3. **1:00 跑三判据** — 对每个 `D ` + `??` 候选依次跑判据 5、6、7;任一不过就标「非本席 / 未判定」,不动。
4. **2:00 逐路径清理** — 三条全过的路径,一条一条跑 `git restore --staged -- <path>`,每条前后各取一次 `git diff --cached --name-status`;额外差异 = 并发漂移,原样声明。
5. **2:30 复采样** — 重跑 §0;确认该路径已从暂存面消失、工作树文件仍在、HEAD 内容未变。
6. **3:30 私有索引提交** — `node scripts/isolated-git.mjs commit -m "<标题>" -- <声明路径...> 2>&1 | Tee-Object -FilePath <log>`;或退一档 `git commit -m "<标题>" --only -- <路径...>` 并同样 tee。
7. **4:30 提交后核验** — 下面四条任一不符即停手:

```powershell
$sha = git rev-parse HEAD
git show --name-status --format='%H %s' $sha
$p = '<曾被清理的路径>'
if (-not (git rev-parse --verify --quiet "HEAD:$p")) { 'OK:该路径未复活(AD 已挡住)' }
$treeBlob  = git rev-parse "${sha}:$p"
$indexBlob = ((git ls-files -s -- $p) -split '\s+')[1]
"treeBlob=$treeBlob indexBlob=$indexBlob"
git status --porcelain=v1 -- $p
```

核验口径:提交内容 = 声明集;`AD` 路径未复活;`MM` 路径的提交树 blob = 定版 blob;`D ` + `??` 路径要么未动、要么按三条判据清掉且工作树无损。

## 附录:本文与 AGENTS.md 的边界

- 本文只补「可照做的操作口径」,**不改**任何脚本、不改 `AGENTS.md`、不新增/不改门判据。
- 受保护面清单(`scripts/data/immutable-guard.json`,20 条)与 `docs/**` 无关;提交前仍以 `node scripts/check-immutable-guard.mjs --staged` 的**当次实测**为准。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

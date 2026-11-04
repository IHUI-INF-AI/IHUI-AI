<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 共享索引残留处置 Playbook

> **读者**:其他并行会话、将来接手本仓的人。
> **定位**:只写「看到什么形态、跑哪条命令、什么条件下才能动手」,不写事故叙事。
> **纪律基准**:一切提交纪律以 [AGENTS.md](../AGENTS.md) 为准;本文**不替代** AGENTS.md,不新增门判据,也不进 AGENTS.md(其体积余量约 134B)。
> **计数**:判据 18 条(形态识别 4 + `D `+`??` 清理 3 + 不可用 2 + 共享索引取样 1 + 提交硬约束 2 + 取证 1 + `AD`/`MM` 2 + 越界识别 1 + 提交后残差 1 + 定版边界 1)、禁令 18 条(§7 1–18)。
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
| **AD** | `AD <path>`(索引=A、工作树=D) | 索引挂着「已加」条目,而 HEAD 已无此路径;整索引提交会把已删文件**复活** | 跑 §2A 判据 9;HEAD 有路径 ⇒ 停手上报 |
| **MM** | `MM <path>` | 提交后共享索引仍挂**旧 blob 副本**,HEAD 已是新 blob | 跑 §2A 判据 8 三值分流;乙型禁 `git add` |
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

区分正常新增:正常 `A ` 伴随工作树文件存在;`AD` 是工作树已删而索引仍有 add 条目。若该路径 HEAD 也不存在、工作树也缺失,按 §2A 判据 9 处理;HEAD 有路径则一律停手。若用共享索引执行整索引提交,提交后复核是否真的复活:

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

判据:提交之后 `$idxBlob -ne $headBlob`,且 `$idxBlob` 等于**上一枚提交**的同路径 blob(`git rev-parse --verify --quiet "HEAD^:$p"`)⇒ 共享索引挂着旧副本。`MM` 也可能是「索引与工作树都改了」的正常态,必须用「提交后 + 旧 blob 等值」这一步区分。确认为旧副本后,按 §2A 判据 8 的三值分流选择唯一修法。

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

## 2A. `AD` / `MM` 的三值比较与唯一修法(判据 8–9)

本节读数来自 `%TEMP%` 下 2026-11-04 实跑的 scratch 仓(独立仓,用完已删),不是对既有事故的复述。blob 只用于证明「比较方向」,不要套用到真实仓的其他路径。

统一取样(每型都先跑这一组):

```powershell
$p = '<仓根相对路径>'
$idx  = git rev-parse --verify --quiet ":$p";      "index=$idx"
$head = git rev-parse --verify --quiet "HEAD:$p";  "head=$head"
$wt   = if (Test-Path $p) { git hash-object -- $p } else { '<missing>' }; "worktree=$wt"
git status --porcelain=v1 -- $p
git diff --cached --name-status -- $p
```

### 判据 8 — `MM`:三值比较,按「工作树是否等于 HEAD」分流

**判定条件(三值比较)**:

| 三值关系 | 处境 | 唯一修法 | 修后预期 |
|---|---|---|---|
| index == HEAD | `MM` 的另一半只是工作树未暂存改动 | **不处理** | 状态保持 ` M`,不写索引 |
| index != HEAD 且 worktree == HEAD | 甲:索引挂旧 blob,工作树就是 HEAD | `git add -- <path>` | 三值全等;`diff --cached` 该路径消失 |
| index != HEAD 且 worktree != HEAD | 乙:工作树是第三方在飞内容 | `git restore --staged --source=HEAD -- <path>` | index == HEAD;**工作树 hash 不变** |

**唯一修法(按三值只选一条)**:

```powershell
$p = '<仓根相对路径>'
$idx  = git rev-parse --verify --quiet ":$p"
$head = git rev-parse --verify --quiet "HEAD:$p"
if (-not $idx)  { throw '不是 MM:索引无条目,转判据 9' }
if (-not $head) { throw '不是 MM:HEAD 无此路径,转判据 9' }
if (-not (Test-Path $p)) { throw '不是 MM:工作树无此文件,转判据 9' }
$wt = git hash-object -- $p
if ($idx -eq $head) {
  '不处理:索引已对齐 HEAD,剩余差异属工作树未暂存'
} elseif ($wt -eq $head) {
  git add -- $p                              # 甲:工作树 == HEAD,写回无第三方内容
} else {
  git restore --staged --source=HEAD -- $p    # 乙:第三方在飞,严禁 git add
}
git diff --cached --name-status -- $p
```

scratch 实测读数:

| 处境 | 操作前 `v1` / `v2` | index | HEAD | 工作树 | `diff --cached` | 执行后 |
|---|---|---|---|---|---|---|
| MM 甲 `mm-jia.txt` | `MM` / `1 MM N... 100644 100644 100644 8c1384d8… 626799f0…` | `626799f0…`(旧) | `8c1384d8…` | `8c1384d8…` | `M` | `git add` 后三值全为 `8c1384d8…`,状态空,`diff --cached` 空 |
| MM 乙 `mm-yi.json` | `MM` / `1 MM N... 100644 100644 100644 6e294208… d970bbab…` | `d970bbab…`(旧) | `6e294208…` | `f7c04143…`(第三方) | `M` | `git restore --staged --source=HEAD` 后 index `6e294208…`,工作树仍 `f7c04143…`,状态 ` M`,`diff --cached` 空 |

- **修完必须复验**:`git rev-parse ':path'` 与 `git rev-parse 'HEAD:path'` 相等;`git diff --cached --name-status -- <path>` 无输出。乙型还要确认 `git hash-object <path>` 与执行前**逐字相同**(工作树零变化)。
- **必须停手**:乙型**严禁 `git add`**(会把第三方半成品推进暂存面);工作树内容归属不明时只做 `restore --staged --source=HEAD`,并在提交前原样声明该路径仍是未暂存改动。

### 判据 9 — `AD`:纯残留三条合取;HEAD 有路径一律停手

**判定条件(三条同时成立)**:

1. `git rev-parse --verify --quiet ":path"` 有值(index 有 entry);
2. `Test-Path <path>` 为 `False`(工作树没有该文件);
3. `git rev-parse --verify --quiet "HEAD:path"` 为空/报错(HEAD 也没有该路径)。

**唯一修法**:`git rm --cached -- <path>`(只删索引条目,不碰工作树;禁通配、禁 `-- .`)。

```powershell
$p = '<仓根相对路径>'
$idx  = git rev-parse --verify --quiet ":$p"
$head = git rev-parse --verify --quiet "HEAD:$p"
$exists = Test-Path $p
[pscustomobject]@{ index=$idx; head=$head; worktreeExists=$exists } | Format-List
if ($idx -and (-not $exists) -and (-not $head)) {
  git rm --cached -- $p            # 唯一修法:只删索引条目,不碰工作树
} else {
  '停手:不满足纯残留三条件,不得 rm --cached'
}
git diff --cached --name-status -- $p
```

scratch 实测读数:

| 处境 | 操作前 `v1` / `v2` | index | HEAD | 工作树 | `diff --cached` | 执行后 |
|---|---|---|---|---|---|---|
| AD 纯残留 `ad-pure.txt` | `AD` / `1 AD N... 000000 100644 000000 0000… b9186ec7…` | `b9186ec7…` | `<absent>` | `<missing>` | `A` | `git rm --cached` 后 index/HEAD 均 `<absent>`、工作树 `<missing>`、状态空、`diff --cached` 空 |
| 候选但 HEAD 有(变体 1)`ad-head.txt` | ` D` / `1 .D N... 100644 100644 000000 b7c004ed… b7c004ed…` | `b7c004ed…` | `b7c004ed…` | `<missing>` | 空 | **不执行**,停手 |
| 候选但 HEAD 有(变体 2)`ad-head.txt` | `MD` / `1 MD N... 100644 100644 000000 b7c004ed… ffd1c007…` | `ffd1c007…` | `b7c004ed…` | `<missing>` | `M` | **不执行**,停手 |

**实测修正(相对口头判据)**:「`AD` 但 HEAD 有该路径」在 porcelain 里**构造不出字面 `AD`**——实测变体 1 是 ` D`(index==HEAD),变体 2 是 `MD`(index!=HEAD);只要 `HEAD:path` 有值就必须停手,不得 `rm --cached`。`HEAD:path` 是否存在,才是这一步的硬判据。

- **修完必须复验**:`git ls-files -s -- <path>` 无输出;`Test-Path <path>` 仍为 `False`;`git rev-parse --verify --quiet "HEAD:<path>"` 仍为空(未复活);`git diff --cached --name-status -- <path>` 无输出。
- **必须停手**:HEAD 有该路径(任何变体)⇒ 是「工作树被误删」,交归属方判断删除意图;工作树**有**文件 ⇒ 是暂存新增后又被还原,不是 `AD`;路径在在飞声明集 ⇒ 先过判据 7。

## 2B. 越界状态 `R` / `T` / `U`(判据 10)

这三种状态**不属于本 playbook 的处置范围**:遇到必须停手上报,不做任何 `restore` / `add` / `rm --cached`。

| 状态 | `v1` 签名 | `v2` 首列/结构 | 识别点 |
|---|---|---|---|
| rename | `R  <old> -> <new>` | `2 R<score> ... <new>⇥<old>` | 首字符 `2`;XY 首列 `R` |
| typechange | `T ` / `TT` | `1 TT S... 100644 160000 100644 …` | `1` 行 XY 任一列为 `T` |
| unmerged | `UU` / `AA` / `DU` / `UD` 等 | `u <XY> N... …` | 首字符 `u` |

scratch 实测原始行:

```text
2 R. N... 100644 100644 100644 b52b2a3a… b52b2a3a… R100 r-new.txt⇥r-old.txt
1 TT S... 100644 160000 100644 f5251516… ffba86f5… tfile.txt
u UU N... 100644 100644 100644 100644 df967b96… e45c9c26… 2299c379… u.txt
```

只读识别命令(**全量取样,不要带 pathspec**):

```powershell
git status --porcelain=v2 | Where-Object {
  if ($_ -match '^1 (.)(.) ') { ($Matches[1] -in 'R','T') -or ($Matches[2] -in 'R','T') }
  elseif ($_ -match '^2 ') { $true }   # rename
  elseif ($_ -match '^u ') { $true }   # unmerged
  else { $false }
}
```

（`⇥` 表示 TAB）注意:带 pathspec 的 `git status --porcelain=v2 -- <path>` 会关闭 rename 检测;实测同一处显示 `1 A.` 而非 `2 R....`,所以识别 `R` 必须全量取样。命中后把原始行贴进上报,不做任何索引写入。

## 3. 两条明确「不可用作判据」的读数(判据 11–12)

### 判据 11 — 「索引 vs HEAD 两哈希相等」不能区分 `git rm --cached` 与索引落后

`git rm --cached -- <path>` 之后与「索引落后于 HEAD」两种状态,在工作树与暂存面上**逐字相同**(同为 `D ` + `??`,索引里同样没有该条目)。只看「索引 blob 与 HEAD blob 是否相等」,无法区分「合法清理过的反向暂存」与「他人在飞的删除意图」。

```powershell
$p = '<仓根相对路径>'
git status --porcelain=v1 -- $p   # 两种状态都可能是:D  <path> + ?? <path>
git ls-files -s -- $p             # 两种状态都可能是:无输出
```

结论:该比法**只能作为判据 6 的组成项**,不能单独当清理依据;必须叠加判据 5(工作树==HEAD)与判据 7(不在在飞声明集)。

### 判据 12 — 索引文件 mtime 不可信(会被 stat-cache 刷新重写)

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

## 4. 共享索引是共享可变资源(判据 13)

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

## 5. 提交纪律的推荐通道(判据 14–15)

| 优先级 | 通道 | 说明 |
|---|---|---|
| 1 | **自建私有 `GIT_INDEX_FILE`** + `IHUI_EXPECTED_PRIVATE_INDEX` 指向它 | 仓内现成实现:`node scripts/isolated-git.mjs commit -m "<标题>" -- <路径...>`;以 HEAD 为基只加声明集,共享索引全程不读写 |
| 2 | `git commit -m "<标题>" --only -- <路径...>` | 只提交 `--` 之后的路径;git 用临时索引,不把别席暂存一起带走 |
| ✗ | 共享索引上的裸 `git commit` / `git add -A` | 结构性不可用,见判据 14、15 |

### 判据 14 — 钩子会清掉「空/陈旧」的 `GIT_INDEX_FILE`

`.husky/pre-commit:18-20` 的判据是「非空**且文件确实存在**才保留」;指针为空或指向不存在的文件 ⇒ `unset`。所以只有环境变量、没有真实索引文件,钩子仍会落回共享索引。

```powershell
if ($env:GIT_INDEX_FILE) {
  "GIT_INDEX_FILE=$env:GIT_INDEX_FILE exists=$(Test-Path $env:GIT_INDEX_FILE)"
} else { 'GIT_INDEX_FILE 为空 ⇒ 钩子将使用共享索引' }
```

私有索引文件必须在本进程存续期间真实存在,不要先删文件再提交。

### 判据 15 — `IHUI_EXPECTED_PRIVATE_INDEX` 在 sh 层 fail-closed

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

## 6. 失败时证据会消失:调用方必须自带日志(判据 16)

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

判读:`pre-commit.log` 里**没有新标记** + exit 1 ⇒ 在 sh 层就被拒(判据 15),不是门体红;有新标记但末 40 行是门体输出 ⇒ 按门体原因处理。
## 6A. 私有索引提交后的工作树残差与定版语义边界(判据 17–18;红线 C)

> 本节来自钩子链索引改造(定版索引护栏 `scripts/lib/index-pin-guard.js` + 钩子退出网 `scripts/lib/pre-commit-hook.js`)在 main 上的实测落地,不是推演。新增判据 17–18、禁令 16–18(已并入 §7 的同一份编号序列)与红线 C;**判据 1–16、禁令 1–15 逐字不动**。

### 判据 17 — 私有索引提交成功后,钩子的 `--fix` 产物只留在工作树

**判据原文**:私有索引提交的提交内容 = **作者定版那一刻的索引内容**(`scripts/isolated-git.mjs` 以 `read-tree HEAD` + 声明集构造私有索引;调用方也可用 `--cacheinfo` 逐条钉住)。钩子里的 `prettier --write` / `eslint --fix`(`package.json` 的 `lint-staged` 段)改写的是**工作树文件**,其对索引的回写被定版护栏按「钩子开工那一刻」的快照逐条复原 ⇒ 格式化结果**不进提交**,提交成功后该路径显示 ` M`(索引 == HEAD,工作树 != HEAD)。

```powershell
$p = '<本席声明的仓根相对路径>'
$sha = git rev-parse HEAD
git status --porcelain=v1 -- $p          # 期望: M <path>(首列空格、次列 M)
"treeBlob=$(git rev-parse "${sha}:$p")"
"indexBlob=$(((git ls-files -s -- $p) -split '\s+')[1])"   # 两者应相等
git diff --cached --name-status -- $p    # 期望:空
git diff -- $p                           # 期望:只有格式化差异
```

**触发场景**:用私有 `GIT_INDEX_FILE` 提交(推荐 `node scripts/isolated-git.mjs commit -m "<标题>" -- <路径...>`),且声明路径命中 `lint-staged` 的 `prettier --write` / `eslint --fix`;提交 exit 0,随后 `git status` 在该路径上出现 ` M`。反例边界:`git commit --only -- <路径>` 交给钩子的是 git 自建的 `next-index-<pid>.lock`,按 `index-pin-guard.js` 的判据**不保护**(格式化结果进提交),不属本判据射程。

**正确动作**:先确认 `HEAD:<path>` 的 blob 等于本次定版 blob、且工作树差异**仅为格式化产物**;然后只对本席该路径执行 `git restore -- <本席路径>`(只碰自己的路径,不写索引,不碰其他路径)。若要保留格式化结果,另起一笔**专门**提交格式化产物的提交,不要并回本次或下一次声明集。

**反例**:
- 把 ` M` 读成「还有未提交的工作」而补 `git add` ⇒ 下一笔提交带上未经声明的格式化结果,提交面被扩大(与判据 8 乙型同族)。
- 用 `git checkout -- .` / `git restore .` 整树清除 ⇒ 连带清掉他席未暂存改动(§7 禁令 10 的同类整树动作)。
- 把「提交成功但工作树 ` M`」当失败重跑 ⇒ 重复落地 / 撞幂等判据,而定版提交其实已经入库。

### 判据 18 — 定版保护的语义边界:基线 = 钩子开工那一刻的索引

**判据原文**:私有索引的定版基线 = **钩子开工那一刻**的索引状态(`scripts/lib/pre-commit-hook.js` 在 lint-staged 之前调 `indexPinGuard.capturePinnedIndex`;仅在 `mode='private'`、不是 git 自建的 `next-index-<pid>.lock`、且指针不是共享索引本身时启用)。**推论(明写的边界,不是漏洞)**:调用方若在**钩子开工之后**才改写私有索引(例如钩子内嵌脚本里执行 `git update-index --cacheinfo` 做定版),该次定版**不在保护范围**,会被后续腿(`lint-staged` 的 `git add`、staging area 还原等)按开工前快照静默覆盖。

```powershell
# 定版必须在钩子启动前完成:先钉索引,再发提交令
git update-index --cacheinfo <mode>,<blob>,<path>   # 此时钩子尚未开工
node scripts/isolated-git.mjs commit -m "<标题>" -- <路径...>
```

**触发场景**:把定版动作写进 `.husky/pre-commit` 调起的脚本、写进 `lint-staged` 任务、或写进任何在钩子进程内执行的嵌套脚本;表面「已钉住」,提交内容却是工作树版本,且退出码与日志全绿。

**正确动作**:① 一切定版在**钩子启动前**完成(构造私有索引时 `--cacheinfo`,再交给 `isolated-git` 提交);② 钩子执行期间**只读**私有索引,不再写定版条目;③ 越界的正确处理是 **exit 2 未判定**(`PIN_GUARD_UNDETERMINED`;`index-pin-guard.js` 读索引输出超上界 ENOBUFS 或进程被信号中断时走这一档),**不是崩溃、不是静默放行、也不是折成红(exit 1)**——这正是 AGENTS §0.3「未判定不得冒充通过、也不得冒充失败」在索引保护上的一个应用实例。

**反例**:
- 在 `pre-commit` 的内嵌脚本里 `--cacheinfo` 定版、指望护栏兜住 ⇒ 后续腿覆盖后仍按「开工前」复原,定版意图丢失,提交反向入库他人增量(正是钩子链改造前的原病灶)。
- 把 `PIN_GUARD_UNDETERMINED`(exit 2)重试成普通失败、或加白名单放行 ⇒ 把「没看见索引全貌」冒充成「索引没问题」。
- 把 exit 2 折成 exit 1 ⇒ 把容量/未判定问题误报成内容违规,调用方会去改内容而不是查索引读取面。

### 红线 C(单列)— 只复原本席声明集内条目;他席暂存条目只报数

**判据原文**:护栏的复原面 = **本席声明集**(`isolated-git` 的 `takeIndexSnapshot` 只对声明路径取 `(mode, blob, stage)` 快照),加上**显式逐条列名且带 blob 钉**的派生产物;声明集之外的条目一律只记入 `extras` 并拒绝提交,**不删除、不复原**。他席暂存条目(`PROJECT_PLAN.md`、`scripts/tests/check-i18n-parity.test.mjs` 等)**一律不许删、不许 restore**,只能「报数」。

**触发场景**:共享索引上出现他席在飞暂存(`M ` / `MM` / `AD`);或私有索引内容护栏报出 `extras`(声明集之外出现了条目)。人工收口时最容易被「顺手清干净」的冲动命中。

**正确动作**:
- 只对本席声明路径执行 `git restore --staged -- <path>` / `git rm --cached -- <path>`(且须先过判据 5–9 的前置条件);
- `extras` 出现时**报数 + 原样打印路径**并让提交失败(exit 非 0),不做任何清理;由条目所属会话自行收口;
- 需要确认他席条目时只跑只读取样(`git diff --cached --name-status` / `git status --porcelain=v1`),把读数贴进上报。

**反例**:
- 为了让 `extras` 归零而 `git rm --cached` / `git restore --staged -- ` 他席路径 ⇒ 清空别人正在飞的暂存面,且对方无从得知。
- 用 `git reset HEAD` / `git restore --staged -- .` 整树清空 ⇒ 同型且更广(§7 禁令 10、11)。
- 把「他席条目还在」误记成「本次清理失败」而反复重跑 ⇒ 并发漂移的读数被当成自己的成果或失败。

禁令 16–18 已并入 §7 的同一份编号序列(1–18),本节不再重复措辞;语义逐字见 §7。

## 7. 禁令清单(18 条)

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
12. 多会话共享工作区严禁 `stash`(现场隔离用 worktree);
13. `MM` 乙型(index != HEAD 且 worktree != HEAD)严禁 `git add`,只能 `git restore --staged --source=HEAD -- <path>`;
14. `AD` 候选但 `HEAD:path` 有值时严禁 `git rm --cached`;
15. 遇 `R` / `T` / `U` 严禁动手,停手上报。
16. 私有索引提交成功后,本席声明路径上的 ` M`(钩子 `--fix` / 格式化残差)严禁 `git add` 并入下一笔提交,严禁 `git checkout -- .` / `git restore .` 整树清除;只能 `git restore -- <本席该路径>`(判据 17)。
17. 严禁在钩子执行期间临时改写私有索引做定版;定版必须在钩子启动前完成(判据 18)。
18. 护栏只复原本席声明集内条目;他席暂存条目严禁删、严禁 restore,只能报数(红线 C)。

## 8. 五分钟收口流程

1. **0:00 取样** — 跑 §0 四条命令,记录时间戳、`indexHash`、暂存面与工作树面。
2. **0:30 分类** — 先跑 §2B 的只读越界扫描:命中 `R` / `T` / `U` 立即停手上报;再用 §1 的表把其余异常路径标注为 `AD` / `MM` / `D ` + `??` / 私有索引回灌;判据 4 只在提交后复核。
3. **1:00 分流判据** — `AD` / `MM` 跑判据 8、9;每个 `D ` + `??` 候选跑判据 5、6、7;任一不过就标「非本席 / 未判定」,不动。
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

核验口径:提交内容 = 声明集;`AD` 路径未复活;`MM` 路径的提交树 blob = 定版 blob;`D ` + `??` 路径要么未动、要么按三条判据清掉且工作树无损;并复跑 §2B 只读扫描,确认 `R` / `T` / `U` 为零;本席声明路径若显示 ` M` 按判据 17 只 `git restore -- <本席路径>`,他席条目只报数(红线 C)。

### 落地留痕(最小台账)

| 提交 | 通道 | gatesRun | 后置核验(2026-11-04,内容面) |
|---|---|---|---|
| `5599fd8` | `live-doc-edit` 锚点插入 | `false` | 水印 verify=0(该提交内容单独复核也=0);`--self-test`=0(37/37);duplicates=0;dead-script-refs=0;docs-public-health=0;live-doc-pathspec=0(本文不在其三份名单);orphan-deletion-refs=0;agents-doc-size=0(不覆盖本文);file-size=0(不覆盖 docs);**live-doc-references=1**(本文点名的 `scripts/tests/check-i18n-parity.test.mjs` 在共享索引呈 `D `+`??`,属他席索引残留而非文档内容);**live-doc-archive-reinflation=1**(命中在 AGENTS.md,与本文无关) |
| `5af5c3d` | `live-doc-edit` 整行改写 | `false` | 同上 |

**attest 口径**:这两笔只能记为 `bypass-landing(gatesRun=false)` + 上表后置核验,不得写成「已过钩子」;两条判红均非本文内容问题,也未被「改断言/加豁免」消掉。

## 附录:本文与 AGENTS.md 的边界

- 本文只补「可照做的操作口径」,**不改**任何脚本、不改 `AGENTS.md`、不新增/不改门判据。
- 受保护面清单(`scripts/data/immutable-guard.json`,20 条)与 `docs/**` 无关;提交前仍以 `node scripts/check-immutable-guard.mjs --staged` 的**当次实测**为准。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

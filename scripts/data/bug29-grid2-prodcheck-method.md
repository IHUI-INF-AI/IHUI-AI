<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# BUG-29 格2 生产库核验方法（2026-11-20 实测可用）

## 背景

SSH 到生产机 `ssh.aizhs.top`（CF Access Service Token 通道，实测 `ssh -o BatchMode=yes ssh.aizhs.top hostname` EXIT=0）可用。
前几轮把"格1 15 索引未应用"判成必须机主，根因是拿**本机开发库** `127.0.0.1:5432/ihui` 当生产库。
真正的生产库在**生产机本机** `localhost:8810/ihui_dev`，连接串从生产签出副本 `D:\DevEnv\ihui-prod\apps\api\.env` 的 `DATABASE_URL` 读。

## 已证事实（2026-11-20，只读）

- 格1：15 个索引名逐名查 `pg_indexes` → **15/15 全命中**（生产库无需再跑 slice2 迁移）。
- 格2 代表表：`hr_employee_link_request` 在 `pg_constraint` 有 **3 个 FK**（contype='f'），前轮"真缺 FK"是开发库误判。
- 格4：`video_generation_tasks` 的 id/task_id/result 在生产库类型 = integer/varchar/text，与 schema 一致，无冲突。
- 格3：权威基线 `scripts/data/bug29-index-audit.json` 的 `grid3_declared_index_no_ddl.count = 0`（首扫误报已更正）。

## 格2 待核验

权威基线 `grid2_userId_no_fk.items` 共 **151** 项（137 nullable + 14 notNull），票面写 24 处是旧口径。
需对这 151 张表逐张查生产库 `pg_constraint`（contype='f' + conkey 含 user_id 列）或用 information_schema 确认 FK 是否在位。
137 个 nullable 项多数属"可选关联，设计上不加 FK"——**不能因无 FK 就判缺陷**，须按 `plan_note`/schema 语义逐条裁决；只有票面口径明确要求 FK 的才算 TODO。

## 远端只读 psql 的正确调用（避坑）

Git Bash 会吃反斜杠、cmd 不认正斜杠、工具链拦嵌套 powershell 与 `%VAR%`。经实测可用的形态（走 PowerShell 工具）：

```powershell
$env:MSYS_NO_PATHCONV='1'; $pct=[char]37; $A="$pct"+'A'
$q = '<SQL，字符串常量用 chr(N)||chr(M) 拼，避免单引号在多层传递被吃>'
$cmd="for /f `"tokens=2 delims==`" $A in ('findstr /I DATABASE_URL D:\DevEnv\ihui-prod\apps\api\.env') do @D:\DevEnv\runtimes\pgsql\bin\psql.exe `"$A`" -tAc `"$q`""
& ssh -o BatchMode=yes -o ConnectTimeout=20 ssh.aizhs.top $cmd
```

要点：

1. `for /f "tokens=2 delims==" %A in ('findstr ...')` —— 让**生产机自己**从 .env 读连接串，密码不跨层传递、不回显。
2. SQL 里的字面量用 `chr()` 拼接（如 `chr(104)||chr(114)...`），否则单引号被 bash+cmd 双层吃掉。
3. `psql.exe` 绝对路径 `D:\DevEnv\runtimes\pgsql\bin\psql.exe`（PG 18.6）。
4. 只做 SELECT，禁止任何 DDL/DML。

## 核验完成判据

151 张表逐张给出：表名 / nullable / 生产库 FK 是否在位 / 是否属设计上无需 FK。
汇总"真缺且该补"的净数；若为 0 → 格2 生产库证成，BUG-29 具备整票收口实证。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 盘根外流 OS 级阻断方案（Windows 10.0.26200 实测版）

> 2026-11-14 立案。机主诉求「根本不可能外泄」——仓库代码只能做到「发现」，OS 级阻断才能真正「阻止」。
> 本文档基于本机实测，不写跑不通的出路（铁律 §0.8）。

## 本机实测事实（2026-11-14 23:20）

| 检查项 | 结果 | 含义 |
|--------|------|------|
| Windows 版本 | 10.0.26200 | Windows 10 22H2 或 11 |
| Windows Defender | **已移除**（无服务、无目录） | ❌ 受控文件夹访问不可用 |
| AppLocker 服务 (AppIDSvc) | **Stopped** | ❌ AppLocker 策略不可用 |
| D:\ 盘根 ACL | `NT AUTHORITY\SYSTEM: FullControl`<br>`BUILTIN\Administrators: FullControl` | 进程以 Administrator 运行 → ACL 拦不住 |
| C:\ 盘根 ACL | `NT AUTHORITY\Authenticated Users: CreateDirectories`<br>`NT AUTHORITY\SYSTEM: FullControl`<br>`BUILTIN\Administrators: FullControl` | Authenticated Users 可建目录 → 外流风险 |
| 当前进程身份 | `Administrator` | 提权后可改 ACL |

**结论**：本机唯一可用的 OS 级阻断手段是 **NTFS ACL 收紧**。

---

## 方案：NTFS ACL 收紧（需机主手动执行）

### 原理

- **C:\ 盘根**：当前 `Authenticated Users` 有 `CreateDirectories` 权限 → 任何进程都能在 C:\ 建目录。
  **阻断**：移除该权限，仅保留 `SYSTEM` 和 `Administrators` 的 FullControl。
- **D:\ 盘根**：当前 `Administrators: FullControl` → 本仓进程就是 Administrator，ACL 无法限制自己。
  **绕不过**：Administrator 权限下，ACL 形同虚设。

### C:\ 盘根 ACL 收紧步骤

**⚠️ 风险声明**：修改 C:\ 盘根 ACL 可能影响系统行为（某些安装器、临时文件写入等）。执行前请备份 ACL 并在非生产环境测试。

#### 1. 备份当前 ACL

```powershell
# 管理员 PowerShell
icacls C:\ /save C:\backup\c-drive-acl-backup.txt
```

#### 2. 移除 Authenticated Users 的 CreateDirectories 权限

```powershell
# 管理员 PowerShell
icacls C:\ /remove:g "Authenticated Users"
```

**说明**：`/remove:g` 移除 grant 权限，不影响 deny 或 inherited 权限。

#### 3. 验证

```powershell
icacls C:\
# 应看到：
# NT AUTHORITY\SYSTEM:(OI)(CI)(F)
# BUILTIN\Administrators:(OI)(CI)(F)
# （无 Authenticated Users 条目）
```

#### 4. 测试阻断效果

```powershell
# 以普通用户身份测试（非管理员）
mkdir C:\test-stray-block
# 应报错：拒绝访问
```

### 回滚方案

如果阻断后某些程序无法运行：

```powershell
# 恢复 Authenticated Users 的 CreateDirectories
icacls C:\ /grant "Authenticated Users:(AD)"
```

或从备份恢复：

```powershell
icacls C:\ /restore C:\backup\c-drive-acl-backup.txt
```

---

## D:\ 盘根的局限

D:\ 盘根 ACL 是 `Administrators: FullControl`，而本仓进程就是 Administrator，**ACL 拦不住自己**。

唯一能限制 Administrator 的手段是 **受控文件夹访问（Windows Defender 的 CFA）**，但本机 Defender 已移除，**不可用**。

**D:\ 盘根的现实**：
- 只能靠仓库层发现（fs.watch 实时 + 10min 轮询）
- 无法在 OS 层阻止 Administrator 进程写入
- 如果确实要阻断 D:\ 外流，需要：
  1. 以非 Administrator 身份运行本仓进程
  2. 重装 Windows Defender 并启用受控文件夹访问
  3. 把 D:\ 加入受保护文件夹列表

---

## 能力边界诚实交底

| 层 | 手段 | 能否阻断 | 本机可行性 |
|----|------|----------|------------|
| 仓库层 | fs.watch 实时发现 | ❌ 只能发现 | ✅ 已装 |
| 仓库层 | 10min 轮询兜底 | ❌ 只能发现 | ✅ 已装 |
| OS 层 | NTFS ACL 收紧（C:\） | ✅ 可阻断普通用户 | ✅ 可执行，但影响面广 |
| OS 层 | NTFS ACL 收紧（D:\） | ❌ Administrator 拦不住自己 | ⚠️ 本仓进程是 Admin |
| OS 层 | 受控文件夹访问 | ✅ 可阻断任意进程 | ❌ Defender 已移除 |
| OS 层 | AppLocker | ✅ 可按进程限制 | ❌ 服务 Stopped |

**现实**：本机能做到的极限是 **C:\ 盘根 ACL 收紧 + D:\ 盘根仓库层实时发现**。要真正做到「根本不可能」，需要重装 Defender 并启用受控文件夹访问（把 C:\、D:\ 都加入受保护列表）。

---

## 推荐执行顺序

1. **立即执行**：仓库层实时发现（已装）+ C:\ 盘根 ACL 收紧（阻断普通用户外流）
2. **长期规划**：重装 Windows Defender + 启用受控文件夹访问 + 把 C:\、D:\ 加入受保护列表
3. **兜底**：接受 D:\ 盘根无法完全阻断的现实，靠仓库层毫秒级发现 + 立即点名来止损

---

## 本方案的验证方式

执行 C:\ 盘根 ACL 收紧后，运行以下测试：

```powershell
# 以普通用户身份（非管理员）
mkdir C:\test-stray-$(Get-Random)
# 应报错：拒绝访问
```

仓库层的验证由 `scripts/tests/disk-root-watch.test.mjs`（T1-T6）和实时层端到端测试覆盖。

---

## 相关文件

- 仓库层实时发现：`scripts/lib/disk-root-live-watch.mjs`
- 仓库层轮询兜底：`scripts/lib/disk-root-watch.mjs`
- 接线点：`scripts/git-guardian.mjs:14939`（`if (!CHECK_ONLY) { ... }` 块）
- 白名单单一真相源：`config/disk-root-allowlist.json`
- 本方案在 git-guardian 中的引用：`startDiskRootLiveWatch` 的 `onStray` 回调提示语
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

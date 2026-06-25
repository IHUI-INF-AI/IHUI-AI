# 归档: 2026-06-25 G 盘根目录调查脚本

本目录归档 2026-06-25 调查 G 盘根目录 (G:\\1, G:\\dev, G:\\tmp, G:\\Users) 来源时使用的一次性脚本。

## 文件清单

| 文件 | 用途 | 状态 |
|------|------|------|
| `_investigate_g_users.py` | 调查 G:\\Users 目录内容 | 已完成, 归档 |
| `_investigate_g_users_deep.py` | 深度调查 G:\\Users\\Administrator 内容 | 已完成, 归档 |
| `_cleanup_g_users_dir.py` | 递归删除 G:\\Users 空目录链 + 验证 G 盘根状态 | 已完成, 归档 |

## 调查背景

2026-06-25 接到用户报告 G 盘根目录自动创建了以下目录:
- `G:\\1\\pw-output` (由 `test_e2e_login.py` 硬编码 OUT_DIR 误创建)
- `G:\\dev\\stdout` (SCSS 编译临时输出)
- `G:\\tmp\\ro.css` (SCSS 编译临时输出)
- `G:\\tmp\\refund_evidence` (refund_evidence_dir 默认值误指向 G:\\tmp)
- `G:\\Users\\Administrator\\AppData\\Local\\Temp` (`rewrite_edu_models.py` 误存)

## 根本原因

Linux/macOS 风格的绝对路径 (如 `/tmp`, `/Users`) 在 Windows 上被解释为相对于当前盘符 (G:\\) 的路径。

## 修复方案

1. **配置层**: `app/config.py` 中 `model_post_init` 在环境变量为空字符串时 fallback 到 `tempfile.gettempdir()`
2. **代码层**: 平台感知路径 (os.name == "nt" 用 %TEMP%, 否则用 /var/...)
3. **CI 层**: `server/tests/test_path_hygiene.py` 6 个测试, GitHub Actions `path-hygiene` job
4. **扫描器**: `server/scripts/_scan_hardcoded_g_drive_paths.py` 持续扫描

## 持续维护的工具 (不在此归档, 仍可使用)

- `server/scripts/_scan_hardcoded_g_drive_paths.py` - 路径扫描主工具
- `server/scripts/_scan_client_hardcoded_paths.py` - client 子项目扫描
- `server/scripts/_delete_g_drive_artifacts.ps1` - 清理 G 盘根目录
- `server/scripts/_delete_empty_g_drive_dirs.ps1` - 清理空目录
- `server/scripts/_verify_e2e_login_outdir.py` - 验证 OUT_DIR
- `server/scripts/_health_check.py` - 后端健康检查
- `server/tests/test_path_hygiene.py` - pytest 路径卫生测试
- `server/tests/_e2e_full_verification.py` - e2e 完整验证
- `server/tests/_final_path_verification.py` - 最终路径验证
- `server/tests/_verify_outdir_no_g_drive.py` - OUT_DIR 不在 G 盘根

## 归档原因

这些调查脚本是一次性使用, 它们的使命已完成:
- `G:\\Users` 已被清空并删除
- 根因已修复
- 持续维护的工具已建立

如果未来再次出现类似 G 盘根目录污染, 应:
1. 在 `server/archive/_investigation_<日期>/` 下创建新的归档目录
2. 用 git mv 移动临时调查脚本到此目录
3. 更新 `docs/INCIDENTS.md` 附录的工具清单

## 注意事项

- `.gitignore` 已添加规则, 防止 `_investigate_*.py` / `_cleanup_*.py` 误入主目录
- 这些归档脚本不应再次运行, 仅供历史参考

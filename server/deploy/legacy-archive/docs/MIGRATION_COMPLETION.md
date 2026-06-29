# 历史文件补迁完成清单

> 本文档记录向 `server/deploy/legacy-archive/` 补迁历史项目存档文件的操作。
> 所有补迁均保持源文件原始内容（二进制文件按字节复制）。

## 补迁时间

- 2026-06-28（Asia/Shanghai）

## 补迁文件清单

### 1. SQL 脚本

| 目标路径 | 源路径 | 类型 | 说明 |
| --- | --- | --- | --- |
| `server/deploy/legacy-archive/sql/fix_user_id1.sql` | `H:\历史项目存档\edu client\scripts\fix_user_id1.sql` | 文本 | 修复 `t_user` 表缺少 id=1 管理员用户导致的 UserCenterFeignClient 500 错误 |

### 2. 文档

| 目标路径 | 源路径 | 类型 | 说明 |
| --- | --- | --- | --- |
| `server/deploy/legacy-archive/docs/API接口文档.md` | `H:\历史项目存档\ljd-交接文件\ZHS_Server_java\API接口文档.md` | 文本 | ZHS 平台 API 接口文档（Markdown） |
| `server/deploy/legacy-archive/docs/API接口文档.txt` | `H:\历史项目存档\ljd-交接文件\ZHS_Server_java\API接口文档.txt` | 文本 | ZHS 平台 API 接口文档（纯文本，与 .md 内容一致） |

### 3. 密钥/配置归档（secrets）

| 目标路径 | 源路径 | 类型 | 说明 |
| --- | --- | --- | --- |
| `server/deploy/legacy-archive/secrets/server_configs.zip` | `H:\历史项目存档\code\ljd-交接文件\server_configs.zip` | 二进制 | 服务端配置压缩包 |
| `server/deploy/legacy-archive/secrets/edu_service.zip` | `H:\历史项目存档\edu server\edu service.zip` | 二进制 | edu service 压缩包 |

> 备注：任务原始描述中 `server_configs.zip` 的源路径为 `H:\历史项目存档\ljd-交接文件\server_configs.zip`，实际不存在；经全盘搜索定位到 `H:\历史项目存档\code\ljd-交接文件\server_configs.zip` 并以此为准完成补迁。

## 关联文档修正

- `g:\IHUI-AI\README.md` 第 368 行：将 `API接口文档.md` 的悬空引用修正为指向实际路径 `server/deploy/legacy-archive/docs/API接口文档.md`。

## 验证

补迁完成后可通过以下命令核对归档结构：

```powershell
cd g:\IHUI-AI
Get-ChildItem -Recurse server\deploy\legacy-archive | Select-Object FullName
```

预期新增文件：

- `server\deploy\legacy-archive\sql\fix_user_id1.sql`
- `server\deploy\legacy-archive\docs\API接口文档.md`
- `server\deploy\legacy-archive\docs\API接口文档.txt`
- `server\deploy\legacy-archive\docs\MIGRATION_COMPLETION.md`（本文档）
- `server\deploy\legacy-archive\secrets\server_configs.zip`
- `server\deploy\legacy-archive\secrets\edu_service.zip`

## 约束

- 本次操作仅做文件补迁与文档引用修正，未修改任何已有业务代码。
- secrets 目录下的 zip 文件为敏感配置归档，仅供追溯，不应纳入运行时加载路径。

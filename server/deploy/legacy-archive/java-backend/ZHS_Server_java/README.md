# ZHS_Server_java Java 后端源码归档

## 来源
- 源路径：`H:\历史项目存档\ljd-交接文件\ZHS_Server_java\`
- 归档时间：2026-06-28（Round 34）
- 归档原因：ZHS 平台 AI 服务与教育平台 Java 后端完整源码，是 IHUI-AI Python 后端的前身实现，业务逻辑迁移参考价值极高

## 文件清单（404 个）
### 结构
- `src/main/java/com/ai/manager/` - Java 源码（五大模块）
  - `app/` - 应用模块
  - `core/` - 核心模块
  - `course/` - 课程模块
  - `mcp/` - MCP 模块
  - `small/` - 小程序模块
  - 含 Controller/Service/Mapper/WebSocket 等完整层级
- `pom.xml` - Maven 依赖配置
- `README.md` - 项目说明

## 与新项目的关系
新项目 `g:\IHUI-AI\server\` 已用 Python FastAPI 重写后端。
本归档为 Java 原始实现，业务逻辑迁移参考用（如遇 Python 实现逻辑不清时可回溯 Java 版本）。
新项目代码不引用此 Java 源码。

## 价值
- 业务逻辑追溯：当 Python 实现的某些业务逻辑需要验证时，可参考 Java 原版
- 历史演进记录：记录从 Java → Python 的技术栈迁移过程
- 接口契约对照：Java Controller 的 @RequestMapping 可与 Python router 对比

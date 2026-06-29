# coze 技术文档归档

## 来源
- 源路径：`H:\历史项目存档\ljd-交接文件\coze_zhs_py\docs\`
- 归档时间：2026-06-28（Round 33）
- 归档原因：历史项目 coze_zhs_py 的技术文档，封存追溯用

## 文件清单（6 个）
- `agent_category_optimization.md` - agent 分类优化设计文档
- `deduct_user_token_call_sites.md` - deduct_user_token 调用点分析
- `langchain_api.md` - LangChain API 文档
- `langchain_api_interface.md` - LangChain API 接口文档
- `langchain_api_接口说明.md` - LangChain API 接口说明（中文）
- `public_socket_api.md` - 公开 Socket API 文档

## 与新项目的关系
新项目 `g:\IHUI-AI\server` 已重写实现，这些文档仅作历史设计追溯用。
新项目相关功能见：
- agent 业务：`app/api/v1/agents/` 目录
- WebSocket：`app/ws/` 目录
- LangChain 集成：新项目无 langchain_api 模块（历史项目 langchain_api.py 大版本仅迁移了 mini 版）

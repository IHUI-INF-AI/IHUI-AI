# 贡献指南

> 感谢你对 IHUI-AI 的兴趣!这个文档将帮助你快速参与项目共建。

## 🚀 快速开始

### 环境要求

- Node.js ≥ 20
- pnpm ≥ 9
- Python ≥ 3.11(仅 ai-service)
- PostgreSQL ≥ 15(可选,开发用 SQLite)
- Redis ≥ 7(可选)

### 本地启动

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
pnpm install
pnpm dev
```

打开 http://localhost:3000 即可使用。

## 🤝 参与方式

### 1. 提交 Bug 报告

[新建 Issue](https://github.com/IHUI-INF-AI/IHUI-AI/issues/new?labels=bug) 时请包含:

- 复现步骤
- 期望行为 vs 实际行为
- 环境(浏览器/Node 版本/操作系统)
- 截图(如适用)

### 2. 提交功能建议

[新建 Issue](https://github.com/IHUI-INF-AI/IHUI-AI/issues/new?labels=enhancement) 时请说明:

- 使用场景
- 期望的解决方案
- 是否有替代方案

### 3. 提交代码

1. Fork 仓库
2. 创建分支:`git checkout -b feat/your-feature`
3. 提交改动:`git commit -m "feat: 描述"`
4. 推送:`git push origin feat/your-feature`
5. 创建 PR

### 4. 文档与翻译

- 改进文档表述
- 翻译到英/日/韩/繁体中文
- 校对技术准确性

## 📋 代码规范

### TypeScript / React

- 用 TypeScript 严格模式
- 用函数组件 + Hooks
- 复用 `packages/ui-react` 的组件
- 每个页面 < 250 行
- 用 `Intl.DateTimeFormat` 处理时间

### Python(ai-service)

- 用类型注解
- 用 Pydantic 校验输入
- 遵循 PEP 8

### Commit 规范

用 [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档
- `refactor:` 重构
- `test:` 测试
- `chore:` 杂项

## 🛡️ 项目守门

本项目有 30+ 个 pre-commit 守门钩子,提交前会自动检查:

- API key 泄露
- i18n 键完整性
- 圆角违规(禁用 rounded-full)
- 多端同步
- 等等

如果 hook 失败,请按提示修复。不要用 `--no-verify` 跳过(除非是其他 agent 的代码问题)。

## 🌍 i18n 贡献

支持 5 种语言:简体中文 / English / 日本語 / 한국어 / 繁體中文。

基准语言是 `zh-CN.json`,其他语言必须保持 key 集合一致。

详见 [docs/i18n-guide.md](docs/i18n-guide.md)(如不存在,参考 `scripts/scan-i18n-zh-residue.mjs` 的实现)。

## 💬 社区

- [GitHub Discussions](https://github.com/IHUI-INF-AI/IHUI-AI/discussions) - 技术讨论
- [GitHub Issues](https://github.com/IHUI-INF-AI/IHUI-AI/issues) - Bug 与功能建议
- 邮箱:502319984@qq.com
- 微信:ok502319984

## 📜 行为准则

- 尊重每一位贡献者
- 用事实和数据说话
- 对新手友好
- 不接受任何形式的歧视

## 🏆 贡献者福利

- 你的名字会出现在 README 致谢区
- 首个被合并 PR 的外部贡献者会写入"我们的故事"章节
- 活跃贡献者可加入核心团队

## 📄 License

贡献的代码将遵循 [Apache License 2.0](LICENSE)。

---

**每一个 PR 都让这个项目更近一步。感谢你的贡献!**

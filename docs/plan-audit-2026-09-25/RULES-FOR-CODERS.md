<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 派单通用约束(编码代理必读,违反即交付作废)

## 你是谁 / 交付形态

你在 `G:\IHUI-AI`(pnpm monorepo + Turborepo,8 端)实现一张已立项的功能票。**你只写代码,不碰 git**:主代理统一用 `scripts/safe-commit.mjs` 提交。

- 禁止任何 git **写**操作:`add` / `commit` / `stash` / `reset` / `checkout` / `restore` / `gc` / `push` / `fetch`。只读命令(`status` / `show HEAD:<path>` / `ls-tree` / `grep`)允许。
- 禁止修改 `PROJECT_PLAN.md`、`AGENTS.md`、`README.md`(主代理单写)。
- 禁止再派子代理。

## 开工前必做(单写者检查)

本仓是**多会话共享同一个工作树**,他人的在途改动就躺在磁盘上。所以:

1. 先跑 `git -c safe.directory=* status --porcelain -- <你的每一个目标文件>`。
   **输出非空 ⇒ 该文件正被他人编辑,立即停止并在报告里说明,不得写。**
2. 判"仓库现状"一律用 HEAD(`git show HEAD:<path>` / `git ls-tree -r --name-only HEAD`),**不要**按磁盘内容下结论 —— 磁盘可能是别人的半成品或滞后版本。
3. 你的改动范围 = 任务书"受影响文件"清单,**逐字**遵守。清单外的文件一律不得改;确需改邻居文件时,停下来在报告里提出,不要自作主张。

## 仓库硬规矩(与本任务直接相关的几条)

- **共享层优先**:跨端可复用的逻辑沉 `packages/{shared,app,ui-react,types,design-tokens}`;端内只做 re-export + 平台 adapter。禁止在 `apps/*` 重实现 `packages/*` 已有能力。
- **禁 `any`**:`@typescript-eslint/no-explicit-any: error`。要用 `unknown` + 类型守卫;确属例外必须写 `// FIXME(any): 原因 + 移除计划 + 截止版本`。
- **新源码文件必须加水印**:每新建一个 git 跟踪的源文件,立刻跑
  `node scripts/watermark.mjs inject <该文件>`(pre-commit 门禁会验载荷,漏了会让别人提交被拦)。
- **圆角单一源头**:`borderRadius: rnRadius.lg`(RN/内联)、`var(--radius-lg)`(CSS),禁止数字字面量与 `rounded-[任意值]`(守门 77 blocking)。
- **品牌 CTA 成对**:主按钮实底 `brand.cta` + 文字 `brand.ctaForeground`;类名侧 `--color-cta` / `--color-cta-foreground`。禁止自造 `ctaFill`/`ctaText`(守门 83)。
- **图标一律矢量库**:web 用 `lucide-react`,RN 用 `lucide-react-native`,小程序用 `apps/miniapp-taro/src/static/images/icons/*.svg`。**禁止 emoji 充当图标**,禁止用字符 `›`/`»`/`>` 当箭头(守门 102)。
- **禁止分割线** `<hr>` / `divide-y` / 单边 `border-t` 当分隔;禁止 `mask-image`/`linear-gradient` 遮罩;禁止 `alert/confirm/prompt` 与 `title` 属性,提示用项目 `Tooltip`。
- **i18n**:任何用户可见文案都要进 `packages/i18n/messages/<端>/<locale>.json`,**五语齐全**(zh-CN/zh-TW/en/ja/ko),走既有键命名空间,不得硬编码中文(守门 70 棘轮)。新增键后按 `node scripts/i18n-diff.mjs` → 翻译 → `node scripts/i18n-apply.mjs` → `node scripts/check-i18n-keys.mjs` 校验 parity。
- **禁止"造好没装车"**:新增组件/hook/帧/表必须有真实生产消费点(import 且渲染/注册/读写),并且**用一条测试或一次运行证明它被消费**。只写组件+自身测试 = 交付未完成。
- **不得为过门而放宽判据**(改守门脚本时尤其)。

## 验证(交付前必须全跑并把输出贴进报告)

按你的票所属端选跑:

```
pnpm --filter @ihui/<pkg> typecheck
pnpm --filter @ihui/<pkg> test          # 或 node --test <具体测试文件>
node scripts/watermark.mjs verify        # 新建文件后
```

Python 侧(本机无 PG/Redis 端口在听,禁止连生产库):

```
cd apps/ai-service && .venv/Scripts/python -m pytest tests/<你的测试> -q
cd apps/ai-service && .venv/Scripts/python -m mypy app/<改动文件> --ignore-missing-imports
```

- 报"通过"必须附**命令 + 末行输出原文**。跑不了要写明"未跑 + 原因",禁止用"应该可以"冒充实测。
- 若他人的既有失败混进输出,单独区分"我的文件 0 错 / 他人既有红",并给出你据以区分的命令。

## 收尾自检

`git status --porcelain` 逐行核对:**出现清单外的路径 ⇒ 立即在报告置顶声明越界**,不要自行回滚他人文件。

## 步数与报告

- 工具调用上限 **60 次**。接近上限立即收尾:能做完的做完,做不完的在报告里写"已完成 X / 剩余 Y / 卡在 Z",**禁止把半截写成已完成**。
- 报告写进任务书指定的 `report-*.md`,并在最终回复里给我 ≤15 行摘要:改了什么 / 装车点在哪 / 验证输出末行 / 剩余缺口。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

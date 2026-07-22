# Visual Regression Tests

**作用**:对比页面截图 + 读 DOM 数值,防止 UI 改动回归 / 样式未生效 / 4 状态错乱。

## 工作流

```bash
# 1. 确保 web(3000) + api(8802) + ai-service(8803) 三个服务在线
curl -sI http://localhost:3000 | head -1   # → HTTP/1.1 200
curl -sI http://localhost:8802/api/health  # → HTTP/1.1 200
curl -sI http://localhost:8803/health      # → HTTP/1.1 200

# 2. 跑单个 spec(如 4 状态自验)
cd apps/web
$env:PLAYWRIGHT_REUSE_SERVER='1'
npx playwright test tests/visual/login-dialog-verify.spec.ts \
  --config=playwright.visual.config.ts --reporter=line

# 3. 跑全套 visual 回归
npx playwright test --config=playwright.visual.config.ts --reporter=line
```

## 当前套件清单

| spec                            | 场景                | 4 状态                                           |
| ------------------------------- | ------------------- | ------------------------------------------------ |
| `login-dialog-verify.spec.ts`   | AI 登录框视觉/结构  | ✅ default / hover / active / dark               |
| `model-selector.spec.ts`        | 模型选择器下拉菜单  | ✅ default / hover / active / dark               |
| `prompt-templates.spec.ts`      | AI 对话框提示词模板 | ✅ default / hover / popover / empty / dark      |
| `sidebar-height-verify.spec.ts` | 侧边栏按钮高度统一  | ✅ default                                       |
| `sidebar-history.spec.ts`       | 侧边栏历史对话      | ✅ default / hover / active / active 切换 / dark |

## 强制自验规则(2026-07-19 升级)

任何**UI 样式 / 前端组件 / Tailwind 类 / shadcn props** 的改动,**交付前**必须按以下流程自验:

1. **改码前**:`browser subagent ping http://localhost:3000` 确认服务在线,不通则先启动 web + api + ai-service + 数据库/Redis
2. **改码后**:实际访问 `localhost:3000` 确认页面渲染(不是假设)
3. **强制 4 状态截图**:default / hover / active / dark
4. **读 DOM 数值**:用 `getAttribute` / `getComputedStyle` 验证 Tailwind 类已应用(禁止只靠主观截图)
5. **交付回复**附 4 状态截图证据 + "已自验通过"声明
6. **服务起不来或工具故障**禁止交付,先解决环境或告知用户

## 工具故障应急

RunCommand 连续 2 次返回 `{Exited, exit_code 0, 空输出}` → 工具失联 → 切换 `Start-Process` 派生独立 powershell 窗口 → 仍失败 → 立即告知用户工具故障 + 提供手动命令清单。

## 已知约束 / 经验

- **Hydration Mismatch 防护**:登录框自验要监听 `console errors` 数组,任何 `hydration-mismatch` 出现立即停手
- **Tooltip 漂移**:Radix UI `TooltipPrimitive.Trigger` 内部 useId 在桌面/移动两个 aside 树间会漂移 → 通过 `React.cloneElement` 给子元素加 `suppressHydrationWarning` 根除
- **主题切换**:通过 `localStorage.setItem('theme', 'dark')` + `document.documentElement.classList.add('dark')` 强制切换,等 React tree 重渲染后再截图
- **登录框触发**:访问 `/oauth/authorize?client_id=test` 触发 `LoginDialog` 自动弹窗
- **截图保存路径**:`tmp/prompt-templates-shots/` / `tmp/login-dialog-shots/` 等(测试代码里写死)

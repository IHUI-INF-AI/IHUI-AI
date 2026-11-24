<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 302p 跨端漂移门剩余三维红的逐处证据清单（2026-11-24）

## 目的与边界

push 面 `check-cross-end-parity-drift.mjs --gate --push` 仍判 `STATE=regressed`，三维来自他席在飞的样式改动：

| 维度 | 基线 | HEAD 现读 | 增量 |
|---|---|---|---|
| tierWebOffN（web 端非档/异档用量） | 227 | 228 | +1 |
| tierPending（待裁分叉允许差异行） | 21 | 23 | +2 |
| mpTierLiteral（小程序裸字面量位置数） | 406 | 409 | +3 |

**本清单只出证据、不改动生产代码、不刷新基线**。三维输入面在基线→HEAD 间 diff 巨大（web 561 文件 / RN 303 / 小程序 99，475 提交），逐提交翻查不现实；改用基线 why 里同款「同一把尺在 detached 检出复现」论证法，精确定位到逐 file:line 与引入提交，交跨端对齐线 owner 收口。

## 方法论（可复现）

1. 基线终尖 `c11051f8`（基线 generatedAt 2026-11-22T14:49Z），HEAD `fd10ba82`。
2. `git worktree add --detach <tmp> c11051f8`，把**当前**的 `check-web-rn-style-tiers.mjs` / `check-miniapp-style-tiers.mjs` + `scripts/lib/*` 复制进检出（同一把尺，不用旧版脚本），两树各跑 `--json` + 文本输出。
3. 读数完全对上判据：web `text=9px` 91→93、`py=1px` 38→37；RN `paddingHorizontal=18` 0→1、`paddingLeft=38` 0→1；小程序 literal 406→409。
4. 复用 `face-reader` 取材 + 判据同款正则写逐处探针，输出每个命中的 `file:line:值`，两树各跑一次，按**内容指纹** diff（不是行号——行号漂移会产生大量假增删），锁定真正新增/删除的处。
5. 每处用 `git log -S <内容串> <基线>..HEAD -- <file>` 找引入提交。

## 逐维证据

### 1. tierWebOffN 227→228（净 +1）

web 侧分桶：`text=9px` ×91→×93（+2 fork），`py=1px` ×38→×37（-1 missingTier）⇒ 净 +1。

- **+2 处 fork**：`apps/web/src/components/sidebar-chat-history.tsx:991`、`:997`
  `className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-primary/10 px-1 text-[9px] leading-4 text-muted-foreground"`
  另 `:1005` 同类 `text-[9px]`（`...text-primary`）。三处均 `text-[9px]`，其中两处为本次净增（判据按 prop×value 累加，不区分具体行）。
  引入提交：`c19e006b feat(chat): 三端会话统一入库并标注录入端`。
- **-1 处 missingTier**：`apps/web/src/components/chat/model-selector.tsx` 一处 `py-px` 消失（行号从 629/641/653 区间重排），属**好转**，一并记录以解释净 +1。

出路（门点名）：`node scripts/check-web-rn-style-tiers.mjs --json` 看 `web` 分桶 → `node scripts/land-web-style-tiers.mjs` 预演；根治=档表补 9px 档或统一 token（跨端对齐线长期票）。该值属档表缺位值，在判定体系内合法登记、非未登记回归，门仅按终尖数值拦差。

### 2. tierPending 21→23（+2）

RN 待决策 Top 新增两族，各 1 处：

- `apps/mobile-rn/src/screens/ProfileAllFunctionsScreen.tsx:262` → `paddingLeft: 38,`
  引入提交：`b6f82f9c feat(mobile-rn): 我的页视觉精修并统一功能中心卡片层级`。
- `packages/app/src/components/ScreenStates.tsx:306` → `paddingHorizontal: 18,`
  引入提交：`c6943ef4 fix(scripts): 活文档门 grep 分批 + web 工具类闭包自检 + 三端 stateBtn 同脸`。

两值均为 RN fork 表新增（rnForkValues 新增 38），未进 `styleTier:spacing:<prop>:<value>` 允许差异登记 ⇒ 记 pending。

出路（门点名）：`node scripts/check-web-rn-style-tiers.mjs --json` 的 `forkAllowance.pendingTop` → `node scripts/decide-style-tier-forks.mjs --check` 逐族裁决 → `node scripts/apply-cross-end-verdicts.mjs --proposals=<裁决件>`（该器当前零调度，需按 §11 派单）。根治=38/18 落回 6/8/16/20 等档或补档。

### 3. mpTierLiteral 406→409（+3）

- `apps/miniapp-taro/src/components/LikeFavoriteShare.tsx:37`、`:58`、`:79`
  `style={{ width: '80rpx', minHeight: '80rpx' }}`
  同一处 `style` 对象由原先单个 rpx 字面量扩展为 `width` + `minHeight` 两个裸 rpx 字面量，**×3 处 ⇒ +3**。
  引入提交：`35c2c24e fix(mobile): 纯图标按钮补无障碍名称与 40dp 命中盒，修 rn-compat 两处静默失效`。
  判据 samples 亦命中 `width: 96rpx → 48px / height: 96rpx → 48px` 同族。
  注意：同区间 `FloatBox.tsx` 有 -3 处 `marginBottom=6rpx` 减少（defaulted 375→373 好转），但 literal 口径仍净 +3。

出路（门点名）：`node scripts/check-miniapp-style-tiers.mjs --json`（literal/defaulted/projectPct）+ `node scripts/land-miniapp-style-tiers.mjs` 预演；samples 给出 `hittable` 子集（80rpx=40px 命中 spacing 档 40），可等值落档、像素零变化。

## 复现命令

```
# 现读（HEAD 面）
node scripts/check-web-rn-style-tiers.mjs --json
node scripts/check-miniapp-style-tiers.mjs --json
node scripts/check-cross-end-parity-drift.mjs --gate --push    # STATE + 三维

# 基线对比（同一把尺）
git worktree add --detach <tmp> c11051f8
cp scripts/check-web-rn-style-tiers.mjs scripts/check-miniapp-style-tiers.mjs <tmp>/scripts/
cp -r scripts/lib/. <tmp>/scripts/lib/
node <tmp>/scripts/check-web-rn-style-tiers.mjs --json
node <tmp>/scripts/check-miniapp-style-tiers.mjs --json
git worktree remove --force <tmp> && git worktree prune
```

## 诚实边界

- 三维均为**存量在他席提交中累积**，非本席引入；本清单不判定「该不该红」，只给 owner 收口所需的最小证据面。
- 未做裁决、未改档表、未改登记账、未刷基线；按 ratchet 纪律，真实治理（落档/补档/登记/裁决）仍属跨端对齐线 owner。
- 逐处探针按内容指纹 diff，同一 prop×value 多处只按净增减计；`text-[9px]` 三处的具体「哪两处算新增」以净 +2 为准，不逐行认领。


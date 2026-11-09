<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 174 道 pending 门只读体检清单（2026-11-08）

> 依据：[`gate-stock-red-blocks-cut9.md`](./gate-stock-red-blocks-cut9.md) 的「174 道 pending」入口。
> 本轮**只出清单，不改任何门 / 脚本 / 注册表**；按用户授权，未运行任何门或测试。
> 证据方式：静态读 `scripts/guardian-runner.mjs` 注册项 + 对应脚本的判据/退出实现；所有证据行号已校验落在文件范围内（174/174）。

## 0. 对账与结论

| 维度 | 计数 |
| --- | --- |
| 总数（去重后逐 id 一条） | **174** |
| 真判据（保留） | **145** |
| 判据过时需改 | **29** |
| 僵尸门（建议删） | **0** |
| 判据面建议：delta | **144** |
| 判据面建议：stock | **27** |
| 判据面建议：refs | **3** |

- **硬标准下没有僵尸门**：174 道均至少有一条非零失败出口（exit 1/2 或等价），不存在"无红口"脚本。
- **两项准僵尸已归入"需改"而不是删门**：170（干净检出恒 undetermined→exit 0）、105（L1/G3 维度源集恒空/永不判红）。
- 29 项"需改"集中在四类：①旧扫描根/死维度（17、91、105）；②触发面缺口（260）；③fail-open（170）；④staged 触发但正文读工作树/严重级别与注册不一致（11b、38、20、27、34、2g-web，以及 18 道 locale 残留门）。
- 判据面按"脚本取材实现"给建议；票内三选一仍需人工确认。大多数"stock"是**读工作树即其判据本体**（177/78/10 等），不是漏判。

## 1. 逐门清单（按注册行排序）

| id | 注册证据 | 判据实现证据 | 判据面 | 健康档 | 现状定性 | 依据 / 改法 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | scripts/guardian-runner.mjs:53 | check-api-key-leak.mjs:103 | delta | 真判据（保留） | API key 泄露扫描 | 103 isRealKey；被审面索引，exit1:175 |
| 2 | scripts/guardian-runner.mjs:61 | check-i18n-keys.mjs:1885 | delta | 真判据（保留） | i18n 键完整性(web) | 1885 判绿阻断；1922 exit1；409 索引面 |
| 2b | scripts/guardian-runner.mjs:74 | scan-i18n-zh-residue.mjs:186/521 | stock | 判据过时需改 | 工作树 zh-TW web 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2c | scripts/guardian-runner.mjs:82 | scan-i18n-zh-residue.mjs:209/521 | stock | 判据过时需改 | 工作树 ko web 中文残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2e | scripts/guardian-runner.mjs:90 | check-i18n-broken-en.mjs:255 | delta | 真判据（保留） | en.json 破碎英文(web) | 255 main；违规 return1:276 |
| 2f-web | scripts/guardian-runner.mjs:118 | i18n-diff.mjs:245/581 | delta | 真判据（保留） | 索引 blob 判 web 词条齐 | 旧 onFailHint 仅文案；exit@581 |
| 2f-miniapp-taro | scripts/guardian-runner.mjs:136 | i18n-diff.mjs:245/581 | delta | 真判据（保留） | 索引 blob 判小程序词条 | target=miniapp-taro；exit@581 |
| 2g-web | scripts/guardian-runner.mjs:155 | scripts/check-i18n-namespace-passing.mjs:250 | delta | 判据过时需改 | 命名空间传递可拦新增 | 头注称 warn 不阻塞但注册 blocking；staged 选文件后读工作树，应改 :path |
| 6 | scripts/guardian-runner.mjs:205 | check-sanitizer-bypass.mjs:86/178 | delta | 真判据（保留） | 索引面判清洗旁路 | 路由目录存在；exit1/2 |
| 7 | scripts/guardian-runner.mjs:213 | check-dedupe.mjs:116 | delta | 真判据（保留） | 依赖碎片化去重 | 116 decide；dedupe-stock.json 在位 |
| 8 | scripts/guardian-runner.mjs:221 | check-api-routes.mjs:2564 | delta | 真判据（保留） | 前后端路由一致性 | 索引面枚举；假设裁决表兜底；exit1:2564 |
| 11 | scripts/guardian-runner.mjs:229 | check-rounded-full.mjs:657/831 | delta | 真判据（保留） | 索引面判容器圆角语义 | C1/C2 双相，staged 新增行，exit1@831；豁免 apps/web/public/vs 已消失（死豁免，无害） |
| 11b | scripts/guardian-runner.mjs:237 | check-rounded-overflow.mjs:389/448 | stock | 判据过时需改 | staged 触发，正文读工作树 | staged 新增行 + 正文读工作树；改读索引 blob，避免行号错位 |
| 11d | scripts/guardian-runner.mjs:259 | scripts/check-no-divider.mjs:1243 | delta | 真判据（保留） | divide-y/x 零容忍 | selectFace；violations return1 |
| 11h | scripts/guardian-runner.mjs:267 | scripts/check-no-emoji-icons.mjs:853 | delta | 真判据（保留） | 图标位 emoji 拦截 | 多端射程在；return1 |
| 11e | scripts/guardian-runner.mjs:275 | check-file-size.mjs:233 | delta | 真判据（保留） | 单文件行数上限(仅新增) | 233 exit1；范围 apps/ src，与 trig 一致 |
| 11f | scripts/guardian-runner.mjs:283 | scripts/check-no-native-dialog.mjs:173 | delta | 真判据（保留） | 原生弹窗只拦新增 | 原生对话框零容忍；豁免 apps/web/public/vs 已消失（死豁免，无害） |
| 11g | scripts/guardian-runner.mjs:291 | scripts/check-no-mask-image.mjs:213 | delta | 真判据（保留） | mask-image 零容忍 | 索引面取材；return1 |
| 12 | scripts/guardian-runner.mjs:299 | check-delivery-report-consistency.mjs:189 | delta | 真判据（保留） | 交付报告一致性 | 189 checkSection；违规 exit1:393 |
| 15 | scripts/guardian-runner.mjs:309 | check-api-migration-completeness.mjs:549 | delta | 真判据（保留） | 迁移完整性一次性核账 | 186-219 报告经退役 tag 取证；staged 已收窄 |
| 17 | scripts/guardian-runner.mjs:317 | scripts/check-input-border-var.mjs:129 | delta | 判据过时需改 | 扫描根 packages/ui 已消失 | 改 packages/ui/src→packages/ui-react/src；staged 改读索引 blob |
| 18 | scripts/guardian-runner.mjs:329 | scripts/check-native-title-tooltip.mjs:476 | delta | 真判据（保留） | 全量只报数 staged 拦新增 | staged exit1；全量 exit0 是设计 |
| 20 | scripts/guardian-runner.mjs:337 | check-tailwind-class-conflict.mjs:231/377 | stock | 判据过时需改 | staged 触发，正文读工作树 | staged 新增行 + 正文读工作树；改读索引 blob |
| 24a | scripts/guardian-runner.mjs:345 | check-sidebar-width-consistency.mjs:252/703 | delta | 真判据（保留） | 索引面侧栏宽度一致性 | 2026-11-07 已改索引面；exit1 |
| 25 | scripts/guardian-runner.mjs:355 | check-workspace-hygiene.mjs:206/416 | delta | 真判据（保留） | 索引面项目外路径违规 | 全量含 .ihui-agent/tmp；exit@416 |
| 27 | scripts/guardian-runner.mjs:378 | check-z-index-guard.mjs:283/459 | stock | 判据过时需改 | staged 触发，正文读工作树 | staged 触发 + 正文读工作树；改读 5 个面文件索引 blob |
| 29 | scripts/guardian-runner.mjs:424 | scripts/check-push-sync.mjs:398 | refs | 真判据（保留） | 本地 HEAD vs origin refs | ls-remote 现读；ahead/behind exit1 |
| 30 | scripts/guardian-runner.mjs:446 | validate-i18n-integrity.mjs:219/411 | delta | 真判据（保留） | staged 对 HEAD 行数完整性 | 缺 blob 回退工作树；exit@411 |
| 30c | scripts/guardian-runner.mjs:495 | check-stale-copy.mjs:292/364 | delta | 真判据（保留） | staged 副本对比 refs 历史 | 索引+refs 同判；exit1@364 |
| 35 | scripts/guardian-runner.mjs:574 | scripts/check-mypy.mjs:814 | delta | 真判据（保留） | mypy 索引面 0 errors | selectFace+物化；errors return1，缺工具 exit2 |
| 36 | scripts/guardian-runner.mjs:590 | scripts/check-miniapp-tokens-sync.mjs:333 | delta | 真判据（保留） | tokens 同步防 app.css 漂移 | 写回侧已迁 scripts/sync-miniapp-tokens.mjs；旧端内路径仅历史注释 |
| 38 | scripts/guardian-runner.mjs:633 | check-solito-residue.mjs:279/351 | stock | 判据过时需改 | staged 触发，正文读工作树 | staged 触发 + 正文读工作树；改读 5 个 package.json 索引 blob |
| 39 | scripts/guardian-runner.mjs:664 | scripts/check-rn-app-migration.mjs:630 | delta | 真判据（保留） | RN 屏独立实现回升 | screens/packages/app 在；return1 |
| 2d | scripts/guardian-runner.mjs:730 | scan-i18n-zh-residue.mjs:306/521 | stock | 判据过时需改 | 工作树 ja web 简体残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2o-shared | scripts/guardian-runner.mjs:745 | scan-i18n-zh-residue.mjs:306/521 | stock | 判据过时需改 | 工作树 shared ja 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2o-miniapp-taro | scripts/guardian-runner.mjs:753 | scan-i18n-zh-residue.mjs:306/521 | stock | 判据过时需改 | 工作树 miniapp ja 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2o-mobile-rn | scripts/guardian-runner.mjs:761 | scan-i18n-zh-residue.mjs:306/521 | stock | 判据过时需改 | 工作树 mobile ja 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2f-ext | scripts/guardian-runner.mjs:769 | check-i18n-keys.mjs:1885 | delta | 真判据（保留） | i18n 键完整性(ext) | 同一判据；目标 extension；索引面 |
| 2f-shared | scripts/guardian-runner.mjs:777 | check-i18n-keys.mjs:1885 | delta | 真判据（保留） | i18n 键完整性(shared) | 同一判据；目标 shared；索引面 |
| 2g-ext | scripts/guardian-runner.mjs:785 | scan-i18n-zh-residue.mjs:186/521 | stock | 判据过时需改 | 工作树 ext zh-TW 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2h-ext | scripts/guardian-runner.mjs:793 | scan-i18n-zh-residue.mjs:209/521 | stock | 判据过时需改 | 工作树 ext ko 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2i-ext | scripts/guardian-runner.mjs:801 | check-i18n-broken-en.mjs:255 | delta | 真判据（保留） | en 破碎英文(extension) | 同一判据；327 return1；索引面 |
| 2j-shared | scripts/guardian-runner.mjs:812 | scan-i18n-zh-residue.mjs:186/521 | stock | 判据过时需改 | 工作树 shared zh-TW 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2p-api | scripts/guardian-runner.mjs:821 | scan-i18n-zh-residue.mjs:186/521 | stock | 判据过时需改 | 工作树 api zh-TW 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2q-cli | scripts/guardian-runner.mjs:829 | scan-i18n-zh-residue.mjs:186/521 | stock | 判据过时需改 | 工作树 cli zh-TW 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2r-miniapp-taro | scripts/guardian-runner.mjs:837 | scan-i18n-zh-residue.mjs:186/521 | stock | 判据过时需改 | 工作树 miniapp zh-TW 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2s-mobile-rn | scripts/guardian-runner.mjs:845 | scan-i18n-zh-residue.mjs:186/521 | stock | 判据过时需改 | 工作树 mobile zh-TW 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2t-api | scripts/guardian-runner.mjs:853 | scan-i18n-zh-residue.mjs:209/521 | stock | 判据过时需改 | 工作树 api ko 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2u-cli | scripts/guardian-runner.mjs:861 | scan-i18n-zh-residue.mjs:209/521 | stock | 判据过时需改 | 工作树 cli ko 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2v-miniapp-taro | scripts/guardian-runner.mjs:869 | scan-i18n-zh-residue.mjs:209/521 | stock | 判据过时需改 | 工作树 miniapp ko 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2w-mobile-rn | scripts/guardian-runner.mjs:877 | scan-i18n-zh-residue.mjs:209/521 | stock | 判据过时需改 | 工作树 mobile ko 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2k-shared | scripts/guardian-runner.mjs:885 | scan-i18n-zh-residue.mjs:209/521 | stock | 判据过时需改 | 工作树 shared ko 残留 | locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob |
| 2m-shared | scripts/guardian-runner.mjs:893 | check-i18n-broken-en.mjs:255 | delta | 真判据（保留） | en 破碎英文(shared) | 同一判据；362 return1；索引面 |
| 2f-shared-diff | scripts/guardian-runner.mjs:904 | i18n-diff.mjs:245/581 | delta | 真判据（保留） | 索引 blob 判 shared 词条 | target=shared；exit@581 |
| 2n-web | scripts/guardian-runner.mjs:923 | check-i18n-keys.mjs:1885 | delta | 真判据（保留） | i18n 五语言 parity(web) | --parity-only；同判据；1922 exit1 |
| 2f-mobile-rn | scripts/guardian-runner.mjs:939 | check-i18n-keys.mjs:1885 | delta | 真判据（保留） | mobile-rn i18n parity | 同一判据；目标 mobile-rn；索引面 |
| 34 | scripts/guardian-runner.mjs:1050 | check-ts-ignore.mjs:94/158 | stock | 判据过时需改 | 整文件扫，存量实测 0 | 头注称 warn 不阻塞但注册为 blocking；整文件读工作树，应按 added 行/索引 blob |
| 42 | scripts/guardian-runner.mjs:1092 | check-event-closure-leak.mjs:306 | delta | 真判据（保留） | SyntheticEvent 闭包陷阱 | 306 main；staged 索引面；exit1 |
| 46 | scripts/guardian-runner.mjs:1147 | scripts/check-inline-back-button.mjs:369 | delta | 真判据（保留） | 私接返回键只拦新增 | violations>0 return 1；web 两目录在 |
| 50 | scripts/guardian-runner.mjs:1254 | scripts/check-next-env-dist.mjs:204 | delta | 真判据（保留） | 索引/HEAD 禁 .next-* 变体 | next-env.d.ts 在；变体 exit1 |
| 51 | scripts/guardian-runner.mjs:1287 | check-capability-catalog.mjs:891 | delta | 真判据（保留） | 能力目录与端点对账 | 887 existsSync 滤暂存清单；错面归 30c/65 |
| 52 | scripts/guardian-runner.mjs:1312 | scripts/check-no-visible-spawn.mjs:921 | delta | 真判据（保留） | 派生弹窗 windowsHide | prod 命中 exit1；射程在 |
| 53 | scripts/guardian-runner.mjs:1335 | check-admin-gate-consistency.mjs:411 | delta | 真判据（保留） | admin 路由与守卫契约对账 | 411 判据；539 零候选判 exit2，防空转 |
| 55 | scripts/guardian-runner.mjs:1385 | check-tool-name-display-coverage.mjs:91/186 | delta | 真判据（保留） | 索引面工具名显示覆盖 | mcp_server/tool-display 在；exit@186 |
| 60 | scripts/guardian-runner.mjs:1468 | check-tool-activity-coverage.mjs:288/619 | delta | 真判据（保留） | 索引面工具活动覆盖 | data 快照在；exit@619 |
| 56 | scripts/guardian-runner.mjs:1494 | check-tool-display-resolvable.mjs:212/385 | delta | 真判据（保留） | 索引面工具名可解析 | 词包在；exit1/2 |
| 63 | scripts/guardian-runner.mjs:1589 | check-sse-parser-parity.mjs:215/467 | delta | 真判据（保留） | 索引面双解析器帧对齐 | data 快照在；exit1 |
| 67 | scripts/guardian-runner.mjs:1723 | check-credential-leak-in-message.mjs:1129 | delta | 真判据（保留） | 消息凭据泄露 | 73-75 自述读工作树；错面归 30c/65，exit1 |
| 69 | scripts/guardian-runner.mjs:1752 | check-declared-shortcuts.mjs:585 | delta | 真判据（保留） | 快捷键声明与归属 | 585 main；注册表全量+索引面；exit1:636 |
| 70 | scripts/guardian-runner.mjs:1776 | scan-hardcoded-zh.mjs:534/623 | delta | 真判据（保留） | 索引面硬编码中文棘轮 | --exit 1；基线在；exit@623 |
| 72 | scripts/guardian-runner.mjs:1845 | check-dockerfile-copy-paths.mjs:543 | delta | 真判据（保留） | Dockerfile COPY 路径 | 543 scanDockerfile；缺面 fallback；exit1 |
| 73 | scripts/guardian-runner.mjs:1874 | check-direct-backend-calls.mjs:1099 | delta | 真判据（保留） | 端内直连后端拦截 | 1099 main；953 analyzeCorpus；基线只减不增 |
| 74 | scripts/guardian-runner.mjs:1905 | check-word-table-resolvable.mjs:212/2065 | delta | 真判据（保留） | 索引面词表键可解析 | W6 锚 HEAD 例外；exit@2065 |
| 77 | scripts/guardian-runner.mjs:1997 | scripts/check-radius-single-source.mjs:1749 | delta | 真判据（保留） | 8 端圆角档位+取用单源 | radius.js/tokens.css/preset 在；fail exit1 |
| 93 | scripts/guardian-runner.mjs:2021 | check-cross-end-tokens.mjs:1596 | delta | 真判据（保留） | 跨端色令牌同源 | main 1596；122 tokens.css 现行路径；exit1 |
| 91 | scripts/guardian-runner.mjs:2059 | check-theme-prop-wiring.mjs:709/1099 | delta | 判据过时需改 | apps/desktop/src 已无文件 | RENDER_DIRS 含不存在的 apps/desktop/src（仅 src-tauri）；删该目录或改指 |
| 10 | scripts/guardian-runner.mjs:2084 | openapi-check.mjs:156/1102 | stock | 真判据（保留） | 整仓路由与 openapi 对账 | 整仓 routes↔openapi 对账；staged 仅作触发，归 stock |
| 83 | scripts/guardian-runner.mjs:2125 | check-brand-foreground.mjs:1918 | delta | 真判据（保留） | RN/共享包前景回归 | catBatch 同面取材；基线棘轮；exit1:1918 |
| 84 | scripts/guardian-runner.mjs:2154 | check-stale-revert.mjs:101/2620 | delta | 真判据（保留） | 索引面反回退对比历史 | refs 毫秒桶辅助；exit1 |
| 78 | scripts/guardian-runner.mjs:2181 | check-workspace-dep-links.mjs:139/762 | stock | 真判据（保留） | 盘上 node_modules 链接对账 | node_modules 盘上事实只能 stock；触发面 package.json/锁文件合理 |
| 81 | scripts/guardian-runner.mjs:2264 | check-brand-email-channel.mjs:704 | delta | 真判据（保留） | 品牌邮件通道对账 | 704 audit；staged 读索引；违规 exit1 |
| 87 | scripts/guardian-runner.mjs:2334 | scripts/check-i18n-messages-exist.mjs:309 | delta | 真判据（保留） | 40项清单逐项对账 | 7端 messages 与 loader 均在，return 1 有真实出口 |
| 90 | scripts/guardian-runner.mjs:2438 | check-sse-dispatch-parity.mjs:131/893 | delta | 真判据（保留） | 索引面 SSE 分发三层对齐 | data 快照在；exit1@893 |
| 97 | scripts/guardian-runner.mjs:2562 | check-statusbar-single-source.mjs:630/662 | delta | 真判据（保留） | 索引面状态栏单一源 | HEAD/index 双面；exit@662 |
| 98 | scripts/guardian-runner.mjs:2592 | check-dangling-local-imports.mjs:308 | delta | 真判据（保留） | HEAD 悬空具名导入 | 308 auditOneFace；staged 索引，exit1:1958 |
| 102 | scripts/guardian-runner.mjs:2713 | check-glyph-arrow-icon.mjs:927 | delta | 真判据（保留） | 文本箭头/字号倒挂 | 927 auditFile；365 catBatch 同面 |
| 103 | scripts/guardian-runner.mjs:2747 | check-architecture-policy.mjs:1473 | delta | 真判据（保留） | 架构契约声明反查 | main 1473；selectFace 三面；违规 exit1 |
| 105 | scripts/guardian-runner.mjs:2811 | scripts/check-miniapp-generated.mjs:1642 | delta | 判据过时需改 | 派生产物对账；图标源恒空 | L1 源集恒空（icons/ 已 CDN 外置）、G3 永不判红；删/改两维或空源→exit2 |
| 106 | scripts/guardian-runner.mjs:2844 | sync-extension-tokens.mjs:152/711 | delta | 真判据（保留） | 索引面 token 派生一致性 | --check --staged；exit1@711 |
| 107 | scripts/guardian-runner.mjs:2873 | provenance-ledger.mjs:613/1428 | delta | 真判据（保留） | 索引面溯源台账 P1-P7 | exit@1428 |
| 108 | scripts/guardian-runner.mjs:2899 | check-exemption-expiry.mjs:519 | delta | 真判据（保留） | 行内豁免到期账 | 519 analyze；1575 selectFace；到期 exit1 |
| 109 | scripts/guardian-runner.mjs:2926 | check-task-claims.mjs:141/1055 | delta | 真判据（保留） | --check-gate 判任务租约 | PROJECT_PLAN 在；exitCode@1055 |
| 111 | scripts/guardian-runner.mjs:2987 | check-tool-contract-declared.mjs:596/1771 | delta | 真判据（保留） | 索引面工具契约声明棘轮 | TC3/TRD 双臂；exitCode@1771 |
| 112 | scripts/guardian-runner.mjs:3015 | check-compaction-denominator.mjs:425 | delta | 真判据（保留） | 压缩分母口径 | main 425；索引面判据；真实 exit1 |
| 113 | scripts/guardian-runner.mjs:3047 | check-tool-arg-routing-identity.mjs:412/861 | delta | 真判据（保留） | 索引面路由身份键 | 基线在；exit@861 |
| 115 | scripts/guardian-runner.mjs:3120 | check-tool-arg-validation-wired.mjs:666/1204 | delta | 真判据（保留） | 索引面入参校验装车 | 双档判据；exit@1204 |
| 116 | scripts/guardian-runner.mjs:3150 | check-egress-facts.mjs:240 | delta | 真判据（保留） | 出站事实与绕档棘轮 | 240 decide；660 return result.exit |
| 119 | scripts/guardian-runner.mjs:3242 | check-subagent-permission-inherited.mjs:272/628 | delta | 真判据（保留） | 索引面子代理权限继承 | CLI 路径在；exitCode@628 |
| 120 | scripts/guardian-runner.mjs:3262 | scripts/check-list-predicate-has-positive-proof.mjs:403 | delta | 真判据（保留） | 名单正向证明对账 | embedded/copied/overrides 均在；violation return 1 |
| 121 | scripts/guardian-runner.mjs:3282 | check-declared-policy-has-consumer.mjs:1598 | delta | 真判据（保留） | 声明策略需消费者 | 1598 analyze；索引 vs HEAD 双判；exit1:2976 |
| 123 | scripts/guardian-runner.mjs:3325 | check-tool-exec-budget.mjs:108/428 | delta | 真判据（保留） | 索引面 exec 预算接线 | 缺常量即红；exit@428 |
| 124 | scripts/guardian-runner.mjs:3344 | scripts/check-miniapp-chrome.mjs:192 | delta | 真判据（保留） | theme.json 派生对账 | theme.json/theme.ts/tokens.css 在；红口有效 |
| 253 | scripts/guardian-runner.mjs:3545 | scripts/check-mjs-export-resolution.mjs:722 | delta | 真判据（保留） | scripts 导出面真值对账 | 显式 --staged；blocking>0 return1 |
| 254 | scripts/guardian-runner.mjs:3565 | sync-rn-tokens.mjs:1298/1349 | delta | 真判据（保留） | 索引面 RN 令牌派生对账 | --check --staged；exit1@1349 |
| 256 | scripts/guardian-runner.mjs:3587 | check-web-portal-label-keys.mjs:105/145 | delta | 真判据（保留） | 索引面门户标签键不变量 | web-portal.ts 在；exit@145 |
| 131 | scripts/guardian-runner.mjs:3695 | scripts/check-rn-interop-fn-style.mjs:843 | delta | 真判据（保留） | 函数形态 style 棘轮 | r.exit 透传；按文件 HEAD 锚定 |
| 135 | scripts/guardian-runner.mjs:3821 | check-api-failure-throw.mjs:228 | delta | 真判据（保留） | ApiResult 失败须抛错 | 228 analyze；失败 exitCode 见 404 |
| 136 | scripts/guardian-runner.mjs:3849 | check-background-task-type-parity.mjs:265 | delta | 真判据（保留） | 后台任务类型三面 parity | 265 judge；main 675；staged 读索引 |
| 137 | scripts/guardian-runner.mjs:3874 | check-digest-name-reality.mjs:1075 | delta | 真判据（保留） | 名字承诺与实现兑现 | 1075 judgeDelivery；退出 2043 |
| 138 | scripts/guardian-runner.mjs:3895 | scripts/check-mention-engine-wired.mjs:786 | delta | 真判据（保留） | 提及引擎接线单一源 | 4 目标文件在；violations>0 return 1 |
| 139 | scripts/guardian-runner.mjs:3916 | scripts/check-mode-permission-matrix.mjs:853 | delta | 真判据（保留） | 模式×权限×审批矩阵 | 两侧源在；不一致 exit1 |
| 141 | scripts/guardian-runner.mjs:3957 | check-doom-loop-parity.mjs:392 | delta | 真判据（保留） | doom-loop 五面成套 | 392 decide；main exit 937；索引面 |
| 144 | scripts/guardian-runner.mjs:4011 | check-crash-report-redaction.mjs:506 | delta | 真判据（保留） | 崩溃上报脱敏 | 506 exitCode=r.exit；redactCrashText 仍在 |
| 145 | scripts/guardian-runner.mjs:4042 | scripts/check-rn-double-header.mjs:1198 | delta | 真判据（保留） | 双层页头对账 | r.exit 透传；新增红口有效 |
| 146 | scripts/guardian-runner.mjs:4062 | scripts/check-readme-table-integrity.mjs:680 | delta | 真判据（保留） | README 表格竖排续行 | README 表格结构门；与 173/DN2 数字对账非同套，本轮未动 |
| 147 | scripts/guardian-runner.mjs:4081 | scripts/check-model-capacity-parity.mjs:832 | delta | 真判据（保留） | 容量/推理档跨语言同值 | 6 源文件在；--strict exit1 |
| 157 | scripts/guardian-runner.mjs:4257 | check-credential-presence-bypass.mjs:841 | delta | 真判据（保留） | 凭据存在性旁路 | main 841；staged 索引面；违规 exit1 |
| 209 | scripts/guardian-runner.mjs:4304 | check-csrf-exemption-shape.mjs:610 | delta | 真判据（保留） | CSRF 豁免形状 | 610 analyze；索引面；违规 exit1 |
| 159 | scripts/guardian-runner.mjs:4330 | scripts/check-image-source-domains.mjs:621 | delta | 真判据（保留） | 头注“未注册”已过期 | 注册确在；exit1 有效，射程含 ui-react/database |
| 160 | scripts/guardian-runner.mjs:4351 | check-slash-command-wired.mjs:335/595 | delta | 真判据（保留） | 索引面命令注册到达性 | 0 枚举判死；exit1/2 |
| 161 | scripts/guardian-runner.mjs:4368 | scripts/check-inbound-schema-strict.mjs:944 | delta | 真判据（保留） | 入站 .strict() 到达性 | selectFace+红口，apps 射程齐全 |
| 167 | scripts/guardian-runner.mjs:4462 | check-turn-ordinal-lock.mjs:180/512 | delta | 真判据（保留） | 索引面 turn 序号上锁 | api 路径在；exit@512 |
| 168 | scripts/guardian-runner.mjs:4492 | scripts/check-merge-deletion-resurrection.mjs:799 | refs | 真判据（保留） | 合并复活仅判未入 origin | 读 origin/main 提交图；fails>0 exit1 |
| 171 | scripts/guardian-runner.mjs:4516 | check-ai-panel-mount-guards.mjs:784 | delta | 真判据（保留） | AI 面板装载守卫 | 126 selectFace；153 暂存无目标按整索引兜底 |
| 177 | scripts/guardian-runner.mjs:4613 | check-sse-frame-watermark.mjs:61/173 | stock | 真判据（保留） | 显式忽略 --staged 只读工作树 | 恒读工作树为零 git 调用的自述设计（L21-27）；判据面归 stock，不按 delta 待定 |
| 189 | scripts/guardian-runner.mjs:4785 | scripts/check-python-import-landed.mjs:1026 | delta | 真判据（保留） | import 入库存续性 | 索引面删/改名 return1；ai-service 在 |
| 195 | scripts/guardian-runner.mjs:4873 | check-txn-cancel-boundary.mjs:283/728 | delta | 真判据（保留） | 索引面事务取消边界 | apps/packages 面；exit@728 |
| 199 | scripts/guardian-runner.mjs:4890 | check-spawn-output-channel.mjs:103/248 | delta | 真判据（保留） | 索引面判 stdout 通道 | 空扫/取材失败 exit2；命中 exit1 |
| 200 | scripts/guardian-runner.mjs:4911 | scripts/check-provider-health-vocabulary.mjs:954 | delta | 真判据（保留） | provider 四档单一源 | --strict exit1；canonical types-v2.ts 在 |
| 201 | scripts/guardian-runner.mjs:4932 | scripts/check-mobile-version-code.mjs:337 | delta | 真判据（保留） | versionCode 单调递增 | app.json 在；违规 return1 |
| 205 | scripts/guardian-runner.mjs:5042 | check-enum-fallback-terminal.mjs:777 | delta | 真判据（保留） | 未知枚举兜底终态 | 777 main；815 process.exit(main) |
| 206 | scripts/guardian-runner.mjs:5071 | check-error-code-not-text-matching.mjs:310 | delta | 真判据（保留） | 错误码不得按文本判 | 310 analyze；exitCode:569 |
| 207 | scripts/guardian-runner.mjs:5097 | check-agents-doc-size.mjs:142 | delta | 真判据（保留） | AGENTS.md 字节预算棘轮 | 59 judgeSize 读 HEAD/索引面；取不到面不判绿 |
| 212 | scripts/guardian-runner.mjs:5163 | scripts/check-input-focus-feedback.mjs:1528 | delta | 真判据（保留） | 三端聚焦反馈棘轮 | selectFace；r.exit 透传，apps/packages 在 |
| 213 | scripts/guardian-runner.mjs:5169 | check-disk-root-write.mjs:1151 | delta | 真判据（保留） | 盘根写入回归锁 | 1151 judgeSource；索引面增量，只拦新增 |
| 214 | scripts/guardian-runner.mjs:5179 | check-api-key-permission-labels.mjs:80 | delta | 真判据（保留） | 密钥权限三面对账 | 80 judge；135 索引取材；异常 exit2:207 |
| 217 | scripts/guardian-runner.mjs:5217 | check-sheet-flex-contract.mjs:295/417 | delta | 真判据（保留） | 索引面 sheet flex 契约 | mobile-rn 路径在；exit1@417 |
| 218 | scripts/guardian-runner.mjs:5218 | scripts/check-mobile-rn-style-parity.mjs:419 | delta | 真判据（保留） | RN 硬编码 hex 棘轮 | 基线在；selectFace 索引面，新增 return1 |
| 219 | scripts/guardian-runner.mjs:5236 | check-shared-type-not-redeclared.mjs:568/1058 | delta | 真判据（保留） | 索引面共享类型重声明 | 差值棘轮锚 HEAD；exit1@1058 |
| 224 | scripts/guardian-runner.mjs:5371 | check-alert-identity-volatility.mjs:433 | delta | 真判据（保留） | 告警身份抖动差值棘轮 | main 433 读面+豁免表；失败 exit1:484 |
| 227 | scripts/guardian-runner.mjs:5413 | scripts/check-miniapp-taro-design-tokens.mjs:702 | delta | 真判据（保留） | app.css 首块 token 同值 | app.css/tokens.css 在；return 1 有效 |
| 228 | scripts/guardian-runner.mjs:5433 | check-bpe-encoding-parity.mjs:1006 | delta | 真判据（保留） | 跨端 BPE 词表对账 | 78 三面取材；缺 venv 判 exit2，不冒绿 |
| 231 | scripts/guardian-runner.mjs:5467 | scripts/check-no-warm-border.mjs:1313 | delta | 真判据（保留） | 暖色描边四维 | W2/W3 判 plugins/*.cjs 提交链；native res 已 gitignore，非判据过时 |
| 232 | scripts/guardian-runner.mjs:5483 | scripts/check-no-nested-git-sites-durability.mjs:306 | delta | 真判据（保留） | 豁免台账行存续 | jsonl+旧 JSON 在；被洗 return1 |
| 235 | scripts/guardian-runner.mjs:5557 | check-button-height.mjs:365 | delta | 真判据（保留） | Button 高度三面取材 | 按钮高度单一源；豁免 apps/desktop/src 已消失（死豁免，无害） |
| 240 | scripts/guardian-runner.mjs:5623 | scripts/check-readout-no-break.mjs:432 | delta | 真判据（保留） | 大屏读数断行 R1-R6 | web/extension 射程在；违规 exit1 |
| 249 | scripts/guardian-runner.mjs:5785 | scripts/check-rich-anchor-renderer-single-source.mjs:405 | delta | 真判据（保留） | 渲染表与标签双向相等 | shared/web 锚点件均在；red exit1 |
| 238 | scripts/guardian-runner.mjs:5863 | scripts/check-mirror-purge-intact.mjs:518 | delta | 真判据（保留） | 10 文档死链/徽章对账 | 10 文档均在；绝对零容忍 exit1 |
| 263 | scripts/guardian-runner.mjs:6030 | check-ruff-python.mjs:121/155 | delta | 真判据（保留） | 索引 blob 判 ruff 欠账 | ruff==0.16.6 在位；exit1/2 齐 |
| 258 | scripts/guardian-runner.mjs:6071 | check-ddos-guard-wiring.mjs:277 | delta | 真判据（保留） | DDoS 守卫接线对账 | 277 evaluateWiring；exitCode:543 |
| 259 | scripts/guardian-runner.mjs:6104 | check-ui-spec-mirror.mjs:164/429 | delta | 真判据（保留） | 索引面 RN/spec/小程序镜像 | spec 与 mp 均在；exit@429 |
| 260 | scripts/guardian-runner.mjs:6138 | scripts/check-prod-dep-advisories.mjs:479 | stock | 判据过时需改 | 审计快照判 critical/high | triggers 缺 pnpm-lock.yaml/package.json，依赖变更不触发；--staged 仅校 waiver 形态 |
| 295 | scripts/guardian-runner.mjs:6241 | check-hairline-separator.mjs:490 | delta | 真判据（保留） | 分隔线单侧形态 | 490 run；492 selectFace 三面；exit1 |
| 309 | scripts/guardian-runner.mjs:6336 | check-dead-script-refs.mjs:502 | delta | 真判据（保留） | 工作流死脚本引用 | 502 judgeReport；822 exitCode=audit |
| 310 | scripts/guardian-runner.mjs:6362 | check-autonomy-invariants.mjs:102 | delta | 真判据（保留） | 自主环基线不变量 | 102 decideInvariants；退出 r.exit:332 |
| 170 | scripts/guardian-runner.mjs:6452 | check-bypass-landing-scope.mjs:646 | refs | 判据过时需改 | 旁路落地写回审计 | 206-209 台账 gitignored；干净检出恒 undetermined→646 exit0；应 fail-closed 或显式跳过并记账 |
| 197 | scripts/guardian-runner.mjs:6623 | check-truncation-accounting.mjs:110/439 | delta | 真判据（保留） | 索引面 truncated 记账 | 2026-11-05 升档；exit@439 |
| 198 | scripts/guardian-runner.mjs:6648 | check-db-blind-updatedat-set.mjs:52 | delta | 真判据（保留） | 盲写 updatedAt 棘轮 | 52 judgeLine；184 staged 增量；exit1:166 |
| 268 | scripts/guardian-runner.mjs:6692 | check-head-recall-stock.mjs:144 | delta | 真判据（保留） | PROJECT_PLAN 回捞差值棘轮 | 144 参数；24 仅 --staged 红；exit1:231 |
| 270 | scripts/guardian-runner.mjs:6726 | check-token-literal-debt.mjs:140/183 | delta | 真判据（保留） | 索引面裸数字债务棘轮 | 对比 HEAD 差值；exit2@183 |
| 272 | scripts/guardian-runner.mjs:6747 | scripts/check-modal-keyboard-avoid.mjs:224 | delta | 真判据（保留） | Modal 键盘避让对账 | 两目录在；return1 |
| 273 | scripts/guardian-runner.mjs:6770 | scripts/check-rn-interaction-hygiene.mjs:1447 | delta | 真判据（保留） | H1/H3/H4 零容忍 H2 棘轮 | staged 对 HEAD 比新增；added return1 |
| 274 | scripts/guardian-runner.mjs:6803 | scripts/check-rn-type-floor.mjs:246 | delta | 真判据（保留） | 字号地板零容忍 T2 报数 | typography.ts 现读 TYPE_STEPS；return1 |
| 271 | scripts/guardian-runner.mjs:6830 | scripts/check-killer-parity-ends.mjs:461 | delta | 真判据（保留） | 常量二次写死只拦新增 | warnOnly=false 时 return 1；射程在 |
| 266 | scripts/guardian-runner.mjs:6863 | check-style-key-consumption.mjs:130/873 | delta | 真判据（保留） | 索引面样式键跨文件消费 | 同面成对判；exit@873 |
| 275 | scripts/guardian-runner.mjs:6928 | scripts/check-monitor-alert-vocabulary.mjs:218 | delta | 真判据（保留） | 告警词表同值副本棘轮 | canonical 在；新增 return1 |
| 278 | scripts/guardian-runner.mjs:6984 | scripts/check-redirect-target-origin-pinned.mjs:287 | delta | 真判据（保留） | 回跳 origin 钉扎+台账 | 台账在；violations/undetermined 1/2 |
| 279 | scripts/guardian-runner.mjs:7008 | scripts/check-like-wildcard-escape.mjs:344 | delta | 真判据（保留） | LIKE 转义单源+棘轮 | 源文件与台账在；D1 零容忍可红 |
| 289 | scripts/guardian-runner.mjs:7140 | check-web-rn-gap-ratchet.mjs:65/270 | delta | 真判据（保留） | 索引面缺口棘轮不退化 | 基线在；--gate；exit@270 |
| 283 | scripts/guardian-runner.mjs:7162 | scripts/check-rn-host-shell-coverage.mjs:366 | delta | 真判据（保留） | 共享屏 RN 薄壳覆盖 | packages/app/mobile-rn 在；failures return1 |
| 288 | scripts/guardian-runner.mjs:7179 | check-cross-end-component-props-parity.mjs:533 | delta | 真判据（保留） | 跨端组件 props 基线 | 533 computeParity；基线棘轮，exit1 |
| 287 | scripts/guardian-runner.mjs:7227 | check-hover-lift-single-source.mjs:73 | delta | 真判据（保留） | hover 浮起单一数值源 | 73 judgeLiftLiterals；146 索引面 |
| 290 | scripts/guardian-runner.mjs:7259 | scripts/check-miniapp-interaction-hygiene.mjs:875 | delta | 真判据（保留） | A1/A2 零容忍 A3/A4 建议 | blockingRed>0 exit1；allowlist 在 |
| 291 | scripts/guardian-runner.mjs:7284 | check-web-rn-copy-parity.mjs:454/1486 | delta | 真判据（保留） | 索引面 web/RN 文案对齐 | 屏幕表/差异表在；exit@1486 |

## 2. 需改项明细（29 项）

- **2b**：工作树 zh-TW web 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:186/521）
- **2c**：工作树 ko web 中文残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:209/521）
- **2g-web**：命名空间传递可拦新增 — 头注称 warn 不阻塞但注册 blocking；staged 选文件后读工作树，应改 :path（scripts/check-i18n-namespace-passing.mjs:250）
- **11b**：staged 触发，正文读工作树 — staged 新增行 + 正文读工作树；改读索引 blob，避免行号错位（check-rounded-overflow.mjs:389/448）
- **17**：扫描根 packages/ui 已消失 — 改 packages/ui/src→packages/ui-react/src；staged 改读索引 blob（scripts/check-input-border-var.mjs:129）
- **20**：staged 触发，正文读工作树 — staged 新增行 + 正文读工作树；改读索引 blob（check-tailwind-class-conflict.mjs:231/377）
- **27**：staged 触发，正文读工作树 — staged 触发 + 正文读工作树；改读 5 个面文件索引 blob（check-z-index-guard.mjs:283/459）
- **38**：staged 触发，正文读工作树 — staged 触发 + 正文读工作树；改读 5 个 package.json 索引 blob（check-solito-residue.mjs:279/351）
- **2d**：工作树 ja web 简体残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:306/521）
- **2o-shared**：工作树 shared ja 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:306/521）
- **2o-miniapp-taro**：工作树 miniapp ja 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:306/521）
- **2o-mobile-rn**：工作树 mobile ja 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:306/521）
- **2g-ext**：工作树 ext zh-TW 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:186/521）
- **2h-ext**：工作树 ext ko 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:209/521）
- **2j-shared**：工作树 shared zh-TW 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:186/521）
- **2p-api**：工作树 api zh-TW 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:186/521）
- **2q-cli**：工作树 cli zh-TW 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:186/521）
- **2r-miniapp-taro**：工作树 miniapp zh-TW 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:186/521）
- **2s-mobile-rn**：工作树 mobile zh-TW 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:186/521）
- **2t-api**：工作树 api ko 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:209/521）
- **2u-cli**：工作树 cli ko 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:209/521）
- **2v-miniapp-taro**：工作树 miniapp ko 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:209/521）
- **2w-mobile-rn**：工作树 mobile ko 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:209/521）
- **2k-shared**：工作树 shared ko 残留 — locale 未 staged 跳过，命中后读工作树；改读对应 messages/<target>/<locale>.json 的 :path blob（scan-i18n-zh-residue.mjs:209/521）
- **34**：整文件扫，存量实测 0 — 头注称 warn 不阻塞但注册为 blocking；整文件读工作树，应按 added 行/索引 blob（check-ts-ignore.mjs:94/158）
- **91**：apps/desktop/src 已无文件 — RENDER_DIRS 含不存在的 apps/desktop/src（仅 src-tauri）；删该目录或改指（check-theme-prop-wiring.mjs:709/1099）
- **105**：派生产物对账；图标源恒空 — L1 源集恒空（icons/ 已 CDN 外置）、G3 永不判红；删/改两维或空源→exit2（scripts/check-miniapp-generated.mjs:1642）
- **260**：审计快照判 critical/high — triggers 缺 pnpm-lock.yaml/package.json，依赖变更不触发；--staged 仅校 waiver 形态（scripts/check-prod-dep-advisories.mjs:479）
- **170**：旁路落地写回审计 — 206-209 台账 gitignored；干净检出恒 undetermined→646 exit0；应 fail-closed 或显式跳过并记账（check-bypass-landing-scope.mjs:646）

## 3. 僵尸门

本轮按硬证据标准判为 **0 道**。判定门槛：必须能指出"无任何非零失败出口"或"目标集合结构性恒空且空集记绿"或"只 warn 且永不阻断"或"同脚本同参数完全重复且无额外断言"。174 道均不满足；170/105 已按"准僵尸"列入需改，避免误删仍有部分有效维度的门。

## 4. 附：222 枚命名缺陷 `lost-commit/*` tag 的 GC 识别判据

> 这是门 30a 存量债清理的收尾记录，供后续 GC 使用；本清单轮不做删除。

- **缺陷批次（222 枚）**：`refs/tags/lost-commit/auto-/20261108-160940-<hash12>`。
  - 成因：备份脚本 `IHUI_UNREACHABLE_BACKUP_PREFIX=lost-commit/auto-` 的前缀归一化 bug，把尾部 `-` 与拼接的 `/` 共同生成了多一级的 `auto-/`。只新增不删，故保留。
- **规范批次（2 枚）**：`refs/tags/lost-commit/auto-20261108-163621-<hash12>`（此后脚本已归一化）。
- **区分判据（精确、可机读）**：
  1. 缺陷名前缀：`refs/tags/lost-commit/auto-/`（含 `auto-/` 双分隔）。规范名正则：`^refs/tags/lost-commit/auto-\d{8}-\d{6}-[0-9a-f]{12}$`。
  2. 枚举命令：`git for-each-ref --format='%(refname)' 'refs/tags/lost-commit/auto-/' `。
  3. 逐枚核对目标：`git rev-parse <ref>^{commit}`，其完整 sha 前 12 位必须等于 tag 名末尾 `<hash12>`；不等 = tag 被重指，**不得**按"命名缺陷"批量处理。
  4. 仅当目标 commit 另有规范 tag / 分支 / reflog 可达时，缺陷名才可视为可回收别名；否则保留（延续"只增不删"）。
  5. 若将来允许 GC：先建规范名指向同一 commit，复核 `rev-parse` 一致，再删缺陷名；禁止先删后建。
- 本次清理总量：224 枚（222 + 2），未删任何 ref；清理后 `git fsck --connectivity-only --unreachable --no-reflogs` 悬空 commit = 0（取证见 `D:\tmp-30a-fsck-before.txt` / `after.txt` / `after2.txt`）。

## 5. 边界与未做

- 未运行门，故"能否判红"是**静态失败出口推断**，不是现网实测；复跑门时应逐条对照本表。
- 约 30 处"豁免路径已消失"（如 `apps/web/public/vs`、`apps/desktop/src`）属无害死豁免，只在 11/11f/235 备注，不计入需改。
- 146（README 表格结构门）与同仓另一条线的 173/DN2 数字对账**不是同一套判据**；本轮只登记，未触碰相关脚本与 README 数字文件。
- 本文件为本轮产物，未提交；后续执行票请引用本清单，不另起口径。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

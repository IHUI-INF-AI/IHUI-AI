<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 应用商店上架体检（除 vivo 外全平台）

- 体检日期：2026-11-08
- 体检性质：**只读盘点**。本轮未改业务代码、未提交、未推送、未构建任何新产物（复核用的 APK/AAB 是盘上既有产物，仅用 `aapt2 badging` / `apksigner verify` 读取元数据）。
- 范围：Google Play、华为 AppGallery、小米应用商店、OPPO 软件商店、荣耀应用市场、腾讯应用宝、三星 Galaxy Store、APKPure、鸿蒙 HarmonyOS NEXT。vivo 已有单独线在推进，本文件不重复其工作，仅在与共用材料相关处引用。
- 判定用词：**有 / 缺 / 不确定**。不确定 = 仓内或本机取不到证据，不推断成"有"。

---

## 0. 结论摘要

| 类别 | 结论 |
| --- | --- |
| Android 产物 | **有**：APK 88,784,297 B、AAB 67,460,325 B，均为 0.0.20 真实 release 构建 |
| Android 签名 | **有**：release 真签名，keystore 与四键在仓库外且不入库；仅 v2 方案 |
| iOS | **缺**：零 IPA、零证书、零描述文件、零 iOS 工程目录 |
| 资质（备案/软著/执照） | **有**：App 备案 -7A、软著 2025SR1904590、营业执照原件均在册 |
| 素材（图标/启动图） | **有**：1024 主图 + 自适应前景 + 5 密度 mipmap + 5 密度启动图 |
| 素材（截图/文案） | **缺**：仅 Google Play 口径截图；无各国内店打包；无副标题/关键词/更新说明成品文案 |
| 隐私政策 URL | **缺（错误值）**：脚本硬编码 `https://aizhs.top/privacy` 实测 404，真实地址为 `https://aizhs.top/agreement/privacy` |
| 平台凭据 | **缺**：六家国内店 API 凭据件为 0 枚（华为只有非 Connect API 的 HMS 客户端） |
| 平台账号/首包 | **不确定**：六家开发者实名状态与首包建应用动作均无仓内证据 |

**不存在"某类材料完全没有导致多平台全灭"的情况。** 当前真正卡住国内六家的是两件事：各家 API 凭据（仓外，需人去控制台建）与首包必须人工在后台建应用；法定前置（备案、软著）已在册。

---

## 1. Android 包体与签名

### 1.1 产物

| 项 | 值 | 判定 | 证据 |
| --- | --- | --- | --- |
| APK | `apps/mobile-rn/android/app/build/outputs/apk/release/app-release.apk`，88,784,297 B，mtime 2026-11-08 13:26 | 有 | 盘上实测 |
| AAB | `apps/mobile-rn/android/app/build/outputs/bundle/release/app-release.aab`，67,460,325 B | 有 | 盘上实测 |
| 产出能力 | `android/` 工程在盘（prebuild 生成，被 gitignore），`eas.json` production 段声明 `buildType: app-bundle` | 有 | [eas.json](file:///d:/IHUI-AI/apps/mobile-rn/eas.json) |
| ABI | 仅 `arm64-v8a`（`reactNativeArchitectures=arm64-v8a`） | 有（但仅 64 位） | [gradle.properties](file:///d:/IHUI-AI/apps/mobile-rn/android/gradle.properties#L36) |

> 32 位（armeabi-v7a）不产出。部分国内商店对"仅 64 位"会要求补充说明或直接拒收，提交前需按各家规则确认；这不影响 Google Play（其 64 位要求已满足）。

### 1.2 标识与版本（APK badging 实测）

| 项 | 值 |
| --- | --- |
| applicationId / package | `zh.ai.sq` |
| versionName | `0.0.20` |
| versionCode | `26110801` |
| minSdkVersion | `24` |
| targetSdkVersion | `36` |
| compileSdk | 36（`platformBuildVersionName=16`） |
| 显示名 | `AI丨智汇社`（[strings.xml](file:///d:/IHUI-AI/apps/mobile-rn/android/app/src/main/res/values/strings.xml) 与 [app.json](file:///d:/IHUI-AI/apps/mobile-rn/app.json#L3) 一致） |

版本号陷阱说明：`apps/mobile-rn/app.json` 里的 `version: "0.0.12"` 只是**基座版本**，构建期由 `IHUI_MOBILE_VERSION` 派生覆盖（[app.config.js](file:///d:/IHUI-AI/apps/mobile-rn/app.config.js#L118-L123)），商店与邮件必须读产物元数据，不能读 app.json。versionCode 由 UTC 时间派生（`YYMMDDHH`），覆盖口 `IHUI_VERSION_CODE` 有上下界校验。

### 1.3 混淆与压缩

| 项 | 状态 | 说明 |
| --- | --- | --- |
| R8/混淆 `minifyEnabled` | **关** | 默认 `false`，`gradle.properties` 未开启（[build.gradle](file:///d:/IHUI-AI/apps/mobile-rn/android/app/build.gradle#L69)） |
| 资源压缩 `shrinkResources` | **关** | 同上 |
| `proguard-rules.pro` | 文件存在但**未启用** | 只声明，无实际效果 |

结论：当前 release 包**未做代码混淆与资源裁剪**。这不是上架阻断项（商店不要求混淆），但属"体积与反编译风险"层面的已知状态，登记备查。

### 1.4 签名（只报存在性与位置，不含任何密钥内容）

| 项 | 状态 |
| --- | --- |
| 是否 release 签名 | **是**，非 debug |
| keystore 位置 | `~/.android/ihui-release.keystore`（仓库外，2804 B，2026-08-17） |
| 凭据四键 | `IHUI_RELEASE_STORE_FILE / STORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD`，位于 `~/.gradle/gradle.properties`（仓库外） |
| 是否被 gitignore 保护 | **是**——两者本就在仓库外；`apps/mobile-rn/credentials/` 整目录被 [apps/mobile-rn/.gitignore](file:///d:/IHUI-AI/apps/mobile-rn/.gitignore#L11) 忽略 |
| 缺凭据时的行为 | `build.gradle` 直接抛 GradleException 拒绝出包（不会静默回落 debug 签名），仅显式 `-PallowDebugSigning=true` 才允许 dev 包 |
| 签名方案（实测 `apksigner verify`） | **仅 v2 通过**；v1=false、v3=false、v3.1=false、v4=false；单签名者 |
| 证书 DN | `CN=IHUI AI, OU=IHUI-AI, O=Jilin Aizhihui AI Technology, L=Changchun, ST=Jilin, C=CN` |

两点登记（都不是阻断项，但会被审核问）：

1. **只签 v2**。Android 7+ 足够；个别国内商店历史上要求 v1+v2 双签，需按各家最新规则确认。
2. **证书主体仍是旧名 `IHUI AI`**，而对外名已冻结为 `AI丨智汇社`（[app-identity.json](file:///d:/IHUI-AI/scripts/data/app-identity.json) 把 `IHUI AI` 列为 `forbiddenLegacyNames`）。签名身份一旦发布不可更换，只能在商店"开发者主体"栏用营业执照名称解释。

### 1.5 Google Play 服务账号

- `apps/mobile-rn/credentials/google-play-service-account.json` **在位**（类型 service_account，含 private_key），且该目录已被 gitignore 忽略，不入库。
- 该文件是否已完成 Play Console API 授权（Release 权限）**不确定**，仓内无证据。

---

## 2. iOS

| 项 | 判定 | 证据 |
| --- | --- | --- |
| iOS 工程目录 | **缺** | `apps/mobile-rn/ios/` 不存在（且被 gitignore，属 prebuild 生成物） |
| IPA | **缺** | 全仓（排除 node_modules）零 `*.ipa` |
| 签名证书 `.p12` / `.cer` | **缺** | 零命中 |
| provisioning 描述文件 | **缺** | 零 `*.mobileprovision` |
| EAS iOS 凭据 | **不确定** | `eas.json` 无 iOS submit 配置；远端 EAS 凭据需登录才能核对，本轮无凭证 |
| Bundle ID | 有（仅声明） | `ai.ihui.mobile`（[app.json](file:///d:/IHUI-AI/apps/mobile-rn/app.json#L18)） |
| 版本 | 有（仅声明） | buildNumber 与 Android versionCode 同源派生（[app.config.js](file:///d:/IHUI-AI/apps/mobile-rn/app.config.js#L141-L142)） |
| 关联域名 | 有（仅声明） | `applinks:aizhs.top`、`applinks:file.aizhs.top` |
| 出口合规 | 有（仅声明） | `usesNonExemptEncryption: false` |

**结论：iOS 侧没有任何可交付物。** 要上 App Store 必须先补：macOS 构建环境或 EAS iOS 构建、Apple Developer Program 账号、Distribution 证书、App Store provisioning profile、App Store Connect 应用记录。责任面见 §6。

---

## 3. 应用信息素材

### 3.1 名称与文案

| 项 | 判定 | 现状 |
| --- | --- | --- |
| 应用名称 | **有** | `AI丨智汇社`，四处一致：app.json、strings.xml、App 备案名、软著简称 |
| 副标题 / 一句话简介 | **缺** | 无成品文案。`prepare-store-bundle.mjs` 只派生模板句：`AI丨智汇社(智汇AI)AI 对话与智能体平台,由吉林省爱智汇人工智能科技有限公司提供。` |
| 应用简介（长描述） | **缺（成品）** | 同上，派生文本为 5 行固定模板；各家字数上限已登记在 `VENDOR_LIMITS`（brief 80/100/120/200、full 4000/8000） |
| 关键词 | **缺** | 仓内无商店关键词表（仅 SEO 文档面向网站，不是商店字段） |
| 更新说明（Release Notes） | **缺（成品）** | 只有 `docs/CHANGELOG.md` 可摘 |
| 分类 | 有（默认） | 脚本固定 `工具`；各店实际分类需在表单确认 |

### 3.2 图标与启动图

| 项 | 判定 | 现状 |
| --- | --- | --- |
| 主图标 1024×1024 | **有** | `apps/mobile-rn/assets/icon.png` |
| 自适应前景 1024×1024 | **有** | `assets/adaptive-icon.png`，背景色 `#000000` |
| Google Play 512×512 | **有** | `store-assets/play/icon-512.png` |
| Android 各密度 | **有** | `mipmap-mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi` 各含 `ic_launcher.webp`、`ic_launcher_round.webp`、`ic_launcher_foreground.webp`；另有 `mipmap-anydpi-v26` 自适应 XML |
| 启动图 | **有** | `assets/splash/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/splashscreen_logo.png` + `assets/splash-icon.png` 1024×1024；由 `withSplash.cjs` 注入 |
| 各商店要求的其他图标尺寸 | **不确定** | 仓内无按店尺寸矩阵；需按各家后台当前要求逐个导出 |

### 3.3 截图

现有素材**只有 Google Play 口径**（`apps/mobile-rn/store-assets/play/`）：

| 文件 | 尺寸 |
| --- | --- |
| `screenshots/01-home.png`、`02-store.png`、`03-square.png`、`04-me.png` | 1080×2400 |
| `screenshots/shot-1.png` .. `shot-4.png` | 1080×1920 |
| `screenshots/shot-01.png` | 1080×2400 |
| `feature-graphic-1024x500.png` / `fg-1024x500.jpg` | 1024×500 |
| `fg-2048x1000.png` | 2048×1000 |

| 项 | 判定 | 说明 |
| --- | --- | --- |
| Play 手机截图（≥2 张） | **有** | 两套各 4 张，可择优 |
| Play feature graphic | **有** | 1024×500 与 2048×1000 两版 |
| 国内店竖屏截图（通常 1080×1920，3–5 张） | **有素材、缺打包** | 现成 4 张 1080×1920 可直接用；但无按店目录、无文案/顺序规范 |
| 平板 / 横屏截图 | **缺** | 零命中 |
| 各平台尺寸与数量权威清单 | **缺** | 仓内无该表；须在各家开发者后台以当期要求为准（本文件不臆造数字） |

### 3.4 法务链接

| 链接 | 判定 | URL | 实测 |
| --- | --- | --- | --- |
| 隐私政策 | **有可访问地址，但脚本写错** | 正确：`https://aizhs.top/agreement/privacy` | 200 |
| 隐私政策（脚本现值） | **缺（404）** | `https://aizhs.top/privacy` | 404 |
| 用户协议 | **有** | `https://aizhs.top/agreement/user-agreement`（亦可 `/legal/terms`） | 200 / 200 |
| 使用政策 | 有 | `https://aizhs.top/legal/usage-policy` | 200 |

> 隐私政策 URL 硬编码位置：[prepare-store-bundle.mjs](file:///d:/IHUI-AI/scripts/prepare-store-bundle.mjs#L311)。这是**所有平台表单共用字段**，属于"一处错、家家错"。
> 隐私政策正文另有 App 内实现：`apps/mobile-rn/src/constants/privacyPolicy.ts`（主体：吉林省爱智汇人工智能科技有限公司；生效日：2025-06-20；邮箱：IHUI-AI@aizhs.top）。

---

## 4. 资质与法定前置

| 项 | 判定 | 值 / 位置 | 备注 |
| --- | --- | --- | --- |
| ICP 备案号（App） | **有** | `吉ICP备2025027274号-7A` | 台账 `scripts/data/app-icp-filing.json`；主体：吉林省爱智汇人工智能科技有限公司；发证：吉林省通信管理局；核验 2026-11-07 |
| ICP 备案号（网站） | 有 | `吉ICP备2025027274号-2`（aizhs.top，2025-08-13） | 与 App 备案是**不同条目**，不能互相替代 |
| 公网安全备案号 | 有（仅 UI 展示） | `吉公网安备22010502000999号` | 见 §5 未决口径第 2 项 |
| 软著 | **有** | 登记号 `2025SR1904590`；证书号 软著登字第16560788号；名称「AI丨智汇社软件」；著作权人 吉林省爱智汇人工智能科技有限公司；2025-09-29 | 原件：`D:/BaiduSyncdisk/吉林省爱智汇人工智能科技有限公司文件/重要常用文件/电子软件证件/AI丨智汇社软件计算机软著.png`（3,050,507 B）与同名 PDF（1,090,800 B），本轮实测存在 |
| 软著更名风险 | **不确定** | 2025-11-05 递交更名申请（拟改「智汇AI社区」），批件未到 | `软著变更.pdf` / 三页扫描在网盘；批件到前对外只能用「AI丨智汇社」 |
| 开发者主体营业执照 | **有（网盘原件，仓内无副本）** | `重要常用文件/4.营业执照.png`（1,536,995 B）、`4.营业执照（带章）.jpg`（235,524 B）、`4.营业执照pdf.pdf`、`手持营业执照.jpg`；`交接文件/17.爱智汇营业执照.jpg` | 本轮实测存在 |
| App 内营业执照展示 | **缺（数据可疑）** | [BusinessLicenseScreen.tsx](file:///d:/IHUI-AI/packages/app/src/features/business-license/BusinessLicenseScreen.tsx#L26-L34) 的信用代码为 `91440101MA9X0000X1`、登记机关为「广州市市场监督管理局」，与吉林主体不一致，形如占位值 | 只登记，本轮不改代码；上架材料以网盘原件为准，不要用 App 内这张 |
| 深度合成/算法备案 | **不确定** | 网盘有 `深度合成-AI机器人对话/资质授权说明.txt`；是否已取得算法备案号无仓内证据 | 六家商店与工信部对 AI 对话类应用会追问 |
| 各店开发者实名认证 | **不确定** | 台账 `legalPrereqs.storeRealNameAndLicense` 六家均 `unjudged` | 一家认证过 ≠ 另一家 |

---

## 5. 四项未决口径（按现状登记，不拍定）

指定参考文档 `docs/engineering/icp-record-content-diff-2026-11-08.md` **在仓内不存在**（全仓 grep `icp-record-content-diff` 零命中）。因此本节按代码现状登记，等该文档落地后以其为准。

| # | 未决项 | 现状（代码事实） | 证据 |
| --- | --- | --- | --- |
| 1 | ICP 备案号是否带 `-7A` | **带**：`吉ICP备2025027274号-7A` | [IcpRecordScreen.tsx](file:///d:/IHUI-AI/packages/app/src/features/icp-record/IcpRecordScreen.tsx#L17)；`scripts/data/app-icp-filing.json` |
| 2 | 公网安全备案号是否显示 | **显示**：`吉公网安备22010502000999号` | [IcpRecordScreen.tsx](file:///d:/IHUI-AI/packages/app/src/features/icp-record/IcpRecordScreen.tsx#L20) |
| 3 | 备案时间用哪个 | **页面用 `2026-01-15`**；同时存在台账 `verifiedAt=2026-11-07` 与网站备案 `2025-08-13`，三值并存 | 同上 `ICP_VALUES[5]`；`app-icp-filing.json` |
| 4 | 链接文本用域名还是完整 URL | **完整 URL**：web 端传 `https://beian.miit.gov.cn`（非域名） | [PageClient.tsx](file:///d:/IHUI-AI/apps/web/app/(main)/settings/icp-record/PageClient.tsx#L16) |

四项均**未定**，本文件只登记现状；上架表单里凡涉及备案时间/链接文案，先按现状填，待口径裁定后统一改。

---

## 6. 逐平台清单

> "有"指材料/凭据在册；"缺"指仓内或本机确证不存在；"不确定"指必须登录后台才能判定。凭据细节引用 `scripts/data/app-store-credentials.json`（本机存在、已被 gitignore，不入库）。

| 平台 | 包体 | 资质 | 凭据 | 首包 | 结论 |
| --- | --- | --- | --- | --- | --- |
| Google Play | **有** AAB + 服务账号 JSON | 不需要 ICP/软著 | 有服务账号文件（授权状态不确定） | 不确定（需 Console 建应用 + 内容分级） | 材料侧**基本齐**，缺副标题/关键词/更新说明与正确隐私 URL |
| 华为 AppGallery | **有** APK+AAB | **有** -7A + 软著 | **缺** Connect API `client_id`/`client_secret`（现有 HMS OAuth 客户端不被 Publishing API 认） | **必须网页建应用** | 缺凭据 + 首包人工 |
| 小米应用商店 | 有 APK | 有 | **缺** 账号邮箱 + 接口私钥（目录内零小米凭据） | **必须网页建应用**（API 不支持建应用/补资质） | 缺凭据 + 首包人工 |
| OPPO 软件商店 | 有 APK | 有 | **缺** `client_id`/`client_secret` | **必须网页建应用** | 缺凭据 + 首包人工 |
| 荣耀应用市场 | 有 APK | 有 | **缺** 荣耀 IAM `client_id`/`client_secret`；上传/绑定/提审四段仍在登录墙内 | **必须网页建应用** | 缺凭据 + 缺正文端点 + 首包人工 |
| 腾讯应用宝 | 有 APK | 有 | **缺** `access_secret`/`user_id`/`app_id`（腾讯云 AK/SK 不能代用） | **官方明写不支持 API 首包发布**，必须后台先上线；且仅主账号可用 API | 三重约束 |
| 三星 Galaxy Store | 有 APK/AAB | 不需要 ICP/软著 | 仓内零三星凭据 | **首次上架必须 Seller Portal 网页** | 缺凭据 + 人工 |
| APKPure | 有 APK（**不收 AAB**） | 不需要 ICP/软著 | 无 API，需门户账号或开发者邮箱 | 人工提交（已按 0.0.20 发过请求函，回执只证明送达） | 可走邮件/门户，不由机器代办受理 |
| 鸿蒙 HarmonyOS NEXT | **缺**（零产物工程、零 RN 鸿蒙运行时依赖、零 DevEco 工具链） | 需备案/软著（已在册） | **缺** 全部五枚 | 不适用 | **零产物能力**，先立适配工程票 |

补充：华为、小米、OPPO 三家的"取 token → 传文件"调用段已在册且已核实，凭据一到即可跑自动上传；vivo/应用宝的上传调用段也已收口（vivo 已真实提审受理）。荣耀仍差官方正文里的 method/字段表。

---

## 7. 缺口补位清单（谁补什么）

### 7.1 可由仓内工程补（不需要外部账号）

| 缺口 | 补什么 | 落点 / 责任面 |
| --- | --- | --- |
| 隐私政策 URL 404 | 把 `https://aizhs.top/privacy` 改为 `https://aizhs.top/agreement/privacy`（单一真源，不在各店复制） | `scripts/prepare-store-bundle.mjs`（工程侧） |
| 各店截图打包 | 以现成 1080×1920 四张为基础，按店建目录并补 feature graphic/尺寸导出 | `apps/mobile-rn/store-assets/<vendor>/`（工程侧） |
| 副标题/简介/关键词/更新说明 | 建一份商店文案单一真源（按各家字数上限校验），不要散在各店脚本里 | 文案 + `scripts/data`（产品/工程） |
| App 内营业执照数据可疑 | 信用代码/登记机关与吉林主体不符，形如占位值；对外材料以网盘原件为准 | 业务代码，本轮不动，另有线处理 |

### 7.2 必须由人（机主）在仓外补

| 缺口 | 谁补 | 去哪补 |
| --- | --- | --- |
| 六家 API 凭据 | 机主 | 华为 AGC「用户与权限 → Connect API」；OPPO 开放平台「我的API」；小米开发者站「自动发布接口」私钥+账号邮箱；荣耀「开放能力 → 凭证」；应用宝「账户管理 → API发布接口」 |
| 五家首包建应用 | 机主（运营） | 各家后台网页；应用宝必须先在后台成功上线后 API 才可用 |
| 各店开发者实名认证 | 机主 | 各家控制台（营业执照 + 对公/法人核验）；应用宝必须主账号 |
| 荣耀文档正文四段 | 机主（登录态） | 荣耀开发者文档登录墙后 |
| iOS 全套 | 机主 + 构建环境 | Apple Developer Program → 证书/描述文件 → EAS 或 macOS 构建 → App Store Connect |
| 三星首次上架 | 机主 | Samsung Seller Portal |
| APKPure | 机主 | developer.apkpure.com 门户，或开发者邮箱发函 |
| 软著更名批件 | 机主 | 中国版权保护中心；批件到件后先做名称对账 |
| 深度合成/算法备案 | 机主 | 网信办算法备案系统；状态仓内无证据 |
| 四项 ICP 口径裁定 | 机主/产品 | 裁定后同步 `docs/engineering/icp-record-content-diff-2026-11-08.md` 与两端共享屏 |

---

## 8. 方法、证据与限制

- 产物元数据用 `.android-toolchain/android-sdk/build-tools/36.0.0/aapt2.exe dump badging` 与 `apksigner verify -v --print-certs` 现读；未执行任何 `gradlew` 构建。
- 凭据三态与平台字段缺项来自 `scripts/data/app-store-credentials.json`（本机 38,305 B，2026-11-09 生成读数）与 `scripts/lib/rn-release-credentials.mjs`；本文件不复制其判据，只引用结论。
- 法务链接状态为 2026-11-08 对 `https://aizhs.top` 的 HEAD 请求实测。
- 软著/营业执照原件为对 `D:/BaiduSyncdisk` 的只读存在性核对（含字节数），未复制、未上传。
- **本文件不含任何密钥、口令或凭据值**；仅登记"是否存在、在哪、是否被 gitignore 保护"。
- 不确定项一律未折算成"有"：Play Console 应用/分级状态、各家实名状态、EAS iOS 远端凭据、算法备案状态。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

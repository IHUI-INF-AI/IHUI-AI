# APK 自托管目录(2026-08-06 立)

**用途**:Android APK 不备案、不上架,直接放在本目录由网站同源分发,用户点击即下载安装(旁加载)。

## 使用步骤(3 步)

1. **放入 APK 文件**:把构建好的 APK 复制到本目录,建议命名为 `ihui-ai-latest.apk`:
   ```
   apps/web/public/apk/ihui-ai-latest.apk
   ```
2. **配置环境变量**(`apps/web/.env.production`):
   ```ini
   NEXT_PUBLIC_DOWNLOAD_APK_URL=/apk/ihui-ai-latest.apk
   NEXT_PUBLIC_DOWNLOAD_APK_VERSION=1.0.0
   NEXT_PUBLIC_DOWNLOAD_APK_RELEASE_DATE=2026-08-06
   ```
   - `APK_URL` 用**相对路径**(`/apk/...`)即同源下载,无需 CDN、无需备案、无需上架
   - 若 APK 放 CDN/对象存储,`APK_URL` 填完整 `https://...` 或改用 `CDN_BASE` + `APK_FILE_NAME` 拼接
3. **重新构建**:`pnpm --filter @ihui/web build:static`
   - 构建后访问 `/download/android-apk`,安卓端自动显示 APK 下载按钮 + 安装引导(含"允许未知来源"说明)
   - 核查:`node scripts/check-downloads-config.mjs` 确认 android 端已配置

## 合规提示(如实告知,不构成法律意见)

- 国内 Android **未备案直连下载**不符合工信部《App 备案管理办法》要求,存在合规风险(是否追责以监管实践为准)
- 用户安装第三方 APK 需在系统设置中开启"允许未知来源"
- 本目录方案仅解决**技术分发**问题,合规决策由你方自行评估

## 版本更新

替换 APK 文件 + 更新 `NEXT_PUBLIC_DOWNLOAD_APK_VERSION` / `RELEASE_DATE` → 重新 build 即生效(下载页展示新版本号与日期)。

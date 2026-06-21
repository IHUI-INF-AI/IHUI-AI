# 生成 Google Play 上架用 AAB 包

## 重要说明

- **APK 不能直接“转成”AAB**。AAB 必须从项目源码重新打包，不能由现有 APK 转换。
- 本工程使用 **HBuilderX 云打包** 时，选择 **「GooglePlay」渠道** 即可得到 `.aab` 文件，用于 Google Play 上架。

## 操作步骤（HBuilderX）

1. 用 **HBuilderX** 打开本项目（不要用 VS Code 的发行菜单）。
2. 菜单栏选择：**发行** → **原生 App-云打包**。
3. 在打包界面：
   - **Android 包名**：保持与现有一致（如 `zh.ai.sq`）。
   - **渠道**：选择 **GooglePlay**（选此渠道后会自动生成 AAB，而不是 APK）。
   - 证书：使用与当前 APK 一致的 **Android 签名证书**（Google Play 上架必须用同一 keystore）。
4. 点击 **打包**，等待云端打包完成。
5. 打包完成后，在 **unpackage/release/** 下会得到 **`.aab`** 文件（名称类似 `__UNI__3C03560_xxx.aab`），该文件即可上传到 Google Play 控制台。

## 注意事项

- **AAB 仅用于上传 Google Play**，不能直接安装到手机。若要在真机测试，可用 [bundletool](https://developer.android.com/studio/command-line/bundletool) 将 AAB 转为 APKS 再安装。
- 选择 GooglePlay 渠道后为**传统打包**（非安心打包）。
- 确保 `manifest.json` 中 `app-plus.distribute.android.targetSdkVersion` ≥ 30（当前已为 30，符合要求）。

## 参考

- [DCloud：Google Play 上传应用要求 AAB 格式说明](https://ask.dcloud.net.cn/article/39052)

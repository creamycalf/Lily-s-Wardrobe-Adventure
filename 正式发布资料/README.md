# 《莉莉的衣橱冒险》正式发布资料

这是项目中唯一的正式发布资料入口。换机器时应把本目录整体复制，但包含密钥和 SDK 的副本必须使用加密介质传输。

## 目录说明

- `01-私密签名/`：永久正式签名和本地凭据。正式 Android 构建从这里读取。
- `02-3839-SDK私密文件/`：3839 AAR 和原始 SDK 资料。公共 Git 不保存二进制文件。
- `03-正式安装包/Android/`：以后生成的正式签名手机/PAD APK。
- `03-正式安装包/Windows/`：以后生成的 Windows 正式便携包。
- `04-发布记录/`：可提交 Git 的版本、指纹、哈希和发布说明。

当前整个正式发布资料目录约 766.76 MiB。换机复制后请使用 `04-发布记录/文件校验清单.md` 核对签名、SDK 和成品文件。

测试签名 APK、调试包和历史预览包仍放在项目根目录 `releases/`，不要提交给商店。

## 正式构建

当前线上候选手机包的 `versionCode` 是 7。下一次构建必须显式使用大于 7 的整数：

```powershell
$env:PATH = "$PWD\.toolchains\node-v22.13.1-win-x64;$env:PATH"
$env:LILY_ANDROID_VERSION_CODE = "8"
& ".\.toolchains\node-v22.13.1-win-x64\npm.cmd" run build:mobile
```

正式 Android 包会自动进入 `03-正式安装包/Android/`。若缺少完整签名配置，脚本只生成测试签名包并放回 `releases/`。

Windows 构建：

```powershell
$env:PATH = "$PWD\.toolchains\node-v22.13.1-win-x64;$env:PATH"
& ".\.toolchains\node-v22.13.1-win-x64\npm.cmd" run build:pc
```

Windows ZIP 会自动进入 `03-正式安装包/Windows/`。

## 安全规则

- 不要把 `01-私密签名` 的 JKS、JSON 或密码上传到 Git、聊天或公开网盘。
- 不要重新生成签名；已发布应用后续更新必须使用同一 JKS。
- 不要把 `02-3839-SDK私密文件` 的 AAR 和原始 SDK 上传公共 Git。
- 每次发布后在 `04-发布记录/` 新增版本记录，写明 versionCode、APK SHA-256 和证书 SHA-256。

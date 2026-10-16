# 3839 防沉迷 SDK

本目录使用好游快爆官方 `OperateSDK 1.4.4.4（2026-04-15）` 中的以下原始文件：

- `hykb-common.aar`
- `hykb-login.aar`
- `hykb-anti.aar`
- `hykb-single.aar`

官方 SDK 下载页：<https://open.3839.com/console/docs/#/service/sdk>

Git 仓库只保留本说明，不保存 AAR / JAR。克隆后需从官方授权来源恢复上述四个文件；原生防沉迷桥直接引用 SDK Java 类型，缺少这些 AAR 时 Android 工程无法完成编译。网页与 Windows 构建不依赖这些 AAR。

游戏 ID 配置为 `45613`。官方 INI 配置已内置在对应 AAR 的 `assets` 中，不要重命名 AAR，也不要换用第三方转载包。

构建后仍需在真机完成：同意隐私政策、实名认证成功、未成年人受限时段、取消认证、断网重试和平台要求退出等测试，并录制平台审核视频。

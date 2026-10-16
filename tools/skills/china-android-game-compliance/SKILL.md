---
name: china-android-game-compliance
description: Prepare or audit Android games for distribution on mainland-China game platforms when age guidance, privacy consent, real-name authentication, anti-addiction SDKs, platform declarations, or compliant APK builds are involved. Use for new games and compliance updates; verify each platform's current official requirements instead of assuming one platform's SDK applies to another.
---

# 国内安卓游戏合规接入

把“代码接入、平台后台配置、真机验证、正式签名构建”视为四项独立工作。不得因其中一项完成而宣称全部完成。

## 开始前

- 查明目标平台、联网方式、包名、游戏 ID、屏幕方向、最低年龄建议和当前签名状态。
- 读取目标平台最新官方文档和当前账号后台；SDK、表单与政策会更新，不依赖搜索摘要或旧项目文件。
- 只使用官方 SDK 原包。检查版本、更新时间、校验值、模块名、接口签名和示例工程。
- 不把某个游戏的 ID、包名、密钥、隐私主体或签名复用于其他游戏。

## 游戏内必须覆盖

### 隐私同意

- 首次启动先显示隐私弹窗，再初始化防沉迷、统计、广告、登录或其他可能联网/读取设备信息的 SDK。
- 提供清楚的同意、不同意/退出、隐私政策入口；同意记录应带政策版本，政策变更后重新确认。
- 权限按功能需要再申请；不得用默认勾选、模糊文案或不同意后仍继续初始化 SDK。
- 主界面或设置中保留隐私政策入口。

### 适龄提示

- 按游戏实际内容和平台规则确定等级，不机械沿用其他游戏的等级。
- 在启动页或主界面展示清晰标识，并在平台资料、截图和文字说明中保持一致。
- 适龄提示不等于实名认证，也不能替代防沉迷。

### 实名与防沉迷

- 在隐私同意后、进入实际玩法前调用目标平台指定的实名认证/防沉迷 SDK。
- 处理成功、失败、取消、断网、服务未开通、受限时段、时长耗尽和平台要求退出；失败时不得绕过进入游戏。
- 按 Activity/应用生命周期释放 SDK；保留平台返回码和安全日志，但不记录身份证号等敏感明文。
- Web、PC 或海外发行是否需要同一 SDK，应按对应渠道判断，不把安卓渠道逻辑强行套用。

## 3839 / 好游快爆

- 官方文档入口：<https://open.3839.com/console/docs/#/service/sdk>。
- 每次接入先核对官方最新版本。2026-04-15 的 `OperateSDK 1.4.4.4` 中，单机防沉迷使用 `hykb-common.aar`、`hykb-login.aar`、`hykb-anti.aar`、`hykb-single.aar`；版本更新后以官方包为准。
- 新版单机接口使用 `UnionFcmParam.Builder` 和 `UnionFcmSDK.init(Activity, UnionFcmParam, UnionV2FcmListener)`；必须从实际 AAR 或官方示例再次确认，不靠反射猜接口。
- AAR 中已经带有相应 INI assets 时不要重复放置或使用其他游戏的配置。
- 后台必须为当前游戏单独开通平台防沉迷服务。代码编译成功不代表后台服务已开通。
- `45613` 仅属于“莉莉的衣橱冒险”，绝不能作为其他游戏的默认游戏 ID。

## 构建与验收

- 核对 `applicationId`、版本号、方向、Manifest 权限、网络安全配置、SDK 资源合并及重复类问题。
- 分别构建实际需要的手机版和 PAD 版；平台提交包必须使用对应正式签名，debug 签名只能测试。
- 检查成品 APK/AAB 内确实包含所需 SDK 类与 assets，并记录包名、版本、文件大小和 SHA-256。
- 真机至少验证：首次同意、拒绝退出、再次启动、成人实名、未成年人限制、取消认证、断网重试、受限时段、平台强制退出、隐私政策再次访问。
- 涉及广告时，确认广告 SDK 在同意后初始化，并检查平台及广告网络对未成年人的限制。
- 最终报告分别列出：已改代码、已完成后台事项、自动测试结果、真机待测项、正式上架仍缺事项。无法验证的内容明确标为待确认。

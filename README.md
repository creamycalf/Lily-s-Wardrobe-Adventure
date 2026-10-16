# 莉莉的衣橱冒险 · Lily's Wardrobe Adventure

以推箱子解谜和服装收集为核心的休闲游戏。当前源码版本为 **v0.2.0**，包含 **100 关、10 个章节、21 套服装**，提供网页、Android 手机 / PAD 与 Windows 构建入口。

![游戏画面](docs/3839-assets/game-cover-1280x720.jpg)

## 本地运行

需要 Node.js **22.13.0 或更高版本**和 npm。请先确认 `node --version`，不要使用 Node 20。

```bash
npm ci
npm run dev
```

打开终端显示的本地地址。游戏使用 React、TypeScript 和 Vite / vinext；关卡进度保存在设备本地，不提供云存档。

## 检查与构建

| 命令 | 用途 |
| --- | --- |
| `npm test` | 网页构建、100 关解法验证、关卡差异检查和自动测试 |
| `npm run lint` | 静态代码检查 |
| `npm run build` | 构建 vinext 网页，输出 `dist/` |
| `npm run build:android:web` | 构建静态 H5，输出 `dist-android/` |
| `npm run build:mobile` | 构建 Android 手机 APK |
| `npm run build:pad` | 构建 Android PAD APK |
| `npm run build:pc` | 构建 Windows x64 便携版 |

H5 部署需要上传整个 `dist-android/`，不能只上传 `index.html`。Windows 打包脚本使用 PowerShell 和 Electron，需要在 Windows 环境执行。

### Android 构建前提

仓库保留 Android 原生工程、隐私同意和 3839 实名认证 / 防沉迷桥接源码，**不包含渠道 SDK、发布密钥或本机工具链**。克隆后仅安装 npm 依赖并不足以构建当前渠道 APK。

当前 Android 打包脚本面向 Windows，使用以下项目内目录：

- `.toolchains/jdk-21.0.9-lite/`
- `.toolchains/gradle-8.14.3/`
- `.toolchains/android-sdk/`

需从渠道官方授权来源取得 SDK，将对应 AAR 放到 `android/app/libs/`，详见该目录的说明。不要把 AAR 上传到公共仓库。

正式发布必须恢复原有永久证书及独立保管的凭据，位置为 `正式发布资料/01-私密签名/`。也可通过 `LILY_RELEASE_KEYSTORE`、`LILY_RELEASE_KEYSTORE_PASSWORD`、`LILY_RELEASE_KEY_ALIAS`、`LILY_RELEASE_KEY_PASSWORD` 配置；不要将其值写入源码。缺少完整签名配置时，构建脚本只生成测试签名包，不能用于商店更新。

当前正式手机候选包的 `versionCode` 为 **7**。下次手机正式构建必须显式设置更高的版本号，例如在 PowerShell 中：

```powershell
$env:LILY_ANDROID_VERSION_CODE = "8"
npm run build:mobile
```

正式 APK 和 Windows ZIP 输出到 `正式发布资料/03-正式安装包/`；测试 APK 输出到 `releases/`。以上成品均不进入 Git。

## 源码与交接资料

- `components/`、`lib/`：游戏界面、关卡规则、音频及平台合规逻辑。
- `app/`：网页入口和隐私说明页面。
- `public/art/`、`public/art-v2/`、`public/art-v3/`、`public/audio/`：运行时美术与音频。
- `android/`、`desktop/`：原生 Android 工程和 Electron 入口。
- `scripts/`、`tests/`：构建、素材处理、关卡验证与自动测试。
- `docs/`：视觉回归截图、平台材料和历史记录。

继续开发时优先阅读 [最新换机交接总文档](项目总文档_换机交接与继续开发.md)（基准日期 2026-10-15）以及 [正式发布资料说明](正式发布资料/README.md)。旧文档包含历史状态；与最新总文档冲突时，以总文档和实际代码为准。

## 发布状态与安全边界

源码包含 3839 实名认证与防沉迷接入，但真机合规验收、长期稳定的 HTTPS 隐私政策地址及平台审核尚未全部完成。网页内隐私页面不等于已经部署的公网政策链接，自动测试通过也不等于通过商店审核。

Git 仓库不包含正式签名、凭据、渠道 SDK、安装包、依赖缓存、本机配置、原始生图和视频工作文件。需要完整换机时，应另外通过加密方式迁移私密材料和本地素材归档；仅克隆仓库不能恢复全部发布环境。不要重新生成已经使用过的永久发布证书。

仓库未授予开源许可；源码、美术、音频及第三方 SDK 的使用和再分发需分别确认授权。

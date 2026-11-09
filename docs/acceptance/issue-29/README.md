# Issue #29：移动端体验修复验收

需求：[tudousir123/Metvage#29](https://github.com/tudousir123/Metvage/issues/29)。

代码核验范围为 `0174c80..7d7ba88`；此后的提交仅保存验收资料。真机与自动化执行日期为 2026-11-09（北京时间）。

## 修复前后

| 场景 | 修复前 | 修复后 |
| --- | --- | --- |
| 新建、编辑退出 | 系统返回绕过取消提醒，未保存文字丢失 | 取消与系统返回共同经过退出保护；支持继续编辑、明确放弃，新建时可存草稿并离开 |
| 保存与评论 | 快速重复点击可能在组件更新前发起多个请求 | 同步提交锁立即拦住重复点击；失败保留文字和创建请求标识 |
| 宠物公开档案 | 主人搜索自己的宠物时能看到私人记录 | 只展示公开笔记；主人时间线仍包含私人记录，认证和屏蔽规则保留 |
| 评论键盘 | 1.45 倍字体下发送操作被输入法遮挡 | 按实测操作区高度预留键盘净空，打开键盘时即可发送 |
| 设置与导航 | 旧账号社交隐私入口、强制 HTTPS；编辑保存重复堆叠时间线 | 入口匹配宠物与记录模型，网页沿用当前实例地址；保存/删除返回已有时间线 |

## 自动化与构建证据

- **Before:** [旧版本回归输出](regressions-before.txt)。当前测试运行于 `0174c80` 的独立副本，退出保护、重复评论、公开档案相关场景出现 17 项行为失败。旧设置页另有 `matchMedia` 测试环境错误，未将该错误计为产品缺陷证据。日志中的本机路径已归一化。
- **After:** [Jest 全量输出](jest-after.txt)，11 套件、72 项测试通过。执行命令：`npx jest --runInBand --watch=false`。
- **After:** [类型检查输出](typecheck-after.txt)，`npm run check:ts` 无新增诊断；当前和基线均为 2282 项既有诊断，并非零类型错误。
- **After:** [Android 导出输出](android-export.txt)，`METVAGE_LOCAL_TEST=1 CI=1 npx expo export --platform android --max-workers 2 --output-dir <android-export>` 成功生成 Hermes bundle。
- **关联 Server 验证:** [真实 HTTP 核验输出](api-check.txt)覆盖非主人/访客读取、私人搜索边界、越权编辑、记录与评论防重、编辑持久化、真实通知及可见范围往返。相关 `PetRecordApiTest.php`、`PetInteractionApiTest.php`、`PetSearchApiTest.php`、`PetNotificationApiTest.php` 共 12 项测试、268 个断言通过；显式使用 `APP_ENV=testing DB_CONNECTION=sqlite DB_DATABASE=:memory:`，未刷新真机使用的数据。这些 Server 测试是关联验证，本 PR 不改 Server 代码。

现有 GitHub Actions 的 PR 触发条件只覆盖 `main`。本 PR 的目标为 `codex/metvage-v1`，因此上述结果为已执行的本地证据，不能表述为 GitHub CI 已通过。

## 真机证据

使用现有 14 Ultra 独立测试 App 和本地真实 Server，设备型号 `24031PN0DC`，当前 Android 16 / API 36，系统字体倍率 1.45，1440×3200、密度 560。没有重装 APK 或清除登录数据。

| 退出确认 | 请求失败后保留文字 | 评论发送位于键盘上方 |
| --- | --- | --- |
| ![退出确认](new-cancel.png) | ![发布失败后保留内容](publish-network-failure.png) | ![生成宠物图的评论键盘](comment-keyboard-pudding.png) |

评论发送按钮底部为 1889，键盘顶部为 1971，见[布局断言输出](keyboard-layout.txt)。键盘截图在同一天更换生成宠物素材后补拍；自动化和主体流程在更换素材前完成，没有将两次截图当作相同测试数据。截图中的账号、宠物与文字均为测试素材；没有发布用户原有的随拍照片。

已实际检查：浏览与搜索、主人宠物时间线、公开档案过滤、新建/编辑退出、草稿保存恢复、断开本地服务后发布和评论失败再重试、跨账号真实通知打开、私信未开放入口、宠物设置、屏蔽关系、HTTP 法律页和退出登录取消。发布与评论成功后均用新 API 请求确认只生成一条内容；编辑后确认持久化，时间线返回未重复堆叠。

临时测试记录、评论、通知已清理；临时令牌已撤销，App 登录会话保留。测试期间亮屏设置恢复原值 2，字体、分辨率和密度保持原值。后续按用户要求将占位宠物改名“布丁”“栗子”，使用生成的宠物封面，并删除两张原上传随拍；栗子封面记录仅自己可见。

未覆盖 iOS、重新安装或正式签名 APK、其他输入法、真实运营网络丢包；访客权限本轮通过实际 HTTP 验证，没有退出手机原账号重走访客流程。端口断开仅用于请求失败与恢复验证。

服务端法律正文仍为旧模板，由 [tudousir123/Metvage#31](https://github.com/tudousir123/Metvage/issues/31) 单独跟踪人工确认；本 PR 修复链接策略，没有替换政策正文。

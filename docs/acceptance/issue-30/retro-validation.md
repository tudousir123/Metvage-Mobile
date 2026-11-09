# #30 复盘改进落地

用户要求将本轮五项复盘建议全部落实。本次实现位于原 Mobile PR #2：`c934f7f` 实现主体，`e6f63a5` 修复评审发现的边界问题。应用 UI 部分继续使用原 #30 实现。

## 五项改进

| 建议 | 最终实现 | 验证 |
| --- | --- | --- |
| 确认 App 加载本轮代码 | `launch` 从已安装包读取 scheme，等待 Metro，要求开发 bundle 回传本轮随机标识、源码指纹和原生包名，再等首页就绪。`run`/`replay` 始终校验源码及 App/Metro 进程，执行后复核；源码改变或进程重启须重新启动。正式构建不发送回传，没有产品诊断 UI。 | 原生 14 Ultra 成功回传最终 bundle；真实子进程/HTTP 回归验证旧源码回传、源码修改和 App 重启均不能放行。 |
| 去重控件定位 | 按可访问性标识、ID、文字收集候选，合并同一可点击祖先；两个不同控件同名时继续拒绝点击。`inspect` 只输出目标元数据。 | 父子重复节点可点击、两种属性混合的不同按钮仍有歧义；稳定目标只读取两份 UI 树。 |
| 返回后确认状态 | `back`/`open` 必须声明页面或键盘后置条件。整个组合计划先校验；变量只展开一次，并在设备操作前再次校验。空标签、非法滑动/路径/文件名等均拒绝执行。 | 回归先复现缺少后置条件和空标签错误，再验证无输入发生；延迟返回期间下一条输入会等待。 |
| 保存可重放流程 | 版本化 `secondary-acceptance.json`，顺序组合生成照片、公开/私人档案、评论、网络恢复、消息/设置和社交控件。一次 `replay` 管理临时素材、设备操作与精确清理；另有只读 `verify-api`。 | 真机完整 46 步通过，评论单条持久化，私人记录保护有效；失败注入也会清理本轮资源、恢复端口/设置并撤销令牌。 |
| 降低工具成本 | 每步记录总耗时、ADB 次数/耗时、UI 树读取次数；稳定点击复用同一步观测。已在前台时复用 Activity。`discover` 找真实路径和安装包 scheme；`pr-status` 裁剪正文；开发指南指向运行说明。 | 指标实际写入真机事件日志；目标诊断不会输出完整页面内容；未知模拟适配器在任何设备命令前被拒绝。 |

实现与使用入口：[本地真机验收](../../local-acceptance.md)、[启动与运行证明](../../../scripts/acceptance/launch.py)、[计划校验与展开](../../../scripts/acceptance/plans.py)、[设备操作](../../../scripts/acceptance/device.py)、[组合计划](../../../scripts/acceptance/plans/secondary-acceptance.json)。

## 真机与实际 HTTP

环境仍为 14 Ultra / Android 16 / API 36，1440×3200、560 dpi、字体 1.45。复用既有独立测试 App、测试登录与真实本地 Server，没有重装或清除 App 数据。

- [完整重放](retro/phone-replay.txt)：46 步、301.34 秒通过，99 次 UI 树读取、591 次 ADB 调用。涵盖真实照片、仅私人记录的公开档案、评论键盘/发送、端口断连与重试、消息、设置/法律入口、48 点社交按钮和屏蔽确认取消。
- [最终开发 bundle 启动](retro/phone-launch.txt)：安装包实际 scheme 为 `metvagephone`；App 回传源码指纹并进入首页。最终 JavaScript 指纹以 `166fb69f8441` 开头，完整值见日志。
- 完整重放在工具迭代阶段执行，其 JavaScript 指纹以 `2dbb8b41dc55` 开头；最终回传模块另补了错误 JSON 结构的防御并重新完成冷启动回传。各运行版本与结果分别记录在[设备历史](retro/device-results.json)中。
- [跨账号 HTTP](retro/http-verification.txt)：主人、另一账号与访客的私人读取、公开时间线和搜索权限通过。临时令牌在退出时撤销。
- 临时生成宠物、记录及其评论已清理；原有布丁/栗子、当前宠物选择和原登录保留。设备恢复日志均没有待恢复状态，字体仍为 1.45、亮屏恢复 2。

实际截图：[键盘发送](retro/comment-keyboard.png)、[仅有私人记录时的公开档案](retro/private-only-profile.png)、[请求失败](retro/search-failure.png)、[设置](retro/settings.png)。截图均来自指定测试 App，使用生成的测试宠物照片。

原两次补充 smoke 因手机切到其他 App 被前台保护停止，UI 读取次数均为 0；没有截图，不计为通过。2026-11-09 已重新冷启动并连续补跑同一计划两次，均完整通过，详见下方补验。另一次计划把滚出视口的评论正文作为“关闭键盘”的条件，被后置条件检查阻止，已改为键盘状态检查并由 API 核验评论。所有尝试的成功/失败和恢复结果均保留，没有把清理成功改写为验收通过。

### 2026-11-09 补验

在 PR 提交 `beaad8a` 上重启本工作树 Metro，测试 App 冷启动实际回传源码指纹 `166fb69f844143cbe8af8526415f5093c2bd220e3a1338780eb9872effbfadb6` 并到达首页，用时 43.63 秒。随后原样执行版本化的 `scripts/acceptance/plans/smoke.json`，没有修改计划或关闭前台保护。

| 运行 | 结果 | 耗时 | ADB 调用 | UI 树读取 |
| --- | --- | --- | --- | --- |
| `retro-supplement-smoke-1` | 3/3 步通过，来源前后校验通过 | 22.86 秒 | 55 | 7 |
| `retro-supplement-smoke-2` | 3/3 步通过，来源前后校验通过 | 22.23 秒 | 55 | 7 |

两次均完成点击首页、确认搜索入口、稳定截图：[第一次截图](retro/smoke-home-1.png)、[第二次截图](retro/smoke-home-2.png)。[补验完整事件与结果](retro/supplement-results.json)包含计划 SHA、实际代码提交、源码回传、每步指标和恢复结果；[截图哈希](retro/screenshots.sha256.json)覆盖本目录全部六张 PNG。

启动与两次补验均为 `restoration_pending: false`；另用 ADB 读取确认字体仍为 1.45、亮屏设置恢复为 2，端口转发仍为原有 8081/18080。补验没有创建或修改宠物、笔记或评论；原两次停止记录继续保留在设备历史中。

## 自动化与回归敏感性

- [应用测试](retro/jest.txt)：12 套件、78 项通过，包含开发回传、生产禁用、远程/非法输入及请求失败不影响启动。
- [工具测试](retro/tool-tests.txt)：32 项通过，覆盖真实子进程和本地 HTTP、来源验证、设备独占、计划绑定、失焦/中断恢复、素材清理和已有 CI 契约。
- [类型与格式检查](retro/check.txt)：类型保持 2269 项既有诊断，无新增；Biome 无错误、89 项既有警告。
- [Android 导出](retro/android-export.txt)：Hermes bundle 导出成功。

失败证据：[控件/返回](retro/red-device.txt)、[缺少启动握手](retro/red-launch.txt)、[重放清理接口](retro/red-replay.txt)、[子计划校验](retro/red-includes.txt)、[混合属性同名按钮](retro/red-mixed-targets.txt)、[短暂无焦点](retro/red-focus.txt)、[错误 JSON 结构](retro/red-proof-shape.txt)、[启动抢占服务](retro/red-busy-launch.txt)、[操作参数](retro/red-plan-fields.txt)、[展开后的空标签](retro/red-expanded-condition.txt)、[未知适配器](retro/red-adapter.txt)、[重复启动 Activity](retro/red-activity.txt)。

“短暂无焦点”的敏感性在隔离副本中用原 `foreground` 实现验证；其他 App 的真实焦点仍立即拒绝。常规验收入口没有 `driverOnly` 绕过；无 Metro 的模拟驱动契约测试放在测试专用入口，并要求模拟适配器握手。

## 评审与范围

规范轴最初发现启动先修改服务再取锁、操作参数预校验不全；规格轴发现模拟模式可绕过来源验证、空标签可放行。均已先补失败回归，再修复。对 `c934f7f...e6f63a5` 的复核结果：规范轴 0 项、规格轴 0 项未解决问题。

本轮增加的是开发验收能力；没有数据库迁移或 API/权限模型变更。既有 CI 已执行应用、类型、Biome 与工具测试，本次沿用这些工作流。iOS、新安装/正式签名 APK、其他输入法及真实运营网络丢包仍未覆盖；法律正文继续由 Metvage #31 单独确认。

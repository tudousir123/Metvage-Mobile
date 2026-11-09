# #17 跨账号与 Android 真机验收

关联 [Metvage #17](https://github.com/tudousir123/Metvage/issues/17)，2026-11-09，Asia/Shanghai。基点 Mobile `273ece5055dfd3613097c431eb88d85cc33c1f0f`；Server `b7d0dadf8996289b3492a9b24c5a7bfaf4f5647f`。完整 A01–A09 矩阵在 Docs 仓库的 `docs/acceptance/metvage-v1-issue-17-2026-11-09.md`。

当前为待真机续验的草稿交付。USB 已断开，用户选择“稍后连接，先继续独立工作”。这里只把实际通过的操作算作通过；计划文件、HTTP 测试及旧版截图不能替代尚未执行的当前真机操作。产品签收人、社区维护人员均待指定。

## 环境与证据读法

实体 Xiaomi 14 Ultra，Android 16 / API 36，1440×3200，560 dpi，系统字体 1.45。两个独立的既有 arm64 调试包运行同一工作树的新 Metro bundle；没有新装 APK。API 为仅 loopback 的本地真实 Server、SQLite 和 Redis；凭据、邀请码、设备序列号及原始存储备份不发布。

U1 为既有测试主人；U2 为本轮通过手机浏览器邀请表单注册、再完成 App OAuth 的另一账号。U2 的猫 `17Cat`、狗 `17Dog` 仅填昵称建档。四次照片上传均来自本轮生成猫图，私人狗时间线也使用同一生成照片作为上传测试素材；这不表示照片内容与关联宠物相同。

- [所有调用结果](run-index.json)：保留每次调用的状态、耗时和 invocation ID；失败及中断没有被覆盖成通过。
- `runs/`：各调用的脱敏摘要、源码指纹、计划 SHA 和逐步结果。`step` 事件才证明具体 UI 操作执行；HTTP 断言另行标识。
- 已用邀请拒绝的原截图含已耗尽的一次性邀请码，未发布该图；只保留脱敏步骤与注册读回，不重绘证据。
- [截图指纹](screenshots.json)：截图均为测试 App 前台保护下的原始 PNG 拷贝，没有裁切或重绘。照片文件经系统重编码后 SHA 改变，但四次上传的解码 RGBA 像素与生成原图完全一致，见 [像素验证](runs/issue17-http-pixels.json)。
- 手机切到其他 App 时工具停止，恢复本轮设备设置；不读取或截图其他 App。此类调用不计通过。

## 已补的实际操作

| 检查 | 证据 |
| --- | --- |
| 访客公开流、笔记、档案；私人拒绝；互动登录引导；无效邀请 | [20 步](runs/issue17-guest-2.json)、[公开笔记](guest-2-guest-public-note.png)、[私人拒绝](guest-2-guest-private-denied.png) |
| 手机实际邀请注册、App OAuth、已用邀请拒绝 | [注册](runs/issue17-browser-register.json)、[OAuth 各次调用](runs/issue17-u2-login.json)、[已用邀请拒绝步骤](runs/issue17-used-invitation.json) |
| 无宠浏览、点赞/关注/发布门槛；昵称建猫狗 | [14 步](runs/issue17-no-pet-final.json)、[建档](runs/issue17-create-profiles.json)、[两宠](create-profiles-nickname-only-cat-and-dog.png) |
| 纯文字、纯照片、图文 × 公开/私人六类保存 | [文字](runs/issue17-text-records-final.json)、[公开照片重试](runs/issue17-photo-public-retry.json)、[私人照片](runs/issue17-photo-private-save.json)、[公开图文](runs/issue17-mixed-public-save.json)、[私人图文](runs/issue17-mixed-private-save.json)、[六条持久化与跨账号/访客权限](runs/issue17-http-records.json) |
| 照片失败保留、恢复后只保存一条 | [失败截图](photo-public-retry-photo-upload-failure-retained.png)、[保存后](photo-public-retry-saved-photo-record.png)、[逐步结果](runs/issue17-photo-public-retry.json) |
| 档案编辑、猫狗外物种申请回执及真实团队读取 | [14 步](runs/issue17-profile-species-final.json)、[公开介绍](profile-species-final-edited-cat-profile.png)、[回执](profile-species-final-species-request-received.png)、[HTTP 权限](runs/issue17-http-species.json) |
| 猫身份关注、关注流、点赞、评论、三种通知持久化 | [前九步成功、返回步骤失败](runs/issue17-social.json)、[关注流](social-following-feed.png)、[真实 App token 读回](runs/issue17-http-social.json)。评论已创建，续验不得重复提交或切换点赞状态 |

## 导航问题与回归

重复打开外部深链，在 SDK 52 / react-native-screens 4.4.0 / Fabric 的现有包上出现 Fragment 未挂载、原生视图已有父容器和白屏。实际 App OAuth 仍可通过 HTTP 身份核验，不能把白屏归因于会话失效。

- 原五步循环交替打开宠物时间线与档案编辑，失败在稳定可见内容检查：[修正前](runs/issue17-navigation-loop-before.json)、[原生错误](regression/native-navigation-before.txt)、[错误截图](navigation-error-native-navigation-error.png)。
- 通过 URL 传 Router 私有 key 的尝试失败；独立入口转发原型也失败，均已撤回，不能当成修复证据。
- 中间候选对 Android 暖启动业务深链使用 `router.dismissTo`。窄范围实现的相同五步真机循环通过 18.58 秒：[实测](runs/issue17-navigation-pop-to.json)。扩大到其他业务路由并格式化后的同一循环也通过 18.60 秒：[第二次实测](runs/issue17-navigation-final-loop.json)。但真实社交流程在返回步骤后进入其他 App，说明只测向前导航不够；`dismissTo` 候选已撤回。
- 最终提交候选改为公开 `router.push`，创建新的原生页面并保留返回历史，同时处理两种自定义 scheme URL 形式。冷启动、OAuth `/login`、iOS、HTTP(S) 与分享入口保留已有处理。**最终候选还未加载到真机**：启动前已断连，[停止结果](runs/issue17-push-final-launch.json)。新增八步 [导航与返回计划](../../../scripts/acceptance/plans/issue17-navigation-back-loop.json) 尚未执行，必须通过后才能宣称修复。
- 中间九项路由契约测试验证查询参数、冷启动/OAuth/iOS/分享边界：[先失败](regression/native-intent-red.txt)、[修正后](regression/native-intent-green.txt)。最终 16 项契约测试补充了保留返回栈的调用语义、根页面和 scheme 形式：[返回语义红](regression/navigation-back-red.txt)、[根路由红](regression/root-link-red.txt)、[最终绿](regression/root-link-green.txt)。这些测试不模拟原生视图挂载，不能替代真机循环。

相关上游调查仅用于形成假设：[react-native-screens #2578](https://github.com/software-mansion/react-native-screens/issues/2578)、[Expo 原生深链入口说明](https://docs.expo.dev/router/advanced/native-intent/)。本报告不宣称已证明上游全部根因。

## 代码回归

终端输出仅脱敏路径、移除 ANSI 颜色和尾随空白；未修改测试名称、计数或结论。

- [Mobile Jest 最终](regression/mobile-tests-final.txt)：13 个文件，94 项通过。之前 87 项的输出保留在 [中间版本](regression/mobile-tests.txt)。
- [验收工具](regression/tool-tests.txt)：35 项通过；新增文本替换与清空、非法计划提前拒绝、全选后失去前台时禁止删除。相关 [红](regression/replace-red.txt)、[前台保护红](regression/replace-focus-red.txt)、[绿](regression/replace-green.txt) 保留。
- [类型与 Biome 最终](regression/check-final.txt)：原有 2,269 条类型诊断，无新增；Biome 无错误，88 个既有警告。
- [Android Hermes 最终导出](regression/android-export-final.txt)：成功。它证明 JS 导出，不表示新原生 APK 构建或商店签名通过。
- Server 另一个隔离容器运行 23 个相关 HTTP Feature 文件：79 passed / 911 assertions，未使用真机数据库；日志和 1,427 文件源码比对存于 Docs 仓库。

剩余真机步骤与数据恢复见 [续验清单](continuation.md)。最终候选 App 源码指纹 `07b6e5e8aa88c34c64854e72056ba6dccc479b89ddaa79084be36f97eefe7099`，仅通过本地代码回归；尚无该指纹的真机回传。

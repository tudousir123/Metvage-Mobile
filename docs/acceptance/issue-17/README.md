# #17 跨账号、真机与模拟器验收

本轮开始于 2026-11-09（Asia/Shanghai），关联 [Metvage #17](https://github.com/tudousir123/Metvage/issues/17)。用户后来要求拿走手机休息，并授权改用模拟器继续。现有 **35 张真机原图 + 39 张明确标注的模拟器原图**；模拟器补验不冒充真机通过。完整 A01–A09 矩阵在 Docs 配套 PR。

Mobile 基点 `273ece5055dfd3613097c431eb88d85cc33c1f0f`；Server `b7d0dadf8996289b3492a9b24c5a7bfaf4f5647f`。最终 App 源码指纹 **`07b6e5e8aa88c34c64854e72056ba6dccc479b89ddaa79084be36f97eefe7099` 已实际加载到真机及两个模拟器**。本次续验没有再修改产品 JS；仅补计划后置条件、证据和清理。

## 环境与读法

真机为 Xiaomi 14 Ultra，Android 16 / API 36，1440×3200、560 dpi、系统字体 1.45。沿用两个已安装的 arm64 调试包，没有在手机上安装新包。U1 为既有测试主人，U2 为本轮在手机浏览器实际邀请注册并完成 App OAuth 的第二账号。

- [真机调用索引](run-index.json)、`runs/`：77 组调用目录，包含失败、诊断和中断；目录数不等于通过数。每次完成调用保留独立 invocation ID、摘要和逐步结果，未覆盖失败为通过。
- [真机截图指纹](screenshots.json)：35 张原始 PNG，未裁切或重绘。含已耗尽邀请码的原图不发布，仅保留脱敏操作与注册读回。
- [模拟器结果](simulator/README.md)：两个本轮新建的本地 Android 16 x86_64 AVD，独立完成 U1/U2 真实浏览器登录与 App OAuth。37 组调用目录、39 张原图独立归档，不混入真机计数。
- 接入同一已验证 Metro 时，读取该进程的源码/回传配置，强制冷启动目标测试 App 并等待真实原生包名回传；证明端口只临时映射到目标设备。没有跳过运行证明或注入登录状态。
- 测试 API 是仅 loopback 的真实 Docker Server、SQLite 和 Redis。四次手机照片上传均来自生成猫图，私人狗时间线也用该图作为上传素材；不推断图片内容和关联宠物相同。系统重编码改变 PNG 字节 SHA，四次上传的解码 RGBA 像素与原生成图完全一致。

## 本轮真机补齐

| 操作 | 实际证据 |
| --- | --- |
| 访客公开流、照片笔记、档案；私人拒绝；登录引导；无效邀请 | [20 步](runs/issue17-guest-2.json)、[公开笔记](guest-2-guest-public-note.png)、[私人拒绝](guest-2-guest-private-denied.png) |
| 手机邀请表单注册、App OAuth、已用邀请拒绝 | [浏览器会话](runs/issue17-browser-register.json)、[注册读回](registration-result.json)、[OAuth](runs/issue17-u2-login.json)、[已用邀请](runs/issue17-used-invitation.json) |
| 无宠浏览/互动门槛；昵称建一猫一狗 | [14 步](runs/issue17-no-pet-final.json)、[建档](runs/issue17-create-profiles.json)、[猫狗档案](create-profiles-nickname-only-cat-and-dog.png) |
| 纯文字/纯照片/图文 × 公开/私人六类保存 | [文字](runs/issue17-text-records-final.json)、[公开照片重试](runs/issue17-photo-public-retry.json)、[私人照片](runs/issue17-photo-private-save.json)、[公开图文](runs/issue17-mixed-public-save.json)、[私人图文](runs/issue17-mixed-private-save.json)、[六条持久化与权限](runs/issue17-http-records.json)、[像素](runs/issue17-http-pixels.json) |
| 照片断连失败保留、恢复后单条保存 | [失败](photo-public-retry-photo-upload-failure-retained.png)、[保存](photo-public-retry-saved-photo-record.png) |
| 档案编辑、其他物种申请回执及团队读取 | [14 步](runs/issue17-profile-species-final.json)、[介绍](profile-species-final-edited-cat-profile.png)、[回执](profile-species-final-species-request-received.png)、[HTTP 权限](runs/issue17-http-species.json) |
| 猫关注/点赞/评论；狗切换/关注/取消/点赞/评论 | [猫原流程与返回失败](runs/issue17-social.json)、[猫断点补拍](runs/issue17-social-resume.json)、[猫互动](social-resume-peer-like-and-comment.png)、[切狗及取消](runs/issue17-switch-unfollow.json)、[狗实际提交](runs/issue17-dog-social.json)、[两只身份与历史 ID 读回](runs/issue17-http-dog-social.json) |
| 三类举报及真实治理 | [18 步手机举报](runs/issue17-reports.json)、[三类回执](reports-reported-record.png)、[团队读取/隐藏恢复/暂停解除](runs/issue17-http-reports.json)；技术角色不代表具名真人维护人员 |
| 账号范围屏蔽及取消 | [首次截图不稳定失败](runs/issue17-block.json)、[不重复屏蔽的补拍](runs/issue17-block-resume.json)、[其他宠物同样被屏蔽](block-resume-other-pet-blocked.png)、[双向/全部宠物 HTTP 边界](runs/issue17-http-blocked.json)、[取消](runs/issue17-unblock.json) |
| 部分未开放入口 | [手机执行至中断](runs/issue17-unavailable.json)：商城、每日灵感、附近点击已执行，前两项有原图；其余入口由模拟器完成，不补写成真机通过 |

狗互动原流程最后一次 Back 返回关注页，因此其命名为 `dog-like-and-comment.png` 的图片未作为互动截图发布；实际提交由步骤及 HTTP 读回证明。模拟器另有正确的只读互动截图。历史 `http-cold` 调用发生在切宠读回时，未绑定新进程证明，**不作为真机冷启动证据**。最终真机八步截图实际展示了加载新进程后狗的三类私人时间线；完整两宠重进矩阵由模拟器补验。

## 导航红绿与限制

重复外部链接曾在 SDK 52 / react-native-screens 4.4.0 / Fabric 的既有包上出现 Fragment 未挂载、视图已有父容器及白屏：[修正前循环](runs/issue17-navigation-loop-before.json)、[原生错误](regression/native-navigation-before.txt)、[错误原图](navigation-error-native-navigation-error.png)。当时 HTTP 身份仍有效。URL 私有 key 和独立入口试验均失败，未进入最终代码。

中间 `dismissTo` 候选两次通过向前循环，但社交返回失败，已撤回。最终 Android 暖启动自定义链接使用公开 `router.push` 创建新页面；冷启动、OAuth `/login`、iOS、HTTP(S) 与分享保留原处理。

**最终源码的真机八步打开/返回检查通过 38.43 秒**：[逐步结果](runs/issue17-navigation-push-back.json)、[返回仍在 App 且显示私人时间线](navigation-push-back-back-remains-in-app.png)。随后同一源码完成手机举报、屏蔽、猫狗互动；模拟器还通过真实 OAuth、跨页面返回与完整重进。最终源码没有 iOS 真机验证。

## 模拟器补验与异常保留

[独立报告](simulator/README.md)包含主人通知打开、可见范围往返、另一账号列表/搜索/旧链接、编辑/移除照片/关联宠物、主人删除、访客改私旧链接、团队删除和完整重进。

首轮组合编辑虽 UI 步骤通过，HTTP 仍读到一张照片，故未计编辑完成。单独移除通过；恢复本轮生成夹具后，新增“已选 0 张”后置条件的完整组合复验通过 77.11 秒，HTTP 确认字段、照片、关联宠物和两只宠物历史互动 ID。**未确认首轮异常的产品根因，也未声称修改了照片删除产品代码。** 两次结果均保留，后续真机组合验收仍需补。

## 回归与恢复

- [完整 Jest](regression/mobile-tests-final.txt)：13 个文件、94 项通过；[工具](regression/tool-tests.txt)：35 项通过。新输入替换/清空与前台丢失保护有红绿输出，实际模拟器编辑字段也已读回验证。
- [类型/Biome](regression/check-final.txt)：2,269 条历史类型诊断，无新增；Biome 无错误、88 个历史警告。[Android Hermes 导出](regression/android-export-final.txt)成功。终端输出只脱敏路径、去颜色和尾随空白，未改结论。
- Server 23 个相关 HTTP Feature 文件：79 passed / 911 assertions；隔离容器未使用验收数据库，源码 1,427 文件比对与首次 DNS 失败/通过输出在 Docs 配套 PR。
- [真机交还记录](phone-release.json)：已停止手机测试，恢复设置，原始 MMKV 四文件逐字节一致，随后不再读取或操作手机。
- [数据清理](simulator/data-cleanup.json)、[详细断言](simulator/runs/http-issue17-finalize.json)：仅清理本轮夹具及相关数据；原 U1 记录哈希、清理前后原照片字节一致；U1 另外两个会话保留，U2 测试令牌撤销，技术角色降权。邀请注册账号作为空测试身份保留。
- [环境清理](simulator/environment-cleanup.json)：模拟器测试包卸载、字体与端口恢复、本轮两个 AVD 删除，任务 Metro 停止；原有 AVD 保留。

[两轴复核](review.md)未发现规范问题，保留严格真机覆盖阻断；[续验清单](continuation.md)列出剩余项。本阶段不将模拟器补验改写为真机，PR 保持 Draft、未合并；签收人与真人社区维护人员仍待指定。

# #17 模拟器补验

续验归档至 2026-11-10（Asia/Shanghai）。用户要求拿走手机休息后，授权使用模拟器继续。本目录均为 **本地 Android 模拟器** 或对应真实 Server HTTP 核验，不计真机步骤。35 张真机原图另见上级目录；这里有 39 张模拟器原图、37 组调用目录，含失败和未完成诊断，不等于 37 组通过。

## 环境与来源

两个新建的 Android 16 / API 36、x86_64、Pixel 6 配置 AVD，1080×2400、420 dpi，验收字号固定 1.45，结束恢复原值并删除本轮 AVD。U1/U2 分别在独立设备上通过本地浏览器表单与真实 App OAuth 登录，没有复制手机登录状态。App 源码指纹 `07b6e5e8aa88c34c64854e72056ba6dccc479b89ddaa79084be36f97eefe7099`，两设备接入同一已验证 Metro，逐设备临时映射证明端口并等待原生 App 回传。

旧 x86 调试包构建于 `a68c6d22`，内置配置不含本地验收标志，最初登录未进入 OAuth。随后用当前 `METVAGE_LOCAL_TEST=1 expo config` 仅重新生成 `assets/app.config`，对独立调试包 zipalign 并调试重签。**没有宣称重编原生库**：28 个原生库及另外共 1,970 个 ZIP 条目（含 AndroidManifest）逐字节不变。

[环境](environment.json)、[APK 配置来源与 SHA](apk-config-provenance.json)。实际模拟器 APK SHA 为 `fd19d8583e904a20d308ab1718f647ab0849bbcb385369cf1dbd7bd767e34103`；不是手机安装包。两账号实际 OAuth：[U2](runs/peer-issue17-sim-u2-oauth.json)、[U1](runs/owner-issue17-sim-u1-oauth.json)。不发布邮箱、密码、邀请码、令牌或私有存储。

## 实际结果

| 检查 | 结果与原始证据 |
| --- | --- |
| 强制重进、仍选狗、六类记录/照片在对应时间线 | [冷启动证明](cold-process-proof.json)比较前后 PID 并匹配实际回传；[17 步最终通过](runs/peer-issue17-cold-matrix.json)、[选中狗](peer-cold-matrix-cold-selected-dog.png)、[公开时间线](peer-cold-matrix-cold-public-timeline-top.png)、[私人时间线](peer-cold-matrix-cold-private-timeline-top.png)、[HTTP 冷启动](runs/http-issue17-http-cold.json)、[六类与权限](runs/http-issue17-http-records.json)、[四张照片像素](runs/http-issue17-http-pixels.json) |
| 两宠互动身份与主人通知打开 | [只读互动](runs/peer-issue17-dog-social-readonly.json)、[历史 ID](runs/http-issue17-http-dog-social.json)、[主人实际通知打开](runs/owner-issue17-owner-notifications.json)、[消息原图](owner-owner-notifications-owner-notifications.png) |
| 商城/每日灵感/附近/探索/任务/成长（等级）/私信/自动成册 | [28 步](runs/peer-issue17-unavailable.json)、[探索说明](peer-unavailable-explore-no-fake-places.png)；显示未开放，无模拟用户、地点或交易 |
| 主人改私，第二账号旧链接、宠物列表和搜索即时拒绝 | [主人](runs/owner-issue17-owner-private.json)、[HTTP](runs/http-issue17-http-private.json)、[第二账号 7 步](runs/peer-issue17-peer-private-boundary.json)、[旧链接](peer-peer-private-boundary-peer-old-link-private-denied.png) |
| 改回公开可再读，历史互动保留 | [主人](runs/owner-issue17-owner-public.json)、[HTTP](runs/http-issue17-http-public.json)、[第二账号](runs/peer-issue17-peer-public-boundary.json) |
| 编辑正文/标题/关联宠物/移除照片，保留两宠互动 ID | [首轮 UI 与后续 HTTP 不一致](runs/owner-issue17-owner-edit-delete.json)、[独立移除](runs/owner-issue17-remove-photo-repro.json)、[严格组合复验](runs/owner-issue17-owner-combined-repro.json)、[HTTP 各次结果](runs/http-issue17-http-edited.json)、[另一账号读到编辑结果](peer-edited-readonly-edited-public-note-with-history.png) |
| 主人删除私人记录及其照片旧链接 | 首轮 [编辑/删除的后五步](runs/owner-issue17-owner-edit-delete.json)已执行删除；[三角色笔记/照片均 404](runs/http-issue17-http-deleted.json) |
| 实际退出后访客旧链接拒绝、公开照片仍能看 | [18 步](runs/peer-issue17-final-guest.json)、[改私旧链接](peer-final-guest-guest-old-link-now-private-denied.png)、[公开照片](peer-final-guest-guest-public-photo-visible.png) |
| 团队删除举报评论/笔记，访客旧链接拒绝 | [真实团队 HTTP 与持久化](runs/http-issue17-finalize.json)、[访客打开已删除笔记](runs/peer-issue17-team-delete-guest.json) |
| 恢复与清理 | [全部断言](runs/http-issue17-finalize.json)、[数据结果](data-cleanup.json)、[环境结果](environment-cleanup.json) |

## 失败与限制

- 旧包缺本地配置，第一次登录未进入 OAuth；配置切换期间中止的尝试保留，不能计为登录通过。
- 首次冷启动已显示六类记录，但返回断言使用了滚动内容标题，未通过。后续断点检查也未通过；固定字号，改用导航标题后完整重跑 17 步通过 110.94 秒。没有为此修改产品代码。
- 首轮组合编辑的正文/标题/关联宠物落库，但照片仍为一张，HTTP 断言失败。单独移除通过；为复验仅用 API 恢复生成夹具照片（不算手机上传），冷启动后加明确“已选 0 张”条件，13 步组合复验及 HTTP 通过。初次结果原因未确认，**不宣称产品删除逻辑已被修复**，保留真机补验项。
- 环境清理首次等待进程退出的匹配过宽，未生成完成摘要；随后核实实际 VM 已退出，完成恢复。`summary: null` 的调用只保留诊断事件，不计通过。

[调用索引](run-index.json)、[截图 SHA](screenshots.json)。PNG 是原图拷贝；同一 run-id 重试时图片表示最新一次捕获，较早失败摘要独立保留，不将最新图片当作旧失败截图。

此次清理删除本轮生成的 17–20 档案、26–33 记录及关联互动/通知/举报/物种申请；原始 U1 档案 1/2、记录哈希和原照片字节保留。U2 邀请账号保留为空，测试令牌撤销；技术角色已降权，U1 另外两个会话未改变。手机原始存储已提前恢复，模拟器阶段没有再访问手机。

[运行协议快照](protocols/README.md)用于审计实际身份、端口、冷启动和清理约束。

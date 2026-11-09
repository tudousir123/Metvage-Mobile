# #17 照片移除诊断：原始异常尚未稳定复现

2026-11-10（Asia/Shanghai）。用户要求用 `/diagnosing-bugs` 先建立可重复失败的检查，再定位根因，全程使用模拟器。

**目前没有找到能让未经改动的 App 稳定失败的触发器，原始异常的根因仍未定位。** 本轮交付了检测器及其对照验证，没有修改产品照片删除代码，也没有用对照失败冒充产品问题复现。诊断仍停在反馈环构建阶段，未进入根因假设或修复阶段。#17 和两个 PR 保持开放、Draft。

## 原始症状与证据边界

历史首次组合编辑的正文、标题和关联宠物已修改，但随后 HTTP 仍读到一张照片；[原始失败](simulator/runs/http-issue17-http-edited.json)和[UI 操作](simulator/runs/owner-issue17-owner-edit-delete.json)保留。之后单独移除、加零张后置条件的组合复验通过。这些通过不能说明首次失败已修复。

当时没有保存移除前后的表单快照和原生 App 的请求负载；本轮开始前旧夹具与 AVD 已清理。因此不能仅凭点击日志判定是触控、表单状态、请求编码还是服务端处理造成了那一次残留。本轮没有据此提出未经复现的根因结论；已询问是否另有当时的快照或网络日志。

## 本轮环境

- 一个本轮新建的本地 Android 16 / API 36、x86_64 Pixel 6 AVD，1080×2400、420 dpi、字体 1.45。全部设备操作均针对此模拟器，没有操作手机。
- 沿用 [模拟器包来源](simulator/apk-config-provenance.json)：APK SHA `fd19d8583e904a20d308ab1718f647ab0849bbcb385369cf1dbd7bd767e34103`。产品源码实际回传仍为 `07b6e5e8aa88c34c64854e72056ba6dccc479b89ddaa79084be36f97eefe7099`，本轮没有改产品 JS、原生库或依赖。
- 第一阶段使用原本为空的 U2 测试账号，真实浏览器/App OAuth 后，只创建本轮生成夹具。结束清理 4 个档案、23 条记录，并精确撤销本轮 App 会话，其他用户、记录、照片字节和令牌状态保持原样。
- 为核对历史 U1 已有两宠的条件，又用 SQLite 在线备份和独立 Redis 8 创建仅 loopback 的 Server 副本；原 U1 两宠与选中档案 1 保留，再创建两只生成宠物。[1,480 个版本化文件比对](diagnostics/photo-removal-20261110/isolated-server.json)覆盖 app/routes/database/config 和完整 tests/Feature，与 Server `b7d0dadf8996289b3492a9b24c5a7bfaf4f5647f` 一致；此范围比此前 1,427 文件的子集更大。
- 本地 Metro 的实际 Node 为 24.22.0；CI 使用仓库 Node 20。工作树当时尚未提交的工具由模块/计划 SHA 绑定，见[工具来源](diagnostics/photo-removal-20261110/tool-source.json)。App 回传指纹与工具源码来源分别记录。

生成照片通过 HTTP 准备；App 实际执行编辑、切换关联和移除。本轮不计为新的相册上传证据。

## 实际结果

[27 组调用目录](diagnostics/photo-removal-20261110/run-index.json)包含预检失败、诊断、重试、清理和故意失败，不等于通过数；本轮未追加发布截图。

| 场景 | 实际观察 |
| --- | --- |
| U2 普通组合，先两宠/私人，后四宠/公开及历史文案 | 6 次读回照片为零。一次探索输入正文发生截断，因此该次只支持照片观察，不计完整组合通过 |
| U2 关联切换后，移除按钮不同位置 | 7 次最终读回照片为零；其中一次 UI 导航过渡检查停止，另行 HTTP 核验，不计该次完整 UI 计划通过 |
| U2 改私→公开→组合编辑 | 1 次通过，正文/标题/关联与零照片一致 |
| U2 缓存记录重新进入，读取响应延迟 32 秒 | UI 导航等待超时；随后 HTTP 确认其他修改与照片删除均已完成，不计目标复现 |
| U2 缓存与可见范围变化，读取响应延迟 40 秒 | 最初立即读回为旧记录；随后连续三次 HTTP 均为正确字段、关联与零照片，属于新驱动过早读回造成的假红 |
| U2 修正读回条件后的完整组合 | 1 次通过 |
| U1 隔离副本：原两宠/原选中状态，再改私→公开→组合编辑 | 1 次通过，正文/标题/关联与零照片一致 |
| 版本化命令的首版工具 | 2 次正常删除通过；1 次故意跳过移除按预期报错，自动清理通过 |
| 接入 App 会话恢复后的工具版本（评审前） | 1 次正常删除通过；1 次故意跳过移除按预期报错；随后标准 `cleanup` 恢复路径再次通过，主失败记录未被覆盖 |

共观察到 **21 次自然移除后的最终零照片结果**，其中含上述不完整或另行核验的探索调用，不能写成 21 次完整组合验收。另有 **3 次故意跳过移除的对照失败**，全部明确标注，不能计为自然问题复现。

延迟场景的[网络时序](diagnostics/photo-removal-20261110/latency-events.json)和各次失败/最终读回均保留。过早读回假红发生在本轮新驱动中；它不能解释历史首次失败，因为历史检查的操作顺序和间隔不同。

## 可重复执行的检测器

```sh
npm run --silent acceptance -- --config .acceptance/probe/config.json probe-photo-edit --run-id photo-probe-001 --iterations 3
npm run --silent acceptance -- --config .acceptance/probe/config.json probe-photo-edit --run-id photo-control-001 --negative-control
```

[使用条件与恢复](../../local-acceptance.md#模拟器照片移除诊断)、[实现](../../../scripts/acceptance/photo_probe.py)、[计划](../../../scripts/acceptance/plans/photo-edit-probe.json)。命令只接受模拟器与测试账号，核对真实 App OAuth 身份和运行证明，创建私人生成夹具，再执行实际组合编辑。恢复路径借用同一 App 的有效会话；不把临时个人令牌误当成该会话。

判定先确认正文、标题和关联宠物已保存，再观察照片是否移除。其他修改未确认时标为 `save-unconfirmed`；只有其他修改确认而照片持续保留才报目标失败。负向对照故意省略移除，退出 1 是检测器自检。每次使用新 run-id，失败与清理结果分开保存；重新关联的生成记录仍按精确请求标记清理。

评审前工具的真实 App 执行：[正常删除](diagnostics/photo-removal-20261110/runs/owner-clone-probe-owner-final-positive.json)、[故意保留照片及再次恢复](diagnostics/photo-removal-20261110/runs/owner-clone-probe-owner-final-negative.json)。单次完整 App 检查约一分钟；尚未得到稳定自然红，也没有得到秒级最小复现，不能宣称诊断前置条件已全部满足。

## 评审发现的恢复缺口

规格复核发现：若保存已经重新关联，但进程在 `finally` 更新清单前终止，标准 `cleanup` 会沿用旧宠物 ID，归属检查因而拒绝删除。新增回归使用局部 HTTP 服务与真实 `FixtureRun.cleanup`，先确认[旧行为失败](diagnostics/photo-removal-20261110/recovery-red.txt)，再将活动退出和标准恢复统一为“重读实际关联、核对记录 ID、更新清单、保留原账号/请求标记检查”的共享步骤，[10 项契约转绿](diagnostics/photo-removal-20261110/recovery-green.txt)。篡改请求标记仍拒绝删除，原宠物保留。

这是验收工具的中断恢复修正，不是产品照片删除修复。该修正没有新增设备测试；实际 App 操作证据对应 `687bf51` 中的工具版本，最终恢复代码及测试 SHA 在[工具来源](diagnostics/photo-removal-20261110/tool-source.json)单列。首次新增测试的错误消息断言与聚合错误不符，[草稿失败](diagnostics/photo-removal-20261110/recovery-test-draft.txt)保留；正式红绿使用正确的错误清单断言。

## 回归、恢复与后续

- [评审后工具测试 45 项通过](diagnostics/photo-removal-20261110/tool-tests-after-review.txt)，含 10 项新增契约；[评审前 43 项](diagnostics/photo-removal-20261110/tool-tests.txt)与[当时 8 项契约](diagnostics/photo-removal-20261110/probe-contracts.txt)保留。覆盖：过早读回后正常保存、真实残留、保存未确认、仅模拟器、借用会话的身份校验与中断释放。没有为此重跑未改变的产品本地 Jest；其 94 项基线保留，最终提交 CI 另记于 PR。
- [U2 数据清理](diagnostics/photo-removal-20261110/u2-data-cleanup.json)和[完整断言](diagnostics/photo-removal-20261110/runs/u2-finalize.json)确认只清理本轮生成内容及会话。克隆前后与受保护原服务比对，[U1 原档案/记录/照片字节与选中状态一致](diagnostics/photo-removal-20261110/original-data.json)。
- [环境恢复](diagnostics/photo-removal-20261110/environment-cleanup.json)：测试包、AVD、独立容器/网络/副本、Metro 与延迟代理均清理；字体恢复 1.0，反向端口恢复为空，原有 AVD 保留。手机未参与本轮。
- 目前需要异常时的快照/请求负载，或一个新的自然失败，才能继续缩小触发条件并提出可证伪假设。现有通过不取消原失败，未修改照片删除产品代码，未解除[严格真机缺口](continuation.md)。

[运行协议快照](diagnostics/photo-removal-20261110/protocols/README.md)仅供审计已执行调用；旧夹具已经清理，不可直接重放旧 ID。

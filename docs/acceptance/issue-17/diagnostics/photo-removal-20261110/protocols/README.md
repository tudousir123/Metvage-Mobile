# 诊断调用审计快照

这些文件依赖当时已封存的忽略配置和已经清理的 ID，只用于审计，不是可直接执行的复验入口。新的调用使用版本化 `probe-photo-edit`，按生成清单创建、核对身份并清理新夹具。

[源码与发布 SHA](sources.json)记录路径/模拟器标识脱敏，不改逻辑。`latency-driver.py`、`revision-driver.py`、`settled-driver.py` 对应逐步收紧的独立探索驱动；有协议 SHA 的调用可以与快照核对。更早的两组探索组合和首次触控组没有固定驱动 SHA，因此只引用其操作/HTTP 观察，不当成已固定脚本的回归。

`photo-probe-v1.py` 是版本化工具早期实测版本；`photo-probe-v2.py` 对应接入 App 会话恢复后的模拟器实测版本；评审后的恢复修正以局部 HTTP 与真实 FixtureRun 回归，未新增设备测试。最终模块在仓库 `scripts/acceptance/photo_probe.py`，指纹见上级 `tool-source.json`。App 的产品源码指纹在全部阶段保持不变，工具版本变化不冒充产品修复。

`latency-proxy.py` 只转发 loopback 请求，在本轮生成记录的 GET 响应上延迟交付，不记录请求头或凭据。`cleanup-local.php`、`finalize.py` 精确清理 U2 夹具/本轮会话；`verify-originals.*` 对照隔离副本与原服务的原始记录和照片字节。`cleanup-environment.py` 校验本轮 AVD 名称、进程及独立容器挂载后删除本轮环境。

`revision-precondition.py` 对应 HTTP 405 的准备失败版本，由下一快照逆转单处路径/负载改动恢复，其原始 SHA 与调用记录完全一致；该准备失败没有计为产品问题复现。

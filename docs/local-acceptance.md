# 本地真机验收

统一入口为 `npm run acceptance -- <命令>`，只依赖 Python 3.10+ 标准库、ADB；环境检查还使用 Node、Git、ss，素材管理使用本地 Server 容器里的 PHP。CI 只运行模拟设备和本地 HTTP 测试，不需要手机或真实数据库。

## 准备与来源检查

在要运行的 Mobile 工作树中按锁文件安装依赖：

```sh
npm ci --no-audit --no-fund
mkdir -p .acceptance
cp scripts/acceptance/config.example.json .acceptance/config.json
```

按 `.nvmrc` 选择 Node 版本。编辑本地配置，填入实际 Mobile 工作树、分支、Server 容器及挂载目录、设备序列号和独立测试账号的 `profileUsername`。相对路径以配置文件所在目录为基准。配置、运行清单和生成素材放在已忽略的 `.acceptance/`；保留生成提示词和原图来源，图片示例只使用生成素材。

```sh
npm run --silent acceptance -- discover --device
npm run --silent acceptance -- launch --run-id launch-001 --restart-metro
npm run --silent acceptance -- doctor
```

`discover` 先列出当前版本中实际存在的开发文档和验收计划；`--match <正则>` 可筛选其他路径。`--device` 从已安装 APK 的声明读取实际 URL scheme，避免使用仓库中另一种包的配置。

`launch` 只管理配置工作树的 Metro。启动在取得设备锁后才会修改 Metro 或回执；忙碌拒绝不会破坏正在运行的验收。已有同目录进程须明确使用 `--restart-metro`；其他工作树占用端口时直接停止。它先等待 Metro `/status`，再启动指定测试包，要求开发 bundle 向 loopback 临时监听器回传本轮随机标识、源码指纹和原生包名，并等待首页就绪。正式构建不发送该回传，也不展示诊断 UI。监听端口和设备设置在结束后恢复，成功启动的 Metro 保留。

回传结果保存在配置旁的 `runtime.json`。源码、Metro 进程或 App 进程变化后，`run`/`replay` 会拒绝旧结果，重新执行 `launch` 即可。指纹覆盖 JavaScript/TypeScript 的 `src`、素材和 bundle 配置，文档修改不要求重新启动。仅仅通过 `doctor` 不代表 App 已加载本轮代码。

`doctor` 输出实际 Git 仓库、分支、SHA、是否有未提交修改、Node 版本、Expo Router 入口、Metro 端口所属进程目录、Server 容器挂载目录及 API 健康状态。Node 主版本在 CI 统一为 `.nvmrc` 的 20；本地实际版本会记录在结果中。

入口和依赖必须位于配置的 Mobile 根目录中。遇到外部 `node_modules` 软链接时，回到该工作树执行 `npm ci`。启动 Metro 前先核对工作树；已有 Metro 进程的实际目录必须与配置匹配。工具不替换其他工作树中的运行服务。

设备检查使用明确的序列号，拒绝离线、未授权、主机 USB 权限不足或锁屏状态。连接失败时先核对 `adb devices -l`；Linux USB 权限由主机 udev 配置处理。保持手机停留在测试 App，浏览其他 App 时当前验收操作会停止。

## 执行真机计划

```sh
npm run acceptance -- run --run-id smoke-001 --plan scripts/acceptance/plans/smoke.json
npm run acceptance -- run --run-id back-001 --plan scripts/acceptance/plans/record-back.json
npm run acceptance -- run --run-id keyboard-001 --plan scripts/acceptance/plans/comment-keyboard.json --font-scale 1.45
```

计划支持按可访问性标签点击、ASCII 输入、返回、断言文字、比例坐标滚动、评论键盘净空断言及截图。定位按可访问性标识、资源 ID、文字查找，并合并属于同一可点击祖先的节点；两个不同按钮同名时仍要求明确 `index`。诊断使用 `inspect --label <标签>`，只返回指定目标的候选数量、类型、范围和可点击状态，不输出完整页面文字。

每个 `back`/`open` 步骤必须声明 `expect`，例如 `{"keyboard":"hidden"}` 或 `{"label":"保留这份回忆？"}`。计划及其 `include` 子计划的操作参数、路径、文件名和后置条件在修改设备前统一校验；变量展开后再次校验，空标签不能放行；操作完成后等待条件满足，再执行下一步。状态未到达即停止。`variables` 可提供测试宠物名称，`{run_id}` 用于标记本轮文字；生成宠物的中文名字通过 API 设置。

设备计划和恢复命令持有同一序列号的进程锁，其他操作命令会立即返回 busy；doctor 只读检查环境。截图前后都验证测试包前台与稳定布局；失焦或布局发生变化时丢弃图片。UI XML 在手机上使用本进程专用临时路径，读取后立即删除；恢复日志记录该路径，中断后由新进程清理原文件。输出不包含完整界面文本。

每次运行先写恢复日志，再修改亮屏、可选字体及指定端口转发。正常完成、步骤失败、SIGINT 和 SIGTERM 都执行恢复；原端口映射会还原，未涉及的映射保持原样。断连时保留 `restoration_pending`，在恢复完成前阻止另一轮覆盖原始设置：

```sh
npm run acceptance -- cleanup --run-id back-001
```

重新连接原手机后执行此命令即可重试。SIGKILL 或主机断电无法运行退出处理，也使用同一恢复日志。界面中的未保存内容由 App 自身的退出保护保留，工具不自动放弃正在编辑的内容。

可用 `--fail-after-step 1` 注入步骤失败，核对恢复流程。截图和恢复日志必须通过检查后，才能写入用于发布的验收证据。

## 完整重放与权限复核

本地配置一次生成 PNG、两个独立测试账号的 `profileUsername` / `peerProfileUsername`，以及 `variables.peerPetId`。独立测试 App 保持主人账号登录，且已有选定宠物；设置计划的起始条件是屏蔽列表为空，社交操作目标应为可公开读取的另一账号宠物。关注按钮状态由 API 读取，不写死是否已关注。

```sh
npm run --silent acceptance -- replay --run-id ui-001 --plan scripts/acceptance/plans/secondary-acceptance.json
npm run --silent acceptance -- verify-api --run-id api-001
```

组合计划顺序运行生成照片搜索/公开与私人档案、评论键盘与发送、服务断连恢复、消息与设置、社交按钮尺寸和屏蔽确认取消。子计划可单独交给 `run`；需要临时素材的 `secondary-ui.json` 交给 `replay`。每次完整重放使用新的 run-id。

`replay` 在一次调用中持有账号锁，先创建带本轮标记的生成素材，再明确公开计划声明的猫图；其他记录保持私人。设备操作持有设备锁；任一步失败也会先恢复设备设置/端口、精确删除该批素材并撤销令牌。评论是否单条持久化由 UI 之后的 HTTP 重新读取确认。`verify-api` 以主人、另一账号及访客读取现有记录，只核验权限，不修改原有内容。

`run` / `replay` 始终要求 `mobileRoot` 和有效的 App 回执，没有跳过验证的配置开关。模拟 ADB 的低层契约测试通过 `tests/device_harness.py` 专用入口执行，和常规 App 验收隔离。

每次运行保存展开计划所有源文件的哈希；凭据及实际设备参数仍只在本地配置。中断后沿用 `cleanup --run-id <原值>`，也会重试撤销补充账号的临时令牌。

## 生成素材与重复执行

将生成的 PNG 放入本地配置指定的 `image` 路径；为该独立测试账号明确设置 `testAccount: true`，并给每项素材设置 `generated: true`。工具只接受 loopback API 地址，不接受带凭据或重定向的 API URL。

```sh
npm run acceptance -- fixtures --run-id fixtures-001 --keep
npm run acceptance -- fixtures --run-id fixtures-001 --keep
npm run acceptance -- cleanup --run-id fixtures-001
```

两次 `fixtures` 使用同一清单、ID 和请求标识；请求标识包含运行名与素材键的组合哈希，避免相似名称跨运行碰撞。第一条命令在创建宠物和记录前写入意图，校验响应关联宠物和可见范围后保存 ID。HTTP 响应丢失后按本轮标记恢复宠物，并按精确请求标识、账号及宠物查找记录，支持数字和数字字符串形式的 ID。素材内容变化时使用新的 run-id。

`fixtures` 创建的照片记录始终为私人记录；只有显式 `replay` 计划中 `publicFixtures` 指定的本轮资源会被临时公开。工具自行创建本轮宠物，不接管已有同名宠物；上传失败也清理已经创建的资源。清理先验证账号归属和本轮标记，仅删除清单内新建的记录、图片及宠物；记录删除的 HTTP 204 和已删除资源的 404 均视为成功。缺少宠物删除 API 时，由本地管理脚本在确认标记、归属且已无记录后删除本轮宠物；原选定宠物身份按需恢复。

临时 Passport 令牌由本地 Server 按稳定的账号资料用户名签发，仅保留在进程内存中。每次命令退出撤销本轮令牌，运行清单不存令牌。撤销失败会记录 `token_cleanup_pending`，`cleanup` 会按本轮标签继续撤销；重复清理不会删除既有测试数据。不要重放此前删除用户随拍的临时脚本，这不是常规素材清理步骤。

## 简洁结果与详细证据

工具本身只向 stdout 输出一份 JSON 摘要；自动解析时使用 `npm run --silent acceptance -- ...`，避免 npm 的命令标题。每次调用的事件与结果分别保存到 `invocations/<id>/`，不会覆盖前次运行。验收结果保存在 `summary.json`，清理结果单独保存在 `cleanup-summary.json`，清理成功不会把验收失败改成通过。恢复状态、素材清单和图片也保存在该 run-id 的目录，JSON 与图片权限为 600。凭据不进入日志。每步记录操作耗时、ADB 调用次数及耗时、UI 树读取次数。普通稳定按钮点击复用同一步的观测，使用两次 UI 树确认后点击；截图仍保留前后稳定性与前台检查。失败步骤也保留这些指标。按需读取对应文件，避免反复返回整份日志或 PR 正文。

```sh
npm run acceptance -- summary --run-id back-001
npm run acceptance -- pr-status --repo tudousir123/Metvage-Mobile --number 1
```

`pr-status` 默认裁剪为 URL、状态、SHA、目标分支、自动合并开关及检查摘要。GitHub 操作优先使用连接器并只展示这些字段；使用 CLI 时总是显式指定仓库，避免 fork 的默认上游推断。

验证工具本身：

```sh
npm run test:acceptance
npm run test:ci
npm run check
```

轻量 CI 对全部 PR 执行，不受目标分支限制；push 覆盖 `main` 与 `codex/metvage-v1`。Jest 与格式检查统一用锁文件依赖和 Node 20，CI 调用仓库现有脚本；原生构建等较重流程保留原触发范围。

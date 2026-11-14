# 本轮操作协议快照

这里保留实际使用的运行专用驱动，便于审计断言和安全边界；它们不是新的通用 CLI。`<serverRoot>` 是发布时替换的私有绝对路径占位符；源码和发布文件的 SHA 见 [sources.json](sources.json)。不包含私有配置、MMKV 备份、邀请码、邮箱、密码或令牌。

- `http-checks.py`：仅本地真实 Server；U1 使用按次签发且 finally 撤销的测试令牌，U2 从其独立调试 App 取实际 OAuth 令牌，仅内存使用，并通过 `verify_credentials` 验证账号。已实际执行 `state`、`identity`、`snapshot`、`records`、`pixels`、`species`、`social`。其他分支尚未执行，不能因代码存在就计为通过。
- `technical-team.py`：建立独立技术管理员测试角色，读取实际物种申请；每次撤销技术角色令牌。它不代表已指定真人社区维护人员。
- `android-file-picker.py`：仅识别经系统包来源验证的 Android 16 小米照片选择器，进入“影集 → 下载内容”。只选择匹配本轮唯一文件、SHA 和 MediaStore 日期的生成图片；不读取其他照片，未对系统照片列表截图。原始字节和上传重编码后像素验证见 HTTP 输出。
- `browser-driver.mjs`：CDP 仅选择并操作 `http://localhost:18080` 的本轮邀请或 OAuth 页；私有字段从忽略文件读取，操作结果不输出字段值。
- `android-oauth-login.py`：在独占设备会话中，从真实 App 登录按钮进入浏览器授权并返回，随后用该 App 的实际 token 验证 U2。截图只在 App 前台时执行。

邀请注册的实际顺序：App 输入有效邀请并进入手机浏览器；依次在服务器注册表单填写 username、email、password、password_confirm、display_name，逐页点击 Continue 后提交；服务端读回账号创建时间、邀请码使用次数 1/1、初始宠物数 0。随后通过 App 实际 OAuth 授权。没有直接调用注册 API 代替手机表单。[注册读回](../registration-result.json)、[浏览器会话](../runs/issue17-browser-register.json)、[OAuth](../runs/issue17-u2-login.json)。

恢复环境后，在 Mobile 仓库根目录使用已有 `npm run acceptance -- --config <私有配置> ...` 命令执行版本化 `scripts/acceptance/plans/issue17-*.json`。私有配置与 `issue17-context.json` 需要保存本轮账号、宠物和记录 ID；不能将其他人的现有内容填入这些运行专用清理/治理分支。设备已断连时不继续任何点击或截图。

本目录保留早期真机协议快照；本轮已经交还手机并清理旧夹具，不能直接执行旧变量。历史 `cold` 分支仅作切宠后的 HTTP 读回，未绑定冷启动证明，不计真机重进。后续模拟器协议改用真实前后 PID 和回传验证，见 [模拟器协议](../simulator/protocols/README.md)。

# 验证记录

这是离线验证，不是真机测试。没有连接或修改任何 OpenWrt 路由器，也没有向 GitHub 推送任何内容。

## 已做

- `appmanager`、`install.sh`、`uci-defaults` 通过 BusyBox `sh -n` 语法检查。
- `overview.js` 通过 Node.js `--check` 语法检查。
- 菜单/ACL JSON 通过解析。
- 独立交互预览（`preview/index.html`）在 Edge 中实际打开并操作验证：
  - 勾选/取消应用，规则条数与输出实时变化；
  - 关闭总开关，规则全部变成 `# - AND...`；
  - 添加设备、填第二个 IP、第二个设备全选后，红果规则变成源 IP `OR`；
  - 添加自定义应用 `游戏测试`，勾选后规则数 9 → 10；
  - 命中测试 `fqnovel.com` → REJECT 红果，`finder.video.qq.com` → REJECT 微信视频号，`weixin.qq.com` → ALLOW 核心保护；
  - “自定义规则文件 / 运行配置 次元.yaml”两个 tab 都能切换。
- 在临时目录用 BusyBox 模拟 `/etc/openclash` 与 `/etc/appmanager`，验证：
  - 默认 9 个应用 → 9 条 `AND` 规则，括号全部配平；
  - 3 台设备勾选同一应用 → 源 IP 合并为一个 `OR`；
  - 同一配置重复 apply → 仍只有一个规则块；
  - 关闭总开关 → 9 条规则全部变成 `# - AND...`，active=0；
  - 自定义应用 `game.example.com,ip:1.2.3.0/24` → 生成 `OR(DOMAIN-SUFFIX,IP-CIDR)`；
  - 自定义规则文件不存在 → 自动创建 `rules:`；
  - 纯列表格式（没有 `rules:`）→ 规则块前置；
  - `rules: []` → 转换为块状列表；
  - 运行配置无 `rules:` → 拒绝写入并返回错误；
  - 0 缩进和 2 缩进 YAML 都按原缩进插入；
  - `hongguo` 的 `DOMAIN-WILDCARD,*novel*.byteimg.com` 能写入并保持括号配平；
  - 非法 IP、重复 IP、微信核心域名 `weixin.qq.com` → 拒绝；
  - 两个文件块内容一致时 `blocks_consistent 1`。

## 未做

- 未在真实 OpenClash/mihomo 上启动，因此未验证实际 DNS/fake-ip 命中、nftables 绕行和微信域名完整性。
- 未编译 `.apk`；需要 OpenWrt SDK 或固件构建环境。
- 未测试 LuCI 主题下的最终视觉效果；CSS 使用主题色变量和半透明灰色，适配明暗主题。

## 真机首测建议

1. 先只给一台测试设备勾选一个不影响生活的应用（例如红果）。
2. 点“预览将写入的规则”，确认 `AND` 行。
3. 保存，等待 OpenClash 重启，确认顶部状态“进入内核 / 运行中”。
4. 用 `logread -f` 或 `/tmp/openclash.log` 观察是否出现 `match ... using REJECT`。
5. 再逐步加入其他应用；微信最后加，先确认微信聊天/朋友圈/支付正常。

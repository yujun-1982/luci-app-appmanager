# 应用管理（luci-app-appmanager）

OpenWrt LuCI 插件，挂在 **管控 → 应用管理**。按“设备 IP + 应用”生成 OpenClash / mihomo 的 `AND` 规则，把指定设备上的指定 App 拒绝掉；微信聊天、朋友圈等未命中的流量不受影响。

> 这是独立插件，不依赖、也不修改任何现有固件仓库。默认配置里的 `10.10.10.27` 只是按需求预填的示例设备，首次安装时管控开关是关闭的。

## 0. 先看交互预览

不想先编译/安装，可以直接打开：

```text
preview/index.html
```

这是纯浏览器的交互模型：勾选应用、开关管控、添加设备/自定义应用、查看两个文件的规则、模拟 fake-ip 命中，都会实时变化；不会连接路由器，也不会写任何文件。预览说明见独立的 `preview/README.md`。

## 1. 它做什么

页面结构：

- **设备**：每台设备填一个固定 IPv4（也支持 CIDR），单独勾选要封禁的应用。
- **应用**：内置 9 个应用，可添加自定义应用；自定义应用支持域名和 `ip:1.2.3.0/24` 目标。
- **保存并生效**：把规则块同时写入两个地方，然后重启 OpenClash：
  1. `/etc/openclash/custom/openclash_custom_rules.list`（保证 OpenClash 重建配置后不丢）
  2. `/etc/openclash/次元.yaml`（当前运行配置，保证“快速启动”模式立即生效）
- **规则在 = 封禁；规则被注释 = 放行**。关闭总开关时，规则块保留，但每条规则前加 `#`。

同一应用在多台设备上会合并成一条规则，所以 9 个应用都勾选时最多是 9 条规则，而不是 9 × 设备数。规则恒在 `rules:` 最顶部。

生成的单条规则形态：

```yaml
- AND,((SRC-IP-CIDR,10.10.10.27/32),(OR,((DOMAIN-SUFFIX,fqnovel.com),(DOMAIN-SUFFIX,qznovel.com)))),REJECT
```

多台设备时源 IP 部分也会变成 `OR`：

```yaml
- AND,((OR,((SRC-IP-CIDR,10.10.10.27/32),(SRC-IP-CIDR,10.10.10.28/32))),(OR,((DOMAIN-SUFFIX,fqnovel.com),(DOMAIN-SUFFIX,qznovel.com)))),REJECT
```

## 2. 为什么这套规则能生效（fake-ip 链路）

```text
手机/电视（源 IP 10.10.10.27）
  → DNS 查询红果域名
  → OpenClash/mihomo 返回 fake-ip 198.18.x.x
  → App 连接 198.18.x.x
  → mihomo 用 fake-ip 映射还原真实域名 fqnovel.com
  → 命中 AND(源 IP, DOMAIN-SUFFIX) → REJECT
```

因此插件必须保证两件事：

1. **OpenClash 开启 fake-ip**（或在 TUN/TPROXY 模式下能拿到域名）。
2. **关闭“绕过中国大陆 IP”**（`openclash.config.china_ip_route=0`）。如果开启，国内 CDN 流量在 nftables 层就被放行，根本不会进 mihomo，域名规则全部失效。

网络侧还有几个前提：

- 设备的默认网关和 DNS 必须是 `10.10.10.2`；如果设备手动填了别的 DNS（DoH/私有 DNS）或走了旁路，规则看不到它的流量。
- 建议关闭 LAN 的 IPv6（或另外用防火墙处理 IPv6）。本插件只生成 IPv4 源地址规则，App 走 IPv6 可能绕过。
- 设备不要开“按 App 代理”的本地 VPN；否则流量不经过网关。
- 设备 IP 要固定（DHCP 静态租约），否则换了 IP 规则就不匹配。

插件在保存时会自动尝试：

```sh
uci set openclash.config.enable_custom_clash_rules=1
uci set openclash.config.china_ip_route=0
uci commit openclash
```

页面“环境检查”和顶部警告会显示当前实际值。若你的固件还有定时脚本把 `china_ip_route` 改回 1，需要一并处理。

## 3. 安装

### 3.1 编成 OpenWrt 包（推荐）

把整个 `luci-app-appmanager` 目录放进 OpenWrt SDK / 源码的 `package/` 下：

```sh
cp -r luci-app-appmanager package/
make package/luci-app-appmanager/compile V=s
```

OpenWrt 25.12 的产物是 `.apk`，旧版本是 `.ipk`，以你的 SDK 为准。安装后刷新 LuCI。

`Makefile` 已声明：

- `+luci-base`
- 可执行位由 `postinst` + `/etc/uci-defaults/91-appmanager-perms` 兜底
- `/etc/appmanager/config` 作为 conffile，升级不覆盖

### 3.2 手工安装（仅用于调试）

```sh
scp -r luci-app-appmanager root@10.10.10.2:/tmp/
ssh root@10.10.10.2
cd /tmp/luci-app-appmanager
sh install.sh
```

手工安装不写入 apk/opkg 数据库，升级/卸载需要自己处理。`install.sh` 会保留已有的 `/etc/appmanager/config`。

### 3.3 菜单父节点

插件注册在：

```text
admin/control/appmanager
```

如果你的 LuCI 没有“管控”父菜单，需要先有类似下面的文件，再刷新页面：

```json
{
  "admin/control": {
    "title": "管控",
    "order": 44,
    "action": { "type": "firstchild", "recurse": true }
  }
}
```

保存为 `/usr/share/luci/menu.d/99-custom-menu-parents.json`，然后：

```sh
/etc/init.d/rpcd reload
rm -f /tmp/luci-indexcache.*
```

## 4. 首次使用

1. 打开 **管控 → 应用管理**。
2. 确认“OpenClash 运行配置”路径，默认 `/etc/openclash/次元.yaml`；如果不对，在“高级设置”里改。
3. 设备行填固定 IP（建议在 DHCP 里做静态租约），勾选要封禁的应用。
4. 先点 **预览将写入的规则**，确认 `AND` 规则和域名符合预期。
5. 打开“管控已开启”，点 **保存并生效**。
6. 等 30–60 秒，顶部状态变为“OpenClash 运行中 / 国内流量进入内核”。

默认配置预填了 `10.10.10.27` 和 9 个应用，但 `enabled 0`，不会在安装瞬间断网。

## 5. 内置应用与域名

| ID | 名称 | 说明 |
|---|---|---|
| `taobao` | 淘宝 | 淘宝/天猫主站与静态资源；不含支付宝、阿里云 |
| `hongguo` | 红果 | API / 视频 / 图片 CDN；含 `DOMAIN-WILDCARD,*novel*.byteimg.com` |
| `xiaohongshu` | 小红书 | 主站、图片/视频 CDN |
| `tencentvideo` | 腾讯视频 | 腾讯视频专用域名；不含 `qq.com` 主域 |
| `wechat_channels` | 微信视频号 | 保留聊天/支付/朋友圈/视频通话；封视频号/公众号/小程序 |
| `iqiyi` | 爱奇艺 | 主站、播放器、CDN |
| `xigua` | 西瓜视频 | 主站与视频 CDN |
| `fanqie` | 番茄小说 | 番茄小说主站/短链 |
| `douyin` | 抖音 | 主站、直播、电商、支付 |

内置域名在：

```text
/usr/share/appmanager/apps.tsv
```

格式：

```text
id|名称|域名1,wildcard:*.example.com,ip:1.2.3.0/24|备注
```

包升级会覆盖这个文件；需要长期追加域名时，优先用页面的“自定义应用”。

### 微信视频号：保留四项，封其他

`wechat_channels` 现在是一个“微信视频号”应用，封的是这些非核心域名：

```text
channels.weixin.qq.com    # 视频号网页后台
finder.video.qq.com       # 视频号媒体
mp.weixin.qq.com          # 公众号；也参与第三方 OAuth 登录
servicewechat.com         # 小程序
wxapp.tc.qq.com           # 小程序/微信内网页
```

保留的核心域名不会被写入 REJECT：

```text
weixin.qq.com
wx.qq.com
wechat.com
weixinbridge.com
tenpay.com
wechatpay.com
qpic.cn
qlogo.cn
wx.gtimg.com
wxs.qq.com
wxsnsdy.tc.qq.com
wxsnsdy.wxs.qq.com
wxsnsdythumb.wxs.qq.com
```

效果：

- 聊天、语音、支付、朋友圈图片/普通视频：不经过上述封禁域名。
- 视频号、直播、回放：被拒绝。
- 公众号：会被拒绝；`mp.weixin.qq.com` 也参与第三方 OAuth，可能导致“微信授权登录”失败。
- 小程序：会被拒绝。
- 朋友圈里的视频号内容：被拒绝。
- 视频通话：需要实测；如果它复用 `finder.video.qq.com`，会被误伤。

搜一搜、看一看和聊天共用 `weixin.qq.com`，**不能在不封聊天的情况下单独封它们**；不要为了“全禁”去封 `weixin.qq.com` / `qq.com` 父域。

> 如果视频通话被误伤，先从 `apps.tsv` 里移除 `finder.video.qq.com`，或在页面上只对特定设备启用“微信视频号”。不要直接把 `weixin.qq.com` 或 `qq.com` 加进去。

### 域名重叠的提醒

- **红果 / 番茄小说**：都属字节系，短剧 CDN 和 `fqnovel.com` 有重叠。只封红果可能会影响番茄小说的部分视频；反之亦然。
- **淘宝**：没有包含 `alicdn.com` 这种阿里系共享 CDN，避免误伤支付宝/其他阿里 App；所以淘宝的图片可能仍能加载，但主流程域名已被拒绝。
- **腾讯视频**：没有包含 `qq.com` 主域，也不使用泛 `video.qq.com`，避免把视频号 `finder.video.qq.com` 一起命中。

### 红果的 4 + 5 规则怎么放

当前内置的 `hongguo` 是 4 个域名目标：

```text
fqnovel.com
qznovelvod.com
fqnovelpic.com
DOMAIN-WILDCARD,*novel*.byteimg.com
```

`*novel*.byteimg.com` 比 `novel*.byteimg.com` 多一个前导 `*`，是为了覆盖实测里的
`p3-novel.byteimg.com`（它并不以 `novel` 开头）。

IP 层没有默认写死。原因是公共规则站上的 IP 段大多按公司/ASN 归组，不是按 App 归组；
把 `122.228.60.0/24` 这类段直接塞进“红果”会误伤同一 ISP/CDN 上的其他服务。若你已经有
抓包得到的 5 个网段，可以在页面“自定义应用”里建一个“红果补充 IP”：

```text
ip:122.228.60.0/24
ip:...
ip:...
ip:...
ip:...
```

当前实现会把同一 App 的所有目标 `OR` 进一条 `AND`，逻辑上等价于多条 REJECT；
如果你要的是 OpenClash 面板里 **4 条域名 + 5 条 IP = 9 条独立规则**，需要再加一个
“按目标拆分规则”的模式。这个模式还没有默认打开，见研究文档：

```text
docs/APP_DOMAINS.md
```

## 6. 自定义应用 / 游戏

页面“＋ 自定义应用”支持：

- 域名：`game.example.com`
- 通配符：`novel*.byteimg.com` 或 `*.example.com`，生成 `DOMAIN-WILDCARD`；如果要根域，直接写 `example.com`
- IP/CIDR：`ip:1.2.3.0/24`，生成 `IP-CIDR,1.2.3.0/24`

游戏如果只走 UDP 或直连 IP，域名规则可能抓不到；需要把游戏服务器网段用 `ip:` 形式加进去。注意 `IP-CIDR` 在 fake-ip 模式下对“已经拿到 fake-ip 的连接”未必命中，最可靠的是让游戏走真实 IP 直连并配合 sniffer。

## 7. 文件与备份

| 路径 | 作用 |
|---|---|
| `/etc/appmanager/config` | 设备、应用、路径、开关 |
| `/etc/appmanager/backup/` | 每次保存前的备份，保留最近 20 份 |
| `/usr/sbin/appmanager` | 后端 CLI |
| `/usr/share/appmanager/apps.tsv` | 内置应用库 |
| `/etc/openclash/custom/openclash_custom_rules.list` | 自定义规则（重建不丢） |
| `/etc/openclash/次元.yaml` | 当前运行配置（快速启动生效） |

手工排查：

```sh
/usr/sbin/appmanager status
/usr/sbin/appmanager doctor
/usr/sbin/appmanager preview 'enabled 1
runtime /etc/openclash/次元.yaml
custom /etc/openclash/custom/openclash_custom_rules.list
enforce_china_ip 1
device 10.10.10.27|测试|hongguo'
```

重启日志：

```sh
cat /tmp/appmanager-restart.log
cat /tmp/appmanager-restart.status
```

OpenClash 自身日志：

```sh
cat /tmp/openclash.log
```

## 8. 规则块长什么样

```yaml
rules:
  # >>> appmanager:begin >>>
  # 由 LuCI「应用管理」生成，请勿手改；在页面里改设备/应用。
  # 规则在 = 封禁；规则被注释 = 放行。
  # 微信/QQ 核心域名不在本块内，微信聊天与朋友圈不受影响。
  # 红果 (hongguo)
  - AND,((SRC-IP-CIDR,10.10.10.27/32),(OR,((DOMAIN-SUFFIX,fqnovel.com),(DOMAIN-SUFFIX,qznovelvod.com),(DOMAIN-SUFFIX,fqnovelpic.com),(DOMAIN-WILDCARD,*novel*.byteimg.com)))),REJECT
  # <<< appmanager:end <<<
  # ……原有的其他规则……
```

关闭总开关后：

```yaml
  # - AND,((SRC-IP-CIDR,10.10.10.27/32),(DOMAIN-SUFFIX,fqnovel.com)),REJECT
```

## 9. 已知限制

- 只做 **IPv4 源地址**；如果局域网启用了 IPv6，需要额外在防火墙/OpenClash 处理 IPv6，否则 App 可能走 IPv6 绕过。
- 规则基于域名/IP，不是 Android 包名；App 使用 HTTPDNS、QUIC 直连 IP 或私有协议时可能漏。
- 需要 fake-ip 或 sniffer/TLS SNI 能还原域名；纯 IP 直连且没有 sniffer 时，域名规则不命中。
- 设备 IP 必须固定；IP 变了规则就失效。
- 不要填网关自身 `10.10.10.2`，否则可能把路由器自己的流量也拒绝。
- 修改 `apps.tsv` 后需要刷新页面；包升级会覆盖内置库。
- 本目录没有在真实路由器上执行过；上线前请先“预览规则”和“环境检查”，并保留备份。

## 10. 卸载

包安装：

```sh
apk del luci-app-appmanager    # OpenWrt 25.12
# 或
opkg remove luci-app-appmanager
```

手工安装：

```sh
rm -f /usr/sbin/appmanager
rm -rf /usr/share/appmanager
rm -f /usr/share/luci/menu.d/luci-app-appmanager.json
rm -f /usr/share/rpcd/acl.d/luci-app-appmanager.json
rm -rf /www/luci-static/resources/view/appmanager
rm -f /etc/uci-defaults/91-appmanager-perms
# 配置和备份按需保留：/etc/appmanager
/etc/init.d/rpcd reload
```

卸载前建议先关闭管控并保存一次，让两个 OpenClash 文件里的规则块被注释；否则规则块会留在配置里。

## License

MIT

离线验证记录见 [TESTING.md](TESTING.md)。

# App 域名 / IP 调研（2026-11-14）

结论先说：

- **域名层：能查，而且能查得比较全。** 公共 Clash/Surge 规则集、v2fly geosite、本地抓包都能给出 App 专属域名。
- **IP 层：不能只靠“网上搜”。** 公共规则集的 IP 段基本按公司 / ASN / CDN 归组，不按 App 归组；同一个 `/24` 往往被多个 App 共用。IP 还会随 CDN 调度、HTTPDNS、运营商变化。要封某个 App 的真实服务器，必须自己抓包 + 查 IP 归属，确认是专用段。
- **红果的 9 条规则方向是对的：** 4 条域名 + 5 条 IP。但 `122.228.60.0/24` 的归属是 **浙江温州电信 AS134771**，不是字节自有网段；直接封整个 `/24` 会误伤同一运营商/CDN 上的其他服务。建议只在你确认该段是红果专用出口时启用。

## 1. 红果

### 域名层（4 条）

```text
fqnovel.com
qznovelvod.com
fqnovelpic.com
DOMAIN-WILDCARD,*novel*.byteimg.com
```

本地抓包 `phone_hosts.txt` 里能看到：

- `api5-normal-hl.fqnovel.com`
- `api5-normal-sinfonlineb.fqnovel.com`
- `mon11-misc-hl.fqnovel.com`
- `v5-reading-video.qznovelvod.com`
- `v5-ex-reading-video.qznovelvod.com`
- `v11-reading-video.qznovelvod.com`
- `v95-se-zjwztc-reading-video.qznovelvod.com`
- `lf3-reading.fqnovelpic.com`
- `p3-reading-sign.fqnovelpic.com`
- `p3-novel.byteimg.com`

注意 `p3-novel.byteimg.com` 不以 `novel` 开头，所以规则要用 `*novel*.byteimg.com`，
而不是用户最初写的 `novel*.byteimg.com`。

### 额外可加域名

这些也在字节规则集里，属于红果/番茄系，但会扩大影响面：

```text
fqnovelstatic.com
fqnovelvod.com
qznovel.com
qznovelpic.com
qznovelstatic.com
hongguoduanju.com
novelquickapp.com
```

### IP 层（5 条）

我无法从公开资料可靠推出你那 5 个网段。已知：

- `122.228.60.0/24`：`AS134771 WENZHOU, ZHEJIANG Province, P.R.China`，`China Telecom`，`Wzdx Pyfgs`。
- 同段不是字节 ASN，不能仅凭“红果连过”就认定整段专用。
- 2026-11-14 通过 Google DoH 解析到的当前地址：
  - `api5-normal-hl.fqnovel.com` → `139.177.246.206`、`101.47.85.10`（ByteDance / BytePlus，香港）
  - `fqnovelpic.com` / `p3-novel.byteimg.com` → `43.109.134.16-23`（Alibaba/Taobao CDN，和淘宝、小红书、西瓜、番茄共用）
  - `qznovelvod.com` → 多个省份电信/联通 CDN 地址（如 `1.194.172.138`、`183.204.8.202`），随调度变化

所以“红果真实服务器 IP”在这类抓包里通常不是固定 5 个段，而是 CDN 边缘节点。你要的 5 个段如果来自 HTTPDNS 或主 API 的固定出口，才有长期价值；否则建议每季度重新抓。

## 2. 其他 App 的域名候选

以下来自 `blackmatrix7/ios_rule_script` 的 Clash 规则（ByteDance 更新于 2026-10-04，其余多为 2025-06）：

### 淘宝

```text
taobao.com
tmall.com
tb.cn
tbcdn.cn
taobaocdn.com
taobao.org
tmall.hk
```

不要直接用整个 `Alibaba.list`：它包含 `alipay.com`、`alicdn.com`、`aliyun.com` 等 1200+ 域名和 53 个 IP 段，会误伤支付宝/阿里云。

### 小红书

```text
xiaohongshu.com
xhscdn.com
xhscdn.net
xhslink.com
xhsrcdn.com
rednote.com
fengkongcloud.com   # 风控；可选，封了可能影响登录流程
```

### 腾讯视频

```text
v.qq.com
vv.video.qq.com
v.video.qq.com
qqvideo.gtimg.com
v.smtcdns.com
pgdt.gtimg.cn
yoo.gtimg.com
v.streaming.qq.com
exact:video.qq.com
exact:dldir1.qq.com
exact:iacc.qq.com
exact:rdelivery.qq.com
exact:ts.qq.com
exact:ios.video.mpush.qq.com
exact:video-public-1258344701.shiply-cdn.qq.com
exact:video-search-1258344701.shiply-cdn.qq.com
exact:video-vip-1258344701.shiply-cdn.qq.com
```

关键：不要用 `DOMAIN-SUFFIX,video.qq.com`，否则会命中微信视频号的
`finder.video.qq.com`。应该用精确 `DOMAIN,video.qq.com`（`exact:`）。

### 微信视频号

保守专用：

```text
channels.weixin.qq.com
finder.video.qq.com
```

公共 WeChat 规则里还有这些候选，但可能影响朋友圈视频/缩略图，建议实测后再加：

```text
vweixinf.tc.qq.com
vweixinthumb.tc.qq.com
soup.v.qq.com
```

绝不要加：

```text
weixin.qq.com
wx.qq.com
qq.com
wechat.com
weixinbridge.com
```

### 爱奇艺

```text
iqiyi.com
iqiyipic.com
qiyi.com
qiyipic.com
qy.net
qy.com
qiyi.cn
iq.com
71.am
71.am.com
71edge.com
71edge.net
pps.tv
ppsimg.com
ppstream.com
ppstream.net
ppsurl.com
iqiyiedge.com
iqiyiedge.net
gitv.cn
gitv.tv
```

公共 iQIYI 规则还给了 21 个 IP-CIDR（如 `101.224.0.0/13`、`119.176.0.0/12`），
但这些是大段运营商/CDN 段，不是“爱奇艺专用”，只能做实验层。

### 西瓜视频

```text
ixigua.com
ixiguavideo.com
ixigua.net
bdxiguaimg.com
bdxiguastatic.com
bdxiguavod.com
xiguaapp.cn
xiguaapp.com
xiguashipin.cn
xiguashipin.net
xiguavideo.cn
xiguavideo.net
```

不要默认加 `pstatp.com`、`snssdk.com`、`byteimg.com`，这些是字节全系共用。

### 番茄小说

```text
fanqienovel.com
changdunovel.com
fanqieopen.com
fanqieopenpic.com
fanqieopenstatic.com
fanqieopenvod.com
fanqiesdk.com
fanqiesdkpic.com
fanqiesdkstatic.com
fanqiesdkvod.com
fanqiecopyright.com
```

`fqnovel.com` 和红果共用，放番茄里会跟红果重叠；当前内置把 `fqnovel.com` 归红果。

### 抖音

```text
douyin.com
douyinvod.com
douyinpic.com
douyincdn.com
douyinstatic.com
iesdouyin.com
iesdouyin.net
amemv.com
amemv.cn
amemv.net
douyinact.com
douyinact.net
douyinliving.com
douyinec.com
douyinpay.com
douyinclips.com
douyinhanyu.com
douyinmusicclips.com
douyinmusicvideo.com
douyinshortvideo.com
douyinvideo.net
idouyinpic.com
idouyinstatic.com
```

不要默认加 `ixigua.com`（和西瓜重叠）、`pstatp.com` / `snssdk.com` / `byteimg.com`（字节全系共用）。

## 3. IP 层调研结果

公共规则集里的 IP 情况：

| 规则集 | IP 段数量 | 说明 |
|---|---:|---|
| ByteDance | 1 | `114.246.10.65/32`，不足以覆盖全系 |
| iQIYI | 21 | 包含 `101.224.0.0/13`、`119.176.0.0/12` 等大段，非 App 专用 |
| TencentVideo | 3 IPv4 + 29 IPv6 | IPv4 只有 3 个 /32；IPv6 是映射地址 |
| Alibaba | 53 | 覆盖阿里全系，不能当淘宝专用 |
| WeChat | 1 IP-ASN | `ASN 132203`（腾讯），封 ASN 会误伤大量腾讯服务 |

当前 DNS 样本也说明 IP 共享：

| 域名 | 当前 A 记录（2026-11-14） | 归属 |
|---|---|---|
| `api5-normal-hl.fqnovel.com` | `139.177.246.206` / `101.47.85.10` | ByteDance / BytePlus HK |
| `fqnovelpic.com` | `43.109.134.16-23` | Alibaba/Taobao CDN |
| `p3-novel.byteimg.com` | `43.109.134.16-23` | Alibaba/Taobao CDN |
| `www.taobao.com` | `43.109.134.27-28` | Alibaba/Taobao CDN |
| `www.ixigua.com` | `43.109.134.16-23` | Alibaba/Taobao CDN |
| `www.fanqienovel.com` | `43.109.134.16-23` | Alibaba/Taobao CDN |
| `www.douyin.com` | `155.102.184.142-148` | Alibaba/Taobao CDN |
| `v5-reading-video.qznovelvod.com` | 多个省电信/联通地址 | 运营商 CDN |

所以“从网上找 5 个 IP 段”通常只能得到 CDN/ISP 段，不能可靠地只封一个 App。

## 4. 建议

1. **域名优先**：保持 fake-ip + sniffer，先把上面 App 专属域名补全。
2. **IP 只做实验层**：只加你抓包并确认归属的 `/32` 或专用 `/24`；`122.228.60.0/24` 先查清是否专用。
3. **红果 9 条**：4 条域名规则 + 5 条 IP 规则；IP 规则建议加 `no-resolve` 或让流量走真实 IP（fake-ip 下 IP-CIDR 对域名连接不一定命中）。
4. **拆分模式**：当前插件把同一 App 的多个目标 `OR` 在一条 `AND` 里，逻辑上等价；如果你要 9 条独立规则，需要加“按目标拆分”开关。
5. **抓包流程**：
   ```sh
   # 网关侧抓某台设备的 443 流量（示例）
   tcpdump -i br-lan -nn host 10.10.10.27 and tcp port 443 -w /tmp/app.pcap
   ```
   然后在 Wireshark 里看 TLS SNI / DNS，再用 `ipinfo.io` 或 `ip-api.com` 查 IP 归属；不要只按“出现过”就封整个段。

## 5. 来源

- `blackmatrix7/ios_rule_script`：ByteDance、DouYin、iQIYI、TencentVideo、WeChat、XiaoHongShu、Alibaba 规则集。
  - https://github.com/blackmatrix7/ios_rule_script/tree/master/rule/Clash
- 本地抓包：`phone_hosts.txt`（红果 API / 视频 / 图片域名）
- 本地 OpenClash 广告拦截笔记：`openclash-hongguo-adblock.sh`
- IP 归属：`ip-api.com` / `ipinfo.io` 查询结果
- mihomo 规则语法：https://wiki.metacubex.one/en/config/rules/

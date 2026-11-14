# 微信视频号封禁与“保留四项功能”的边界

目标：勾选“微信视频号”后，保留 **聊天、支付、朋友圈、视频通话**，其他微信功能尽量禁掉。

先说结论：

- **当前插件已经能保留聊天/支付/朋友圈的绝大部分域名**，只封视频号专用域名；视频通话需要实测。
- **不能简单封 `weixin.qq.com` 或 `qq.com`** 来“禁掉其他功能”。微信的聊天、登录、支付、搜一搜、看一看、朋友圈都共用这些父域；封父域会把要保留的功能一起封掉。
- 能精确封的是**有独立域名的功能**：视频号、公众号、部分小程序/游戏入口。搜一搜、看一看、直播入口和聊天共用 `weixin.qq.com`，域名层无法只封它们。

## 当前封禁

```text
channels.weixin.qq.com
finder.video.qq.com
```

保留的核心域名（不进入规则）：

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
servicewechat.com
wxsnsdy.tc.qq.com
wxsnsdy.wxs.qq.com
wxsnsdythumb.wxs.qq.com
```

## 建议的“保留四项”清单

### 聊天 / 登录

```text
weixin.qq.com
wx.qq.com
wechat.com
weixinbridge.com
short.weixin.qq.com
long.weixin.qq.com
login.weixin.qq.com
```

### 支付

```text
tenpay.com
wechatpay.com
wx.tenpay.com
pay.weixin.qq.com
```

### 朋友圈

```text
wxsnsdy.tc.qq.com
wxsnsdy.wxs.qq.com
wxsnsdythumb.wxs.qq.com
sns.qpic.cn
mmsns.qpic.cn
```

### 视频通话

没有可靠的公开域名清单。可能涉及：

```text
voip.weixin.qq.com
wxlive.weixin.qq.com
rtc.qq.com
```

但这些名字需要抓包确认；不要凭猜测加白名单。若父域 `weixin.qq.com` 被允许，这些子域通常也能走；若采用“只允许特定子域、再封父域”的做法，漏一个就可能导致视频通话失败。

## 可以尝试封的“非核心”独立域名

```text
mp.weixin.qq.com        # 公众号文章；也用于第三方 OAuth 登录，可能影响授权登录
servicewechat.com       # 小程序；封了小程序不可用
wxapp.tc.qq.com         # 小程序/微信内网页，风险较高
channels.weixin.qq.com  # 视频号网页后台
finder.video.qq.com     # 视频号媒体
vweixinf.tc.qq.com      # 视频号候选，可能影响朋友圈视频
vweixinthumb.tc.qq.com  # 视频号缩略图候选，可能影响朋友圈缩略图
soup.v.qq.com           # 微信视频候选，可能影响聊天内视频
```

建议把 `mp.weixin.qq.com` / `servicewechat.com` / `wxapp.tc.qq.com` 放到**单独的“微信非核心”自定义应用**里，而不是塞进“微信视频号”。这样你可以只封视频号，或同时封公众号/小程序，随时取消。

## 不能只靠域名层做到的

- 搜一搜、看一看、直播入口：和聊天共用 `weixin.qq.com`，没有独立域名。
- 微信内的网页/小程序内部功能：同一个 `servicewechat.com` 或 `wxapp.tc.qq.com` 承载很多服务。
- 视频通话：可能走 RTC/UDP 或动态 IP，域名规则抓不到；需要真实抓包。

## 推荐实测顺序

1. 只勾“微信视频号”，测试聊天、语音、视频通话、朋友圈图片/视频、支付、公众号、小程序。
2. 如果视频通话正常、朋友圈普通视频正常，就保持当前两个域名。
3. 再单独加“微信非核心”自定义应用，测试公众号 OAuth、小程序、支付。
4. 如果某项被误伤，立刻从自定义应用里删掉对应域名；不要用封父域的方式“试”。

## 结论

“保留聊天/支付/朋友圈/视频通话，其他先禁掉”在域名层只能做到**部分**：
能封视频号、公众号、部分小程序；不能在不影响聊天/登录的前提下封掉搜一搜/看一看等共享域功能。
当前最稳的做法是：**微信视频号只封专用域名 + 微信非核心做成可选自定义应用 + 视频通话先实测**。

#!/bin/sh
# 手工安装（不经过 opkg/apk）。在路由器上以 root 执行：
#   sh install.sh
#
# 如果只想打包成 OpenWrt 包，请用 SDK 编译本目录，不要运行这个脚本。
set -eu

[ "$(id -u)" = 0 ] || { echo "请用 root 执行" >&2; exit 1; }
[ -d /etc/openclash ] || { echo "未找到 /etc/openclash，请先安装 OpenClash" >&2; exit 1; }
command -v uci >/dev/null 2>&1 || { echo "未找到 uci，不像 OpenWrt 环境" >&2; exit 1; }

KEEP_CONFIG=/etc/appmanager/config
BACKUP=""
if [ -f "$KEEP_CONFIG" ]; then
	BACKUP=$(mktemp /tmp/appmanager-config.XXXXXX)
	cp -p "$KEEP_CONFIG" "$BACKUP"
fi

cp -a ./root/. /
chmod 755 /usr/sbin/appmanager /etc/uci-defaults/91-appmanager-perms 2>/dev/null || true

if [ -n "$BACKUP" ]; then
	cp -p "$BACKUP" "$KEEP_CONFIG"
	rm -f "$BACKUP"
	echo "已保留原有 /etc/appmanager/config"
fi

rm -f /tmp/luci-indexcache.* 2>/dev/null || true
rm -rf /tmp/luci-modulecache/ 2>/dev/null || true
/etc/init.d/rpcd reload 2>/dev/null || true

echo "安装完成。打开 LuCI -> 管控 -> 应用管理。"
echo "首次使用前建议先运行：/usr/sbin/appmanager doctor"

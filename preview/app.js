/* Interactive preview model for luci-app-appmanager.
 * Pure browser-side: no router calls, no file writes.
 */
(function () {
  'use strict';

  var APPS = [
    {
      id: 'taobao', name: '淘宝', short: '淘', color: '#ff6a00',
      targets: ['taobao.com', 'tmall.com', 'tbcdn.cn', 'taobaocdn.com', 'taobao.net'],
      note: '淘宝 / 天猫主站与静态资源'
    },
    {
      id: 'hongguo', name: '红果', short: '红', color: '#ff3b30',
      targets: ['fqnovel.com', 'qznovelvod.com', 'fqnovelpic.com', 'wildcard:*novel*.byteimg.com'],
      note: 'API / 视频 / 图片 CDN（图片含 p3-novel）'
    },
    {
      id: 'xiaohongshu', name: '小红书', short: '书', color: '#ff2442',
      targets: ['xiaohongshu.com', 'xhscdn.com', 'xhscdn.net', 'xhslink.com', 'xhsrcdn.com', 'rednote.com'],
      note: '小红书主站、图片与视频 CDN'
    },
    {
      id: 'tencentvideo', name: '腾讯视频', short: '腾', color: '#00a4ff',
      targets: ['v.qq.com', 'vv.video.qq.com', 'v.video.qq.com', 'qqvideo.gtimg.com', 'v.smtcdns.com', 'pgdt.gtimg.cn', 'yoo.gtimg.com', 'v.streaming.qq.com'],
      note: '腾讯视频专用域名'
    },
    {
      id: 'wechat_channels', name: '微信视频号', short: '视', color: '#07c160',
      targets: ['channels.weixin.qq.com', 'finder.video.qq.com', 'mp.weixin.qq.com', 'servicewechat.com', 'wxapp.tc.qq.com'],
      note: '保留聊天/支付/朋友圈/视频通话；封视频号/公众号/小程序'
    },
    {
      id: 'iqiyi', name: '爱奇艺', short: '奇', color: '#00b42a',
      targets: ['iqiyi.com', 'iqiyipic.com', 'qiyi.com', 'qiyipic.com', 'qy.net', '71.am', '71edge.com', 'pps.tv', 'ppsimg.com', 'iq.com'],
      note: '爱奇艺主站、播放器与 CDN'
    },
    {
      id: 'xigua', name: '西瓜视频', short: '西', color: '#ff5a1f',
      targets: ['ixigua.com', 'ixiguavideo.com', 'ixigua.net'],
      note: '西瓜视频主站与视频 CDN'
    },
    {
      id: 'fanqie', name: '番茄小说', short: '番', color: '#ff8a00',
      targets: ['fanqienovel.com', 'changdunovel.com'],
      note: '番茄小说主站与短链'
    },
    {
      id: 'douyin', name: '抖音', short: '抖', color: '#fe2c55',
      targets: ['douyin.com', 'douyinvod.com', 'douyinpic.com', 'douyincdn.com', 'douyinstatic.com', 'iesdouyin.com', 'amemv.com', 'amemv.cn', 'douyinact.com', 'douyinliving.com', 'douyinpay.com', 'douyinec.com'],
      note: '抖音主站、直播、电商与支付'
    }
  ];

  var PROTECTED = {
    'qq.com': true,
    'weixin.qq.com': true,
    'wechat.com': true,
    'wx.qq.com': true,
    'weixinbridge.com': true,
    'weixin.com': true
  };

  var PALETTE = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#16a34a', '#ca8a04', '#dc2626'];

  var state = {
    enabled: true,
    currentTab: 'custom',
    hitRan: true,
    devices: [
      {
        id: 'dev_demo',
        name: '客厅电视',
        ip: '10.10.10.27',
        apps: new Set(APPS.map(function (a) { return a.id; }))
      }
    ]
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  }

  function isValidIPv4(ip) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || '').trim());
    if (!m) return false;
    for (var i = 1; i <= 4; i++) {
      if (m[i].length > 1 && m[i].charAt(0) === '0') return false;
      var n = parseInt(m[i], 10);
      if (n < 0 || n > 255) return false;
    }
    return true;
  }

  function isValidCidr(value) {
    var s = String(value || '').trim();
    var p = s.split('/');
    if (p.length > 2 || !isValidIPv4(p[0])) return false;
    if (p.length === 2 && !/^(0|[1-9]|[12]\d|3[0-2])$/.test(p[1])) return false;
    return true;
  }

  function normalizeIp(value) {
    var s = String(value || '').trim();
    if (!isValidCidr(s)) return null;
    var p = s.split('/');
    return p[0] + '/' + (p.length === 2 ? p[1] : '32');
  }

  function normalizeTarget(value) {
    var t = String(value || '').trim().toLowerCase();
    if (!t) return null;
    if (t.indexOf('ip:') === 0) {
      var c = t.slice(3);
      if (!isValidCidr(c)) return null;
      var p = c.split('/');
      return 'ip:' + p[0] + '/' + (p.length === 2 ? p[1] : '32');
    }
    if (t.indexOf('wildcard:') === 0 || t.indexOf('*') >= 0) {
      var w = t.indexOf('wildcard:') === 0 ? t.slice(9) : t;
      if (!w || w.length > 253 || w.indexOf('.') < 0) return null;
      if (/[^a-z0-9.*-]/.test(w) || w.indexOf('..') >= 0 || w.charAt(0) === '.' || w.charAt(w.length - 1) === '.') return null;
      if (/(^|\.)qq\.com$/.test(w) || /(^|\.)weixin\.qq\.com$/.test(w)) return null;
      return 'wildcard:' + w;
    }
    t = t.replace(/^\*\./, '').replace(/^\./, '');
    if (PROTECTED[t]) return null;
    if (t.length > 253 || t.indexOf('.') < 0) return null;
    var labels = t.split('.');
    for (var i = 0; i < labels.length; i++) {
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(labels[i])) return null;
    }
    return t;
  }

  function parseTargets(text) {
    var tokens = String(text || '').replace(/[，,;；\s]+/g, '\n').split('\n');
    var out = [], bad = [], seen = {};
    tokens.forEach(function (token) {
      token = token.trim();
      if (!token) return;
      var n = normalizeTarget(token);
      if (!n) {
        bad.push(token);
        return;
      }
      if (!seen[n]) {
        seen[n] = true;
        out.push(n);
      }
    });
    return { out: out, bad: bad };
  }

  function normalizeHost(value) {
    var s = String(value || '').trim().toLowerCase();
    if (!s) return '';
    s = s.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
    s = s.replace(/:\d+$/, '');
    if (s.indexOf(':') >= 0 && !/^[0-9.]+$/.test(s)) return ''; // IPv6 not supported in this preview
    return s.replace(/^\.+|\.+$/g, '');
  }

  function ipToLong(ip) {
    var p = ip.split('.');
    return (((parseInt(p[0], 10) << 24) >>> 0) + (parseInt(p[1], 10) << 16) + (parseInt(p[2], 10) << 8) + parseInt(p[3], 10)) >>> 0;
  }

  function ipInCidr(ip, cidr) {
    var parts = String(cidr || '').split('/');
    if (!isValidIPv4(ip) || !isValidIPv4(parts[0])) return false;
    var prefix = parts.length === 2 ? parseInt(parts[1], 10) : 32;
    if (prefix === 0) return true;
    var mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(parts[0]) & mask);
  }

  function targetMatches(host, target) {
    if (target.indexOf('ip:') === 0) {
      return isValidIPv4(host) && ipInCidr(host, target.slice(3));
    }
    if (target.indexOf('wildcard:') === 0) {
      var w = target.slice(9).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      try { return new RegExp('^' + w + '$').test(host); }
      catch (e) { return false; }
    }
    return host === target || host.slice(-(target.length + 1)) === '.' + target;
  }

  function fakeIp(host) {
    var h = 0;
    for (var i = 0; i < host.length; i++) h = ((h * 31) + host.charCodeAt(i)) | 0;
    h = Math.abs(h);
    return '198.18.' + (h % 254 + 1) + '.' + ((h >> 8) % 254 + 1);
  }

  function appMeta(app) {
    if (app.short && app.color) return app;
    var name = String(app.name || '?');
    var h = 0;
    for (var i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) | 0;
    app.short = name.charAt(0) || '?';
    app.color = PALETTE[Math.abs(h) % PALETTE.length];
    return app;
  }

  function getEntries() {
    var entries = [];
    APPS.forEach(function (app) {
      var ips = [];
      state.devices.forEach(function (d) {
        if (!d.apps.has(app.id)) return;
        var ip = normalizeIp(d.ip);
        if (ip && ips.indexOf(ip) < 0) ips.push(ip);
      });
      if (ips.length && app.targets.length) entries.push({ app: app, ips: ips });
    });
    return entries;
  }

  function buildRule(app, ips) {
    var ipCond = ips.length === 1
      ? 'SRC-IP-CIDR,' + ips[0]
      : 'OR,((' + ips.map(function (ip) { return 'SRC-IP-CIDR,' + ip; }).join('),(') + '))';
    var targets = app.targets.map(function (t) {
      if (t.indexOf('ip:') === 0) return 'IP-CIDR,' + t.slice(3);
      if (t.indexOf('wildcard:') === 0) return 'DOMAIN-WILDCARD,' + t.slice(9);
      return 'DOMAIN-SUFFIX,' + t;
    });
    var targetCond = targets.length === 1
      ? targets[0]
      : 'OR,((' + targets.join('),(') + '))';
    return 'AND,((' + ipCond + '),(' + targetCond + ')),REJECT';
  }

  function buildBlockLines() {
    var entries = getEntries();
    var lines = [];
    lines.push('  # >>> appmanager:begin >>>');
    lines.push('  # 由「应用管理」交互预览生成；规则在 = 封禁，注释 = 放行。');
    lines.push('  # 微信/QQ 核心域名不在本块内，微信聊天/朋友圈不受影响。');
    if (!entries.length) lines.push('  # 尚未选择任何设备/应用。');
    entries.forEach(function (entry) {
      lines.push('  # ' + entry.app.name + ' (' + entry.app.id + ')');
      lines.push('  ' + (state.enabled ? '- ' : '# - ') + buildRule(entry.app, entry.ips));
    });
    lines.push('  # <<< appmanager:end <<<');
    return { lines: lines, entries: entries };
  }

  function fileContent(tab) {
    var block = buildBlockLines().lines;
    if (tab === 'runtime') {
      return [
        'mixed-port: 7890',
        'mode: rule',
        'dns:',
        '  enhanced-mode: fake-ip',
        '  fake-ip-range: 198.18.0.1/16',
        'rules:'
      ].concat(block).concat(['  - MATCH,DIRECT']).join('\n');
    }
    return ['rules:'].concat(block).concat(['  - DOMAIN-SUFFIX,old.example,DIRECT']).join('\n');
  }

  function colorize(line) {
    if (line.trim().charAt(0) === '#') {
      return '<span class="tok-c">' + esc(line) + '</span>';
    }
    var s = esc(line);
    s = s.replace(/\b(AND|OR|REJECT|SRC-IP-CIDR|DOMAIN-SUFFIX|IP-CIDR)\b/g, function (m) {
      if (m === 'REJECT') return '<span class="tok-reject">' + m + '</span>';
      if (m === 'SRC-IP-CIDR' || m === 'IP-CIDR') return '<span class="tok-ip">' + m + '</span>';
      if (m === 'DOMAIN-SUFFIX') return '<span class="tok-domain">' + m + '</span>';
      return '<span class="tok-kw">' + m + '</span>';
    });
    return s;
  }

  function currentContent() {
    return fileContent(state.currentTab);
  }

  function renderCode() {
    var content = currentContent();
    var lines = content.split('\n');
    els.code.innerHTML = lines.map(function (line, index) {
      return '<div class="code-line"><span class="ln">' + (index + 1) + '</span><span class="lc">' + colorize(line) + '</span></div>';
    }).join('');
    var entries = getEntries();
    var active = state.enabled ? entries.length : 0;
    els.codeMeta.textContent = state.enabled
      ? '规则已启用，写入 ' + entries.length + ' 条；插入在 rules: 顶部'
      : '当前已停用；' + entries.length + ' 条规则全部被注释';
    els.filePath.textContent = state.currentTab === 'runtime'
      ? '/etc/openclash/次元.yaml'
      : '/etc/openclash/custom/openclash_custom_rules.list';
    els.outputStats.innerHTML = '共 <b>' + entries.length + '</b> 条规则 · ' + (state.enabled ? '已启用' : '已注释');
    els.codeBadge.className = 'badge ' + (state.enabled ? 'on' : 'off');
    els.codeBadge.innerHTML = '<span class="dot"></span>' + (state.enabled ? entries.length + ' 条生效' : '全部放行');
    document.querySelectorAll('#codeTabs .tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === state.currentTab);
    });
  }

  function renderSummary() {
    var entries = getEntries();
    var pairs = 0;
    var invalid = 0;
    var empty = 0;
    var dup = 0;
    var seenIps = {};
    state.devices.forEach(function (d) {
      pairs += d.apps.size;
      if (!d.ip.trim()) {
        empty++;
        return;
      }
      var ip = normalizeIp(d.ip);
      if (!ip) {
        invalid++;
        return;
      }
      if (seenIps[ip]) dup++;
      seenIps[ip] = true;
    });

    els.statRules.textContent = state.enabled ? String(entries.length) : '0';
    els.statDevices.textContent = String(state.devices.length);
    els.statPairs.textContent = String(pairs);
    els.statusTitle.textContent = state.enabled ? '管控已开启' : '管控已关闭';
    els.statusSub.textContent = state.enabled
      ? '规则在 = 封禁；取消勾选或关闭开关 = 放行。'
      : '规则块保留，但每条规则都被注释，等同放行。';
    els.statusCard.classList.toggle('off', !state.enabled);
    els.statusBadge.className = 'badge ' + (state.enabled ? 'on' : 'off');
    els.statusBadge.innerHTML = '<span class="dot"></span>' + (state.enabled ? '规则已启用' : '全部放行');

    var warnings = [];
    if (invalid) warnings.push({ text: '有 ' + invalid + ' 台设备的 IP 无效，相关规则不会生成。', bad: true });
    if (empty) warnings.push({ text: '有 ' + empty + ' 台设备还没填 IP，暂时不会生成规则。', bad: false });
    if (dup) warnings.push({ text: '有 ' + dup + ' 台设备使用了重复 IP；规则会去重，建议改成不同设备。', bad: true });
    if (!state.devices.length) warnings.push({ text: '还没有设备；添加设备并填写固定 IP 后才会生成规则。', bad: false });
    if (state.enabled && entries.length === 0) warnings.push({ text: '管控已开启，但当前没有可生成的规则；请至少勾选一个应用。', bad: true });
    if (!state.enabled) warnings.push({ text: '当前为“全部放行”状态；打开开关后规则才会重新生效。', bad: false });

    if (!warnings.length) {
      els.warnings.innerHTML = '';
      return;
    }
    els.warnings.innerHTML = warnings.map(function (w) {
      return '<div class="warning' + (w.bad ? ' bad' : '') + '"><span class="ico">' + (w.bad ? '!' : 'i') + '</span><span>' + esc(w.text) + '</span></div>';
    }).join('');
  }

  function deviceTemplate(dev, index) {
    var invalid = dev.ip.trim() && !normalizeIp(dev.ip);
    var chips = APPS.map(function (app) {
      appMeta(app);
      var selected = dev.apps.has(app.id);
      return '<label class="chip' + (selected ? ' selected' : '') + (app.custom ? ' custom' : '') + '" style="--chip:' + app.color + '" title="' + esc(app.name + ' · ' + app.targets.length + ' 个目标') + '">' +
        '<input type="checkbox" data-app="' + esc(app.id) + '"' + (selected ? ' checked' : '') + '>' +
        '<span class="chip-icon">' + esc(app.short) + '</span>' +
        '<span class="chip-name">' + esc(app.name) + '</span>' +
        '<span class="chip-check">✓</span>' +
        '</label>';
    }).join('');

    return '<article class="device-card' + (invalid ? ' invalid' : '') + '" data-device="' + esc(dev.id) + '">' +
      '<div class="device-head">' +
        '<div class="device-num">' + (index + 1) + '</div>' +
        '<label class="field"><span>设备名称</span><input class="input" data-field="name" value="' + esc(dev.name) + '" placeholder="设备名称（可选）" autocomplete="off"></label>' +
        '<label class="field ipfield"><span>源 IP / CIDR</span><input class="input mono" data-field="ip" value="' + esc(dev.ip) + '" placeholder="10.10.10.27" autocomplete="off" spellcheck="false"></label>' +
        '<div class="device-total"><b>' + dev.apps.size + '</b><span>个应用</span></div>' +
        '<button class="icon-btn" type="button" data-action="remove" title="删除设备">×</button>' +
      '</div>' +
      '<div class="ip-msg">IP 格式不正确；这条设备暂时不会生成规则。</div>' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="device-actions">' +
        '<button class="mini-btn" type="button" data-action="all">全选</button>' +
        '<button class="mini-btn" type="button" data-action="none">清空</button>' +
        '<span class="hint">不在列表里的应用不受影响</span>' +
      '</div>' +
    '</article>';
  }

  function renderDevices() {
    if (!state.devices.length) {
      els.devices.innerHTML = '<div class="empty"><b>还没有设备</b><p>添加一台设备，填写固定 IP，再勾选要封禁的应用。</p><button class="btn btn-primary" type="button" data-action="add">＋ 添加第一台设备</button></div>';
      return;
    }
    els.devices.innerHTML = state.devices.map(deviceTemplate).join('');
  }

  function refreshHitDevices() {
    var previous = els.hitDevice.value;
    if (!state.devices.length) {
      els.hitDevice.innerHTML = '<option value="">未添加设备</option>';
      return;
    }
    els.hitDevice.innerHTML = state.devices.map(function (d, i) {
      var label = (d.name || ('设备 ' + (i + 1))) + ' · ' + (d.ip || '未填 IP');
      return '<option value="' + esc(d.id) + '">' + esc(label) + '</option>';
    }).join('');
    if (previous && state.devices.some(function (d) { return d.id === previous; })) {
      els.hitDevice.value = previous;
    }
  }

  function renderAll() {
    renderSummary();
    renderDevices();
    refreshHitDevices();
    renderCode();
    if (state.hitRan) runHitTest();
  }

  function updateDeviceCount(card, dev) {
    var el = card.querySelector('.device-total b');
    if (el) el.textContent = String(dev.apps.size);
  }

  function updateIpValidity(card, dev) {
    var invalid = !!dev.ip.trim() && !normalizeIp(dev.ip);
    card.classList.toggle('invalid', invalid);
  }

  function findDeviceByCard(card) {
    var id = card && card.getAttribute('data-device');
    for (var i = 0; i < state.devices.length; i++) {
      if (state.devices[i].id === id) return state.devices[i];
    }
    return null;
  }

  function addDevice() {
    state.devices.push({ id: uid('dev'), name: '', ip: '', apps: new Set() });
    renderAll();
    var cards = els.devices.querySelectorAll('.device-card');
    if (cards.length) {
      var input = cards[cards.length - 1].querySelector('[data-field="name"]');
      if (input) input.focus();
    }
    toast('已添加设备，填写 IP 后勾选应用');
  }

  function selectAllDevices(value) {
    state.devices.forEach(function (d) {
      d.apps = value ? new Set(APPS.map(function (a) { return a.id; })) : new Set();
    });
    renderAll();
    toast(value ? '已全选所有设备' : '已清空所有设备');
  }

  function evaluateHit(dev, host) {
    if (!dev) return { type: 'error', title: '没有可用设备', text: '先添加一台设备。' };
    if (!dev.ip.trim() || !normalizeIp(dev.ip)) return { type: 'error', title: '设备 IP 无效', text: '先填写一个有效的 IPv4 或 CIDR。' };
    if (!host) return { type: 'error', title: '目标为空', text: '输入一个域名或 IP。' };

    var fake = fakeIp(host);
    if (PROTECTED[host]) {
      return {
        type: 'allow', title: 'ALLOW · 微信/QQ 核心域名', text: '核心域名被保护，不会进入应用封禁规则。',
        host: host, fake: fake, reason: 'PROTECTED', steps: [
          ['DNS', host + ' → fake-ip ' + fake],
          ['还原', 'mihomo 还原域名 ' + host],
          ['保护', '微信/QQ 核心域名不在规则块内'],
          ['结果', '继续按 OpenClash 原有规则分流']
        ]
      };
    }
    if (!state.enabled) {
      return {
        type: 'allow', title: 'ALLOW · 管控已关闭', text: '规则块仍然存在，但每条规则都被注释。',
        host: host, fake: fake, reason: 'DISABLED', steps: [
          ['DNS', host + ' → fake-ip ' + fake],
          ['还原', 'mihomo 还原域名 ' + host],
          ['规则', '规则块全部被注释，没有 REJECT 生效'],
          ['结果', '继续按 OpenClash 原有规则分流']
        ]
      };
    }

    var hit = null;
    for (var i = 0; i < APPS.length; i++) {
      var app = APPS[i];
      if (!dev.apps.has(app.id)) continue;
      for (var j = 0; j < app.targets.length; j++) {
        if (targetMatches(host, app.targets[j])) {
          hit = app;
          break;
        }
      }
      if (hit) break;
    }

    if (!hit) {
      return {
        type: 'allow', title: 'ALLOW · 未命中应用规则', text: '该设备没有勾选任何能匹配这个目标的 App。',
        host: host, fake: fake, reason: 'NO_MATCH', steps: [
          ['DNS', host + ' → fake-ip ' + fake],
          ['还原', 'mihomo 还原域名 ' + host],
          ['匹配', '该设备已勾选的应用都不匹配'],
          ['结果', '继续按 OpenClash 原有规则分流']
        ]
      };
    }

    var entry = null;
    var entries = getEntries();
    for (var k = 0; k < entries.length; k++) {
      if (entries[k].app.id === hit.id) {
        entry = entries[k];
        break;
      }
    }
    var rule = entry ? buildRule(entry.app, entry.ips) : buildRule(hit, [normalizeIp(dev.ip)]);
    return {
      type: 'reject', title: 'REJECT · 命中「' + hit.name + '」', text: hit.id + ' · 已在这台设备勾选',
      host: host, fake: fake, reason: 'APP', app: hit, rule: rule, steps: [
        ['DNS', host + ' → fake-ip ' + fake],
        ['还原', 'mihomo 还原真实域名 ' + host],
        ['AND', '源 IP ' + normalizeIp(dev.ip) + ' + 目标命中 ' + hit.name],
        ['动作', 'REJECT 丢弃连接']
      ]
    };
  }

  function runHitTest() {
    var dev = null;
    for (var i = 0; i < state.devices.length; i++) {
      if (state.devices[i].id === els.hitDevice.value) {
        dev = state.devices[i];
        break;
      }
    }
    var host = normalizeHost(els.hitDomain.value);
    var result = evaluateHit(dev, host);
    state.hitRan = true;

    if (result.type === 'error') {
      els.hitResult.className = 'hit-result';
      els.hitResult.innerHTML = '<div class="hit-error">' + esc(result.title) + '：' + esc(result.text) + '</div>';
      return;
    }

    var steps = result.steps.map(function (step, index) {
      return '<div class="flow-step"><span class="n">' + (index + 1) + '</span><div><b>' + esc(step[0]) + '</b><em>' + esc(step[1]) + '</em></div></div>';
    }).join('');

    els.hitResult.className = 'hit-result ' + result.type;
    els.hitResult.innerHTML =
      '<div class="verdict">' +
        '<span class="verdict-mark">' + (result.type === 'reject' ? 'REJECT' : 'ALLOW') + '</span>' +
        '<div><b>' + esc(result.title.replace(/^(REJECT|ALLOW) · /, '')) + '</b><small>' + esc(result.text) + '</small></div>' +
      '</div>' +
      '<div class="flow">' + steps + '</div>' +
      (result.rule ? '<div class="formula"><code>' + esc(result.rule) + '</code></div>' : '');
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      els.toast.classList.remove('show');
    }, 2200);
  }

  function copyCurrent() {
    var text = currentContent();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast('已复制当前规则文件');
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('已复制当前规则文件'); }
    catch (e) { showToast('复制失败，请手动选择代码'); }
    document.body.removeChild(ta);
  }

  function downloadCurrent() {
    var text = currentContent();
    var name = state.currentTab === 'runtime' ? 'runtime-次元.yaml' : 'openclash_custom_rules.list';
    var blob = new Blob([text], { type: 'text/yaml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast('已下载 ' + name);
  }

  function openApplyDialog() {
    var steps = els.applySteps.querySelectorAll('.apply-step');
    steps.forEach(function (s) { s.classList.remove('done', 'active'); });
    els.applyConfirm.dataset.running = '0';
    els.applyConfirm.dataset.done = '0';
    els.applyConfirm.disabled = false;
    els.applyConfirm.textContent = '模拟应用';
    var entries = getEntries();
    els.applyTitle.textContent = state.enabled ? '保存并应用' : '保存并应用（当前为关闭状态）';
    els.applyNote.textContent = state.enabled
      ? '将写入 ' + entries.length + ' 条封禁规则；预览模式不会修改任何文件。'
      : '将写入 ' + entries.length + ' 条被注释的规则；预览模式不会修改任何文件。';
    if (typeof els.applyDialog.showModal === 'function') els.applyDialog.showModal();
    else els.applyDialog.setAttribute('open', '');
  }

  function runApplySimulation() {
    if (els.applyConfirm.dataset.done === '1') {
      els.applyDialog.close();
      return;
    }
    if (els.applyConfirm.dataset.running === '1') return;
    els.applyConfirm.dataset.running = '1';
    els.applyConfirm.disabled = true;
    els.applyConfirm.textContent = '处理中…';
    var steps = els.applySteps.querySelectorAll('.apply-step');
    var i = 0;
    function next() {
      if (i > 0) {
        steps[i - 1].classList.remove('active');
        steps[i - 1].classList.add('done');
      }
      if (i >= steps.length) {
        var n = getEntries().length;
        els.applyNote.textContent = '模拟完成：' + n + ' 条规则已生成；0 个文件被写入。真实插件会在这一步重启 OpenClash。';
        els.applyConfirm.dataset.running = '0';
        els.applyConfirm.dataset.done = '1';
        els.applyConfirm.disabled = false;
        els.applyConfirm.textContent = '完成';
        return;
      }
      steps[i].classList.add('active');
      i++;
      setTimeout(next, 380);
    }
    next();
  }

  function bindEvents() {
    els.enabledToggle.addEventListener('change', function (e) {
      state.enabled = e.target.checked;
      renderSummary();
      renderCode();
      if (state.hitRan) runHitTest();
    });

    els.addDeviceBtn.addEventListener('click', addDevice);
    els.saveApplyBtn.addEventListener('click', openApplyDialog);
    els.applyCancel.addEventListener('click', function () { els.applyDialog.close(); });
    els.applyConfirm.addEventListener('click', runApplySimulation);
    els.applyDialog.addEventListener('click', function (e) {
      if (e.target === els.applyDialog) els.applyDialog.close();
    });
    els.selectAllBtn.addEventListener('click', function () { selectAllDevices(true); });
    els.clearAllBtn.addEventListener('click', function () { selectAllDevices(false); });

    els.devices.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb.matches('input[data-app]')) return;
      var card = cb.closest('.device-card');
      var dev = findDeviceByCard(card);
      if (!dev) return;
      var id = cb.getAttribute('data-app');
      if (cb.checked) dev.apps.add(id); else dev.apps.delete(id);
      var chip = cb.closest('.chip');
      if (chip) chip.classList.toggle('selected', cb.checked);
      updateDeviceCount(card, dev);
      renderSummary();
      renderCode();
      if (state.hitRan) runHitTest();
    });

    els.devices.addEventListener('input', function (e) {
      var field = e.target.getAttribute('data-field');
      if (!field) return;
      var card = e.target.closest('.device-card');
      var dev = findDeviceByCard(card);
      if (!dev) return;
      if (field === 'name') {
        dev.name = e.target.value;
      } else if (field === 'ip') {
        dev.ip = e.target.value;
        updateIpValidity(card, dev);
      }
      renderSummary();
      renderCode();
      if (state.hitRan) runHitTest();
    });

    els.devices.addEventListener('change', function (e) {
      if (e.target.getAttribute('data-field') === 'name') refreshHitDevices();
    });

    els.devices.addEventListener('click', function (e) {
      var actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      var action = actionEl.getAttribute('data-action');
      if (action === 'add') { addDevice(); return; }
      var card = e.target.closest('.device-card');
      if (!card) return;
      var dev = findDeviceByCard(card);
      if (!dev) return;
      if (action === 'remove') {
        if (!window.confirm('删除设备「' + (dev.name || dev.ip || '未命名') + '」？')) return;
        state.devices = state.devices.filter(function (d) { return d.id !== dev.id; });
        renderAll();
        toast('已删除设备');
      } else if (action === 'all') {
        dev.apps = new Set(APPS.map(function (a) { return a.id; }));
        renderAll();
        toast('已全选该设备');
      } else if (action === 'none') {
        dev.apps = new Set();
        renderAll();
        toast('已清空该设备');
      }
    });

    document.querySelectorAll('#codeTabs .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.currentTab = tab.getAttribute('data-tab');
        renderCode();
      });
    });

    els.copyBtn.addEventListener('click', copyCurrent);
    els.downloadBtn.addEventListener('click', downloadCurrent);
    els.focusCodeBtn.addEventListener('click', function () {
      els.outputCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    els.hitRun.addEventListener('click', runHitTest);
    els.hitDomain.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') runHitTest();
    });
    document.querySelectorAll('[data-domain]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        els.hitDomain.value = btn.getAttribute('data-domain');
        runHitTest();
      });
    });

    els.addAppBtn.addEventListener('click', openAppDialog);
    els.caCancel.addEventListener('click', function () { els.appDialog.close(); });
    els.caAdd.addEventListener('click', addCustomApp);
    els.appDialog.addEventListener('click', function (e) {
      if (e.target === els.appDialog) els.appDialog.close();
    });
  }

  function openAppDialog() {
    els.caName.value = '';
    els.caTargets.value = '';
    els.caError.textContent = '';
    if (typeof els.appDialog.showModal === 'function') els.appDialog.showModal();
    else els.appDialog.setAttribute('open', '');
    setTimeout(function () { els.caName.focus(); }, 40);
  }

  function addCustomApp() {
    var name = String(els.caName.value || '').replace(/\|/g, '').trim();
    if (!name) { els.caError.textContent = '请填写应用名称。'; return; }
    if (name.length > 20) { els.caError.textContent = '应用名称最多 20 个字符。'; return; }
    var parsed = parseTargets(els.caTargets.value);
    if (!parsed.out.length) {
      els.caError.textContent = parsed.bad.length
        ? '这些目标无效：' + parsed.bad.slice(0, 3).join('、')
        : '至少填写一个有效域名或 ip:1.2.3.0/24。';
      return;
    }
    if (parsed.bad.length) {
      els.caError.textContent = '这些目标无效：' + parsed.bad.slice(0, 3).join('、');
      return;
    }
    if (parsed.out.length > 20) { els.caError.textContent = '一个自定义应用最多 20 个目标。'; return; }
    var app = { id: uid('custom'), name: name, targets: parsed.out, note: '自定义应用', custom: true };
    appMeta(app);
    APPS.push(app);
    els.appDialog.close();
    renderAll();
    showToast('已添加「' + name + '」，在设备卡片里勾选后生效');
  }

  function init() {
    els = {
      statusCard: $('statusCard'), statusTitle: $('statusTitle'), statusSub: $('statusSub'),
      statusBadge: $('statusBadge'), enabledToggle: $('enabledToggle'),
      statRules: $('statRules'), statDevices: $('statDevices'), statPairs: $('statPairs'),
      warnings: $('warnings'), devices: $('devices'), addDeviceBtn: $('addDeviceBtn'),
      addAppBtn: $('addAppBtn'), saveApplyBtn: $('saveApplyBtn'),
      selectAllBtn: $('selectAllBtn'), clearAllBtn: $('clearAllBtn'),
      code: $('code'), codeMeta: $('codeMeta'), codeBadge: $('codeBadge'), filePath: $('filePath'),
      outputStats: $('outputStats'), copyBtn: $('copyBtn'), downloadBtn: $('downloadBtn'),
      outputCard: $('outputCard'), focusCodeBtn: $('focusCodeBtn'),
      hitDevice: $('hitDevice'), hitDomain: $('hitDomain'), hitRun: $('hitRun'), hitResult: $('hitResult'),
      applyDialog: $('applyDialog'), applyTitle: $('applyTitle'), applySteps: $('applySteps'),
      applyNote: $('applyNote'), applyCancel: $('applyCancel'), applyConfirm: $('applyConfirm'),
      appDialog: $('appDialog'), appForm: $('appForm'), caName: $('caName'), caTargets: $('caTargets'),
      caError: $('caError'), caCancel: $('caCancel'), caAdd: $('caAdd'), toast: $('toast')
    };
    bindEvents();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

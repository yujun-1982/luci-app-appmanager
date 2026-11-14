/* WeChat feature policy preview. Browser-only, no router access. */
(function () {
  'use strict';

  var FEATURES = [
    {
      id: 'channels', name: '视频号', icon: '视',
      desc: '视频号 / 直播 / 回放', risk: 'safe', riskText: '专用域',
      domains: [
        { type: 'suffix', value: 'channels.weixin.qq.com' },
        { type: 'suffix', value: 'finder.video.qq.com' }
      ],
      defaultOn: true
    },
    {
      id: 'official', name: '公众号', icon: '公',
      desc: '文章 / 服务号 / 部分第三方 OAuth', risk: 'warn', riskText: 'OAuth 风险',
      domains: [{ type: 'exact', value: 'mp.weixin.qq.com' }],
      defaultOn: false
    },
    {
      id: 'mini', name: '小程序', icon: '程',
      desc: '小程序 / 微信内网页', risk: 'warn', riskText: '影响小程序',
      domains: [
        { type: 'suffix', value: 'servicewechat.com' },
        { type: 'suffix', value: 'wxapp.tc.qq.com' }
      ],
      defaultOn: true
    },
    {
      id: 'search', name: '搜一搜 / 看一看', icon: '搜',
      desc: '和聊天共用 weixin.qq.com，域名层无法单独封', risk: 'danger', riskText: '不可单独封',
      domains: [], disabled: true
    },
    {
      id: 'game', name: '游戏 / 购物', icon: '游',
      desc: '入口域名需抓包确认，不建议猜', risk: 'danger', riskText: '需抓包',
      domains: [], disabled: true
    }
  ];

  var KEEP = [
    {
      id: 'chat', name: '聊天', domains: ['short.weixin.qq.com', 'long.weixin.qq.com', 'wx.qq.com'],
      note: '文字 / 语音 / 群聊'
    },
    {
      id: 'pay', name: '支付', domains: ['tenpay.com', 'wechatpay.com', 'wx.tenpay.com'],
      note: '红包 / 转账 / 付款'
    },
    {
      id: 'moments', name: '朋友圈', domains: ['wxsnsdy.tc.qq.com', 'wxsnsdy.wxs.qq.com', 'wxsnsdythumb.wxs.qq.com', 'sns.qpic.cn', 'mmsns.qpic.cn'],
      note: '图片 / 普通视频'
    },
    {
      id: 'call', name: '视频通话', domains: ['voip.weixin.qq.com', 'wxlive.weixin.qq.com', 'rtc.qq.com'],
      note: '域名待实测'
    },
    {
      id: 'shared', name: '共享域', domains: ['weixin.qq.com'],
      note: '搜一搜/看一看共用，不能整域封'
    }
  ];

  var state = {
    enabled: true,
    strength: 'standard',
    toggles: {},
    tab: 'rules',
    hitRan: true
  };
  var els = {};

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fakeIp(host) {
    var h = 0;
    for (var i = 0; i < host.length; i++) h = ((h * 31) + host.charCodeAt(i)) | 0;
    h = Math.abs(h);
    return '198.18.' + (h % 254 + 1) + '.' + ((h >> 8) % 254 + 1);
  }
  function normalizeHost(value) {
    var s = String(value || '').trim().toLowerCase();
    if (!s) return '';
    s = s.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].replace(/:\d+$/, '');
    if (s.indexOf(':') >= 0) return '';
    return s.replace(/^\.+|\.+$/g, '');
  }
  function validIp(value) {
    var s = String(value || '').trim();
    var p = s.split('/');
    if (p.length > 2) return null;
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(p[0]);
    if (!m) return null;
    for (var i = 1; i <= 4; i++) {
      if (m[i].length > 1 && m[i].charAt(0) === '0') return null;
      var n = parseInt(m[i], 10);
      if (n < 0 || n > 255) return null;
    }
    if (p.length === 2 && !/^(0|[1-9]|[12]\d|3[0-2])$/.test(p[1])) return null;
    return p[0] + '/' + (p.length === 2 ? p[1] : '32');
  }
  function domainMatches(host, rule) {
    if (rule.type === 'exact') return host === rule.value;
    return host === rule.value || host.slice(-(rule.value.length + 1)) === '.' + rule.value;
  }
  function featureById(id) {
    for (var i = 0; i < FEATURES.length; i++) if (FEATURES[i].id === id) return FEATURES[i];
    return null;
  }
  function selectedDomains() {
    var out = [];
    FEATURES.forEach(function (f) {
      if (f.disabled || !state.toggles[f.id]) return;
      f.domains.forEach(function (d) { out.push({ feature: f, rule: d }); });
    });
    return out;
  }
  function blockCount() { return selectedDomains().length; }

  function applyStrength(strength) {
    state.strength = strength;
    var map = {
      conservative: { channels: true, official: false, mini: false },
      standard: { channels: true, official: false, mini: true },
      aggressive: { channels: true, official: true, mini: true }
    }[strength] || {};
    FEATURES.forEach(function (f) {
      if (f.disabled) state.toggles[f.id] = false;
      else state.toggles[f.id] = !!map[f.id];
    });
    renderAll();
  }

  function renderFeatures() {
    els.features.innerHTML = FEATURES.map(function (f) {
      var on = !!state.toggles[f.id];
      var switchHtml = f.disabled
        ? '<span class="risk danger" style="font-size:8px">—</span>'
        : '<label class="switch" aria-label="封禁' + esc(f.name) + '"><input type="checkbox" data-feature="' + esc(f.id) + '"' + (on ? ' checked' : '') + '><span class="switch-track"></span></label>';
      var domainText = f.domains.length ? f.domains.map(function (d) { return '<code>' + esc(d.value) + '</code>'; }).join(' ') : '<span style="color:#6f847c">无独立域名</span>';
      return '<div class="feature' + (f.disabled ? ' disabled unavailable' : '') + '">' +
        '<div class="ico">' + esc(f.icon) + '</div>' +
        '<div><b>' + esc(f.name) + '</b><small>' + esc(f.desc) + ' · ' + domainText + '</small></div>' +
        '<div class="right-box"><span class="risk ' + esc(f.risk) + '">' + esc(f.riskText) + '</span>' + switchHtml + '</div>' +
      '</div>';
    }).join('');
    var n = blockCount();
    els.blockCount.textContent = state.enabled ? (n + ' 条规则') : '已关闭';
    els.blockCount.className = 'risk ' + (!state.enabled || n === 0 ? 'safe' : n > 3 ? 'danger' : 'warn');
    if (els.wechatPower) {
      els.wechatPower.textContent = state.enabled ? '关闭微信管控' : '开启微信管控';
      els.wechatPower.className = 'btn ' + (state.enabled ? 'btn-danger-soft' : 'btn-primary');
    }
    document.querySelectorAll('.strength button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-strength') === state.strength);
    });
  }

  function ruleLine(ip, rule, target) {
    return (state.enabled ? '- ' : '# - ') + 'AND,((SRC-IP-CIDR,' + ip + '),(' + target + ')),REJECT';
  }

  function buildRules() {
    var ip = validIp(els.sourceIp.value);
    if (!ip) {
      return '# 源 IP 格式不正确\n# 请输入 IPv4 或 CIDR，例如 10.10.10.27\n';
    }
    var lines = [
      '# 微信功能管控 · 交互预览',
      '# 保留：聊天 / 支付 / 朋友圈 / 视频通话',
      '# 源 IP：' + ip,
      state.enabled ? '# 状态：已开启，以下规则生效' : '# 状态：已关闭，以下规则全部被注释',
      ''
    ];
    var domains = selectedDomains();
    if (!domains.length) {
      lines.push('# 当前没有勾选任何封禁功能');
    } else {
      domains.forEach(function (d) {
        lines.push('# ' + d.feature.name + ' · ' + d.rule.value);
        lines.push(ruleLine(ip, d.rule, (d.rule.type === 'exact' ? 'DOMAIN,' : 'DOMAIN-SUFFIX,') + d.rule.value));
      });
    }
    return lines.join('\n') + '\n';
  }

  function buildAllow() {
    var lines = [
      '# 保留清单（不写入 REJECT）',
      '# 这些功能/域名不进入封禁规则；weixin.qq.com 是共享域，不能整域封。',
      ''
    ];
    KEEP.forEach(function (k) {
      lines.push('# ' + k.name + ' · ' + k.note);
      k.domains.forEach(function (d) { lines.push('DOMAIN-SUFFIX,' + d); });
      lines.push('');
    });
    return lines.join('\n');
  }

  function colorize(line) {
    if (line.trim().charAt(0) === '#') return '<span class="tok-c">' + esc(line) + '</span>';
    var s = esc(line);
    s = s.replace(/\b(AND|REJECT|DOMAIN-SUFFIX|DOMAIN|SRC-IP-CIDR)\b/g, function (m) {
      if (m === 'REJECT') return '<span class="tok-reject">' + m + '</span>';
      if (m === 'SRC-IP-CIDR') return '<span class="tok-ip">' + m + '</span>';
      if (m === 'DOMAIN-SUFFIX' || m === 'DOMAIN') return '<span class="tok-domain">' + m + '</span>';
      return '<span class="tok-kw">' + m + '</span>';
    });
    return s;
  }

  function currentContent() {
    return state.tab === 'allow' ? buildAllow() : buildRules();
  }

  function renderCode() {
    var content = currentContent();
    els.code.innerHTML = content.split('\n').map(function (line, i) {
      return '<div class="code-line"><span class="ln">' + (i + 1) + '</span><span class="lc">' + colorize(line) + '</span></div>';
    }).join('');
    var n = blockCount();
    var ip = validIp(els.sourceIp.value);
    els.ruleBadge.textContent = ip ? (state.enabled ? n + ' 条' : '已关闭') : 'IP 无效';
    els.ruleBadge.className = 'risk ' + (ip ? (!state.enabled || !n ? 'safe' : 'warn') : 'danger');
    els.stats.innerHTML = '源 IP <b>' + esc(ip || els.sourceIp.value || '未填') + '</b> · ' + (state.enabled ? n + ' 条封禁' : '已关闭，规则已注释');
    els.path.textContent = state.tab === 'allow' ? '保留清单 · 不会写入规则' : 'openclash_custom_rules.list · 插入 rules: 顶部';
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === state.tab);
    });
  }

  function matchFeature(host) {
    for (var i = 0; i < FEATURES.length; i++) {
      var f = FEATURES[i];
      for (var j = 0; j < f.domains.length; j++) {
        if (domainMatches(host, f.domains[j])) return { feature: f, rule: f.domains[j] };
      }
    }
    for (var k = 0; k < KEEP.length; k++) {
      if (KEEP[k].domains.indexOf(host) >= 0) return { keep: KEEP[k] };
    }
    return null;
  }

  function runHit() {
    var host = normalizeHost(els.domain.value);
    var ip = validIp(els.sourceIp.value);
    state.hitRan = true;
    if (!host) {
      els.hitResult.className = 'hit-result';
      els.hitResult.innerHTML = '<div class="hit-error">请输入一个域名。</div>';
      return;
    }
    if (!ip) {
      els.hitResult.className = 'hit-result';
      els.hitResult.innerHTML = '<div class="hit-error">源 IP 格式不正确，无法生成规则。</div>';
      return;
    }
    var fake = fakeIp(host);
    var match = matchFeature(host);
    var blocked = false;
    var reason = '';
    var rule = '';
    var title = '';

    if (!state.enabled) {
      reason = '微信管控已关闭，规则全部被注释';
      title = 'ALLOW · 微信管控关闭';
    } else if (match && match.feature) {
      var f = match.feature;
      if (f.disabled) {
        reason = f.name + ' 没有可独立封禁的域名';
        title = 'ALLOW · ' + f.name;
      } else if (!state.toggles[f.id]) {
        reason = f.name + ' 当前未勾选封禁';
        title = 'ALLOW · ' + f.name;
      } else {
        blocked = true;
        reason = f.name + ' 已勾选，命中 ' + match.rule.value;
        title = 'REJECT · ' + f.name;
        rule = ruleLine(ip, match.rule, (match.rule.type === 'exact' ? 'DOMAIN,' : 'DOMAIN-SUFFIX,') + match.rule.value);
      }
    } else if (match && match.keep) {
      reason = '命中保留/共享域：' + match.keep.name + '，不进入 REJECT';
      title = 'ALLOW · ' + match.keep.name;
    } else {
      reason = '不在当前微信规则里，继续按 OpenClash 原有规则分流';
      title = 'ALLOW · 未命中';
    }

    var steps = [
      ['DNS', host + ' → fake-ip ' + fake],
      ['还原', 'mihomo 还原域名 ' + host],
      [blocked ? '命中' : '判断', reason],
      ['动作', blocked ? 'REJECT 丢弃连接' : '继续匹配 / DIRECT']
    ];

    els.hitResult.className = 'hit-result ' + (blocked ? 'reject' : 'allow');
    els.hitResult.innerHTML =
      '<div class="verdict"><span class="verdict-mark">' + (blocked ? 'REJECT' : 'ALLOW') + '</span>' +
      '<div><b>' + esc(title.replace(/^(REJECT|ALLOW) · /, '')) + '</b><small>' + esc(reason) + '</small></div></div>' +
      '<div class="flow">' + steps.map(function (s, i) {
        return '<div class="flow-step"><span class="n">' + (i + 1) + '</span><div><b>' + esc(s[0]) + '</b><em>' + esc(s[1]) + '</em></div></div>';
      }).join('') + '</div>' +
      (rule ? '<div class="formula" style="margin-top:8px;border-top:1px dashed rgba(148,163,184,.14);padding-top:7px;overflow:auto"><code style="white-space:pre-wrap;word-break:break-word;color:#b7c8e0;font-family:var(--mono);font-size:9px">' + esc(rule) + '</code></div>' : '');
  }

  function renderAll() {
    renderFeatures();
    renderCode();
    if (state.hitRan) runHit();
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { els.toast.classList.remove('show'); }, 2000);
  }

  function copyCurrent() {
    var text = currentContent();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast('已复制'); }).catch(function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('已复制'); } catch (e) { showToast('复制失败'); }
    document.body.removeChild(ta);
  }
  function downloadCurrent() {
    var text = currentContent();
    var name = state.tab === 'allow' ? 'wechat-allowlist.txt' : 'wechat-preview-rules.list';
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 800);
    showToast('已下载 ' + name);
  }

  function togglePower() {
    state.enabled = !state.enabled;
    renderAll();
    showToast(state.enabled ? '已开启微信管控（预览）' : '已关闭微信管控，规则全部改为注释（预览）');
  }

  function openApplyDialog() {
    var steps = els.applySteps.querySelectorAll('.apply-step');
    steps.forEach(function (s) { s.classList.remove('done', 'active'); });
    els.applyConfirm.dataset.running = '0';
    els.applyConfirm.dataset.done = '0';
    els.applyConfirm.disabled = false;
    els.applyConfirm.textContent = '模拟应用';
    var n = blockCount();
    els.applyNote.textContent = state.enabled
      ? '将写入 ' + n + ' 条微信规则；预览模式不会修改任何文件。'
      : '当前微信管控已关闭，将写入 ' + n + ' 条被注释的规则；预览模式不会修改任何文件。';
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
        els.applyNote.textContent = '模拟完成：' + blockCount() + ' 条微信规则已生成；0 个文件被写入。真实插件会重启 OpenClash。';
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

  function bind() {
    els.wechatPower.addEventListener('click', togglePower);
    els.wechatSave.addEventListener('click', openApplyDialog);
    els.applyCancel.addEventListener('click', function () { els.applyDialog.close(); });
    els.applyConfirm.addEventListener('click', runApplySimulation);
    els.applyDialog.addEventListener('click', function (e) {
      if (e.target === els.applyDialog) els.applyDialog.close();
    });
    document.querySelectorAll('.strength button').forEach(function (btn) {
      btn.addEventListener('click', function () { applyStrength(btn.getAttribute('data-strength')); });
    });
    els.features.addEventListener('change', function (e) {
      var id = e.target.getAttribute('data-feature');
      if (!id) return;
      state.toggles[id] = e.target.checked;
      state.strength = 'custom';
      renderAll();
    });
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.tab = tab.getAttribute('data-tab');
        renderCode();
      });
    });
    els.sourceIp.addEventListener('input', function () {
      els.sourceRow.classList.toggle('invalid', !validIp(els.sourceIp.value));
      renderCode();
      if (state.hitRan) runHit();
    });
    els.run.addEventListener('click', runHit);
    els.domain.addEventListener('keydown', function (e) { if (e.key === 'Enter') runHit(); });
    document.querySelectorAll('[data-domain]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        els.domain.value = btn.getAttribute('data-domain');
        runHit();
      });
    });
    els.copy.addEventListener('click', copyCurrent);
    els.download.addEventListener('click', downloadCurrent);
  }

  function init() {
    els = {
      features: $('features'), blockCount: $('blockCount'), sourceIp: $('sourceIp'), sourceRow: $('sourceRow'),
      code: $('code'), ruleBadge: $('ruleBadge'), stats: $('stats'), path: $('path'),
      domain: $('domain'), run: $('run'), hitResult: $('hitResult'),
      wechatPower: $('wechatPower'), wechatSave: $('wechatSave'),
      applyDialog: $('applyDialog'), applySteps: $('applySteps'), applyNote: $('applyNote'),
      applyCancel: $('applyCancel'), applyConfirm: $('applyConfirm'),
      copy: $('copy'), download: $('download'), toast: $('toast')
    };
    applyStrength('standard');
    bind();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

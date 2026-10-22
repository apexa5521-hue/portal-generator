/* مكتبة العرض المشتركة: الأيقونات، الألوان، ورسم الصفحة. تُستخدم في index.html وفي معاينة الأدمن. */
(function (global) {
  'use strict';

  var ICONS = {
    check: ['قائمة تحقق', '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>'],
    sign: ['توقيع', '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>'],
    smile: ['استبيان', '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>'],
    cap: ['تدريب', '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>'],
    users: ['فريق', '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'],
    shield: ['حماية', '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'],
    file: ['ملف', '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'],
    calendar: ['تقويم', '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'],
    chart: ['تقارير', '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'],
    clipboard: ['نموذج', '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'],
    phone: ['اتصال', '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'],
    box: ['مستلزمات', '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>'],
    dashboard: ['لوحة متابعة', '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'],
    bell: ['تنبيهات', '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'],
    message: ['رسائل', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'],
    wrench: ['صيانة', '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'],
    building: ['مبنى', '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>'],
    link: ['رابط', '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>']
  };
  var ICON_KEYS = Object.keys(ICONS);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function svg(key, size, sw) {
    var it = ICONS[key] || ICONS.link;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + it[1] + '</svg>';
  }

  var ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 17V7h10"/><path d="M17 17 7 7"/></svg>';

  /* ───── الألوان ───── */
  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    var n = parseInt(m ? m[1] : '0f766e', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
  }
  function lin(c) { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(rgb) { return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); }
  function contrastWithWhite(rgb) { return 1.05 / (lum(rgb) + 0.05); }
  function mix(rgb, target, amt) { return rgb.map(function (v) { return v + (target - v) * amt; }); }
  function rgba(rgb, a) { return 'rgba(' + rgb.map(Math.round).join(',') + ',' + a + ')'; }

  /* يغمّق اللون تلقائيًا حتى يبقى النص الأبيض فوقه مقروءًا (نسبة تباين 4.5 على الأقل). */
  function ensureDark(hex, min) {
    var rgb = hexToRgb(hex);
    var n = 0;
    while (contrastWithWhite(rgb) < (min || 4.5) && n < 60) { rgb = mix(rgb, 0, 0.06); n++; }
    return toHex(rgb);
  }

  function palette(hex) {
    var base = ensureDark(hex);
    var rgb = hexToRgb(base);
    return {
      accent: base,
      dark: toHex(mix(rgb, 0, 0.3)),
      soft: rgba(rgb, 0.1),
      glow: rgba(rgb, 0.14),
      bright: toHex(mix(rgb, 255, 0.4)),
      dot: rgba(rgb, 0.2),
      tint: toHex(mix(rgb, 255, 0.88))
    };
  }

  /* ───── نصوص ───── */
  function countLabel(n) {
    var f = new Intl.NumberFormat('ar-SA').format(n);
    if (n === 1) return 'نظام واحد متاح';
    if (n === 2) return 'نظامان متاحان';
    if (n >= 3 && n <= 10) return f + ' أنظمة متاحة';
    return f + ' نظامًا متاحًا';
  }

  function safeUrl(u) {
    u = String(u || '').trim();
    if (u === '#') return '#';
    return /^https?:\/\/\S+$/i.test(u) ? u : '#';
  }
  function safeLogo(l) {
    l = String(l || '');
    return /^data:image\/(png|webp|jpeg|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(l) ? l : '';
  }

  function cfg() { return global.PORTAL_CONFIG || {}; }

  /* اسم المنشأة اختياري: يُحذف من الرأس كليًا عند تركه فارغًا في config.js */
  function brandHtml(withSub) {
    var c = cfg();
    if (!c.ORG_NAME && !(withSub && c.ORG_SUB)) return '';
    return '<div class="brand">' + (c.ORG_NAME ? '<span class="brand__name">' + esc(c.ORG_NAME) + '</span>' : '') +
      (withSub && c.ORG_SUB ? '<span class="brand__sub">' + esc(c.ORG_SUB) + '</span>' : '') + '</div>';
  }

  function cardHtml(c, i) {
    var logo = safeLogo(c.logo);
    var icon = logo
      ? '<span class="card__icon card__icon--logo"><img src="' + logo + '" alt=""></span>'
      : '<span class="card__icon">' + svg(c.icon, 32, 1.8) + '</span>';
    var big = logo ? '' : '<span class="card__big" aria-hidden="true">' + svg(c.icon, 200, 1.1) + '</span>';
    return '<a class="card" href="' + esc(safeUrl(c.url)) + '" rel="noopener" style="--i:' + (i || 0) + '">' +
      '<span class="card__fill" aria-hidden="true"></span><span class="card__spot" aria-hidden="true"></span>' + big +
      '<span class="card__body">' + icon +
      '<span class="card__text"><span class="card__name">' + esc(c.name) + '</span>' +
      '<span class="card__purpose">' + esc(c.purpose) + '</span></span>' +
      '<span class="card__go"><span>الدخول إلى النظام</span><span class="card__arrow">' + ARROW + '</span></span>' +
      '</span><span class="card__glow" aria-hidden="true"></span></a>';
  }

  /* يتتبع المؤشر مرة واحدة على مستوى الصفحة ويحدّث البطاقات القريبة منه فقط (أجهزة الماوس فقط). */
  var glowBound = false;
  function bindGlow() {
    if (glowBound || !global.matchMedia || !global.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    glowBound = true;
    var doc = global.document, px = -9999, py = -9999, raf = 0, NEAR = 72;
    function update() {
      raf = 0;
      var cards = doc.querySelectorAll('.card');
      for (var i = 0; i < cards.length; i++) {
        var el = cards[i], r = el.getBoundingClientRect();
        var near = px > r.left - NEAR && px < r.right + NEAR && py > r.top - NEAR && py < r.bottom + NEAR;
        el.style.setProperty('--glow-on', near ? '1' : '0');
        if (!near) continue;
        var a = Math.atan2(py - (r.top + r.height / 2), px - (r.left + r.width / 2)) * 180 / Math.PI + 90;
        el.style.setProperty('--glow-angle', a.toFixed(1) + 'deg');
        el.style.setProperty('--mx', (px - r.left).toFixed(0) + 'px');
        el.style.setProperty('--my', (py - r.top).toFixed(0) + 'px');
      }
    }
    function queue() { if (!raf) raf = global.requestAnimationFrame(update); }
    doc.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; queue(); }, { passive: true });
    doc.addEventListener('mouseout', function (e) { if (!e.relatedTarget) { px = py = -9999; queue(); } });
    global.addEventListener('scroll', queue, { passive: true });
  }

  /** يرسم الصفحة داخل العنصر root (له الصنف portal). */
  function render(root, data, opts) {
    opts = opts || {};
    var page = (data && data.page) || {};
    var cards = (data && data.cards) || [];
    var pal = palette(page.color);
    var st = root.style;
    st.setProperty('--accent', pal.accent);
    st.setProperty('--accent-dark', pal.dark);
    st.setProperty('--accent-soft', pal.soft);
    st.setProperty('--accent-glow', pal.glow);
    st.setProperty('--on-fill-desc', pal.tint);
    st.setProperty('--accent-bright', pal.bright);
    st.setProperty('--dot', pal.dot);
    root.classList.toggle('portal--enter', !opts.preview);

    var c = cfg();
    var title = page.title || '';
    if (!opts.preview && global.document) {
      global.document.title = [title, c.ORG_NAME].filter(Boolean).join(' · ') || 'بوابة الأنظمة';
    }

    var html = '<div class="portal__glow"></div><div class="portal__dots"></div><div class="portal__inner">' +
      '<header class="portal__header">' + brandHtml(true) +
      '<div class="count-chip"><span class="count-chip__dot"></span><span>' + esc(countLabel(cards.length)) + '</span></div></header>' +
      '<section class="hero">' +
      (page.beneficiary ? '<div class="hero__tag">' + esc(page.beneficiary) + '</div>' : '') +
      '<h1 class="hero__title">' + esc(title) + '</h1>' +
      (page.description ? '<p class="hero__desc">' + esc(page.description) + '</p>' : '') +
      '</section>' +
      (cards.length
        ? '<section class="grid" aria-label="الأنظمة">' + cards.map(cardHtml).join('') + '</section>'
        : '<div class="empty">لا توجد أنظمة مضافة إلى هذه الصفحة بعد.</div>') +
      '</div>' +
      (c.FOOTER ? '<footer class="portal__footer">' + esc(c.FOOTER) + '</footer>' : '');
    root.innerHTML = html;
    bindGlow();

    if (opts.preview) {
      var links = root.querySelectorAll('a.card');
      for (var i = 0; i < links.length; i++) {
        links[i].addEventListener('click', function (e) { e.preventDefault(); });
      }
    }
  }

  function renderNotice(root, title, text) {
    var brand = brandHtml(true);
    root.style.removeProperty('--accent');
    root.innerHTML = '<div class="portal__inner">' + (brand ? '<header class="portal__header">' + brand + '</header>' : '') +
      '<div class="notice"><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p></div></div>';
  }

  function renderLoading(root) {
    var brand = brandHtml(false);
    root.innerHTML = '<div class="portal__inner">' + (brand ? '<header class="portal__header">' + brand + '</header>' : '') +
      '<section class="grid" aria-busy="true" style="margin-top:28px">' +
      '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></section></div>';
  }

  global.Portal = {
    ICONS: ICONS,
    ICON_KEYS: ICON_KEYS,
    svg: svg,
    esc: esc,
    palette: palette,
    ensureDark: ensureDark,
    contrastWithWhite: function (hex) { return contrastWithWhite(hexToRgb(hex)); },
    countLabel: countLabel,
    safeUrl: safeUrl,
    render: render,
    renderNotice: renderNotice,
    renderLoading: renderLoading
  };
})(window);

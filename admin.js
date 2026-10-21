(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = Portal.esc;
  var COLORS = ['#0f766e', '#4f46e5', '#7c3aed', '#c2410c', '#be185d', '#1d4ed8'];
  var MAX_CARDS = 12;
  var PIN_KEY = 'portalAdminPin';

  var pin = '';
  var pages = [];
  var cur = null;       // { isNew, page, cards }
  var dirty = false;
  var openIdx = 0;
  var previewMode = 'desktop';
  var frameReady = false;

  /* ───── أدوات ───── */
  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' toast--err' : '');
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, err ? 5000 : 2600);
  }
  function getPin() { try { return sessionStorage.getItem(PIN_KEY) || ''; } catch (e) { return ''; } }
  function setPin(v) { try { if (v) sessionStorage.setItem(PIN_KEY, v); else sessionStorage.removeItem(PIN_KEY); } catch (e) {} }
  function blankCard() { return { name: '', purpose: '', url: '', icon: 'link', logo: '' }; }
  function shareUrl(slug) {
    var base = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '');
    return base + '?p=' + slug;
  }
  function setDirty(v) { dirty = v; $('dirty').hidden = !v; }
  function confirmLeave() { return !dirty || confirm('توجد تغييرات غير محفوظة. هل تريد المتابعة وتجاهلها؟'); }

  /* ───── الدخول ───── */
  function showLogin(msg) {
    $('shell').hidden = true; $('login').hidden = false;
    $('loginErr').textContent = msg || '';
    $('pin').value = ''; $('pin').focus();
  }
  function enter() {
    $('login').hidden = true; $('shell').hidden = false;
    $('localBanner').hidden = Api.remote;
    refreshList();
  }
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('pin').value.trim();
    if (!v) return;
    Api.auth(v).then(function (r) {
      if (r.ok) { pin = v; setPin(v); enter(); }
      else $('loginErr').textContent = Api.errorText(r.error);
    });
  });
  $('logout').addEventListener('click', function () {
    if (!confirmLeave()) return;
    setPin(''); pin = ''; cur = null; setDirty(false); showLogin();
  });

  /* ───── القائمة ───── */
  function refreshList(selectSlug) {
    return Api.list(pin).then(function (r) {
      if (!r.ok) {
        if (r.error === 'bad_pin') { setPin(''); showLogin('انتهت الجلسة. أدخل الرمز مجددًا.'); return; }
        toast(Api.errorText(r.error), true); return;
      }
      pages = r.pages || [];
      renderList(selectSlug || (cur && !cur.isNew ? cur.page.slug : ''));
    });
  }
  function renderList(active) {
    $('pageList').innerHTML = pages.length ? pages.map(function (p) {
      return '<button type="button" class="pitem' + (p.slug === active ? ' on' : '') + '" data-slug="' + esc(p.slug) + '">' +
        '<b><i style="background:' + esc(p.color) + '"></i>' + esc(p.title) + '</b>' +
        '<span>' + esc(p.beneficiary || '—') + ' · ' + p.cardCount + ' بطاقة</span></button>';
    }).join('') : '<small>لا توجد صفحات بعد.</small>';
  }
  $('pageList').addEventListener('click', function (e) {
    var b = e.target.closest('.pitem');
    if (!b || !confirmLeave()) return;
    Api.get(pin, b.getAttribute('data-slug')).then(function (r) {
      if (!r.ok) return toast(Api.errorText(r.error), true);
      load({ isNew: false, page: r.page, cards: r.cards });
    });
  });
  $('newPage').addEventListener('click', function () {
    if (!confirmLeave()) return;
    var cards = []; for (var i = 0; i < 3; i++) cards.push(blankCard());
    load({ isNew: true, page: { slug: '', title: '', beneficiary: '', description: '', color: COLORS[0] }, cards: cards });
  });

  /* ───── المحرر ───── */
  function load(state) {
    cur = state; openIdx = 0; setDirty(false);
    $('emptyMain').hidden = true; $('editor').hidden = false; $('previewCol').hidden = false;
    var p = cur.page;
    $('fTitle').value = p.title; $('fBen').value = p.beneficiary || ''; $('fDesc').value = p.description || '';
    $('fSlug').value = p.slug; $('fSlug').readOnly = !cur.isNew;
    $('slugHint').textContent = cur.isNew ? 'أحرف إنجليزية صغيرة وأرقام وشرطة. لا يمكن تغييره بعد الحفظ.' : 'لا يمكن تغيير الرابط بعد الحفظ.';
    $('dupBtn').hidden = $('delBtn').hidden = cur.isNew;
    renderSwatches(); renderCards(); renderShare(); renderList(cur.isNew ? '' : p.slug);
    schedulePreview(); fitPreview();
  }

  function renderSwatches() {
    var c = cur.page.color.toLowerCase();
    $('swatches').innerHTML = COLORS.map(function (h) {
      return '<button type="button" class="sw' + (h === c ? ' on' : '') + '" data-c="' + h + '" style="background:' + h + '" aria-label="لون ' + h + '"></button>';
    }).join('');
    $('fColor').value = /^#[0-9a-f]{6}$/i.test(cur.page.color) ? cur.page.color : COLORS[0];
  }
  $('swatches').addEventListener('click', function (e) {
    var b = e.target.closest('.sw'); if (!b) return;
    cur.page.color = b.getAttribute('data-c'); renderSwatches(); changed();
  });
  $('fColor').addEventListener('input', function () {
    cur.page.color = Portal.ensureDark($('fColor').value);
    renderSwatches(); changed();
  });

  $('fTitle').addEventListener('input', function () {
    cur.page.title = this.value;
    if (cur.isNew && !$('fSlug').dataset.touched) {
      var s = this.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      $('fSlug').value = s; cur.page.slug = s;
    }
    changed();
  });
  $('fBen').addEventListener('input', function () { cur.page.beneficiary = this.value; changed(); });
  $('fDesc').addEventListener('input', function () { cur.page.description = this.value; changed(); });
  $('fSlug').addEventListener('input', function () {
    this.dataset.touched = '1';
    this.value = this.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    cur.page.slug = this.value; changed();
  });

  function setCount(n) {
    n = Math.max(1, Math.min(MAX_CARDS, n));
    if (n < cur.cards.length) {
      var lost = cur.cards.slice(n).some(function (c) { return c.name || c.url; });
      if (lost && !confirm('سيتم حذف البطاقات الأخيرة. متابعة؟')) return;
      cur.cards.length = n;
    }
    while (cur.cards.length < n) cur.cards.push(blankCard());
    if (openIdx >= n) openIdx = n - 1;
    renderCards(); changed();
  }
  $('cntMinus').addEventListener('click', function () { setCount(cur.cards.length - 1); });
  $('cntPlus').addEventListener('click', function () { setCount(cur.cards.length + 1); });

  function renderCards() {
    $('cntOut').textContent = cur.cards.length;
    $('cardsEditor').innerHTML = cur.cards.map(function (c, i) {
      var open = i === openIdx;
      var icons = Portal.ICON_KEYS.map(function (k) {
        return '<button type="button" class="ic' + (k === c.icon ? ' on' : '') + '" data-act="icon" data-k="' + k + '" title="' + esc(Portal.ICONS[k][0]) + '" aria-label="' + esc(Portal.ICONS[k][0]) + '">' + Portal.svg(k, 22) + '</button>';
      }).join('');
      return '<div class="item' + (open ? ' open' : '') + '" data-i="' + i + '">' +
        '<button type="button" class="item__head" data-act="toggle"><span class="item__num">' + (i + 1) + '</span>' +
        '<span class="item__title">' + esc(c.name || 'بطاقة جديدة') + '</span><span class="item__chev">▾</span></button>' +
        '<div class="item__body">' +
        '<div class="field"><label>اسم المنصة</label><input data-f="name" maxlength="60" value="' + esc(c.name) + '"></div>' +
        '<div class="field"><label>الهدف منها</label><input data-f="purpose" maxlength="160" value="' + esc(c.purpose) + '"></div>' +
        '<div class="field"><label>رابط صفحة الدخول</label><input data-f="url" dir="ltr" placeholder="https://" value="' + esc(c.url) + '"></div>' +
        '<div class="field"><label>الأيقونة</label><div class="icons">' + icons + '</div></div>' +
        '<div class="field"><label>شعار المنصة (اختياري، يحل محل الأيقونة)</label>' +
        '<input type="file" data-act="logo" accept="image/png,image/jpeg,image/webp">' +
        (c.logo ? '<div class="logo-row"><img src="' + esc(c.logo) + '" alt=""><button type="button" class="btn btn--sm" data-act="rmlogo">إزالة الشعار</button></div>' : '') + '</div>' +
        '<div class="item__tools"><button type="button" class="btn btn--sm" data-act="up">↑ أعلى</button><button type="button" class="btn btn--sm" data-act="down">↓ أسفل</button>' +
        '<button type="button" class="btn btn--sm btn--danger" data-act="remove">حذف البطاقة</button></div>' +
        '</div></div>';
    }).join('');
  }

  $('cardsEditor').addEventListener('input', function (e) {
    var f = e.target.getAttribute('data-f'); if (!f) return;
    var i = +e.target.closest('.item').getAttribute('data-i');
    cur.cards[i][f] = e.target.value;
    if (f === 'name') e.target.closest('.item').querySelector('.item__title').textContent = e.target.value || 'بطاقة جديدة';
    changed();
  });
  $('cardsEditor').addEventListener('change', function (e) {
    if (e.target.getAttribute('data-act') !== 'logo') return;
    var i = +e.target.closest('.item').getAttribute('data-i');
    var file = e.target.files && e.target.files[0];
    if (file) resizeLogo(file).then(function (data) {
      if (!data) return toast('الشعار كبير جدًا أو غير صالح. جرّب صورة أبسط.', true);
      cur.cards[i].logo = data; renderCards(); changed();
    });
  });
  $('cardsEditor').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var item = b.closest('.item'); var i = +item.getAttribute('data-i');
    var act = b.getAttribute('data-act');
    if (act === 'toggle') { openIdx = openIdx === i ? -1 : i; renderCards(); return; }
    if (act === 'icon') { cur.cards[i].icon = b.getAttribute('data-k'); renderCards(); changed(); }
    else if (act === 'rmlogo') { cur.cards[i].logo = ''; renderCards(); changed(); }
    else if (act === 'up' && i > 0) { swap(i, i - 1); }
    else if (act === 'down' && i < cur.cards.length - 1) { swap(i, i + 1); }
    else if (act === 'remove') {
      if (cur.cards.length <= 1) return toast('يجب أن تحتوي الصفحة على بطاقة واحدة على الأقل.', true);
      cur.cards.splice(i, 1); openIdx = Math.min(openIdx, cur.cards.length - 1); renderCards(); changed();
    }
  });
  function swap(a, b) { var t = cur.cards[a]; cur.cards[a] = cur.cards[b]; cur.cards[b] = t; openIdx = b; renderCards(); changed(); }

  function resizeLogo(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var size = 160;
        var out = null;
        while (size >= 64) {
          var s = Math.min(1, size / Math.max(img.width, img.height));
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          var d = cv.toDataURL('image/webp', 0.85);
          if (d.indexOf('data:image/webp') !== 0) d = cv.toDataURL('image/png');
          if (d.length <= 40000) { out = d; break; }
          size -= 32;
        }
        URL.revokeObjectURL(url); resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  /* ───── الرابط والـQR ───── */
  function renderShare() {
    var saved = cur && !cur.isNew;
    $('copyBtn').disabled = !saved;
    $('openBtn').style.pointerEvents = saved ? '' : 'none';
    $('openBtn').style.opacity = saved ? '' : '.55';
    $('qr').innerHTML = '';
    if (!saved) {
      $('shareUrl').value = ''; $('openBtn').removeAttribute('href');
      $('shareNote').textContent = 'يظهر الرابط بعد حفظ الصفحة.'; return;
    }
    var u = shareUrl(cur.page.slug);
    $('shareUrl').value = u; $('openBtn').href = u;
    $('shareNote').textContent = 'أرسل هذا الرابط الواحد للمستفيد. يفتح الصفحة مباشرة دون أي رمز.';
    try {
      var q = qrcode(0, 'M'); q.addData(u); q.make();
      $('qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) {}
  }
  $('copyBtn').addEventListener('click', function () {
    var u = $('shareUrl').value;
    var done = function () { toast('تم نسخ الرابط'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { $('shareUrl').select(); document.execCommand('copy'); done(); });
    else { $('shareUrl').select(); document.execCommand('copy'); done(); }
  });

  /* ───── المعاينة ───── */
  var pt = 0;
  function changed() { setDirty(true); schedulePreview(); }
  function schedulePreview() { clearTimeout(pt); pt = setTimeout(sendPreview, 120); }
  function sendPreview() {
    if (!cur || !frameReady) return;
    var w = $('frame').contentWindow;
    var data = {
      page: { title: cur.page.title || 'عنوان الصفحة', beneficiary: cur.page.beneficiary, description: cur.page.description, color: cur.page.color },
      cards: cur.cards.map(function (c) {
        return { name: c.name || 'اسم المنصة', purpose: c.purpose, url: '#', icon: c.icon, logo: c.logo };
      })
    };
    w.postMessage({ type: 'portal-preview', data: data }, location.origin);
  }
  window.addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.type === 'portal-preview-ready') { frameReady = true; sendPreview(); }
  });
  function fitPreview() {
    var stage = $('stage'); var wrap = $('frameWrap');
    var W = previewMode === 'mobile' ? 390 : 1200, H = previewMode === 'mobile' ? 760 : 820;
    var s = Math.min(stage.clientWidth / W, stage.clientHeight / H, 1);
    if (!isFinite(s) || s <= 0) s = 0.4;
    wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
    wrap.style.transform = 'scale(' + s + ')';
    stage.style.height = ''; wrap.style.marginBottom = (-(H * (1 - s))) + 'px';
  }
  document.querySelector('.seg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    previewMode = b.getAttribute('data-mode');
    [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
    fitPreview();
  });
  window.addEventListener('resize', fitPreview);

  /* ───── حفظ / نسخ / حذف ───── */
  function clean() {
    return {
      page: { slug: cur.page.slug.trim(), title: cur.page.title.trim(), beneficiary: (cur.page.beneficiary || '').trim(), description: (cur.page.description || '').trim(), color: cur.page.color },
      cards: cur.cards.map(function (c) { return { name: c.name.trim(), purpose: (c.purpose || '').trim(), url: c.url.trim(), icon: c.icon || 'link', logo: c.logo || '' }; })
    };
  }
  $('saveBtn').addEventListener('click', function () {
    var d = clean();
    var err = Api.validate(d.page, d.cards);
    if (err) {
      toast(Api.errorText(err), true);
      var m = /^invalid:card(\d+)/.exec(err);
      if (m) { openIdx = +m[1]; renderCards(); }
      return;
    }
    var btn = this; btn.disabled = true;
    Api.save(pin, cur.isNew, d.page, d.cards).then(function (r) {
      btn.disabled = false;
      if (!r.ok) {
        if (r.error === 'bad_pin') { showLogin('انتهت الجلسة. أدخل الرمز مجددًا.'); return; }
        return toast(Api.errorText(r.error), true);
      }
      toast('تم حفظ الصفحة');
      cur = { isNew: false, page: r.page, cards: r.cards }; setDirty(false);
      $('fSlug').readOnly = true; $('dupBtn').hidden = $('delBtn').hidden = false;
      renderShare(); refreshList(cur.page.slug);
    });
  });
  $('dupBtn').addEventListener('click', function () {
    if (!confirmLeave()) return;
    var ns = prompt('الرابط المختصر للنسخة (أحرف إنجليزية صغيرة وأرقام وشرطة):', cur.page.slug + '-2');
    if (!ns) return;
    Api.duplicate(pin, cur.page.slug, ns.trim().toLowerCase()).then(function (r) {
      if (!r.ok) return toast(Api.errorText(r.error), true);
      toast('تم إنشاء النسخة'); load({ isNew: false, page: r.page, cards: r.cards }); refreshList(r.page.slug);
    });
  });
  $('delBtn').addEventListener('click', function () {
    if (!confirm('سيتم حذف الصفحة "' + cur.page.title + '" ويتوقف رابطها عن العمل. متابعة؟')) return;
    Api.remove(pin, cur.page.slug).then(function (r) {
      if (!r.ok) return toast(Api.errorText(r.error), true);
      toast('تم حذف الصفحة'); cur = null; setDirty(false);
      $('editor').hidden = true; $('previewCol').hidden = true; $('emptyMain').hidden = false; refreshList('');
    });
  });

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ───── البداية ───── */
  pin = getPin();
  if (pin) {
    Api.auth(pin).then(function (r) { if (r.ok) enter(); else { setPin(''); showLogin(); } });
  } else if (!Api.remote) {
    // الوضع التجريبي لا يحتاج رمزًا
    pin = 'local'; enter();
  } else showLogin();
})();

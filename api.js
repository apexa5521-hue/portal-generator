/* طبقة الاتصال: تتحدث مع Apps Script عندما يوجد API_URL، وإلا تعمل بوضع تجريبي يحفظ في المتصفح فقط. */
(function (global) {
  'use strict';

  var cfg = global.PORTAL_CONFIG || {};
  var remote = !!cfg.API_URL;
  var LS_KEY = 'portalGenerator.v1';
  var MAX_CARDS = 12;
  var ICON_KEYS = (global.Portal && global.Portal.ICON_KEYS) || [];

  var SAMPLE = {
    page: {
      slug: 'demo',
      title: 'أنظمة الموارد البشرية',
      beneficiary: 'للموارد البشرية',
      description: 'اختر النظام الذي تحتاجه، وسيفتح لك مباشرة صفحة تسجيل الدخول الخاصة به.',
      color: '#0f766e'
    },
    cards: [
      { name: 'جاهزية الكوادر', purpose: 'متابعة اكتمال مستندات الموظفين وتراخيصهم.', url: '#', icon: 'check' },
      { name: 'توقيع السياسات', purpose: 'اطلاع الموظفين على السياسات وتوقيعها إلكترونيًا.', url: '#', icon: 'sign' },
      { name: 'استبيان راحة الموظفين', purpose: 'قياس رضا الكوادر وجمع ملاحظاتهم.', url: '#', icon: 'smile' },
      { name: 'منصة التدريب', purpose: 'الدورات والاختبارات التدريبية ونتائجها.', url: '#', icon: 'cap' }
    ]
  };

  var MESSAGES = {
    bad_pin: 'رمز الدخول غير صحيح.',
    locked: 'تم إيقاف المحاولات مؤقتًا بسبب كثرة الأخطاء. حاول بعد عشر دقائق.',
    not_found: 'الصفحة غير موجودة.',
    exists: 'هذا الرابط المختصر مستخدم من قبل. اختر رابطًا آخر.',
    busy: 'النظام مشغول حاليًا. أعد المحاولة بعد لحظات.',
    bad_request: 'تعذر فهم الطلب.',
    server: 'حدث خطأ في الخادم. أعد المحاولة.',
    network: 'تعذر الاتصال بالخادم. تحقق من الإنترنت ومن رابط Apps Script في config.js.',
    'invalid:slug': 'الرابط المختصر يقبل أحرفًا إنجليزية صغيرة وأرقامًا وشرطة فقط (من حرفين إلى 40).',
    'invalid:title': 'اكتب عنوان الصفحة (حتى 80 حرفًا).',
    'invalid:beneficiary': 'نص الجهة المستفيدة طويل (الحد 60 حرفًا).',
    'invalid:description': 'الوصف طويل (الحد 240 حرفًا).',
    'invalid:color': 'اللون غير صالح.',
    'invalid:cards': 'عدد البطاقات يجب أن يكون من 1 إلى ' + MAX_CARDS + '.'
  };

  function errorText(code) {
    if (MESSAGES[code]) return MESSAGES[code];
    var m = /^invalid:card(\d+):(\w+)$/.exec(code || '');
    if (m) {
      var n = Number(m[1]) + 1;
      var f = { name: 'اسم المنصة', purpose: 'الهدف', url: 'الرابط (يبدأ بـ https://)', icon: 'الأيقونة', logo: 'الشعار' }[m[2]] || m[2];
      return 'البطاقة ' + n + ': تحقق من ' + f + '.';
    }
    return MESSAGES.server;
  }

  /* التحقق نفسه الذي يجريه الخادم، ليظهر الخطأ قبل الإرسال */
  function validate(page, cards) {
    if (!page || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(String(page.slug || ''))) return 'invalid:slug';
    if (!String(page.title || '').trim() || String(page.title).length > 80) return 'invalid:title';
    if (String(page.beneficiary || '').length > 60) return 'invalid:beneficiary';
    if (String(page.description || '').length > 240) return 'invalid:description';
    if (!/^#[0-9a-fA-F]{6}$/.test(String(page.color || ''))) return 'invalid:color';
    if (!Array.isArray(cards) || cards.length < 1 || cards.length > MAX_CARDS) return 'invalid:cards';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i] || {};
      if (!String(c.name || '').trim() || String(c.name).length > 60) return 'invalid:card' + i + ':name';
      if (String(c.purpose || '').length > 160) return 'invalid:card' + i + ':purpose';
      if (!/^https?:\/\/\S+$/i.test(String(c.url || '')) || String(c.url).length > 600) return 'invalid:card' + i + ':url';
      if (ICON_KEYS.length && ICON_KEYS.indexOf(String(c.icon || 'link')) < 0) return 'invalid:card' + i + ':icon';
      if (c.logo && (!/^data:image\/(png|webp|jpeg|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(String(c.logo)) || String(c.logo).length > 40000)) {
        return 'invalid:card' + i + ':logo';
      }
    }
    return null;
  }

  /* ───── الوضع التجريبي (المتصفح) ───── */
  function lsRead() {
    try { return JSON.parse(global.localStorage.getItem(LS_KEY)) || { pages: {} }; } catch (e) { return { pages: {} }; }
  }
  function lsWrite(d) { global.localStorage.setItem(LS_KEY, JSON.stringify(d)); }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function localCall(body) {
    var db = lsRead();
    var a = body.action;
    if (a === 'auth') return { ok: true };
    if (a === 'page') {
      var p = db.pages[body.slug];
      return p ? { ok: true, page: clone(p.page), cards: clone(p.cards) } : { ok: false, error: 'not_found' };
    }
    if (a === 'list') {
      return {
        ok: true,
        pages: Object.keys(db.pages).map(function (k) {
          var x = clone(db.pages[k].page);
          x.cardCount = db.pages[k].cards.length;
          return x;
        })
      };
    }
    if (a === 'get') {
      var g = db.pages[body.slug];
      return g ? { ok: true, page: clone(g.page), cards: clone(g.cards) } : { ok: false, error: 'not_found' };
    }
    if (a === 'save') {
      var err = validate(body.page, body.cards);
      if (err) return { ok: false, error: err };
      var has = !!db.pages[body.page.slug];
      if (body.isNew && has) return { ok: false, error: 'exists' };
      if (!body.isNew && !has) return { ok: false, error: 'not_found' };
      db.pages[body.page.slug] = { page: clone(body.page), cards: clone(body.cards) };
      lsWrite(db);
      return { ok: true, page: clone(body.page), cards: clone(body.cards) };
    }
    if (a === 'delete') {
      if (!db.pages[body.slug]) return { ok: false, error: 'not_found' };
      delete db.pages[body.slug];
      lsWrite(db);
      return { ok: true };
    }
    if (a === 'duplicate') {
      var src = db.pages[body.slug];
      if (!src) return { ok: false, error: 'not_found' };
      if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(String(body.newSlug || ''))) return { ok: false, error: 'invalid:slug' };
      if (db.pages[body.newSlug]) return { ok: false, error: 'exists' };
      var copy = clone(src);
      copy.page.slug = body.newSlug;
      copy.page.title = (copy.page.title + ' (نسخة)').slice(0, 80);
      db.pages[body.newSlug] = copy;
      lsWrite(db);
      return { ok: true, page: clone(copy.page), cards: clone(copy.cards) };
    }
    return { ok: false, error: 'bad_request' };
  }

  /* ───── الخادم (Apps Script) ───── */
  function remotePost(body) {
    return global.fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (r) { return r.json(); });
  }

  function call(body) {
    if (!remote) return Promise.resolve(localCall(body));
    return remotePost(body).catch(function () { return { ok: false, error: 'network' }; });
  }

  /* قراءة عامة لصفحة منشورة (للمستفيد) */
  function getPublic(slug) {
    if (slug === 'demo' && !remote && !lsRead().pages.demo) return Promise.resolve({ ok: true, page: clone(SAMPLE.page), cards: clone(SAMPLE.cards) });
    if (!remote) return Promise.resolve(localCall({ action: 'page', slug: slug }));
    return global.fetch(cfg.API_URL + '?action=page&slug=' + encodeURIComponent(slug))
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: 'network' }; });
  }

  global.Api = {
    remote: remote,
    sample: function () { return clone(SAMPLE); },
    validate: validate,
    errorText: errorText,
    getPublic: getPublic,
    auth: function (pin) { return call({ action: 'auth', pin: pin }); },
    list: function (pin) { return call({ action: 'list', pin: pin }); },
    get: function (pin, slug) { return call({ action: 'get', pin: pin, slug: slug }); },
    save: function (pin, isNew, page, cards) { return call({ action: 'save', pin: pin, isNew: !!isNew, page: page, cards: cards }); },
    remove: function (pin, slug) { return call({ action: 'delete', pin: pin, slug: slug }); },
    duplicate: function (pin, slug, newSlug) { return call({ action: 'duplicate', pin: pin, slug: slug, newSlug: newSlug }); }
  };
})(window);

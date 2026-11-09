/* الدخول الموحد في صفحة البوابة: دخول الموظف مرة واحدة، ثم فتح المنصات المربوطة بحسابه بدون كلمة مرور.
   البطاقات غير المربوطة (أو قبل الدخول) تعمل كما كانت: تفتح صفحة الدخول العادية للمنصة. */
(function (global) {
  'use strict';

  var cfg = global.PORTAL_CONFIG || {};
  var KEY = 'portal.emp.v1';
  var doc = global.document;
  var state = { token: '', employee: null, apps: [] };
  var root = null;
  var ready = false;   // يظهر زر الدخول فقط بعد التأكد أن الخادم يدعم الدخول الموحد

  var MESSAGES = {
    bad_login: 'البريد أو كلمة المرور غير صحيحة.',
    locked: 'تم إيقاف المحاولات مؤقتًا بسبب كثرة الأخطاء. حاول بعد عشر دقائق.',
    emp_session: 'انتهت الجلسة. سجّل الدخول مرة أخرى.',
    must_change: 'غيّر كلمة المرور المؤقتة أولًا.',
    bad_old_password: 'كلمة المرور الحالية غير صحيحة.',
    weak_password: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.',
    same_password: 'اختر كلمة مرور مختلفة عن الحالية.',
    mismatch: 'كلمتا المرور غير متطابقتين.',
    not_linked: 'حسابك غير مربوط بهذه المنصة بعد. ستفتح صفحة الدخول العادية.',
    network: 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.',
    server: 'حدث خطأ في الخادم. أعد المحاولة.'
  };
  function msg(code) { return MESSAGES[code] || MESSAGES.server; }

  /* ───── التخزين: الجلسة مشتركة بين كل صفحات البوابة على نفس المتصفح ───── */
  function save() {
    try {
      if (state.token) global.localStorage.setItem(KEY, JSON.stringify({ token: state.token, at: Date.now() }));
      else global.localStorage.removeItem(KEY);
    } catch (e) { /* التخزين غير متاح: الجلسة لهذه الصفحة فقط */ }
  }
  function loadToken() {
    try {
      var v = JSON.parse(global.localStorage.getItem(KEY) || 'null');
      return v && v.token && Date.now() - v.at < 6 * 3600 * 1000 ? v.token : '';
    } catch (e) { return ''; }
  }

  function post(body) {
    if (!cfg.API_URL) return Promise.resolve({ ok: false, error: 'server' });
    return global.fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: 'network' }; });
  }

  function esc(s) { return global.Portal ? global.Portal.esc(s) : String(s); }

  /* ───── ربط البطاقات بالمنصات: رابط البطاقة يبدأ برابط المنصة المسجّل ───── */
  function norm(u) { return String(u || '').trim().replace(/[?#].*$/, '').replace(/\/(index\.html?)?$/i, '').toLowerCase(); }
  function appFor(url) {
    var u = norm(url), best = null;
    state.apps.forEach(function (a) {
      var p = norm(a.url);
      if (p && (u === p || u.indexOf(p + '/') === 0) && (!best || p.length > norm(best.url).length)) best = a;
    });
    return best;
  }

  function decorate() {
    if (!root) return;
    var links = root.querySelectorAll('a.card, a.card__main');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var card = a.classList.contains('card') ? a : a.closest('.card');
      var app = state.employee && !state.employee.mustChange ? appFor(a.getAttribute('href')) : null;
      if (app) a.setAttribute('data-sso', app.id); else a.removeAttribute('data-sso');
      if (card) card.classList.toggle('card--sso', !!app);
      var badge = card && card.querySelector('.card__sso');
      var name = card && card.querySelector('.card__name');
      if (app && name && !badge) {
        badge = doc.createElement('span');
        badge.className = 'card__sso';
        badge.textContent = 'دخول مباشر';
        name.insertAdjacentElement('afterend', badge);
      } else if (!app && badge) {
        badge.remove();
      }
    }
    renderBar();
  }

  /* ───── شريط الموظف في رأس الصفحة ───── */
  function renderBar() {
    var header = root && root.querySelector('.portal__header');
    if (!header || !ready) return;
    var bar = header.querySelector('.emp-bar');
    if (!bar) {
      bar = doc.createElement('div');
      bar.className = 'emp-bar';
      header.appendChild(bar);
    }
    if (state.employee) {
      var n = root.querySelectorAll('.card--sso').length;
      bar.innerHTML = '<span class="emp-bar__who" title="' + esc(state.employee.email) + '">' +
        '<span class="emp-bar__dot" aria-hidden="true"></span>' + esc(state.employee.name) +
        (n ? '<span class="emp-bar__n"> · ' + esc(new Intl.NumberFormat('ar-SA').format(n)) + ' بدخول مباشر</span>' : '') +
        '</span><button type="button" class="emp-btn emp-btn--ghost" data-emp="logout">خروج</button>';
    } else {
      bar.innerHTML = '<button type="button" class="emp-btn" data-emp="login">دخول الموظفين</button>';
    }
  }

  /* ───── النوافذ ───── */
  var dialog = null;
  function openDialog(html) {
    if (!dialog) {
      dialog = doc.createElement('dialog');
      dialog.className = 'emp-dialog';
      dialog.setAttribute('aria-labelledby', 'empTitle');
      doc.body.appendChild(dialog);
      dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    }
    /* ألوان الصفحة مضبوطة على عنصر الصفحة، والنافذة خارجه: انسخها لها */
    ['--accent', '--accent-dark', '--accent-soft', '--accent-glow'].forEach(function (v) {
      var c = root && root.style.getPropertyValue(v);
      if (c) dialog.style.setProperty(v, c);
    });
    dialog.innerHTML = html;
    if (!dialog.open) dialog.showModal();
    var first = dialog.querySelector('input');
    if (first) first.focus();
  }
  function closeDialog() { if (dialog && dialog.open) dialog.close(); }
  function showError(form, text) {
    var el = form.querySelector('.emp-err');
    el.textContent = text;
    el.hidden = !text;
  }
  function busy(form, on) {
    var b = form.querySelector('button[type=submit]');
    b.disabled = on;
    b.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function loginDialog(note) {
    openDialog('<form method="dialog" class="emp-form" id="empLogin" novalidate>' +
      '<h2 id="empTitle">دخول الموظفين</h2>' +
      '<p class="emp-lead">ادخل مرة واحدة، وتفتح لك المنصات المربوطة بحسابك مباشرة بدون كلمة مرور.</p>' +
      '<div class="emp-err" role="alert"' + (note ? '' : ' hidden') + '>' + esc(note || '') + '</div>' +
      '<label>البريد الإلكتروني<input type="email" name="email" dir="ltr" autocomplete="username" required></label>' +
      '<label>كلمة مرور البوابة<input type="password" name="password" dir="ltr" autocomplete="current-password" required></label>' +
      '<button type="submit" class="emp-btn emp-btn--block">دخول</button>' +
      '<button type="button" class="emp-link" data-emp="close">إلغاء</button></form>');
  }

  function changeDialog() {
    openDialog('<form method="dialog" class="emp-form" id="empChange" novalidate>' +
      '<h2 id="empTitle">اختر كلمة مرور جديدة</h2>' +
      '<p class="emp-lead">هذا أول دخول لك بكلمة مرور مؤقتة. اختر كلمة مرور خاصة بك للمتابعة.</p>' +
      '<div class="emp-err" role="alert" hidden></div>' +
      '<label>كلمة المرور المؤقتة<input type="password" name="old" dir="ltr" autocomplete="current-password" required></label>' +
      '<label>كلمة المرور الجديدة<input type="password" name="new1" dir="ltr" autocomplete="new-password" minlength="8" required></label>' +
      '<label>تأكيد كلمة المرور الجديدة<input type="password" name="new2" dir="ltr" autocomplete="new-password" minlength="8" required></label>' +
      '<button type="submit" class="emp-btn emp-btn--block">حفظ ومتابعة</button></form>');
  }

  function accept(res) {
    state.employee = res.employee;
    state.apps = res.apps || [];
    if (res.token) state.token = res.token;
    save();
    decorate();
  }

  function signOut(note) {
    if (state.token) post({ action: 'empLogout', token: state.token });
    state = { token: '', employee: null, apps: [] };
    save();
    decorate();
    if (note) loginDialog(note);
  }

  doc.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.id !== 'empLogin' && form.id !== 'empChange') return;
    e.preventDefault();
    var f = form.elements;
    var req;
    if (form.id === 'empLogin') {
      req = { action: 'empLogin', email: f.email.value.trim(), password: f.password.value };
      if (!req.email || !req.password) return showError(form, 'اكتب البريد وكلمة المرور.');
    } else {
      if (f.new1.value !== f.new2.value) return showError(form, msg('mismatch'));
      req = { action: 'empChangePassword', token: state.token, oldPassword: f.old.value, newPassword: f.new1.value };
    }
    showError(form, '');
    busy(form, true);
    post(req).then(function (res) {
      busy(form, false);
      if (!res || !res.ok) {
        if (res && res.error === 'emp_session') return signOut(msg('emp_session'));
        return showError(form, msg(res && res.error));
      }
      accept(res);
      if (res.employee.mustChange) return changeDialog();
      closeDialog();
    });
  });

  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-emp]');
    if (b) {
      var what = b.getAttribute('data-emp');
      if (what === 'login') loginDialog();
      else if (what === 'logout') signOut();
      else if (what === 'close') closeDialog();
      return;
    }
    var a = e.target.closest && e.target.closest('a[data-sso]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openWithTicket(a);
  });

  /* يطلب تذكرة دخول ويفتح المنصة. عند أي مشكلة يفتح رابط البطاقة العادي حتى لا يتعطل الموظف. */
  function openWithTicket(a) {
    var card = a.classList.contains('card') ? a : a.closest('.card');
    if (card) card.classList.add('card--opening');
    var href = a.getAttribute('href');
    post({ action: 'empTicket', token: state.token, app: a.getAttribute('data-sso') }).then(function (res) {
      if (res && res.ok && /^https:\/\//i.test(res.url)) {
        global.location.assign(res.url);
        return;
      }
      if (card) card.classList.remove('card--opening');
      if (res && (res.error === 'emp_session' || res.error === 'must_change')) {
        signOut(msg(res.error));
        return;
      }
      global.location.assign(href);
    });
  }

  /* يرجع المستخدم بزر الرجوع: أزل حالة «جارٍ الفتح» من البطاقة */
  global.addEventListener('pageshow', function () {
    var els = doc.querySelectorAll('.card--opening');
    for (var i = 0; i < els.length; i++) els[i].classList.remove('card--opening');
  });

  /** يُستدعى بعد رسم الصفحة. */
  function attach(el) {
    root = el;
    if (!cfg.API_URL) return;   // الوضع التجريبي بدون خادم: لا دخول موحد
    if (ready) { decorate(); return; }
    /* فحص بطلب GET لا يلمس عدّاد رمز الأدمن: الخادم القديم (قبل تحديث Code.gs) لا يرد sso فيبقى الزر مخفيًا */
    global.fetch(cfg.API_URL + '?action=sso')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || res.sso !== true) return;
        ready = true;
        decorate();
        var token = state.token || loadToken();
        if (!token) return;
        post({ action: 'empMe', token: token }).then(function (me) {
          if (me && me.ok) { state.token = token; accept(me); }
          else if (me && me.error === 'must_change') { state.token = token; state.employee = { mustChange: true, name: '', email: '' }; changeDialog(); }
          else if (me && me.error === 'emp_session') { state.token = ''; save(); }
        });
      })
      .catch(function () { /* بدون اتصال: تبقى الصفحة كما كانت */ });
  }

  global.Sso = { attach: attach };
})(window);

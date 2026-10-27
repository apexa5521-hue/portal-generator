/**
 * مولّد صفحات الهبوط — أبكس كير
 * ------------------------------------------------------------
 * يُلصق هذا الملف في Apps Script المفتوح من قائمة Extensions في الـ Google Sheet.
 *  1) شغّل الدالة setup مرة واحدة (تنشئ الجدولين وتولّد رمز الدخول).
 *  2) انشر المشروع: Deploy > New deployment > Web app
 *     Execute as: Me  |  Who has access: Anyone
 *  3) انسخ رابط الـ Web app (ينتهي بـ /exec) وضعه في config.js.
 */

var SHEET_PAGES = 'Pages';
var SHEET_CARDS = 'Cards';
var SHEET_LOG = 'Log';
var PAGE_COLS = ['slug', 'title', 'beneficiary', 'description', 'color', 'status', 'createdAt', 'updatedAt'];
var CARD_COLS = ['slug', 'order', 'name', 'purpose', 'url', 'icon', 'logo', 'links'];
var MAX_CARDS = 12;
var MAX_LINKS = 6;
var LOG_COLS = ['time', 'slug', 'by', 'action', 'summary', 'snapshot'];
var MAX_SNAPSHOT_CHARS = 49000;
var MAX_LOGO_CHARS = 40000;
var ICONS = [
  'check', 'sign', 'smile', 'cap', 'users', 'shield', 'file', 'calendar', 'chart',
  'clipboard', 'phone', 'box', 'dashboard', 'bell', 'message', 'wrench', 'building', 'link'
];
var CACHE_SECONDS = 60;
var MAX_FAILS = 5;
var LOCK_SECONDS = 600;

/* ───────────────────────── الإعداد ───────────────────────── */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_PAGES, PAGE_COLS);
  ensureSheet_(ss, SHEET_CARDS, CARD_COLS);
  ensureSheet_(ss, SHEET_LOG, LOG_COLS);
  var props = PropertiesService.getScriptProperties();
  var email = Session.getEffectiveUser().getEmail();
  if (email) {
    props.setProperty('ADMIN_EMAIL', email);
    Logger.log('إشعارات تعديلات أصحاب الصفحات تصل إلى: ' + email);
  }
  if (!props.getProperty('ADMIN_PIN')) {
    var pin = String(Math.floor(100000 + Math.random() * 900000));
    props.setProperty('ADMIN_PIN', pin);
    Logger.log('تم تجهيز الجدولين Pages و Cards.');
    Logger.log('رمز دخول الأدمن (PIN): ' + pin);
  } else {
    Logger.log('تم تجهيز الجدولين Pages و Cards. رمز الدخول موجود مسبقًا، ولتغييره شغّل setAdminPin.');
  }
}

/** لتغيير رمز الدخول: اكتب الرمز الجديد (6 إلى 12 رقمًا) في NEW_PIN ثم شغّل الدالة، وبعدها امسحه من الملف. */
function setAdminPin() {
  var NEW_PIN = '';
  if (!/^\d{6,12}$/.test(NEW_PIN)) {
    throw new Error('اكتب رمزًا من 6 إلى 12 رقمًا في المتغير NEW_PIN داخل الدالة setAdminPin.');
  }
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', NEW_PIN);
  Logger.log('تم تغيير رمز الدخول. امسح الرمز من الملف الآن.');
}

function ensureSheet_(ss, name, cols) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    sh.setFrozenRows(1);
  } else {
    ensureHeader_(sh, cols);
  }
  return sh;
}

/* يضيف عناوين الأعمدة الجديدة (مثل links) إلى جدول أُنشئ بإصدار سابق */
function ensureHeader_(sh, cols) {
  if (sh.getLastColumn() < cols.length) sh.getRange(1, 1, 1, cols.length).setValues([cols]);
}

/* ───────────────────────── نقاط الدخول ───────────────────────── */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'page') {
      return json_(getPublicPage_(String(p.slug || '')));
    }
    return json_({ ok: true, service: 'portal-generator' });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  }
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (body && body.role === 'owner') return json_(ownerCall_(body));
  var guard = checkPin_(body && body.pin);
  if (!guard.ok) return json_(guard);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    switch (body.action) {
      case 'auth': return json_({ ok: true });
      case 'list': return json_(listPages_());
      case 'get': return json_(getPageFull_(String(body.slug || '')));
      case 'save': return json_(adminSave_(body));
      case 'delete': return json_(adminDelete_(String(body.slug || '')));
      case 'duplicate': return json_(adminDuplicate_(String(body.slug || ''), String(body.newSlug || '')));
      case 'ownerPin': return json_(ownerPin_(String(body.slug || ''), String(body.op || '')));
      case 'log': return json_(listLog_(String(body.slug || ''), Number(body.limit) || 100));
      case 'logEntry': return json_(getLogEntry_(Number(body.id)));
      default: return json_({ ok: false, error: 'bad_action' });
    }
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────────────────────── الحماية ───────────────────────── */

function checkPin_(pin) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('pin_fails') || 0);
  if (fails >= MAX_FAILS) return { ok: false, error: 'locked' };
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (real && safeEqual_(String(pin || ''), real)) {
    cache.remove('pin_fails');
    return { ok: true };
  }
  cache.put('pin_fails', String(fails + 1), LOCK_SECONDS);
  return { ok: false, error: 'bad_pin' };
}

function safeEqual_(a, b) {
  var diff = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/* ───────────────────────── القراءة ───────────────────────── */

function readTable_(name, cols) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('missing_sheet');
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  return values.map(function (row) {
    var o = {};
    cols.forEach(function (c, i) { o[c] = row[i]; });
    return o;
  });
}

function cardOut_(c, withLogo) {
  var o = {
    name: String(c.name),
    purpose: String(c.purpose || ''),
    url: String(c.url),
    icon: String(c.icon || 'link')
  };
  if (c.logo) o.logo = String(c.logo);
  var links = parseLinks_(c.links);
  if (links.length) o.links = links;
  return o;
}

function parseLinks_(v) {
  if (!v) return [];
  try {
    var a = JSON.parse(String(v));
    return Array.isArray(a) ? a.map(function (l) { return { label: String(l.label || ''), url: String(l.url || '') }; }) : [];
  } catch (err) {
    return [];
  }
}

function cardsFor_(slug) {
  return readTable_(SHEET_CARDS, CARD_COLS)
    .filter(function (c) { return String(c.slug) === slug; })
    .sort(function (a, b) { return Number(a.order) - Number(b.order); })
    .map(cardOut_);
}

function pageOut_(r) {
  return {
    slug: String(r.slug),
    title: String(r.title),
    beneficiary: String(r.beneficiary || ''),
    description: String(r.description || ''),
    color: String(r.color || '#0f766e')
  };
}

function findPage_(slug) {
  var rows = readTable_(SHEET_PAGES, PAGE_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].slug) === slug) return rows[i];
  }
  return null;
}

function getPublicPage_(slug) {
  if (!validSlug_(slug)) return { ok: false, error: 'not_found' };
  var cache = CacheService.getScriptCache();
  var hit = cache.get('page:' + slug);
  if (hit) return JSON.parse(hit);
  var row = findPage_(slug);
  if (!row || String(row.status) !== 'published') return { ok: false, error: 'not_found' };
  var out = { ok: true, page: pageOut_(row), cards: cardsFor_(slug) };
  var s = JSON.stringify(out);
  if (s.length < 90000) cache.put('page:' + slug, s, CACHE_SECONDS);
  return out;
}

function listPages_() {
  var counts = {};
  readTable_(SHEET_CARDS, CARD_COLS).forEach(function (c) {
    var k = String(c.slug);
    counts[k] = (counts[k] || 0) + 1;
  });
  var props = PropertiesService.getScriptProperties();
  var pages = readTable_(SHEET_PAGES, PAGE_COLS).map(function (r) {
    var p = pageOut_(r);
    p.cardCount = counts[p.slug] || 0;
    p.hasOwner = !!props.getProperty('owner:' + p.slug);
    return p;
  });
  return { ok: true, pages: pages };
}

function getPageFull_(slug) {
  var row = findPage_(slug);
  if (!row) return { ok: false, error: 'not_found' };
  return { ok: true, page: pageOut_(row), cards: cardsFor_(slug) };
}

/* ───────────────────────── الكتابة ───────────────────────── */

function validSlug_(s) {
  return /^[a-z0-9][a-z0-9-]{1,39}$/.test(s);
}

function validateSave_(page, cards) {
  if (!page || typeof page !== 'object') return 'invalid:page';
  if (!validSlug_(String(page.slug || ''))) return 'invalid:slug';
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
    if (ICONS.indexOf(String(c.icon || 'link')) < 0) return 'invalid:card' + i + ':icon';
    if (c.logo && (!/^data:image\/(png|webp|jpeg|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(String(c.logo)) || String(c.logo).length > MAX_LOGO_CHARS)) {
      return 'invalid:card' + i + ':logo';
    }
    if (c.links != null && !validLinks_(c.links)) return 'invalid:card' + i + ':links';
  }
  return null;
}

/* روابط إضافية اختيارية داخل البطاقة (مثل صفحات Google Sheets)، لكل رابط اسم يوضح الغرض منه */
function validLinks_(links) {
  if (!Array.isArray(links) || links.length > MAX_LINKS) return false;
  for (var j = 0; j < links.length; j++) {
    var l = links[j] || {};
    if (!String(l.label || '').trim() || String(l.label).length > 40) return false;
    if (!/^https?:\/\/\S+$/i.test(String(l.url || '')) || String(l.url).length > 600) return false;
  }
  return true;
}

function savePage_(body) {
  var page = body.page;
  var cards = body.cards;
  var err = validateSave_(page, cards);
  if (err) return { ok: false, error: err };

  var existing = findPage_(page.slug);
  if (body.isNew && existing) return { ok: false, error: 'exists' };
  if (!body.isNew && !existing) return { ok: false, error: 'not_found' };

  var now = new Date().toISOString();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shP = ss.getSheetByName(SHEET_PAGES);
  var rowValues = [
    page.slug,
    String(page.title).trim(),
    String(page.beneficiary || '').trim(),
    String(page.description || '').trim(),
    page.color,
    'published',
    existing ? existing.createdAt : now,
    now
  ];
  if (existing) {
    var rowNum = findRowNumber_(shP, page.slug);
    shP.getRange(rowNum, 1, 1, PAGE_COLS.length).setValues([rowValues]);
  } else {
    shP.appendRow(rowValues);
  }

  var shC = ss.getSheetByName(SHEET_CARDS);
  ensureHeader_(shC, CARD_COLS);
  deleteCardRows_(shC, page.slug);
  var rows = cards.map(function (c, i) {
    var links = (c.links || []).map(function (l) { return { label: String(l.label).trim(), url: String(l.url).trim() }; });
    return [page.slug, i + 1, String(c.name).trim(), String(c.purpose || '').trim(), String(c.url).trim(), String(c.icon || 'link'),
      c.logo ? String(c.logo) : '', links.length ? JSON.stringify(links) : ''];
  });
  shC.getRange(shC.getLastRow() + 1, 1, rows.length, CARD_COLS.length).setValues(rows);

  CacheService.getScriptCache().remove('page:' + page.slug);
  return getPageFull_(page.slug);
}

function findRowNumber_(sh, slug) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]) === slug) return i + 2;
  }
  return -1;
}

function deleteCardRows_(sh, slug) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) {
    if (String(col[i][0]) === slug) sh.deleteRow(i + 2);
  }
}

function deletePage_(slug) {
  if (!validSlug_(slug)) return { ok: false, error: 'invalid:slug' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shP = ss.getSheetByName(SHEET_PAGES);
  var rowNum = findRowNumber_(shP, slug);
  if (rowNum < 0) return { ok: false, error: 'not_found' };
  shP.deleteRow(rowNum);
  deleteCardRows_(ss.getSheetByName(SHEET_CARDS), slug);
  CacheService.getScriptCache().remove('page:' + slug);
  PropertiesService.getScriptProperties().deleteProperty('owner:' + slug);
  return { ok: true };
}

function duplicatePage_(slug, newSlug) {
  if (!validSlug_(newSlug)) return { ok: false, error: 'invalid:slug' };
  var src = getPageFull_(slug);
  if (!src.ok) return src;
  if (findPage_(newSlug)) return { ok: false, error: 'exists' };
  var page = src.page;
  page.slug = newSlug;
  page.title = (page.title + ' (نسخة)').slice(0, 80);
  return savePage_({ isNew: true, page: page, cards: src.cards });
}


/* ───────────────────────── صاحب الصفحة ─────────────────────────
 * لكل صفحة رمز تعديل اختياري تصدره الإدارة. صاحب الصفحة يدخل من admin.html?edit=slug
 * ويعدّل صفحته فقط (لا يغيّر الرابط المختصر ولا يحذف الصفحة). كل حفظ يُسجَّل في Log ويصل للإدارة بالبريد.
 */

function ownerCall_(body) {
  var slug = String(body.slug || '');
  if (!validSlug_(slug)) return { ok: false, error: 'bad_pin' };
  var guard = checkOwnerPin_(slug, body.pin);
  if (!guard.ok) return guard;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return { ok: false, error: 'busy' };
  }
  try {
    switch (body.action) {
      case 'auth': return { ok: true };
      case 'get': return getPageFull_(slug);
      case 'save': return ownerSave_(slug, body);
      default: return { ok: false, error: 'bad_action' };
    }
  } finally {
    lock.releaseLock();
  }
}

function ownerSave_(slug, body) {
  var before = getPageFull_(slug);
  if (!before.ok) return before;
  var page = body.page || {};
  page.slug = slug;
  var res = savePage_({ isNew: false, page: page, cards: body.cards });
  if (!res.ok) return res;
  var lines = diff_(before, res);
  logChange_(slug, 'owner', 'save', lines, before);
  notifyAdmin_(res.page, lines);
  return res;
}

function checkOwnerPin_(slug, pin) {
  var cache = CacheService.getScriptCache();
  var key = 'ofails:' + slug;
  var fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILS) return { ok: false, error: 'locked' };
  var stored = PropertiesService.getScriptProperties().getProperty('owner:' + slug);
  if (stored) {
    var parts = stored.split(':');
    if (safeEqual_(hashPin_(parts[0], String(pin || '')), parts[1])) {
      cache.remove(key);
      return { ok: true };
    }
  }
  cache.put(key, String(fails + 1), LOCK_SECONDS);
  return { ok: false, error: 'bad_pin' };
}

function hashPin_(salt, pin) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin, Utilities.Charset.UTF_8));
}

/** يصدر رمزًا جديدًا (يُعرض مرة واحدة ويُحفظ مشفّرًا) أو يوقف الرمز الحالي */
function ownerPin_(slug, op) {
  if (!findPage_(slug)) return { ok: false, error: 'not_found' };
  var props = PropertiesService.getScriptProperties();
  if (op === 'revoke') {
    props.deleteProperty('owner:' + slug);
    logChange_(slug, 'admin', 'owner_revoke', ['أوقفت الإدارة رمز التعديل لصاحب الصفحة.'], null);
    return { ok: true };
  }
  if (op !== 'new') return { ok: false, error: 'bad_request' };
  var pin = '';
  while (pin.length < 8) pin += String(Math.floor(Math.random() * 10));
  var salt = Utilities.getUuid();
  props.setProperty('owner:' + slug, salt + ':' + hashPin_(salt, pin));
  CacheService.getScriptCache().remove('ofails:' + slug);
  logChange_(slug, 'admin', 'owner_new', ['أصدرت الإدارة رمز تعديل جديدًا لصاحب الصفحة.'], null);
  return { ok: true, pin: pin };
}

/* ───────────────────────── عمليات الإدارة مع السجل ───────────────────────── */

function adminSave_(body) {
  var slug = String((body.page && body.page.slug) || '');
  var before = body.isNew ? null : getPageFull_(slug);
  var res = savePage_(body);
  if (!res.ok) return res;
  var lines = before && before.ok ? diff_(before, res) : ['أنشأت الإدارة الصفحة.'];
  logChange_(slug, 'admin', body.isNew ? 'create' : 'save', lines, before && before.ok ? before : null);
  return res;
}

function adminDelete_(slug) {
  var before = getPageFull_(slug);
  var res = deletePage_(slug);
  if (res.ok) logChange_(slug, 'admin', 'delete', ['حذفت الإدارة الصفحة.'], before.ok ? before : null);
  return res;
}

function adminDuplicate_(slug, newSlug) {
  var res = duplicatePage_(slug, newSlug);
  if (res.ok) logChange_(newSlug, 'admin', 'create', ['أنشأت الإدارة الصفحة نسخةً من ' + slug + '.'], null);
  return res;
}

/* ───────────────────────── السجل ───────────────────────── */

/** يحفظ ملخص التغيير ونسخة الصفحة قبله (بدون الشعارات لحجمها) ليمكن استرجاعها */
function logChange_(slug, by, action, lines, before) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet_(ss, SHEET_LOG, LOG_COLS);
  var snap = '';
  if (before && before.page) {
    snap = JSON.stringify({
      page: before.page,
      cards: before.cards.map(function (c) { var o = JSON.parse(JSON.stringify(c)); delete o.logo; return o; })
    });
    if (snap.length > MAX_SNAPSHOT_CHARS) snap = '';
  }
  sh.appendRow([new Date().toISOString(), slug, by, action, lines.join('\n'), snap]);
}

function listLog_(slug, limit) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  if (!sh || sh.getLastRow() < 2) return { ok: true, entries: [] };
  var last = sh.getLastRow();
  var values = sh.getRange(2, 1, last - 1, LOG_COLS.length).getValues();
  var out = [];
  for (var i = values.length - 1; i >= 0 && out.length < Math.min(limit, 300); i--) {
    var r = values[i];
    if (slug && String(r[1]) !== slug) continue;
    out.push({ id: i + 2, time: String(r[0]), slug: String(r[1]), by: String(r[2]), action: String(r[3]), summary: String(r[4]), restorable: !!r[5] });
  }
  return { ok: true, entries: out };
}

function getLogEntry_(id) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  if (!sh || !(id >= 2) || id > sh.getLastRow()) return { ok: false, error: 'not_found' };
  var r = sh.getRange(id, 1, 1, LOG_COLS.length).getValues()[0];
  if (!r[5]) return { ok: false, error: 'not_found' };
  var snap = JSON.parse(String(r[5]));
  return { ok: true, slug: String(r[1]), time: String(r[0]), page: snap.page, cards: snap.cards, exists: !!findPage_(String(r[1])) };
}

/* ───────────────────────── ملخص التغييرات ───────────────────────── */

function diff_(before, after) {
  var lines = [];
  var a = before.page, b = after.page;
  if (a.title !== b.title) lines.push('العنوان: «' + a.title + '» ← «' + b.title + '»');
  if (a.beneficiary !== b.beneficiary) lines.push('الجهة المستفيدة: «' + a.beneficiary + '» ← «' + b.beneficiary + '»');
  if (a.description !== b.description) lines.push('عدّل الوصف.');
  if (String(a.color).toLowerCase() !== String(b.color).toLowerCase()) lines.push('اللون: ' + a.color + ' ← ' + b.color);

  var oldBy = {}, newBy = {};
  before.cards.forEach(function (c) { oldBy[c.name] = c; });
  after.cards.forEach(function (c) { newBy[c.name] = c; });
  after.cards.forEach(function (c) { if (!oldBy[c.name]) lines.push('أضاف بطاقة «' + c.name + '».'); });
  before.cards.forEach(function (c) { if (!newBy[c.name]) lines.push('حذف بطاقة «' + c.name + '».'); });
  after.cards.forEach(function (c) {
    var o = oldBy[c.name];
    if (!o) return;
    var f = [];
    if (o.purpose !== c.purpose) f.push('الهدف');
    if (o.url !== c.url) f.push('الرابط');
    if (o.icon !== c.icon) f.push('الأيقونة');
    if ((o.logo || '') !== (c.logo || '')) f.push('الشعار');
    if (f.length) lines.push('بطاقة «' + c.name + '»: عدّل ' + f.join('، ') + '.');
    var ol = {}, nl = {};
    (o.links || []).forEach(function (l) { ol[l.label] = l.url; });
    (c.links || []).forEach(function (l) { nl[l.label] = l.url; });
    Object.keys(nl).forEach(function (k) {
      if (!(k in ol)) lines.push('بطاقة «' + c.name + '»: أضاف رابط «' + k + '».');
      else if (ol[k] !== nl[k]) lines.push('بطاقة «' + c.name + '»: غيّر رابط «' + k + '».');
    });
    Object.keys(ol).forEach(function (k) { if (!(k in nl)) lines.push('بطاقة «' + c.name + '»: حذف رابط «' + k + '».'); });
  });
  var oldOrder = before.cards.map(function (c) { return c.name; }).filter(function (n) { return newBy[n]; }).join('|');
  var newOrder = after.cards.map(function (c) { return c.name; }).filter(function (n) { return oldBy[n]; }).join('|');
  if (oldOrder !== newOrder) lines.push('غيّر ترتيب البطاقات.');
  return lines.length ? lines : ['حفظ بدون تغييرات.'];
}

function notifyAdmin_(page, lines) {
  var to = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (!to) return;
  try {
    MailApp.sendEmail({
      to: to,
      subject: 'تعديل على صفحة «' + page.title + '»',
      body: 'عدّل صاحب الصفحة «' + page.title + '» (' + page.slug + '):\n\n- ' + lines.join('\n- ') +
        '\n\nتجد التفاصيل ونسخة الصفحة قبل التعديل في «سجل التعديلات» بلوحة الإدارة.'
    });
  } catch (err) {
    // البريد اختياري: فشل الإرسال لا يُفشل الحفظ
  }
}

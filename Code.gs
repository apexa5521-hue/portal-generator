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
var PAGE_COLS = ['slug', 'title', 'beneficiary', 'description', 'color', 'status', 'createdAt', 'updatedAt'];
var CARD_COLS = ['slug', 'order', 'name', 'purpose', 'url', 'icon', 'logo', 'links'];
var MAX_CARDS = 12;
var MAX_LINKS = 6;
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
  var props = PropertiesService.getScriptProperties();
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
      case 'save': return json_(savePage_(body));
      case 'delete': return json_(deletePage_(String(body.slug || '')));
      case 'duplicate': return json_(duplicatePage_(String(body.slug || ''), String(body.newSlug || '')));
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
  var pages = readTable_(SHEET_PAGES, PAGE_COLS).map(function (r) {
    var p = pageOut_(r);
    p.cardCount = counts[p.slug] || 0;
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

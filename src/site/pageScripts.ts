// Code in this file runs INSIDE the UNIGE page (WebView), not in React Native.
// Each script is the body of an async function; its return value is sent back as JSON.
// Element ids come from the site's Oracle ADF markup and will break if the site changes.

export const HOME_URL = 'https://wwwi.unige.ch/service/sport/inscription/home';

export const PAGE_HELPERS = `
  var IDS = {
    sportSelect: 'pt1:qryId1:val00::content',
    searchButton: 'pt1:qryId1::search',
    slotTitle: 'pt1:pgl2',
    slotTable: 'pt1:resId1',
    regTable: 'pt1:pc1:insTab',
    formSave: 'pt1:saveBtBF',
    formPhone: 'pt1:it2::content',
    formAccept: 'pt1:sbc1::content',
    pageContent: 'pt1:pt_pgl1::c',
    homeLink: 'pt1:pt_cil1gt',
    messages: 'd1::msgDlg::_cnt'
  };
  var $id = function (id) { return document.getElementById(id); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  // innerText (not textContent): textContent pulls in <script>/<style> contents too, which
  // showed up verbatim in diagnostics ("function changeLanguage(lang){...}") instead of what
  // the page actually displays. innerText also naturally skips hidden elements.
  var text = function (el) { return el ? (el.innerText != null ? el.innerText : el.textContent).replace(/\\s+/g, ' ').trim() : ''; };
  var adfIdle = function () {
    var p = window.AdfPage && window.AdfPage.PAGE;
    return !p || typeof p.isSynchronizedWithServer !== 'function' || p.isSynchronizedWithServer();
  };
  var waitFor = async function (pred, ms, what) {
    var end = Date.now() + ms;
    while (Date.now() < end) {
      try { if (pred()) return; } catch (e) {}
      await sleep(150);
    }
    throw new Error('Le site ne répond pas (' + what + ').');
  };
  // Same event sequence as a real click, so ADF's handlers see what they expect.
  var realClick = function (el) {
    if (el.focus) el.focus();
    ['mousedown', 'mouseup', 'click'].forEach(function (t) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 }));
    });
  };
  var visible = function (el) {
    for (; el && el !== document.body; el = el.parentElement) {
      if (getComputedStyle(el).display === 'none') return false;
    }
    return true;
  };
  var cell = function (row, suffix) { return row.querySelector('[id$=":' + suffix + '"]'); };
  var rows = function (tableId) {
    var t = $id(tableId);
    return t ? Array.prototype.slice.call(t.querySelectorAll('tr[_afrrk]')) : [];
  };

  var searchSport = async function (sport) {
    await waitFor(adfIdle, 10000, 'chargement');
    var s = $id(IDS.sportSelect);
    if (!s) throw new Error('Liste des sports introuvable sur la page.');
    var opt = Array.prototype.find.call(s.options, function (o) { return text(o) === sport; });
    if (!opt) throw new Error('Sport introuvable : ' + sport);

    var old = $id(IDS.slotTable);
    if (old) old.__usaStale = true;
    if (s.value !== opt.value) {
      s.value = opt.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(adfIdle, 10000, 'sélection du sport');
    }
    realClick($id(IDS.searchButton));

    // ADF usually replaces the table node; if it updates in place, fall back to a short grace period.
    var start = Date.now();
    await waitFor(function () {
      var t = $id(IDS.slotTable);
      var titleCell = $id(IDS.slotTitle) && $id(IDS.slotTitle).querySelector('td');
      return adfIdle() && text(titleCell) === sport && (!t || !t.__usaStale || Date.now() - start > 3000);
    }, 20000, 'recherche');
  };

  var slotInfo = function (r) {
    var action = cell(r, 'resId1c3');
    var btn = action && action.querySelector('button');
    // The "Déjà inscrit" text is always in the DOM; only the visible leaf counts.
    var registered = !!action && Array.prototype.some.call(action.querySelectorAll('*'), function (e) {
      return e.children.length === 0 && text(e) === 'Déjà inscrit' && visible(e);
    });
    return {
      description: text(cell(r, 'resId1c2')),
      date: text(cell(r, 'c5')),
      registered: registered,
      bookable: !!btn && !btn.disabled && !/p_AFDisabled/.test(btn.className),
      button: btn
    };
  };
`;

export const PROBE = `
  await waitFor(adfIdle, 5000, 'chargement');
  return {
    url: location.href,
    app: location.hostname === 'wwwi.unige.ch' &&
      location.pathname.indexOf('/service/sport/inscription/') === 0 && !!$id('f1')
  };
`;

export const IS_HOME = `
  await waitFor(adfIdle, 5000, 'chargement');
  return !!$id(IDS.sportSelect) && !!$id(IDS.regTable);
`;

export const LIST_SPORTS = `
  await waitFor(adfIdle, 10000, 'chargement');
  var s = $id(IDS.sportSelect);
  if (!s) throw new Error('Liste des sports introuvable sur la page.');
  return Array.prototype.map.call(s.options, function (o) { return text(o); }).filter(Boolean);
`;

export const searchSlots = (sport: string) => `
  await searchSport(${JSON.stringify(sport)});
  return rows(IDS.slotTable).map(function (r) {
    var s = slotInfo(r);
    return { description: s.description, date: s.date, registered: s.registered, bookable: s.bookable };
  });
`;

export const READ_REGISTRATIONS = `
  await waitFor(adfIdle, 10000, 'chargement');
  if (!$id(IDS.regTable)) throw new Error('Tableau des inscriptions introuvable sur la page.');
  return rows(IDS.regTable).map(function (r) {
    return {
      sport: text(cell(r, 'c8')),
      description: text(cell(r, 'c3')),
      date: text(cell(r, 'c9')),
      status: text(cell(r, 'c10')),
      paidAt: text(cell(r, 'c6')),
      price: text(cell(r, 'c4')),
      location: text(cell(r, 'c1')),
      level: text(cell(r, 'c7')),
      teacher: text(cell(r, 'c14')),
      cancellable: !!cell(r, 'b1')
    };
  });
`;

// --- Signup flow: home → "M'inscrire" → form (phone, conditions, "Enregistrer") → result page.

/** Clicks "M'inscrire" on the matching slot. Nothing is booked yet. */
export const startSignup = (sport: string, description: string, date: string) => `
  await searchSport(${JSON.stringify(sport)});
  var match = rows(IDS.slotTable).map(slotInfo).find(function (s) {
    return s.description === ${JSON.stringify(description)} && s.date === ${JSON.stringify(date)};
  });
  if (!match) throw new Error('Cette séance n’est plus proposée sur le site.');
  if (match.registered) throw new Error('Vous êtes déjà inscrit·e à cette séance.');
  if (!match.bookable) throw new Error('Cette séance n’est pas ouverte à l’inscription.');
  realClick(match.button);
  return true;
`;

/**
 * Returns null until the signup form is displayed (polled across navigations).
 * A full slot never reaches the form: the site shows its "Interdit" page instead.
 */
export const READ_SIGNUP_FORM = `
  if (!adfIdle()) return null;
  var f1 = $id('f1');
  if (document.title === 'Interdit' || (f1 && /\\/Interdit$/.test(f1.getAttribute('action') || ''))) {
    var box = $id('pt1:pgl1') || document.body;
    var lead = Array.prototype.find.call(box.querySelectorAll('div'), function (d) {
      return /font-size:\\s*16px/.test(d.getAttribute('style') || '');
    });
    var msg = text(lead) || text(box);
    return { kind: /complet/i.test(msg) ? 'full' : 'blocked', text: msg };
  }
  if (!$id(IDS.formSave)) return null;
  var t = function (id) { return text($id('pt1:' + id)); };
  var phone = $id(IDS.formPhone);
  return {
    kind: 'form',
    sport: t('ot3'),
    information: t('ot4'),
    description: t('ot5'),
    startDate: t('ot7'),
    endDate: t('ot8'),
    location: t('ot9'),
    price: t('ot10'),
    teacher: t('ot12'),
    window: (t('ot14') + ' ' + t('ot1')).trim(),
    phone: phone ? phone.value.trim() : ''
  };
`;

/** Accepts the conditions and clicks "Enregistrer" — this is what books the slot. */
export const SUBMIT_SIGNUP = `
  await waitFor(adfIdle, 10000, 'chargement');
  var save = $id(IDS.formSave);
  if (!save) return { clicked: false, error: 'Formulaire d’inscription introuvable.' };
  var phone = $id(IDS.formPhone);
  if (!phone || !phone.value.trim()) {
    return { clicked: false, error: 'Numéro de téléphone manquant : complétez-le sur le site.' };
  }
  var accept = $id(IDS.formAccept);
  if (accept && !accept.checked) {
    realClick(accept);
    await waitFor(function () { return accept.checked && adfIdle(); }, 5000, 'conditions');
  }
  window.confirm = function () { return true; };
  realClick(save);
  return { clicked: true };
`;

/** Returns null until the outcome page (or a form validation error) is displayed. */
export const READ_SIGNUP_RESULT = `
  if (!adfIdle()) return null;
  if ($id(IDS.formSave)) {
    var msg = text($id(IDS.messages));
    return msg ? { kind: 'invalid', text: msg } : null;
  }
  var content = $id(IDS.pageContent) || document.body;
  var link = $id(IDS.homeLink);
  // Messages sit in separate spans; joining them keeps the sentences apart.
  var t = Array.prototype.filter.call(content.querySelectorAll('span'), function (s) {
    return !s.querySelector('span') && !(link && link.contains(s)) && visible(s);
  }).map(text).filter(Boolean).join(' ') || text(content);
  var kind = /bien été enregistrée/i.test(t) ? 'ok'
    : /complet|plus de place|aucune place|places? disponibles?/i.test(t) ? 'full'
    : 'other';
  return { kind: kind, text: t };
`;

// --- Unregister: home table "Se désinscrire" → "Confirmation" page ("… a été annulée").

/** Clicks "Se désinscrire" on the matching registration row. This is what cancels. */
export const startUnregister = (sport: string, description: string, date: string) => `
  await waitFor(adfIdle, 10000, 'chargement');
  if (!$id(IDS.regTable)) return { clicked: false, error: 'Tableau des inscriptions introuvable sur la page.' };
  var row = rows(IDS.regTable).find(function (r) {
    return text(cell(r, 'c8')) === ${JSON.stringify(sport)} &&
      text(cell(r, 'c3')) === ${JSON.stringify(description)} &&
      text(cell(r, 'c9')) === ${JSON.stringify(date)};
  });
  if (!row) return { clicked: false, error: 'Inscription introuvable sur le site (déjà annulée ?).' };
  var holder = cell(row, 'b1');
  var btn = holder && (holder.querySelector('a[role="button"]') || holder.querySelector('a'));
  if (!btn) return { clicked: false, error: 'Cette inscription ne peut plus être annulée sur le site.' };
  window.confirm = function () { return true; };
  realClick(btn);
  return { clicked: true };
`;

/** Returns null until the outcome page (or an error message on the home page) is displayed. */
export const READ_UNREGISTER_RESULT = `
  if (!adfIdle()) return null;
  var f1 = $id('f1');
  if (document.title === 'Confirmation' || (f1 && /\\/delete$/.test(f1.getAttribute('action') || ''))) {
    var t = text($id('pt1:pgl1') || document.body).replace(/^Retour\\s*/, '');
    return { kind: /annulée/i.test(t) ? 'ok' : 'other', text: t };
  }
  var msg = text($id(IDS.messages));
  return msg ? { kind: 'error', text: msg } : null;
`;

// --- Auto-login: organisation login page(s). The institution picker (WAYF) is
// skipped entirely, see loginUrlFor. bridge.ts drives one step per page load.
// Exactly the flow the user described, built against the real saved pages:
// e-mail page (Switch edu-ID "Login") -> password page (Switch edu-ID "Login 2").
// Other Shibboleth IdPs commonly use a single j_username/j_password page instead
// of splitting it in two, so both shapes are matched by field, not by page count.

export const autoLoginStep = (email: string, password: string) => `
  // This login page is React (data-testid attributes in the saved HTML). React
  // overrides the native <input> value setter to track field state itself; setting
  // el.value directly leaves the DOM looking filled while React's own state (what
  // actually gets submitted) stays empty. Going through the native setter first,
  // like a real keystroke would, is the standard workaround.
  var setNativeValue = function (el, val) {
    var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
    if (setter) { setter.call(el, val); } else { el.value = val; }
  };
  var typeInto = function (el, val) {
    el.focus();
    setNativeValue(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  };
  // Some forms only enable the submit button once their own validation (often
  // running on the 'input'/'blur' events just dispatched) has had a moment to react.
  var clickWhenEnabled = async function (btn) {
    for (var i = 0; i < 20 && btn.disabled; i++) await sleep(100);
    realClick(btn);
    return !btn.disabled;
  };
  var alertText = function () {
    var el = Array.prototype.find.call(
      document.querySelectorAll('.alert-danger, .alert-error, .invalid-feedback, .text-danger, .form-error, .error, [role="alert"]'),
      function (e) { return visible(e) && text(e); }
    );
    return el ? text(el) : '';
  };
  // Every result says which page it was, so a failure can quote what the page showed.
  var done = function (r) {
    r.page = (document.title || '?') + ' — ' + location.hostname + ' — ' + text(document.body).slice(0, 200);
    if (r.alert === undefined) r.alert = alertText();
    return r;
  };

  var passwordField = document.querySelector('input[type="password"]');
  var userField = $id('username') || document.querySelector('input[name="j_username"]') ||
    document.querySelector('input[type="email"]') || document.querySelector('input[name="username"]');

  if (passwordField) {
    var alert = alertText();
    if (userField && !userField.readOnly) typeInto(userField, ${JSON.stringify(email)});
    typeInto(passwordField, ${JSON.stringify(password)});
    await sleep(150);
    var passwordBtn = $id('button-proceed') ||
      (passwordField.form && passwordField.form.querySelector('button[type="submit"], input[type="submit"]'));
    if (!passwordBtn) return done({ step: 'password', acted: false, alert: alert });
    var clicked = await clickWhenEnabled(passwordBtn);
    return done({ step: 'password', acted: clicked, alert: alert });
  }
  if (userField) {
    var alert2 = alertText();
    typeInto(userField, ${JSON.stringify(email)});
    await sleep(150);
    var emailBtn = $id('button-submit') ||
      (userField.form && userField.form.querySelector('button[type="submit"], input[type="submit"]'));
    if (!emailBtn) return done({ step: 'email', acted: false, alert: alert2 });
    var clicked2 = await clickWhenEnabled(emailBtn);
    return done({ step: 'email', acted: clicked2, alert: alert2 });
  }

  return done({ step: 'other', acted: false });
`;

// The site's "Déconnexion" lands on a dead-end SWITCHaai page telling the user to
// close their browser. If the WebView ever ends up there, bounce back home so the
// normal flow continues instead of sitting on it.
export const IS_LOGOUT_CONFIRMATION = `
  return /fermer tous les onglets/i.test(document.body ? document.body.textContent : '');
`;


// The SWITCHaai institution picker (WAYF) is a SAML discovery service: all it does
// is send the browser back to the site's login handler with the chosen entityID.
// Going there directly avoids driving the picker's JavaScript widget at all.
export const isWayf = (url: string) => /^https:\/\/wayf\.switch\.ch\//.test(url);

export const loginUrlFor = (entityId: string) =>
  'https://wwwi.unige.ch/service/sport/Shibboleth.sso/Login?SAMLDS=1&entityID=' +
  encodeURIComponent(entityId) +
  '&target=' +
  encodeURIComponent(HOME_URL);

/** The picker's organisations, in its order, without the "recently used" duplicates. */
export const READ_WAYF_ORGANISATIONS = `
  var sel = $id('userIdPSelection');
  if (!sel) return [];
  var byId = {};
  var order = [];
  Array.prototype.forEach.call(sel.options, function (o) {
    if (!o.value || o.value === '-') return;
    if (byId[o.value]) order.splice(order.indexOf(o.value), 1);
    byId[o.value] = text(o);
    order.push(o.value);
  });
  return order.map(function (id) { return { name: byId[id], entityId: id }; });
`;

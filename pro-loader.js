// Pro: проверка кода и загрузка зашифрованной Pro-части (AES-GCM, ключ из кода через PBKDF2-SHA256).
// Код нигде не хранится в открытом виде: без правильного кода файл pro.enc.json не расшифровать.
(function (root) {
  var subtle = (root.crypto || {}).subtle;
  // Похожие кириллические буквы → латиница, чтобы код работал при любой раскладке
  var LOOK = { 'А': 'A', 'В': 'B', 'Е': 'E', 'Ё': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y' };
  function normalizeCode(s) {
    return String(s || '').toUpperCase().replace(/[АВЕЁКМНОРСТХУ]/g, function (c) { return LOOK[c]; }).replace(/[^A-Z0-9А-Я]/g, '');
  }
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(str) { var s = atob(str), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function deriveKey(code, salt, iter, usage) {
    return subtle.importKey('raw', new TextEncoder().encode(normalizeCode(code)), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, usage);
    });
  }
  function decryptBundle(bundle, code) {
    return deriveKey(code, unb64(bundle.salt), bundle.iter, ['decrypt']).then(function (key) {
      return subtle.decrypt({ name: 'AES-GCM', iv: unb64(bundle.iv) }, key, unb64(bundle.ct));
    }).then(function (plain) { return JSON.parse(new TextDecoder().decode(plain)); });
  }
  function encryptBundle(payload, code, iter) {
    iter = iter || 250000;
    var salt = root.crypto.getRandomValues(new Uint8Array(16)), iv = root.crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(code, salt, iter, ['encrypt']).then(function (key) {
      return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
    }).then(function (ct) { return { v: 1, alg: 'AES-GCM-256', kdf: 'PBKDF2-SHA256', iter: iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) }; });
  }
  var api = { normalizeCode: normalizeCode, decryptBundle: decryptBundle, encryptBundle: encryptBundle };
  root.SellerProCrypto = api;
  if (typeof module !== 'undefined') { module.exports = api; return; }

  /* ---------- Браузер ---------- */
  var KEY = 'sellerCalc.proCode';
  var $ = function (id) { return document.getElementById(id); };
  var src = (document.currentScript && document.currentScript.src) || '';
  var VER = (src.match(/[?&]v=([^&]+)/) || [])[1] || '';
  var form = $('proForm'); if (!form) return;
  var goal = function (g) { try { if (root.ym) root.ym(113981254, 'reachGoal', g); } catch (e) {} };

  var link = $('boostyLink');
  if (link) link.addEventListener('click', function (e) {
    goal('boosty_click');
    if (/PLACEHOLDER/.test(link.href)) { e.preventDefault(); err('Страница подписки на Boosty скоро откроется. Загляните чуть позже!'); }
  });

  function err(msg) { $('proErr').textContent = msg; }
  function busy(on) { var b = form.querySelector('button'); b.disabled = on; b.textContent = on ? 'Проверяю…' : 'Открыть Pro'; }

  function mount(p) {
    var st = document.createElement('style'); st.id = 'proStyle'; st.textContent = p.css; document.head.appendChild(st);
    $('proLocked').hidden = true;
    $('pro').classList.add('unlocked');
    $('proMount').innerHTML = p.html;
    root.SellerProEnv = { month: p.month, ver: VER, logout: function () { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); } };
    var s = document.createElement('script'); s.textContent = p.js + '\n//# sourceURL=seller-pro.js'; document.body.appendChild(s);
  }

  function unlock(code, saved) {
    if (!subtle) { err('Ваш браузер не поддерживает защищённую расшифровку. Обновите браузер.'); return; }
    if (!saved && normalizeCode(code).length < 6) { err('Введите код полностью — он есть в закрытом посте на Boosty.'); return; }
    busy(true); err('');
    fetch('pro.enc.json?v=' + VER + '&t=' + Math.floor(Date.now() / 36e5), { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('net'); return r.json(); })
      .then(function (bundle) {
        return decryptBundle(bundle, code).then(function (p) {
          try { localStorage.setItem(KEY, code); } catch (e) {}
          if (!saved) goal('pro_unlock');
          mount(p);
        }, function () {
          if (saved) { try { localStorage.removeItem(KEY); } catch (e) {} err('Код прошлого месяца больше не действует. Новый код — в закрытом посте на Boosty.'); }
          else err('Код не подошёл. Проверьте, что он за текущий месяц, и введите ещё раз.');
        });
      })
      .catch(function (e) { console.error(e); err('Не удалось загрузить Pro. Проверьте интернет и попробуйте ещё раз.'); })
      .then(function () { busy(false); });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); unlock($('proCode').value, false); });
  var savedCode = null; try { savedCode = localStorage.getItem(KEY); } catch (e) {}
  if (savedCode) unlock(savedCode, true);
})(typeof window !== 'undefined' ? window : globalThis);

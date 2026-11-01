(function () {
  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = ['name','price','cost','commission','logistics','storage','acceptance','buyout','returnLogistics','ads','adsMode','taxMode','taxRate','other','units','dimL','dimW','dimH','whCoef'];

  /* Ориентировочные комиссии по категориям — НЕ официальные ставки, только ориентир.
     WB (модель FBW, склад WB): диапазоны ставок по категориям из снимка таблицы комиссий WB
       от 05.10.2026 — smartstats.ru/calc/wildberries-commissions; примеры предметов —
       tochka.com/knowledge/marketpleisy/komissii-wildberries-za-cto-platit-marketpleisu (оферта WB с 20.07.2026).
       Подставляем ВЕРХНЮЮ границу диапазона (консервативно), диапазон показываем в подсказке.
     Ozon: единая ставка FBO/FBS для товаров дороже 300 ₽, действует с 28.08.2026 —
       iseller.pro/komissii-ozon и iseller.pro/zhurnal/ozon-edinaya-komissiya-28-avgusta-2026,
       smartstats.ru/calc/ozon-commissions (источник проверен 04.10.2026).
     Собрано 01.11.2026. Ставки меняются — пересматривайте раз в 1–2 месяца. */
  var CATS = {
    wb: [
      ['Одежда', 43.5, '33,5–43,5%'],
      ['Обувь', 41.5, '32,5–41,5%'],
      ['Косметика и красота', 41.5, '25,5–41,5%'],
      ['Аксессуары', 43.5, '33,5–43,5%'],
      ['Дом: посуда, текстиль, хозтовары', 38.5, '23,5–38,5%'],
      ['Сад и огород', 38.5, '22,5–38,5%'],
      ['Смартфоны и гаджеты', 35.5, '25,5–35,5%'],
      ['Аксессуары для электроники', 43.5, '22,5–43,5%'],
      ['Бытовая техника', 34.5, '23,5–34,5%'],
      ['Детские товары (для малышей)', 35.5, '22,5–35,5%'],
      ['Игрушки', 37.5, '22,5–37,5%'],
      ['Спортивные товары', 39, '21,5–39%'],
      ['Автотовары (аксессуары)', 35.5, '20,5–35,5%'],
      ['Зоотовары', 30.5, '14,5–30,5%'],
      ['Продукты питания', 30.5, '15,5–30,5%'],
      ['Бытовая химия', 38.5, '28,5–38,5%']
    ],
    ozon: [
      ['Одежда', 52], ['Обувь', 52], ['Косметика и гигиена', 52], ['Галантерея и аксессуары', 52],
      ['Дом и сад', 52], ['Электроника', 47], ['Бытовая техника', 51], ['Детские товары', 52],
      ['Спорт и отдых', 52], ['Автотовары', 47], ['Зоотовары', 48], ['Продукты питания', 40],
      ['Бытовая химия', 48], ['Аптека, БАДы', 51], ['Канцелярия', 50]
    ]
  };

  // Значения по умолчанию — ориентир для примера расчёта
  var DEFAULTS = {
    wb:   { commission: 38.5, logistics: 78.2, returnLogistics: 46, storage: 10, acceptance: 20, buyout: 85,
            commHint: 'Ориентир. На WB (FBW) обычно ≈ 25–45% в зависимости от предмета. Выберите категорию или введите ставку из ЛК → «Тарифы → Комиссии».',
            logHint: 'По умолчанию — товар 1 л при коэффициенте 170%. Укажите габариты ниже для точного расчёта.' },
    ozon: { commission: 52, logistics: 100, returnLogistics: 80, storage: 10, acceptance: 20, buyout: 90,
            commHint: 'Ориентир. На Ozon с 28.08.2026 для товаров дороже 300 ₽ ставка обычно 40–52% по категории; для дешёвых — ниже.',
            logHint: 'Введите тариф из ЛК: зависит от маршрута доставки, цены и объёма.' }
  };
  var TAX = { usn6: 6, npd4: 4, npd6: 6, usn15: 15 };
  var COLORS = { cost:'#8e7cc3', commission:'#e5484d', logistics:'#f5a524', storage:'#00a2c7', acceptance:'#6bc4a6', ads:'#ff7ab6', other:'#9aa0b5', tax:'#64748b', profit:'#12a150' };
  var LABELS = { cost:'Себестоимость', commission:'Комиссия', logistics:'Логистика (с возвратами)', storage:'Хранение', acceptance:'Приёмка / упаковка', ads:'Реклама', other:'Прочее', tax:'Налог', profit:'Чистая прибыль' };
  var mp = 'wb', KEY = 'sellerCalc.products.v1';

  var rub = function (v) { return isFinite(v) ? Math.round(v).toLocaleString('ru-RU') + ' ₽' : '—'; };
  var pct = function (v) { return isFinite(v) ? v.toFixed(1).replace('.', ',') + '%' : '—'; };
  var num = function (v, d) { return (+v).toLocaleString('ru-RU', { maximumFractionDigits: d === undefined ? 2 : d }); };

  function read() { var o = { mp: mp }; FIELDS.forEach(function (f) { o[f] = $(f).value; }); return o; }
  function write(o) { FIELDS.forEach(function (f) { if (o[f] !== undefined && o[f] !== null) $(f).value = o[f]; }); }

  function fillCategories() {
    var sel = $('category');
    sel.innerHTML = '<option value="">Выбрать категорию…</option>' +
      CATS[mp].map(function (c, idx) { return '<option value="' + idx + '">' + c[0] + ' — ' + num(c[1], 1) + '%' + (c[2] ? ' (' + c[2] + ')' : '') + '</option>'; }).join('');
  }

  function setMp(m, applyDefaults) {
    mp = m; document.body.className = m;
    document.querySelectorAll('.mp-switch button').forEach(function (b) {
      var on = b.dataset.mp === m; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on);
    });
    var d = DEFAULTS[m];
    if (applyDefaults) write(d);
    fillCategories();
    $('commHint').textContent = d.commHint; $('logHint').textContent = d.logHint;
    if (applyDefaults && m === 'wb') volume();
    update();
  }

  function volume() {
    if (mp !== 'wb') return;
    var v = SellerCalc.wbLogistics($('dimL').value, $('dimW').value, $('dimH').value, $('whCoef').value);
    if (!v) { $('volOut').textContent = 'Введите габариты упаковки — логистика и возврат подставятся автоматически.'; $('logHint').textContent = DEFAULTS.wb.logHint; return; }
    $('logHint').textContent = 'Посчитано по габаритам: ' + num(v.liters, 3) + ' л × коэффициент ' + num(+$('whCoef').value || 0, 0) + '%. Ориентир, проверьте в ЛК.';
    $('logistics').value = Math.round(v.direct * 100) / 100;
    $('returnLogistics').value = Math.round(v.reverse * 100) / 100;
    $('volOut').innerHTML = 'Объём <b>' + num(v.liters, 3) + ' л</b> · базовый тариф ' + num(v.base) + ' ₽ · ' +
      'логистика <b>' + num(v.direct) + ' ₽</b> · возврат <b>' + num(v.reverse) + ' ₽</b> — подставлено в поля выше.';
  }

  function reverse() {
    var P = SellerCalc.priceFor(read(), $('targetMode').value, $('target').value);
    $('rPrice').textContent = isFinite(P) ? rub(Math.ceil(P)) : 'недостижимо';
    $('applyPrice').disabled = !isFinite(P);
    return P;
  }

  function update() {
    var i = read();
    $('taxRate').disabled = i.taxMode !== 'custom';
    if (i.taxMode !== 'custom') $('taxRate').value = TAX[i.taxMode];
    var r = SellerCalc.calc(read());
    var cls = r.profit >= 0 ? 'pos' : 'neg';
    $('rProfit').textContent = rub(r.profit); $('rProfit').className = cls;
    $('rMargin').textContent = pct(r.margin); $('rMargin').className = cls;
    $('rRoi').textContent = pct(r.roi); $('rRoi').className = cls;
    $('rBreak').textContent = rub(r.breakEven);
    $('mRevenue').textContent = rub(r.monthRevenue);
    $('mProfit').textContent = rub(r.monthProfit); $('mProfit').className = cls;

    var keys = ['cost','commission','logistics','storage','acceptance','ads','other','tax'];
    var total = keys.reduce(function (s, k) { return s + r[k]; }, 0);
    var base = Math.max(r.revenue, total) || 1;
    var parts = keys.concat(r.profit > 0 ? ['profit'] : []);
    $('bar').innerHTML = parts.map(function (k) {
      var w = Math.max(0, r[k]) / base * 100;
      return w > 0 ? '<div title="' + LABELS[k] + ': ' + rub(r[k]) + '" style="width:' + w + '%;background:' + COLORS[k] + '"></div>' : '';
    }).join('');
    var rows = '<tr><td>Выручка (цена продажи)</td><td></td><td><b>' + rub(r.revenue) + '</b></td></tr>';
    keys.forEach(function (k) {
      rows += '<tr><td><span class="dot" style="background:' + COLORS[k] + '"></span>' + LABELS[k] + '</td><td>' +
        (r.revenue ? pct(r[k] / r.revenue * 100) : '') + '</td><td>−' + rub(r[k]) + '</td></tr>';
    });
    rows += '<tr class="total"><td><span class="dot" style="background:' + COLORS.profit + '"></span>Чистая прибыль</td><td>' + pct(r.margin) + '</td><td class="' + cls + '">' + rub(r.profit) + '</td></tr>';
    $('breakdown').innerHTML = rows;
    reverse();
    return r;
  }

  function load() { try { var l = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(l) ? l.filter(function (p) { return p && p.input; }) : []; } catch (e) { return []; } }
  function store(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} renderSaved(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }

  function renderSaved() {
    var list = load();
    $('empty').style.display = list.length ? 'none' : '';
    if (!list.length) { $('cmp').innerHTML = ''; return; }
    var h = '<tr><th>Товар</th><th>Цена</th><th>Себест.</th><th>Комиссия</th><th>Прибыль/шт</th><th>Маржа</th><th>ROI</th><th>Безубыт.</th><th>Шт/мес</th><th>Прибыль/мес</th><th></th></tr>';
    list.forEach(function (p, idx) {
      var r = SellerCalc.calc(p.input), c = r.profit >= 0 ? 'pos' : 'neg';
      h += '<tr><td><a href="#" data-load="' + idx + '">' + esc(p.input.name || 'Без названия') + '</a><span class="tag ' + p.input.mp + '">' + (p.input.mp === 'wb' ? 'WB' : 'Ozon') + '</span></td>' +
        '<td>' + rub(r.revenue) + '</td><td>' + rub(r.cost) + '</td><td>' + rub(r.commission) + '</td>' +
        '<td class="' + c + '">' + rub(r.profit) + '</td><td class="' + c + '">' + pct(r.margin) + '</td><td class="' + c + '">' + pct(r.roi) + '</td>' +
        '<td>' + rub(r.breakEven) + '</td><td>' + (+p.input.units || 0) + '</td><td class="' + c + '">' + rub(r.monthProfit) + '</td>' +
        '<td><button type="button" class="del" data-del="' + idx + '" title="Удалить" aria-label="Удалить">✕</button></td></tr>';
    });
    $('cmp').innerHTML = h;
  }

  function csv() {
    var list = load(); if (!list.length) { toast('Сначала сохраните хотя бы один товар'); return; }
    var head = ['Товар','Маркетплейс','Цена','Себестоимость','Комиссия %','Комиссия ₽','Логистика ₽ (с возвратами)','Хранение','Приёмка','Реклама ₽','Прочее','Налог ₽','Прибыль/шт','Маржа %','ROI %','Точка безубыточности','Шт/мес','Прибыль/мес'];
    var lines = [head];
    list.forEach(function (p) {
      var i = p.input, r = SellerCalc.calc(i), n = function (v) { return isFinite(v) ? (Math.round(v * 100) / 100).toString().replace('.', ',') : ''; };
      lines.push([i.name || 'Без названия', i.mp === 'wb' ? 'Wildberries' : 'Ozon', n(r.revenue), n(r.cost), n(+i.commission), n(r.commission), n(r.logistics), n(r.storage), n(r.acceptance), n(r.ads), n(r.other), n(r.tax), n(r.profit), n(r.margin), n(r.roi), n(r.breakEven), +i.units || 0, n(r.monthProfit)]);
    });
    var text = '\ufeff' + lines.map(function (l) { return l.map(function (v) { v = String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = 'tovary-unit-ekonomika.csv'; a.click();
  }

  var toastTimer;
  function toast(msg) { $('toast').textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(function () { $('toast').textContent = ''; }, 3500); }

  // Поделиться: все поля кодируются в параметры ссылки
  function shareUrl() {
    var i = read(), q = new URLSearchParams();
    q.set('mp', mp);
    FIELDS.forEach(function (f) { if (i[f] !== '') q.set(f, i[f]); });
    return location.origin + location.pathname + '?' + q.toString();
  }
  function fromUrl() {
    var q = new URLSearchParams(location.search);
    if (!q.has('mp') && !q.has('price')) return false;
    setMp(q.get('mp') === 'ozon' ? 'ozon' : 'wb', true);
    var o = {}; FIELDS.forEach(function (f) { if (q.has(f)) o[f] = q.get(f); });
    write(o); update();
    return true;
  }
  function share() {
    var url = shareUrl();
    var done = function () { toast('Ссылка на расчёт скопирована — отправьте её кому угодно'); };
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      navigator.share({ title: 'Расчёт прибыли товара', url: url }).catch(function () {});
    } else if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt('Скопируйте ссылку:', url); });
    } else { window.prompt('Скопируйте ссылку:', url); }
  }

  // Тема
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('sellerCalc.theme', t); } catch (e) {}
  }
  $('theme').onclick = function () { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); };

  // Подсказки «?»
  document.querySelectorAll('.q').forEach(function (b) {
    b.onclick = function () {
      var h = $(b.getAttribute('aria-controls')), open = h.hidden;
      h.hidden = !open; b.setAttribute('aria-expanded', open); b.classList.toggle('on', open);
    };
  });

  document.querySelectorAll('.mp-switch button').forEach(function (b) { b.onclick = function () { if (b.dataset.mp !== mp) setMp(b.dataset.mp, true); }; });
  $('form').addEventListener('input', function (e) {
    if (/^(dimL|dimW|dimH|whCoef)$/.test(e.target.id)) volume();
    if (e.target.id === 'commission') $('category').value = '';
    update();
  });
  $('form').addEventListener('change', update);
  $('category').addEventListener('change', function () {
    var c = CATS[mp][+this.value];
    if (this.value !== '' && c) {
      $('commission').value = c[1];
      $('commHint').textContent = 'Ориентир для «' + c[0] + '»' + (c[2] ? ' (верхняя граница диапазона ' + c[2] + ')' : '') + ', проверьте в ЛК — ставка зависит от конкретного предмета.';
      update();
    }
  });
  $('targetMode').onchange = function () { $('target').value = this.value === 'margin' ? 20 : 300; reverse(); };
  $('target').oninput = reverse;
  $('applyPrice').onclick = function () {
    var P = reverse(); if (!isFinite(P)) return;
    $('price').value = Math.ceil(P); update(); toast('Цена ' + rub(Math.ceil(P)) + ' подставлена в расчёт');
  };
  $('save').onclick = function () {
    var list = load(), i = read();
    if (!i.name) i.name = 'Товар ' + (list.length + 1);
    list.push({ input: i, saved: Date.now() }); store(list);
    toast('Товар «' + i.name + '» сохранён — смотрите таблицу «Мои товары»');
  };
  $('share').onclick = share;
  $('reset').onclick = function () {
    ['name','dimL','dimW','dimH'].forEach(function (f) { $(f).value = ''; }); $('whCoef').value = 170;
    setMp(mp, true);
    if (location.search) history.replaceState(null, '', location.pathname);
  };
  $('csv').onclick = csv;
  $('clear').onclick = function () { if (confirm('Удалить все сохранённые товары?')) store([]); };
  $('cmp').onclick = function (e) {
    var d = e.target.dataset;
    if (d.del !== undefined) { var l = load(); l.splice(+d.del, 1); store(l); }
    if (d.load !== undefined) { e.preventDefault(); var p = load()[+d.load].input; setMp(p.mp, false); write(p); update(); $('calc').scrollIntoView({ behavior: 'smooth' }); }
  };

  // Инициализация: ошибка в одной части (кривые параметры ссылки, недоступный localStorage)
  // не должна оставлять пустыми категории и расчёт.
  try { fillCategories(); } catch (e) { console.error(e); }
  try { if (!fromUrl()) setMp('wb', false); } catch (e) { console.error(e); try { setMp('wb', true); } catch (e2) { console.error(e2); } }
  try { renderSaved(); } catch (e) { console.error(e); }
})();

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = ['name','price','cost','commission','logistics','storage','acceptance','buyout','returnLogistics','ads','adsMode','taxMode','taxRate','other','units'];
  // Ориентировочные значения по умолчанию (не официальные тарифы!)
  var DEFAULTS = {
    wb:   { commission: 30, logistics: 80, returnLogistics: 50, storage: 10, acceptance: 20, buyout: 85,
            commHint: 'Ориентир. На WB (FBO) обычно ≈ 20–45% в зависимости от категории. Точную ставку смотрите в ЛК → «Тарифы».',
            logHint: 'Ориентир. База ≈ 46 ₽ за 1-й литр + 14 ₽ за каждый следующий, × коэффициент склада.' },
    ozon: { commission: 45, logistics: 90, returnLogistics: 90, storage: 10, acceptance: 20, buyout: 90,
            commHint: 'Ориентир. На Ozon для товаров дороже 300 ₽ обычно ≈ 40–52% по категории; для дешёвых — ниже. Сверяйте в ЛК.',
            logHint: 'Ориентир. Зависит от объёма, цены и направления; возврат обычно равен прямой логистике.' }
  };
  var TAX = { usn6: 6, npd4: 4, npd6: 6, usn15: 15 };
  var COLORS = { cost:'#8e7cc3', commission:'#e5484d', logistics:'#f5a524', storage:'#00a2c7', acceptance:'#6bc4a6', ads:'#ff7ab6', other:'#9aa0b5', tax:'#4a5568', profit:'#12a150' };
  var LABELS = { cost:'Себестоимость', commission:'Комиссия', logistics:'Логистика (с возвратами)', storage:'Хранение', acceptance:'Приёмка / упаковка', ads:'Реклама', other:'Прочее', tax:'Налог', profit:'Чистая прибыль' };
  var mp = 'wb', KEY = 'sellerCalc.products.v1';

  var rub = function (v) { return isFinite(v) ? Math.round(v).toLocaleString('ru-RU') + ' ₽' : '—'; };
  var pct = function (v) { return isFinite(v) ? v.toFixed(1).replace('.', ',') + '%' : '—'; };

  function read() { var o = { mp: mp }; FIELDS.forEach(function (f) { o[f] = $(f).value; }); return o; }
  function write(o) { FIELDS.forEach(function (f) { if (o[f] !== undefined) $(f).value = o[f]; }); }

  function setMp(m, applyDefaults) {
    mp = m; document.body.className = m;
    document.querySelectorAll('.mp-switch button').forEach(function (b) { b.classList.toggle('active', b.dataset.mp === m); });
    var d = DEFAULTS[m];
    if (applyDefaults) write(d);
    $('commHint').textContent = d.commHint; $('logHint').textContent = d.logHint;
    update();
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
    return r;
  }

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function store(list) { localStorage.setItem(KEY, JSON.stringify(list)); renderSaved(); }
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
        '<td><button class="del" data-del="' + idx + '" title="Удалить">✕</button></td></tr>';
    });
    $('cmp').innerHTML = h;
  }

  function csv() {
    var list = load(); if (!list.length) return;
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

  document.querySelectorAll('.mp-switch button').forEach(function (b) { b.onclick = function () { setMp(b.dataset.mp, true); }; });
  $('form').addEventListener('input', update); $('form').addEventListener('change', update);
  $('save').onclick = function () {
    var list = load(), i = read();
    if (!i.name) i.name = 'Товар ' + (list.length + 1);
    list.push({ input: i, saved: Date.now() }); store(list);
  };
  $('reset').onclick = function () { $('name').value = ''; setMp(mp, true); };
  $('csv').onclick = csv;
  $('clear').onclick = function () { if (confirm('Удалить все сохранённые товары?')) store([]); };
  $('cmp').onclick = function (e) {
    var d = e.target.dataset;
    if (d.del !== undefined) { var l = load(); l.splice(+d.del, 1); store(l); }
    if (d.load !== undefined) { e.preventDefault(); var p = load()[+d.load].input; setMp(p.mp, false); write(p); update(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  setMp('wb', false); renderSaved();
})();

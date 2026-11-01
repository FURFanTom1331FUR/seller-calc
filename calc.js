// Чистая логика расчёта (работает и в браузере, и в Node для тестов)
(function (root) {
  function parts(i) {
    var b = Math.min(Math.max((+i.buyout || 100) / 100, 0.01), 1);
    var c = (+i.commission || 0) / 100;
    var logistics = ((+i.logistics || 0) + (1 - b) * (+i.returnLogistics || 0)) / b; // на 1 выкупленную единицу
    var adsPct = i.adsMode === 'pct' ? (+i.ads || 0) / 100 : 0;
    var adsFix = i.adsMode === 'pct' ? 0 : (+i.ads || 0);
    var usn15 = i.taxMode === 'usn15';
    var t = usn15 ? 0.15 : (+i.taxRate || 0) / 100;
    // fixed — все расходы на единицу, не зависящие от цены
    var fixed = (+i.cost || 0) + logistics + (+i.storage || 0) + (+i.acceptance || 0) + (+i.other || 0) + adsFix;
    return { b: b, c: c, logistics: logistics, adsPct: adsPct, adsFix: adsFix, usn15: usn15, t: t, fixed: fixed };
  }

  function calc(i) {
    var p = parts(i), P = +i.price || 0;
    var commission = P * p.c, ads = p.adsFix + P * p.adsPct;
    var pre = P - commission - ads - (p.fixed - p.adsFix);
    var tax = p.usn15 ? Math.max(0, pre) * 0.15 : P * p.t;
    var profit = pre - tax;
    var k = p.usn15 ? (1 - p.c - p.adsPct) : (1 - p.c - p.adsPct - p.t);
    var breakEven = k > 0 ? p.fixed / k : Infinity;
    var units = +i.units || 0;
    return {
      revenue: P, commission: commission, logistics: p.logistics, storage: +i.storage || 0,
      acceptance: +i.acceptance || 0, ads: ads, other: +i.other || 0, cost: +i.cost || 0, tax: tax,
      profit: profit, margin: P ? profit / P * 100 : 0,
      roi: (+i.cost) ? profit / (+i.cost) * 100 : 0,
      breakEven: breakEven, monthRevenue: P * units, monthProfit: profit * units
    };
  }

  // Обратный расчёт: цена продажи, при которой прибыль = target (₽/шт) или маржа = target (%).
  // Процент комиссии/рекламы/налога считается неизменным. Возвращает Infinity, если цель недостижима.
  function priceFor(i, mode, target) {
    var p = parts(i), k1 = 1 - p.c - p.adsPct, T = +target || 0, P;
    if (mode === 'margin') {
      var m = T / 100;
      if (p.usn15) {
        // при прибыли ≥ 0: 0,85·(P·k1 − fixed) = m·P ; при убытке налог 0: P·k1 − fixed = m·P
        var d = m >= 0 ? 0.85 * k1 - m : k1 - m;
        P = d > 0 ? (m >= 0 ? 0.85 : 1) * p.fixed / d : Infinity;
      } else {
        var d2 = k1 - p.t - m;
        P = d2 > 0 ? p.fixed / d2 : Infinity;
      }
    } else {
      if (p.usn15) P = k1 > 0 ? ((T >= 0 ? T / 0.85 : T) + p.fixed) / k1 : Infinity;
      else { var k = k1 - p.t; P = k > 0 ? (T + p.fixed) / k : Infinity; }
    }
    return P >= 0 ? P : (isFinite(P) ? 0 : Infinity);
  }

  // Логистика WB по объёму (FBW/FBS, новые поставки с 15.08.2026).
  // Источники (проверено 01.11.2026): справка WB «Тарифы на логистику» (ред. 27.08.2026, 13.10.2026)
  // в пересказе plancore.ru/blog/guides/logistika-wb, aiseller.space/stati/logistika-wildberries-tarify,
  // postavleno.ru/blog/logistika-wildberries-dlya-prodavcov.
  // До 1 л — фиксированные ступени 23/26/29/30/32 ₽; свыше 1 л — 46 ₽ за первый литр + 14 ₽ за каждый
  // дополнительный. Прямая логистика = база × коэффициент склада (единый 170% для обычных товаров).
  // Обратная логистика (возврат/отказ) = база без коэффициента.
  var WB_TIERS = [[0.2, 23], [0.4, 26], [0.6, 29], [0.8, 30], [1.0, 32]];
  var WB_FIRST_L = 46, WB_EXTRA_L = 14;
  function wbLogistics(len, wid, hei, coefPct) {
    var liters = (+len || 0) * (+wid || 0) * (+hei || 0) / 1000;
    if (!(liters > 0)) return null;
    var base;
    if (liters <= 1) { for (var j = 0; j < WB_TIERS.length; j++) if (liters <= WB_TIERS[j][0] + 1e-9) { base = WB_TIERS[j][1]; break; } }
    else base = WB_FIRST_L + WB_EXTRA_L * (liters - 1);
    var coef = (coefPct === undefined || coefPct === '' ? 170 : +coefPct) / 100;
    return { liters: liters, base: base, direct: base * coef, reverse: base };
  }

  var api = { calc: calc, priceFor: priceFor, wbLogistics: wbLogistics };
  root.SellerCalc = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

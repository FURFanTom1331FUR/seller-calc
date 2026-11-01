// Чистая логика расчёта (работает и в браузере, и в Node для тестов)
(function (root) {
  function calc(i) {
    var P = +i.price || 0, b = Math.min(Math.max((+i.buyout || 100) / 100, 0.01), 1);
    var c = (+i.commission || 0) / 100;
    var logistics = ((+i.logistics || 0) + (1 - b) * (+i.returnLogistics || 0)) / b; // на 1 выкупленную единицу
    var adsPct = i.adsMode === 'pct' ? (+i.ads || 0) / 100 : 0;
    var adsFix = i.adsMode === 'pct' ? 0 : (+i.ads || 0);
    var fixed = (+i.cost || 0) + logistics + (+i.storage || 0) + (+i.acceptance || 0) + (+i.other || 0) + adsFix;
    var commission = P * c, ads = adsFix + P * adsPct;
    var pre = P - commission - ads - (fixed - adsFix);
    var t = i.taxMode === 'usn15' ? 0.15 : (+i.taxRate || 0) / 100;
    var tax = i.taxMode === 'usn15' ? Math.max(0, pre) * 0.15 : P * t;
    var profit = pre - tax;
    var k = i.taxMode === 'usn15' ? (1 - c - adsPct) : (1 - c - adsPct - t);
    var breakEven = k > 0 ? fixed / k : Infinity;
    var units = +i.units || 0;
    return {
      revenue: P, commission: commission, logistics: logistics, storage: +i.storage || 0,
      acceptance: +i.acceptance || 0, ads: ads, other: +i.other || 0, cost: +i.cost || 0, tax: tax,
      profit: profit, margin: P ? profit / P * 100 : 0,
      roi: (+i.cost) ? profit / (+i.cost) * 100 : 0,
      breakEven: breakEven, monthRevenue: P * units, monthProfit: profit * units
    };
  }
  root.SellerCalc = { calc: calc };
  if (typeof module !== 'undefined') module.exports = { calc: calc };
})(typeof window !== 'undefined' ? window : globalThis);

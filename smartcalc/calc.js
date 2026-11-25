/* SMARTCALC — static policy calculators for GitHub Pages.
 *
 * Pure logic, no DOM, no network, no external library. This file mirrors
 * code/r2/interactive_widgets.py::compute_smart_policy exactly: the same
 * tables, the same rules, the same snapping behaviour. The unit vectors in
 * test_calc.js must match tests/test_smart_policy.py case for case.
 *
 * Sources (see SOURCES.md next to this file):
 * - Housing pension: Korea Housing Finance Corporation monthly payment
 *   examples, 2026-03-01 basis (Tistory post 404 / B384).
 * - Parental leave 6+6: 고용24 육아휴직급여 제도안내 (2026-11-23).
 * - Health out-of-pocket cap: NHIS 2025 notice (2025-01-07).
 */
(function (root) {
  "use strict";

  var HF_ROWS = [55, 60, 65, 70, 75, 80];
  var HF_COLS = [100000000, 300000000, 500000000, 1200000000];
  var HF_VALUES = [
    [156000, 468000, 780000, 1872000],
    [210000, 632000, 1053000, 2528000],
    [252000, 758000, 1264000, 3035000],
    [307000, 923000, 1539000, 3414000],
    [381000, 1143000, 1906000, 3666000],
    [483000, 1449000, 2416000, 4060000]
  ];
  // Monthly-payment caps stated explicitly in post 404. No cap is claimed
  // for ages 55/60/65 because the source states none for those rows.
  var HF_ROW_CAPS = { 70: 3414000, 75: 3666000, 80: 4060000 };

  var PARENTAL_66 = [
    { rate: 1.0, cap: 2500000 }, { rate: 1.0, cap: 2500000 },
    { rate: 1.0, cap: 3000000 }, { rate: 1.0, cap: 3500000 },
    { rate: 1.0, cap: 4000000 }, { rate: 1.0, cap: 4500000 },
    { rate: 0.8, cap: 1600000, repeat: true }
  ];
  var PARENTAL_GENERAL = [
    { rate: 0.8, cap: 2500000 }, { rate: 0.8, cap: 2500000 },
    { rate: 0.8, cap: 2500000 }, { rate: 0.8, cap: 2000000 },
    { rate: 0.8, cap: 2000000 }, { rate: 0.8, cap: 2000000 },
    { rate: 0.8, cap: 1600000, repeat: true }
  ];

  // [top decile, general cap, long-term-care-hospital (120+ days) cap]
  var NHIS_BRACKETS = [
    [1, 890000, 1410000],
    [3, 1100000, 1780000],
    [5, 1700000, 2400000],
    [7, 3200000, 3960000],
    [8, 4370000, 5690000],
    [9, 5250000, 6840000],
    [10, 8260000, 10740000]
  ];

  function nearestIndex(value, grid) {
    // Same tie-break as Python: min by (abs diff, index) -> lowest index.
    var best = 0;
    for (var i = 1; i < grid.length; i++) {
      if (Math.abs(grid[i] - value) < Math.abs(grid[best] - value)) best = i;
    }
    return best;
  }

  function fmtKRW(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "원";
  }

  function fmtCompact(n) {
    if (n >= 100000000) {
      var eok = Math.floor(n / 100000000);
      var man = Math.round((n % 100000000) / 10000);
      return man ? eok + "억 " + man + "만" : eok + "억";
    }
    if (n >= 10000) return Math.round(n / 10000) + "만";
    return String(Math.round(n));
  }

  function computeHousingPension(age, declaredPrice, housePrice) {
    age = Math.max(0, Number(age) || 0);
    declaredPrice = Math.max(0, Number(declaredPrice) || 0);
    housePrice = Math.max(0, Number(housePrice) || 0);
    if (age < 55) {
      return { eligible: false,
        failReason: "만 55세 미만은 주택연금 가입이 불가합니다.",
        alternative: "부부 중 1명만 만 55세 이상이면 가입할 수 있습니다. 55세가 되는 해에 다시 확인하세요." };
    }
    if (declaredPrice > 1200000000) {
      return { eligible: false,
        failReason: "부부합산 공시가격 12억 원 초과 주택은 주택연금 가입이 불가합니다.",
        alternative: "2주택자는 비거주 주택을 3년 이내에 처분한다는 조건부 약정을 맺으면 가입이 가능합니다. 가입 여부는 공시가격이 갈라줍니다." };
    }
    var rowI = nearestIndex(age, HF_ROWS);
    var colI = nearestIndex(housePrice, HF_COLS);
    var row = HF_ROWS[rowI];
    var col = HF_COLS[colI];
    var monthly = HF_VALUES[rowI][colI];
    var snapped = (row !== age || col !== housePrice);
    var applied = [];
    var cap = HF_ROW_CAPS[row];
    if (cap !== undefined && monthly >= cap) {
      applied.push("월지급금 상한 " + fmtKRW(cap) + " 적용 — 집값이 더 올라도 이 금액을 넘지 않습니다.");
    }
    applied.push("적용 구간: " + row + "세 · " + fmtCompact(col) + " 기준 표 값");
    var fee = Math.round(housePrice * 0.01);
    applied.push("초기보증료(가입 시 1회) " + fmtKRW(fee) + "(기준 금액의 1%)");
    return {
      eligible: true, monthly: monthly, fee: fee, applied: applied,
      snapped: snapped,
      snapNote: snapped
        ? "예시표에 없는 구간이라 가장 가까운 표 값(" + row + "세 · " + fmtCompact(col) + ")을 보여줍니다. 정확한 금액은 출처 표에서 직접 확인하세요."
        : null,
      caution: "종신지급방식 정액형 기준. 가입 후 집값이 올라도 월 수령액은 그대로입니다."
    };
  }

  function periodForMonth(periods, month) {
    if (month <= periods.length) return periods[month - 1];
    for (var i = periods.length - 1; i >= 0; i--) {
      if (periods[i].repeat) return periods[i];
    }
    return periods[periods.length - 1];
  }

  function computeParentalLeave(wage, months, bothParents) {
    wage = Math.max(0, Number(wage) || 0);
    months = Math.max(1, Math.round(Number(months) || 1));
    var periods = bothParents ? PARENTAL_66 : PARENTAL_GENERAL;
    var rows = [];
    var total = 0;
    for (var m = 1; m <= months; m++) {
      var p = periodForMonth(periods, m);
      var pay = Math.round(Math.min(wage * p.rate, p.cap));
      total += pay;
      rows.push({ label: m + "개월차", value: pay });
    }
    var applied = [];
    var first = periods[0];
    applied.push((bothParents ? "6+6 특례" : "일반 규정") + " 적용: 통상임금 " +
      Math.round(first.rate * 100) + "% 지급, 월 상한 " + fmtKRW(first.cap) + "부터 시작");
    var tailStart = periods.length - (periods[periods.length - 1].repeat ? 1 : 0) + 1;
    if (months >= tailStart) {
      var tail = periods[periods.length - 1];
      applied.push(tailStart + "개월째부터 통상임금 " + Math.round(tail.rate * 100) +
        "%, 월 상한 " + fmtKRW(tail.cap));
    }
    applied.push("합계 " + months + "개월분");
    return {
      eligible: true, total: total, rows: rows, applied: applied,
      fallbackNote: bothParents ? null :
        "6+6 특례는 자녀 생후 18개월 안에 부모 모두가 육아휴직을 사용할 때만 적용됩니다. " +
        "한쪽만 사용하면 일반 규정 상한(1~3개월 250만 원, 4~6개월 200만 원, 7개월~ 160만 원, 통상임금 80%)으로 계산합니다.",
      caution: "상한과 지급률의 기준이 되는 통상임금은 육아휴직 시작일 기준으로 정해집니다."
    };
  }

  function computeHealthCap(decile, annualPaid, longterm) {
    decile = Math.max(1, Math.min(10, Math.round(Number(decile) || 1)));
    annualPaid = Math.max(0, Number(annualPaid) || 0);
    var cap = NHIS_BRACKETS[NHIS_BRACKETS.length - 1][longterm ? 2 : 1];
    for (var i = 0; i < NHIS_BRACKETS.length; i++) {
      if (decile <= NHIS_BRACKETS[i][0]) {
        cap = NHIS_BRACKETS[i][longterm ? 2 : 1];
        break;
      }
    }
    var refund = Math.max(0, annualPaid - cap);
    var actual = Math.min(annualPaid, cap);
    var kind = longterm ? "요양병원 120일 초과 입원" : "일반";
    return {
      eligible: true, refund: refund, actual: actual, cap: cap,
      applied: [
        decile + "분위 " + kind + " 상한액 " + fmtKRW(cap) + " 적용",
        "연간 본인부담금 " + fmtKRW(annualPaid) + " 중 실부담 " + fmtKRW(actual)
      ],
      rows: [
        { label: "연간 본인부담금", value: annualPaid },
        { label: "상한액", value: cap },
        { label: "실부담액", value: actual },
        { label: "환급금", value: refund }
      ],
      caution: "개인별 상한액은 연평균 건강보험료를 기준으로 공단이 확정합니다. 정확한 환급 대상 여부는 국민건강보험공단에서 조회하세요."
    };
  }

  var api = {
    HF_ROWS: HF_ROWS, HF_COLS: HF_COLS, HF_VALUES: HF_VALUES,
    NHIS_BRACKETS: NHIS_BRACKETS,
    computeHousingPension: computeHousingPension,
    computeParentalLeave: computeParentalLeave,
    computeHealthCap: computeHealthCap,
    fmtKRW: fmtKRW, fmtCompact: fmtCompact
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SMARTCALC = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

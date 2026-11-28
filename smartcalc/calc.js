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
 * - Bonus withholding: 소득세법 시행령 별표 2 간이세액표
 *   <개정 2026. 2. 27.> (law.go.kr flSeq=169813489) + 소득세법
 *   제136조 5단계; health premium cap/floor per MOHW 고시
 *   (2026-01-01, monthly total 9,183,480원 / 20,160원).
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
  function fmtUSD(n) {
    return "$" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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


  // Simplified withholding table (간이세액표), 2026. Source: 소득세법 시행령
  // 별표 2 <개정 2026. 2. 27.> (law.go.kr flSeq=169813489), 공제대상가족 1명
  // (본인만) column. Rows: [770, 1500)천원 in 5천원 steps (146 rows),
  // [1500, 3000)천원 in 10천원 steps (150 rows), [3000, 10000)천원 in
  // 20천원 steps (350 rows) — 646 rows total. Above 10,000천원 the 별표's
  // own formula tiers apply (BONUS_OVER_10M). Never interpolate.
  var BONUS_TABLE_2026 = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 1040, 1110,
  1180, 1250, 1320, 1390, 1460, 1530, 1600, 1670, 1740, 1810,
  1880, 1950, 2020, 2090, 2160, 2230, 2300, 2370, 2440, 2500,
  2570, 2640, 2710, 2780, 2850, 2920, 2990, 3060, 3130, 3200,
  3270, 3340, 3410, 3480, 3550, 3620, 3700, 3810, 3910, 4010,
  4120, 4220, 4320, 4430, 4530, 4630, 4740, 4840, 4940, 5050,
  5150, 5250, 5360, 5460, 5560, 5670, 5770, 5870, 5980, 6080,
  6180, 6290, 6390, 6490, 6600, 6700, 6800, 6910, 7010, 7110,
  7210, 7320, 7420, 7520, 7630, 7730, 7830, 7940, 8040, 8140,
  8250, 8350, 8450, 8560, 8660, 8760, 8920, 9120, 9330, 9540,
  9740, 9950, 10160, 10360, 10570, 10780, 10980, 11190, 11400, 11600,
  11810, 12020, 12220, 12430, 12640, 12840, 13050, 13260, 13460, 13670,
  13880, 14080, 14290, 14500, 14700, 14910, 15110, 15320, 15530, 15730,
  15940, 16150, 16350, 16560, 16770, 16970, 17180, 17390, 17590, 17800,
  18010, 18210, 18420, 18630, 18880, 19200, 19520, 19850, 20170, 20490,
  20810, 21130, 21450, 21770, 22090, 22420, 22740, 23060, 23380, 23700,
  24020, 24340, 24660, 24990, 25310, 25630, 25950, 26270, 26590, 26910,
  27240, 27560, 27880, 28200, 28520, 28840, 29160, 29480, 29810, 30130,
  30450, 30770, 31090, 31410, 31730, 32050, 32380, 32700, 33020, 33340,
  33660, 33980, 34300, 34630, 34950, 35270, 35600, 35940, 36280, 36630,
  36970, 37310, 37650, 38000, 38340, 38830, 39690, 40540, 41400, 42260,
  43110, 43970, 44820, 45680, 46540, 47390, 48250, 49100, 49960, 50810,
  51670, 52530, 53380, 54240, 55090, 55950, 56800, 57660, 58520, 59370,
  60230, 61080, 61940, 62790, 63650, 64510, 65360, 66220, 67070, 67930,
  68780, 69640, 70500, 71350, 72210, 73060, 74350, 76060, 77770, 79480,
  81190, 82900, 84620, 86330, 88040, 89750, 91460, 93170, 95430, 97880,
  100320, 102770, 105210, 107660, 110100, 112550, 114990, 117440, 119880, 122330,
  124770, 127220, 129660, 132110, 134550, 137000, 139440, 141890, 144330, 146780,
  149220, 151670, 154110, 156560, 163920, 166590, 169260, 171930, 174600, 177270,
  179940, 182610, 185280, 187950, 190620, 193290, 195960, 198630, 201300, 203970,
  206640, 209310, 211980, 214650, 217320, 219990, 222660, 225330, 228000, 230670,
  233340, 236010, 238680, 241350, 244020, 246690, 249360, 252030, 254700, 257370,
  260040, 262840, 265650, 268450, 271260, 276560, 279370, 282170, 284980, 287780,
  290590, 293390, 296200, 299000, 301810, 304610, 307420, 310220, 313030, 315830,
  318640, 321440, 324250, 327050, 329860, 332660, 335470, 338270, 341080, 343880,
  346690, 349490, 352300, 355100, 357910, 360710, 363520, 366320, 369130, 371930,
  374740, 377540, 380350, 383150, 385960, 388760, 391570, 394370, 397180, 399980,
  402790, 405590, 408400, 411200, 414010, 416810, 419620, 422420, 425230, 428030,
  430840, 433640, 436450, 439250, 442060, 444860, 447670, 450470, 470380, 475720,
  478690, 483220, 487760, 492300, 496830, 501370, 505900, 510440, 514980, 519510,
  524050, 528580, 533120, 537660, 542190, 546730, 551260, 555800, 560340, 564870,
  569410, 573940, 578480, 583020, 587550, 592090, 596620, 601160, 605700, 610230,
  614770, 619300, 623840, 628380, 632910, 637450, 641980, 646520, 651060, 655590,
  660130, 664660, 669200, 673740, 678270, 682810, 687340, 691880, 696420, 700950,
  705490, 710020, 714560, 719100, 723630, 728170, 732700, 737240, 741780, 746310,
  750850, 755380, 759920, 764460, 768990, 773530, 778060, 782600, 787140, 791670,
  796210, 800740, 805280, 809820, 814350, 818890, 823420, 827960, 832500, 837030,
  841570, 846100, 850640, 855180, 859710, 864250, 868780, 873320, 877860, 882390,
  886930, 891460, 896000, 900540, 905070, 909610, 914140, 918680, 923220, 927750,
  932290, 936820, 941360, 945900, 950430, 954970, 959500, 964040, 968580, 973110,
  977650, 982180, 986720, 991260, 995790, 1000330, 1004860, 1009400, 1013940, 1018470,
  1023010, 1027540, 1032080, 1036740, 1041420, 1046100, 1050780, 1055460, 1060140, 1064820,
  1069500, 1074180, 1078860, 1083540, 1088220, 1092900, 1097580, 1102260, 1106940, 1111620,
  1116300, 1120980, 1125660, 1130340, 1135020, 1139700, 1144380, 1149060, 1153740, 1158420,
  1163100, 1167780, 1172460, 1177140, 1181820, 1186500, 1191180, 1195860, 1200540, 1205220,
  1209900, 1214580, 1219260, 1223940, 1228620, 1233300, 1237980, 1244640, 1251470, 1258290,
  1265120, 1271940, 1278770, 1285590, 1292420, 1299240, 1306070, 1312890, 1319720, 1326540,
  1333370, 1340190, 1347020, 1353840, 1360670, 1367490, 1374320, 1381140, 1387970, 1394790,
  1401620, 1408440, 1415270, 1422090, 1428920, 1435740, 1442570, 1449390, 1456220, 1463040,
  1469870, 1476690, 1483520, 1490340, 1497170, 1503990,
  ];
  // Above 10,000천원: [lower, upper, fixed won, rate %, apply 98% first].
  // "10,000천원인 경우의 해당 세액" is 1,507,400원 (1명). Tiers are
  // continuous at every boundary.
  var BONUS_BASE_10M = 1507400;
  var BONUS_OVER_10M = [
    [10000000, 14000000, 25000, 35, true],
    [14000000, 28000000, 1397000, 38, true],
    [28000000, 30000000, 6610600, 40, true],
    [30000000, 45000000, 7394600, 40, false],
    [45000000, 87000000, 13394600, 42, false],
    [87000000, Infinity, 31034600, 45, false]
  ];
  // 2026 rates (employee share). Health 7.19% total; long-term care is
  // 13.14% of the health premium; employment insurance 0.9%; local income
  // tax is 10% of income tax. Health premium cap/floor (MOHW 고시,
  // 2026-01-01): monthly total 9,183,480원 / 20,160원.
  var BONUS_HEALTH_RATE = 0.0719;
  var BONUS_LTC_RATE = 0.1314;
  var BONUS_EI_RATE = 0.009;
  var BONUS_LOCAL_RATE = 0.10;
  var BONUS_HEALTH_MONTHLY_CAP = 9183480;
  var BONUS_HEALTH_MONTHLY_FLOOR = 20160;

  function roundWon(n) { return Math.floor(n + 0.5); }

  function lookupBonusMonthly(monthlyPay) {
    var amount = roundWon(monthlyPay);
    if (amount < 770000) return 0;
    if (amount < 1500000) return BONUS_TABLE_2026[Math.floor((amount - 770000) / 5000)];
    if (amount < 3000000) return BONUS_TABLE_2026[146 + Math.floor((amount - 1500000) / 10000)];
    if (amount < 10000000) return BONUS_TABLE_2026[296 + Math.floor((amount - 3000000) / 20000)];
    if (amount === 10000000) return BONUS_BASE_10M;
    for (var i = 0; i < BONUS_OVER_10M.length; i++) {
      var t = BONUS_OVER_10M[i];
      if (amount <= t[1]) {
        var excess = amount - t[0];
        var add = t[4]
          ? Math.floor((excess * 98 * t[3] + 5000) / 10000)
          : Math.floor((excess * t[3] + 50) / 100);
        return BONUS_BASE_10M + t[2] + add;
      }
    }
    return BONUS_BASE_10M; // unreachable: last tier is unbounded
  }

  function bonusHealthSettlement(monthlySalary, bonus) {
    var annualTotalPay = monthlySalary * 12 + bonus;
    var annualPremium = Math.min(
      Math.max(annualTotalPay * BONUS_HEALTH_RATE, 12 * BONUS_HEALTH_MONTHLY_FLOOR),
      12 * BONUS_HEALTH_MONTHLY_CAP);
    var monthlyPremium = Math.min(
      Math.max(monthlySalary * BONUS_HEALTH_RATE, BONUS_HEALTH_MONTHLY_FLOOR),
      BONUS_HEALTH_MONTHLY_CAP);
    var paid = 12 * monthlyPremium;
    var settlementTotal = annualPremium - paid;
    var capped = annualTotalPay * BONUS_HEALTH_RATE > 12 * BONUS_HEALTH_MONTHLY_CAP ||
      monthlySalary * BONUS_HEALTH_RATE > BONUS_HEALTH_MONTHLY_CAP;
    var health = roundWon(settlementTotal / 2);
    var ltc = roundWon(health * BONUS_LTC_RATE);
    return { health: health, ltc: ltc, total: health + ltc, capped: capped };
  }

  function computeBonusWithholding(monthlySalary, bonus, months, payMonth) {
    monthlySalary = Math.max(0, Number(monthlySalary) || 0);
    bonus = Math.max(0, Number(bonus) || 0);
    months = Math.max(1, Math.min(12, Math.round(Number(months) || 0)));
    payMonth = (payMonth === 1 || payMonth === "1") ? 1 : 12;
    var monthlyBonus = bonus / months;
    var combined = roundWon(monthlySalary + monthlyBonus);
    var tableCombined = lookupBonusMonthly(combined);
    var tableMonthly = lookupBonusMonthly(monthlySalary);
    var step4 = tableCombined * months;
    var step5 = tableMonthly * months;
    var withholding = Math.max(0, step4 - step5);
    var localTax = roundWon(withholding * BONUS_LOCAL_RATE);
    var ei = roundWon(bonus * BONUS_EI_RATE);
    var immediate = withholding + localTax + ei;
    var hs = bonusHealthSettlement(monthlySalary, bonus);
    var altMonth = payMonth === 12 ? 1 : 12;
    var altMonths = altMonth === 1 ? 1 : 12;
    var altWithholding = Math.max(0,
      lookupBonusMonthly(roundWon(monthlySalary + bonus / altMonths)) * altMonths -
      tableMonthly * altMonths);
    var altDiff = altWithholding - withholding;
    var settleYear = payMonth === 12 ? "다음 해 4월" : "다다음 해 4월";
    var altYear = payMonth === 12 ? "다다음 해 4월" : "다음 해 4월";
    var applied = [];
    applied.push("5단계 계산: 상여금 " + fmtKRW(bonus) + " ÷ " + months + "개월 = 월 " +
      fmtKRW(roundWon(monthlyBonus)) + " → 월급과 합산 " + fmtKRW(combined) +
      " → 간이세액표 " + fmtKRW(tableCombined) + " × " + months + "개월 = " +
      fmtKRW(step4) + " → 월급분 " + fmtKRW(step5) + " 차감 → 원천징수 " + fmtKRW(withholding));
    applied.push("지금 떼이는 돈 " + fmtKRW(immediate) + " = 소득세 " + fmtKRW(withholding) +
      " + 지방소득세 " + fmtKRW(localTax) + " + 고용보험료 " + fmtKRW(ei));
    var healthLine = settleYear + " 건보 정산 " + fmtKRW(hs.total) + "(건강 " + fmtKRW(hs.health) +
      " + 장기요양 " + fmtKRW(hs.ltc) + ")";
    if (hs.capped) {
      healthLine += " — 보수월액 상한(월 보험료 9,183,480원) 적용으로 상여금 일부는 정산 대상에서 제외됩니다";
    }
    var compare;
    if (altDiff > 0) {
      compare = altMonth + "월에 받으면 원천징수 " + fmtKRW(altWithholding) + "으로 " +
        fmtKRW(altDiff) + " 더 떼이고, 건보 정산은 " + altYear + "로 미뤄집니다";
    } else if (altDiff < 0) {
      compare = altMonth + "월에 받으면 원천징수 " + fmtKRW(altWithholding) + "으로 " +
        fmtKRW(-altDiff) + " 덜 떼이고, 건보 정산은 " + altYear + "로 당겨집니다";
    } else {
      compare = altMonth + "월에 받아도 원천징수는 같습니다";
    }
    applied.push(healthLine + " · " + compare);
    return {
      eligible: true, withholding: withholding, localTax: localTax,
      employmentInsurance: ei, immediateTotal: immediate,
      health: hs.health, ltc: hs.ltc, healthTotal: hs.total, capped: hs.capped,
      altWithholding: altWithholding, altDiff: altDiff, applied: applied,
      rows: [
        { label: "1단계 상여금 월 환산", value: roundWon(monthlyBonus) },
        { label: "2단계 합산 월급여액", value: combined },
        { label: "3단계 간이세액표 세액", value: tableCombined },
        { label: "4단계 기간 곱", value: step4 },
        { label: "5단계 월급분 차감", value: step5 },
        { label: "원천징수 소득세", value: withholding },
        { label: "지방소득세(소득세의 10%)", value: localTax },
        { label: "고용보험료(상여금의 0.9%)", value: ei },
        { label: "지금 떼이는 돈 합계", value: immediate },
        { label: settleYear + " 건강보험 정산", value: hs.health },
        { label: "장기요양보험료", value: hs.ltc },
        { label: "4월 정산 합계", value: hs.total },
        { label: altMonth + "월 지급 시 원천징수", value: altWithholding },
        { label: "12월 vs 1월 원천징수 차이", value: altDiff }
      ],
      caution: "국민연금 보험료는 상여금 지급 달에 변동이 없습니다. 늘어난 소득은 다음 해 7월 기준소득월액 재산정 때 반영됩니다(2026년 7월~2027년 6월 기준 상한 659만 원·하한 41만 원). 원천징수는 선납 성격이라 최종 세액은 연말정산 때 1년 총급여 기준으로 확정됩니다."
    };
  }

  // =================================================================
  // Universal declarative calculator engine — schema "calc_spec/v1"
  // =================================================================
  // A spec is data, never code: no eval, no Function, and no property
  // path is ever taken from the spec. Every operation is on the
  // whitelist below; an unknown op, table, variable or malformed node
  // throws, so a broken spec can never render a partly-wrong number.
  //
  // Spec shape:
  //   { schema, id, title, description, footnote,
  //     inputs: [{key,type:number|select|toggle,label,default,min,max,step,hint,options}],
  //     eligibility_gates: [{id,when,reason,alternative}],
  //     tables: {name: map | grid | brackets},
  //     steps: {name: node},            // evaluated in key order
  //     outputs: {headline:{label,value,format}, rows:[{label,value,format}],
  //               applied:[{when,text}], caution:{when,text}},
  //     test_vectors: [{name,inputs,expect}] }
  //
  // Node shapes: {op:"const",value} | {op:"var",name} |
  //   {op:"add|sub|mul|div|pow|lt|le|gt|ge|eq|ne",left,right} |
  //   {op:"min|max|and|or",values:[...]} | {op:"not|round|floor|ceil|abs|neg",value} |
  //   {op:"if",cond,then,else} | {op:"lookup",table,key} |
  //   {op:"lookup2",table,row,col} | {op:"bracket",table,value} |
  //   {op:"clamp",value,min,max}
  var SPEC_SCHEMA = "calc_spec/v1";
  var SPEC_INPUT_TYPES = ["number", "select", "toggle"];
  var SPEC_OPS = {
    const: 1, var: 1, add: 1, sub: 1, mul: 1, div: 1, pow: 1,
    lt: 1, le: 1, gt: 1, ge: 1, eq: 1, ne: 1,
    min: 1, max: 1, and: 1, or: 1,
    not: 1, round: 1, floor: 1, ceil: 1, abs: 1, neg: 1,
    if: 1, lookup: 1, lookup2: 1, bracket: 1, clamp: 1
  };
  var SPEC_BINARY = { add: 1, sub: 1, mul: 1, div: 1, pow: 1, lt: 1, le: 1, gt: 1, ge: 1, eq: 1, ne: 1 };
  var SPEC_LIST = { min: 1, max: 1, and: 1, or: 1 };
  var SPEC_UNARY = { not: 1, round: 1, floor: 1, ceil: 1, abs: 1, neg: 1 };
  var SPEC_NAME_RE = /^[a-z][a-z0-9_]{0,30}$/;

  function specError(msg) {
    var e = new Error("CALC_SPEC: " + msg);
    e.name = "SpecError";
    return e;
  }
  function specIsObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function specIsNum(v) { return typeof v === "number" && isFinite(v); }
  function specHas(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function specRound(n) {
    return n < 0 ? -Math.floor(-n + 0.5) : Math.floor(n + 0.5);
  }
  function specNum(v, op) {
    if (!specIsNum(v)) throw specError(op + " needs numbers");
    return v;
  }
  function specBool(v, op) {
    if (typeof v !== "boolean") throw specError(op + " needs a true/false value");
    return v;
  }
  function specPct(v) {
    var p = Math.round(v * 1000000) / 10000;
    return String(p);
  }

  function specTable(spec, name) {
    var tables = spec.tables || {};
    if (typeof name !== "string" || !specHas(tables, name)) {
      throw specError("unknown table: " + name);
    }
    return tables[name];
  }

  function validateSpecTable(name, t) {
    if (!specIsObj(t)) throw specError("table " + name + " must be an object");
    if (t.type === "map") {
      if (!specIsObj(t.rows) || !Object.keys(t.rows).length) throw specError("map table " + name + " needs rows");
      Object.keys(t.rows).forEach(function (k) {
        if (!specIsNum(t.rows[k]) && typeof t.rows[k] !== "boolean" && typeof t.rows[k] !== "string") {
          throw specError("map table " + name + " row " + k + " must be a number, boolean or string");
        }
      });
      if (specHas(t, "default") && !specIsNum(t["default"]) && typeof t["default"] !== "boolean" && typeof t["default"] !== "string") {
        throw specError("map table " + name + " default has a bad type");
      }
    } else if (t.type === "grid") {
      if (!Array.isArray(t.rows) || !Array.isArray(t.cols) || !Array.isArray(t.values)) throw specError("grid table " + name + " needs rows, cols, values");
      if (!t.rows.length || !t.cols.length) throw specError("grid table " + name + " is empty");
      if (t.values.length !== t.rows.length) throw specError("grid table " + name + " row count mismatch");
      t.values.forEach(function (r) {
        if (!Array.isArray(r) || r.length !== t.cols.length) throw specError("grid table " + name + " column count mismatch");
        r.forEach(function (v) { if (!specIsNum(v)) throw specError("grid table " + name + " holds a non-number"); });
      });
    } else if (t.type === "brackets") {
      if (!Array.isArray(t.rows) || !t.rows.length) throw specError("brackets table " + name + " needs rows");
      var prev = 0;
      t.rows.forEach(function (r, i) {
        if (!specIsObj(r)) throw specError("brackets table " + name + " row " + i + " must be an object");
        if (r.up_to !== null && !specIsNum(r.up_to)) throw specError("brackets table " + name + " row " + i + " needs up_to (number or null)");
        if (!specIsNum(r.fixed)) throw specError("brackets table " + name + " row " + i + " needs fixed");
        if (!specIsNum(r.rate)) throw specError("brackets table " + name + " row " + i + " needs rate");
        if (i > 0 && r.up_to !== null && r.up_to <= prev) throw specError("brackets table " + name + " rows must ascend");
        if (r.up_to === null && i !== t.rows.length - 1) throw specError("brackets table " + name + " open row must be last");
        if (r.up_to !== null) prev = r.up_to;
      });
    } else {
      throw specError("table " + name + " has unknown type " + t.type);
    }
  }

  function validateSpecNode(node, names, spec, where) {
    if (!specIsObj(node)) throw specError("node must be an object at " + where);
    var op = node.op;
    if (typeof op !== "string" || !specHas(SPEC_OPS, op)) throw specError("unknown op at " + where + ": " + op);
    if (op === "const") {
      if (!specIsNum(node.value) && typeof node.value !== "boolean" && typeof node.value !== "string") {
        throw specError("const value must be a number, boolean or string at " + where);
      }
      return;
    }
    if (op === "var") {
      if (typeof node.name !== "string" || !specHas(names, node.name)) {
        throw specError("unknown variable at " + where + ": " + node.name);
      }
      return;
    }
    if (specHas(SPEC_BINARY, op)) {
      validateSpecNode(node.left, names, spec, where + ".left");
      validateSpecNode(node.right, names, spec, where + ".right");
      return;
    }
    if (specHas(SPEC_LIST, op)) {
      if (!Array.isArray(node.values) || !node.values.length) throw specError(op + " needs a non-empty values array at " + where);
      node.values.forEach(function (v, i) { validateSpecNode(v, names, spec, where + ".values[" + i + "]"); });
      return;
    }
    if (specHas(SPEC_UNARY, op)) {
      validateSpecNode(node.value, names, spec, where + ".value");
      return;
    }
    if (op === "if") {
      validateSpecNode(node.cond, names, spec, where + ".cond");
      validateSpecNode(node.then, names, spec, where + ".then");
      validateSpecNode(node["else"], names, spec, where + ".else");
      return;
    }
    if (op === "lookup" || op === "lookup2" || op === "bracket") {
      var t = specTable(spec, node.table);
      if (op === "lookup" && t.type !== "map") throw specError("lookup needs a map table at " + where);
      if (op === "lookup2" && t.type !== "grid") throw specError("lookup2 needs a grid table at " + where);
      if (op === "bracket" && t.type !== "brackets") throw specError("bracket needs a brackets table at " + where);
      if (op === "lookup") validateSpecNode(node.key, names, spec, where + ".key");
      if (op === "lookup2") {
        validateSpecNode(node.row, names, spec, where + ".row");
        validateSpecNode(node.col, names, spec, where + ".col");
      }
      if (op === "bracket") validateSpecNode(node.value, names, spec, where + ".value");
      return;
    }
    if (op === "clamp") {
      validateSpecNode(node.value, names, spec, where + ".value");
      if (node.min !== undefined) validateSpecNode(node.min, names, spec, where + ".min");
      if (node.max !== undefined) validateSpecNode(node.max, names, spec, where + ".max");
    }
  }

  function validateSpec(spec) {
    if (!specIsObj(spec)) throw specError("spec must be an object");
    if (spec.schema !== SPEC_SCHEMA) throw specError("schema must be " + SPEC_SCHEMA);
    if (typeof spec.id !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(spec.id)) throw specError("id must be 1-16 letters/digits");
    if (typeof spec.title !== "string" || !spec.title) throw specError("title is required");
    if (!Array.isArray(spec.inputs) || !spec.inputs.length) throw specError("inputs are required");
    var names = {};
    spec.inputs.forEach(function (inp, i) {
      if (!specIsObj(inp)) throw specError("input " + i + " must be an object");
      if (typeof inp.key !== "string" || !SPEC_NAME_RE.test(inp.key)) throw specError("bad input key at input " + i);
      if (specHas(names, inp.key)) throw specError("duplicate input key " + inp.key);
      names[inp.key] = true;
      if (SPEC_INPUT_TYPES.indexOf(inp.type) < 0) throw specError("bad input type for " + inp.key);
      if (typeof inp.label !== "string" || !inp.label) throw specError("input label required: " + inp.key);
      if (inp.type === "select") {
        if (!Array.isArray(inp.options) || inp.options.length < 2) throw specError("select needs 2+ options: " + inp.key);
        var seen = {};
        inp.options.forEach(function (o) {
          if (!specIsObj(o) || typeof o.value !== "string" || !o.value) throw specError("bad option value in " + inp.key);
          if (typeof o.label !== "string" || !o.label) throw specError("bad option label in " + inp.key);
          if (specHas(seen, o.value)) throw specError("duplicate option " + o.value + " in " + inp.key);
          seen[o.value] = true;
        });
        if (typeof inp["default"] !== "string" || !specHas(seen, inp["default"])) throw specError("select default is not an option: " + inp.key);
      } else if (inp.type === "number") {
        if (!specIsNum(inp["default"])) throw specError("number default required: " + inp.key);
        if (inp.min !== undefined && !specIsNum(inp.min)) throw specError("bad min for " + inp.key);
        if (inp.max !== undefined && !specIsNum(inp.max)) throw specError("bad max for " + inp.key);
        if (inp.min !== undefined && inp["default"] < inp.min) throw specError("default below min: " + inp.key);
        if (inp.max !== undefined && inp["default"] > inp.max) throw specError("default above max: " + inp.key);
      } else if (typeof inp["default"] !== "boolean") {
        throw specError("toggle default must be true/false: " + inp.key);
      }
    });

    var tables = spec.tables || {};
    Object.keys(tables).forEach(function (name) { validateSpecTable(name, tables[name]); });

    (spec.eligibility_gates || []).forEach(function (g, i) {
      if (!specIsObj(g)) throw specError("gate " + i + " must be an object");
      if (typeof g.id !== "string" || !SPEC_NAME_RE.test(g.id)) throw specError("bad gate id at gate " + i);
      if (typeof g.reason !== "string" || !g.reason) throw specError("gate " + g.id + " needs a reason");
      if (g.alternative !== undefined && typeof g.alternative !== "string") throw specError("gate " + g.id + " alternative must be text");
      validateSpecNode(g.when, names, spec, "gate." + g.id + ".when");
    });

    var steps = spec.steps || {};
    Object.keys(steps).forEach(function (name) {
      if (!SPEC_NAME_RE.test(name)) throw specError("bad step name: " + name);
      if (specHas(names, name)) throw specError("step name clashes with an input: " + name);
      validateSpecNode(steps[name], names, spec, "steps." + name);
      names[name] = true;
    });

    if (!specIsObj(spec.outputs) || !specIsObj(spec.outputs.headline)) throw specError("outputs.headline is required");
    if (typeof spec.outputs.headline.label !== "string" || !spec.outputs.headline.label) throw specError("headline label is required");
    validateSpecNode(spec.outputs.headline.value, names, spec, "outputs.headline.value");
    (spec.outputs.rows || []).forEach(function (r, i) {
      if (!specIsObj(r) || typeof r.label !== "string" || !r.label) throw specError("row " + i + " needs a label");
      validateSpecNode(r.value, names, spec, "outputs.rows[" + i + "].value");
    });
    (spec.outputs.applied || []).forEach(function (a, i) {
      if (!specIsObj(a) || typeof a.text !== "string" || !a.text) throw specError("applied " + i + " needs text");
      if (a.when !== undefined && a.when !== null) validateSpecNode(a.when, names, spec, "outputs.applied[" + i + "].when");
    });
    if (spec.outputs.caution !== undefined && spec.outputs.caution !== null) {
      var c = spec.outputs.caution;
      if (!specIsObj(c) || typeof c.text !== "string" || !c.text) throw specError("caution needs text");
      if (c.when !== undefined && c.when !== null) validateSpecNode(c.when, names, spec, "outputs.caution.when");
    }
    return spec;
  }

  function evalSpecNode(node, scope, spec) {
    var op = node.op;
    if (op === "const") return node.value;
    if (op === "var") return scope[node.name];
    if (op === "add") return specNum(evalSpecNode(node.left, scope, spec), op) + specNum(evalSpecNode(node.right, scope, spec), op);
    if (op === "sub") return specNum(evalSpecNode(node.left, scope, spec), op) - specNum(evalSpecNode(node.right, scope, spec), op);
    if (op === "mul") return specNum(evalSpecNode(node.left, scope, spec), op) * specNum(evalSpecNode(node.right, scope, spec), op);
    if (op === "div") {
      var d = specNum(evalSpecNode(node.right, scope, spec), op);
      if (d === 0) throw specError("division by zero");
      return specNum(evalSpecNode(node.left, scope, spec), op) / d;
    }
    if (op === "pow") return Math.pow(specNum(evalSpecNode(node.left, scope, spec), op), specNum(evalSpecNode(node.right, scope, spec), op));
    if (op === "min" || op === "max") {
      var nums = node.values.map(function (v) { return specNum(evalSpecNode(v, scope, spec), op); });
      return op === "min" ? Math.min.apply(Math, nums) : Math.max.apply(Math, nums);
    }
    if (op === "and" || op === "or") {
      var bools = node.values.map(function (v) { return specBool(evalSpecNode(v, scope, spec), op); });
      return op === "and" ? bools.every(function (b) { return b; }) : bools.some(function (b) { return b; });
    }
    if (op === "not") return !specBool(evalSpecNode(node.value, scope, spec), op);
    if (op === "round") return specRound(specNum(evalSpecNode(node.value, scope, spec), op));
    if (op === "floor") return Math.floor(specNum(evalSpecNode(node.value, scope, spec), op));
    if (op === "ceil") return Math.ceil(specNum(evalSpecNode(node.value, scope, spec), op));
    if (op === "abs") return Math.abs(specNum(evalSpecNode(node.value, scope, spec), op));
    if (op === "neg") return -specNum(evalSpecNode(node.value, scope, spec), op);
    if (op === "lt" || op === "le" || op === "gt" || op === "ge" || op === "eq" || op === "ne") {
      var a = evalSpecNode(node.left, scope, spec);
      var b = evalSpecNode(node.right, scope, spec);
      if (specIsNum(a) !== specIsNum(b)) throw specError(op + " compares different types");
      if (op === "lt") return a < b;
      if (op === "le") return a <= b;
      if (op === "gt") return a > b;
      if (op === "ge") return a >= b;
      if (op === "eq") return a === b;
      return a !== b;
    }
    if (op === "if") {
      return specBool(evalSpecNode(node.cond, scope, spec), op)
        ? evalSpecNode(node.then, scope, spec)
        : evalSpecNode(node["else"], scope, spec);
    }
    if (op === "lookup") {
      var t = specTable(spec, node.table);
      var key = evalSpecNode(node.key, scope, spec);
      if (specIsNum(key)) key = String(specRound(key));
      if (!specHas(t.rows, key)) {
        if (specHas(t, "default")) return t["default"];
        throw specError("table " + node.table + " has no row for " + key);
      }
      return t.rows[key];
    }
    if (op === "lookup2") {
      var g = specTable(spec, node.table);
      var rk = evalSpecNode(node.row, scope, spec);
      var ck = evalSpecNode(node.col, scope, spec);
      var ri = g.rows.indexOf(specIsNum(rk) ? specRound(rk) : rk);
      var ci = g.cols.indexOf(specIsNum(ck) ? specRound(ck) : ck);
      if (ri < 0 || ci < 0) {
        if (specHas(g, "default")) return g["default"];
        throw specError("table " + node.table + " has no cell for " + rk + "/" + ck);
      }
      return g.values[ri][ci];
    }
    if (op === "bracket") {
      var bt = specTable(spec, node.table);
      var v = specNum(evalSpecNode(node.value, scope, spec), op);
      var lower = 0;
      for (var i = 0; i < bt.rows.length; i++) {
        var row = bt.rows[i];
        if (row.up_to === null || v <= row.up_to) {
          return row.fixed + (v - lower) * row.rate;
        }
        lower = row.up_to;
      }
      throw specError("bracket table " + node.table + " left the value uncovered");
    }
    if (op === "clamp") {
      var cv = specNum(evalSpecNode(node.value, scope, spec), op);
      if (node.min !== undefined) cv = Math.max(cv, specNum(evalSpecNode(node.min, scope, spec), op));
      if (node.max !== undefined) cv = Math.min(cv, specNum(evalSpecNode(node.max, scope, spec), op));
      return cv;
    }
    throw specError("unreachable op " + op);
  }

  function coerceSpecInput(inp, raw) {
    if (inp.type === "number") {
      var n = typeof raw === "number" ? raw : Number(String(raw === undefined || raw === null ? "" : raw).replace(/,/g, ""));
      if (!isFinite(n)) n = inp["default"];
      if (inp.min !== undefined && n < inp.min) n = inp.min;
      if (inp.max !== undefined && n > inp.max) n = inp.max;
      return n;
    }
    if (inp.type === "toggle") {
      return raw === true || raw === 1 || raw === "1" || raw === "true" || raw === "on" || raw === "yes";
    }
    var val = raw === undefined || raw === null ? "" : String(raw);
    for (var i = 0; i < inp.options.length; i++) {
      if (inp.options[i].value === val) return val;
    }
    return inp["default"];
  }

  function specText(template, scope) {
    return String(template).replace(/\{([a-z][a-z0-9_]*)(?:\|(raw|pct|krw|usd))?\}/g, function (m, name, mod) {
      if (!specHas(scope, name)) throw specError("unknown template variable " + name);
      var v = scope[name];
      if (mod === "raw") return String(v);
      if (mod === "pct") return specPct(specNum(v, "pct"));
      if (mod === "usd") return fmtUSD(specNum(v, "usd"));
      if (typeof v === "boolean") return v ? "예" : "아니오";
      if (specIsNum(v)) return fmtKRW(v);
      return String(v);
    });
  }

  function formatSpecValue(v, format) {
    if (format === "pct") return specPct(specNum(v, "pct")) + "%";
    if (format === "usd") return fmtUSD(specNum(v, "usd"));
    if (format === "raw") return String(v);
    if (typeof v === "boolean") return v ? "예" : "아니오";
    if (specIsNum(v)) return fmtKRW(v);
    return String(v);
  }

  function evaluateSpec(spec, rawInputs) {
    validateSpec(spec);
    var scope = {};
    spec.inputs.forEach(function (inp) {
      var has = rawInputs && specHas(rawInputs, inp.key);
      scope[inp.key] = coerceSpecInput(inp, has ? rawInputs[inp.key] : inp["default"]);
    });
    var gates = spec.eligibility_gates || [];
    for (var gi = 0; gi < gates.length; gi++) {
      if (specBool(evalSpecNode(gates[gi].when, scope, spec), "gate " + gates[gi].id)) {
        return {
          eligible: false, gate: gates[gi].id, spec_id: spec.id, title: spec.title,
          failReason: gates[gi].reason,
          alternative: gates[gi].alternative || null,
          values: scope
        };
      }
    }
    var steps = spec.steps || {};
    Object.keys(steps).forEach(function (name) {
      scope[name] = evalSpecNode(steps[name], scope, spec);
    });
    var outs = spec.outputs;
    var headline = {
      label: outs.headline.label,
      value: evalSpecNode(outs.headline.value, scope, spec),
      format: outs.headline.format || "krw"
    };
    headline.text = formatSpecValue(headline.value, headline.format);
    var rows = (outs.rows || []).map(function (r) {
      var v = evalSpecNode(r.value, scope, spec);
      return { label: r.label, value: v, format: r.format || "krw", text: formatSpecValue(v, r.format || "krw") };
    });
    var applied = (outs.applied || []).filter(function (a) {
      return a.when === undefined || a.when === null || specBool(evalSpecNode(a.when, scope, spec), "applied.when");
    }).map(function (a) { return specText(a.text, scope); });
    var caution = null;
    if (outs.caution && (outs.caution.when === undefined || outs.caution.when === null || specBool(evalSpecNode(outs.caution.when, scope, spec), "caution.when"))) {
      caution = specText(outs.caution.text, scope);
    }
    return {
      eligible: true, spec_id: spec.id, title: spec.title,
      headline: headline, rows: rows, applied: applied, caution: caution,
      values: scope
    };
  }

  // Runs every test_vector in a spec against the engine. A vector may pin the
  // headline, any named step value, the eligible flag and the gate id.
  function checkSpecVectors(spec, cand) {
    validateSpec(spec);
    var vectors = cand || spec.test_vectors || [];
    if (!Array.isArray(vectors) || !vectors.length) throw specError("test_vectors are required");
    var results = [];
    vectors.forEach(function (vec, i) {
      var name = vec && vec.name ? String(vec.name) : "vector " + (i + 1);
      var got;
      try {
        got = evaluateSpec(spec, vec.inputs || {});
      } catch (e) {
        results.push({ name: name, ok: false, detail: "threw: " + e.message });
        return;
      }
      var exp = vec.expect || {};
      var problems = [];
      if (specHas(exp, "eligible") && got.eligible !== exp.eligible) {
        problems.push("eligible got " + got.eligible + ", want " + exp.eligible);
      }
      if (specHas(exp, "gate") && got.gate !== exp.gate) {
        problems.push("gate got " + got.gate + ", want " + exp.gate);
      }
      if (specHas(exp, "headline")) {
        if (!got.eligible) problems.push("headline wanted but the spec is ineligible");
        else if (got.headline.value !== exp.headline) {
          problems.push("headline got " + got.headline.value + ", want " + exp.headline);
        }
      }
      if (specHas(exp, "values")) {
        Object.keys(exp.values).forEach(function (k) {
          var want = exp.values[k];
          var have = specHas(got.values, k) ? got.values[k] : undefined;
          var tol = specHas(exp, "tolerance") ? exp.tolerance : 0;
          if (!specIsNum(want)) problems.push(k + " expectation is not a number: " + want);
          else if (!specIsNum(have)) problems.push(k + " is not numeric: " + have);
          else if (Math.abs(have - want) > tol) problems.push(k + " got " + have + ", want " + want + " (tol " + tol + ")");
        });
      }
      results.push({ name: name, ok: problems.length === 0, detail: problems.join("; ") });
    });
    var passed = results.filter(function (r) { return r.ok; }).length;
    return { results: results, passed: passed, total: results.length, ok: passed === results.length };
  }

  var api = {
    HF_ROWS: HF_ROWS, HF_COLS: HF_COLS, HF_VALUES: HF_VALUES,
    NHIS_BRACKETS: NHIS_BRACKETS,
    BONUS_TABLE_2026: BONUS_TABLE_2026,
    lookupBonusMonthly: lookupBonusMonthly,
    computeHousingPension: computeHousingPension,
    computeParentalLeave: computeParentalLeave,
    computeHealthCap: computeHealthCap,
    computeBonusWithholding: computeBonusWithholding,
    fmtKRW: fmtKRW, fmtUSD: fmtUSD, fmtCompact: fmtCompact,
    SPEC_SCHEMA: SPEC_SCHEMA,
    validateSpec: validateSpec,
    evaluateSpec: evaluateSpec,
    computeFromSpec: evaluateSpec,
    checkSpecVectors: checkSpecVectors
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SMARTCALC = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

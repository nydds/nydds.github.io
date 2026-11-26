# SOURCES — SMARTCALC (sites/smartcalc/)

Static policy calculators for GitHub Pages. No external library, no CDN, no
build step, no server call. Every figure below was checked against the cited
official source; a figure that cannot be verified against an official source
is not used. The Python engine (`code/r2/interactive_widgets.py`,
`compute_smart_policy`) carries the identical tables; `test_calc.js` asserts
Python == JS on the same vectors.

## Housing pension (주택연금) — monthly payment table
- Source: Korea Housing Finance Corporation (한국주택금융공사) monthly
  payment examples, 2026-03-01 basis, as published in Tistory post 404
  (B384, 2026-11-25, https://nydds.tistory.com/404).
- Table: general house, lifetime payment, fixed-amount plan. Rows = younger
  spouse's age (55/60/65/70/75/80), cols = house price (1억/3억/5억/12억 원).
  55세·3억 468,000원 · 70세·3억 923,000원 · 80세·12억 4,060,000원, etc.
- Eligibility: one spouse 55+; combined declared price (공시가격) ≤ 12억 원;
  actual residence. Payment is set by market/appraised price, eligibility by
  declared price.
- Caps stated in the post: 70세 12억 3,414,000원 (11억 3,386,000원);
  75세 10/11/12억 all 3,666,000원; 80세 9-12억 all 4,060,000원.
- Initial guarantee fee: 1.0% of house price from 2026-03-01 (was 1.5%);
  monthly amounts up 3.1% on average for new applicants from the same date.
  No retroactive application to existing members.
- House type (70세·3억 only, same source): general 923,000원;
  senior-welfare house 789,000원; officetel 746,000원.

## Parental leave 6+6 (6+6 부모육아휴직)
- Source: 고용24 (Work24) 육아휴직급여 제도안내, as published in
  drafts/api_bullet350_20261123.md (checked 2026-11-23).
- 6+6 (both parents use leave within the child's first 18 months):
  100% of ordinary wage, monthly caps 250/250/300/350/400/450만 원.
  6-month total at caps: 2,000만 원 per person; 4,000만 원 per couple.
- General track: 80% of ordinary wage, caps 250만 (months 1-3) /
  200만 (months 4-6). From month 7 both tracks: 80%, cap 160만 원.
  12-month total at caps (6+6): 2,960만 원.
- Ordinary wage is fixed at the leave start date.

## Health out-of-pocket cap (본인부담상한제) — 2025 treatment year
- Source: National Health Insurance Service (국민건강보험공단),
  "2025년도 본인부담상한액 변경 안내" (2025-01-07). Corroborated by the
  2026 refund notices (2,262,605 recipients, payments from 2026-09-02).
- General caps: 1분위 890,000원 · 2-3분위 1,100,000원 · 4-5분위 1,700,000원 ·
  6-7분위 3,200,000원 · 8분위 4,370,000원 · 9분위 5,250,000원 ·
  10분위 8,260,000원.
- Long-term-care hospital (120+ days) caps: 1,410,000 / 1,780,000 /
  2,400,000 / 3,960,000 / 5,690,000 / 6,840,000 / 10,740,000원.
- Refund = max(0, annual copayments − cap); actual burden = min(payments, cap).

## Bonus withholding (상여금 원천징수) — 2026
- Source: 소득세법 시행령 별표 2 근로소득 간이세액표 <개정 2026. 2. 27.>,
  국가법령정보센터 file download flSeq=169813489
  (https://www.law.go.kr/flDownload.do?gubun=&flSeq=169813489&bylClsCd=110201).
  Full 11-column table archived in
  code/r2/kr_simplified_withholding_2026.json; the preset uses the
  공제대상가족 1명(본인만) column (646 rows: 770천원~10,000천원).
- Formula: 소득세법 제136조 5단계 — 상여금 ÷ 지급기간 → 월급과 합산 →
  간이세액표 룩업 → x 지급기간 → 월급분 원천징수 차감. Above 10,000천원 the
  별표's own tiers apply ("10,000천원인 경우의 해당 세액" 1,507,400원 +
  초과분 98% x 35%/38%/40%, then 40%/42%/45% without the 98% factor).
- Verified against B108 (live post 411): 월급 450만 원·상여금 900만 원·
  6개월 → 원천징수 1,458,360원; 1월 일시금 → 2,470,060원; 지방소득세
  145,836원 (소득세의 10%); 고용보험료 81,000원 (상여금의 0.9%);
  상여금 800만 원 시 4월 정산 325,391원 (건강 287,600원 + 장기요양 37,791원).
- Health settlement (next April): 건강보험료율 7.19% (근로자 3.595%),
  장기요양보험료 = 건강보험료의 13.14%. Monthly premium cap/floor:
  보건복지부 「월별 건강보험료액의 상한과 하한에 관한 고시」 (2026-01-01
  시행) — total 9,183,480원 / 20,160원 (employee half). Annual total capped
  at 12 x the monthly cap (the 고시 states a monthly cap; the x12 annual
  cap is this calculator's stated assumption).
- Pension (guidance only, not computed): 국민연금 보험료는 상여금 지급 달에
  변동 없음; 다음 해 7월 기준소득월액 재산정 때 반영. 2026년 보험료율 9.5%
  (근로자 4.75%); 기준소득월액 2026.7.1~2027.6.30 하한 410,000원·상한
  6,590,000원 (보건복지부 고시, law.go.kr flSeq=161404479).
- Rounding: 원 미만은 반올림 (Python math.floor(x + 0.5), JS same).
  공제대상가족 1명(본인만) 기준; 다른 가족 수에는 이 표를 쓰지 않는다.

## Universal JSON spec mode (?spec=B<n>) — schema calc_spec/v1
- A spec is data, not code: `calc.js` exposes `validateSpec`, `evaluateSpec`
  (`computeFromSpec`) and `checkSpecVectors`, and runs a whitelist of
  operations (const/var, +−×÷, compare, min/max/and/or, round/floor/ceil,
  if, map/grid/bracket lookups, clamp). No `eval`, no `Function`, no property
  path taken from the spec. An unknown op, table, variable or malformed node
  throws, so a broken spec never renders a partly-wrong number.
- Inputs may be number, select or toggle; eligibility gates replace the
  number with a reason and an alternative; steps run in key order and may
  only read earlier steps; outputs carry a headline, rows, applied lines and
  one caution; `test_vectors` pin headline values and named step values.
- The page loads `specs/B<n>.json` only when the URL says `?spec=B<n>`,
  adds a fifth tab for it and leaves the four presets untouched.
- Exit codes for the gate: `checkSpecVectors` returns `{ok, passed, total}`;
  any vector that throws or deviates fails.

## B423 — 자동차 취득세 감면 (광명시)
- Local guide: 광명시청 차량등록 취득세 감면 안내
  (https://www.gm.go.kr/pt/partInfo/tf/tf01/registration_costs/PTMN966.jsp,
  checked 2026-11-26). 1차 법령 대조: 지방세법·지방세특례제한법 원문
  (국가법령정보센터).
- Rates (지방세법 제12조①2호, 시행 2026-01-01): 비영업용 승용 7%
  (경자동차 4%), 그 밖의 비영업용(승합·화물) 5%, 이륜 125cc 이하 2%,
  125cc 초과 5%. 자동차 취득세에는 지방교육세가 붙지 않는다
  (지방세법 제150조 제1호가 자동차 취득세를 납세의무에서 제외);
  농어촌특별세도 부과되지 않으므로 취득 단계 세금은 취득세 하나다.
- 장애인 (지방세특례제한법 제17조): 장애 정도가 심한 장애인 등이
  보철용·생업활동용으로 취득하고 취득세·자동차세 중 먼저 신청하는 1대를
  2027-12-31까지 면제. 대상 차량: 배기량 2,000cc 이하 승용(6인승 이하),
  7~10인승 승용, 15인승 이하 승합, 1톤 이하 화물, 250cc 이하 이륜.
- 국가유공자 등 (제29조④): 국가유공자·5·18부상자·고엽제후유의증환자
  1~7급(5·18은 1~14급)은 2027-12-31까지 100% 면제, 보훈보상대상자는 50%
  경감. 같은 조문이 "제17조 감면을 받은 경우는 제외"라고 정해 장애인
  감면과 겹쳐 받을 수 없다.
- 다자녀 (제22조의2, 2027-12-31까지): 18세 미만 자녀 3명 이상은 취득세
  면제 — 6인승 이하 승용은 산출세액 140만 원 이하 면제·초과 시 140만 원
  공제, 7~10인승 승용·15인승 이하 승합·1톤 이하 화물·250cc 이하 이륜은
  면제(최소납부제 적용). 2명은 50% 경감 — 6인승 이하 승용은 70만 원 한도,
  그 밖의 차종은 한도 없음.
- 최소납부제 (제177조의2①): 100% 면제 규정에도 85% 감면율을 적용하되,
  ① 산출 취득세가 200만 원 이하면 전액 면제, ② 같은 항 제2호가
  제17조·제29조를 열거하므로 장애인·국가유공자 감면은 200만 원을 넘어도
  전액 면제. 제22조의2는 열거에 없어 200만 원 초과 다자녀 면제는 15%를
  낸다 (광명시 예시②: 산출세액 300만 원 → 45만 원 납부 = 85% 감면).
- 중복 감면 배제: 둘 이상의 감면 규정이 겹치면 감면율이 높은 하나만
  적용한다(지방세특례제한법 중복감면 배제 원칙, 정부24 「장애인차량
  취득세 및 자동차세 감면」 안내). 계산기는 대상자 감면과 다자녀 감면 중
  큰 쪽 하나만 적용하고 그 사실을 화면에 적는다.
- 추징: 등록일부터 1년 이내에 사망·혼인·해외이민·운전면허취소 같은
  부득이한 사유 없이 소유권을 이전하거나 세대를 분가하면 감면액을
  추징한다.
- Test vectors (15, all hand-computed against the rules above, zero error on
  the engine): V1 보훈보상 50% 3,000만 원 → 1,050,000원 · V2 중증 장애인
  → 0원 · V3 2자녀 → 1,400,000원 · V4 3자녀 → 700,000원 · V5 7~10인승
  산출세액 200만 원 경계 → 0원 · V6 산출세액 300만 원 → 450,000원 ·
  V7 2자녀 승합 → 500,000원 · V8 중복 시 큰 쪽 → 700,000원 · V9 이륜
  125cc 이하 → 0원 · V10/V11 게이트 · V12 2,000cc 초과 + 3자녀 →
  700,000원 · V13 2,000cc 초과 + 장애인 → 2,100,000원 · V14/V15 140만 원
  경계(2자녀 700,000원 / 3자녀 0원).

## What this calculator does NOT do
- B423 covers 취득세 감면 only: 자동차세·등록면허세·공채 매입, 전기차
  140만 원 감면, 경형자동차 75만 원 감면, 수소 화물차 50% 감면은 계산하지
  않고 화면에도 넣지 않는다(전기차는 고시 목록 등재 여부 확인이 선행).
- B423은 감면을 1대 기준으로 계산하고, 이미 감면을 받은 차량이 있는지는
  사용자가 토글로 답한다(가구 전체 이력을 조회하지 않는다).
- B423은 개인이 비영업용으로 취득하는 경우만 다룬다(영업용 4%는 미지원).
- Off-table housing-pension inputs snap to the nearest published cell and say
  so; they are never interpolated.
- House-type adjustment is shown only for the one published cell
  (70세·3억 원). Other age/price/type combinations are not estimated.
- No tax, legal or medical advice. All results are estimates for planning.
- Bonus preset covers 공제대상가족 1명 (본인만) only; other family
  counts need the full table (archived in the JSON next to the engine).

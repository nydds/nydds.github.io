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

## What this calculator does NOT do
- Off-table housing-pension inputs snap to the nearest published cell and say
  so; they are never interpolated.
- House-type adjustment is shown only for the one published cell
  (70세·3억 원). Other age/price/type combinations are not estimated.
- No tax, legal or medical advice. All results are estimates for planning.
- Bonus preset covers 공제대상가족 1명 (본인만) only; other family
  counts need the full table (archived in the JSON next to the engine).

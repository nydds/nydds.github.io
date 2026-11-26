# nydds.github.io

무료 정책 계산기와 도구를 GitHub Pages로 서비스하는 공개 저장소입니다.

## 서비스 중인 페이지

| 경로 | 내용 | 출처 |
| --- | --- | --- |
| `/smartcalc/` | 주택연금 월 수령액 · 6+6 부모육아휴직급여 · 본인부담상한제 환급금 · 상여금 원천징수·건강보험 정산 계산기 | [smartcalc/SOURCES.md](smartcalc/SOURCES.md) |

- 전부 정적 파일(HTML/CSS/JS)입니다. 빌드 단계, 외부 라이브러리, CDN, 서버 호출이 없습니다.
- 입력값은 브라우저 안에서만 계산되며 어디로도 전송되지 않습니다.
- 계산표는 `nydds/paos-factory-board`의 `sites/smartcalc/`와 `code/r2/interactive_widgets.py::compute_smart_policy`가 동일한 값을 사용합니다.

## 배포

`main` 브랜치 루트가 그대로 GitHub Pages로 배포됩니다 (`.nojekyll`).

- `index.html` — 계산기 목록
- `smartcalc/` — 계산기 본체 (`index.html`, `calc.js`, `SOURCES.md`)

## 참고

참고용 계산이며 세무·금융 자문이 아닙니다. 정확한 금액은 각 기관에서 본인 조건으로 확인하세요.

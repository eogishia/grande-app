# 번들된 서체

앱과 함께 배포되는 서체와 그 라이선스다. 둘 다 SIL Open Font License 1.1이라
재배포가 허용되지만 **라이선스 원문 동봉이 의무**이므로 이 폴더를 지우지 말 것.

| 서체 | 용도 | 웨이트 | 저작자 | 라이선스 |
|---|---|---|---|---|
| Noto Serif KR | 본문 (`--serif`), 공유 이미지 | 300 | Google | [OFL 1.1](NotoSerifKR-OFL.txt) |
| Pretendard | UI·저자·출처 (`--sans`) | 300, 400 | Kil Hyung-jin | [OFL 1.1](Pretendard-OFL.txt) |

`.woff2` 파일과 `fonts.css`는 `scripts/build_fonts.js`가 생성한다. 직접 고치지 말고
스크립트를 다시 돌릴 것.

OFL은 서체 파일 자체를 파는 것만 금지하며, 앱에 포함해 배포하는 것은 자유다.

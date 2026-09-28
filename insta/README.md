# Grande 인스타 자동 초안 · 설치와 사용법

이틀에 한 번 아침, Claude Code 루틴이 반전 카루셀 초안 한 편(이미지 5장, 캡션, 검증 메모)을 만들어
Claude 아티팩트 **「Grande 인스타 초안함」**을 새로 고친다. 휴대폰 Claude 앱에서 보고, 저장하고, 캡션을 복사해 게시한다.
고칠 곳이 있으면 그날 루틴 세션에서 말로 피드백하고, 다음 초안에도 적용할 기준은 `insta/feedback.md`에 쌓인다.

초안함: https://claude.ai/artifact/B2UkmH3YBaVThoLhGAVjiB

## 무엇이 바뀌나 (grande-app 저장소)

```
cards/www/index.html     카드 도구에 '반전' 형식 추가 (기존 '기본' 형식은 그대로)
cards/www/twist.js       반전 카루셀 조판 (2026-09-28 확정 디자인)
cards/www/posts.js       확정된 반전 문구 (보에티우스)
cards/www/twist-fonts/   반전 형식 전용 서체: 명조 400/600 · Pretendard 500/600 (8.5MB, 카드 APK에만 실림)
insta/                   자동화: render.mjs(카드) · inbox.mjs(초안함) · ROUTINE.md · feedback.md · used.md · 원칙 문서
.gitignore               insta/drafts/inbox.html 추가
```

`www/`(앱 본체)는 건드리지 않는다. 카드 도구 편집 화면 맨 위에 **형식: 반전 / 기본** 선택이 생기고,
반전을 고르면 훅 · 맥락 · 밑줄 · 해설 · 캡션 문구 칸이 나온다.

## 1. 저장소에 반영하기 (Windows)

파일이 400개가 넘어(서체 조각) GitHub 웹 업로드(한 번에 100개 제한)로는 번거롭다. 컴퓨터의 grande-app 폴더에서 한다.

1. 압축 파일을 오른쪽 클릭 → **압축 풀기** → 대상 폴더를 grande-app 폴더로 지정한다. "같은 이름의 파일이 있습니다"가 뜨면 **파일 바꾸기**.
2. 커밋하고 푸시한다. 방법은 셋 중 편한 것:
   - **GitHub Desktop**: 변경 목록 확인 → 아래 Summary에 "인스타 자동 초안 추가" → Commit to main → Push origin
   - **Claude Code** (grande-app 폴더에서): "방금 추가한 insta 자동화 파일 확인하고 커밋·푸시해줘"
   - **PowerShell**: `git add -A` → `git commit -m "인스타 자동 초안 추가"` → `git push` (한 줄씩)
3. (선택) 휴대폰 카드 앱에도 반전 형식을 쓰려면 PowerShell에서 `cd cards` → `npm run sync` 후 APK를 다시 만든다.

## 2. 루틴 만들기

[claude.ai/code/routines](https://claude.ai/code/routines) → **New routine**

| 항목 | 값 |
|---|---|
| 이름 | Grande 인스타 초안 |
| 프롬프트 | `insta/ROUTINE.md` 전체를 붙여 넣기 |
| 모델 | 가장 좋은 모델 (사실 검증이 핵심이라서) |
| 저장소 | **grande-app** |
| 환경 | Default에서 **Setup script**에 `node scripts/build_cards.js && cd insta && npm ci` |
| 트리거 | Schedule → Daily, 07:07 |
| 커넥터 | Google Calendar만 남기고 모두 제거 (알림이 필요 없으면 전부 제거) |

**이틀에 한 번으로 바꾸기**: 첫 실행이 잘 된 뒤, 터미널 Claude Code에서 `/schedule update` →
"Grande 인스타 초안을 한국 시간 이틀에 한 번 오전 7시 7분으로". 월이 바뀔 때 하루 간격이 생길 수 있으니
신경 쓰이면 월·수·금 같은 요일 지정이 더 규칙적이다.

## 3. 첫 실행 점검 (Run now)

루틴 상세 화면 **Run now** → 새 실행 세션을 열어 끝까지 본다. 초록 표시는 "끝났다"는 뜻이지 성공이 아니다.

- 렌더가 통과했는지 (`카드 5장: 훅 · 맥락 · 본문 · 해설 · 마무리`)
- 웹 검증이 막히지 않았는지. `403 host_not_allowed`가 보이면 환경의 Network access를 **Full**로
- **초안함이 새 초안으로 바뀌었는지.** 막혔다면 세션 내용을 그대로 보여주면 전달 방법을 바꾼다
- 그 세션에 짧은 피드백("훅을 조금 더 짧게")을 보내, 수정본이 초안함에 다시 올라오는지

## 4. 아침에 할 일

1. Claude 앱에서 **Grande 인스타 초안함**을 연다.
2. 확신도 표시를 보고, 필요하면 **검증 메모**로 출처를 확인한다.
3. 바로 올려도 되면: **이미지 5장 저장** → **캡션 복사** → 인스타에 게시.

**고치고 싶으면**: Claude 앱 **Code** 탭 → 오늘 날짜의 **Grande 인스타 초안** 세션에서 말한다.
문구를 먼저 보여주고, 합의하면 다시 그려 초안함을 새로 고친다("수정 N회"). "확정"이라고 하면 끝.

**쓰지 않을 때**: 그냥 두면 된다. 다시 후보로 삼으려면 `insta/used.md`에서 그 줄을 지운다.

## 5. 가끔 할 일

- `claude/insta-drafts`의 `cards/www/posts.js`, `insta/used.md`, `insta/feedback.md` 변경을 기본 브랜치에 병합한다(한 달에 한 번).
  `insta/drafts/`의 이미지는 초안 하나에 1MB 안팎이니 오래된 폴더는 정리한다.
- 검증 메모의 "본문 의심"을 모아 원전 대조 작업을 한다.

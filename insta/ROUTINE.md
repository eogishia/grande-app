# Grande 인스타 초안 루틴

> 이 문서 전체를 Claude Code 루틴의 프롬프트 칸에 붙여 넣는다. 저장소(grande-app)의 `insta/ROUTINE.md`가 원본이다.

너는 고전 큐레이션 앱 Grande의 인스타그램 계정(@grande_book)에 올릴 **반전 카루셀 초안 한 편**을 만든다.
이 작업은 이틀에 한 번 자동으로 실행되고, 결과는 Claude 아티팩트 **「Grande 인스타 초안함」**으로 전달된다.
사람이 아침에 휴대폰의 Claude 앱에서 확인한 뒤 직접 게시한다.

초안함 주소: https://claude.ai/artifact/B2UkmH3YBaVThoLhGAVjiB
너는 초안만 만든다. 인스타 게시, 기본 브랜치 수정, `www/`(앱 본체) 수정은 하지 않는다.

저장소 구조: 글 원본 `www/quotes.js` · 카드 도구 `cards/www/index.html` + `cards/www/twist.js`(반전 조판) · 확정 문구 `cards/www/posts.js` · 자동화 `insta/`

## 0. 작업 브랜치 준비

```bash
git fetch origin
DEFAULT=$(git remote show origin | sed -n 's/.*HEAD branch: //p')
if git ls-remote --exit-code --heads origin claude/insta-drafts >/dev/null; then
  git checkout -B claude/insta-drafts origin/claude/insta-drafts
  git merge "origin/$DEFAULT" --no-edit
else
  git checkout -b claude/insta-drafts "origin/$DEFAULT"
fi
TODAY=$(TZ=Asia/Seoul date +%F)
node scripts/build_cards.js            # cards/www에 quotes.js·서체·로고 채우기 (커밋되지 않는 파일)
[ -d insta/node_modules ] || (cd insta && npm ci)
```

병합 충돌이 나면 `www/`, `cards/www/index.html`, `cards/www/twist.js`, `insta/*.mjs`는 기본 브랜치 쪽을 따른다.
`cards/www/posts.js`, `insta/used.md`, `insta/feedback.md`는 양쪽 항목을 모두 살린다.

## 1. 먼저 읽을 것

1. `insta/grande-content-principles.md`: 모든 판단의 기준이다. 특히 "지어내지 않는다".
   `insta/feedback.md`: 사람의 피드백으로 쌓인 기준. 여기 적힌 것은 이 문서의 다른 지시보다 우선한다(사실 검증 원칙은 예외).
2. `www/quotes.js`: 본문. `cards/www/posts.js`: 이미 확정된 반전 문구. `insta/used.md`: 이미 초안을 만든 글.
3. `insta/drafts/`의 최근 폴더 2~3개에 있는 `post.json`과 `memo.md`: 톤과 형식의 기준. `insta/drafts/2026-09-28_p59/post.json`이 합격한 예시다.

## 2. 글 고르기

- `insta/used.md`와 `cards/www/posts.js`에 없는 글 중에서, 배경에 **반전 · 오해 교정 · 숨은 사연 · 통념 뒤집기** 가운데 하나가 확실히 있는 글을 고른다.
- 직전 두 편과 카테고리(철학·문학·신학·동양고전·과학)가 겹치지 않게 한다.
- 원문 대조가 필요해 보이는 글(지어낸 문장, 오귀속, 출처 오류 의심)은 고르지 않는다. 대신 `memo.md`의 "본문 의심" 항목에 적는다. `www/quotes.js`는 고치지 않는다.
- 후보를 세 개 검토해도 적합한 글이 없으면 초안을 만들지 않는다. `insta/drafts/${TODAY}_none/memo.md`에 검토한 후보와 탈락 이유만 남기고 7단계로 간다.

## 3. 사실 검증

- 훅과 해설에 들어갈 **모든 사실**을 웹에서 확인한다. 원전, 학술 백과사전, 대학·연구기관 자료, 공인 번역본 해설을 우선한다. 사실마다 출처를 두 개 이상 확보한다.
- 확신도를 매긴다. ◎ 확실 · ○ 학계 논쟁이 있거나 출처가 하나뿐 · △ 불확실.
- △이면 그 글로 초안을 만들지 않는다. ○이면 훅과 해설에서 단정하지 않는다("~지도 모른다", "~로 본다").
- 널리 퍼졌지만 틀린 이야기(속설, 가짜 일화)를 사실처럼 쓰지 않는다.

## 4. 문구 쓰기 → `insta/drafts/${TODAY}_<id>/post.json`

```json
{ "id": "", "confidence": "◎", "type": "숨은 사연", "revision": 0,
  "hook": "", "setup": "", "highlight": "", "reveal": "", "about": "", "ask": "" }
```

- **confidence**: 3단계에서 매긴 확신도(◎ 또는 ○). **type**: 오해 교정 / 숨은 사연 / 통념 뒤집기 / 질문 중 하나.
- **hook** (1장): 결론을 말하지 말고 빈칸(누가 / 무엇이 / 왜)을 남긴다. 독자가 이미 안다고 믿는 것과 부딪히게 쓴다. `\n`으로 나눈 2~3줄, 각 줄 16자 안팎. 인용문을 넣지 않고, 과장 수식어(충격, 소름, 역대급 등)도 쓰지 않는다. 스스로 "이것만 읽고 넘기지 않을 수 있는가"로 점검한다.
  - 좋은 예: `사형을 기다리는 남자에게\n누군가 찾아왔다.\n신은 아니었다.`
  - 나쁜 예: `이 편지를 쓴 사람은\n죽는 대신 궁형을 택했다.` (답을 먼저 말해버림)
- **setup** (2장): 설명하지 말고 빈칸을 한 번 더 키우는 한두 줄. 필요 없으면 빈 문자열로 둔다.
- **highlight** (3장 밑줄): 본문에서 **글자 그대로 복사한** 구절. 한 문단 안에 있어야 하고, 한 문장 안팎이어야 한다. 훅의 빈칸과 이어지는 구절을 우선한다.
- **reveal** (4장): 훅의 답으로 시작한다. 두 문단, 3~5문장. 훅과 맥락 때문에 독자가 잘못 짐작할 여지가 있으면(예: "신앙을 버렸나?") 해설에서 바로잡는다.
- **about** (캡션 둘째 문단): 인물 · 책 · 시대 같은 검색 키워드를 담되 답은 말하지 않는다. "넘겨서 확인해 보세요"로 끝낸다.
- **ask** (캡션 질문): 본문과 이어지는, 댓글로 답하기 쉬운 질문 한 줄.
- 최종 점검: 4장까지 넘긴 사람이 속았다고 느끼면 실패다. 훅의 약속은 반드시 해설에서 지킨다.

## 5. 렌더링

```bash
node insta/render.mjs insta/drafts/${TODAY}_<id>/post.json
```

- 종료 코드 2(경고)가 나오면 메시지를 읽고 문구를 고친 뒤 다시 렌더한다. 밑줄 구절 불일치가 가장 흔한 원인이다.
- 종료 코드 1(실패)이면 오류를 `memo.md`에 그대로 적고, 문구 파일만 커밋한다.
- `preview.jpg`와 `1.jpg`~`5.jpg`를 직접 열어본다. 글자 깨짐, 어색한 줄바꿈(한 글자만 다음 줄로 넘어감 등), 넘침, 훅 장이 네 줄 이상인지 확인한다. 문제가 있으면 문구의 줄바꿈이나 길이를 고쳐서 다시 렌더한다.

## 6. `memo.md` 쓰기 (같은 폴더)

- 고른 글과 그 이유, 훅 유형(오해 교정 / 숨은 사연 / 통념 뒤집기 / 질문)
- 확신도, 그리고 사실마다 근거와 출처 링크
- 검토했지만 탈락시킨 후보와 이유
- 본문 의심: 검증하다 발견한 `www/quotes.js` 본문·출처 문제 (없으면 "없음")
- 대안 훅 1~2개 (사람이 바꿔 쓸 수 있게)

## 7. 기록하고 올리기

1. `insta/used.md`에 `- ${TODAY} <id> <저자> — 초안`을 추가한다. 초안을 만들지 않았으면 추가하지 않는다.
2. `cards/www/posts.js` 배열 끝에 이번 항목(id, hook, setup, highlight, reveal, about, ask)을 추가한다. 형식은 기존 항목과 같게 한다.
3. 커밋하고 올린다.
   ```bash
   git add -A insta/drafts insta/used.md insta/feedback.md cards/www/posts.js
   git commit -m "insta draft: ${TODAY} <id> <저자>"
   git push origin claude/insta-drafts
   ```

## 8. 초안함으로 보내기

```bash
node insta/inbox.mjs         # → insta/drafts/inbox.html (최근 초안 3편을 이미지째 담은 한 장짜리 페이지)
```

Artifact 도구로 `insta/drafts/inbox.html`을 **기존 초안함 주소에 다시 게시**한다.
- `url`: https://claude.ai/artifact/B2UkmH3YBaVThoLhGAVjiB
- `capabilities`는 넘기지 않는다(기존 설정이 그대로 유지된다). 새 아티팩트를 만들지 않는다.
- 게시에 실패하면 오류를 세션 마지막 보고에 적는다. 초안 자체는 GitHub에 남아 있으므로 작업은 실패가 아니다.

초안을 만들지 않은 날(적합한 글 없음)에는 초안함을 다시 게시하지 않는다.

(선택) Google Calendar 커넥터가 연결되어 있으면, 오늘 오전 8:00(한국 시간)에 10분짜리 일정
"📮 인스타 초안: <훅 첫 줄>"을 만들고 설명에 초안함 주소를 넣는다. 알림은 일정 시작 시각. 휴대폰 알림 용도다.

## 피드백 대화 (실행 후, 사람이 이 세션에 이어서 말할 때)

이 세션은 실행이 끝난 뒤에도 사람이 이어서 말을 걸 수 있다. 사람이 초안함을 보고 피드백을 주면:

1. 무엇을 바꿀지 한두 문장으로 확인하고, 애매하면 묻는다. 여러 방향이 가능하면 대안 2~3개를 문구로 먼저 보여준다(이미지는 아직 만들지 않는다).
2. 합의되면 `post.json`을 고치고 `"revision"` 값을 1 올린다. 새로 들어가는 사실이 있으면 3단계 기준으로 다시 검증한다.
3. 다시 렌더하고(5단계), 이미지를 직접 확인하고, `memo.md` 맨 아래 "수정 기록"에 무엇을 왜 바꿨는지 한 줄 남긴다.
4. `cards/www/posts.js`의 해당 항목도 같게 고친다. 커밋하고 올린 뒤, 초안함을 다시 게시한다(8단계).
5. 이번 피드백이 **다음 초안에도 적용할 기준**이면, `insta/feedback.md`의 알맞은 항목에 날짜와 함께 한 줄로 추가하고 그 사실을 사람에게 알린다. 이 글에만 해당하는 수정이면 추가하지 않는다. 사람의 성향을 추측해 적지 말고, 사람이 실제로 정한 기준만 적는다.
6. 사람이 "확정"이라고 하면 `insta/used.md`의 해당 줄 끝을 "확정"으로 바꾸고 커밋한다.

사람이 다른 글로 바꾸자고 하면, 2단계부터 다시 하되 이전 글은 `insta/used.md`에서 "보류"로 표시한다.

## 마지막 보고

세션 마지막에 다음을 짧게 남긴다: 고른 글, 훅, 확신도, 경고나 실패 여부, 초안 폴더 경로, 초안함 게시 결과.

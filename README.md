# Grande

커피 한 잔의 시간 동안, 좋은 글 한 편.

## 빌드 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. Android Studio에서 열기
```bash
npx cap open android
```

### 3. 웹 변경 후 동기화
```bash
npx cap sync android
```

### 4. APK 빌드
Android Studio에서 Build > Build Bundle(s) / APK(s) > Build APK(s)

## 프로젝트 구조

`www/`에 있는 것은 전부 APK에 실린다. 빌드 도구나 앱이 안 쓰는 데이터는 넣지 않는다.

- `www/index.html` — 앱의 모든 UI + 로직
- `www/quotes.js` — 글 데이터
- `www/fonts/` — 번들된 웹폰트 (`scripts/build_fonts.js`가 생성, 직접 고치지 말 것)
- `scripts/` — 빌드·콘텐츠 스크립트 (APK에 실리지 않음)
- `data/` — 앱이 쓰지 않는 파생 데이터 (`books.js` 등)
- `android/` — Capacitor가 생성한 Android 프로젝트
- `capacitor.config.json` — Capacitor 설정

### 폰트

서체는 원격 CDN이 아니라 `www/fonts/`에 번들한다. 네트워크가 없으면 본문이
시스템 명조로 떨어지고 공유 이미지까지 무너지기 때문이다. 다시 받으려면:

```bash
node scripts/build_fonts.js
```

Noto Serif KR 300(본문)과 Pretendard 300·400(UI)만 담는다 — 실제로 그 세 가지만 쓴다.

### 저장 구조

사용자 데이터만 저장한다. 글 본문은 `quotes.js`에 있으므로 저장하지 않는다.

- `grande_bm_v1` — 갈피 (`{id: 끼운시각}`)
- `grande_custom_v1` — 서랍 글
- `grande_memos` — 메모

키가 깨져도 해당 키만 비우고 원본을 `*_broken`에 남긴다. 다른 키는 건드리지 않는다.

## 앱 정보
- **App ID**: com.grande.app
- **앱 이름**: Grande
- **테마 색상**: #F8F6F1 (종이), #A98053 (포인트)

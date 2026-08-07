#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""quotes.js → books.js 생성 + 데이터 정합성 정리.

하는 일:
  1) 동일인인데 다르게 표기된 저자명 통일
  2) 같은 책(저자+제목+권)인데 갈라진 제휴 링크를 하나로 통일
  3) 책 단위 엔티티(books.js) 생성

quotes.js는 제자리에서 갱신되고, 실행 전 백업이 만들어집니다.
같은 파일에 여러 번 실행해도 결과가 달라지지 않습니다(멱등).
"""
import json
import hashlib
import shutil
import collections
import os

# 이 스크립트는 scripts/ 에 있고 데이터는 www/·data/ 에 있다. APK에 실리지 않도록
# www/ 밖으로 옮겼기 때문에, 어디서 실행하든 스크립트 위치를 기준으로 경로를 잡는다.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUOTES_PATH = os.path.join(_ROOT, "www", "quotes.js")
BOOKS_PATH = os.path.join(_ROOT, "data", "books.js")
BACKUP_SUFFIX = ".bak"

# 동일 인물의 표기를 하나로 모읍니다. (잘못된 표기: 올바른 표기)
AUTHOR_ALIASES = {
    "게오르크 빌헬름 프리드리히 헤겔": "게오르크 헤겔",
    "생텍쥐페리": "앙투안 드 생텍쥐페리",
    "이마누엘 칸트": "임마누엘 칸트",
}

# 책 단위로 올라가는 필드. cat(분류)은 같은 책이라도 대목마다 달라질 수 있어
# (예: 팡세=철학/신학, 파우스트=철학/문학) 의도적으로 제외합니다.
BOOK_FIELDS = ["isbn", "publisher", "translator", "kyoboLink", "yes24Link"]


def load_quotes(path):
    src = open(path, encoding="utf-8").read()
    start, end = src.index("["), src.rindex("]") + 1
    return src[:start], json.loads(src[start:end]), src[end:]


def book_key(q):
    return (
        q.get("author", "").strip(),
        q.get("bookTitle", "").strip(),
        q.get("volume", "").strip(),
    )


def book_id(key):
    """저자·제목·권으로부터 만드는 안정적인 식별자.

    한글 제목은 슬러그로 만들기 어려워 해시를 씁니다. 같은 책이면 언제 실행해도
    같은 값이 나오므로 Firestore 문서 ID로 그대로 쓸 수 있습니다.
    """
    raw = "\u0000".join(key)
    return "b" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def normalize_authors(quotes):
    changed = []
    for q in quotes:
        a = q.get("author", "").strip()
        if a in AUTHOR_ALIASES:
            q["author"] = AUTHOR_ALIASES[a]
            changed.append((q["id"], a, q["author"]))
    return changed


def unify_links(quotes):
    """같은 책이면 제휴 링크를 하나로 맞춥니다.

    애드픽은 같은 목적지라도 호출할 때마다 새 단축링크를 발급하기 때문에,
    콘텐츠를 여러 배치로 나눠 추가하면 같은 책에 서로 다른 링크가 붙습니다.
    각 그룹에서 가장 먼저 등장한 링크를 기준으로 삼습니다.
    """
    canonical = collections.defaultdict(dict)
    for q in quotes:
        key = book_key(q)
        for f in ("kyoboLink", "yes24Link"):
            if q.get(f) and f not in canonical[key]:
                canonical[key][f] = q[f]

    changed = []
    for q in quotes:
        key = book_key(q)
        for f in ("kyoboLink", "yes24Link"):
            ref = canonical[key].get(f)
            if ref and q.get(f) and q[f] != ref:
                changed.append((q["id"], f, q[f], ref))
                q[f] = ref
    return changed


def build_books(quotes):
    groups = collections.OrderedDict()
    for q in quotes:
        if not q.get("bookTitle", "").strip():
            continue
        groups.setdefault(book_key(q), []).append(q)

    books = []
    for key, items in groups.items():
        author, title, volume = key
        book = {
            "id": book_id(key),
            "title": title,
            "author": author,
            "quoteIds": [q["id"] for q in items],
        }
        if volume:
            book["volume"] = volume
        for f in BOOK_FIELDS:
            book[f] = next((q[f] for q in items if q.get(f)), "")
        books.append(book)

    books.sort(key=lambda b: (b["author"], b["title"], b.get("volume", "")))
    return books


def report(quotes, books):
    print("\n--- 검증 ---")
    orphans = [q["id"] for q in quotes if not q.get("bookTitle", "").strip()]
    print("책 정보가 없는 항목:", orphans if orphans else "없음")

    linked = sum(len(b["quoteIds"]) for b in books)
    print("항목 %d개 → 책 %d권 (연결된 항목 %d개)" % (len(quotes), len(books), linked))

    ids = [b["id"] for b in books]
    print("책 ID 중복:", "없음" if len(ids) == len(set(ids)) else "발견")

    split = [b["title"] for b in books if not b["kyoboLink"]]
    print("교보 링크 없는 책:", len(split))

    sizes = collections.Counter(len(b["quoteIds"]) for b in books)
    print("책당 항목 수:", dict(sorted(sizes.items())))

    authors = collections.Counter(b["author"] for b in books)
    print("고유 저자:", len(authors))
    print("책이 많은 저자:", ", ".join("%s(%d)" % (a, n) for a, n in authors.most_common(5)))


def main():
    prefix, quotes, suffix = load_quotes(QUOTES_PATH)

    if not os.path.exists(QUOTES_PATH + BACKUP_SUFFIX):
        shutil.copy(QUOTES_PATH, QUOTES_PATH + BACKUP_SUFFIX)
        print("백업 생성:", QUOTES_PATH + BACKUP_SUFFIX)

    a_changed = normalize_authors(quotes)
    print("\n저자명 통일: %d건" % len(a_changed))
    for qid, old, new in a_changed:
        print("  %-6s %s → %s" % (qid, old, new))

    l_changed = unify_links(quotes)
    print("\n제휴 링크 통일: %d건" % len(l_changed))
    seen = set()
    for qid, f, old, new in l_changed:
        q = next(x for x in quotes if x["id"] == qid)
        label = "%s — %s" % (q.get("author"), q.get("bookTitle"))
        if label not in seen:
            seen.add(label)
            print("  %s" % label)

    books = build_books(quotes)

    with open(QUOTES_PATH, "w", encoding="utf-8") as f:
        f.write(prefix + json.dumps(quotes, ensure_ascii=False, indent=2) + suffix)

    with open(BOOKS_PATH, "w", encoding="utf-8") as f:
        f.write("var BOOKS = " + json.dumps(books, ensure_ascii=False, indent=2) + ";\n")

    report(quotes, books)
    print("\n%s, %s 저장 완료" % (QUOTES_PATH, BOOKS_PATH))


if __name__ == "__main__":
    main()

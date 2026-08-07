"""
애드픽 상품 수익링크 API로 quotes.js의 모든 책에 대해
교보문고·예스24 제휴 링크를 일괄 생성해서 저장하는 스크립트.

증분 처리: 이미 kyoboLink/yes24Link가 채워진 항목은 다시 호출하지 않습니다.
콘텐츠를 새로 추가할 때마다 그냥 이 스크립트를 다시 돌리면,
새로 추가된 항목만 처리되고 기존 링크는 그대로 유지됩니다.

실행 전 준비:
  pip install requests

사용법:
  1. 아래 API_KEY 값을 본인 애드픽 API 키로 교체
  2. quotes.js가 이 스크립트와 같은 폴더에 있는지 확인
  3. python generate_affiliate_links.py 실행 (새 글 추가 시 재실행하면 됨)
  4. 완료되면 quotes.js가 kyoboLink/yes24Link 필드까지 포함해서 갱신됨
     (원본은 quotes_backup.js로 자동 백업됨)
"""

import json
import os
import re
import time
import urllib.parse
import shutil

import requests

API_KEY = "edeaa1f8674cb964de8bfe133791d1f90654e7"  # 본인 키로 교체
API_ENDPOINT = "https://deg.kr/cps/click.php"
# 이 스크립트는 scripts/ 에 있고 quotes.js는 www/ 에 있다. APK에 실리지 않도록
# www/ 밖으로 옮겼기 때문에, 어디서 실행하든 스크립트 위치를 기준으로 경로를 잡는다.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUOTES_PATH = os.path.join(_ROOT, "www", "quotes.js")
BACKUP_PATH = os.path.join(_ROOT, "data", "quotes_backup.js")
REQUEST_DELAY_SEC = 0.5  # 짧은 시간에 몰아치면 제한될 수 있다고 안내되어 있어 약간의 텀을 둠

# 인코딩 버그로 깨졌던 예스24 링크를 한 번 다시 만들기 위한 일회성 스위치.
#
# ⚠️ 현재 True 입니다.
# 2중 인코딩으로 만들어 둔 기존 예스24 링크 343개가 전부 깨져 있어서,
# 3중 인코딩으로 전부 다시 생성해야 하기 때문입니다.
# 이번에 한 번 돌려서 정상 동작을 확인한 뒤에는 반드시 False로 되돌려 놓으세요.
# (True로 두면 실행할 때마다 예스24 링크를 전부 다시 만들어 API를 낭비합니다)
FORCE_REGENERATE_YES24 = False


def make_kyobo_search_url(book_title, author):
    query = urllib.parse.quote(f"{book_title} {author}".strip())
    return f"https://search.kyobobook.co.kr/search?keyword={query}"


def make_yes24_search_url(book_title, author):
    # 예스24 검색 URL은 검색어를 2중 인코딩해야 정상 동작한다.
    # (예스24 자체 페이지의 검색 링크도 %25... 형태의 2중 인코딩을 사용)
    #
    # 다만 이 목적지 URL은 애드픽(deg.kr)을 거쳐 전달되는데,
    # 애드픽이 리다이렉트 과정에서 인코딩을 한 겹 벗겨낸다.
    # 따라서 여기서는 3중으로 만들어야 예스24에 2중으로 도착한다.
    # (2026.07 실측 확인: 1중·2중은 검색어가 깨지고 3중만 정상 동작)
    raw = f"{book_title} {author}".strip()
    once = urllib.parse.quote(raw, safe="")
    twice = urllib.parse.quote(once, safe="")
    thrice = urllib.parse.quote(twice, safe="")
    return f"https://www.yes24.com/product/search?domain=BOOK&query={thrice}"


def get_affiliate_link(destination_url):
    # requests의 params=딕셔너리 방식은 이미 인코딩된 문자열을 또 한 번 인코딩해버려서
    # 3중 인코딩(깨짐의 원인)이 됩니다. 그래서 URL을 직접 문자열로 조립해서 호출합니다.
    encoded = urllib.parse.quote(destination_url, safe="")
    full_url = f"{API_ENDPOINT}?apikey={API_KEY}&url={encoded}&print=1"
    try:
        resp = requests.get(full_url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data.get("link", "")
    except Exception as e:
        print(f"  [실패] {destination_url} -> {e}")
        return ""


def main():
    shutil.copy(QUOTES_PATH, BACKUP_PATH)
    print(f"백업 완료: {BACKUP_PATH}")

    with open(QUOTES_PATH, encoding="utf-8") as f:
        content = f.read()

    start = content.index("[")
    end = content.rindex("]")
    prefix = content[:start]
    arr_str = re.sub(r"^\s*//.*$", "", content[start:end + 1], flags=re.MULTILINE)
    data = json.loads(arr_str)

    # 인코딩 문제로 깨졌던 예스24 링크를 비워서, 아래 증분 로직이 새 인코딩으로 다시 생성하게 만든다.
    # (교보문고는 정상이었으니 건드리지 않음). 평소(FORCE_REGENERATE_YES24=False)에는 실행 안 됨.
    if FORCE_REGENERATE_YES24:
        for q in data:
            q["yes24Link"] = ""
        print("[일회성] 예스24 링크 전체 초기화 — 새 인코딩으로 다시 생성합니다.")

    total = len(data)
    stats = {"kyobo": {"processed": 0, "skipped": 0, "failed": 0, "reused": 0},
              "yes24": {"processed": 0, "skipped": 0, "failed": 0, "reused": 0}}

    stores = [
        ("kyoboLink", make_kyobo_search_url),
        ("yes24Link", make_yes24_search_url),
    ]

    # 같은 책(저자+제목)이 여러 항목에 걸쳐 있을 때, 항목마다 API를 새로 호출하면
    # 애드픽이 매번 다른 단축링크를 발급해서 "같은 책인데 링크가 다른" 상태가 됩니다.
    # (그란데는 원문 대조 후 직접 번역이라 특정 판본에 종속되지 않으므로 검색 링크
    #  자체는 문제 없음 — 다만 같은 책은 링크를 하나로 통일해서 낭비/불일치를 없앱니다.)
    # 이미 채워진 링크가 있으면 캐시에 먼저 담아, 이후 같은 책은 API 호출 없이 재사용합니다.
    # volume: 잃어버린 시간을 찾아서처럼 여러 권으로 따로 출간된 작품을 구분하는 필드.
    # (author, bookTitle)만으로 묶으면 이런 다권 작품이 전부 한 권으로 뭉개져서
    # 앞서 결정한 "권별 링크" 원칙이 깨집니다. volume이 없는 일반 단행본은 빈 문자열로
    # 취급되어 기존처럼 (author, bookTitle) 단위로 정상 통일됩니다.
    link_cache = {"kyoboLink": {}, "yes24Link": {}}
    for q in data:
        key = (q.get("author", "").strip(), q.get("bookTitle", "").strip(), q.get("volume", "").strip())
        for field in ("kyoboLink", "yes24Link"):
            if q.get(field) and key not in link_cache[field]:
                link_cache[field][key] = q[field]

    for i, q in enumerate(data):
        book_title = q.get("bookTitle", "").strip()
        author = q.get("author", "").strip()
        volume = q.get("volume", "").strip()
        key = (author, book_title, volume)

        if not book_title:
            for field, _ in stores:
                q.setdefault(field, "")
            continue

        for field, url_maker in stores:
            store_key = "kyobo" if field == "kyoboLink" else "yes24"

            # 같은 책의 링크가 이미 캐시에 있으면 재사용 (API 호출 없이)
            if key in link_cache[field] and link_cache[field][key]:
                if q.get(field) != link_cache[field][key]:
                    q[field] = link_cache[field][key]
                    stats[store_key]["reused"] += 1
                else:
                    stats[store_key]["skipped"] += 1
                continue

            # 이미 링크가 생성되어 있으면 다시 호출하지 않음 (신규 콘텐츠만 처리)
            if q.get(field):
                stats[store_key]["skipped"] += 1
                link_cache[field][key] = q[field]
                continue

            dest_url = url_maker(book_title, author)
            link = get_affiliate_link(dest_url)
            time.sleep(REQUEST_DELAY_SEC)

            if link:
                q[field] = link
                link_cache[field][key] = link
                stats[store_key]["processed"] += 1
            else:
                q[field] = ""
                stats[store_key]["failed"] += 1

        print(f"[{i+1}/{total}] {book_title} -> 교보:{'OK' if q.get('kyoboLink') else '-'} 예스24:{'OK' if q.get('yes24Link') else '-'}")

    out = prefix + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"
    with open(QUOTES_PATH, "w", encoding="utf-8") as f:
        f.write(out)

    print()
    for store_key, label in [("kyobo", "교보문고"), ("yes24", "예스24")]:
        s = stats[store_key]
        print(f"{label}: 신규 성공 {s['processed']} / 재사용(중복 통일) {s['reused']} / 실패 {s['failed']} / 건너뜀(변경없음) {s['skipped']} / 전체 {total}")


if __name__ == "__main__":
    main()

# CUSTOM.md — 내가 원작에서 직접 바꾼 곳

이 포크(`cci0/O.home`)는 원작(`w00j00working/O.home`)에 **태그·검색·RECENT 위젯 등**을 얹은 것입니다.
원작을 [Sync fork]로 업데이트하다 충돌이 나면 이 문서를 보고 어디를 다시 얹을지 확인하세요.

- 바뀐 파일: **새 파일 21 + 기존 파일 수정 27 (세계관 추가로 기존 4개 더 수정)**
- DB(SQL) 변경: 태그는 **없음**(항목 jsonb 안에 저장). **세계관은 `worlds` 테이블 추가 필요** → `supabase/worlds.sql` 실행 (아래 5번).
- 태그 색은 설정 키 `ohome.tagcolors.v1`에 저장됩니다 (아래 ⚠️ 참고).

---

## ⚠️ 가장 먼저 확인할 것

**`src/lib/settingStore.ts`** — 원작이 자주 고치는 핵심 파일이라, 덮어쓰지 말고 **한 줄만** 추가합니다.
`SETTING_KEYS` 목록 맨 끝에 아래 키가 있어야 태그 색이 서버에 저장됩니다.

```ts
'ohome.tagcolors.v1',
```

원작 업데이트 후 이 줄이 사라졌는지 가장 먼저 확인하세요. 없어도 앱은 열리지만 태그 색이 서버에 저장되지 않습니다.

---

## 1. 새 파일 (13개) — 원작과 충돌하지 않음

원작에 없는 파일이라 업데이트로 덮어써지거나 충돌하지 않습니다. 단, 이 파일들이 의존하는 **원작 쪽 함수·타입 이름이 바뀌면** 빌드가 깨질 수 있습니다.

| 파일 | 역할 |
|---|---|
| `lib/tagUtil.ts` | 태그 공용 도구: 파싱, 개수 세기, AND/OR 필터, 접기, 주소(`?tag=`) 연동 |
| `lib/tagColors.ts` | 태그 색상 저장·읽기 |
| `lib/rawList.ts` | 목록 한 번 읽기 + 바뀐 것만 저장 (실시간 구독 없음) |
| `lib/siteEntries.ts` | 전체 항목 모음 (공개 범위·메뉴 비공개 규칙 적용). 태그 모아보기·검색·RECENT가 사용 |
| `components/ui/TagFilter.tsx` | 목록 위 태그 필터 칩 줄 |
| `components/ui/TagList.tsx` | `#태그` 표시 (카드·상세) |
| `components/ui/TagInput.tsx` | 태그 입력 + 자동완성 칩 |
| `components/ui/HtmlRichEditor.tsx` | 리치 에디터 ↔ HTML 코드 전환 |
| `components/settings/TagPane.tsx` | 환경설정 「태그 관리」 탭 |
| `components/chars/CharLogs.tsx` | 캐릭터 상세의 출현 로그 |
| `components/main/RecentWidget.tsx` | 메인 RECENT 위젯 |
| `app/tags/page.tsx` | 태그 모아보기 (`/tags`) |
| `app/search/page.tsx` | 전체 검색 (`/search`) |

---

## 2. 기존 파일 수정 (27개) — 충돌 가능성 있음

원작이 같은 파일의 같은 부분을 고치면 충돌합니다. 충돌 가능성이 높은 순서로 적었습니다.
(모두 「한 곳당 몇 줄 추가」 수준이라, 충돌이 나면 그 줄만 다시 얹으면 됩니다.)

### 🔴 원작이 자주 고칠 만한 파일

| 파일 | 바꾼 내용 |
|---|---|
| `lib/settingStore.ts` | `SETTING_KEYS`에 `'ohome.tagcolors.v1'` 한 줄 추가 |
| `lib/mainStore.tsx` | `WidgetType`에 `'recent'` 추가, `WIDGET_META`에 RECENT 항목 추가 |
| `components/main/widgets.tsx` | `RecentWidget` import + `renderWidget`에 `case 'recent'` 추가 |
| `app/page.tsx` | `ADDABLE` 목록에 `'recent'` 추가 |
| `components/shell/TopBar.tsx` | 상단바에 「검색」 버튼(`/search`) 추가 |
| `app/settings/page.tsx` | import 한 줄 + 탭 이름 `'태그 관리'` + 표시 부분 3줄 (`TagPane`) |

### 🟡 목록 페이지 — 필터 칩 + 태그 표시 추가

`app/chars/page.tsx`, `app/rels/page.tsx`, `app/gallery/page.tsx`, `app/trpg/page.tsx`, `app/playlog/page.tsx`, `app/dotori/page.tsx`, `app/board/page.tsx`

공통으로 바꾼 것: `useTagFilter()`로 선택 태그 상태 추가 → 목록 `.filter()`에 태그 조건 한 줄 → 목록 위에 `<TagFilter .../>` 한 줄 → 카드에 `<TagList .../>` 한 줄.
`app/trpg/page.tsx`는 필터가 오른쪽 사이드에 있어서 칩을 직접 그려 변경량이 가장 큽니다 (등록 모달 태그 칸 포함).

### 🟡 작성·수정 폼 — 태그 입력칸 추가

| 파일 | 바꾼 내용 |
|---|---|
| `components/chars/CharEditForm.tsx` | 태그 입력칸, 저장 시 `tags`, 소개 본문·추가 탭을 `HtmlRichEditor`로 교체 |
| `components/rels/RelForm.tsx` | 태그 입력칸, 저장 시 `tags` |
| `components/trpg/PlaylogForm.tsx` | 태그 입력칸(Tags), 저장 시 `tags` |
| `components/trpg/DotoriForm.tsx` | 기존 태그 칸을 `TagInput`으로 교체 |
| `components/backup/BackupForm.tsx` | 기존 태그 칸을 `TagInput`으로 교체 (갤러리 글 작성) |
| `app/board/write/page.tsx` | 기존 태그 칸을 `TagInput`으로 교체 |
| `app/rels/new/page.tsx`, `app/rels/[id]/edit/page.tsx` | 저장 값에 `tags` 전달 (AU 편집에서는 제외) |

### 🟢 상세 페이지 — 태그 표시 추가

| 파일 | 바꾼 내용 |
|---|---|
| `app/chars/[id]/page.tsx` | 이름 아래 `TagList`, 소개 본문 아래 `CharLogs` |
| `app/rels/[id]/page.tsx` | 히어로(`rel-hero`) **바로 아래** 줄에 `TagList` (13번 참고) |
| `app/trpg/[id]/page.tsx` | 제목 아래 `TagList`(`gridColumn: 1` 포함), 수정 모달 태그 칸 |
| `app/gallery/[id]/page.tsx` | 기존 태그를 눌러서 목록으로 이동 + 태그 색 |

### 🟢 타입만 추가

| 파일 | 바꾼 내용 |
|---|---|
| `lib/charStore.ts` | `Character`, `Relation`에 `tags?: string[]` |
| `lib/galleryStore.ts` | `TrpgLog`, `PlayRecord`에 `tags?: string[]` |

---

## 3. 원작 업데이트 후 확인 순서

1. [Sync fork] / Update branch 누르기 (먼저 환경설정 → 데이터 백업).
2. **충돌 없음** → 배포가 끝나면 아래 5가지만 확인:
   - TRPG 로그 목록에서 태그 필터가 되는지
   - 환경설정에 「태그 관리」 탭이 보이는지
   - `/tags`, `/search`가 열리는지
   - 메인 위젯 추가 목록에 RECENT가 있는지
   - 캐릭터 편집에서 HTML 모드 전환이 보이는지
3. **충돌 있음** → 충돌난 파일 이름을 확인해 위 2번 표에서 그 파일의 「바꾼 내용」만 다시 얹기.
   원작 쪽 최신 파일과 이 문서를 같이 Claude에게 붙여넣으면 맞춰 줄 수 있습니다.
4. **빌드(Vercel) 실패** → 새 파일이 쓰는 원작 함수·타입 이름이 바뀐 경우입니다. Vercel 오류 메시지를 확인하세요.
   (새 파일이 의존하는 주요 원작 요소: `useLocalList`, `fetchList`, `syncList`, `TABLE_OF`, `useAuth`, `useMenuSettings`, `canViewHref`, `sectionHref`, `getRawSetting`/`setSetting`, `RichEditor`, `Kit`의 `KInput`/`KTextarea`/`KCheck`)

## 4. 알아둘 점

- **구독 중복 주의**: 새 파일은 `useLocalList`가 아니라 `useRawList`(한 번 읽기)를 씁니다. 서버(Supabase) 모드에서 같은 목록에 실시간 구독이 두 번 열리면 페이지가 안 열리는 오류가 있었기 때문입니다. 새 기능을 더할 때도 이 점을 지키세요.
- **게시판**은 글마다 읽기 권한이 달라서 `/tags`·`/search`에서 제외했습니다 (게시판 목록 안에서는 태그 필터가 동작).
- **TRPG 로그 본문**은 따로 저장돼서 전체 검색 대상이 아닙니다.
- **출현 로그**는 로그가 자관에 연결돼 있어야 자관 멤버의 캐릭터 상세에 뜹니다.
- 백업 알림은 로컬에만 기록돼서 뺐습니다. (원래 계획에 있었지만 적용하지 않음)

## 5. 세계관 기능 (`/worlds`)

**DB**: Supabase SQL Editor에 `supabase/worlds.sql` 전체를 붙여넣고 Run (여러 번 실행해도 안전). 원작 `schema.sql`은 건드리지 않았고, 원작 SQL을 다시 돌려도 `worlds`는 지워지지 않습니다.
읽기는 공개범위(전체/멤버/나만)를 서버가 지키고, 등록은 관리자만 됩니다.

**새 파일 (충돌 없음)**: `lib/worldStore.ts`, `components/worlds/WorldForm.tsx`, `components/worlds/CharWorld.tsx`, `app/worlds/page.tsx`, `app/worlds/new/page.tsx`, `app/worlds/[id]/page.tsx`, `app/worlds/[id]/edit/page.tsx`, `supabase/worlds.sql`

**기존 파일 수정 (각 1~몇 줄)**
| 파일 | 바꾼 내용 |
|---|---|
| `lib/backend/types.ts` | `COLLECTION_OF`에 `'ohome.worlds.v1': 'worlds'` 한 줄 (백업·이전에 자동 포함) |
| `lib/visFloor.ts` | `AREA`에 `worlds: { href: '/worlds' }` 한 줄 |
| `lib/menu.ts` | `FEATURES`에 `{ href: '/worlds', label: '세계관' }` 한 줄 |
| `lib/charStore.ts` | `Character`에 `worldId?: string` |
| `components/chars/CharEditForm.tsx` | import 1줄, `worldId` 상태, 저장 시 `worldId`, 「소속 세계관」 선택칸 |
| `app/chars/[id]/page.tsx` | `CharWorld` import 1줄 + 이름 아래 `<CharWorld .../>` 1줄 |

**메뉴**: 환경설정 → 메뉴 관리에서 「세계관」을 원하는 곳에 추가해야 상단 메뉴에 보입니다.
**자관**: 세계관 필드가 따로 없고, 세계관 상세에서 소속 캐릭터가 멤버인 자관을 자동으로 모아 보여 줍니다.

## 6. 구독 중복 오류 수정 (갤러리 수정 화면)

| 파일 | 바꾼 내용 |
|---|---|
| `lib/backend/supabaseBackend.ts` | `subscribe()`의 채널 이름에 무작위 꼬리표 추가 (한 줄). 수정 화면처럼 한 화면이 같은 목록을 두 번 읽어도 「구독 후 콜백 추가 불가」 오류가 나지 않음 |

## 7. 세계관 JSON 가져오기

`/worlds` 목록의 관리자용 **IMPORT** 버튼 — 세계관 문서를 JSON 파일(`worlds-import.json`)로 한꺼번에 등록합니다. 새 파일(`app/worlds/page.tsx`) 안의 기능이라 원작과 충돌하지 않습니다. 가져온 세계관은 기본 **나만보기**로 들어오니, 확인 후 각 수정 화면에서 공개범위를 바꾸세요.

## 8. 자관 D-day

자관마다 D-day를 여러 개 걸 수 있고(제목·날짜·+1 Day·「메인 위젯에도 표시」), 자관 상세 이름 아래에 칩으로 보입니다. 위젯 표시를 켠 것은 메인 D-DAY 위젯에 「자관명 · 제목」으로 같이 뜹니다. DB 변경 없음 (자관 데이터 안에 `ddays`로 저장).

**새 파일**: `lib/relDday.ts`, `components/rels/RelDday.tsx`

**기존 파일 수정**
| 파일 | 바꾼 내용 |
|---|---|
| `lib/charStore.ts` | `RelDday` 타입 + `Relation`에 `ddays?` |
| `components/rels/RelForm.tsx` | import 2줄, `ddays` 상태·저장값, D-DAY 편집칸 (AU 편집에서는 숨김) |
| `app/rels/new/page.tsx` | 저장 값에 `ddays` 전달 |
| `app/rels/[id]/edit/page.tsx` | 저장 값에 `ddays` 전달 (AU 편집 제외) |
| `app/rels/[id]/page.tsx` | import 1줄 + 히어로 **바로 아래** 줄에 `<RelDdayChips/>` (13번 참고) |
| `components/main/widgets.tsx` | import 1줄, `DdayWidget`의 `items`에 자관 D-day를 이어 붙임, 행 `key` 변경 |

## 9. 위젯 스크롤 · RECENT 5개 · D-day 칩 색

| 파일 | 바꾼 내용 |
|---|---|
| `app/globals.css` | `.wgt.sized > .widget`에 `overflow-y:auto` + 스크롤바 숨김 세 줄 추가 — 크기를 줄인 위젯이 잘리지 않고 안에서 스크롤 (원작에는 없음, 충돌 시 이 줄만 다시 얹기) |
| `components/main/RecentWidget.tsx` | 보이는 개수 6 → 5 (새 파일) |
| `components/rels/RelDday.tsx` | 자관 D-day 칩을 어두운 반투명 배경 + 흰 글씨로 (밝은 배경에서도 보이게) (새 파일) |

## 9-1. RECENT·태그 모아보기·검색의 종류 이름

| 파일 | 바꾼 내용 |
|---|---|
| `lib/siteEntries.ts` | `ENTRY_LABEL`의 `trpg`를 `'TRPG 로그'` → `'로그'`로 (새 파일) |
| `components/settings/TagPane.tsx` | 「태그 관리」 탭의 종류 버튼·안내 문구도 `'로그'`로 (새 파일) |

## 10. TRPG 로그 상세 — 삭제 후 이동 수정 · 이동 버튼

| 파일 | 바꾼 내용 |
|---|---|
| `app/trpg/[id]/page.tsx` | import 1줄, `deletedRef` 추가 — 삭제 중이면 「로그가 없다」 판정으로 홈(`/`)에 보내지 않음(삭제하면 원래 갤러리 목록으로 감), 맨 아래에 `<LogNav .../>` 1줄 |
| `app/trpg/[id]/page.tsx` (삭제 버튼) | 삭제 후 목록에 지운 로그가 남아 보이던 문제 수정 — 서버 삭제 요청에 저장 키(`'ohome.trpg.v1'`)가 아니라 테이블 이름(`TABLE_OF[...]`)을 넘기도록 고침. 예전엔 요청이 바로 실패해 삭제를 기다리지 않고 목록으로 이동했음. 서버 모드에선 삭제가 끝난 뒤에 이동하고, 실패하면 알림을 띄우고 머무름. 두 번 눌러도 한 번만 삭제 |
| `components/trpg/LogNav.tsx` (새 파일) | 오른쪽 아래에 떠 있는 ↑ 맨 위로 · ‹ 이전 로그 · › 다음 로그 · ☰ 목록 버튼 |

## 11. 모달 속도 개선

| 파일 | 바꾼 내용 |
|---|---|
| `app/globals.css` | **맨 끝**에 `.modal-ov{-webkit-backdrop-filter:none;backdrop-filter:none}` 한 줄 (+주석) — 모달 뒤 흐림을 꺼서 모달 안 입력·스크롤 버벅임 해결. 어둡게 덮는 건 그대로. 원작 줄은 안 건드림 (충돌 시 맨 끝에 이 줄만 다시 얹기) |

## 12. 태그 관리 탭 보기 개선

| 파일 | 바꾼 내용 |
|---|---|
| `components/settings/TagPane.tsx` (새 파일) | 태그 목록을 한 줄씩으로 압축 — 색 점(누르면 색 고르는 칸이 그 줄 아래에 열림) · #태그 · 종류별 개수 · 총 개수 · 「이름 바꾸기 · 삭제」(테두리 없는 글자 버튼, 항상 표시). 위에 태그 찾기 · 정렬(많이 쓴 순/이름순) · 종류 거르기(전체/캐릭터/자관/로그…, 태그가 있는 종류만 표시) 추가. 개수 줄의 「TRPG」 표기도 「로그」로. 기능(이름 바꾸기·합치기·삭제·색)은 그대로 |

## 13. 자관 상세 — 태그·D-day 위치·가독성 정리 (PC·모바일)

태그·D-day를 히어로(`.rel-hero`) **안**에 넣었더니 히어로가 길어져, 원작이 히어로 바닥에 고정해 둔 양쪽 대사가 아래로 밀려 어정쩡하게 떠 있었고, 모바일은 「대사 · 이름 · 태그 · D-day · 대사」로 순서가 꼬였음.

| 파일 | 바꾼 내용 |
|---|---|
| `app/rels/[id]/page.tsx` | `TagList`·`RelDdayChips`를 히어로 `</div>` **바로 뒤** 별도 줄(가운데 정렬, 위 여백 22px)로 옮김. 둘 다 없으면 그 줄 자체를 안 그림. 원작 히어로 안쪽은 원래대로 |
| `components/ui/TagList.tsx` (새 파일) | `chip` 옵션 추가 — 어두운 반투명 칩 + 흰 글씨(D-day 칩과 같은 모양), 태그 색은 앞의 작은 점으로. 자관 상세의 태그에만 `chip`을 켜서 밝은 헤더 위에서도 잘 보이게. 다른 곳의 태그 표시는 그대로 |

충돌 시: 원작 히어로 안에 `TagList`/`RelDdayChips`를 넣지 말고, 히어로 블록이 끝난 뒤에 다시 얹기.

## 14. 세계관 목록 — 2열 배치 · 순서 바꾸기

| 파일 | 바꾼 내용 |
|---|---|
| `app/worlds/page.tsx` (새 파일) | PC는 2열(카드가 화면 폭을 다 채워 너무 길던 것), 좁은 화면은 1열. 관리자 전용 **ORDER** 버튼 → 카드를 끌어다 놓아 순서 변경, **DONE**으로 끝. 끄는 동안은 화면에서만 바뀌고 놓을 때 한 번만 저장. 검색·태그로 걸러 보는 중엔 끌기 막음 |

상단바 편집모드를 쓰지 않은 이유: 편집모드가 켜지는 페이지 목록이 원작 `lib/mainStore.tsx`의 `EDIT_PAGES`라, 거기에 `/worlds`를 넣으면 원작 파일을 고치게 됨(충돌 위험). 그래서 페이지 안에 따로 스위치를 둠.

## 15. 자관 상세 — 방문자 화면에서 저장 시도가 반복되던 문제

원작 자관 상세에는 「삭제된 캐릭터를 가리키는 멤버를 자동으로 빼고 저장」하는 정리 기능이 있는데, 방문자·회원에겐 나만보기 캐릭터가 서버에서 아예 오지 않아 「삭제됨」으로 오인했음.
비로그인은 저장 거부 → 되돌림 → 재시도가 무한 반복(「자관을(를) 저장하지 못했습니다 — [object Object]」 알림 + 화면 튐), 편집 권한 있는 회원은 멤버가 실제로 빠질 위험.

| 파일 | 바꾼 내용 |
|---|---|
| `app/rels/[id]/page.tsx` | 그 자동 정리 `useEffect` 맨 앞에 `if (!isAdmin) return;` 한 줄(+주석), 의존 목록에 `isAdmin` 추가. 관리자 화면에서만 정리. 회원의 직접 저장(수정 화면)은 그대로 |

충돌 시: 원작의 「삭제된 캐릭터를 가리키는 멤버 자동 정리」 효과 안에 `if (!isAdmin) return;`만 다시 얹기.

## 16. 권한 없는 사람에게 「잠금」 표시 (자관 멤버 · 로그)

| 파일 | 바꾼 내용 |
|---|---|
| `app/rels/[id]/page.tsx` | `LockedCard` 컴포넌트 추가 + 2인 배치의 좌·우 카드 자리에서 「멤버는 있는데 그 캐릭터가 이 사람에게 안 보이면」 잠금 카드(🔒 비공개 캐릭터 · 권한이 있는 멤버만 볼 수 있어요)로 자리를 지킴. 예전엔 카드가 아예 안 그려져 카드·일러스트·카드 배치가 한 칸씩 당겨졌음 |
| `app/trpg/[id]/page.tsx` | 권한이 없으면(비밀번호도 없음) 홈으로 보내던 `router.replace('/')`를 지우고 잠금 화면(🔒 제목 · 안내 · 목록으로 / 로그인)을 띄움. 비밀번호 걸린 로그는 원래대로 비밀번호 입력 화면. 로그 자체가 없을 때만 홈으로 |

충돌 시: 자관은 `pairSlots[0]`/`pairSlots[1]` 카드 자리 앞에 `charsLoaded && pairSlots[i] && !charOf(...) ? <LockedCard />` 조건을 다시 얹기. 로그는 권한 없음 → `router.replace('/')` 줄을 다시 빼고 잠금 화면 블록을 다시 얹기.

## 17. 자관 목록 — 「멤버」 뱃지가 카드 폭 전체 막대로 보이던 문제

원작 CSS `.rel-card .nm span`(이름 아래 설명 줄용: `display:block` + 오른쪽 여백 44px)이 이름 옆 「멤버」 뱃지(`<span class="pill">`)에도 걸려, 뱃지가 카드 폭 전체로 늘어났음 (원작에 있던 문제).

| 파일 | 바꾼 내용 |
|---|---|
| `app/globals.css` | **맨 끝**에 `.rel-card .nm b .pill{display:inline-block; …}` 한 줄(+주석) — 뱃지만 원래 알약 모양으로. 원작 줄은 그대로 |

## 18. 캐릭터 목록 — 세계관 탭

캐릭터 목록 위에 「전체 · 세계관A · 세계관B · … · 미지정」 탭. 캐릭터의 「소속 세계관」(worldId)으로 나눔 — 따로 분류 작업 필요 없음.
탭 순서 = 세계관 목록 순서(ORDER), 캐릭터가 있는 세계관만 탭으로, 미지정은 해당 캐릭터가 있을 때만. 고른 탭은 주소 `?world=`에 남음. 처음엔 「전체」.
탭을 바꾸면 태그 선택은 풀리고, 태그 칩은 고른 탭의 캐릭터 태그만 보여 줌. 세계관이 하나도 안 쓰였으면 탭 줄 자체가 안 보임(예전 화면 그대로).

| 파일 | 바꾼 내용 |
|---|---|
| `components/chars/WorldTabs.tsx` (새 파일) | 탭 훅 `useWorldTabs` + 탭 모양(밑줄 탭, 색은 페이지 제목 색 변수) + `mergeInPlace`(걸러 본 상태에서 정렬해도 다른 캐릭터 사이 자리는 그대로) |
| `app/chars/page.tsx` | import 1줄, `seeable`·`world` 두 줄 + `visible` 거르기에 `.filter(world.match)`, 태그칩 위에 `{world.element}`, 태그 개수는 고른 탭 기준, 편집모드 정렬 저장을 `mergeOrder` → `mergeInPlace`로 |

충돌 시: 위 줄들만 다시 얹기 (`mergeOrder` import 줄은 원작 그대로 둠).

## 19. 위젯 공유 (`/widgets`)

AI 채팅 플랫폼(케이브덕 · 티팟 · 기타)에서 만든 위젯을 **작동 예시**와 함께 소개하는 페이지. 가져가기는 각 플랫폼의 **공유 링크**로.

**등록 방식은 위젯마다 선택** (폼 맨 위, 새로 만들 땐 「간단 등록」이 기본)
- **간단 등록**: 이름·소개·공유 링크 + 대표 이미지(스크린샷·GIF)만. 위젯 코드를 다시 붙여 넣을 필요 없음. 상세에는 이미지를 자르지 않고 크게, 목록에는 16:9로.
- **작동 예시까지**: 코드를 붙여 넣어 방문자가 직접 눌러 볼 수 있게 (아래 설명).
(예전 데이터처럼 방식이 안 적힌 위젯은 「작동 예시까지」로 취급. 코드가 비어 있으면 작동 예시 상자는 안 나옴)

**DB**: Supabase SQL Editor에 `supabase/widgets.sql` 전체를 붙여넣고 Run (여러 번 실행해도 안전). 읽기는 공개범위대로, 등록은 관리자만.
**메뉴**: 환경설정 → 메뉴 관리에서 「위젯」을 원하는 곳에 추가해야 상단 메뉴에 보임.

- **작동 예시**: 사이트와 분리된 상자(iframe, `sandbox="allow-scripts"`) 안에서 실행 — 위젯의 `<style>`·스크립트가 사이트에 새지 않음.
  - 케이브덕: 위젯 HTML의 `{{상태값}}`에 **예시 값**을 채워 그림 (`{{user}}`·`{{char}}`는 폼에서 이름 지정, 기본 「유저」·「캐릭터」). 예시가 없으면 상태값 이름이 그대로.
  - 티팟: 티팟과 같은 방식 — unpkg에서 React 18 + Babel을 상자 안에 불러와 JSX를 변환·실행, **Props 표의 예시값**을 넣어 그림. 훅은 import 없이(`useState`…), `sendToChat`·`sendToReroll`은 알림만, 3D(ThreeCanvas)는 안내 문구로 대신.
- **등록 폼**: 케이브덕은 편집 화면을 통째로 복사해 붙이면 상태값·지시사항·HTML을 자동으로 나눠 채움(복사본에 콘텐츠가 두 번 붙어 와도 하나로). 티팟은 「코드에서 Props 불러오기」로 함수 시그니처의 기본값에서 이름·타입·예시값을 채움. 오른쪽에 미리보기가 실시간으로.
- **코드·상태값/Props 공개**: 위젯마다 「방문자에게도 보여 주기」 체크 (관리자는 항상 보임). 코드 복사 버튼.
- **목록**: 플랫폼 탭 · 태그 · 검색 · 관리자 ORDER(놓을 때 한 번 저장, 탭으로 걸러 봐도 다른 위젯 자리 유지). 썸네일은 올린 이미지 → 없으면 케이브덕은 작동 예시를 작게, 티팟은 컴포넌트 이름.

**새 파일 (충돌 없음)**: `lib/widgetStore.ts`, `components/widgets/WidgetPreview.tsx`, `components/widgets/WidgetForm.tsx`, `app/widgets/page.tsx`, `app/widgets/new/page.tsx`, `app/widgets/[id]/page.tsx`, `app/widgets/[id]/edit/page.tsx`, `supabase/widgets.sql`

**기존 파일 수정 (각 1줄)** — 세계관 때와 같은 자리
| 파일 | 바꾼 내용 |
|---|---|
| `lib/backend/types.ts` | `COLLECTION_OF`에 `'ohome.widgets.v1': 'widgets'` (백업·이전에 자동 포함) |
| `lib/visFloor.ts` | `AREA`에 `widgets: { href: '/widgets' }` |
| `lib/menu.ts` | `FEATURES`에 `{ href: '/widgets', label: '위젯' }` |

참고: 위젯의 태그는 위젯 목록 안에서만 걸러짐 (태그 관리·태그 모아보기·전체 검색에는 아직 안 들어감).

## 20. 위젯·세계관 표에 `editor_ids` 칸 추가 (저장이 400으로 거부되던 문제)

원작 업데이트로 저장 시 `editor_ids`(편집 권한 목록) 칸을 항상 함께 보내는데, `widgets.sql`·`worlds.sql`이 예전 양식이라 그 칸이 없어 저장이 거부됐음 (위젯 ADD가 먹통).
- `supabase/widgets.sql`, `supabase/worlds.sql`에 `alter table … add column if not exists editor_ids …` 추가 (이미 만든 표에도 다시 실행하면 칸만 붙음)
- `components/widgets/WidgetForm.tsx`: 저장 실패를 알림으로 표시, 저장 중 표시

**앞으로 새 표를 만들 때**: 원작 `lib/schemaSql.ts`의 표 양식(특히 `editor_ids` 칸)을 따라야 함.

## 21. 위젯 상세 화면 다듬기 · 작동 예시 높이 자동

| 파일 | 바꾼 내용 |
|---|---|
| `app/widgets/[id]/page.tsx` (새 파일) | 상세 화면 새 디자인 — 머리 카드(플랫폼·이름·소개·태그·상태값/Props 수·등록일·「○○에서 가져가기 ↗」·수정/삭제), 창틀 모양 작동 예시 무대(넓게/휴대폰 폭 · 밝게/어둡게 · 점무늬 바탕), 설명, (티팟) 「채팅에서 이렇게 불러요」 호출 태그 예시+복사, 접이식 상태값/Props/코드. 휴대폰 폭에서 넘치지 않게 |
| `components/widgets/WidgetPreview.tsx` (새 파일) | 작동 예시 높이가 위젯에 맞춰 **늘고 줄어듦** — 예전엔 상자 높이(documentElement)를 재서 한 번 커지면 접어도 안 줄었음 → 내용(body) 높이를 재도록. 높이 변화는 부드럽게 |


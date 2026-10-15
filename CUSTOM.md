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

## 22. 위젯 등록 폼 — Props 표 겹침 · 티팟 붙여넣기 안내

| 파일 | 바꾼 내용 |
|---|---|
| `components/widgets/WidgetForm.tsx` (새 파일) | Props 표의 타입 선택 상자가 사이트 공통 최소 폭(150px) 때문에 옆 「예시값」 칸을 덮던 것 → 표 안에서는 칸 폭에 맞춤, 칸 비율 조정. 휴대폰 폭에선 한 줄씩 묶고 「이 줄 삭제」. JSX 칸에 티팟 편집 화면 전체가 들어오면 「코드 칸 안에서 Ctrl+A로 복사」 안내 |

## 23. 자관 상세 — 떠 있는 이동 버튼 (목록으로 · 이전/다음)

로그 상세의 이동 버튼과 같은 모양으로 오른쪽 아래에 ↑ 맨 위로(스크롤했을 때) · ‹ 이전 자관 · › 다음 자관 · ☰ 목록. 이전/다음은 자관 목록 순서대로, 이 사람이 열 수 있는 자관만.

| 파일 | 바꾼 내용 |
|---|---|
| `components/rels/RelNav.tsx` (새 파일) | 이동 버튼 |
| `app/rels/[id]/page.tsx` | import 1줄 + 맨 아래 `{del.element}` 앞에 `<RelNav rels={rels} cur={rel} />` 1줄 |

## 24. 이미지 저장 방지 — 아이폰 길게 누르기 막기

| 파일 | 바꾼 내용 |
|---|---|
| `app/globals.css` | **맨 끝**에 `.img-protect-on img{-webkit-touch-callout:none;-webkit-user-select:none}` 한 줄(+주석). 원작은 우클릭(contextmenu)·끌기만 막아, 그 신호가 없는 아이폰 사파리의 「길게 눌러 저장」이 뚫려 있었음. 관리자 제외는 그대로 |

## 25. 글 복사 방지 (영역별, 로그 본문 포함)

환경설정 → 메뉴 관리(권한) 「이미지 저장 방지」 바로 아래 **「글 복사 방지」** 체크 칸 — 로그 백업 · 게시판(갤러리·로드비 포함) · 자캐 · 자관 · 세계관 · TRPG 캐릭터.
체크한 영역에서 방문자의 글 드래그 선택 · 복사(Ctrl+C·우클릭 복사) · 잘라내기 · 전체 선택(Ctrl+A)을 막음. 관리자 제외 · 즉시 반영. 입력칸(댓글·검색 등)은 그대로.
로그 본문은 분리된 상자(iframe)라 상자 안에도 같은 차단을 넣음(우클릭·끌기·Ctrl+S/P도). 개발자 도구·페이지 저장·캡처는 못 막음(손쉬운 복사 방지 수준).
설정은 메뉴 설정(`ohome.menuset.v1`) 안에 `textProtect`로 함께 저장 — 원작 `SETTING_KEYS`는 안 건드림.

| 파일 | 바꾼 내용 |
|---|---|
| `lib/textProtect.tsx` (새 파일) | 영역 목록 · `TextProtect`(차단) · `useTextProtectActive` · 로그 상자용 `TEXT_PROTECT_IFRAME` · 설정 칸 `TextProtectOptions` |
| `app/layout.tsx` | import 1줄 + `<ImgProtect />` 아래 `<TextProtect />` 1줄 |
| `app/settings/page.tsx` | import 1줄 + 이미지 저장 방지 블록 바로 뒤 `<TextProtectOptions />` 1줄(+주석) |
| `app/trpg/[id]/page.tsx` | import 1줄, `const txtProtect = useTextProtectActive();` 1줄, 로그 주입(inject) 끝에 `+ (txtProtect ? TEXT_PROTECT_IFRAME : '')` |

## 26. 세계관 탭 넘김 버튼 · 태그 줄 접기

| 파일 | 바꾼 내용 |
|---|---|
| `components/chars/WorldTabs.tsx` (새 파일) | 탭 줄을 `TabScroller`로 — 넘칠 때만 탭 줄 오른쪽 끝에 작은 ‹ › (끝에 닿은 쪽은 흐리게), 넘치는 쪽 끝 탭은 살짝 흐려지게(mask), 탭 위에서 마우스 휠만 굴려도 옆으로(예전엔 Shift+휠) |
| `components/ui/TagFilter.tsx` (새 파일) | 태그 칩 줄을 기본 **한 줄**로 접고 오른쪽 끝 「펼치기 ▾」 / 펼치면 맨 끝 「접기 ▴」. 접혀 있어도 고른 태그는 앞으로 당겨 보임. 펼침 여부는 보는 사람 브라우저에 기억(모든 목록 공통). 예전 「+N 더 보기」(24개 기준) 대체. TRPG 로그 목록 오른쪽 세로 태그 칸은 원작 방식 그대로 |


## 27. 캐릭터 양식 (TEMPLATES)

관리자가 **양식 코드(JSON)** 를 등록해 두면, 캐릭터 편집의 「＋ 양식으로 추가」에서 골라 칸만 채우면 탭이 완성되는 기능.
양식의 탭 수만큼 캐릭터 탭이 한꺼번에 생기고(같은 묶음 = 값 공유), 입력 화면은 묶음 전체를 한 화면에서 편집(서식 B·I·S, 「글로 한 번에 입력」, 오른쪽 미리보기).
캐릭터에는 **값만** 저장하고 보여 줄 때 **지금 양식으로 다시 그림** → 양식을 고치면 그 양식을 쓰는 모든 캐릭터에 바로 반영. 양식을 지워도 탭은 마지막 저장 모습(html) 그대로 남음.
입력한 값은 전부 이스케이프(그 안의 HTML은 글자로 보임) — 서식은 `**굵게**` `*기울임*` `~~취소선~~`만. 최종 HTML은 원작 sanitize를 거침.
양식 관리: 세계관 화면 TEMPLATES 버튼 → `/templates` (관리자 전용). 세계관을 연결하면 그 세계관 캐릭터에서 목록 맨 위. 양식 이름은 코드를 안 고치고 「양식 이름」 칸에서 바꿈 · 「내려받기」(.json 백업) · 「복제」(사본 만들어 고쳐 쓰기).
양식 입력 화면: 서식 B·I·S와 탭 고르기 줄이 **스크롤해도 위에 붙어 있음** · 탭마다 **이름·아이콘 바꾸기**(「원래대로」로 되돌리기) · **「이 탭만 빼기」**(내용은 남음) → 「다시 넣기」로 되살림. 양식에 나중에 새 탭이 생겨도 같은 「다시 넣기」로 추가.
**추가 탭 목록은 왼쪽 손잡이(⋮⋮)를 끌어 순서 변경** — 일반 탭·양식 탭 모두, 마우스·터치 모두. 양식 탭은 「양식 · 양식 이름」으로 표시.

**Supabase**: `supabase/char_templates.sql`을 SQL Editor에서 한 번 Run (읽기 누구나 · 쓰기 관리자만 · `editor_ids` 칸 포함). 안 하면 양식 저장 시 「양식 표가 아직 없어요」 알림.

| 파일 | 바꾼 내용 |
|---|---|
| `lib/tplRender.ts` (새 파일) | 양식 코드 검사(`parseTplCode`) · 렌더(`{{key}}` `{{#key}}…{{/key}}` `{{^key}}` `{{.}}` `{{@n}}` `{{key.count}}` `|blank`) · 글↔값 변환 |
| `lib/tplStore.ts` (새 파일) | 양식 목록(`ohome.ctpl.v1` → `char_templates`) · `tabHtmlOf`(양식 탭을 지금 양식으로) |
| `components/chars/TplTabs.tsx` (새 파일) | 양식 고르기 · 양식 탭 입력 화면(붙어 있는 서식 줄 · 탭 이름 · 빼기/다시 넣기) · `tabsFromTpl` |
| `components/chars/TabRows.tsx` (새 파일) | 추가 탭 목록 — 끌어서 순서 바꾸기 |
| `app/templates/page.tsx` (새 파일) | 양식 관리(등록·수정·삭제·미리보기 · 이름 바꾸기 · 내려받기 · 복제). 저장 실패 시 이유를 알림으로 |
| `supabase/char_templates.sql` (새 파일) | 표 + 권한 |
| `lib/backend/types.ts` | `'ohome.ctpl.v1': 'char_templates'` 1줄 |
| `lib/charStore.ts` | `CharTab`에 `tpl?` 1칸(+주석) |
| `lib/firebaseRules.ts` | `char_templates` 규칙 몇 줄 (읽기 공개 · 쓰기 관리자) |
| `app/chars/[id]/page.tsx` | import 1줄 · 탭 HTML을 `tabHtmlOf`로 · 양식 탭은 탭 제목 줄 숨김 |
| `components/chars/CharEditForm.tsx` | import 2줄 · 양식 탭 묶음 삭제 · 양식 탭이면 `TplTabEditView` · 탭 목록 `tabs.map(…)` 블록을 `<TabRows … />` 한 줄로 · ADD TAB 아래 `TplPicker` |
| `app/worlds/page.tsx` (포크 파일) | TEMPLATES 버튼 1줄 |

## 28. 로그 책갈피

로그 상세의 떠 있는 버튼 줄 맨 위 🔖 — 두 가지로 꽂음: **「＋ 지금 읽는 위치」**(화면 위쪽 읽던 줄) · **「줄 골라서 꽂기」**(안내가 뜨면 로그에서 원하는 줄을 눌러 꽂기 — 마우스를 올리면 그 줄이 강조, Esc로 취소. 드래그 선택이 아니라 클릭이라 **글 복사 방지가 켜져 있어도 됨**). 그다음 이름 붙여 저장(기본 이름은 그 줄 대사 앞부분). 책갈피로 이동하면 그 줄이 잠깐 강조됨. 목록에서 누르면 그 자리로 이동, 「이름」·「삭제」(한 번 더 눌러 확인). 「전체」 탭에서 다른 로그의 책갈피를 누르면 그 로그를 열고 그 자리로(`?bm=` 주소).
**각자 자기 것만**: 로그인한 사람은 자기 계정(서버 `bookmarks` 표, 공개범위 private — 관리자 화면에서도 내 것만 걸러 보임), 비로그인 방문자는 그 브라우저에만. 로그인 전에 남긴 책갈피는 「내 계정으로 옮기기」.
위치는 px이 아니라 **로그 상자 안 몇 번째 요소 + 그 안 비율**(일반 글 로그는 몇 번째 글자)로 기억 → PC에서 저장해도 휴대폰에서 같은 대사로 감. 로그를 고쳐 번호가 밀려도 그 자리 글 앞부분으로 다시 찾음. 원본 파일 대체 표시일 때는 버튼 숨김.
데이터 백업·안 쓰는 이미지 정리에는 들어가지 않음(TABLE_OF에 안 넣음 — 원작 파일 안 건드리려고).

**Supabase**: `supabase/bookmarks.sql`을 SQL Editor에서 한 번 Run. 안 하면 로그인한 사람도 브라우저에만 저장되고 「서버 준비 전」이라고 표시됨.

| 파일 | 바꾼 내용 |
|---|---|
| `components/trpg/LogBookmarks.tsx` (새 파일) | 책갈피 저장소(계정/브라우저) · 위치 재기·이동 · 버튼과 목록 · 로그 상자에 넣는 스크립트 `LOG_BM_IFRAME` |
| `supabase/bookmarks.sql` (새 파일) | 표 + 권한 (추가는 본인 이름으로만) |
| `components/trpg/LogNav.tsx` (포크 파일) | `extra` 칸 — 버튼 줄 맨 위에 끼울 버튼 |
| `app/trpg/[id]/page.tsx` | import 1줄 · 로그 주입 끝에 `+ LOG_BM_IFRAME` · `<LogNav … extra={<LogBookmarkButton … />} />` |

## 29. 역극 캐릭터 선택 · BGM 목록 스크롤

| 파일 | 바꾼 내용 |
|---|---|
| `app/globals.css` | **맨 끝**에 몇 줄(+주석). 역극 「발화 캐릭터 선택」(`.rp-pick-pop`)과 BGM 목록(`.bgm-list`)에 높이 제한이 없어, 항목이 많으면 위쪽이 잘린 채 스크롤이 안 됐음(역극은 채팅 창이 넘침을 잘라냄) → 최대 높이 + 안에서 스크롤. BGM 목록은 배경이 반투명이라 뒤 패널이 비쳐 보이던 것도 같은 색을 겹쳐 거의 불투명하게 |

## 30. 최적화 — 로그 본문 하나만 받기 · 업로드 이미지 자동 축소

Supabase 무료 요금제 전송량(egress)을 아끼려고. 화면에 보이는 건 그대로.

**로그 본문** — 원작은 로그 목록·상세를 열 때마다 본문 표(`trpg_log_bodies`)를 통째로 받았다(700KB 이하 본문은 표 안에 글 그대로 → 로그 하나 열 때 모든 로그 본문이 오감. 목업 로그 30개 기준 3.9MB). 이제 상세는 **그 로그 본문 한 행만**, 목록은 **본문을 아예 안 받고** 새 로그 추가 때 그 본문 하나만 저장. 권한(RLS·보안 규칙)은 똑같이 걸림. 서버 없는 로컬 모드는 예전 그대로. 데이터 백업·안 쓰는 이미지 정리는 예전처럼 전체를 읽음(관리자 작업).

**이미지** — 직접 고른 JPG·PNG·WebP 중 1.2MB 넘는 것을 올리기 직전에 긴 변 2560px로 줄여 다시 압축(JPG→JPG, PNG·WebP→WebP로 투명 배경 유지, 사진 회전 반영). GIF·SVG·작은 이미지·줄여도 별로 안 작아지는 이미지는 그대로. 이미 올린 이미지는 안 바뀜. 환경설정 → 메뉴 관리(권한) 「업로드 이미지 자동 축소」에서 끄기 가능, **갤러리(그림 백업)는 기본으로 원본 유지**(체크하면 갤러리도 축소). 설정은 `ohome.menuset.v1` 안 `imgShrink`.

| 파일 | 바꾼 내용 |
|---|---|
| `lib/logBody.ts` (새 파일) | `useLogBody(id)` — 로그 본문 한 행만 읽기/저장 · `addLogBody` — 목록에서 새 본문 하나 저장 |
| `lib/imageShrink.tsx` (새 파일) | `shrinkImage` · 설정 칸 `ImageShrinkOptions` |
| `lib/backend/types.ts` | `fetchById?` 선택 메서드 1줄(+주석) |
| `lib/backend/supabaseBackend.ts` | `fetchById` 추가 (syncList 바로 위) |
| `lib/backend/firebaseBackend.ts` | `fetchById` 추가 (syncList 바로 위, 권한 없으면 null) |
| `lib/blobStore.tsx` | `putBlob` 안 `putBlobNew(blob)` 한 줄 → 축소 후 올리기 |
| `app/trpg/[id]/page.tsx` | import 1줄 · 본문 `useLocalList(...trpgbody...)` → `useLogBody(id)` 1줄 |
| `app/trpg/page.tsx` | import 1줄 · 본문 `useLocalList` 줄 삭제(주석) · `setBodies([...bodies, body])` → `addLogBody(body)` |
| `app/settings/page.tsx` | import 1줄 + `<TextProtectOptions />` 아래 `<ImageShrinkOptions />` 1줄 |

## 31. 로그 안 검색 · 로그 목록 책갈피 표시 · 자관 관계도 · NOTICE 위젯

**로그 안 검색** — 로그 상세의 떠 있는 버튼 줄 🔍 → 화면 위 검색 줄. 찾은 곳 전부 노랗게, 지금 위치는 진하게, 「3/11」 표시. Enter 다음 · Shift+Enter 이전 · Esc 닫기. HTML 로그는 로그 상자 안 스크립트가 찾아 칠하고(책갈피 위치 번호에는 영향 없음), 일반 글 로그는 화면에서 찾음(지원 브라우저는 전부 칠하고 지금 위치는 상자). 대소문자 무시, 한 글 조각 안에서 이어지는 글자만.

**로그 목록 책갈피 표시** — 책갈피가 있는 로그 카드 썸네일 오른쪽 위에 🔖 개수(티켓형·기본형). 누르면 그 로그의 책갈피 목록 → 고르면 로그가 열리며 그 자리로. 목록은 늘 화면 안에(휴대폰에서 왼쪽 밖으로 잘리지 않게 당기고, 아래 공간이 모자라면 위로 펼침). 각자 자기 책갈피만. 목록 전체에서 한 번만 읽어 나눠 씀.

**자관 관계도** (`/rels/map`, 자관 목록 「관계도」 버튼) — 밤하늘 성도 디자인: 지도 판은 사이트 테마와 상관없이 늘 밤하늘(옅은 동심원·방사선·작은 별). 캐릭터 = 자기 색 테두리로 빛나는 초상 별(이름은 사이트 세리프), 2인 자관 = 별자리 선 + 선 위 작은 별과 기울임 세리프 이름, 3인+ 자관 = 네 갈래 별에서 멤버마다 점선. 같은 두 사람 사이 자관이 여럿이면 선이 갈라져 휨. 초상은 원 안에 잘려 들어감(크롭 위치 그대로). 별 누르기 = 그 관계만 밝게 + 왼쪽 아래 정보 카드(연결된 자관 목록 → 자관 페이지, 「캐릭터 페이지 열기」; 휴대폰은 고른 별을 카드 위로 옮겨 줌) · 빈 곳 누르기 = 풀기 · 자관 이름 = 자관 페이지. 끌어서 이동 · 휠/오른쪽 위 버튼(확대·축소·전체 보기) · 세계관 탭. 관리자는 별을 끌어 배치 → 「배치 저장」(메뉴 설정 `ohome.menuset.v1` 안 `relmapPos`, 방문자도 같은 배치) · 「자동 배치로」. 저장 안 한 별은 자동 배치. 볼 수 없는 자관·캐릭터는 안 그림. 성능: 자동 배치는 구성이 바뀔 때만 계산, 끄는 동안은 그 별과 이름만 옮기고, 화면 이동·확대 때는 지도 내용을 다시 그리지 않음(캐릭터 120명 규모에서 끌기·이동 모두 한 프레임 안). 서버에서 읽는 건 자관 목록 페이지와 같은 것(자관·캐릭터·세계관)뿐.

**NOTICE 위젯** — 메인 위젯 추가에 「NOTICE」. 편집모드 우클릭 > 설정: 위젯 제목 · 게시판 · 「공지·고른 태그 글만」/「최근 글(공지 먼저)」 · **함께 띄울 태그**(예: 업데이트 — 쉼표로 여러 개, 그 태그가 달린 글도 공지처럼 뜨고 태그 이름 표시) · 몇 개. 공지가 먼저, 그다음 최신순. 글 누르면 그 글로, 「전체 ›」는 그 게시판으로. 메뉴에서 그 게시판이 비공개면 위젯도 안 보임 · 비밀글은 관리자·작성자에게만.

| 파일 | 바꾼 내용 |
|---|---|
| `components/trpg/LogFind.tsx` (새 파일) | 로그 안 검색 버튼·검색 줄 |
| `components/trpg/LogBmBadge.tsx` (새 파일) | 목록 카드 🔖 표시 · `useBookmarkIndex` |
| `components/trpg/LogBookmarks.tsx` (포크 파일) | 로그 상자 스크립트에 찾기(find/findGo/findClear) 추가 · 찾기 표시가 책갈피 위치 번호에 안 섞이게 · 도우미 몇 개 export |
| `components/rels/RelMap.tsx` (새 파일) · `app/rels/map/page.tsx` (새 파일) | 자관 관계도 |
| `components/main/NoticeWidget.tsx` (새 파일) | NOTICE 위젯 |
| `app/trpg/[id]/page.tsx` | import 1줄 · LogNav `extra`에 `<LogFindButton …/>` 추가 |
| `app/trpg/page.tsx` | import 1줄 · `const bmIdx = useBookmarkIndex();` 1줄 · 티켓 썸네일·기본형 썸네일 안에 `<LogBmBadge …/>` 각 1줄 |
| `app/rels/page.tsx` | 머리 버튼 줄에 「관계도」 버튼 1줄 |
| `lib/mainStore.tsx` | `WidgetType`에 `'notice'` · `WIDGET_META`에 notice 1줄 |
| `app/page.tsx` | `ADDABLE`·`EDITABLE`에 `'notice'` |
| `components/main/widgets.tsx` | import 1줄 · `case 'notice'` 1줄 |

## 32. 최적화 — 같은 표 중복 요청 합치기 · 30초 기억

원작은 목록 화면이 열릴 때마다 필요한 표(캐릭터·로그·자관 등)를 서버에서 통째로 다시 받았다. 메인처럼 위젯 여러 개가 같은 표를 쓰면 같은 표를 두세 번 받고, 페이지를 오갈 때마다 같은 표를 또 받아 Supabase 전송량을 크게 먹었다.

- **중복 합치기** — 같은 표를 동시에 여러 곳에서 부르면 한 번만 받아 나눠 씀
- **30초 기억** — 받은 표를 30초 동안 기억해, 그 안에 다른 페이지로 가도 다시 받지 않고 바로 보여 줌 (화면이 바로 뜨는 효과도)
- **늘 최신 유지** — 이 브라우저에서 글을 쓰기·고치기·지우기하면 그 표의 기억을 바로 버림 · 다른 사람이 바꾼 건 기존 실시간 알림이 오면 기억을 무시하고 새로 받음 · 계정마다 따로 기억(로그인/로그아웃하면 섞이지 않음)
- 한계: 실시간 알림이 닿지 않는 경우 다른 사람의 변경이 최대 30초 늦게 보일 수 있음 → 새로고침하면 바로 반영
- 측정(테스트 데이터): 메인 첫 방문 요청 13 → 11(중복 0) · 캐릭터→캐릭터 상세→자관→관계도→자관 상세→로그→로그 상세→세계관→역극 차례로 이동 시 새로 받은 양 약 8.6MB → 약 1.1MB

| 파일 | 바꾼 내용 |
|---|---|
| `lib/listCache.ts` (새 파일) | `cachedList`(중복 합치기·30초 기억) · `peekList` · `invalidateList` |
| `lib/db.ts` | import 1줄 · `syncList` 안 저장 앞뒤로 `invalidateList(coll)` |
| `lib/postStore.ts` | import 1줄 · `useLocalList` 첫 상태를 기억에서 · `fetchList` → `cachedList(...)` · 실시간 알림 시 `load(true)` |
| `lib/rawList.ts` (포크 파일) | import 1줄 · `fetchList` → `cachedList(...)` |

## 33. 관계도 확대 시 흐림 수정 · 이미지 해독을 화면 멈춤 없이

**관계도 흐림** — 31번에서 끌기를 빠르게 하려고 지도 전체에 `will-change:transform`을 늘 걸어 두었더니, 브라우저가 처음 배율로 그린 그림을 늘려 쓰느라 확대하면 흐려졌다(호버한 별만 애니메이션 동안 잠깐 또렷). 이제 화면을 옮기거나 확대·축소하는 동안에만 켜고, 멈추고 0.4초 뒤 풀어서 지금 배율로 다시 또렷하게 그린다. 끄는 속도는 그대로.

**이미지 해독** — 사이트 이미지 대부분(썸네일·크롭 이미지)에 `decoding="async"`를 붙여, 큰 이미지를 푸는 동안 화면이 멈추지 않게 함. 테스트(6MB 사진 24장): 캐릭터 목록 첫 이동 때 0.5초 멈춤 → 없음.

| 파일 | 바꾼 내용 |
|---|---|
| `components/rels/RelMap.tsx` (포크 파일) | `moving` 상태 · `.relmap-stage.moving`에만 will-change |
| `lib/blobStore.tsx` | `BlobImg`의 `<img>`에 `decoding="async"` 1곳 |
| `components/ui/CropEditor.tsx` | 크롭 이미지 `<img>`에 `decoding="async"` 1곳 |

## 34. 등록 직후 「캐릭터를 찾을 수 없습니다」 수정

캐릭터를 등록하면 저장을 시작하자마자 상세 페이지로 넘어가는데, 상세 페이지가 저장이 끝나기 전에 목록을 받아 와 새 캐릭터가 없는 목록을 보고 「찾을 수 없습니다」로 멈췄다(실시간 알림도 페이지가 막 열린 순간에는 아직 연결 전이라 놓침). 캐릭터는 저장돼 있어서 새로고침하면 보였다.

이제 어떤 표를 저장하는 동안 그 표를 읽으려는 화면은 **저장이 끝난 뒤에** 받는다(최대 8초까지만 기다림). 캐릭터뿐 아니라 로그·자관·게시글 등 「저장하고 바로 그 페이지로 이동」하는 모든 곳에 적용.

| 파일 | 바꾼 내용 |
|---|---|
| `lib/listCache.ts` (포크 파일) | `trackWrite` · 읽기 전에 그 표 저장이 끝나길 기다림 |
| `lib/db.ts` | `syncList`를 저장 작업으로 알림(`trackWrite`) — 몇 줄 |

## 35. 캐릭터별 상세 배치 (기본 · 반반 · 정보 넓게 · 정보만)

캐릭터 상세 머리의 **LAYOUT** 버튼(관리자·편집 권한 회원)으로 그 캐릭터의 그림과 오른쪽 정보 너비를 고른다. 고르면 바로 저장되고 방문자도 같은 배치로 본다.
- 기본: 지금처럼 그림 크게 · 정보 380px
- 반반: 그림과 정보를 같은 너비로
- 정보 넓게: 그림은 좁은 세로 띠, 정보를 크게
- 정보만: 그림을 숨기고 정보만 넓게 (정보 안에 그림을 직접 꾸며 둔 캐릭터용)

AU를 보는 중이면 그 AU에만 저장된다. AU에서 안 고르면(「원본 따르기」) 원본 캐릭터의 배치를 따른다. 휴대폰(960px 이하)은 원래처럼 위아래로 쌓이고, 「정보만」이면 그림만 숨긴다. 값은 캐릭터 정보 안 `detailLayout`(AU는 `auProfiles[키].detailLayout`) — 편집 화면에서 저장해도 지워지지 않는다. Supabase에서 할 일 없음.

| 파일 | 바꾼 내용 |
|---|---|
| `components/chars/DetailLayout.tsx` (새 파일) | 배치 고르기 버튼 · 배치 CSS · `detailLayoutOf` |
| `app/chars/[id]/page.tsx` | import 1줄 · EDIT 옆에 `<DetailLayoutButton …/>` · `.profile-wrap`에 `lay-…` 클래스와 `<style>` 1줄 |

## 36. 맨 위로 버튼 (사이트 전체)

어느 페이지든 600px 넘게 내려가면 오른쪽 아래에 ↑ 버튼이 뜨고, 누르면 맨 위로 부드럽게 올라간다(캐릭터·로그 목록·게시판·갤러리·캐릭터 상세 등 전부). 페이지마다 따로 붙이지 않고 사이트 틀에 하나만 둠.
- 띄우지 않는 곳: 로그 상세·자관 상세(자기 이동 버튼 줄에 ↑가 이미 있음), 역극·메모 보드·관계도(스크롤 개념이 다름)
- BGM 플레이어를 가리지 않는 높이(휴대폰 아래 전폭 바 위로 올라감)

| 파일 | 바꾼 내용 |
|---|---|
| `components/shell/ScrollTop.tsx` (새 파일) | 맨 위로 버튼 |
| `app/layout.tsx` | import 1줄 · `<BgmPlayer />` 아래 `<ScrollTopButton />` 1줄 |

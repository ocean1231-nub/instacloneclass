# 데이터베이스 개발 명세

## 범위와 저장 원칙

2026년 11월 3일 완료된 화면과 [backend.md](backend.md)의 수업 범위를 따른다. 개발 중과 배포 후 모두 Supabase PostgreSQL을 사용하고, 사진 파일은 Supabase Storage에 저장한다.

애플리케이션 테이블은 `users`, `posts`, `likes`, `comments` 4개다. 팔로우·게시물 저장·DM은 화면 데모로 유지하며 이번 DB에는 저장하지 않는다. 이 데이터를 다른 테이블의 JSON·배열 컬럼에 넣어 우회 구현하지 않는다.

Supabase Auth는 사용하지 않는다. `users`는 앱 자체의 회원 테이블이며 `auth.users`의 ID·세션을 참조하지 않는다. 회원가입·로그인·토큰 발급·사용자별 권한 확인은 FastAPI가 맡는다.

## 공통 규칙

- 네 테이블은 Data API에 노출하지 않는 `app` 스키마에 둔다. Supabase가 관리하는 Storage 내부 테이블 등은 앱의 네 테이블과 별개이며 직접 수정하지 않는다.
- 각 테이블의 `id`는 PostgreSQL `integer` identity 기본키다. 연결되는 외래 키도 같은 정수형을 쓴다. ID와 `created_at`은 서버·DB에서 생성한다.
- 시간은 `timestamptz`로 저장하고 API에는 UTC ISO 8601 형식으로 반환한다. `created_at`은 생성 시각이며 기본값은 DB의 현재 시각이다.
- 외래 키·고유성·필수값·본문 길이는 DB에서 보장하고 FastAPI에서도 검증한다. SQLAlchemy의 매개변수 바인딩을 사용한다.
- 사용자·게시물 삭제는 현재 기능에 없다. 외래 키는 참조 대상 삭제를 제한해 연결 데이터가 고아로 남지 않게 한다. 삭제 API나 삭제 연쇄 처리 기능을 추가하지 않는다.
- 화면의 개수와 사용자별 반응은 원본 행에서 계산한다. 작성자 이름·프로필 사진을 게시물이나 댓글마다 중복 저장하지 않는다.

## users

회원가입·로그인, 공개 프로필, 프로필 편집, 사용자 검색에 필요한 데이터다.

| 컬럼 | 자료형 | 필수·기본값 | 용도·제약 |
|---|---|---|---|
| `id` | integer identity | 기본키 | 앱 사용자 식별자 |
| `username` | varchar(30) | 필수, 고유 | 사용자 이름과 프로필 주소; 공백 정리 후 소문자로 저장, 3~30자 |
| `password_hash` | text | 필수 | FastAPI가 생성한 비밀번호 해시; 원문 저장·API 반환 금지 |
| `display_name` | varchar(50) | 필수 | 화면의 이름, 1~50자; 가입 시 이름이 비면 username 사용 |
| `bio` | varchar(150) | 필수, 빈 문자열 | 소개, 최대 150자 |
| `avatar_url` | text | 선택, null | **기존 컬럼 유지**; Supabase Storage의 프로필 사진 공개 URL |
| `created_at` | timestamptz | 필수, 생성 시각 | 회원 생성 시각 |

현재 비밀번호 입력 안내에 맞춰 FastAPI에서 4자 이상을 검사한다. 입력 비밀번호 길이 규칙을 해시 문자열의 길이에 적용하지 않는다. 로그인 시에도 사용자 이름을 같은 방법으로 정리해 조회한다.

수정 가능한 항목은 `display_name`, `bio`, `avatar_url`이다. 이름은 공백만 저장할 수 없고 빈 사진 주소는 null로 정규화한다. 사진 주소가 없으면 화면에서 Storage에 준비한 기본 아바타를 사용한다. 사용자 이름 변경·이메일·전화번호·관리자 역할·회원 상태·비밀번호 재설정용 필드는 현재 화면에 없으므로 추가하지 않는다.

## posts

피드·탐색·프로필 격자·릴스 사진 미리보기에 공통으로 사용하는 게시물이다.

| 컬럼 | 자료형 | 필수·기본값 | 용도·제약 |
|---|---|---|---|
| `id` | integer identity | 기본키 | 게시물 식별자 |
| `author_id` | integer | 필수, 외래 키 | `users.id`; FastAPI가 토큰에서 결정 |
| `image_url` | text | 필수 | Supabase Storage에 저장한 사진 한 장의 공개 URL |
| `caption` | varchar(2000) | 필수, 빈 문자열 | 화면의 문구, 최대 2,000자 |
| `location` | varchar(100) | 선택, null | 현재 피드에서 표시하는 위치 문자열; 지도 좌표가 아님 |
| `created_at` | timestamptz | 필수, 생성 시각 | 피드와 프로필 게시물 정렬 기준 |

사진이 없는 게시물은 저장하지 않는다. 작성 화면에는 위치 입력란이 없으므로 신규 게시물의 `location`은 null이다. 위치가 있는 학습용 게시물을 표시하는 데만 선택값을 쓴다. 위치 등록·검색·지도 기능을 추가하지 않는다.

사진 바이너리, Base64, 브라우저 `blob:` URL은 저장하지 않는다. 작성자 사용자 이름·표시 이름·프로필 사진은 `users`를 조인한다. 릴스 미리보기용 별도 게시물·동영상 테이블은 만들지 않는다.

## likes

로그인 사용자의 게시물 좋아요와 취소를 저장한다.

| 컬럼 | 자료형 | 필수·기본값 | 용도·제약 |
|---|---|---|---|
| `id` | integer identity | 기본키 | 좋아요 식별자 |
| `user_id` | integer | 필수, 외래 키 | `users.id`; 토큰의 사용자 |
| `post_id` | integer | 필수, 외래 키 | `posts.id` |
| `created_at` | timestamptz | 필수, 생성 시각 | 좋아요 생성 시각 |

`(user_id, post_id)`에 고유 제약을 둔다. 같은 사용자의 중복·동시 요청에서도 한 행만 남는다. 취소는 해당 사용자·게시물 쌍의 행만 삭제하며 이미 없어도 성공한다. `likes`는 게시물 좋아요만 저장하고 북마크나 댓글 좋아요에 겸용하지 않는다.

## comments

피드의 빠른 댓글과 댓글 패널이 함께 사용하는 데이터다.

| 컬럼 | 자료형 | 필수·기본값 | 용도·제약 |
|---|---|---|---|
| `id` | integer identity | 기본키 | 댓글 식별자 |
| `author_id` | integer | 필수, 외래 키 | `users.id`; 토큰의 사용자 |
| `post_id` | integer | 필수, 외래 키 | `posts.id` |
| `body` | varchar(500) | 필수 | 앞뒤 공백 정리 후 1~500자, 공백뿐인 본문 금지 |
| `created_at` | timestamptz | 필수, 생성 시각 | 댓글 표시 순서 |

댓글 작성자 이름·사진은 `users`를 조인한다. 답글의 부모 ID, 댓글 좋아요 수, 수정·삭제 상태는 두지 않는다. 화면의 “좋아요 · 답글 달기”와 하트는 현재 정적 표시이며 서버 기능이 아니다.

## 관계·계산값·인덱스

| 관계 | 의미 |
|---|---|
| users 1 : N posts | 한 사용자의 여러 게시물 |
| users 1 : N likes, posts 1 : N likes | 사용자와 게시물 사이의 좋아요 |
| users 1 : N comments, posts 1 : N comments | 사용자별·게시물별 댓글 |

| 응답 값 | 계산 방식 |
|---|---|
| `post_count` | 해당 사용자가 작성한 posts 행 수 |
| `like_count` | 해당 게시물의 likes 행 수 |
| `comment_count` | 해당 게시물의 comments 행 수 |
| `is_liked` | 로그인 사용자·게시물 쌍의 likes 존재 여부; 비로그인은 false |

위 값은 별도 컬럼으로 저장하지 않는다. 좋아요와 댓글을 함께 조회할 때 조인으로 행 수가 곱해져 개수가 부풀지 않도록 각각 집계한다. 화면의 샘플 숫자를 실제 저장 건수에 덧붙이지 않는다.

| 인덱스·제약 | 대상 조회 |
|---|---|
| users.username 고유 인덱스 | 로그인, 중복 확인, 사용자별 주소 |
| posts(created_at DESC, id DESC) | 최신 피드 |
| posts(author_id, created_at DESC, id DESC) | 프로필의 작성 게시물·개수 |
| likes(user_id, post_id) 고유 인덱스 | 내 좋아요 여부·중복 방지 |
| likes(post_id) | 게시물 좋아요 수 |
| comments(post_id, created_at, id) | 댓글 목록·개수 |
| comments(author_id) | 사용자 외래 키 참조 확인 |

기본키와 고유 제약으로 만들어지는 인덱스를 중복 생성하지 않는다. 부분 문자열 검색은 수업용 소규모 데이터에 맞춰 기존 username·display_name·caption을 조회한다. 검색 기록 테이블·검색 엔진·전문 검색용 파생 컬럼은 추가하지 않는다.

## Storage와 접근 경계

사진은 공개 버킷 `post-images`에 저장한다. 게시물은 `posts/{user_id}/…`, 수업용 프로필 사진은 `avatars/…` 경로를 쓴다. 예시 데이터는 `examples/…` 경로에 둔다. `posts.image_url`과 `users.avatar_url`에는 이 프로젝트의 공개 HTTPS URL만 저장한다. 프로필 사진은 현재 화면에 맞춰 미리 준비된 주소를 입력하는 방식이며 업로드용 테이블이나 API는 없다.

FastAPI만 게시물 사진을 업로드하며, 업로드 후 DB 저장에 실패하면 해당 요청이 올린 객체를 정리한다. 사진 파일과 DB 행은 서로 다른 저장소이므로 하나의 DB 트랜잭션으로 함께 롤백된다고 가정하지 않는다. 공개 사진 조회와 서버 전용 쓰기 권한을 구분한다. [Supabase Storage 접근 모델](https://supabase.com/docs/guides/storage/buckets/fundamentals)을 따른다.

Data API는 비활성화하며 `app` 스키마를 공개하지 않는다. `anon`·`authenticated`에는 앱 테이블 권한을 주지 않는다. FastAPI 전용 DB 역할에는 users의 조회·추가·수정, posts·comments의 조회·추가, likes의 조회·추가·삭제와 필요한 identity 시퀀스 사용 권한만 부여한다. 사용자별 소유권은 FastAPI가 확인하며 Supabase Auth의 `auth.uid()` 정책에 의존하지 않는다. [서버 직접 연결 보안 기준](https://supabase.com/docs/guides/database/secure-data)을 참고한다.

## 보존과 검증

개발과 배포에서 같은 자료형·제약·저장 방식을 사용한다. FastAPI를 재시작하거나 재배포해도 Supabase의 행과 사진이 남아야 한다. DB 백업과 사진 파일 보관은 별개로 확인하며 DB 행만으로 사진 원본을 복구할 수 있다고 가정하지 않는다.

서버 연결 후 중복 사용자 이름·중복 좋아요, 없는 사용자·게시물을 가리키는 외래 키, 빈 댓글이 저장되지 않는지 확인한다. 두 사용자로 로그인해 프로필 수정·좋아요·댓글 작성자가 서로 섞이지 않는지 확인한다. 생성 시각이 앱 실행일로 덮어써지지 않고 사진 URL이 새로고침 후에도 유효해야 한다.

## 제외한 데이터와 절차

- `follows`, `conversations`, `messages`, 북마크 테이블 및 관련 관계·인덱스: 화면 데모만 남기는 수업 범위에 따라 제외한다.
- 팔로워·팔로잉 수, 내 팔로우·북마크 상태, DM·읽음·온라인 상태: 이번 서버가 저장·계산하지 않는다.
- 알림, 스토리, 영상, 댓글 답글·좋아요, 신고·차단: 현재 실제 기능 흐름이 없어 추가하지 않는다.
- 테마, 검색어, 선택 탭, 미리보기 파일, 앱을 연 날짜: 프론트엔드 상태로 처리한다.
- Supabase Auth 회원·세션과 연결하는 컬럼: FastAPI 자체 인증을 사용한다.
- SQLite DB 파일·외래 키 활성화 단계·DB 전환 과정·마이그레이션 도구 도입 절차·로컬 업로드 폴더 유지 조건: Supabase를 사용하는 이번 수업 명세에서 제외한다.

서버는 시작할 때 네 테이블과 `post-images` 버킷이 없으면 생성한다. 비어 있는 DB에만 예시 사용자 2명과 게시물 6개를 추가한다.

# Trip Room MVP

여행 친구들과 방을 만들고, 지도에 장소를 같이 추가하고, 채팅으로 공유하는 MVP입니다.

## 실행
```bash
npm install
cp .env.example .env
npm run dev
```

`.env`에 Supabase URL/anon key, Kakao JavaScript 키를 넣으세요.

## Supabase 설정
1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase.sql` 전체 실행
3. Database > Replication/Realtime에서 `messages`, `places`, `room_members` 테이블 realtime 활성화

## 기능
- 방 만들기 / 방 찾기
- 방 비밀번호 입장
- 사용자 이름 localStorage 유지
- Kakao 지도 + 장소 검색
- 장소 태그 추가: 관광, 식당, 숙소, 카페, 기타
- 장소 추가 시 지도 마커 표시 + 채팅 자동 알림
- 방별 실시간 채팅
- 참여자 목록 / 나가기

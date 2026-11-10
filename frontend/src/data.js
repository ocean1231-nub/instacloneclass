export const photos = [
  'https://picsum.photos/seed/insta-green/900/1050', 'https://picsum.photos/seed/insta-coffee/900/1050',
  'https://picsum.photos/seed/insta-sunset/900/1050', 'https://picsum.photos/seed/insta-flower/900/1050',
];
export const initialPosts = [
  { id: 1, user: 'minji.daily', name: '김민지', avatar: 'https://i.pravatar.cc/100?img=47', location: '서울, 대한민국', image: photos[0], caption: '초록초록한 주말 산책 🌿 햇살이 너무 좋았다', likes: 284, liked: false, saved: false, comments: [{ user: 'dahye.log', text: '사진 분위기 너무 좋다 💚' }, { user: 'seojun', text: '여기 어디야?' }] },
  { id: 2, user: 'coffee.zip', name: '커피집', avatar: 'https://i.pravatar.cc/100?img=12', location: '성수동', image: photos[1], caption: '오늘의 커피와 작은 여유 ☕', likes: 126, liked: true, saved: false, comments: [{ user: 'minji.daily', text: '라떼 맛있겠다!' }] },
  { id: 3, user: 'yun.archive', name: '윤아', avatar: 'https://i.pravatar.cc/100?img=44', location: '부산', image: photos[2], caption: '바다 노을은 언제 봐도 최고야 🌅', likes: 512, liked: false, saved: true, comments: [] },
  { id: 4, user: 'flower.note', name: '꽃노트', avatar: 'https://i.pravatar.cc/100?img=32', location: '연남동', image: photos[3], caption: '작은 꽃 한 송이로 기분 전환 🌼', likes: 98, liked: false, saved: false, comments: [] },
];
export const starterUsers = [
  { username: 'minji.daily', name: '김민지', bio: '산책과 일상을 기록해요 🌿', avatar: 'https://i.pravatar.cc/100?img=47', followed: false },
  { username: 'dahye.log', name: '다혜', bio: '오늘의 작은 행복을 모아요 ✨', avatar: 'https://i.pravatar.cc/100?img=49', followed: false },
  { username: 'yun.archive', name: '윤아', bio: '여행과 사진, 가끔 커피', avatar: 'https://i.pravatar.cc/100?img=44', followed: false },
  { username: 'coffee.zip', name: '커피집', bio: '커피 한 잔의 여유 ☕', avatar: 'https://i.pravatar.cc/100?img=12', followed: false },
  { username: 'flower.note', name: '꽃노트', bio: '꽃과 함께하는 하루 🌼', avatar: 'https://i.pravatar.cc/100?img=32', followed: false },
];
export const initialProfile = { username: 'your_id', name: '내 이름', bio: '나의 일상을 기록해요 ✨', avatar: 'https://i.pravatar.cc/100?img=5' };
export const appOpenedAt = new Date();
export const appOpenedDateLabel = appOpenedAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
export function readStorage(key, fallback) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
export function persistStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* optional local demo storage */ } }

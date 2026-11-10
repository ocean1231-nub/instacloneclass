import { Film, Home, Plus, Search, Send } from 'lucide-react';
const items = [['home', '홈', Home], ['explore', '탐색', Search], ['reels', '릴스', Film], ['create', '새 게시물', Plus], ['inbox', '메시지', Send]];
export default function BottomNav({ page, avatar, onNavigate }) {
  return <nav className="bottom-nav" aria-label="주요 메뉴">{items.map(([key, label, Icon]) => <button key={key} className={page === key ? 'selected' : ''} aria-label={label} onClick={() => onNavigate(key)}><Icon /></button>)}<button className={page === 'profile' || page === 'user-profile' ? 'selected' : ''} aria-label="프로필" onClick={() => onNavigate('profile')}><img className="nav-avatar" src={avatar} alt="내 프로필 사진" /></button></nav>;
}

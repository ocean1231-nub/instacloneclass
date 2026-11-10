import { Bookmark, Camera, Ellipsis, Grid3X3, LogOut, MessageCircle, Pencil, Settings } from 'lucide-react';
import { useState } from 'react';
import IconButton from '../components/IconButton.jsx';
export default function ProfilePage({ user, posts, isOwn, followed, onEdit, onFollow, onMessage, onPost, onSettings, onAuth, onLogout }) {
  const [tab, setTab] = useState('posts');
  const shownPosts = tab === 'saved' && isOwn ? posts.filter(post => post.saved) : posts;
  return <section className="profile-page">
    <div className="profile-top"><h2>{user.username}</h2><div className="profile-top-actions">{isOwn ? <><IconButton label="설정" onClick={onSettings}><Settings /></IconButton>{onAuth ? <button className="profile-auth-button" onClick={onAuth}>로그인</button> : <button className="profile-logout-button" onClick={onLogout}><LogOut />로그아웃</button>}<IconButton label="프로필 편집" onClick={onEdit}><Pencil /></IconButton></> : <IconButton label="사용자 메뉴" onClick={onSettings}><Ellipsis /></IconButton>}</div></div>
    <div className="profile-summary"><img className="profile-avatar" src={user.avatar} alt={`${user.name} 프로필 사진`} /><div className="profile-counts"><div><strong>{posts.length}</strong><span>게시물</span></div><div><strong>{user.followers || 0}</strong><span>팔로워</span></div><div><strong>{user.following || 0}</strong><span>팔로잉</span></div></div></div>
    <div className="profile-bio"><strong>{user.name}</strong><p>{user.bio}</p></div>
    {isOwn ? <div className="profile-buttons"><button className="soft-button" onClick={onEdit}>프로필 편집</button><button className="soft-button" onClick={onSettings}>설정</button></div> : <div className="profile-buttons"><button className={`primary-button follow-button ${followed ? 'following' : ''}`} onClick={onFollow}>{followed ? '팔로잉' : '팔로우'}</button><button className="soft-button" onClick={onMessage}>메시지</button></div>}
    <div className="profile-tabs"><button className={tab === 'posts' ? 'active' : ''} aria-label="게시물" onClick={() => setTab('posts')}><Grid3X3 /></button>{isOwn && <button className={tab === 'saved' ? 'active' : ''} aria-label="저장한 게시물" onClick={() => setTab('saved')}><Bookmark /></button>}</div>
    {shownPosts.length ? <div className="profile-grid">{shownPosts.map(post => <button key={post.id} onClick={() => onPost(post)} aria-label={`${post.user} 게시물 보기`}><img src={post.image} alt={`${post.user} 게시물`} /></button>)}</div> : <div className="empty-profile"><div className="camera-outline"><Camera /></div><h2>{tab === 'saved' ? '저장한 게시물 없음' : '사진 공유'}</h2><p>{tab === 'saved' ? '저장한 게시물이 여기에 표시됩니다.' : '사진을 공유하면 프로필에 표시됩니다.'}</p>{isOwn && tab === 'posts' && <button onClick={onPost}>첫 사진 공유하기</button>}{!isOwn && <button onClick={onMessage}><MessageCircle size={15} /> 메시지 보내기</button>}</div>}
  </section>;
}

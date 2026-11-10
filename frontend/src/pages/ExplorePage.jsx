import { Search, X } from 'lucide-react';
export default function ExplorePage({ search, setSearch, query, users, posts, onFollow, onUser, onPost }) {
  return <section className="explore-page"><div className="search-box"><Search /><input aria-label="검색" placeholder="검색" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="검색 지우기" onClick={() => setSearch('')}><X /></button>}</div>
    {query && <div className="search-results">{users.filter(user => `${user.username} ${user.name}`.toLowerCase().includes(query.toLowerCase())).map(user => <div className="suggestion-row" key={user.username}><button className="user-search-link" onClick={() => onUser(user.username)}><img className="avatar" src={user.avatar} alt={`${user.username} 프로필 사진`} /><span className="suggestion-info"><strong>{user.username}</strong><span>{user.name}</span></span></button><button className="soft-button compact" onClick={() => onFollow(user.username)}>{user.followed ? '팔로잉' : '팔로우'}</button></div>)}</div>}
    <div className="explore-grid">{posts.map((post, index) => <button key={post.id} className={index % 5 === 0 ? 'tall' : ''} onClick={() => onPost(post)} aria-label={`${post.user} 게시물 열기`}><img src={post.image} alt={`${post.user} 게시물`} /></button>)}</div>
  </section>;
}

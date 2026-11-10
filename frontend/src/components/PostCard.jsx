import { Bookmark, Ellipsis, Heart, MessageCircle, Send } from 'lucide-react';
import IconButton from './IconButton.jsx';
import { appOpenedAt, appOpenedDateLabel } from '../data.js';
export default function PostCard({ post, onLike, onSave, onComment, onProfile, onShare, onPostMenu, commentDraft, onCommentDraft, onQuickComment }) {
  return <article className="post" data-post-id={post.id}>
    <div className="post-head"><button className="author-link" onClick={() => onProfile(post.user)} aria-label={`${post.user} 프로필 보기`}><img className="avatar" src={post.avatar} alt={`${post.user} 프로필 사진`} /></button><div className="post-author"><button onClick={() => onProfile(post.user)}><strong>{post.user}</strong></button>{post.location && <span>{post.location}</span>}</div><IconButton label="게시물 메뉴" onClick={() => onPostMenu(post)}><Ellipsis /></IconButton></div>
    <div className="post-image-wrap"><img className="post-image" src={post.image} alt={`${post.user}의 게시물 사진`} /></div>
    <div className="post-actions"><div className="action-left"><IconButton label={post.liked ? '좋아요 취소' : '좋아요'} className={post.liked ? 'liked' : ''} onClick={() => onLike(post.id)}><Heart fill={post.liked ? 'currentColor' : 'none'} /></IconButton><IconButton label="댓글 보기" onClick={() => onComment(post)}><MessageCircle /></IconButton><IconButton label="공유" onClick={() => onShare(post)}><Send /></IconButton></div><IconButton label={post.saved ? '저장 취소' : '저장'} className={post.saved ? 'saved' : ''} onClick={() => onSave(post.id)}><Bookmark fill={post.saved ? 'currentColor' : 'none'} /></IconButton></div>
    <div className="post-meta"><strong>좋아요 {post.likes.toLocaleString()}개</strong><p><button onClick={() => onProfile(post.user)}><strong>{post.user}</strong></button> {post.caption}</p>{((post.commentCount || 0) + post.comments.length) > 0 && <button className="muted-link" onClick={() => onComment(post)}>댓글 {(post.commentCount || 0) + post.comments.length}개 모두 보기</button>}<time dateTime={appOpenedAt.toISOString()}>{appOpenedDateLabel}</time></div>
    <form className="quick-comment" onSubmit={e => { e.preventDefault(); onQuickComment(post.id); }}><input aria-label={`${post.user} 댓글 달기`} placeholder="댓글 달기..." value={commentDraft} onChange={e => onCommentDraft(post.id, e.target.value)} /><button type="submit">게시</button></form>
  </article>;
}

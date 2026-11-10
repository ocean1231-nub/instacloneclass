import PostCard from '../components/PostCard.jsx';
import FeedStatus from '../components/FeedStatus.jsx';
export default function FeedPage({ profile, users, posts, onStory, status, error, onRetry, ...postProps }) {
  if (status !== 'ready' || !posts.length) return <FeedStatus status={status} error={error} onRetry={onRetry} />;
  return <><div className="stories"><button className="story own" onClick={() => onStory(profile.username)}><span className="story-ring"><img src={profile.avatar} alt={`${profile.username} 프로필 사진`} /></span><small>내 스토리</small></button>{users.map(user => <button className="story" key={user.username} onClick={() => onStory(user.username)}><span className="story-ring"><img src={user.avatar} alt={`${user.username} 프로필 사진`} /></span><small>{user.username}</small></button>)}</div><div className="feed-list">{posts.map(post => <PostCard key={post.id} post={post} {...postProps} commentDraft={postProps.commentDraftFor?.[post.id] || ''} />)}</div></>;
}

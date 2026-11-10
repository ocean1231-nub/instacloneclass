import { useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import BottomNav from './components/BottomNav.jsx';
import Dialogs from './components/Dialogs.jsx';
import FeedPage from './pages/FeedPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ExplorePage from './pages/ExplorePage.jsx';
import CreatePage from './pages/CreatePage.jsx';
import InboxPage from './pages/InboxPage.jsx';
import ReelsPage from './pages/ReelsPage.jsx';
import FeedStatus from './components/FeedStatus.jsx';
import { api, defaultAvatar, fetchPosts } from './api.js';
import { initialProfile, persistStorage, readStorage, starterUsers } from './data.js';

function routeFromHash() {
  const route = window.location.hash.slice(1);
  if (route.startsWith('user/')) return { page: 'user-profile', username: decodeURIComponent(route.slice(5)) };
  if (['home', 'profile', 'explore', 'reels', 'create', 'inbox'].includes(route)) return { page: route, username: '' };
  return { page: 'home', username: '' };
}

export default function App() {
  const [theme, setTheme] = useState(() => readStorage('insta-theme', 'system'));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [{ page, username: routeUsername }, setRoute] = useState(routeFromHash);
  const [posts, setPosts] = useState([]);
  const [feedStatus, setFeedStatus] = useState('loading');
  const [feedError, setFeedError] = useState('');
  const [feedAttempt, setFeedAttempt] = useState(0);
  const [users, setUsers] = useState([]);
  const [profile, setProfile] = useState(() => readStorage('insta-profile', initialProfile));
  const [account, setAccount] = useState(null);
  const [modal, setModal] = useState('');
  const [activePost, setActivePost] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [messages, setMessages] = useState(() => readStorage('insta-messages', []));
  const [chatUser, setChatUser] = useState(null);
  const [draft, setDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [quickDrafts, setQuickDrafts] = useState({});
  const [newImage, setNewImage] = useState('');
  const [newFile, setNewFile] = useState(null);
  const [newCaption, setNewCaption] = useState('');
  const [form, setForm] = useState({ username: '', password: '', name: '' });
  const [authError, setAuthError] = useState('');
  const [authPending, setAuthPending] = useState(false);
  const [profileDraft, setProfileDraft] = useState(profile);
  const photoRef = useRef(null);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  const query = search.trim();
  const currentProfile = profile;
  const selectedUser = users.find(user => user.username === routeUsername);
  const profileUser = page === 'user-profile' ? selectedUser : currentProfile;
  const visiblePosts = useMemo(() => page === 'explore' && query ? posts.filter(post => `${post.user} ${post.caption}`.toLowerCase().includes(query.toLowerCase())) : posts, [page, posts, query]);
  const ownPosts = posts.filter(post => post.user === profile.username);
  const reelPost = posts[2] || posts[0];

  useEffect(() => {
    localStorage.removeItem('insta-demo-accounts');
    localStorage.removeItem('insta-account');
    api('/users').then(list => setUsers(list.map(user => ({ username: user.username, name: user.display_name, avatar: user.avatar_url || defaultAvatar, bio: '', followed: false })))).catch(() => {});
    if (!localStorage.getItem('photo-access-token')) return;
    api('/users/me').then(user => {
      setAccount({ username: user.username });
      setProfile({ username: user.username, name: user.display_name, bio: user.bio || '', avatar: user.avatar_url || defaultAvatar });
    }).catch(() => { localStorage.removeItem('photo-access-token'); setFeedAttempt(value => value + 1); });
  }, []);

  useEffect(() => {
    if (page !== 'user-profile' || !routeUsername) return;
    api(`/users/by-username/${encodeURIComponent(routeUsername)}`).then(user => setUsers(current => {
      const entry = { username: user.username, name: user.display_name, avatar: user.avatar_url || defaultAvatar, bio: user.bio || '', followed: current.find(item => item.username === user.username)?.followed || false };
      return [...current.filter(item => item.username !== user.username), entry];
    })).catch(() => {});
  }, [page, routeUsername]);

  useEffect(() => {
    const controller = new AbortController();
    setFeedStatus('loading');
    setFeedError('');
    fetchPosts({ signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setPosts(result);
      api('/users').then(list => setUsers(current => list.map(user => ({ username: user.username, name: user.display_name, avatar: user.avatar_url || defaultAvatar, bio: current.find(item => item.username === user.username)?.bio || '', followed: current.find(item => item.username === user.username)?.followed || false })))).catch(() => {});
      setUsers(current => {
        const byUsername = new Map(current.map(user => [user.username, user]));
        for (const post of result) {
          const existing = byUsername.get(post.user);
          byUsername.set(post.user, {
            ...existing, id: post.authorId, username: post.user, name: post.name,
            avatar: post.avatar, bio: existing?.bio || '', followed: existing?.followed || false,
          });
        }
        return [...byUsername.values()];
      });
      setFeedStatus('ready');
    }).catch(error => {
      if (controller.signal.aborted) return;
      setFeedError(error.message);
      setFeedStatus('error');
    });
    return () => controller.abort();
  }, [feedAttempt]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = event => setSystemDark(event.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);
  useEffect(() => { const onHash = () => { setModal(''); setRoute(routeFromHash()); }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { const onKeyDown = event => { if (event.key === 'Escape' && modal) setModal(''); }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [modal]);
  useEffect(() => { persistStorage('insta-theme', theme); }, [theme]);
  useEffect(() => { persistStorage('insta-users', users); }, [users]);
  useEffect(() => { persistStorage('insta-profile', profile); }, [profile]);
  useEffect(() => { persistStorage('insta-messages', messages); }, [messages]);
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(''), 2200); return () => clearTimeout(timer); }, [toast]);

  function retryFeed() { setFeedAttempt(current => current + 1); }

  function navigate(nextPage, targetUsername = '') {
    const nextHash = nextPage === 'user-profile' ? `user/${encodeURIComponent(targetUsername)}` : nextPage;
    setModal('');
    setRoute({ page: nextPage, username: targetUsername });
    if (window.location.hash.slice(1) !== nextHash) window.history.pushState(null, '', `#${nextHash}`);
  }
  function showPage(nextPage) {
    if (nextPage === 'create' && !requireAuth('게시물 작성')) return;
    navigate(nextPage);
  }
  function showUser(username) {
    if (username === profile.username) return navigate('profile');
    if (users.some(user => user.username === username)) navigate('user-profile', username);
  }
  function requireAuth(action) {
    if (account) return true;
    setToast(`${action}하려면 로그인해 주세요`);
    setForm({ username: '', password: '', name: '' });
    setAuthError('');
    setModal('auth');
    return false;
  }
  function updatePost(id, change) { setPosts(current => current.map(post => post.id === id ? change(post) : post)); }
  async function toggleLike(id) { if (!requireAuth('좋아요')) return; const post = posts.find(item => item.id === id); if (!post) return; try { const result = await api(`/posts/${id}/like`, { method: post.liked ? 'DELETE' : 'PUT' }); updatePost(id, item => ({ ...item, liked: result.is_liked, likes: result.like_count })); } catch (error) { setToast(error.message); } }
  function toggleSave(id) { if (!requireAuth('저장')) return; updatePost(id, post => ({ ...post, saved: !post.saved })); }
  async function openComments(post) { setActivePost(post); setCommentDraft(''); setModal('comments'); try { const comments = await api(`/posts/${post.id}/comments`); const mapped = comments.map(item => ({ user: item.author.username, text: item.body })); setActivePost(current => current?.id === post.id ? { ...current, comments: mapped } : current); } catch (error) { setToast(error.message); } }
  async function addComment(event) {
    event.preventDefault();
    if (!requireAuth('댓글')) return;
    if (!commentDraft.trim() || !activePost) return;
    try { const result = await api(`/posts/${activePost.id}/comments`, { method: 'POST', body: JSON.stringify({ body: commentDraft.trim() }) }); const comment = { user: result.comment.author.username, text: result.comment.body }; updatePost(activePost.id, post => ({ ...post, commentCount: result.comment_count })); setActivePost(post => ({ ...post, comments: [...post.comments, comment], commentCount: result.comment_count })); setCommentDraft(''); } catch (error) { setToast(error.message); }
  }
  function onQuickDraft(id, value) { setQuickDrafts(current => ({ ...current, [id]: value })); }
  async function submitQuickComment(id) {
    if (!requireAuth('댓글')) return;
    const text = (quickDrafts[id] || '').trim();
    if (!text) { setToast('댓글 내용을 입력해 주세요'); return; }
    try { const result = await api(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ body: text }) }); updatePost(id, post => ({ ...post, commentCount: result.comment_count })); onQuickDraft(id, ''); setToast('댓글을 남겼어요'); } catch (error) { setToast(error.message); }
  }
  function choosePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setToast('이미지 파일을 선택해 주세요'); return; }
    setNewFile(file); setNewImage(URL.createObjectURL(file));
  }
  async function publish() {
    if (!requireAuth('게시물 작성')) return;
    if (!newImage) { setToast('사진을 먼저 선택해 주세요'); return; }
    if (feedStatus !== 'ready') { setToast('게시물을 불러온 뒤 미리 볼 수 있어요'); return; }
    try { const body = new FormData(); body.append('image', newFile); body.append('caption', newCaption); await api('/posts', { method: 'POST', body }); setNewFile(null); setNewImage(''); setNewCaption(''); retryFeed(); navigate('home'); setToast('게시물을 공유했어요'); } catch (error) { setToast(error.message); }
  }
  async function submitAuth(event) {
    event.preventDefault();
    if (authPending) return;
    const username = form.username.trim();
    const usernameLength = Array.from(username).length;
    const passwordLength = Array.from(form.password).length;
    if (usernameLength < 3 || usernameLength > 30) { setAuthError('사용자 이름은 3~30자로 입력해 주세요.'); return; }
    if (passwordLength < 4 || passwordLength > 256) { setAuthError('비밀번호는 4~256자로 입력해 주세요.'); return; }
    if (Array.from(form.name).length > 50) { setAuthError('이름은 50자 이내로 입력해 주세요.'); return; }
    setAuthError(''); setAuthPending(true);
    try { const result = await api(`/auth/${modal === 'signup' ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify({ username, password: form.password, display_name: form.name || null }) }); localStorage.setItem('photo-access-token', result.access_token); const user = await api('/users/me'); setAccount({ username: user.username }); setProfile({ username: user.username, name: user.display_name, bio: user.bio || '', avatar: user.avatar_url || defaultAvatar }); setForm({ username: '', password: '', name: '' }); setModal(''); retryFeed(); setToast('로그인했어요'); } catch (error) { setAuthError(error.message); } finally { setAuthPending(false); }
  }
  function openAuth() { setForm({ username: '', password: '', name: '' }); setAuthError(''); setModal('auth'); }
  function logout() { localStorage.removeItem('photo-access-token'); setAccount(null); setProfile(initialProfile); setModal(''); retryFeed(); setToast('로그아웃했어요'); }
  async function submitProfile(event) {
    event.preventDefault(); if (!requireAuth('프로필 수정')) return;
    try { const user = await api('/users/me', { method: 'PATCH', body: JSON.stringify({ display_name: profileDraft.name, bio: profileDraft.bio, avatar_url: profileDraft.avatar === defaultAvatar ? null : profileDraft.avatar }) }); setProfile({ username: user.username, name: user.display_name, bio: user.bio, avatar: user.avatar_url || defaultAvatar }); setToast('프로필을 저장했어요'); setModal(''); retryFeed(); } catch (error) { setToast(error.message); }
  }
  function toggleFollow(username) {
    if (!requireAuth('팔로우')) return;
    setUsers(current => current.map(user => user.username === username ? { ...user, followed: !user.followed } : user));
  }
  function startNewChat() { if (!requireAuth('메시지')) return; setModal('new-chat'); }
  function startChat(user) { if (!user || !requireAuth('메시지')) return; setChatUser(user); setDraft(''); setModal('chat'); }
  function sendMessage(event) {
    event.preventDefault(); if (!draft.trim() || !chatUser) return;
    setMessages(current => [...current, { id: Date.now(), to: chatUser.username, from: profile.username, text: draft.trim(), time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }]);
    setDraft('');
  }
  function lastMessage(username) {
    const message = [...messages].reverse().find(item => (item.from === profile.username && item.to === username) || (item.to === profile.username && item.from === username));
    return message?.text || '';
  }
  function reelAction(action) {
    const post = reelPost;
    if (!post) return;
    if (action === 'like') toggleLike(post.id);
    if (action === 'save') toggleSave(post.id);
    if (action === 'comment') openComments(post);
    if (action === 'share') setToast('공유할 링크를 준비했어요');
  }

  const selectedFollowed = selectedUser?.followed || false;
  const dialogProps = { modal, onClose: () => setModal(''), theme, setTheme: value => { setTheme(value); setToast('테마를 변경했어요'); }, account, onLogout: logout, onAuth: openAuth,
    form, setForm, authError, authPending, onSubmit: submitAuth, onSwitch: () => { setForm({ username: '', password: '', name: '' }); setAuthError(''); setModal(modal === 'signup' ? 'auth' : 'signup'); },
    draft: profileDraft, setDraft: setProfileDraft, onSubmitProfile: submitProfile,
    post: activePost, users, currentProfile: profile, commentDraft, setCommentDraft, onCommentSubmit: addComment,
    chatUser, messages, currentUser: profile.username, messageDraft: draft, setMessageDraft: setDraft, onMessageSubmit: sendMessage,
    onChooseUser: startChat,
  };

  return <div className={`app-shell ${dark ? 'dark' : 'light'}`}>
    <div className="phone"><Header onHome={() => showPage('home')} onInbox={() => showPage('inbox')} onNotifications={() => setToast('새 알림이 없어요')} />
      <main className={`main-content ${page === 'home' ? 'feed-page' : ''}`}>
        {page === 'home' && <FeedPage profile={profile} users={users} posts={posts} status={feedStatus} error={feedError} onRetry={retryFeed} onStory={showUser} onProfile={showUser} onLike={toggleLike} onSave={toggleSave} onComment={openComments} onShare={() => setToast('공유할 링크를 준비했어요')} onPostMenu={() => setToast('게시물 메뉴')} commentDraftFor={quickDrafts} onCommentDraft={onQuickDraft} onQuickComment={submitQuickComment} />}
        {page === 'explore' && (feedStatus === 'ready' ? <ExplorePage search={search} setSearch={setSearch} query={query} users={users} posts={visiblePosts} onFollow={toggleFollow} onUser={showUser} onPost={openComments} /> : <FeedStatus status={feedStatus} error={feedError} onRetry={retryFeed} />)}
        {page === 'create' && <CreatePage image={newImage} caption={newCaption} setCaption={setNewCaption} inputRef={photoRef} choosePhoto={choosePhoto} onPublish={publish} />}
        {page === 'inbox' && <InboxPage username={profile.username} avatar={profile.avatar} users={users} search={search} setSearch={setSearch} lastMessage={lastMessage} onNewChat={startNewChat} onChat={startChat} onRequests={() => setModal('requests')} />}
        {page === 'reels' && (feedStatus === 'ready' && reelPost ? <ReelsPage post={reelPost} onLike={() => reelAction('like')} onComment={() => reelAction('comment')} onShare={() => reelAction('share')} onSave={() => reelAction('save')} /> : <FeedStatus status={feedStatus} error={feedError} onRetry={retryFeed} emptyMessage="미리 볼 게시물이 없어요" />)}
        {(page === 'profile' || page === 'user-profile') && feedStatus !== 'ready' && <FeedStatus status={feedStatus} error={feedError} onRetry={retryFeed} />}
        {page === 'user-profile' && feedStatus === 'ready' && !profileUser && <FeedStatus status="ready" emptyMessage="이 사용자를 찾을 수 없어요" />}
        {(page === 'profile' || page === 'user-profile') && feedStatus === 'ready' && profileUser && <ProfilePage user={profileUser} posts={page === 'profile' ? ownPosts : posts.filter(post => post.user === profileUser.username)} isOwn={page === 'profile'} followed={selectedFollowed}
          onEdit={page === 'profile' ? () => { if (requireAuth('프로필 수정')) { setProfileDraft(profile); setModal('edit-profile'); } } : undefined}
          onFollow={() => toggleFollow(profileUser.username)} onMessage={() => startChat(profileUser)} onPost={post => typeof post === 'object' ? openComments(post) : showPage('create')}
          onSettings={() => page === 'profile' ? setModal('settings') : setToast(`${profileUser.username}님의 프로필`)} onAuth={!account ? openAuth : undefined} onLogout={logout} />}
      </main>
      <BottomNav page={page} avatar={profile.avatar} onNavigate={showPage} />
      <Dialogs {...dialogProps} profileDraft={profileDraft} setProfileDraft={setProfileDraft} onProfileSubmit={submitProfile} messageDraft={draft} setMessageDraft={setDraft} onMessageSubmit={sendMessage} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  </div>;
}

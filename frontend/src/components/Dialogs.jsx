import { ArrowLeft, Check, Heart, Instagram, LockKeyhole, LogOut, Moon, Send, Settings, Sun, X } from 'lucide-react';
import IconButton from './IconButton.jsx';

function Frame({ title, children, onClose, sheet = false, right = null }) {
  return <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal ${sheet ? 'sheet' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-head"><button className="modal-back" aria-label="닫기" onClick={onClose}>{sheet ? <X /> : <ArrowLeft />}</button><strong>{title}</strong>{right || <span />}</div>{children}
  </section></div>;
}

function AuthDialog({ mode, form, setForm, onSubmit, onSwitch, onClose, error, pending }) {
  const signup = mode === 'signup';
  return <Frame title={signup ? '가입하기' : '로그인'} onClose={onClose}><form className="auth-form" onSubmit={onSubmit}>
    <div className="auth-logo"><Instagram size={42} /><span>Instagram</span></div><p className="auth-intro">친구들의 사진과 소식을 만나보세요.</p>
    {signup && <input placeholder="이름" autoComplete="name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />}
    <input autoComplete="username" placeholder="사용자 이름" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} />
    {signup && <p className="auth-hint">사용자 이름은 3~30자로 입력해 주세요.</p>}
    <input autoComplete={signup ? 'new-password' : 'current-password'} type="password" placeholder="비밀번호 (4자 이상)" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={pending}>{pending ? '처리 중…' : signup ? '가입하기' : '로그인'}</button>
    <div className="auth-switch">{signup ? '이미 계정이 있나요?' : '계정이 없으신가요?'} <button type="button" onClick={onSwitch}>{signup ? '로그인' : '가입하기'}</button></div>
    <p className="demo-note"><LockKeyhole size={13} /> 계정은 서버에서 안전하게 관리돼요</p>
  </form></Frame>;
}

function SettingsDialog({ theme, setTheme, account, onLogout, onAuth, onClose }) {
  const options = [['light', '라이트 모드', <Sun />], ['dark', '다크 모드', <Moon />], ['system', '기기 설정 따르기', <Settings />]];
  return <Frame title="설정" onClose={onClose}><div className="settings-content"><h3>테마</h3><p>원하는 화면 모드를 선택하세요.</p>{options.map(([value, label, icon]) => <button key={value} className="setting-choice" onClick={() => setTheme(value)}>{icon}<span>{label}</span>{theme === value && <Check className="setting-check" />}</button>)}<div className="settings-divider" />{account ? <button className="setting-choice danger" onClick={onLogout}><LogOut /><span>로그아웃 ({account.username})</span></button> : <button className="primary-button" onClick={onAuth}>로그인</button>}</div></Frame>;
}

function EditProfileDialog({ draft, setDraft, onSubmit, onClose }) {
  return <Frame title="프로필 편집" onClose={onClose}><form className="edit-form" onSubmit={onSubmit}>
    <label className="avatar-edit"><img src={draft.avatar} alt="프로필 미리보기" /><span><input aria-label="프로필 사진 주소" type="url" value={draft.avatar} onChange={event => setDraft({ ...draft, avatar: event.target.value })} placeholder="프로필 사진 주소" /></span></label>
    <label>이름<input aria-label="이름" maxLength="50" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
    <label>소개<textarea aria-label="소개" maxLength="150" rows="3" value={draft.bio} onChange={event => setDraft({ ...draft, bio: event.target.value })} /></label>
    <button className="primary-button">저장</button>
  </form></Frame>;
}

function CommentsDialog({ post, users, currentProfile, draft, setDraft, onSubmit, onClose }) {
  return <Frame title="댓글" sheet onClose={onClose}><div className="comments-list">{post?.comments.length ? post.comments.map((comment, index) => {
    const author = comment.user === currentProfile.username ? currentProfile : users.find(user => user.username === comment.user);
    return <div className="comment-row" key={`${comment.user}-${index}`}><img className="avatar small" src={author?.avatar || `https://i.pravatar.cc/100?u=${comment.user}`} alt={`${comment.user} 프로필 사진`} /><div><p><strong>{comment.user}</strong> {comment.text}</p><small>좋아요 · 답글 달기</small></div><Heart size={15} /></div>;
  }) : <div className="no-comments"><Heart size={36} /><strong>첫 댓글을 남겨보세요</strong><span>생각을 공유해 보세요.</span></div>}</div>
    <form className="comment-compose" onSubmit={onSubmit}><img className="avatar small" src={currentProfile.avatar} alt={`${currentProfile.username} 프로필 사진`} /><input aria-label="댓글 달기" placeholder="댓글 달기..." value={draft} onChange={event => setDraft(event.target.value)} /><button disabled={!draft.trim()}>게시</button></form>
  </Frame>;
}

function ChatDialog({ user, messages, currentUser, draft, setDraft, onSubmit, onClose }) {
  if (!user) return <Frame title="메시지 요청" onClose={onClose}><div className="no-comments">요청이 없어요</div></Frame>;
  const thread = messages.filter(message => (message.from === currentUser && message.to === user.username) || (message.to === currentUser && message.from === user.username));
  return <Frame title={user.username} sheet onClose={onClose}><div className="chat-messages">{thread.map(message => <div key={message.id} className={`bubble ${message.from === currentUser ? 'mine' : ''}`}>{message.text}</div>)}{!thread.length && <p className="chat-empty">대화를 시작해 보세요.</p>}</div><form className="comment-compose" onSubmit={onSubmit}><input aria-label="메시지 입력" placeholder="메시지 입력..." value={draft} onChange={event => setDraft(event.target.value)} /><button disabled={!draft.trim()}>보내기</button></form></Frame>;
}

function NewChatDialog({ users, currentUser, onChoose, onClose }) {
  return <Frame title="새 메시지" onClose={onClose}><div className="new-chat-list">{users.filter(user => user.username !== currentUser).map(user => <button className="inbox-row" key={user.username} onClick={() => onChoose(user)}><img className="avatar" src={user.avatar} alt={`${user.username} 프로필 사진`} /><div><strong>{user.username}</strong><span>{user.name}</span></div></button>)}</div></Frame>;
}

export default function Dialogs(props) {
  switch (props.modal) {
    case 'auth': case 'signup': return <AuthDialog mode={props.modal} form={props.form} setForm={props.setForm} onSubmit={props.onSubmit} onSwitch={props.onSwitch} onClose={props.onClose} error={props.authError} pending={props.authPending} />;
    case 'settings': return <SettingsDialog theme={props.theme} setTheme={props.setTheme} account={props.account} onLogout={props.onLogout} onAuth={props.onAuth} onClose={props.onClose} />;
    case 'edit-profile': return <EditProfileDialog draft={props.profileDraft} setDraft={props.setProfileDraft} onSubmit={props.onProfileSubmit} onClose={props.onClose} />;
    case 'comments': return <CommentsDialog post={props.post} users={props.users} currentProfile={props.currentProfile} draft={props.commentDraft} setDraft={props.setCommentDraft} onSubmit={props.onCommentSubmit} onClose={props.onClose} />;
    case 'chat': case 'requests': return <ChatDialog user={props.modal === 'requests' ? null : props.chatUser} messages={props.messages} currentUser={props.currentUser} draft={props.messageDraft} setDraft={props.setMessageDraft} onSubmit={props.onMessageSubmit} onClose={props.onClose} />;
    case 'new-chat': return <NewChatDialog users={props.users} currentUser={props.currentUser} onChoose={props.onChooseUser} onClose={props.onClose} />;
    default: return null;
  }
}

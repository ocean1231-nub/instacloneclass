export const defaultAvatar = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#d9e5ef"/><circle cx="50" cy="36" r="18" fill="#7a91a8"/><path d="M15 100a35 35 0 0 1 70 0" fill="#7a91a8"/></svg>')}`;

export async function api(path, options = {}) {
  const token = localStorage.getItem('photo-access-token');
  const headers = { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetch(`/api${path}`, { ...options, headers }); }
  catch { throw new Error('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const field = Array.isArray(data.detail) ? data.detail[0]?.loc?.at(-1) : null;
    const validation = { username: '사용자 이름은 3~30자로 입력해 주세요.', password: '비밀번호는 4~256자로 입력해 주세요.', display_name: '이름은 50자 이내로 입력해 주세요.' };
    throw new Error(typeof data.detail === 'string' ? data.detail : validation[field] || '입력 내용을 확인하고 다시 시도해 주세요.');
  }
  return data;
}

export function toFeedPosts(payload) {
  if (!Array.isArray(payload)) throw new Error('게시물 응답을 확인할 수 없어요.');
  return payload.map(post => {
    if (!Number.isInteger(post.id) || !post.author || !Number.isInteger(post.author.id)
      || typeof post.author.username !== 'string' || typeof post.image_url !== 'string'
      || !Number.isInteger(post.like_count) || post.like_count < 0
      || !Number.isInteger(post.comment_count) || post.comment_count < 0) {
      throw new Error('게시물 응답을 확인할 수 없어요.');
    }
    return {
      id: post.id,
      authorId: post.author.id,
      user: post.author.username,
      name: post.author.display_name || post.author.username,
      avatar: post.author.avatar_url || defaultAvatar,
      image: post.image_url,
      caption: post.caption || '',
      location: post.location || '',
      createdAt: post.created_at,
      likes: post.like_count,
      liked: Boolean(post.is_liked),
      commentCount: post.comment_count,
      comments: [],
      saved: false,
      source: 'server',
    };
  });
}

export async function fetchPosts({ signal, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
  try {
    const response = await fetchImpl('/api/posts', {
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(localStorage.getItem('photo-access-token') ? { Authorization: `Bearer ${localStorage.getItem('photo-access-token')}` } : {}) },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('게시물을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    return toFeedPosts(await response.json());
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new Error('연결이 지연되고 있어요. 다시 시도해 주세요.');
    throw new Error('게시물을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

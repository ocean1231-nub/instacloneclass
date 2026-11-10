export default function FeedStatus({ status, error, onRetry, emptyMessage = '아직 게시물이 없어요' }) {
  if (status === 'loading') return <div className="feed-status" role="status" aria-live="polite"><span className="feed-spinner" aria-hidden="true" /><strong>게시물을 불러오는 중이에요</strong></div>;
  if (status === 'error') return <div className="feed-status" role="alert"><strong>게시물을 불러올 수 없어요</strong><p>{error}</p><button className="primary-button" onClick={onRetry}>다시 시도</button></div>;
  return <div className="feed-status" role="status"><strong>{emptyMessage}</strong></div>;
}

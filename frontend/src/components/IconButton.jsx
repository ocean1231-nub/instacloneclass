export default function IconButton({ label, children, onClick, className = '' }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} onClick={onClick}>{children}</button>;
}

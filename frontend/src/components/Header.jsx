import { ChevronDown, Heart, Send } from 'lucide-react';
import IconButton from './IconButton.jsx';
export default function Header({ onHome, onInbox, onNotifications }) {
  return <header className="topbar"><button className="brand" onClick={onHome} aria-label="홈으로"><span className="brand-script">Instagram</span><ChevronDown size={15} /></button><div className="header-actions"><IconButton label="알림" onClick={onNotifications}><Heart /></IconButton><IconButton label="메시지" onClick={onInbox}><Send /></IconButton></div></header>;
}

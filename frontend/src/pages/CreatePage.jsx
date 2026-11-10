import { ImagePlus } from 'lucide-react';
export default function CreatePage({ image, caption, setCaption, inputRef, choosePhoto, onPublish }) {
  return <section className="create-page"><div className="section-title"><h2>새 게시물 만들기</h2><button className="text-action" onClick={onPublish}>공유</button></div>{image ? <img className="upload-preview" src={image} alt="게시물 미리보기" /> : <div className="upload-prompt large"><ImagePlus size={64} /><p>사진과 동영상을 여기에 끌어다 놓으세요</p><button className="primary-button" onClick={() => inputRef.current?.click()}>컴퓨터에서 선택</button></div>}<input ref={inputRef} type="file" accept="image/*" hidden onChange={choosePhoto} /><textarea aria-label="게시물 문구" placeholder="문구를 입력하세요..." value={caption} maxLength="2000" onChange={e => setCaption(e.target.value)} /></section>;
}

import { X } from 'lucide-react'
import { ModalShell } from './ModalShell'

export function AboutGivernyModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell className="about-giverny-modal" labelledBy="about-giverny-title" onClose={onClose} closeOnEscape>
      <button className="icon-button modal-close-button about-giverny-close" aria-label="关闭" title="关闭" onClick={onClose}>
        <X size={18} />
      </button>
      <div className="about-giverny-brand">
        <img className="brand-logo" src="/giverny-logo.png" alt="" />
        <p>ABOUT GIVERNY</p>
        <h2 id="about-giverny-title">Giverny 吉维尼</h2>
      </div>
      <div className="about-giverny-story">
        <p>Giverny 是莫奈晚年居住的法国小镇。</p>
        <p>这里的四季色彩取自《睡莲》，也延续了莫奈花园的创作气息。</p>
        <p>我们相信，产品不只是完成工作的工具，也可以让创作本身成为一种乐趣。</p>
        <strong>让创作在自己的花园里生长。</strong>
      </div>
    </ModalShell>
  )
}

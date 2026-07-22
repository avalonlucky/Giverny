import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'

type ModalShellProps = {
  className?: string
  labelledBy: string
  onClose: () => void
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  children: ReactNode
}

export function ModalShell({
  className,
  labelledBy,
  onClose,
  closeOnBackdrop = false,
  closeOnEscape = false,
  children,
}: ModalShellProps) {
  const modalRef = useRef<HTMLElement | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  // Ref tracks live offset so native event closures are never stale.
  const offsetRef = useRef({ x: 0, y: 0 })
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        const saveButton = modalRef.current?.querySelector<HTMLButtonElement>('[data-modal-save="true"]')
        if (saveButton && !saveButton.disabled) {
          event.preventDefault()
          saveButton.click()
        }
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [closeOnEscape, onClose])

  const clampModalOffset = useCallback((nextOffset: { x: number; y: number }) => {
    const modal = modalRef.current
    if (!modal) return nextOffset

    const rect = modal.getBoundingClientRect()
    const currentOffset = offsetRef.current
    const deltaX = nextOffset.x - currentOffset.x
    const deltaY = nextOffset.y - currentOffset.y
    const nextRect = {
      left: rect.left + deltaX,
      right: rect.right + deltaX,
      top: rect.top + deltaY,
      bottom: rect.bottom + deltaY,
    }
    const minVisibleX = Math.min(180, rect.width * 0.5)
    const minVisibleY = Math.min(120, rect.height * 0.35)
    let x = nextOffset.x
    let y = nextOffset.y

    if (nextRect.right < minVisibleX) x += minVisibleX - nextRect.right
    if (nextRect.left > window.innerWidth - minVisibleX) x -= nextRect.left - (window.innerWidth - minVisibleX)
    if (nextRect.bottom < minVisibleY) y += minVisibleY - nextRect.bottom
    if (nextRect.top > window.innerHeight - minVisibleY) y -= nextRect.top - (window.innerHeight - minVisibleY)

    return { x, y }
  }, [])

  const stopModalDrag = useCallback((event?: ReactPointerEvent<HTMLButtonElement>) => {
    const pointerId = dragPointerIdRef.current
    if (event && pointerId !== null) {
      try {
        if (event.currentTarget.hasPointerCapture(pointerId)) {
          event.currentTarget.releasePointerCapture(pointerId)
        }
      } catch {
        // Some synthetic or interrupted pointer sequences no longer have an active capture.
      }
    }
    dragPointerIdRef.current = null
    dragStateRef.current = null
    modalRef.current?.classList.remove('is-dragging')
  }, [])

  const handleModalDragStart = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    dragPointerIdRef.current = event.pointerId
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetRef.current.x,
      originY: offsetRef.current.y,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Drag still works while the pointer remains over the handle; real pointer sequences capture normally.
    }
    modalRef.current?.classList.add('is-dragging')
  }, [])

  const handleModalDragMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current || dragPointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    const newOffset = clampModalOffset({
      x: dragStateRef.current.originX + (event.clientX - dragStateRef.current.startX),
      y: dragStateRef.current.originY + (event.clientY - dragStateRef.current.startY),
    })
    offsetRef.current = newOffset
    setOffset(newOffset)
  }, [clampModalOffset])

  const handleModalDragEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    stopModalDrag(event)
  }, [stopModalDrag])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose()
        }
      }}
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        ref={modalRef}
        className={`task-modal ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={(offset.x !== 0 || offset.y !== 0) ? ({
          '--modal-drag-x': `${offset.x}px`,
          '--modal-drag-y': `${offset.y}px`,
        } as CSSProperties) : undefined}
      >
        <button
          type="button"
          className="modal-drag-handle"
          data-modal-drag-handle="true"
          aria-label="拖动弹窗"
          title="拖动弹窗"
          onPointerDown={handleModalDragStart}
          onPointerMove={handleModalDragMove}
          onPointerUp={handleModalDragEnd}
          onPointerCancel={handleModalDragEnd}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        {children}
      </section>
    </div>
  )
}

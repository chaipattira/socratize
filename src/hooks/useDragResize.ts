import { useCallback } from 'react'

type Axis = 'x' | 'y'

/**
 * Returns an onMouseDown handler that fires onDelta(px) on every mousemove
 * while the button is held. Attaches/detaches document listeners automatically.
 */
export function useDragResize(onDelta: (delta: number) => void, axis: Axis = 'x') {
  return useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    let last = axis === 'x' ? e.clientX : e.clientY
    document.body.style.userSelect = 'none'
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'

    const onMove = (ev: MouseEvent) => {
      const pos = axis === 'x' ? ev.clientX : ev.clientY
      onDelta(pos - last)
      last = pos
    }
    const onUp = () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [onDelta, axis])
}

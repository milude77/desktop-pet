import { useEffect, useState } from "react"

interface BubbleProps {
  text: string
  visible: boolean
  duration?: number
  onHide?: () => void
}

export function Bubble({
  text,
  visible,
  duration = 5000,
  onHide,
}: BubbleProps) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!visible) {
      setFading(false)
      return
    }

    // 每次显示新的气泡时重新开始
    setFading(false)

    // 5 秒后开始淡出
    const fadeTimer = window.setTimeout(() => {
      setFading(true)
    }, duration)

    // 淡出动画完成后真正隐藏
    const hideTimer = window.setTimeout(() => {
      onHide?.()
    }, duration + 800)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(hideTimer)
    }
  }, [visible, duration, text, onHide])

  if (!visible) {
    return null
  }

  return (
    <div className={`bubble ${fading ? "bubble-fade-out" : ""}`}>
      <div className="bubble-text">
        {text}
      </div>
    </div>
  )
}
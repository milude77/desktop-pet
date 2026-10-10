import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "../BubbleWindow.css";

export function BubbleWindow() {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const unlistenShow = listen<{ text: string; duration?: number }>(
      "bubble:show",
      (event) => {
        // 清除之前的定时器
        clearTimeout(fadeTimer.current);
        clearTimeout(hideTimer.current);

        setFading(false);
        setText(event.payload.text);
        setVisible(true);

        // 确保窗口可见
        getCurrentWindow().show().catch(() => {});

        const duration = event.payload.duration ?? 5000;

        // 定时开始淡出
        fadeTimer.current = setTimeout(() => {
          setFading(true);
        }, duration);

        // 淡出完成后隐藏窗口
        hideTimer.current = setTimeout(() => {
          setVisible(false);
          getCurrentWindow().hide().catch(() => {});
        }, duration + 600);
      }
    );

    const unlistenHide = listen("bubble:hide", () => {
      clearTimeout(fadeTimer.current);
      clearTimeout(hideTimer.current);
      setVisible(false);
      getCurrentWindow().hide().catch(() => {});
    });

    return () => {
      unlistenShow.then((fn) => fn());
      unlistenHide.then((fn) => fn());
      clearTimeout(fadeTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="bubble-container">
      <div className={`bubble-oval ${fading ? "bubble-fade-out" : ""}`}>
        <div className="bubble-content">
          {text}
        </div>
      </div>
    </div>
  );
}
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useLongPress } from "./hooks/useLongPress";
import { useNativeMenu } from "./hooks/useNativeMenu";
import { useSpineAnimation } from "./hooks/useSpineAnimation";
import { SpineCanvas } from "./components/SpineCanvas";
import { getMenuConfig } from "./components/MenuConfig";
import "./App.css";

function App() {
  // 使用全局动画状态
  const { animations, playAnimation, setDragging } = useSpineAnimation();
  

  // 鼠标穿透状态
  const [isPassthrough, setIsPassthrough] = useState(false);
  const [plugins, setPlugins] = useState([])

  // 监听 Rust 托盘的穿透状态变化
  useEffect(() => {
    const unlisten = listen<boolean>("passthrough-changed", (event) => {
      setIsPassthrough(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // 初始化时从 Rust 获取当前穿透状态
  useEffect(() => {
    invoke<boolean>("get_passthrough").then(setIsPassthrough).catch(() => {});
  }, []);

  // 切换鼠标穿透（通过 Tauri 命令同步到 Rust）
  const togglePassthrough = useCallback(async () => {
    try {
      const newValue = !isPassthrough;
      await invoke("set_passthrough", { ignore: newValue });
      setIsPassthrough(newValue);
    } catch (e) {
      console.error("设置鼠标穿透失败:", e);
    }
  }, [isPassthrough]);

  useEffect(() => {
    async function loadPlugins() {
      const plugins = await invoke("discover_plugins")

      console.log("插件：", plugins)
    }

    loadPlugins()
  }, [])

  // 窗口拖拽相关状态
  const dragStartPos = useRef({ x: 0, y: 0 });
  const windowStartPos = useRef({ x: 0, y: 0 });

  // 长按开始：记录初始位置，切换到拖拽动画
  const handleLongPressStart = useCallback(async (e: React.MouseEvent) => {
    // 标记拖拽状态，防止非循环动画完成后自动切换
    setDragging(true);

    // 切换到拖拽动画
    if (animations.includes("tuozhuai2")) {
      playAnimation("tuozhuai2", true);
    }

    dragStartPos.current = { x: e.screenX, y: e.screenY };

    try {
      const window = getCurrentWindow();
      const position = await window.outerPosition();
      windowStartPos.current = { x: position.x, y: position.y };
    } catch (error) {
      console.error("获取窗口位置失败:", error);
    }
  }, [animations, playAnimation, setDragging]);


  // 长按移动：移动窗口
  const handleLongPressMove = useCallback((e: MouseEvent) => {
    const deltaX = e.screenX - dragStartPos.current.x;
    const deltaY = e.screenY - dragStartPos.current.y;

    const newX = windowStartPos.current.x + deltaX;
    const newY = windowStartPos.current.y + deltaY;

    requestAnimationFrame(async () => {
      try {
        const window = getCurrentWindow();
        await window.setPosition(new PhysicalPosition(newX, newY));
      } catch (error) {
        console.error("移动窗口失败:", error);
      }
    });
  }, []);

  // 长按结束：重置为默认动画
  const handleLongPressEnd = useCallback(() => {
    // 取消拖拽状态
    setDragging(false);

    // 切换回默认动画
    if (animations.includes("stand2")) {
      playAnimation("stand2", true);
    }
  }, [animations, playAnimation, setDragging]);

  // 点按事件（留空，后续使用）
  const handleClick = useCallback(() => {
    if (animations.length > 0 && animations.includes("touch")) {
      playAnimation("touch", false);
    }
  }, [animations, playAnimation]);

  // 使用长按 Hook
  const { onMouseDown } = useLongPress({
    delay: 300,
    onLongPressStart: handleLongPressStart,
    onLongPressMove: handleLongPressMove,
    onLongPressEnd: handleLongPressEnd,
    onClick: handleClick,
  });

  // 使用原生菜单
  const { showContextMenu } = useNativeMenu();

  // 动画大小加载完成回调
  const handleSizeLoaded = useCallback((w: number, h: number) => {
    console.log("动画大小:", w, h);
  }, []);

  // 右键菜单
  const handleContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      // 从 MenuConfig 获取菜单配置
      const menuItems = getMenuConfig(animations, plugins, playAnimation, isPassthrough, togglePassthrough);

      await showContextMenu(menuItems);
    },
    [showContextMenu, animations, playAnimation, isPassthrough, togglePassthrough]
  );

  return (
    <main
      className="container"
      onMouseDown={onMouseDown}
      onContextMenu={handleContextMenu}
    >
      {/* Spine 动画显示区域 - 自适应窗口大小 */}
      <SpineCanvas
        assetPath="/assets/changmen/changmen"
        loop={true}
        onSizeLoaded={handleSizeLoaded}
      />
    </main>
  );
}

export default App;
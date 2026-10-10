import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Spine, SkeletonBinary, AtlasAttachmentLoader } from "@pixi-spine/runtime-3.8";
import { TextureAtlas } from "@pixi-spine/base";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { useSpineAnimation } from "../hooks/useSpineAnimation";

interface SpineCanvasProps {
  /** Spine 资源路径（不含扩展名） */
  assetPath: string;
  /** 初始动画名称 */
  defaultAnimation?: string;
  /** 是否循环播放 */
  loop?: boolean;
  /** 宽度（可选，不传则自适应容器） */
  width?: number;
  /** 高度（可选，不传则自适应容器） */
  height?: number;
    /** 动画加载完成回调，返回可用动画列表和切换方法 */
  onAnimationsLoaded?: (animations: string[], playAnimation: (name: string, loop: boolean) => void) => void;
  /** 动画大小加载完成回调 */
}

export const SpineCanvas: React.FC<SpineCanvasProps> = ({
  assetPath,
  defaultAnimation = "stand2",
  loop = true,
  width: propWidth,
  height: propHeight,
  onAnimationsLoaded,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const spineRef = useRef<Spine | null>(null);
  const canvasHeightRef = useRef(0);
  const baseSpineYRef = useRef(0);
  const currentAnimRef = useRef("stand2");
  const stopWalkRef = useRef<(() => void) | null>(null);

  // 使用全局动画状态
  const { setAnimations, registerPlayFunction } = useSpineAnimation();

  // 使用容器实际大小，如果没有传入 width/height 则自适应
  const [canvasSize, setCanvasSize] = useState({
    width: propWidth || 400,
    height: propHeight || 400
  });

  // 监听容器大小变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 如果传入了固定大小，不监听
    if (propWidth && propHeight) return;

    // 立即检查容器大小
    const checkSize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setCanvasSize({ width, height });
      }
    };

    // 延迟检查，确保DOM已渲染
    setTimeout(checkSize, 0);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width, height });
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [propWidth, propHeight]);

  useEffect(() => {
    let destroyed = false;

    const loadSpine = async () => {
      try {
        setLoading(true);
        setError(null);

        const container = containerRef.current;
        if (!container) {
          throw new Error("容器不存在");
        }

        const { width, height } = canvasSize;

        // 创建 PixiJS 应用
        const app = new PIXI.Application({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        if (destroyed) {
          app.destroy(true);
          return;
        }

        // 将 canvas 添加到容器
        const canvas = app.view as HTMLCanvasElement;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        container.appendChild(canvas);
        appRef.current = app;

        console.log("Canvas 已添加到容器");

        // 加载资源
        const atlasPath = `${assetPath}.atlas`;
        const skelPath = `${assetPath}.skel`;
        const imagePath = `${assetPath}.png`;

        console.log("开始加载 Spine 资源:", { atlasPath, skelPath, imagePath });

        // 并行加载所有资源
        const [atlasResponse, skelResponse] = await Promise.all([
          fetch(atlasPath),
          fetch(skelPath),
        ]);

        if (!atlasResponse.ok || !skelResponse.ok) {
          throw new Error("资源文件加载失败");
        }

        // 获取资源内容
        const atlasText = await atlasResponse.text();
        const skelArrayBuffer = await skelResponse.arrayBuffer();

        console.log("资源加载完成:", {
          atlasLength: atlasText.length,
          skelLength: skelArrayBuffer.byteLength,
        });

        // 加载纹理
        const texture = PIXI.Texture.from(imagePath);

        // 等待纹理加载
        await new Promise<void>((resolve, reject) => {
          if (texture.baseTexture.valid) {
            resolve();
          } else {
            texture.baseTexture.once("loaded", () => resolve());
            texture.baseTexture.once("error", (err) =>
              reject(new Error("纹理加载失败: " + err))
            );
          }
        });

        if (destroyed) return;

        // 创建纹理图集
        const atlas = new TextureAtlas(
          atlasText,
          (_path: string, load: (tex: PIXI.BaseTexture) => void) => {
            // 直接使用已加载的纹理
            load(texture.baseTexture);
          }
        );

        if (destroyed) return;

        // 创建附件加载器
        const atlasLoader = new AtlasAttachmentLoader(atlas);

        // 创建骨骼二进制解析器
        const skeletonBinary = new SkeletonBinary(atlasLoader);
        skeletonBinary.scale = 1;

        // 读取骨骼数据
        const skeletonData = skeletonBinary.readSkeletonData(
          new Uint8Array(skelArrayBuffer)
        );

        if (destroyed) return;

        // 创建 Spine 对象
        const spine = new Spine(skeletonData);
        spineRef.current = spine;

        
        const bounds = spine.getBounds();
        if (bounds.width > 0 && bounds.height > 0) {
          // 动画填满窗口，留少量边距（10%）
          const PADDING = 0.9;
          const scaleX = (width * PADDING) / bounds.width;
          const scaleY = (height * PADDING) / bounds.height;
          const scale = Math.min(scaleX, scaleY);
          spine.scale.set(scale);

          // 重新计算缩放后的边界
          const scaledBounds = spine.getBounds();

          // 水平居中，垂直居中
          spine.x = (width - scaledBounds.width) / 2 - scaledBounds.x;
          spine.y = (height - scaledBounds.height) / 2 - scaledBounds.y;

          // 记录基础位置和画布高度，供 sit/sleep 动画偏移使用
          canvasHeightRef.current = height;
          baseSpineYRef.current = spine.y;

        } else {
          // 默认居中
          spine.x = width / 2;
          spine.y = height / 2;
        }

        // 获取可用动画
        const animNames = skeletonData.animations.map((a) => a.name);

        // 注册全局动画播放函数
        registerPlayFunction((name: string, loopAnim: boolean, onComplete?: () => void) => {
          if (spineRef.current) {
            // 非 walk/stand2 动画触发时，中断当前移动
            if (name !== "walk" && name !== "stand2") {
              stopWalkRef.current?.();
            }

            // 记录当前动画
            currentAnimRef.current = name;

            // 清除旧监听器，防止累积
            spineRef.current.state.clearListeners();

            const trackEntry = spineRef.current.state.setAnimation(0, name, loopAnim);

            // sit/sleep 动画上移，使角色视觉居中
            if (name === "sit" || name === "sleep") {
              spineRef.current.y = baseSpineYRef.current - canvasHeightRef.current * 0.3;
            } else {
              spineRef.current.y = baseSpineYRef.current;
            }

            // 非循环动画：添加完成回调
            if (onComplete) {
              spineRef.current.state.addListener({
                complete: (entry) => {
                  if (entry === trackEntry) {
                    // 动画结束恢复位置
                    if (spineRef.current) {
                      spineRef.current.y = baseSpineYRef.current;
                    }
                    onComplete();
                  }
                },
              });
            }
          }
        });

        // 设置全局动画列表
        setAnimations(animNames);

        // 通知外部动画列表已加载（向后兼容）
        if (onAnimationsLoaded && animNames.length > 0) {
          onAnimationsLoaded(animNames, (name: string, loopAnim: boolean) => {
            if (spineRef.current) {
              spineRef.current.state.setAnimation(0, name, loopAnim);
            }
          });
        }

        // 设置默认动画
        if (animNames.length > 0) {
          console.log("设置默认动画:",animNames, defaultAnimation);
          const animName = animNames.includes(defaultAnimation)
            ? defaultAnimation
            : animNames[0];
          spine.state.setAnimation(0, animName, loop);
        }

        // 添加到舞台
        app.stage.addChild(spine);

        // 更新循环
        app.ticker.add(() => {
          if (spine) {
            spine.update(0);
          }
        });

        setLoading(false);
      } catch (err) {
        console.error("加载 Spine 动画失败:", err);
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      }
    };

    loadSpine();

    return () => {
      destroyed = true;
      spineRef.current = null;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [assetPath, defaultAnimation, loop, canvasSize]);

  // 随机移动定时器：每10-15秒随机左右走动
  useEffect(() => {
    const spine = spineRef.current;
    if (!spine) return;

    let walkTimer: ReturnType<typeof setTimeout> | null = null;
    let isWalking = false;

    const baseScaleX = Math.abs(spine.scale.x);
    let currentDirection = 1; // 1=右，-1=左，初始向右

    // 应用当前朝向
    const applyDirection = () => {
      if (spineRef.current) {
        spineRef.current.scale.x = baseScaleX * currentDirection;
      }
    };

    // 中断移动（供外部调用）
    const stopWalk = () => {
      if (isWalking) {
        isWalking = false;
        applyDirection(); // 恢复朝向
        // 恢复待机动画
        if (spineRef.current) {
          spineRef.current.state.clearListeners();
          spineRef.current.state.setAnimation(0, "stand2", true);
          spineRef.current.y = baseSpineYRef.current;
        }
      }
    };
    stopWalkRef.current = stopWalk;

    const doWalk = async () => {
      // 只有待机状态才允许自动移动
      if (isWalking || !spineRef.current) return;
      if (currentAnimRef.current !== "stand2") return;
      isWalking = true;

      try {
        const win = getCurrentWindow();
        const startPos = await win.outerPosition();
        const winSize = await win.outerSize();

        // 获取屏幕边界
        const monitor = await currentMonitor();
        const screenW = monitor?.size.width ?? 1920;
        const screenH = monitor?.size.height ?? 1080;
        const screenX = monitor?.position.x ?? 0;
        const screenY = monitor?.position.y ?? 0;

        // 随机落脚点
        let destX = startPos.x + Math.round((Math.random() - 0.5) * 1000);
        let destY = startPos.y + Math.round((Math.random() - 0.5) * 200);

        // 限制在屏幕边界内
        destX = Math.max(screenX, Math.min(destX, screenX + screenW - winSize.width));
        destY = Math.max(screenY, Math.min(destY, screenY + screenH - winSize.height));

        // 更新朝向
        currentDirection = destX >= startPos.x ? 1 : -1;
        applyDirection();

        // 播放走路动画
        spineRef.current.state.clearListeners();
        spineRef.current.state.setAnimation(0, "walk", true);

        // 计算距离和时间，匀速移动
        const dx = destX - startPos.x;
        const dy = destY - startPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 80; // px/秒
        const duration = Math.max(500, (distance / speed) * 1000); // 至少500ms

        // 匀速动画
        const startTime = performance.now();
        await new Promise<void>((resolve) => {
          const animate = async (now: number) => {
            if (!isWalking || !spineRef.current) {
              resolve();
              return;
            }
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const curX = Math.round(startPos.x + dx * progress);
            const curY = Math.round(startPos.y + dy * progress);
            await win.setPosition(new PhysicalPosition(curX, curY));

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(animate);
        });
      } catch (e) {
        console.error("随机移动失败:", e);
      }

      // 走路结束，保持当前朝向，恢复待机动画
      if (spineRef.current && isWalking) {
        applyDirection(); // 确保朝向不变
        spineRef.current.state.clearListeners();
        spineRef.current.state.setAnimation(0, "stand2", true);
      }
      isWalking = false;
    };

    const scheduleNext = () => {
      const delay = 10000 + Math.random() * 5000; // 10-15秒
      walkTimer = setTimeout(() => {
        doWalk().finally(scheduleNext);
      }, delay);
    };

    scheduleNext();

    return () => {
      isWalking = false;
      stopWalkRef.current = null;
      if (walkTimer) clearTimeout(walkTimer);
    };
  }, [spineRef.current]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: propWidth ? `${propWidth}px` : "100%",
        height: propHeight ? `${propHeight}px` : "100%",
        overflow: "hidden",
      }}
    >
      {/* PixiJS canvas 会自动添加到这里 */}

      {/* 加载状态覆盖层 */}
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
            borderRadius: "8px",
            color: "white",
          }}
        >
          <p>加载 Spine 动画中...</p>
        </div>
      )}

      {/* 错误状态覆盖层 */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,0,0,0.3)",
            borderRadius: "8px",
            color: "#c00",
          }}
        >
          <p>❌ {error}</p>
        </div>
      )}
    </div>
  );
};
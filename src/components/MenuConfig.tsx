import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalSize } from "@tauri-apps/api/dpi";

interface MenuItemConfig {
  id: string;
  text?: string;
  icon?: string;
  enabled?: boolean;
  accelerator?: string;
  action?: () => void;
  submenu?: MenuItemConfig[];
  separator?: boolean;
}

export interface DiscoveredPlugin {
  path: string
  manifest: {
    id: string
    name: string
    version: string
    author?: string
    description?: string
    main: string
  }
}


/**
 * 获取右键菜单配置
 *
 * @param animations 动画列表
 * @param playAnimation 播放动画的函数，参数为动画名称和是否循环
 * @param isPassthrough 当前鼠标穿透状态
 * @param togglePassthrough 切换鼠标穿透的回调
 * @returns 菜单项配置数组
 */
export function getMenuConfig(
  animations: string[],
  plugins: DiscoveredPlugin[],
  playAnimation?: (name: string, loop: boolean) => void,
  isPassthrough?: boolean,
  togglePassthrough?: () => void,
  handleLoadPlugin?: (plugin: DiscoveredPlugin) => void,
): MenuItemConfig[] {
  // 构建动态动画菜单
  const animationSubmenu: MenuItemConfig[] = animations.map((anim) => ({
    id: `anim-${anim}`,
    text: anim,
    action: () => playAnimation?.(anim, true),
  }));

  return [
    {
      id: "animations",
      text: "动画",
      submenu:
        animationSubmenu.length > 0
          ? animationSubmenu
          : [
              {
                id: "no-anim",
                text: "暂无动画",
                enabled: false,
              },
            ],
    },
    {
      id: "settings",
      text: "设置",
      submenu: [
        {
          id: "setting-size",
          text: "调整大小",
          submenu: [
            {
              id: "size-small",
              text: "小 (150x150)",
              action: async () => {
                try {
                  const window = getCurrentWindow();
                  await window.setSize(new PhysicalSize(150, 150));
                  console.log("调整为小尺寸");
                } catch (error) {
                  console.error("调整大小失败:", error);
                }
              },
            },
            {
              id: "size-medium",
              text: "中 (200x200)",
              action: async () => {
                try {
                  const window = getCurrentWindow();
                  await window.setSize(new PhysicalSize(200, 200));
                  console.log("调整为中尺寸");
                } catch (error) {
                  console.error("调整大小失败:", error);
                }
              },
            },
            {
              id: "size-large",
              text: "大 (300x300)",
              action: async () => {
                try {
                  const window = getCurrentWindow();
                  await window.setSize(new PhysicalSize(300, 300));
                  console.log("调整为大尺寸");
                } catch (error) {
                  console.error("调整大小失败:", error);
                }
              },
            },
            {
              id: "size-xlarge",
              text: "特大 (400x400)",
              action: async () => {
                try {
                  const window = getCurrentWindow();
                  await window.setSize(new PhysicalSize(400, 400));
                  console.log("调整为特大尺寸");
                } catch (error) {
                  console.error("调整大小失败:", error);
                }
              },
            },
          ],
        },
        {
          id: "setting-opacity",
          text: "透明度",
          submenu: [
            {
              id: "opacity-100",
              text: "100% (不透明)",
              action: () => {
                document.documentElement.style.opacity = "1";
              },
            },
            {
              id: "opacity-75",
              text: "75%",
              action: () => {
                document.documentElement.style.opacity = "0.75";
              },
            },
            {
              id: "opacity-50",
              text: "50%",
              action: () => {
                document.documentElement.style.opacity = "0.5";
              },
            },
            {
              id: "opacity-25",
              text: "25% (半透明)",
              action: () => {
                document.documentElement.style.opacity = "0.25";
              },
            },
          ],
        },
        {
          id: "setting-passthrough",
          text: isPassthrough ? "鼠标穿透✓ " : "鼠标穿透",
          action: () => togglePassthrough?.(),
        },
      ],
    },
    { id: "separator2", separator: true },
    { id: "plugins",
      text:"插件",
      submenu:
        plugins.length > 0
          ? plugins.map((plugin) => ({
              id: `plugin-${plugin.manifest.id}`,
              text: plugin.manifest.name,

              action: () => {
                handleLoadPlugin(plugin)
              },
            }))
          : [
              {
                id: "no-plugin",
                text: "未检测到插件",
                enabled: false,
              },
            ],
    },
    { id: "separator3", separator: true },
    {
      id: "quit",
      text: "退出",
      action: async () => {
        const window = getCurrentWindow();
        await window.close();
      },
    },
  ];
}
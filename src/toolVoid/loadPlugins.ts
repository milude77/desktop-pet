import { invoke } from "@tauri-apps/api/core"

export interface BubbleAPI {
  show(text: string): void
  hide(): void
}

export interface PluginContext {
  bubble: BubbleAPI
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

export async function loadPlugin(
  plugin: DiscoveredPlugin,
  context: PluginContext
) {
  console.log("准备加载插件：", plugin)

  try {
    const source = await invoke<string>("read_plugin_file", {
      path: plugin.path,
      main: plugin.manifest.main,
    })

    console.log("插件源码：", source)

    const blob = new Blob(
      [source],
      { type: "text/javascript" }
    )

    const url = URL.createObjectURL(blob)

    try {
      const module = await import(/* @vite-ignore */ url)

      const pluginInstance = module.default

      console.log("插件实例：", pluginInstance)

      if (pluginInstance?.onLoad) {
        await pluginInstance.onLoad(context)
      }

    } finally {
      URL.revokeObjectURL(url)
    }

  } catch (error) {
    console.error("插件加载失败：", error)
  }
}
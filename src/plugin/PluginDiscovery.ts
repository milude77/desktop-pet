import { invoke } from "@tauri-apps/api/core"
import type { PluginManifest } from "./Plugin"

export interface DiscoveredPlugin {
  path: string
  manifest: PluginManifest
}

export class PluginDiscovery {

  async discover(): Promise<DiscoveredPlugin[]> {

    return await invoke<DiscoveredPlugin[]>(
      "discover_plugins"
    )
  }
}
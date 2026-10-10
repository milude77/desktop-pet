import type { HttpClient } from "../../api/HttpClient"
import type { PetAPI } from "../../api/PetAPI"
import type { MenuAPI } from "../../api/MenuAPI"

export interface PluginContext {

  http: HttpClient

  pet: PetAPI

  menu: MenuAPI
}
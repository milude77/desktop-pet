export interface MenuItem {
  id: string
  text: string
}

export interface MenuAPI {

  addItem(
    item: MenuItem
  ): void

  removeItem(
    id: string
  ): void
}
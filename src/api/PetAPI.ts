export interface PetAPI {
  playAnimation(
    animation: string,
    loop?: boolean
  ): Promise<void>

  moveTo(
    x: number,
    y: number
  ): Promise<void>
}
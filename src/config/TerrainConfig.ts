export interface TerrainConfig {
    width: number
    height: number
    segments: number
    heightScale: number
    textureRepeat?: number
}

export const defaultTerrainConfig: TerrainConfig = {
    width: 2000, // 더 넓은 지형
    height: 2000, // 더 넓은 지형
    segments: 200, // 더 상세한 지형
    heightScale: 100, // 더 극적인 높이 변화
    textureRepeat: 16, // 텍스처 반복 횟수
}

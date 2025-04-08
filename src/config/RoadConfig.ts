export interface RoadConfig {
    width: number
    segments: number
    curveRadius: number
    curveSegments: number
    textureRepeat: number
}

export const defaultRoadConfig: RoadConfig = {
    width: 12, // 도로 폭
    segments: 100, // 도로 세그먼트 수
    curveRadius: 200, // 곡선 반경
    curveSegments: 8, // 곡선 세그먼트 수
    textureRepeat: 20, // 텍스처 반복 횟수
}

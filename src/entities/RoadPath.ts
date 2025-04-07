import * as THREE from "three"

export class RoadPath {
    public curve: THREE.CatmullRomCurve3

    constructor(points?: THREE.Vector3[]) {
        const controlPoints = points || this.getDefaultPoints()
        this.curve = new THREE.CatmullRomCurve3(controlPoints, false, "catmullrom", 0.1)
    }

    private getDefaultPoints(): THREE.Vector3[] {
        const points: THREE.Vector3[] = []
        const segmentLength = 50 // 세그먼트 길이 증가
        const totalLength = 2000 // 전체 길이 증가
        const segments = Math.floor(totalLength / segmentLength)

        // 시작 지점부터 끝까지 포인트 생성
        for (let i = 0; i <= segments; i++) {
            const z = i * segmentLength - 25 // 차량 시작 위치(-25)에 맞춤
            // 더 부드러운 곡선을 위해 사인 함수의 주기와 진폭 조정
            const x = Math.sin(i * 0.05) * 2 // 진폭을 2미터로 줄이고 주기를 늘림
            points.push(new THREE.Vector3(x, 0, z))
        }

        return points
    }
}

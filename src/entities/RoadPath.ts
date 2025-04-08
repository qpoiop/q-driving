import * as THREE from "three"

export class RoadPath {
    public curve: THREE.CatmullRomCurve3

    constructor(points?: THREE.Vector3[]) {
        const controlPoints = points || this.getDefaultPoints()
        this.curve = new THREE.CatmullRomCurve3(controlPoints, false, "catmullrom", 0.1)
    }

    private getDefaultPoints(): THREE.Vector3[] {
        const points: THREE.Vector3[] = []
        const segmentLength = 50
        const totalLength = 2000
        const segments = Math.floor(totalLength / segmentLength)

        // 시작 지점을 차량 위치보다 앞쪽(-500)으로 이동
        for (let i = 0; i <= segments; i++) {
            const z = i * segmentLength - 500
            const x = Math.sin(i * 0.03) * 2
            points.push(new THREE.Vector3(x, 0, z))
        }

        return points
    }
}

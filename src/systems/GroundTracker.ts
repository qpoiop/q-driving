import * as THREE from "three"

export class GroundTracker {
    constructor(private terrainMesh: THREE.Mesh) {}

    // 차량 또는 도로의 Y 좌표를 지형에 맞춰 보정
    public getHeightAt(position: THREE.Vector3): number {
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(position.x, 100, position.z), // 위에서 아래로 쏘는 레이
            new THREE.Vector3(0, -1, 0),
        )

        const intersects = raycaster.intersectObject(this.terrainMesh, true)
        return intersects.length > 0 ? intersects[0].point.y : 0
    }
    public getNormalAt(position: THREE.Vector3): THREE.Vector3 {
        const raycaster = new THREE.Raycaster(new THREE.Vector3(position.x, 100, position.z), new THREE.Vector3(0, -1, 0))

        const intersects = raycaster.intersectObject(this.terrainMesh, true)
        return intersects.length > 0
            ? intersects[0].face?.normal.clone().transformDirection(this.terrainMesh.matrixWorld) ?? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 1, 0)
    }
}

import * as THREE from "three"

export class GroundTracker {
    private position = new THREE.Vector3()
    private raycaster = new THREE.Raycaster()

    constructor(private target: THREE.Mesh) {
        this.raycaster.far = 100
    }

    getHeight(worldPos: THREE.Vector3): number {
        this.position.copy(worldPos)
        this.position.y = 100

        this.raycaster.set(this.position, new THREE.Vector3(0, -1, 0))

        const hit = this.raycaster.intersectObject(this.target, false)[0]
        return hit ? hit.point.y : 0
    }
}

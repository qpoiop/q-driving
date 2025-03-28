// systems/GroundTracker.ts
import * as THREE from "three"

export class GroundTracker {
    private raycaster = new THREE.Raycaster()
    private down = new THREE.Vector3(0, -1, 0)
    private tempOrigin = new THREE.Vector3()

    constructor(private terrain: THREE.Object3D) {}

    getHeight(position: THREE.Vector3): number {
        this.tempOrigin.copy(position)
        this.tempOrigin.y += 10

        this.raycaster.set(this.tempOrigin, this.down)
        const intersects = this.raycaster.intersectObject(this.terrain, false)

        if (intersects.length > 0) {
            return intersects[0].point.y
        } else {
            return position.y
        }
    }
}

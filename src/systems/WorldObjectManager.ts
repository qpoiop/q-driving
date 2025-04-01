import * as THREE from "three"

export class WorldObjectManager {
    private collidables: THREE.Object3D[] = []

    public register(obj: THREE.Object3D) {
        obj.updateMatrixWorld(true)
        this.collidables.push(obj)
    }

    public isColliding(point: THREE.Vector3): boolean {
        for (const obj of this.collidables) {
            const box = new THREE.Box3().setFromObject(obj)
            if (box.containsPoint(point)) return true
        }
        return false
    }

    public clear() {
        this.collidables = []
    }
}

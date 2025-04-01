import * as THREE from "three"

export class WorldObject {
    public mesh: THREE.Object3D
    private boundingBox = new THREE.Box3()

    constructor(base: THREE.Object3D, position: THREE.Vector3) {
        this.mesh = base.clone()
        this.mesh.position.copy(position)
        this.mesh.updateMatrixWorld(true)
        this.boundingBox.setFromObject(this.mesh)
    }

    public intersects(point: THREE.Vector3): boolean {
        return this.boundingBox.containsPoint(point)
    }

    public getMesh(): THREE.Object3D {
        return this.mesh
    }
}

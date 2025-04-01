import * as THREE from "three"
import { gltfLoader } from "../loaders/glbfLoader"

export class WorldObject {
    public mesh: THREE.Object3D
    private boundingBox: THREE.Box3

    constructor(model: THREE.Object3D, position: THREE.Vector3) {
        this.mesh = model.clone()
        this.mesh.position.copy(position)
        this.mesh.updateMatrixWorld(true)
        this.boundingBox = new THREE.Box3().setFromObject(this.mesh)
    }

    public getMesh(): THREE.Object3D {
        return this.mesh
    }

    public intersects(point: THREE.Vector3): boolean {
        return this.boundingBox.containsPoint(point)
    }

    public static async loadModel(path: string): Promise<THREE.Object3D> {
        return new Promise((resolve, reject) => {
            gltfLoader.load(
                path,
                gltf => resolve(gltf.scene),
                undefined,
                err => reject(err),
            )
        })
    }
}

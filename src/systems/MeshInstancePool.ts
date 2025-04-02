import * as THREE from "three"
type InstancingKey = string // geometry.uuid + material.uuid

export class MeshInstancePool {
    private pool = new Map<InstancingKey, THREE.InstancedMesh>()

    getOrCreate(geometry: THREE.BufferGeometry, material: THREE.Material, maxCount: number): THREE.InstancedMesh {
        const key = `${geometry.uuid}-${material.uuid}`
        if (!this.pool.has(key)) {
            const mesh = new THREE.InstancedMesh(geometry, material, maxCount)
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
            mesh.castShadow = true
            mesh.receiveShadow = true
            this.pool.set(key, mesh)
        }
        return this.pool.get(key)!
    }

    addToScene(scene: THREE.Scene) {
        this.pool.forEach(mesh => scene.add(mesh))
    }

    dispose() {
        this.pool.forEach(mesh => {
            mesh.geometry.dispose()
            if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose())
            else mesh.material.dispose()
        })
        this.pool.clear()
    }
}

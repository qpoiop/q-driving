import * as THREE from "three"
import { gltfLoader } from "../loaders/glbfLoader"
import { WorldObjectManager } from "./WorldObjectManager"

const modelPaths = [
    "/assets/models/tree/tree01.glb",
    "/assets/models/tree/tree02.glb",
    "/assets/models/bush/bush01.glb",
    "/assets/models/rock/rock01.glb",
]

const TOTAL_PER_TILE = 6
const SPREAD = 150

interface SceneryModel {
    mesh: THREE.Mesh
    fixRotation: THREE.Euler
}

export class SceneryManager {
    private group = new THREE.Group()
    private models: SceneryModel[] = []
    private instancedMeshes: THREE.InstancedMesh[] = []
    private populatedTiles = new Set<string>()
    private ready = false

    constructor(private scene: THREE.Scene, private getHeight: (pos: THREE.Vector3) => number, private worldObjectManager: WorldObjectManager) {
        this.scene.add(this.group)
    }

    public async init() {
        const gltfs = await Promise.all(modelPaths.map(p => gltfLoader.loadAsync(p)))
        this.models = gltfs.map(gltf => {
            const root = gltf.scene
            let firstMesh: THREE.Mesh | null = null
            root.traverse(obj => {
                if (!firstMesh && obj instanceof THREE.Mesh) {
                    firstMesh = obj
                }
            })
            if (!firstMesh) throw new Error("No mesh found in model.")

            const up = new THREE.Vector3(0, 1, 0)
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(firstMesh.quaternion).normalize()
            const angle = normal.angleTo(up)
            const needsFix = angle > 0.5
            const rotationFix = needsFix ? new THREE.Euler(-Math.PI / 2, 0, 0) : new THREE.Euler(0, 0, 0)

            return { mesh: firstMesh, fixRotation: rotationFix }
        })
        this.ready = true
    }

    public populateTile(tileX: number, tileZ: number) {
        if (!this.ready) return
        const key = `${tileX},${tileZ}`
        if (this.populatedTiles.has(key)) return
        this.populatedTiles.add(key)

        const rand = (min: number, max: number) => Math.random() * (max - min) + min
        const centerX = tileX * SPREAD
        const centerZ = tileZ * SPREAD

        for (const { mesh: baseMesh, fixRotation } of this.models) {
            const geometry = baseMesh.geometry
            const material = baseMesh.material
            if (!geometry || !material) continue

            const instanced = new THREE.InstancedMesh(geometry, material, TOTAL_PER_TILE)
            const dummy = new THREE.Object3D()

            const box = new THREE.Box3().setFromObject(baseMesh)
            const meshOffsetY = box.min.y

            for (let i = 0; i < TOTAL_PER_TILE; i++) {
                const x = centerX + rand(-SPREAD, SPREAD)
                const z = centerZ + rand(-SPREAD, SPREAD)
                const terrainY = this.getHeight(new THREE.Vector3(x, 0, z))

                const y = terrainY - meshOffsetY
                const s = rand(0.5, 0.7)

                dummy.position.set(x, y, z)
                dummy.scale.set(s, s, s)
                dummy.rotation.copy(fixRotation)
                dummy.updateMatrix()
                instanced.setMatrixAt(i, dummy.matrix)

                const collider = new THREE.Object3D()
                collider.position.set(x, y, z)
                collider.scale.set(s, s, s)
                this.worldObjectManager.register(collider)
            }

            instanced.instanceMatrix.needsUpdate = true
            this.group.add(instanced)
            this.instancedMeshes.push(instanced)
        }
    }

    public clear() {
        for (const mesh of this.instancedMeshes) {
            mesh.geometry.dispose()
            if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose())
            else mesh.material.dispose()
            this.group.remove(mesh)
        }
        this.instancedMeshes = []
        this.populatedTiles.clear()
    }
}

import * as THREE from "three"
import { gltfLoader } from "../loaders/glbfLoader"
import { WorldObjectManager } from "./WorldObjectManager"
import { GeometryUtils } from "../utils/GeometryUtils"
import { InstanceManager } from "../managers/InstanceManager"
import { TileManager } from "../managers/TileManager"

const MAX_INSTANCES = 1000
const MIN_OBJECT_DISTANCE = 15
const BATCH_SIZE = 50

export class SceneryManager {
    private modelGroups: Map<string, InstanceManager> = new Map()
    private ready = false
    private group = new THREE.Group()
    private frustum = new THREE.Frustum()
    private projScreenMatrix = new THREE.Matrix4()
    private worldBounds = {
        minX: -2500,
        maxX: 2500,
        minZ: -2500,
        maxZ: 2500,
    }
    private updateQueue: { tileX: number; tileZ: number }[] = []
    private isProcessingQueue = false

    private tileManager: TileManager

    constructor(
        private scene: THREE.Scene,
        getHeight: (pos: THREE.Vector3) => number,
        private worldObjectManager: WorldObjectManager,
        getRoadDistance?: (pos: THREE.Vector3) => number,
    ) {
        this.scene.add(this.group)
        this.tileManager = new TileManager(getHeight, getRoadDistance)
    }

    public async init() {
        try {
            const gltf = await gltfLoader.loadAsync("/assets/models/tree/tree01.glb")
            const geometry = this.processModelGeometry(gltf.scene)
            const material = new THREE.MeshStandardMaterial({
                side: THREE.DoubleSide,
                envMapIntensity: 1.5,
                metalness: 0.0,
                roughness: 1.0,
            })

            const modelGroup = new InstanceManager(geometry, material, MAX_INSTANCES, this.worldBounds)

            this.modelGroups.set("tree", modelGroup)
            this.group.add(modelGroup.getMesh())
            this.ready = true
        } catch (error) {
            console.error("Failed to initialize SceneryManager:", error)
            throw error
        }
    }

    private processModelGeometry(model: THREE.Object3D): THREE.BufferGeometry {
        const geometries: THREE.BufferGeometry[] = []
        const tempMatrix = new THREE.Matrix4()

        model.updateMatrixWorld(true)

        model.traverse(child => {
            if (child instanceof THREE.Mesh) {
                const geometry = child.geometry.clone()
                tempMatrix.copy(child.matrixWorld)
                geometry.applyMatrix4(tempMatrix)
                geometries.push(GeometryUtils.normalizeGeometry(geometry))
            }
        })

        if (geometries.length === 0) {
            throw new Error("No valid geometries found in the model")
        }

        return GeometryUtils.mergeGeometries(geometries)
    }

    public populateTile(tileX: number, tileZ: number) {
        if (!this.ready) return

        const tileKey = this.tileManager.getTileKey(tileX, tileZ)
        if (this.tileManager.isTilePopulated(tileKey)) return

        this.updateQueue.push({ tileX, tileZ })
        if (!this.isProcessingQueue) {
            this.processUpdateQueue()
        }
    }

    private async processUpdateQueue() {
        if (this.isProcessingQueue || this.updateQueue.length === 0) return
        this.isProcessingQueue = true

        while (this.updateQueue.length > 0) {
            const batch = this.updateQueue.splice(0, BATCH_SIZE)
            for (const { tileX, tileZ } of batch) {
                const tileKey = this.tileManager.getTileKey(tileX, tileZ)
                this.tileManager.markTileAsPopulated(tileKey)

                const modelGroup = this.modelGroups.get("tree")
                if (!modelGroup) continue

                const position = this.tileManager.getTileCenter(tileX, tileZ)
                if (!this.tileManager.isValidPosition(position)) continue

                const terrainY = this.tileManager.getHeight(position)
                position.y = terrainY

                const rotation = new THREE.Euler(0, Math.random() * Math.PI * 2, 0)
                const scale = new THREE.Vector3(0.5, 0.5, 0.5)

                const added = modelGroup.addInstance(position, rotation, scale, tileKey)
                if (added) {
                    const collider = new THREE.Object3D()
                    collider.position.copy(position)
                    collider.scale.copy(scale)
                    this.worldObjectManager.register(collider)
                }
            }
            await new Promise(resolve => requestAnimationFrame(resolve))
        }

        this.isProcessingQueue = false
    }

    public updateVisibility(camera: THREE.Camera) {
        if (!this.ready) return

        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix)

        this.modelGroups.forEach(group => {
            group.updateVisibility(this.frustum)
        })
    }

    public clear() {
        this.modelGroups.forEach(group => {
            this.group.remove(group.getMesh())
            group.dispose()
        })
        this.modelGroups.clear()
        this.tileManager.clear()
        this.ready = false
    }
}

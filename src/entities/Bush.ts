import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { ITerrainService } from "../core/ITerrainService"
import { ResourceManager } from "../core/ResourceManager"

export class Bush extends Entity {
    // --- Static Configuration ---
    public static readonly MODEL_PATH = "models/bush/bush01.glb"
    public static readonly MODEL_NAME = "bush"
    public static readonly MAX_INSTANCES = 300 // External config preferred
    public static readonly CAST_SHADOW = true
    public static readonly RECEIVE_SHADOW = true
    // ---------------------------

    public static instancedMesh: THREE.InstancedMesh | null = null
    private static modelGeometry: THREE.BufferGeometry | null = null
    private static modelMaterial: THREE.Material | THREE.Material[] | null = null
    private static loadPromise: Promise<void> | null = null
    public static boundingBox: THREE.Box3 | null = null

    private transform: TransformComponent
    private model: ModelComponent
    private instanceId: number = -1
    private terrainService: ITerrainService

    constructor(terrainService: ITerrainService) {
        super()
        this.terrainService = terrainService
        this.transform = new TransformComponent()
        this.model = new ModelComponent()
        this.addComponent(this.transform)
        this.addComponent(this.model)
    }

    public static async initializeShared(resourceManager: ResourceManager): Promise<void> {
        if (Bush.instancedMesh) return
        if (this.loadPromise) return this.loadPromise

        this.loadPromise = new Promise<void>(async (resolve, reject) => {
            try {
                const model = await resourceManager.loadModel(Bush.MODEL_NAME, Bush.MODEL_PATH)

                let mesh: THREE.Mesh | null = null
                model.traverse(child => {
                    if (child instanceof THREE.Mesh && !mesh) {
                        mesh = child
                        this.modelMaterial = child.material
                    }
                })

                if (!mesh || !this.modelMaterial) {
                    throw new Error(`No mesh or material found in bush model: ${Bush.MODEL_PATH}`)
                }

                this.modelGeometry = mesh.geometry
                if (!this.modelGeometry.boundingBox) {
                    this.modelGeometry.computeBoundingBox()
                }
                if (this.modelGeometry.boundingBox) {
                    this.boundingBox = this.modelGeometry.boundingBox.clone()
                } else {
                    console.warn(`Could not compute bounding box for ${Bush.MODEL_NAME}`)
                }

                this.instancedMesh = new THREE.InstancedMesh(this.modelGeometry, this.modelMaterial, Bush.MAX_INSTANCES)
                this.instancedMesh.castShadow = Bush.CAST_SHADOW
                this.instancedMesh.receiveShadow = Bush.RECEIVE_SHADOW
                this.instancedMesh.name = `${Bush.MODEL_NAME}InstancedMesh`
                this.instancedMesh.frustumCulled = true

                const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
                for (let i = 0; i < Bush.MAX_INSTANCES; i++) {
                    this.instancedMesh.setMatrixAt(i, zeroMatrix)
                }
                this.instancedMesh.instanceMatrix.needsUpdate = true

                resolve()
            } catch (error) {
                console.error(`Failed to initialize shared bush resources (${Bush.MODEL_NAME}):`, error)
                this.loadPromise = null
                reject(error)
            }
        })
        return this.loadPromise
    }

    public static getMaxInstances(): number {
        return Bush.MAX_INSTANCES
    }

    public static getInstancedMesh(): THREE.InstancedMesh | null {
        return Bush.instancedMesh
    }

    public static getBoundingBox(): THREE.Box3 | null {
        return this.boundingBox
    }

    public override async initialize(): Promise<void> {
        await super.initialize()
        if (!Bush.instancedMesh) {
            throw new Error("Bush shared resources not initialized")
        }

        try {
            const resourceManager = this.terrainService.getResourceManager()
            const model = await resourceManager.loadModel("bush", "models/bush/bush01.glb")

            // 그림자 및 재질 설정
            model.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true
                    child.receiveShadow = true
                    if (child.material instanceof THREE.MeshStandardMaterial) {
                        child.material.roughness = 0.8
                        child.material.metalness = 0.1
                        child.material.needsUpdate = true
                    }
                }
            })

            this.model.setModel(model)
        } catch (error) {
            console.error("Failed to initialize bush model:", error)
            throw error
        }
    }

    public setInstanceId(id: number): void {
        if (id < 0 || id >= Bush.MAX_INSTANCES) {
            console.error(`Invalid instanceId assigned to Bush: ${id}. Max is ${Bush.MAX_INSTANCES - 1}`)
            this.instanceId = -1
            return
        }
        this.instanceId = id
    }

    public updateInstance(matrix: THREE.Matrix4): void {
        if (this.instanceId === -1 || !Bush.instancedMesh) return

        try {
            Bush.instancedMesh.setMatrixAt(this.instanceId, matrix)
            Bush.instancedMesh.instanceMatrix.needsUpdate = true
        } catch (error) {
            console.error(`Error updating Bush instance ${this.instanceId} matrix:`, error)
        }
    }

    public override dispose(): void {
        super.dispose()
        this.model.dispose()
    }

    public getModel(): THREE.Group {
        return this.model.getModel()
    }

    public setPosition(x: number, y: number, z: number): void {
        this.transform.setPosition(x, y, z)
    }

    public setScale(x: number, y: number, z: number): void {
        this.transform.setScale(x, y, z)
    }

    public override update(deltaTime: number): void {
        super.update(deltaTime)
    }

    public static disposeShared(): void {
        if (this.instancedMesh) {
            if (this.instancedMesh.parent) {
                this.instancedMesh.parent.remove(this.instancedMesh)
            }
            // Geometry/Material disposal assumed handled by ResourceManager
            this.instancedMesh = null
        }
        this.modelGeometry = null
        this.modelMaterial = null
        this.boundingBox = null
        this.loadPromise = null
        // console.log(`${Bush.MODEL_NAME} shared resources disposed.`) // Optional log
    }
}

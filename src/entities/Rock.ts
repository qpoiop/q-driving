import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { ITerrainService } from "../core/ITerrainService"

export class Rock extends Entity {
    private static maxInstances: number = 0
    private static instancedMesh: THREE.InstancedMesh | null = null
    private static modelGeometry: THREE.BufferGeometry | null = null
    private static modelMaterial: THREE.Material | null = null
    private static isInitialized = false

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

    public static async initializeShared(terrainService: ITerrainService, maxInstances: number): Promise<void> {
        if (Rock.instancedMesh) return
        this.maxInstances = maxInstances

        try {
            const resourceManager = terrainService.getResourceManager()
            const rockModel = await resourceManager.loadModel("rock", "models/rock/rock01.glb")

            let rockMesh: THREE.Mesh | null = null
            rockModel.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    rockMesh = child
                    if (Array.isArray(child.material)) {
                        this.modelMaterial = child.material[0]
                    } else {
                        this.modelMaterial = child.material
                    }
                }
            })

            if (rockMesh && this.modelMaterial) {
                this.modelGeometry = rockMesh.geometry
                this.instancedMesh = new THREE.InstancedMesh(this.modelGeometry, this.modelMaterial, maxInstances)
                this.instancedMesh.castShadow = false
                this.instancedMesh.receiveShadow = true
            }

            this.isInitialized = true
        } catch (error) {
            console.error("Failed to initialize Rock shared resources:", error)
            throw error
        }
    }

    public static getMaxInstances(): number {
        return Rock.maxInstances
    }

    public static getInstancedMesh(): THREE.InstancedMesh | null {
        return this.instancedMesh
    }

    public static disposeShared(): void {
        if (this.modelGeometry) {
            this.modelGeometry.dispose()
            this.modelGeometry = null
        }
        if (this.modelMaterial) {
            this.modelMaterial.dispose()
            this.modelMaterial = null
        }
        this.instancedMesh = null
        this.isInitialized = false
    }

    public override async initialize(): Promise<void> {
        await super.initialize()
        if (!Rock.instancedMesh) {
            throw new Error("Rock shared resources not initialized")
        }

        try {
            const resourceManager = this.terrainService.getResourceManager()
            const model = await resourceManager.loadModel("rock", "models/rock/rock01.glb")

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
            console.error("Failed to initialize rock model:", error)
            throw error
        }
    }

    public setInstanceId(id: number): void {
        this.instanceId = id
    }

    public updateInstance(matrix: THREE.Matrix4): void {
        if (Rock.instancedMesh && this.instanceId >= 0) {
            Rock.instancedMesh.setMatrixAt(this.instanceId, matrix)
            Rock.instancedMesh.instanceMatrix.needsUpdate = true
        }
    }

    public override update(deltaTime: number): void {
        super.update(deltaTime)
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
}

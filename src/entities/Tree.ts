import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { ITerrainService } from "../core/ITerrainService"

export class Tree extends Entity {
    private static instancedMesh: THREE.InstancedMesh | null = null
    private static modelGeometry: THREE.BufferGeometry | null = null
    private static modelMaterial: THREE.Material | null = null
    private static loadPromise: Promise<void> | null = null

    private transform: TransformComponent
    private model: ModelComponent
    private terrainService: ITerrainService
    private instanceId: number = -1

    constructor(terrainService: ITerrainService) {
        super()
        this.terrainService = terrainService
        this.transform = new TransformComponent()
        this.model = new ModelComponent()
        this.addComponent(this.transform)
        this.addComponent(this.model)
    }

    public static async initializeShared(terrainService: ITerrainService, maxInstances: number = 1000): Promise<void> {
        if (this.loadPromise) return this.loadPromise

        this.loadPromise = new Promise<void>(async resolve => {
            try {
                const resourceManager = terrainService.getResourceManager()
                const model = await resourceManager.loadModel("tree", "models/tree/tree01.glb")

                let mesh: THREE.Mesh | null = null
                model.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        mesh = child
                        if (Array.isArray(child.material)) {
                            this.modelMaterial = child.material[0]
                        } else {
                            this.modelMaterial = child.material
                        }
                    }
                })

                if (!mesh || !this.modelMaterial) throw new Error("No mesh or material found in tree model")

                this.modelGeometry = mesh.geometry
                this.instancedMesh = new THREE.InstancedMesh(this.modelGeometry, this.modelMaterial, maxInstances)
                this.instancedMesh.castShadow = true
                this.instancedMesh.receiveShadow = true

                resolve()
            } catch (error) {
                console.error("Failed to initialize shared tree resources:", error)
                throw error
            }
        })

        return this.loadPromise
    }

    public override async initialize(): Promise<void> {
        await super.initialize()
        if (!Tree.instancedMesh) {
            throw new Error("Tree shared resources not initialized")
        }

        try {
            const resourceManager = this.terrainService.getResourceManager()
            const model = await resourceManager.loadModel("tree", "models/tree/tree01.gltf")

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
            console.error("Failed to initialize tree model:", error)
            throw error
        }
    }

    public setInstanceId(id: number): void {
        this.instanceId = id
    }

    public updateInstance(matrix: THREE.Matrix4): void {
        if (this.instanceId === -1 || !Tree.instancedMesh) return
        Tree.instancedMesh.setMatrixAt(this.instanceId, matrix)
        Tree.instancedMesh.instanceMatrix.needsUpdate = true
    }

    public getModel(): THREE.Group {
        return this.model.getModel()
    }

    public static getInstancedMesh(): THREE.InstancedMesh | null {
        return this.instancedMesh
    }

    public override update(deltaTime: number): void {
        super.update(deltaTime)
    }

    public override dispose(): void {
        super.dispose()
        this.model.dispose()
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
        this.loadPromise = null
    }
}

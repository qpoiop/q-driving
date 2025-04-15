import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { ITerrainService } from "../core/ITerrainService"

export class Tree extends Entity {
    // 단일 InstancedMesh 방식으로 복원
    private static maxInstances: number = 0
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

    public static async initializeShared(terrainService: ITerrainService, maxInstances: number): Promise<void> {
        if (Tree.instancedMesh) return
        this.maxInstances = maxInstances
        if (this.loadPromise) return this.loadPromise

        this.loadPromise = new Promise<void>(async (resolve, reject) => {
            try {
                console.log("[Tree] Loading shared tree model...")
                const resourceManager = terrainService.getResourceManager()
                const model = await resourceManager.loadModel("tree", "models/tree/tree01.glb")
                console.log("[Tree] Shared model loaded:", model)

                // 모델에 기본 회전 적용 (X축으로 -90도 회전하여 수직으로 세움)
                model.rotation.x = -Math.PI / 2

                let mesh: THREE.Mesh | null = null
                model.traverse(child => {
                    if (child instanceof THREE.Mesh && !mesh) {
                        console.log("[Tree] Found mesh in model:", child.name)
                        mesh = child
                        if (Array.isArray(child.material)) {
                            this.modelMaterial = child.material[0]
                        } else {
                            this.modelMaterial = child.material
                        }
                    }
                })

                if (!mesh || !this.modelMaterial) {
                    throw new Error("No mesh or material found in tree model")
                }

                this.modelGeometry = mesh.geometry
                this.instancedMesh = new THREE.InstancedMesh(this.modelGeometry, this.modelMaterial, maxInstances)
                this.instancedMesh.castShadow = true // 그림자 생성 활성화
                this.instancedMesh.receiveShadow = true

                // 인스턴스 행렬 초기화
                const matrix = new THREE.Matrix4()
                for (let i = 0; i < maxInstances; i++) {
                    this.instancedMesh.setMatrixAt(i, matrix)
                }
                this.instancedMesh.instanceMatrix.needsUpdate = true
                console.log("[Tree] Shared InstancedMesh created with castShadow=true")

                resolve()
            } catch (error) {
                console.error("Failed to initialize shared tree resources:", error)
                reject(error)
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
            console.log("[Tree] Initializing individual tree model...")
            const resourceManager = this.terrainService.getResourceManager()
            const model = await resourceManager.loadModel("tree-individual", "models/tree/tree01.glb")
            console.log("[Tree] Individual model loaded")

            // 모델에 기본 회전 적용 (X축으로 -90도 회전하여 수직으로 세움)
            model.rotation.x = -Math.PI / 2

            // 트리 구조 디버깅
            console.log("[Tree] Model structure:")
            model.traverse(child => {
                console.log(`[Tree] -- ${child.type}: ${child.name}`)
                if (child instanceof THREE.Mesh) {
                    console.log(`[Tree] ---- geometry: ${child.geometry.type}, vertices: ${child.geometry.attributes.position.count}`)
                    console.log(`[Tree] ---- material: ${child.material.type}`)

                    // 그림자 설정 활성화
                    child.castShadow = true
                    child.receiveShadow = true
                    console.log(`[Tree] ---- shadow settings applied: castShadow=${child.castShadow}, receiveShadow=${child.receiveShadow}`)
                }
            })

            this.model.setModel(model)
        } catch (error) {
            console.error("Failed to initialize tree model for ModelComponent:", error)
        }
    }

    public setInstanceId(id: number): void {
        this.instanceId = id
    }

    public updateInstance(matrix: THREE.Matrix4): void {
        if (this.instanceId === -1 || !Tree.instancedMesh) return

        // 회전 행렬 생성 (X축으로 -90도 회전)
        const rotationMatrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2)

        // 입력된 행렬에 회전 행렬 곱하기
        const finalMatrix = matrix.clone().multiply(rotationMatrix)

        // 최종 행렬 적용
        Tree.instancedMesh.setMatrixAt(this.instanceId, finalMatrix)
        Tree.instancedMesh.instanceMatrix.needsUpdate = true

        if (this.instanceId === 0) {
            // 디버깅: 첫 번째 인스턴스의 위치 로깅
            const position = new THREE.Vector3()
            const quaternion = new THREE.Quaternion()
            const scale = new THREE.Vector3()
            finalMatrix.decompose(position, quaternion, scale)
            console.log(
                `[Tree] Instance #${this.instanceId} updated - position: [${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(
                    2,
                )}], scale: [${scale.x.toFixed(2)}, ${scale.y.toFixed(2)}, ${scale.z.toFixed(2)}]`,
            )
        }
    }

    public getModel(): THREE.Group {
        return this.model.getModel()
    }

    public static getInstancedMesh(): THREE.InstancedMesh | null {
        return Tree.instancedMesh
    }

    public static getMaxInstances(): number {
        return Tree.maxInstances
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
            this.modelGeometry = null
        }
        if (this.modelMaterial) {
            this.modelMaterial = null
        }
        if (this.instancedMesh && this.instancedMesh.parent) {
            this.instancedMesh.parent.remove(this.instancedMesh)
        }
        this.instancedMesh = null
        this.loadPromise = null
    }
}

import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { ResourceManager } from "../core/ResourceManager"

export class Bush extends Entity {
    // --- Static Configuration ---
    public static readonly MODEL_PATH = "models/bush/bush01.glb"
    public static readonly MODEL_NAME = "bush"
    public static readonly MAX_INSTANCES = 300
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

    constructor(instanceId: number) {
        super()
        this.transform = new TransformComponent()
        this.model = new ModelComponent()
        this.addComponent(this.transform)
        this.addComponent(this.model)
        this.setInstanceId(instanceId)
    }

    public static async initializeShared(resourceManager: ResourceManager): Promise<void> {
        console.log(`Bush (${Bush.MODEL_NAME}): Initializing shared resources...`)
        if (Bush.instancedMesh) {
            console.log(`Bush (${Bush.MODEL_NAME}): Already initialized.`)
            return
        }
        if (this.loadPromise) {
            console.log(`Bush (${Bush.MODEL_NAME}): Initialization already in progress.`)
            return this.loadPromise
        }

        this.loadPromise = new Promise<void>(async (resolve, reject) => {
            try {
                console.log(`Bush (${Bush.MODEL_NAME}): Loading model...`)
                const model = await resourceManager.loadModel(Bush.MODEL_NAME, Bush.MODEL_PATH)
                model.updateMatrixWorld(true)
                console.log(`Bush (${Bush.MODEL_NAME}): Model loaded.`)

                let foundMesh: THREE.Mesh | null = null
                let foundMaterial: THREE.Material | null = null

                console.log(`Bush (${Bush.MODEL_NAME}): Traversing model for the first valid mesh...`)
                model.traverse(child => {
                    if (!foundMesh && child instanceof THREE.Mesh && child.geometry) {
                        foundMesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
                        let currentMaterial = foundMesh.material
                        if (Array.isArray(currentMaterial)) {
                            console.warn(`${Bush.MODEL_NAME} mesh ${foundMesh.name} uses multiple materials. InstancedMesh will use the first one.`)
                            foundMaterial = currentMaterial.length > 0 ? currentMaterial[0] : null
                        } else {
                            foundMaterial = currentMaterial
                        }
                        if (foundMesh && foundMaterial) {
                            console.log(
                                `Bush (${Bush.MODEL_NAME}): Found mesh ${foundMesh.name} with material ${foundMaterial.uuid.substring(0, 4)}.`,
                            )
                        }
                    }
                })

                if (!foundMesh || !foundMaterial) {
                    throw new Error(`No valid mesh or material found in bush model: ${Bush.MODEL_PATH}`)
                }

                // Use the geometry and material from the first found mesh
                this.modelGeometry = foundMesh.geometry
                this.modelMaterial = foundMaterial
                console.log(`Bush (${Bush.MODEL_NAME}): Using geometry from mesh ${foundMesh.name}.`)

                console.log(`Bush (${Bush.MODEL_NAME}): Computing bounding box...`)
                if (!this.modelGeometry.boundingBox) this.modelGeometry.computeBoundingBox()
                if (this.modelGeometry.boundingBox) {
                    this.boundingBox = this.modelGeometry.boundingBox.clone()
                    console.log(`Bush (${Bush.MODEL_NAME}): Bounding box computed:`, this.boundingBox.min, this.boundingBox.max)
                } else {
                    console.warn(`Could not compute bounding box for ${Bush.MODEL_NAME}`)
                }

                console.log(`Bush (${Bush.MODEL_NAME}): Creating InstancedMesh (Max instances: ${Bush.MAX_INSTANCES})...`)
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
                console.log(`Bush (${Bush.MODEL_NAME}): InstancedMesh created and initialized.`)

                resolve()
            } catch (error) {
                console.error(`Failed to initialize shared bush resources (${Bush.MODEL_NAME}):`, error)
                Bush.disposeShared()
                this.loadPromise = null
                reject(error)
            }
        })
        return this.loadPromise
    }

    public static getInstancedMeshes(): THREE.InstancedMesh[] {
        return this.instancedMesh ? [this.instancedMesh] : []
    }

    public static getBoundingBox(): THREE.Box3 | null {
        return this.boundingBox
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
    }

    public static disposeShared(): void {
        console.log(`Bush (${Bush.MODEL_NAME}): Disposing shared resources...`)
        if (this.instancedMesh) {
            if (this.instancedMesh.parent) {
                this.instancedMesh.parent.remove(this.instancedMesh)
            }
            // Geometry is owned by the single mesh, assume ResourceManager handles disposal
            this.instancedMesh = null
        }
        this.modelGeometry = null
        this.modelMaterial = null
        this.boundingBox = null
        this.loadPromise = null
        console.log(`${Bush.MODEL_NAME} shared resources disposed.`)
    }
}

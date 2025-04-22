import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { ResourceManager } from "../core/ResourceManager"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

export class Rock extends Entity {
    // --- Static Configuration ---
    public static readonly MODEL_PATH = "models/rock/rock01.glb"
    public static readonly MODEL_NAME = "rock"
    public static readonly MAX_INSTANCES = 200 // External config preferred
    public static readonly CAST_SHADOW = false // Rocks typically don't cast detailed shadows in racing games
    public static readonly RECEIVE_SHADOW = true
    // ---------------------------

    public static instancedMesh: THREE.InstancedMesh | null = null
    private static modelGeometry: THREE.BufferGeometry | null = null
    private static modelMaterial: THREE.Material | THREE.Material[] | null = null
    public static boundingBox: THREE.Box3 | null = null
    private static loadPromise: Promise<void> | null = null

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
        console.log(`Rock (${Rock.MODEL_NAME}): Initializing shared resources...`)
        if (Rock.instancedMesh) {
            console.log(`Rock (${Rock.MODEL_NAME}): Already initialized.`)
            return
        }
        if (this.loadPromise) {
            console.log(`Rock (${Rock.MODEL_NAME}): Initialization already in progress.`)
            return this.loadPromise
        }

        this.loadPromise = new Promise<void>(async (resolve, reject) => {
            try {
                console.log(`Rock (${Rock.MODEL_NAME}): Loading model...`)
                const model = await resourceManager.loadModel(Rock.MODEL_NAME, Rock.MODEL_PATH)
                model.updateMatrixWorld(true)
                console.log(`Rock (${Rock.MODEL_NAME}): Model loaded.`)

                const geometries: THREE.BufferGeometry[] = []
                const materials: THREE.Material[] = []
                const materialMap = new Map<string, number>()
                let combinedGeometry: THREE.BufferGeometry | null = null

                console.log(`Rock (${Rock.MODEL_NAME}): Traversing model for geometries and materials...`)
                model.traverse(child => {
                    if (child instanceof THREE.Mesh && child.geometry) {
                        const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
                        const clonedGeo = mesh.geometry.clone()
                        clonedGeo.applyMatrix4(mesh.matrixWorld)
                        geometries.push(clonedGeo)

                        let currentMaterial = mesh.material
                        if (Array.isArray(currentMaterial)) {
                            console.warn(`Rock model (${Rock.MODEL_NAME}) mesh ${mesh.name} has multiple materials. Using first.`)
                            currentMaterial = currentMaterial[0]
                        }

                        if (currentMaterial) {
                            if (!materialMap.has(currentMaterial.uuid)) {
                                materialMap.set(currentMaterial.uuid, materials.length)
                                materials.push(currentMaterial)
                            }
                        } else {
                            console.warn(`Rock model (${Rock.MODEL_NAME}) mesh ${mesh.name} is missing material.`)
                        }
                    }
                })
                console.log(`Rock (${Rock.MODEL_NAME}): Found ${geometries.length} geometries and ${materials.length} unique materials.`)

                if (geometries.length === 0) {
                    throw new Error(`No geometries found in rock model: ${Rock.MODEL_PATH}`)
                }

                // --- Try merging geometries ---
                console.log(`Rock (${Rock.MODEL_NAME}): Merging geometries...`)
                try {
                    combinedGeometry = mergeGeometries(geometries, materials.length > 1) // useGroups true only if multi-material
                    if (!combinedGeometry) throw new Error("Rock merge resulted in null geometry")
                    console.log(`Rock (${Rock.MODEL_NAME}): Geometries merged successfully.`)
                } catch (mergeError) {
                    console.warn(`Could not merge geometries for ${Rock.MODEL_NAME}, using largest geometry. Error: ${mergeError}`)
                    let largestGeo: THREE.BufferGeometry | null = null
                    let maxVertices = -1
                    geometries.forEach(geo => {
                        const vertices = geo.attributes.position.count
                        if (vertices > maxVertices) {
                            maxVertices = vertices
                            largestGeo = geo
                        }
                    })
                    combinedGeometry = largestGeo
                    if (materials.length > 1) {
                        console.warn(`Fell back to largest rock geometry, using only the first material.`)
                        materials.splice(1)
                    }
                }
                // Dispose individual geometries after merging/selection
                geometries.forEach(geo => geo.dispose())

                if (!combinedGeometry) {
                    throw new Error(`Failed to obtain valid geometry for ${Rock.MODEL_NAME}`)
                }
                this.modelGeometry = combinedGeometry
                this.modelMaterial = materials.length === 1 ? materials[0] : materials
                console.log(`Rock (${Rock.MODEL_NAME}): Final geometry and material set.`)

                console.log(`Rock (${Rock.MODEL_NAME}): Computing bounding box...`)
                if (!this.modelGeometry.boundingBox) this.modelGeometry.computeBoundingBox()
                if (this.modelGeometry.boundingBox) {
                    this.boundingBox = this.modelGeometry.boundingBox.clone()
                    console.log(`Rock (${Rock.MODEL_NAME}): Bounding box computed:`, this.boundingBox.min, this.boundingBox.max)
                } else {
                    console.warn(`Could not compute bounding box for ${Rock.MODEL_NAME}`)
                }

                console.log(`Rock (${Rock.MODEL_NAME}): Creating InstancedMesh (Max instances: ${Rock.MAX_INSTANCES})...`)
                this.instancedMesh = new THREE.InstancedMesh(this.modelGeometry, this.modelMaterial, Rock.MAX_INSTANCES)
                this.instancedMesh.castShadow = Rock.CAST_SHADOW
                this.instancedMesh.receiveShadow = Rock.RECEIVE_SHADOW
                this.instancedMesh.name = `${Rock.MODEL_NAME}InstancedMesh`
                this.instancedMesh.frustumCulled = true

                const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
                for (let i = 0; i < Rock.MAX_INSTANCES; i++) {
                    this.instancedMesh.setMatrixAt(i, zeroMatrix)
                }
                this.instancedMesh.instanceMatrix.needsUpdate = true
                console.log(`Rock (${Rock.MODEL_NAME}): InstancedMesh created and initialized.`)

                resolve()
            } catch (error) {
                console.error(`Failed to initialize shared rock resources (${Rock.MODEL_NAME}):`, error)
                Rock.disposeShared() // Clean up
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

    public static disposeShared(): void {
        console.log(`Rock (${Rock.MODEL_NAME}): Disposing shared resources...`)
        if (this.instancedMesh) {
            if (this.instancedMesh.parent) {
                this.instancedMesh.parent.remove(this.instancedMesh)
            }
            this.instancedMesh = null
        }
        this.modelGeometry?.dispose()
        this.modelGeometry = null
        this.modelMaterial = null
        this.boundingBox = null
        this.loadPromise = null
        console.log(`Rock (${Rock.MODEL_NAME}): Shared resources disposed.`)
    }

    public setInstanceId(id: number): void {
        if (id < 0 || id >= Rock.MAX_INSTANCES) {
            console.error(`Invalid instanceId assigned to Rock: ${id}. Max is ${Rock.MAX_INSTANCES - 1}`)
            this.instanceId = -1
            return
        }
        this.instanceId = id
    }

    public updateInstance(matrix: THREE.Matrix4): void {
        if (this.instanceId === -1 || !Rock.instancedMesh) return

        try {
            Rock.instancedMesh.setMatrixAt(this.instanceId, matrix)
            Rock.instancedMesh.instanceMatrix.needsUpdate = true
        } catch (error) {
            console.error(`Error updating Rock instance ${this.instanceId} matrix:`, error)
        }
    }

    public override dispose(): void {
        super.dispose()
        // Instance doesn't own shared resources, nothing specific to dispose here
    }

    // Methods below might not be needed if Rock is only used via EnvironmentManager
    /*
    public getModel(): THREE.Group {
        return this.model.getModel()
    }

    public setPosition(x: number, y: number, z: number): void {
        this.transform.setPosition(x, y, z)
    }

    public setScale(x: number, y: number, z: number): void {
        this.transform.setScale(x, y, z)
    }
    */
}

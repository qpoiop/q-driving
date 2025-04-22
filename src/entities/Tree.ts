import * as THREE from "three"
import { ResourceManager } from "../core/ResourceManager"

// Type definition for classes that manage instanced environment entities
export interface IInstancedEnvironmentEntityClass {
    MODEL_PATH: string
    MODEL_NAME: string
    MAX_INSTANCES: number
    CAST_SHADOW: boolean
    RECEIVE_SHADOW: boolean
    instancedMesh: THREE.InstancedMesh | null
    boundingBox: THREE.Box3 | null

    new (instanceId: number): {
        setInstanceId(id: number): void
        updateInstance(matrix: THREE.Matrix4): void
        dispose(): void // Individual instance dispose (usually no-op)
    }

    initializeShared(resourceManager: ResourceManager): Promise<void>
    getInstancedMesh(): THREE.InstancedMesh | null
    getMaxInstances(): number
    getBoundingBox(): THREE.Box3 | null
    disposeShared(): void
}

export class Tree {
    // --- Static Configuration ---

    public static readonly MODEL_PATH = "models/tree/tree01.glb"
    public static readonly MODEL_NAME = "tree"
    public static readonly MAX_INSTANCES = 500 // External config preferred
    public static readonly CAST_SHADOW = true
    public static readonly RECEIVE_SHADOW = true
    // ---------------------------

    public static instancedMesh: THREE.InstancedMesh | null = null
    private static modelGeometry: THREE.BufferGeometry | null = null
    private static modelMaterial: THREE.Material | THREE.Material[] | null = null
    private static loadPromise: Promise<void> | null = null
    public static boundingBox: THREE.Box3 | null = null // Original model bounding box

    private instanceId: number = -1

    constructor(instanceId: number) {
        this.setInstanceId(instanceId)
    }

    public static async initializeShared(resourceManager: ResourceManager): Promise<void> {
        if (Tree.instancedMesh) return
        if (this.loadPromise) return this.loadPromise

        this.loadPromise = new Promise<void>(async (resolve, reject) => {
            try {
                const model = await resourceManager.loadModel(Tree.MODEL_NAME, Tree.MODEL_PATH)

                let mesh: THREE.Mesh | null = null
                model.traverse(child => {
                    // Find the first mesh to use for instancing
                    if (child instanceof THREE.Mesh && !mesh) {
                        mesh = child
                        // Use the material(s) from the mesh
                        this.modelMaterial = child.material
                    }
                })

                if (!mesh || !this.modelMaterial) {
                    throw new Error(`No mesh or material found in tree model: ${Tree.MODEL_PATH}`)
                }

                this.modelGeometry = mesh.geometry

                // Compute bounding box from the geometry
                if (!this.modelGeometry.boundingBox) {
                    this.modelGeometry.computeBoundingBox()
                }
                if (this.modelGeometry.boundingBox) {
                    this.boundingBox = this.modelGeometry.boundingBox.clone()
                    // Optional: Apply mesh's world matrix if needed (e.g., if mesh isn't at origin/identity scale in GLB)
                    // this.boundingBox.applyMatrix4(mesh.matrixWorld);
                } else {
                    console.warn(`Could not compute bounding box for ${Tree.MODEL_NAME}`)
                }

                // Ensure material supports instancing if needed (e.g., custom shaders)

                this.instancedMesh = new THREE.InstancedMesh(this.modelGeometry, this.modelMaterial, Tree.MAX_INSTANCES)
                this.instancedMesh.castShadow = Tree.CAST_SHADOW
                this.instancedMesh.receiveShadow = Tree.RECEIVE_SHADOW
                this.instancedMesh.name = `${Tree.MODEL_NAME}InstancedMesh`
                this.instancedMesh.frustumCulled = true // Enable frustum culling for performance

                // Initialize all instances with zero scale matrix (invisible)
                const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
                for (let i = 0; i < Tree.MAX_INSTANCES; i++) {
                    this.instancedMesh.setMatrixAt(i, zeroMatrix)
                }
                this.instancedMesh.instanceMatrix.needsUpdate = true // Important after setting matrices

                resolve()
            } catch (error) {
                console.error(`Failed to initialize shared tree resources (${Tree.MODEL_NAME}):`, error)
                this.loadPromise = null // Reset promise on error
                reject(error)
            }
        })

        return this.loadPromise
    }

    public setInstanceId(id: number): void {
        if (id < 0 || id >= Tree.MAX_INSTANCES) {
            console.error(`Invalid instanceId assigned to Tree: ${id}. Max is ${Tree.MAX_INSTANCES - 1}`)
            this.instanceId = -1 // Mark as invalid
            return
        }
        this.instanceId = id
    }

    // Updates the matrix for this specific instance
    public updateInstance(matrix: THREE.Matrix4): void {
        if (this.instanceId === -1 || !Tree.instancedMesh) {
            // Log error only once or use a different mechanism to avoid spamming
            // console.error(`Attempted to update invalid Tree instance (${this.instanceId})`);
            return
        }

        try {
            Tree.instancedMesh.setMatrixAt(this.instanceId, matrix)
            // Flag the matrix for update. Consider optimizing this if updates are sparse.
            Tree.instancedMesh.instanceMatrix.needsUpdate = true
        } catch (error) {
            console.error(`Error updating Tree instance ${this.instanceId} matrix:`, error)
        }
    }

    public static getInstancedMesh(): THREE.InstancedMesh | null {
        return Tree.instancedMesh
    }

    public static getMaxInstances(): number {
        return Tree.MAX_INSTANCES
    }

    /**
     * Returns the bounding box of the original model geometry.
     * This does not account for instance-specific transformations (scale, rotation).
     * Collision systems need to apply the instance's world matrix to this box.
     */
    public static getBoundingBox(): THREE.Box3 | null {
        return this.boundingBox
    }

    // Dispose method for individual instances (usually nothing to do here for instanced objects)
    public dispose(): void {
        // No THREE resources owned by individual instances
    }

    // Dispose shared resources (geometry, material, instancedMesh)
    public static disposeShared(): void {
        if (this.instancedMesh) {
            // Remove from scene if attached
            if (this.instancedMesh.parent) {
                this.instancedMesh.parent.remove(this.instancedMesh)
            }
            // Dispose geometry and material if they are not shared elsewhere or managed by ResourceManager
            // Assuming ResourceManager handles disposal of geometries/materials fetched via loadModel
            this.instancedMesh = null
        }
        // Clear references
        this.modelGeometry = null
        this.modelMaterial = null
        this.boundingBox = null
        this.loadPromise = null
        // console.log(`${Tree.MODEL_NAME} shared resources disposed.`) // Optional log
    }
}

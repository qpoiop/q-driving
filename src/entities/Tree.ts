import * as THREE from "three"
import { ResourceManager } from "../core/ResourceManager"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { BufferAttribute } from "three"

export class Tree {
    // --- Static Configuration ---

    public static readonly MODEL_PATH = "models/tree/tree01.glb"
    public static readonly MODEL_NAME = "tree"
    public static readonly MAX_INSTANCES = 500 // External config preferred
    public static readonly CAST_SHADOW = true
    public static readonly RECEIVE_SHADOW = true
    // --- Model specific adjustments ---
    public static readonly APPLY_ROTATION_X = -Math.PI / 2 // Adjust if model needs rotation
    // ---------------------------

    // Store multiple meshes, keyed by material UUID or a default key
    public static instancedMeshes: Map<string, THREE.InstancedMesh> = new Map()
    private static modelGeometries: Map<string, THREE.BufferGeometry> = new Map()
    private static modelMaterials: Map<string, THREE.Material> = new Map()
    private static loadPromise: Promise<void> | null = null
    public static boundingBox: THREE.Box3 | null = null // Combined bounding box

    private instanceId: number = -1

    constructor(instanceId: number) {
        this.setInstanceId(instanceId)
    }

    // Helper to check if geometry attributes are compatible for merging
    private static haveSameAttributes(geoA: THREE.BufferGeometry, geoB: THREE.BufferGeometry): boolean {
        const attrsA = Object.keys(geoA.attributes).sort()
        const attrsB = Object.keys(geoB.attributes).sort()
        if (attrsA.length !== attrsB.length) return false
        for (let i = 0; i < attrsA.length; i++) {
            if (attrsA[i] !== attrsB[i]) return false
            // Optional: Deeper check for attribute types/components if needed
            const attrA = geoA.attributes[attrsA[i]] as BufferAttribute
            const attrB = geoB.attributes[attrsB[i]] as BufferAttribute
            if (attrA.itemSize !== attrB.itemSize || attrA.normalized !== attrB.normalized) {
                console.warn(
                    `Attribute mismatch detail: ${attrsA[i]}, itemSize (${attrA.itemSize} vs ${attrB.itemSize}), normalized (${attrA.normalized} vs ${attrB.normalized})`,
                )
                return false
            }
        }
        return true
    }

    public static async initializeShared(resourceManager: ResourceManager): Promise<void> {
        if (Tree.instancedMeshes.size > 0) return
        if (this.loadPromise) return this.loadPromise

        this.loadPromise = new Promise<void>(async (resolve, reject) => {
            try {
                const model = await resourceManager.loadModel(Tree.MODEL_NAME, Tree.MODEL_PATH)
                if (Tree.APPLY_ROTATION_X !== 0) {
                    model.rotation.x = Tree.APPLY_ROTATION_X
                }
                model.updateMatrixWorld(true)

                // Group geometries by material UUID
                const geometriesByMaterial = new Map<string, THREE.BufferGeometry[]>()
                const materialsByUUID = new Map<string, THREE.Material>()

                model.traverse(child => {
                    if (child instanceof THREE.Mesh && child.geometry && child.material) {
                        const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
                        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

                        materials.forEach(material => {
                            if (!material) return
                            const matUUID = material.uuid
                            if (!materialsByUUID.has(matUUID)) {
                                materialsByUUID.set(matUUID, material)
                                geometriesByMaterial.set(matUUID, [])
                            }

                            // Clone geometry and apply mesh's world matrix
                            const clonedGeo = mesh.geometry.clone()
                            clonedGeo.applyMatrix4(mesh.matrixWorld)

                            // Check attribute compatibility before adding
                            const groupGeos = geometriesByMaterial.get(matUUID)!
                            if (groupGeos.length > 0 && !Tree.haveSameAttributes(groupGeos[0], clonedGeo)) {
                                console.error(
                                    `Tree (${Tree.MODEL_NAME}): Mesh ${mesh.name} has incompatible attributes for material ${matUUID}. Skipping this mesh for this material group.`,
                                )
                                clonedGeo.dispose() // Dispose cloned geometry
                                return // Skip this geometry for this material group
                            }

                            groupGeos.push(clonedGeo)
                        })
                    }
                })

                if (geometriesByMaterial.size === 0) {
                    throw new Error(`No valid geometries/materials found in tree model: ${Tree.MODEL_PATH}`)
                }

                const combinedBBox = new THREE.Box3() // To calculate overall bounding box
                Tree.instancedMeshes.clear()
                Tree.modelGeometries.clear()
                Tree.modelMaterials.clear()

                // Create an InstancedMesh for each material group
                for (const [matUUID, geometries] of geometriesByMaterial.entries()) {
                    if (geometries.length === 0) continue // Skip if no compatible geometries found for this material

                    try {
                        const material = materialsByUUID.get(matUUID)!
                        const mergedGeometry = mergeGeometries(geometries, false) // useGroups = false, materials handled separately
                        if (!mergedGeometry) {
                            throw new Error(`mergeGeometries returned null for material ${matUUID}`)
                        }

                        if (!mergedGeometry.boundingBox) mergedGeometry.computeBoundingBox()
                        if (mergedGeometry.boundingBox) {
                            combinedBBox.union(mergedGeometry.boundingBox) // Expand combined box
                        } else {
                            console.warn(`Could not compute bounding box for merged geometry of material ${matUUID}`)
                        }

                        const instancedMesh = new THREE.InstancedMesh(mergedGeometry, material, Tree.MAX_INSTANCES)
                        instancedMesh.castShadow = Tree.CAST_SHADOW
                        instancedMesh.receiveShadow = Tree.RECEIVE_SHADOW
                        instancedMesh.name = `${Tree.MODEL_NAME}InstancedMesh_${matUUID.substring(0, 4)}` // Unique name
                        instancedMesh.frustumCulled = true

                        const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
                        for (let i = 0; i < Tree.MAX_INSTANCES; i++) {
                            instancedMesh.setMatrixAt(i, zeroMatrix)
                        }
                        instancedMesh.instanceMatrix.needsUpdate = true

                        // Store the results
                        Tree.instancedMeshes.set(matUUID, instancedMesh)
                        Tree.modelGeometries.set(matUUID, mergedGeometry)
                        Tree.modelMaterials.set(matUUID, material)

                        console.log(`Created InstancedMesh for Tree material group: ${matUUID.substring(0, 4)} with ${geometries.length} sub-meshes.`) // Log success
                    } catch (error) {
                        console.error(`Failed to create InstancedMesh for Tree material group ${matUUID}:`, error)
                        // Dispose geometries if merge failed mid-way
                        geometries.forEach(geo => geo.dispose())
                        // Continue to next material group if possible
                    }
                }

                // Dispose original individual geometries after merging
                geometriesByMaterial.forEach(geos => geos.forEach(geo => geo.dispose()))

                if (Tree.instancedMeshes.size === 0) {
                    throw new Error(`Failed to create any InstancedMesh for ${Tree.MODEL_NAME}. Check logs for errors.`)
                }

                Tree.boundingBox = combinedBBox.isEmpty() ? null : combinedBBox
                console.log(`Tree (${Tree.MODEL_NAME}) shared resources initialized with ${Tree.instancedMeshes.size} InstancedMesh(es).`) // Log total meshes created
                resolve()
            } catch (error) {
                console.error(`Failed to initialize shared tree resources (${Tree.MODEL_NAME}):`, error)
                Tree.disposeShared() // Clean up partially initialized resources
                this.loadPromise = null
                reject(error)
            }
        })

        return this.loadPromise
    }

    public setInstanceId(id: number): void {
        if (id < 0 || id >= Tree.MAX_INSTANCES) {
            console.error(`Invalid instanceId assigned to Tree: ${id}. Max is ${Tree.MAX_INSTANCES - 1}`)
            this.instanceId = -1
            return
        }
        this.instanceId = id
    }

    // Updates the matrix for this specific instance in ALL relevant InstancedMeshes
    public updateInstance(matrix: THREE.Matrix4): void {
        if (this.instanceId === -1 || Tree.instancedMeshes.size === 0) {
            return
        }

        try {
            Tree.instancedMeshes.forEach(mesh => {
                mesh.setMatrixAt(this.instanceId, matrix)
                mesh.instanceMatrix.needsUpdate = true // Flag for update
            })
        } catch (error) {
            console.error(`Error updating Tree instance ${this.instanceId} matrices:`, error)
        }
    }

    public static getInstancedMeshes(): THREE.InstancedMesh[] {
        return Array.from(this.instancedMeshes.values())
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
        Tree.instancedMeshes.forEach(mesh => {
            if (mesh.parent) {
                mesh.parent.remove(mesh)
            }
            // Geometry and Material are now managed in maps below
        })
        Tree.instancedMeshes.clear()

        Tree.modelGeometries.forEach(geometry => geometry.dispose())
        Tree.modelGeometries.clear()

        // Assume materials loaded by ResourceManager are disposed there
        Tree.modelMaterials.clear()

        Tree.boundingBox = null
        Tree.loadPromise = null
        console.log(`${Tree.MODEL_NAME} shared resources disposed.`)
    }
}

import * as THREE from "three"
import { ResourceManager } from "../core/ResourceManager"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { BufferAttribute, InstancedBufferAttribute } from "three"
import { BaseEnvironmentEntity } from "../core/BaseEnvironmentEntity"
import { ManagedEnvironmentObject } from "../core/EnvironmentManager"
import { LOD_DISTANCES_SQUARED, LOD_SCALE_FACTORS } from "../core/EnvironmentManager"

// Tree specific adjustments might be needed within updateInstanceMatrix
const TRUNK_CORRECTION_ROTATION = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2) // Example: Rotate -90 degrees around X axis
const LEAF_SCALE_CORRECTION_FACTOR = 0.5 // Example: Scale leaves to 50%

// Shader chunks for injection (ensure unique names)
const treeVertexShaderHeader = `
  attribute float instanceAlpha; // Per-instance alpha
  varying float vInstanceAlpha;
`
const treeVertexShaderMain = `
  vInstanceAlpha = instanceAlpha;
`
const treeFragmentShaderHeader = `
  varying float vInstanceAlpha;
`
const treeFragmentShaderOutput = `
  gl_FragColor.a *= vInstanceAlpha;
`

export class Tree extends BaseEnvironmentEntity {
    // --- Static Configuration ---

    public static readonly MODEL_PATH = "models/tree/tree01.glb"
    public static readonly MODEL_NAME = "tree"
    public static readonly MAX_INSTANCES = 50 // External config preferred
    public static readonly CAST_SHADOW = true
    public static readonly RECEIVE_SHADOW = true
    // --- Model specific adjustments ---
    // ---------------------------

    // Store multiple meshes, keyed by material UUID or a default key
    public static instancedMeshes: Map<string, THREE.InstancedMesh> = new Map()
    private static modelGeometries: Map<string, THREE.BufferGeometry> = new Map()
    public static modelMaterials: Map<string, THREE.Material> = new Map()
    private static loadPromise: Promise<void> | null = null
    public static boundingBox: THREE.Box3 | null = null // Combined bounding box

    public readonly instanceId: number

    // Reusable objects for matrix calculation
    private static matrix = new THREE.Matrix4()
    private static finalScale = new THREE.Vector3()
    private static rotationQuaternion = new THREE.Quaternion()
    private static finalQuaternion = new THREE.Quaternion() // For combining rotations
    private static tempPosition = new THREE.Vector3() // For decompose/compose

    // LOD interpolation helpers
    private currentLodScale: number = 1.0 // Store current interpolated scale
    private static LOD_DAMPING_FACTOR = 0.1 // Adjust for smoother/faster interpolation

    constructor(instanceId: number) {
        super()
        if (instanceId < 0 || instanceId >= Tree.MAX_INSTANCES) {
            console.error(`Invalid instanceId assigned to Tree: ${instanceId}. Max is ${Tree.MAX_INSTANCES - 1}`)
            this.instanceId = -1
        } else {
            this.instanceId = instanceId
        }
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

    public static override async initializeShared(resourceManager: ResourceManager): Promise<void> {
        console.log(`Tree (${Tree.MODEL_NAME}): Initializing shared resources...`)
        if (Tree.instancedMeshes.size > 0) return Promise.resolve()
        if (this.loadPromise) return this.loadPromise

        this.loadPromise = new Promise<void>(async (resolve, reject) => {
            try {
                const model = await resourceManager.loadModel(Tree.MODEL_NAME, Tree.MODEL_PATH)
                model.updateMatrixWorld(true)

                const geometriesByMaterial = new Map<string, THREE.BufferGeometry[]>()
                const materialsByUUID = new Map<string, THREE.Material>()
                const leafMaterialNames = ["branch1", "branch2", "branch3"]

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

                            const clonedGeo = mesh.geometry.clone()

                            // Decompose the mesh's world matrix
                            const position = new THREE.Vector3()
                            const quaternion = new THREE.Quaternion()
                            const scale = new THREE.Vector3()
                            mesh.matrixWorld.decompose(position, quaternion, scale)

                            // Create a matrix with only position and rotation (discarding original scale)
                            const rotationPositionMatrix = new THREE.Matrix4()
                            // Use decomposed position & quaternion, but apply scale 1,1,1
                            rotationPositionMatrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1))

                            // Apply the matrix without the original node's scale
                            clonedGeo.applyMatrix4(rotationPositionMatrix)

                            const groupGeos = geometriesByMaterial.get(matUUID)!
                            if (groupGeos.length > 0 && !Tree.haveSameAttributes(groupGeos[0], clonedGeo)) {
                                console.error(
                                    `Tree (${Tree.MODEL_NAME}): Mesh ${mesh.name} has incompatible attributes for material ${matUUID}. Skipping this mesh for this material group.`,
                                )
                                clonedGeo.dispose()
                                return
                            }

                            groupGeos.push(clonedGeo)
                        })
                    }
                })

                if (geometriesByMaterial.size === 0) {
                    throw new Error(`No valid geometries/materials found in tree model: ${Tree.MODEL_PATH}`)
                }

                const combinedBBox = new THREE.Box3()
                Tree.instancedMeshes.clear()
                Tree.modelGeometries.clear()
                Tree.modelMaterials.clear()

                for (const [matUUID, geometries] of geometriesByMaterial.entries()) {
                    if (geometries.length === 0) continue

                    try {
                        const material = materialsByUUID.get(matUUID)!

                        const mergedGeometry = mergeGeometries(geometries, false)
                        if (!mergedGeometry) {
                            throw new Error(`Tree mergeGeometries returned null for material ${matUUID}`)
                        }

                        if (!mergedGeometry.boundingBox) mergedGeometry.computeBoundingBox()
                        if (mergedGeometry.boundingBox) {
                            combinedBBox.union(mergedGeometry.boundingBox)
                        } else {
                            console.warn(`Could not compute bounding box for merged geometry of material ${matUUID}`)
                        }

                        const instancedMesh = new THREE.InstancedMesh(mergedGeometry, material, Tree.MAX_INSTANCES)
                        instancedMesh.castShadow = Tree.CAST_SHADOW
                        instancedMesh.receiveShadow = Tree.RECEIVE_SHADOW
                        instancedMesh.name = `${Tree.MODEL_NAME}InstancedMesh_${matUUID.substring(0, 4)}`
                        instancedMesh.frustumCulled = true

                        const instanceAlphas = new Float32Array(Tree.MAX_INSTANCES).fill(1.0)
                        mergedGeometry.setAttribute("instanceAlpha", new InstancedBufferAttribute(instanceAlphas, 1))

                        const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
                        for (let i = 0; i < Tree.MAX_INSTANCES; i++) {
                            instancedMesh.setMatrixAt(i, zeroMatrix)
                        }
                        instancedMesh.instanceMatrix.needsUpdate = true

                        Tree.instancedMeshes.set(matUUID, instancedMesh)
                        Tree.modelGeometries.set(matUUID, mergedGeometry)
                        Tree.modelMaterials.set(matUUID, material)

                        material.onBeforeCompile = shader => {
                            shader.vertexShader = treeVertexShaderHeader + shader.vertexShader
                            shader.vertexShader = shader.vertexShader.replace(
                                "#include <project_vertex>",
                                "#include <project_vertex>\n" + treeVertexShaderMain,
                            )

                            shader.fragmentShader = treeFragmentShaderHeader + shader.fragmentShader
                            shader.fragmentShader = shader.fragmentShader.replace(
                                "#include <output_fragment>",
                                "#include <output_fragment>\n" + treeFragmentShaderOutput,
                            )
                        }
                        material.defines = material.defines || {}
                        material.defines.USE_INSTANCING = ""
                        material.needsUpdate = true
                    } catch (error) {
                        console.error(`Failed to create InstancedMesh for Tree material group ${matUUID}:`, error)
                        geometries.forEach(geo => geo.dispose())
                    }
                }

                geometriesByMaterial.forEach(geos => geos.forEach(geo => geo.dispose()))

                if (Tree.instancedMeshes.size === 0) {
                    throw new Error(`Failed to create any InstancedMesh for ${Tree.MODEL_NAME}. Check logs for errors.`)
                }

                Tree.boundingBox = combinedBBox.isEmpty() ? null : combinedBBox
                console.log(`Tree (${Tree.MODEL_NAME}) shared resources initialized with ${Tree.instancedMeshes.size} InstancedMesh(es).`)
                resolve()
            } catch (error) {
                console.error(`Failed to initialize shared tree resources (${Tree.MODEL_NAME}):`, error)
                Tree.disposeShared()
                this.loadPromise = null
                reject(error)
            }
        })

        return this.loadPromise
    }

    public override updateInstanceMatrix(baseTransform: ManagedEnvironmentObject, cameraPosition: THREE.Vector3): void {
        if (this.instanceId === -1 || Tree.instancedMeshes.size === 0) return

        let targetLodScale = LOD_SCALE_FACTORS.HIGH
        if (baseTransform.distanceSq > LOD_DISTANCES_SQUARED.MEDIUM) {
            targetLodScale = LOD_SCALE_FACTORS.LOW
        } else if (baseTransform.distanceSq > LOD_DISTANCES_SQUARED.HIGH) {
            targetLodScale = LOD_SCALE_FACTORS.MEDIUM
        }

        this.currentLodScale = THREE.MathUtils.damp(this.currentLodScale, targetLodScale, Tree.LOD_DAMPING_FACTOR * 100, 1 / 60)

        Tree.finalScale.set(baseTransform.scale.x, baseTransform.scale.y * 0.7, baseTransform.scale.z).multiplyScalar(this.currentLodScale)

        Tree.rotationQuaternion.setFromEuler(baseTransform.rotation)

        try {
            const scaleToUse = Tree.finalScale
            const rotationToUse = Tree.rotationQuaternion

            if (
                isNaN(baseTransform.position.x) ||
                isNaN(rotationToUse.x) ||
                isNaN(scaleToUse.x) ||
                isNaN(baseTransform.position.y) ||
                isNaN(baseTransform.position.z) ||
                isNaN(rotationToUse.y) ||
                isNaN(rotationToUse.z) ||
                isNaN(rotationToUse.w) ||
                isNaN(scaleToUse.y) ||
                isNaN(scaleToUse.z)
            ) {
                console.error(`Tree [${this.instanceId}] - NaN detected before compose. Applying zero matrix.`)
                Tree.matrix.makeScale(0, 0, 0)
            } else {
                Tree.matrix.compose(baseTransform.position, rotationToUse, scaleToUse)
            }

            Tree.instancedMeshes.forEach(mesh => {
                if (this.instanceId < mesh.count) {
                    mesh.setMatrixAt(this.instanceId, Tree.matrix)
                    mesh.instanceMatrix.needsUpdate = true
                } else {
                    console.warn(`Tree instanceId ${this.instanceId} is out of bounds for mesh ${mesh.name} (count: ${mesh.count})`)
                }
            })
        } catch (error) {
            console.error(`Error updating Tree instance ${this.instanceId} matrices:`, error)
        }

        if (Tree.finalScale.x <= 0.01 || Tree.finalScale.y <= 0.01 || Tree.finalScale.z <= 0.01) {
            Tree.finalScale.set(0.01, 0.01, 0.01)
        }
    }

    public static override getInstancedMeshes(): THREE.InstancedMesh[] {
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

    public dispose(): void {
        // No THREE resources owned by individual instances
    }

    public static override disposeShared(): void {
        console.log(`Tree (${Tree.MODEL_NAME}): Disposing shared resources...`)
        Tree.instancedMeshes.forEach(mesh => {
            if (mesh.parent) {
                mesh.parent.remove(mesh)
            }
        })
        Tree.instancedMeshes.clear()

        Tree.modelGeometries.forEach(geometry => geometry.dispose())
        Tree.modelGeometries.clear()

        Tree.modelMaterials.forEach(material => material.dispose())
        Tree.modelMaterials.clear()

        Tree.boundingBox = null
        Tree.loadPromise = null
        console.log(`Tree (${Tree.MODEL_NAME}): Shared resources disposed.`)
    }

    private static instanceWorldBox = new THREE.Box3()
    private static instanceMatrix = new THREE.Matrix4()
    private static instanceRotationQuat = new THREE.Quaternion()

    public getWorldBoundingBox(instanceTransform: ManagedEnvironmentObject): THREE.Box3 | null {
        if (!Tree.boundingBox) {
            return null
        }

        Tree.instanceRotationQuat.setFromEuler(instanceTransform.rotation)
        Tree.instanceMatrix.compose(instanceTransform.position, Tree.instanceRotationQuat, instanceTransform.scale)
        Tree.instanceWorldBox.copy(Tree.boundingBox).applyMatrix4(Tree.instanceMatrix)

        return Tree.instanceWorldBox
    }
}

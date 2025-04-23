import * as THREE from "three"
import { ResourceManager } from "../core/ResourceManager"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { BufferAttribute, InstancedBufferAttribute } from "three"
import { BaseEnvironmentEntity } from "../core/BaseEnvironmentEntity"
import { ManagedEnvironmentObject } from "../core/EnvironmentManager"
import { LOD_DISTANCES_SQUARED, LOD_SCALE_FACTORS } from "../core/EnvironmentManager"

// Shader chunks for injection (ensure unique names)
const bushVertexShaderHeader = `
  attribute float instanceAlpha;
  varying float vInstanceAlpha;
`
const bushVertexShaderMain = `
  vInstanceAlpha = instanceAlpha;
`
const bushFragmentShaderHeader = `
  varying float vInstanceAlpha;
`
const bushFragmentShaderOutput = `
  gl_FragColor.a *= vInstanceAlpha;
`

export class Bush extends BaseEnvironmentEntity {
    // --- Static Configuration ---
    public static readonly MODEL_PATH = "models/bush/bush01.glb"
    public static readonly MODEL_NAME = "bush"
    public static readonly MAX_INSTANCES = 300
    public static readonly CAST_SHADOW = true
    public static readonly RECEIVE_SHADOW = true
    // ---------------------------

    public static instancedMeshes: Map<string, THREE.InstancedMesh> = new Map()
    private static modelGeometries: Map<string, THREE.BufferGeometry> = new Map()
    public static modelMaterials: Map<string, THREE.Material> = new Map()
    public static boundingBox: THREE.Box3 | null = null
    private static loadPromise: Promise<void> | null = null

    public readonly instanceId: number

    // Reusable objects for matrix calculation
    private static matrix = new THREE.Matrix4()
    private static finalScale = new THREE.Vector3()
    private static rotationQuaternion = new THREE.Quaternion()

    // LOD interpolation helpers
    private currentLodScale: number = 1.0
    private static LOD_DAMPING_FACTOR = 0.1

    constructor(instanceId: number) {
        super()
        if (instanceId < 0 || instanceId >= Bush.MAX_INSTANCES) {
            console.error(`Invalid instanceId assigned to Bush: ${instanceId}. Max is ${Bush.MAX_INSTANCES - 1}`)
            this.instanceId = -1 // Or throw error
        } else {
            this.instanceId = instanceId
        }
    }

    private static haveSameAttributes(geoA: THREE.BufferGeometry, geoB: THREE.BufferGeometry): boolean {
        const attrsA = Object.keys(geoA.attributes).sort()
        const attrsB = Object.keys(geoB.attributes).sort()
        if (attrsA.length !== attrsB.length) return false
        for (let i = 0; i < attrsA.length; i++) {
            if (attrsA[i] !== attrsB[i]) return false
            const attrA = geoA.attributes[attrsA[i]] as BufferAttribute
            const attrB = geoB.attributes[attrsB[i]] as BufferAttribute
            if (attrA.itemSize !== attrB.itemSize || attrA.normalized !== attrB.normalized) {
                return false
            }
        }
        return true
    }

    public static override async initializeShared(resourceManager: ResourceManager): Promise<void> {
        console.log(`Bush (${Bush.MODEL_NAME}): Initializing shared resources...`)
        if (Bush.instancedMeshes.size > 0) return Promise.resolve()
        if (this.loadPromise) return this.loadPromise

        this.loadPromise = new Promise<void>(async (resolve, reject) => {
            try {
                const model = await resourceManager.loadModel(Bush.MODEL_NAME, Bush.MODEL_PATH)
                model.updateMatrixWorld(true)

                const geometriesByMaterial = new Map<string, THREE.BufferGeometry[]>()
                const materialsByUUID = new Map<string, THREE.Material>()
                // const leafMaterialNames: string[] = [] // Bush likely has leaves, maybe name check needed?

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
                                // Log material properties once
                            }

                            const clonedGeo = mesh.geometry.clone()
                            // --- NEW LOGIC ---
                            // Decompose the mesh's world matrix
                            const position = new THREE.Vector3()
                            const quaternion = new THREE.Quaternion()
                            const scale = new THREE.Vector3()
                            mesh.matrixWorld.decompose(position, quaternion, scale)

                            // Create a matrix with only position and rotation (discarding original scale)
                            const rotationPositionMatrix = new THREE.Matrix4()
                            rotationPositionMatrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1))

                            // Apply the matrix without the original node's scale
                            clonedGeo.applyMatrix4(rotationPositionMatrix)
                            // --- END NEW LOGIC ---

                            const groupGeos = geometriesByMaterial.get(matUUID)!
                            if (groupGeos.length > 0 && !Bush.haveSameAttributes(groupGeos[0], clonedGeo)) {
                                console.warn(`Bush (${Bush.MODEL_NAME}): Mesh ${mesh.name} incompatible attributes... Skipping.`)
                                clonedGeo.dispose()
                                return
                            }
                            groupGeos.push(clonedGeo)
                        })
                    }
                })

                if (geometriesByMaterial.size === 0) {
                    throw new Error(`No valid geometries/materials found in bush model: ${Bush.MODEL_PATH}`)
                }

                const combinedBBox = new THREE.Box3()
                Bush.instancedMeshes.clear()
                Bush.modelGeometries.clear()
                Bush.modelMaterials.clear()

                for (const [matUUID, geometries] of geometriesByMaterial.entries()) {
                    if (geometries.length === 0) continue
                    try {
                        const material = materialsByUUID.get(matUUID)!
                        Bush.modelMaterials.set(matUUID, material) // Store material

                        const mergedGeometry = mergeGeometries(geometries, false)
                        if (!mergedGeometry) throw new Error(`Bush mergeGeometries returned null for material ${matUUID}`)

                        // Add InstancedBufferAttribute for Alpha
                        const instanceAlphas = new Float32Array(Bush.MAX_INSTANCES).fill(1.0)
                        mergedGeometry.setAttribute("instanceAlpha", new InstancedBufferAttribute(instanceAlphas, 1))

                        if (!mergedGeometry.boundingBox) mergedGeometry.computeBoundingBox()
                        if (mergedGeometry.boundingBox) {
                            combinedBBox.union(mergedGeometry.boundingBox)
                        }

                        const instancedMesh = new THREE.InstancedMesh(mergedGeometry, material, Bush.MAX_INSTANCES)
                        instancedMesh.castShadow = Bush.CAST_SHADOW
                        instancedMesh.receiveShadow = Bush.RECEIVE_SHADOW
                        instancedMesh.name = `${Bush.MODEL_NAME}InstancedMesh_${matUUID.substring(0, 4)}`
                        instancedMesh.frustumCulled = true

                        // Modify Material Shader for Instance Alpha
                        material.onBeforeCompile = shader => {
                            shader.vertexShader = bushVertexShaderHeader + shader.vertexShader
                            shader.vertexShader = shader.vertexShader.replace(
                                "#include <project_vertex>",
                                "#include <project_vertex>\n" + bushVertexShaderMain,
                            )
                            shader.fragmentShader = bushFragmentShaderHeader + shader.fragmentShader
                            shader.fragmentShader = shader.fragmentShader.replace(
                                "#include <output_fragment>",
                                "#include <output_fragment>\n" + bushFragmentShaderOutput,
                            )
                        }
                        material.defines = material.defines || {}
                        material.defines.USE_INSTANCING = ""
                        material.needsUpdate = true

                        const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
                        for (let i = 0; i < Bush.MAX_INSTANCES; i++) {
                            instancedMesh.setMatrixAt(i, zeroMatrix)
                        }
                        instancedMesh.instanceMatrix.needsUpdate = true

                        Bush.instancedMeshes.set(matUUID, instancedMesh)
                        Bush.modelGeometries.set(matUUID, mergedGeometry)
                    } catch (error) {
                        console.error(`Failed to create InstancedMesh for Bush material group ${matUUID}:`, error)
                        geometries.forEach(geo => geo.dispose())
                    }
                }
                geometriesByMaterial.forEach(geos => geos.forEach(geo => geo.dispose()))

                if (Bush.instancedMeshes.size === 0) {
                    throw new Error(`Failed to create any InstancedMesh for ${Bush.MODEL_NAME}.`)
                }
                Bush.boundingBox = combinedBBox.isEmpty() ? null : combinedBBox
                console.log(`Bush (${Bush.MODEL_NAME}) shared resources initialized with ${Bush.instancedMeshes.size} InstancedMesh(es).`)
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

    public static override disposeShared(): void {
        console.log(`Bush (${Bush.MODEL_NAME}): Disposing shared resources...`)
        Bush.instancedMeshes.forEach(mesh => {
            mesh.geometry?.dispose()
            if (mesh.material) {
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
                materials.forEach(mat => mat?.dispose())
            }
        })
        Bush.instancedMeshes.clear()

        Bush.modelGeometries.forEach(geometry => geometry.dispose())
        Bush.modelGeometries.clear()
        Bush.modelMaterials.forEach(material => material.dispose())
        Bush.modelMaterials.clear()

        this.boundingBox = null
        this.loadPromise = null
        console.log(`Bush (${Bush.MODEL_NAME}): Shared resources disposed.`)
    }

    public static override getInstancedMeshes(): THREE.InstancedMesh[] {
        return Array.from(this.instancedMeshes.values())
    }

    // --- Helper Objects for getWorldBoundingBox ---
    private static instanceWorldBox = new THREE.Box3()
    private static instanceMatrix = new THREE.Matrix4()
    private static instanceRotation = new THREE.Quaternion()

    /**
     * Calculates and returns the world-aligned bounding box for a specific Bush instance.
     */
    public getWorldBoundingBox(instanceTransform: ManagedEnvironmentObject): THREE.Box3 | null {
        if (!Bush.boundingBox) {
            return null
        }
        Bush.instanceRotation.setFromEuler(instanceTransform.rotation)
        Bush.instanceMatrix.compose(
            instanceTransform.position,
            Bush.instanceRotation,
            instanceTransform.scale, // Use base scale for collision
        )
        Bush.instanceWorldBox.copy(Bush.boundingBox).applyMatrix4(Bush.instanceMatrix)
        return Bush.instanceWorldBox
    }

    public override updateInstanceMatrix(baseTransform: ManagedEnvironmentObject, cameraPosition: THREE.Vector3): void {
        if (this.instanceId === -1 || this.instanceId >= Bush.MAX_INSTANCES || Bush.instancedMeshes.size === 0) return

        let targetLodScale = LOD_SCALE_FACTORS.HIGH
        if (baseTransform.distanceSq > LOD_DISTANCES_SQUARED.MEDIUM) {
            targetLodScale = LOD_SCALE_FACTORS.LOW
        } else if (baseTransform.distanceSq > LOD_DISTANCES_SQUARED.HIGH) {
            targetLodScale = LOD_SCALE_FACTORS.MEDIUM
        }

        // Interpolate LOD scale
        this.currentLodScale = THREE.MathUtils.damp(this.currentLodScale, targetLodScale, Bush.LOD_DAMPING_FACTOR * 100, 1 / 60)

        // Calculate final scale (assuming no specific Y-axis adjustment for Bush)
        Bush.finalScale.copy(baseTransform.scale).multiplyScalar(this.currentLodScale)

        // Clamp scale
        if (Bush.finalScale.x <= 0.01 || Bush.finalScale.y <= 0.01 || Bush.finalScale.z <= 0.01) {
            Bush.finalScale.set(0.01, 0.01, 0.01)
        }

        Bush.rotationQuaternion.setFromEuler(baseTransform.rotation)

        // Compose the final matrix
        Bush.matrix.compose(baseTransform.position, Bush.rotationQuaternion, Bush.finalScale)

        // Apply the matrix to all InstancedMesh objects
        try {
            Bush.instancedMeshes.forEach(mesh => {
                if (this.instanceId < mesh.instanceMatrix.count) {
                    mesh.setMatrixAt(this.instanceId, Bush.matrix)
                    mesh.instanceMatrix.needsUpdate = true
                }
            })
        } catch (error) {
            console.error(`Error updating Bush instance ${this.instanceId} matrices:`, error)
        }
    }
}

import * as THREE from "three"
import { ResourceManager } from "../core/ResourceManager"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { BufferAttribute, InstancedBufferAttribute } from "three"
import { BaseEnvironmentEntity } from "../core/BaseEnvironmentEntity"
import { ManagedEnvironmentObject } from "../core/EnvironmentManager"
import { LOD_DISTANCES_SQUARED, LOD_SCALE_FACTORS } from "../core/EnvironmentManager"

// Shader chunks for injection (ensure unique names)
const rockVertexShaderHeader = `
  attribute float instanceAlpha;
  varying float vInstanceAlpha;
`
const rockVertexShaderMain = `
  vInstanceAlpha = instanceAlpha;
`
const rockFragmentShaderHeader = `
  varying float vInstanceAlpha;
`
const rockFragmentShaderOutput = `
  gl_FragColor.a *= vInstanceAlpha;
`

export class Rock extends BaseEnvironmentEntity {
    // --- Static Configuration ---
    public static readonly MODEL_PATH = "models/rock/rock01.glb"
    public static readonly MODEL_NAME = "rock"
    public static readonly MAX_INSTANCES = 25
    public static readonly CAST_SHADOW = true
    public static readonly RECEIVE_SHADOW = true
    // ---------------------------

    public static instancedMeshes: Map<string, THREE.InstancedMesh> = new Map()
    private static modelGeometries: Map<string, THREE.BufferGeometry> = new Map()
    public static modelMaterials: Map<string, THREE.Material> = new Map()
    public static boundingBox: THREE.Box3 | null = null
    private static loadPromise: Promise<void> | null = null

    public readonly instanceId: number

    private static matrix = new THREE.Matrix4()
    private static finalScale = new THREE.Vector3()
    private static rotationQuaternion = new THREE.Quaternion()

    private currentLodScale: number = 1.0
    private static LOD_DAMPING_FACTOR = 0.1

    constructor(instanceId: number) {
        super()
        if (instanceId < 0 || instanceId >= Rock.MAX_INSTANCES) {
            console.error(`Invalid instanceId assigned to Rock: ${instanceId}. Max is ${Rock.MAX_INSTANCES - 1}`)
            this.instanceId = -1
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
        console.log(`Rock (${Rock.MODEL_NAME}): Initializing shared resources...`)
        if (Rock.instancedMeshes.size > 0) {
            console.log(`Rock (${Rock.MODEL_NAME}): Already initialized.`)
            return
        }
        if (this.loadPromise) {
            console.log(`Rock (${Rock.MODEL_NAME}): Initialization already in progress.`)
            return this.loadPromise
        }

        this.loadPromise = new Promise<void>(async (resolve, reject) => {
            try {
                // console.log(`Rock (${Rock.MODEL_NAME}): Loading model...`) // Removed log
                const model = await resourceManager.loadModel(Rock.MODEL_NAME, Rock.MODEL_PATH)
                model.updateMatrixWorld(true)
                // console.log(`Rock (${Rock.MODEL_NAME}): Model loaded.`) // Removed log

                const geometriesByMaterial = new Map<string, THREE.BufferGeometry[]>()
                const materialsByUUID = new Map<string, THREE.Material>()
                const leafMaterialNames: string[] = [] // Rock has no leaves, keep consistent

                console.log(`Rock (${Rock.MODEL_NAME}): Traversing model for geometries and ORIGINAL materials...`)
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
                                // console.log( // Removed log
                                //     `Rock Material Found [UUID: ${matUUID.substring(0, 4)}]: ` +
                                //         `Name: ${material.name || "N/A"}, ` +
                                //         `Type: ${material.type}, ` +
                                //         `Transparent: ${material.transparent}, ` +
                                //         `AlphaTest: ${material.alphaTest}, ` +
                                //         `DepthWrite: ${material.depthWrite}, ` +
                                //         `Side: ${material.side}`, // Removed NeedsUpdate
                                // )
                            }

                            const clonedGeo = mesh.geometry.clone()

                            // Log original matrix for debugging if needed (keep commented for now)
                            /*
                            const isLeafOrBranch = material && leafMaterialNames.includes(material.name);
                            if (isLeafOrBranch) {
                                console.log(`   - LEAF/BRANCH MESH DETECTED: ${mesh.name || 'Unnamed'} (...) Original World Matrix:`);
                                console.log(mesh.matrixWorld.elements.map(e => e.toFixed(3)).join(', '));
                            }
                            */

                            // Apply matrix ONLY for non-leaf/branch (all meshes for Rock)
                            // clonedGeo.applyMatrix4(mesh.matrixWorld) // REMOVED: Do not pre-apply world matrix
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
                            if (groupGeos.length > 0 && !Rock.haveSameAttributes(groupGeos[0], clonedGeo)) {
                                console.warn(`Rock (${Rock.MODEL_NAME}): Mesh ${mesh.name} has incompatible attributes... Skipping.`)
                                clonedGeo.dispose()
                                return
                            }
                            groupGeos.push(clonedGeo)
                        })
                    }
                })

                if (geometriesByMaterial.size === 0) {
                    throw new Error(`No valid geometries/materials found in rock model: ${Rock.MODEL_PATH}`)
                }

                const combinedBBox = new THREE.Box3()
                Rock.instancedMeshes.clear()
                Rock.modelGeometries.clear()
                Rock.modelMaterials.clear()

                // console.log(`Rock (${Rock.MODEL_NAME}): Creating InstancedMeshes for ${geometriesByMaterial.size} material groups...`) // Removed log
                for (const [matUUID, geometries] of geometriesByMaterial.entries()) {
                    if (geometries.length === 0) continue

                    try {
                        const material = materialsByUUID.get(matUUID)!
                        // console.log(`Rock (${Rock.MODEL_NAME}): Merging ${geometries.length} geometries for material ${matUUID.substring(0, 4)}...`) // Removed log

                        const mergedGeometry = mergeGeometries(geometries, false)
                        if (!mergedGeometry) {
                            throw new Error(`Rock mergeGeometries returned null for material ${matUUID}`)
                        }
                        // console.log( // Removed log
                        //     `Rock (${Rock.MODEL_NAME}): Merged geometry for material ${matUUID.substring(0, 4)}. Vertex count: ${mergedGeometry.attributes.position.count}`,
                        // )

                        if (!mergedGeometry.boundingBox) mergedGeometry.computeBoundingBox()
                        if (mergedGeometry.boundingBox) {
                            combinedBBox.union(mergedGeometry.boundingBox)
                        } else {
                            console.warn(`Could not compute bounding box for merged rock geometry of material ${matUUID}`)
                        }

                        const instancedMesh = new THREE.InstancedMesh(mergedGeometry, material, Rock.MAX_INSTANCES)
                        instancedMesh.castShadow = Rock.CAST_SHADOW
                        instancedMesh.receiveShadow = Rock.RECEIVE_SHADOW
                        instancedMesh.name = `${Rock.MODEL_NAME}InstancedMesh_${matUUID.substring(0, 4)}`
                        instancedMesh.frustumCulled = true
                        // console.log(`Rock InstancedMesh [${instancedMesh.name}]: Frustum Culling ENABLED.`) // Removed log

                        const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
                        for (let i = 0; i < Rock.MAX_INSTANCES; i++) {
                            instancedMesh.setMatrixAt(i, zeroMatrix)
                        }
                        instancedMesh.instanceMatrix.needsUpdate = true

                        Rock.instancedMeshes.set(matUUID, instancedMesh)
                        Rock.modelGeometries.set(matUUID, mergedGeometry)
                        Rock.modelMaterials.set(matUUID, material)

                        // Add InstancedBufferAttribute for Alpha
                        const instanceAlphas = new Float32Array(Rock.MAX_INSTANCES).fill(1.0)
                        mergedGeometry.setAttribute("instanceAlpha", new InstancedBufferAttribute(instanceAlphas, 1))

                        // Modify Material Shader for Instance Alpha
                        material.onBeforeCompile = shader => {
                            shader.vertexShader = rockVertexShaderHeader + shader.vertexShader
                            shader.vertexShader = shader.vertexShader.replace(
                                "#include <project_vertex>",
                                "#include <project_vertex>\n" + rockVertexShaderMain,
                            )
                            shader.fragmentShader = rockFragmentShaderHeader + shader.fragmentShader
                            shader.fragmentShader = shader.fragmentShader.replace(
                                "#include <output_fragment>",
                                "#include <output_fragment>\n" + rockFragmentShaderOutput,
                            )
                        }
                        material.defines = material.defines || {}
                        material.defines.USE_INSTANCING = ""
                        material.needsUpdate = true
                    } catch (error) {
                        console.error(`Failed to create InstancedMesh for Rock material group ${matUUID}:`, error)
                        geometries.forEach(geo => geo.dispose())
                    }
                }

                geometriesByMaterial.forEach(geos => geos.forEach(geo => geo.dispose()))

                if (Rock.instancedMeshes.size === 0) {
                    throw new Error(`Failed to create any InstancedMesh for ${Rock.MODEL_NAME}. Check logs for errors.`)
                }

                Rock.boundingBox = combinedBBox.isEmpty() ? null : combinedBBox
                // if (Rock.boundingBox) { // Removed log
                //     console.log(`Rock (${Rock.MODEL_NAME}): Combined bounding box computed:`, Rock.boundingBox.min, Rock.boundingBox.max)
                // } else {
                //     console.warn(`Rock (${Rock.MODEL_NAME}): Could not compute combined bounding box.`)
                // }

                console.log(`Rock (${Rock.MODEL_NAME}) shared resources initialized with ${Rock.instancedMeshes.size} InstancedMesh(es).`) // Keep summary log
                resolve()
            } catch (error) {
                console.error(`Failed to initialize shared rock resources (${Rock.MODEL_NAME}):`, error)
                Rock.disposeShared()
                this.loadPromise = null
                reject(error)
            }
        })
        return this.loadPromise
    }

    public static override getInstancedMeshes(): THREE.InstancedMesh[] {
        return Array.from(this.instancedMeshes.values())
    }

    public static getBoundingBox(): THREE.Box3 | null {
        return this.boundingBox
    }

    public static override disposeShared(): void {
        console.log(`Rock (${Rock.MODEL_NAME}): Disposing shared resources...`)
        Rock.instancedMeshes.forEach(mesh => {
            mesh.geometry?.dispose()
            if (mesh.material) {
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
                materials.forEach(mat => mat?.dispose())
            }
        })
        Rock.instancedMeshes.clear()

        Rock.modelGeometries.forEach(geometry => geometry.dispose())
        Rock.modelGeometries.clear()
        Rock.modelMaterials.forEach(material => material.dispose())
        Rock.modelMaterials.clear()

        this.boundingBox = null
        this.loadPromise = null
        console.log(`Rock (${Rock.MODEL_NAME}): Shared resources disposed.`)
    }

    // --- Helper Objects for getWorldBoundingBox ---
    private static instanceWorldBox = new THREE.Box3()
    private static instanceMatrix = new THREE.Matrix4()
    private static instanceRotation = new THREE.Quaternion()

    /**
     * Calculates and returns the world-aligned bounding box for a specific Rock instance.
     */
    public getWorldBoundingBox(instanceTransform: ManagedEnvironmentObject): THREE.Box3 | null {
        if (!Rock.boundingBox) {
            // console.warn("Rock.getWorldBoundingBox: Base boundingBox is null."); // Reduce spam
            return null
        }

        Rock.instanceRotation.setFromEuler(instanceTransform.rotation)
        Rock.instanceMatrix.compose(instanceTransform.position, Rock.instanceRotation, instanceTransform.scale)
        Rock.instanceWorldBox.copy(Rock.boundingBox).applyMatrix4(Rock.instanceMatrix)

        return Rock.instanceWorldBox
    }

    public override updateInstanceMatrix(baseTransform: ManagedEnvironmentObject, cameraPosition: THREE.Vector3): void {
        if (this.instanceId === -1 || Rock.instancedMeshes.size === 0) return

        let targetLodScale = LOD_SCALE_FACTORS.HIGH
        if (baseTransform.distanceSq > LOD_DISTANCES_SQUARED.MEDIUM) {
            targetLodScale = LOD_SCALE_FACTORS.LOW
        } else if (baseTransform.distanceSq > LOD_DISTANCES_SQUARED.HIGH) {
            targetLodScale = LOD_SCALE_FACTORS.MEDIUM
        }

        // Interpolate LOD scale
        this.currentLodScale = THREE.MathUtils.damp(this.currentLodScale, targetLodScale, Rock.LOD_DAMPING_FACTOR * 100, 1 / 60)

        // Calculate final scale (no specific Y-axis adjustment for Rock)
        Rock.finalScale.copy(baseTransform.scale).multiplyScalar(this.currentLodScale)

        // Clamp scale
        if (Rock.finalScale.x <= 0.01 || Rock.finalScale.y <= 0.01 || Rock.finalScale.z <= 0.01) {
            Rock.finalScale.set(0.01, 0.01, 0.01)
        }

        Rock.rotationQuaternion.setFromEuler(baseTransform.rotation)

        // Compose final matrix
        Rock.matrix.compose(baseTransform.position, Rock.rotationQuaternion, Rock.finalScale)

        // Apply matrix to all InstancedMeshes
        try {
            Rock.instancedMeshes.forEach(mesh => {
                if (this.instanceId < mesh.instanceMatrix.count) {
                    mesh.setMatrixAt(this.instanceId, Rock.matrix)
                    mesh.instanceMatrix.needsUpdate = true
                } else {
                    console.warn(`Rock instanceId ${this.instanceId} is out of bounds for mesh ${mesh.name} (count: ${mesh.instanceMatrix.count})`)
                }
            })
        } catch (error) {
            console.error(`Error updating Rock instance ${this.instanceId} matrices:`, error)
        }
    }
}

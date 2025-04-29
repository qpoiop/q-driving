import * as THREE from "three"
import { ITerrainService } from "./ITerrainService"
import { Tree } from "../entities/Tree"
import { Rock } from "../entities/Rock"
import { Bush } from "../entities/Bush"
import { Engine } from "./Engine"
import { ResourceManager } from "./ResourceManager"
import { BaseEnvironmentEntity } from "./BaseEnvironmentEntity"

// --- Configuration Constants ---
// LOD (Level of Detail) settings
export const LOD_DISTANCES = { HIGH: 150, MEDIUM: 300, LOW: 350 }
export const LOD_DISTANCES_SQUARED = {
    HIGH: LOD_DISTANCES.HIGH * LOD_DISTANCES.HIGH,
    MEDIUM: LOD_DISTANCES.MEDIUM * LOD_DISTANCES.MEDIUM,
    LOW: LOD_DISTANCES.LOW * LOD_DISTANCES.LOW,
}
export const LOD_SCALE_FACTORS = { HIGH: 1.0, MEDIUM: 0.8, LOW: 0.7 } // Base scale factors

// Update frequency (process only a fraction of instances per frame)
const UPDATE_FREQUENCY: number = 3

// Generation settings (Tuned for density and performance)
const GENERATION_CHUNK_SIZE: number = 100 // Smaller chunks for smoother generation
const GENERATION_ATTEMPTS_MULTIPLIER: number = 1.8 // Slightly more attempts
const CLEARING_RADIUS: number = 15 // Smaller clearing radius
const OUTER_GENERATION_RADIUS: number = 90 // Reduced outer radius significantly
const MIN_DISTANCE_BETWEEN_OBJECTS = 1.5 // Slightly increased min distance
const MIN_DISTANCE_SQ = MIN_DISTANCE_BETWEEN_OBJECTS * MIN_DISTANCE_BETWEEN_OBJECTS

// Dynamic Loading Settings
const REGENERATION_THRESHOLD = 50 // Regenerate sooner
const REGENERATION_THRESHOLD_SQ = REGENERATION_THRESHOLD * REGENERATION_THRESHOLD

// Transparency & Fading Settings
const TRANSPARENCY_OPACITY = 0.2 // More transparent
const TRANSPARENCY_FADE_DISTANCE = 15
const ALPHA_DAMPING_FACTOR = 0.05 // Damping factor for fade in/out (adjust speed)
const ALPHA_THRESHOLD = 0.01 // Threshold to consider alpha update complete
const TRANSPARENCY_SPHERE_RADIUS = 5.0 // Radius around camera to check for transparency

// Define a structural type for environment entities
interface EnvironmentEntityType {
    new (instanceId: number): BaseEnvironmentEntity
    initializeShared(resourceManager: ResourceManager): Promise<void>
    disposeShared(): void
    getInstancedMeshes(): THREE.InstancedMesh[]
    getBoundingBox(): THREE.Box3 | null
    modelMaterials?: Map<string, THREE.Material> // Optional: Ensure subclasses populate this
    MAX_INSTANCES: number
    MODEL_NAME: string
}

// Generation Configuration
const ENTITY_GENERATION_CONFIG = {
    TREE: {
        class: Tree as unknown as EnvironmentEntityType,
        probability: 0.4, // Increased tree probability
        scaleMin: 1.2,
        scaleRange: 0.6,
    },
    ROCK: {
        class: Rock as unknown as EnvironmentEntityType,
        probability: 0.2,
        scaleMin: 0.4, // Reduced minimum size
        scaleRange: 0.3, // Reduced size variation range
    },
    BUSH: {
        class: Bush as unknown as EnvironmentEntityType,
        probability: 0.3, // Enabled bushes
        scaleMin: 0.6,
        scaleRange: 0.4,
    },
}

// Managed Object Interface
export interface ManagedEnvironmentObject {
    entity: BaseEnvironmentEntity
    entityClass: EnvironmentEntityType
    position: THREE.Vector3
    scale: THREE.Vector3
    rotation: THREE.Euler
    distanceSq: number
    isVisible: boolean // Based on LOD distance
    // worldMatrix: THREE.Matrix4 // Calculate on demand
    currentAlpha: number // Current alpha value for fading
    targetAlpha: number // Target alpha value for fading
}

// Interface for storing alpha interpolation state per instance
interface AlphaState {
    targetAlpha: number
    currentAlpha: number
    needsUpdate: boolean
}

export class EnvironmentManager {
    private static instance: EnvironmentManager | null = null
    private terrainService: ITerrainService
    private resourceManager: ResourceManager
    private scene: THREE.Scene
    private camera: THREE.Camera | null = null

    // Store managed objects
    private managedObjects: Map<EnvironmentEntityType, ManagedEnvironmentObject[]> = new Map()

    // Helper objects
    private upVector = new THREE.Vector3(0, 1, 0)
    private tempPosition = new THREE.Vector3()
    private tempRotationQuaternion = new THREE.Quaternion()

    // State variables
    private frameCounter: number = 0
    private isInitialized: boolean = false
    private lastGenerationCenter: THREE.Vector3 = new THREE.Vector3()
    private isRegenerating: boolean = false

    // Transparency & Fading state
    private raycaster: THREE.Raycaster = new THREE.Raycaster()
    // Map<meshUUID, Map<instanceId, AlphaState>>
    private alphaStates: Map<string, Map<number, AlphaState>> = new Map()
    private objectsToRaycast: THREE.Object3D[] = [] // Cache objects for raycasting
    private tempVecCam = new THREE.Vector3()
    private tempVecCar = new THREE.Vector3()
    private tempVecDir = new THREE.Vector3()
    private tempVecObj = new THREE.Vector3() // Added for object position check

    private constructor(terrainService: ITerrainService, resourceManager: ResourceManager, scene: THREE.Scene) {
        this.terrainService = terrainService
        this.resourceManager = resourceManager
        this.scene = scene

        Object.values(ENTITY_GENERATION_CONFIG).forEach(config => {
            if (config.probability > 0) {
                this.managedObjects.set(config.class, [])
            }
        })

        this.raycaster.layers.enableAll()
    }

    public static getInstance(terrainService: ITerrainService, resourceManager: ResourceManager, scene: THREE.Scene): EnvironmentManager {
        if (!EnvironmentManager.instance) {
            EnvironmentManager.instance = new EnvironmentManager(terrainService, resourceManager, scene)
        } else {
            EnvironmentManager.instance.terrainService = terrainService
            EnvironmentManager.instance.resourceManager = resourceManager
            EnvironmentManager.instance.scene = scene
        }
        return EnvironmentManager.instance
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) return
        console.log("Initializing EnvironmentManager...")

        this.camera = Engine.getInstance()?.getCamera() ?? null
        this.lastGenerationCenter.copy(this.camera?.position ?? ZERO_VECTOR)

        try {
            const initPromises = Object.values(ENTITY_GENERATION_CONFIG)
                .filter(config => config.probability > 0)
                .map(config => config.class.initializeShared(this.resourceManager))
            await Promise.all(initPromises)

            this.objectsToRaycast = [] // Initialize raycast target list
            console.log("--- Adding InstancedMeshes to Scene ---")
            Object.values(ENTITY_GENERATION_CONFIG)
                .filter(config => config.probability > 0)
                .forEach(config => {
                    const EntityClass = config.class
                    const meshes = EntityClass.getInstancedMeshes()
                    if (meshes && meshes.length > 0) {
                        meshes.forEach(mesh => {
                            if (mesh && !mesh.parent) {
                                this.scene.add(mesh)
                                this.objectsToRaycast.push(mesh) // Add to raycast list
                                console.log(`   Added ${mesh.name} to scene & raycast targets.`)
                            } else if (mesh) {
                                // Ensure already added meshes are in the list too
                                if (!this.objectsToRaycast.includes(mesh)) {
                                    this.objectsToRaycast.push(mesh)
                                }
                                console.log(`   Mesh ${mesh.name} already in scene.`)
                            }
                        })
                    } else {
                        console.warn(`InstancedMeshes for ${EntityClass.MODEL_NAME} not found.`)
                    }
                })
            console.log("--- Finished adding InstancedMeshes ---")

            await this.generateEnvironmentObjects(this.lastGenerationCenter)
            console.log(`Total managed objects after initial generation: ${Array.from(this.managedObjects.values()).flat().length}`)
            this.forceInitialUpdate() // Update alpha state as well

            this.isInitialized = true
            console.log("EnvironmentManager initialized successfully.")
        } catch (error) {
            console.error("EnvironmentManager initialization failed:", error)
            this.isInitialized = false
            this.disposePartial()
        }
    }

    // --- UPDATE --- (Called by WorldManager)
    public update(deltaTime: number, camera: THREE.Camera | null, carPosition: THREE.Vector3 | null): void {
        if (!this.isInitialized || !camera || this.isRegenerating) return

        const cameraPosition = camera.position

        // --- Dynamic Loading Check ---
        const distanceSqFromLastCenter = cameraPosition.distanceToSquared(this.lastGenerationCenter)
        if (distanceSqFromLastCenter > REGENERATION_THRESHOLD_SQ) {
            this.regenerateEnvironment(cameraPosition).catch(error => {
                console.error("Error during environment regeneration:", error)
                this.isRegenerating = false
            })
            return
        }

        // --- Update Object States ---
        this.managedObjects.forEach(objects => {
            this.updateDistances(objects, cameraPosition)
            this.updateInstancesVisibility(objects)
        })

        // --- Handle Transparency (Occlusion Fading) ---
        this.handleTransparency(cameraPosition, carPosition)

        // --- Update Instance Alphas (Fade In/Out) ---
        this.updateInstanceAlphas(deltaTime)

        // --- Update Instance Matrices (Staggered) ---
        const updateStartIndex = this.frameCounter % UPDATE_FREQUENCY
        this.managedObjects.forEach(objects => {
            this.updateInstancesMatrixSubset(objects, updateStartIndex)
        })

        this.frameCounter++
    }

    // --- DYNAMIC LOADING / REGENERATION ---
    private async regenerateEnvironment(newCenter: THREE.Vector3): Promise<void> {
        if (this.isRegenerating) return
        this.isRegenerating = true
        console.log(`--- Regenerating Environment around (${newCenter.x.toFixed(2)}, ${newCenter.z.toFixed(2)}) ---`)

        // 1. Mark existing objects for fade out
        this.managedObjects.forEach(objects => {
            objects.forEach(obj => {
                obj.targetAlpha = 0.0 // Mark for fade out
                // Update alpha state map
                this.updateAlphaState(obj, 0.0)
            })
        })
        console.log("Marked existing objects for fade out.")

        // 2. Generate new objects around the new center
        // Note: generateEnvironmentObjects now sets initial alpha to 0 and target to 1
        await this.generateEnvironmentObjects(newCenter.clone())

        // 3. Update the generation center reference
        this.lastGenerationCenter.copy(newCenter)
        console.log("Finished generating new environment objects (marked for fade in).")
        console.log(`Total managed objects after regen trigger: ${Array.from(this.managedObjects.values()).flat().length}`) // Includes fading out ones

        // 4. Initial update for new objects (distances, visibility)
        // No matrix update needed here, update loop handles it
        this.managedObjects.forEach(objects => {
            const cameraPos = this.camera?.position ?? ZERO_VECTOR
            this.updateDistances(objects, cameraPos)
            this.updateInstancesVisibility(objects)
        })

        // 5. Update InstancedMesh counts immediately (important!)
        this.updateAllInstancedMeshCounts()

        this.isRegenerating = false // Allow update loop to start fading
        console.log("--- Environment Regeneration Triggered (Fading starts) ---")
    }

    // --- TRANSPARENCY & FADING ---
    private handleTransparency(cameraPosition: THREE.Vector3, currentCarPosition: THREE.Vector3 | null): void {
        // Reduce frequency for performance
        if (this.frameCounter % 5 !== 0) {
            // Check slightly more often than before
            return
        }

        const currentlyOccludedInstanceIds = new Set<string>() // Store as "meshUUID_instanceId"

        if (currentCarPosition) {
            this.tempVecCam.copy(cameraPosition)
            this.tempVecCar.copy(currentCarPosition)
            const camToCarSq = this.tempVecCam.distanceToSquared(this.tempVecCar)
            this.tempVecDir.subVectors(this.tempVecCar, this.tempVecCam) // Direction from camera to car

            // Iterate through all managed objects
            this.managedObjects.forEach((objects, entityClass) => {
                const meshes = entityClass.getInstancedMeshes()
                if (!meshes || meshes.length === 0) return
                const meshUUID = meshes[0].uuid // Assume all meshes for a class share UUID for alpha state key

                objects.forEach(obj => {
                    if (!obj.isVisible) return // Skip objects outside LOD

                    this.tempVecObj.copy(obj.position)
                    const camToObjSq = this.tempVecCam.distanceToSquared(this.tempVecObj)

                    let shouldBeTransparent = false

                    // Revised condition: Check if the object is closer than the car AND within the fade distance limit
                    if (camToObjSq < camToCarSq && camToObjSq < TRANSPARENCY_FADE_DISTANCE * TRANSPARENCY_FADE_DISTANCE) {
                        // Further check if the object is generally in the direction from camera to car
                        const camToObjDir = this.tempVecObj.clone().sub(this.tempVecCam) // Use clone to avoid modifying tempVecObj
                        // tempVecDir is already calculated as car - camera
                        if (camToObjDir.dot(this.tempVecDir) > 0) {
                            // Check if object is in front (positive dot product)
                            shouldBeTransparent = true
                        }
                    }

                    const instanceId = obj.entity.instanceId
                    const key = `${meshUUID}_${instanceId}`

                    if (shouldBeTransparent) {
                        currentlyOccludedInstanceIds.add(key)
                        this.updateAlphaState(obj, TRANSPARENCY_OPACITY)
                    } else {
                        // Only fade back to opaque if it was previously transparent
                        const alphaState = this.alphaStates.get(meshUUID)?.get(instanceId)
                        if (alphaState && alphaState.targetAlpha !== 1.0) {
                            this.updateAlphaState(obj, 1.0)
                        }
                    }
                })
            })

            // Optional: Fade out objects that were transparent last frame but aren't anymore
            // (The logic inside the loop already handles setting targetAlpha to 1.0)
            // You might still need to clean up alphaStates for objects that are removed entirely,
            // but the current updateAlphaState/updateInstanceAlphas should handle the fade-out.
        } else {
            // No car position, ensure everything fades back to opaque
            this.alphaStates.forEach((instanceMap, meshUUID) => {
                instanceMap.forEach((state, instanceId) => {
                    if (state.targetAlpha !== 1.0) {
                        const obj = this.findManagedObjectByInstanceId(meshUUID, instanceId)
                        if (obj) {
                            this.updateAlphaState(obj, 1.0)
                        }
                    }
                })
            })
        }
    }

    // Helper to find the ManagedEnvironmentObject based on mesh UUID and instance ID
    // This implementation assumes mesh UUID is consistent for an entity class.
    private findManagedObjectByInstanceId(meshUUID: string, instanceId: number): ManagedEnvironmentObject | undefined {
        for (const [entityClass, objects] of this.managedObjects.entries()) {
            const meshes = entityClass.getInstancedMeshes()
            if (meshes && meshes.length > 0 && meshes[0].uuid === meshUUID) {
                // Found the correct entity class, now find the instance
                return objects.find(obj => obj.entity.instanceId === instanceId)
            }
        }
        return undefined
    }

    /**
     * Updates the target alpha state for a managed object.
     * This function ensures the alpha state map is correctly maintained.
     * @param obj The managed object to update.
     * @param newTargetAlpha The desired target alpha (e.g., 0.2 for transparent, 1.0 for opaque).
     */
    private updateAlphaState(obj: ManagedEnvironmentObject, newTargetAlpha: number): void {
        const meshes = obj.entityClass.getInstancedMeshes()
        if (!meshes || meshes.length === 0) return
        const meshUUID = meshes[0].uuid // Use the first mesh's UUID as the key
        const instanceId = obj.entity.instanceId

        if (!this.alphaStates.has(meshUUID)) {
            this.alphaStates.set(meshUUID, new Map<number, AlphaState>())
        }
        const instanceMap = this.alphaStates.get(meshUUID)!

        let state = instanceMap.get(instanceId)

        if (!state) {
            // Initialize state if it doesn't exist
            state = { currentAlpha: obj.currentAlpha, targetAlpha: newTargetAlpha, needsUpdate: true }
            instanceMap.set(instanceId, state)
        } else {
            // Update target alpha only if it changed
            if (state.targetAlpha !== newTargetAlpha) {
                state.targetAlpha = newTargetAlpha
                state.needsUpdate = true
            }
        }
        // Also update the object's immediate targetAlpha for reference
        obj.targetAlpha = newTargetAlpha
    }

    private updateInstanceAlphas(deltaTime: number): void {
        const timeFactor = Math.min(deltaTime, 1 / 30) // Prevent large jumps
        let bufferNeedsUpdate = false

        this.alphaStates.forEach((instanceMap, meshUUID) => {
            // Find the actual mesh corresponding to this UUID
            let mesh: THREE.InstancedMesh | undefined
            for (const m of this.objectsToRaycast) {
                if (m.uuid === meshUUID) {
                    mesh = m as THREE.InstancedMesh
                    break
                }
            }
            if (!mesh) return // Mesh not found (maybe disposed?)

            const alphaAttribute = mesh.geometry.getAttribute("instanceAlpha") as THREE.InstancedBufferAttribute | undefined
            if (!alphaAttribute) return // Alpha attribute missing

            const instancesToRemoveFromMap: number[] = []
            let meshBufferNeedsUpdate = false

            instanceMap.forEach((state, instanceId) => {
                if (state.needsUpdate && instanceId < alphaAttribute.count) {
                    const oldAlpha = state.currentAlpha
                    // Damp towards target alpha
                    state.currentAlpha = THREE.MathUtils.damp(state.currentAlpha, state.targetAlpha, ALPHA_DAMPING_FACTOR * 100, timeFactor)

                    // Check if update is complete
                    if (Math.abs(state.currentAlpha - state.targetAlpha) < ALPHA_THRESHOLD) {
                        state.currentAlpha = state.targetAlpha // Snap to target
                        state.needsUpdate = false
                        // If faded out completely, mark for removal from tracking map
                        if (state.currentAlpha === 0.0) {
                            instancesToRemoveFromMap.push(instanceId)
                            // Also remove the corresponding ManagedObject if it exists and target is 0
                            this.removeManagedObjectIfFadedOut(meshUUID, instanceId)
                        }
                    }

                    // Update buffer only if value changed significantly
                    if (Math.abs(oldAlpha - state.currentAlpha) > 0.001) {
                        alphaAttribute.setX(instanceId, state.currentAlpha)
                        meshBufferNeedsUpdate = true
                    }
                } else if (!state.needsUpdate && state.currentAlpha === 0.0) {
                    // Ensure faded-out instances are eventually removed from map
                    instancesToRemoveFromMap.push(instanceId)
                }
            })

            // Remove completed fades from the tracking map
            instancesToRemoveFromMap.forEach(id => instanceMap.delete(id))

            if (meshBufferNeedsUpdate) {
                alphaAttribute.needsUpdate = true
                bufferNeedsUpdate = true // Mark that at least one buffer needs update
            }
        })

        // After iterating all maps, check if any maps are now empty
        const mapsToRemove: string[] = []
        this.alphaStates.forEach((instanceMap, meshUUID) => {
            if (instanceMap.size === 0) {
                mapsToRemove.push(meshUUID)
            }
        })
        mapsToRemove.forEach(uuid => this.alphaStates.delete(uuid))
    }

    // Helper to remove the ManagedObject when fully faded out
    private removeManagedObjectIfFadedOut(meshUUID: string, instanceId: number): void {
        const obj = this.findManagedObjectByInstanceId(meshUUID, instanceId)
        if (obj && obj.targetAlpha === 0.0 && obj.currentAlpha < ALPHA_THRESHOLD) {
            const objectArray = this.managedObjects.get(obj.entityClass)
            if (objectArray) {
                const index = objectArray.findIndex(item => item.entity.instanceId === instanceId)
                if (index !== -1) {
                    objectArray.splice(index, 1)
                    // console.log(`Removed faded object ${obj.entityClass.MODEL_NAME}[${instanceId}]`);
                    // Instance counts will be updated in the next regeneration or periodically
                }
            }
        }
    }

    // --- OBJECT GENERATION ---
    private async generateEnvironmentObjects(center: THREE.Vector3): Promise<void> {
        const road = this.terrainService.getRoad ? this.terrainService.getRoad() : null
        let roadCheckWidth = 5
        if (road && typeof road.isPointOnRoad === "function" && typeof (road as any).config?.width === "number") {
            roadCheckWidth = (road as any).config.width / 2 + 2.5
        }
        const roadCheckEnabled = road && typeof road.isPointOnRoad === "function"

        const clearingRadiusSq = CLEARING_RADIUS * CLEARING_RADIUS
        const outerGenerationRadiusSq = OUTER_GENERATION_RADIUS * OUTER_GENERATION_RADIUS

        let totalGeneratedCount = 0
        let roadSkipCount = 0
        const allPositionsInBatch: THREE.Vector3[] = []

        let totalMaxInstances = 0
        Object.values(ENTITY_GENERATION_CONFIG)
            .filter(config => config.probability > 0)
            .forEach(config => {
                totalMaxInstances += config.class.MAX_INSTANCES
            })

        const totalAttempts = Math.ceil(totalMaxInstances * GENERATION_ATTEMPTS_MULTIPLIER)

        let cumulativeProb = 0
        const entityTypes = Object.values(ENTITY_GENERATION_CONFIG).filter(config => config.probability > 0)
        const weightedTypes = entityTypes.map(config => {
            cumulativeProb += config.probability
            return { ...config, cumulativeProb }
        })
        const totalProbability = cumulativeProb > 0 ? cumulativeProb : 1
        const generationCenter = center

        for (let i = 0; i < totalAttempts; i++) {
            if (i > 0 && i % GENERATION_CHUNK_SIZE === 0) {
                await new Promise(resolve => setTimeout(resolve, 0))
            }

            const angle = Math.random() * Math.PI * 2
            const radiusSq = clearingRadiusSq + Math.random() * (outerGenerationRadiusSq - clearingRadiusSq)
            if (radiusSq < clearingRadiusSq) continue // Ensure not inside clearing radius
            const radius = Math.sqrt(radiusSq)
            const offsetX = radius * Math.cos(angle)
            const offsetZ = radius * Math.sin(angle)
            const x = generationCenter.x + offsetX
            const z = generationCenter.z + offsetZ
            this.tempPosition.set(x, 0, z)

            let tooClose = false
            for (const pos of allPositionsInBatch) {
                if (this.tempPosition.distanceToSquared(pos) < MIN_DISTANCE_SQ) {
                    tooClose = true
                    break
                }
            }
            if (tooClose) continue

            if (roadCheckEnabled && road!.isPointOnRoad(x, z, roadCheckWidth)) {
                roadSkipCount++
                continue
            }

            try {
                const y = this.terrainService.getHeightAt(x, 0, z)
                if (isNaN(y) || !isFinite(y)) continue
                const normal = this.terrainService.getNormalAt(x, y, z)
                if (
                    !normal ||
                    isNaN(normal.x) ||
                    !isFinite(normal.x) ||
                    isNaN(normal.y) ||
                    !isFinite(normal.y) ||
                    isNaN(normal.z) ||
                    !isFinite(normal.z)
                )
                    continue
                const position = new THREE.Vector3(x, y, z)

                this.tempRotationQuaternion.setFromUnitVectors(this.upVector, normal.normalize())
                const terrainAlignedRotation = new THREE.Euler().setFromQuaternion(this.tempRotationQuaternion, "YXZ")

                const rand = Math.random() * totalProbability
                let selectedConfig = null
                for (const config of weightedTypes) {
                    if (rand < config.cumulativeProb) {
                        selectedConfig = config
                        break
                    }
                }
                if (!selectedConfig) continue

                const EntityClass = selectedConfig.class as EnvironmentEntityType
                let targetArray = this.managedObjects.get(EntityClass)
                if (!targetArray) {
                    targetArray = []
                    this.managedObjects.set(EntityClass, targetArray)
                }

                if (targetArray.length >= EntityClass.MAX_INSTANCES) continue

                // Pass initial alpha state for fade-in
                this.createAndAddEnvironmentObject(EntityClass, selectedConfig, targetArray, position, terrainAlignedRotation, 0.0, 1.0)
                allPositionsInBatch.push(position.clone())
                totalGeneratedCount++
            } catch (error) {
                console.warn(`Error during object generation attempt near (${x.toFixed(2)}, ${z.toFixed(2)}):`, error)
            }
        }

        // No need to update counts here, regeneration handles it before this call
    }

    private createAndAddEnvironmentObject(
        EntityClass: EnvironmentEntityType,
        config: { scaleMin: number; scaleRange: number },
        targetArray: ManagedEnvironmentObject[],
        position: THREE.Vector3,
        baseRotation: THREE.Euler,
        initialAlpha: number, // Added for fade-in
        targetAlpha: number, // Added for fade-in
    ): void {
        const instanceId = targetArray.length
        if (instanceId >= EntityClass.MAX_INSTANCES) return

        const entity = new EntityClass(instanceId)

        const scaleVal = config.scaleMin + Math.random() * config.scaleRange
        let scale: THREE.Vector3
        // Apply specific Y-scaling only for Tree
        if (EntityClass.MODEL_NAME === Tree.MODEL_NAME) {
            scale = new THREE.Vector3(scaleVal, scaleVal * 0.7, scaleVal)
        } else {
            scale = new THREE.Vector3(scaleVal, scaleVal, scaleVal)
        }

        let finalRotation = baseRotation.clone()
        finalRotation.y = Math.random() * Math.PI * 2

        const newObject: ManagedEnvironmentObject = {
            entity,
            entityClass: EntityClass,
            position,
            scale,
            rotation: finalRotation,
            distanceSq: Infinity,
            isVisible: false,
            currentAlpha: initialAlpha,
            targetAlpha: targetAlpha,
        }
        targetArray.push(newObject)

        // Initialize alpha state tracking for the new object
        this.updateAlphaState(newObject, targetAlpha)
    }

    // --- INSTANCE UPDATES & HELPERS ---
    private updateAllInstancedMeshCounts(): void {
        this.managedObjects.forEach((arr, cls) => {
            const meshes = cls.getInstancedMeshes()
            if (meshes) {
                meshes.forEach(mesh => {
                    if (mesh) {
                        // Check if mesh exists
                        const currentCount = mesh.count
                        const newCount = arr.length
                        if (currentCount !== newCount) {
                            mesh.count = newCount
                            mesh.instanceMatrix.needsUpdate = true
                            // Also reset alpha for new instances if count increases?
                            // This should be handled by fade-in logic already.
                        }
                    }
                })
            }
        })
    }

    private forceInitialUpdate(): void {
        if (!this.camera) {
            console.warn("Cannot force initial update: Camera missing.")
            return
        }
        const cameraPosition = this.camera.position
        console.log("Performing forced initial update of environment objects...")

        // Reset alpha states completely before initial update
        this.alphaStates.clear()

        this.managedObjects.forEach(objects => {
            if (objects.length > 0) {
                this.updateDistances(objects, cameraPosition)
                this.updateInstancesVisibility(objects)
                // Initialize alpha state for all objects to be fully opaque
                objects.forEach(obj => {
                    obj.currentAlpha = 1.0
                    obj.targetAlpha = 1.0
                    this.updateAlphaState(obj, 1.0)
                })
                this.updateInstanceAlphas(0) // Apply initial alpha immediately
                this.updateAllInstancesMatrix(objects) // Update all matrices initially
            }
        })
        console.log("Forced initial update complete.")
    }

    private updateDistances(objects: ManagedEnvironmentObject[], cameraPosition: THREE.Vector3): void {
        objects.forEach(obj => {
            obj.distanceSq = obj.position.distanceToSquared(cameraPosition)
        })
    }

    private updateInstancesVisibility(objects: ManagedEnvironmentObject[]): void {
        objects.forEach(obj => {
            obj.isVisible = obj.distanceSq <= LOD_DISTANCES_SQUARED.LOW
            // If object becomes invisible due to distance, mark for fade out?
            // Fade out handled by regeneration for now.
            // if (!obj.isVisible && obj.targetAlpha !== 0.0) {
            //     this.updateAlphaState(obj, 0.0);
            // }
        })
    }

    private updateInstancesMatrixSubset(objects: ManagedEnvironmentObject[], updateIndex: number): void {
        if (!this.camera) return
        const cameraPosition = this.camera.position

        objects.forEach((obj, index) => {
            // Skip if LOD invisible OR not this frame's turn OR fully faded out
            if (!obj.isVisible || index % UPDATE_FREQUENCY !== updateIndex || obj.currentAlpha < ALPHA_THRESHOLD) {
                return
            }
            try {
                obj.entity.updateInstanceMatrix(obj, cameraPosition)
            } catch (error) {
                console.error(`Error calling updateInstanceMatrix for ${obj.entityClass.MODEL_NAME} [${obj.entity.instanceId}]:`, error)
            }
        })
    }

    private updateAllInstancesMatrix(objects: ManagedEnvironmentObject[]): void {
        if (!this.camera) return
        const cameraPosition = this.camera.position
        objects.forEach(obj => {
            // Update matrix only if object is not fully faded out
            if (obj.currentAlpha >= ALPHA_THRESHOLD) {
                try {
                    obj.entity.updateInstanceMatrix(obj, cameraPosition)
                } catch (error) {
                    console.error(
                        `Error calling updateInstanceMatrix during update for ${obj.entityClass.MODEL_NAME} [${obj.entity.instanceId}]:`,
                        error,
                    )
                }
            }
        })
    }

    // --- UTILITIES ---
    public getNearbyObjects(position: THREE.Vector3, radius: number): ManagedEnvironmentObject[] {
        const nearby: ManagedEnvironmentObject[] = []
        const radiusSq = (radius + 5) * (radius + 5)
        this.managedObjects.forEach(objects => {
            objects.forEach(obj => {
                // Check distance, LOD visibility, AND if not fully faded out
                if (obj.isVisible && obj.currentAlpha > ALPHA_THRESHOLD && obj.position.distanceToSquared(position) <= radiusSq) {
                    nearby.push(obj)
                }
            })
        })
        return nearby
    }

    // --- DISPOSAL ---
    private disposePartial(): void {
        console.warn("Disposing partially initialized EnvironmentManager resources...")
        this.alphaStates.clear() // Clear alpha state

        Object.values(ENTITY_GENERATION_CONFIG).forEach(config => {
            try {
                const meshes = config.class.getInstancedMeshes()
                if (meshes && meshes.length > 0) {
                    // Attempt to restore material state before disposing
                    const materials = config.class.modelMaterials
                    if (materials) {
                        // No easy way to restore here, rely on full disposeShared
                    }
                    config.class.disposeShared()
                }
            } catch (e) {
                // Ignore
            }
        })
        this.managedObjects.clear()
        this.isInitialized = false
    }

    public dispose(): void {
        if (!this.isInitialized && EnvironmentManager.instance !== this) {
            return
        }
        console.log("Disposing EnvironmentManager...")
        this.isInitialized = false // Mark as disposed early
        this.isRegenerating = false // Stop any regeneration

        this.alphaStates.clear() // Clear alpha state
        this.objectsToRaycast = []

        // Dispose managed objects arrays
        this.managedObjects.forEach(arr => (arr.length = 0))
        this.managedObjects.clear()

        // Dispose shared resources (includes materials, geometries, meshes)
        Object.values(ENTITY_GENERATION_CONFIG).forEach(config => {
            try {
                // Check if the class itself has a disposeShared method
                if (typeof config.class.disposeShared === "function") {
                    config.class.disposeShared()
                }
            } catch (e) {
                console.error(`Error disposing shared resources for ${config.class.MODEL_NAME}:`, e)
            }
        })

        EnvironmentManager.instance = null
        this.camera = null
        console.log("EnvironmentManager disposed.")
    }
} // End of EnvironmentManager class

// Add ZERO_VECTOR constant if not globally defined
const ZERO_VECTOR = new THREE.Vector3(0, 0, 0)

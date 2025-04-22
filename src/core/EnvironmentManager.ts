import * as THREE from "three"
import { ITerrainService } from "./ITerrainService"
import { Tree, IInstancedEnvironmentEntityClass } from "../entities/Tree"
import { Rock } from "../entities/Rock"
import { Bush } from "../entities/Bush"
import { Engine } from "./Engine"
import { ResourceManager } from "./ResourceManager"

// --- Configuration Constants ---
// LOD (Level of Detail) settings
const LOD_DISTANCES = { HIGH: 150, MEDIUM: 300, LOW: 800 }
const LOD_DISTANCES_SQUARED = {
    HIGH: LOD_DISTANCES.HIGH * LOD_DISTANCES.HIGH,
    MEDIUM: LOD_DISTANCES.MEDIUM * LOD_DISTANCES.MEDIUM,
    LOW: LOD_DISTANCES.LOW * LOD_DISTANCES.LOW,
}
const LOD_SCALE_FACTORS = { HIGH: 0.9, MEDIUM: 0.8, LOW: 0.7 } // Added LOW scale for consistency

// Update frequency (process only a fraction of instances per frame)
const UPDATE_FREQUENCY: number = 3 // E.g., update 1/3rd of instances each frame

// Generation settings
const GENERATION_CHUNK_SIZE: number = 100 // Process placements in chunks to avoid blocking
const GENERATION_ATTEMPTS_MULTIPLIER: number = 1.5 // Try more placements than max instances
const CLEARING_RADIUS: number = 50 // Area around origin to keep clear (e.g., for roads/start area)
const OUTER_GENERATION_RADIUS: number = 700 // Maximum distance from origin for generation
const MIN_DISTANCE_BETWEEN_OBJECTS = 1.0 // Minimum distance to avoid clipping (adjust as needed)
const MIN_DISTANCE_SQ = MIN_DISTANCE_BETWEEN_OBJECTS * MIN_DISTANCE_BETWEEN_OBJECTS

// Entity generation probabilities and scale settings
// It's better to move this to a dedicated config file/system
const ENTITY_GENERATION_CONFIG = {
    TREE: {
        class: Tree,
        probability: 0.3,
        scaleMin: 1.5,
        scaleRange: 1.0,
    },
    ROCK: {
        class: Rock,
        probability: 0.3,
        scaleMin: 0.8,
        scaleRange: 0.4,
    },
    BUSH: {
        class: Bush,
        probability: 0.4,
        scaleMin: 0.5,
        scaleRange: 0.3,
    },
}
// --- End Configuration ---

// Internal representation of a managed environment object instance
interface ManagedEnvironmentObject {
    entity: InstanceType<IInstancedEnvironmentEntityClass> // Instance of Tree, Rock, or Bush
    entityClass: IInstancedEnvironmentEntityClass // Reference to the class itself (Tree, Rock, Bush)
    position: THREE.Vector3 // World position
    scale: THREE.Vector3 // Base scale
    rotation: THREE.Euler // Base rotation (aligned to terrain + random Y)
    distanceSq: number // Squared distance to camera
    isVisible: boolean // Calculated visibility based on LOD
}

export class EnvironmentManager {
    private static instance: EnvironmentManager | null = null
    private terrainService: ITerrainService
    private resourceManager: ResourceManager
    private scene: THREE.Scene
    private camera: THREE.Camera | null = null // Cache camera reference

    // Store managed objects per type
    private managedObjects: Map<IInstancedEnvironmentEntityClass, ManagedEnvironmentObject[]> = new Map()

    // Helper objects reused in loops to reduce allocations
    private matrix = new THREE.Matrix4()
    private finalScale = new THREE.Vector3()
    private rotationQuaternion = new THREE.Quaternion()
    private upVector = new THREE.Vector3(0, 1, 0)
    private zeroScaleMatrix = new THREE.Matrix4().makeScale(0, 0, 0)

    private frameCounter: number = 0
    private isInitialized: boolean = false

    private constructor(terrainService: ITerrainService, resourceManager: ResourceManager, scene: THREE.Scene) {
        this.terrainService = terrainService
        this.resourceManager = resourceManager
        this.scene = scene

        // Initialize map for each entity type
        Object.values(ENTITY_GENERATION_CONFIG).forEach(config => {
            this.managedObjects.set(config.class as IInstancedEnvironmentEntityClass, [])
        })
    }

    public static getInstance(terrainService: ITerrainService, resourceManager: ResourceManager, scene: THREE.Scene): EnvironmentManager {
        if (!EnvironmentManager.instance) {
            if (!terrainService || !resourceManager || !scene) {
                console.error("EnvironmentManager: Invalid dependencies provided.")
                throw new Error("Invalid dependencies provided to EnvironmentManager.")
            }
            EnvironmentManager.instance = new EnvironmentManager(terrainService, resourceManager, scene)
        }
        return EnvironmentManager.instance
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.warn("EnvironmentManager already initialized.")
            return
        }
        console.log("Initializing EnvironmentManager...")

        // Cache camera from Engine
        this.camera = Engine.getInstance()?.getCamera() ?? null
        if (!this.camera) {
            console.warn("EnvironmentManager: Camera not available during initialization.")
            // Proceeding, but updates might not work until camera is set/available
        }

        try {
            // Initialize shared resources for all entity types concurrently
            const initPromises = Object.values(ENTITY_GENERATION_CONFIG).map(config =>
                (config.class as IInstancedEnvironmentEntityClass).initializeShared(this.resourceManager),
            )
            await Promise.all(initPromises)

            // Add instanced meshes to the scene
            Object.values(ENTITY_GENERATION_CONFIG).forEach(config => {
                const EntityClass = config.class as IInstancedEnvironmentEntityClass
                const mesh = EntityClass.getInstancedMesh()
                if (mesh) {
                    this.scene.add(mesh)
                    // console.log(`Added ${mesh.name} to scene.`) // Optional log
                } else {
                    console.warn(`InstancedMesh for ${EntityClass.MODEL_NAME} not found after initialization.`)
                }
            })

            // Generate object placements
            await this.generateEnvironmentObjects()

            // Perform an initial update based on camera position (if available)
            this.forceInitialUpdate()

            this.isInitialized = true
            console.log("EnvironmentManager initialized successfully.")
        } catch (error) {
            console.error("EnvironmentManager initialization failed:", error)
            // Consider more robust error handling or state management here
            this.isInitialized = false // Ensure it's marked as not initialized
        }
    }

    private async generateEnvironmentObjects(): Promise<void> {
        const road = this.terrainService.getRoad ? this.terrainService.getRoad() : null
        let roadCheckWidth = 5 // Default width to check around road center
        if (road && typeof road.isPointOnRoad === "function" && typeof (road as any).config?.width === "number") {
            roadCheckWidth = (road as any).config.width / 2 + 1.5 // Add a small buffer
        } else if (road) {
            console.warn("Road object found, but failed validation for width. Using default road check width.")
        }

        const clearingRadiusSq = CLEARING_RADIUS * CLEARING_RADIUS
        const outerGenerationRadiusSq = OUTER_GENERATION_RADIUS * OUTER_GENERATION_RADIUS

        let totalGeneratedCount = 0
        const tempPosition = new THREE.Vector3()
        const allPositions: THREE.Vector3[] = [] // Keep track of placed positions to avoid overlaps

        // Calculate total max instances and attempts
        let totalMaxInstances = 0
        Object.values(ENTITY_GENERATION_CONFIG).forEach(config => {
            totalMaxInstances += (config.class as IInstancedEnvironmentEntityClass).MAX_INSTANCES
        })
        const totalAttempts = totalMaxInstances * GENERATION_ATTEMPTS_MULTIPLIER

        console.log(
            `Starting environment generation: ~${totalAttempts.toFixed(0)} attempts between radius ` +
                `${CLEARING_RADIUS} and ${OUTER_GENERATION_RADIUS}. Max instances: ${totalMaxInstances}`,
        )

        // Pre-calculate cumulative probabilities for weighted random selection
        let cumulativeProb = 0
        const entityTypes = Object.values(ENTITY_GENERATION_CONFIG)
        const weightedTypes = entityTypes.map(config => {
            cumulativeProb += config.probability
            return { ...config, cumulativeProb }
        })
        const totalProbability = cumulativeProb // Can be used to normalize if needed

        for (let i = 0; i < totalAttempts; i++) {
            // Yield control occasionally to prevent blocking the main thread
            if (i > 0 && i % GENERATION_CHUNK_SIZE === 0) {
                await new Promise(resolve => setTimeout(resolve, 0))
            }

            // Generate a random position within the allowed annulus
            const angle = Math.random() * Math.PI * 2
            const radiusSq = clearingRadiusSq + Math.random() * (outerGenerationRadiusSq - clearingRadiusSq)
            const radius = Math.sqrt(radiusSq)
            const x = radius * Math.cos(angle)
            const z = radius * Math.sin(angle)
            tempPosition.set(x, 0, z)

            // Basic check for minimum distance from existing objects
            let tooClose = false
            for (const pos of allPositions) {
                if (tempPosition.distanceToSquared(pos) < MIN_DISTANCE_SQ) {
                    tooClose = true
                    break
                }
            }
            if (tooClose) continue

            // Check if position is on the road
            if (road && typeof road.isPointOnRoad === "function" && road.isPointOnRoad(x, z, roadCheckWidth)) {
                continue
            }

            try {
                // Get terrain height and normal at the position
                const y = this.terrainService.getHeightAt(x, 0, z)
                if (isNaN(y)) {
                    // console.warn(`Invalid terrain height at (${x.toFixed(2)}, ${z.toFixed(2)}), skipping.`);
                    continue // Skip if height is invalid
                }
                const normal = this.terrainService.getNormalAt(x, y, z)
                if (!normal || isNaN(normal.x) || isNaN(normal.y) || isNaN(normal.z)) {
                    // console.warn(`Invalid terrain normal at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}), skipping.`);
                    continue // Skip if normal is invalid
                }

                const position = new THREE.Vector3(x, y, z)

                // Determine rotation: align to terrain normal, random Y rotation
                this.rotationQuaternion.setFromUnitVectors(this.upVector, normal.normalize())
                const rotation = new THREE.Euler().setFromQuaternion(this.rotationQuaternion, "YXZ") // Use YXZ order potentially
                rotation.y = Math.random() * Math.PI * 2 // Random rotation around the object's up axis

                // Weighted random selection of entity type
                const rand = Math.random() * totalProbability // Use totalProbability if it's not 1
                let selectedConfig = null
                for (const config of weightedTypes) {
                    if (rand < config.cumulativeProb) {
                        selectedConfig = config
                        break
                    }
                }

                if (!selectedConfig) continue // Should not happen if probabilities sum >= 1

                const EntityClass = selectedConfig.class as IInstancedEnvironmentEntityClass
                const targetArray = this.managedObjects.get(EntityClass)
                if (!targetArray || targetArray.length >= EntityClass.MAX_INSTANCES) {
                    continue // Skip if max instances reached for this type
                }

                // Create and add the object
                this.createAndAddEnvironmentObject(EntityClass, selectedConfig, targetArray, position, rotation)
                allPositions.push(position.clone()) // Add placed position
                totalGeneratedCount++
            } catch (error) {
                // console.error(`Failed to process terrain or create object near (${x.toFixed(2)}, ${z.toFixed(2)}):`, error);
                continue // Safely continue to next attempt
            }
        }

        // Update InstancedMesh counts after generation
        this.updateAllInstancedMeshCounts()

        console.log(`Generated ${totalGeneratedCount} environment objects across all types.`) // Log total actual generated
        this.managedObjects.forEach((arr, cls) => {
            console.log(` - ${cls.MODEL_NAME}: ${arr.length}`)
        })
    }

    private createAndAddEnvironmentObject(
        EntityClass: IInstancedEnvironmentEntityClass,
        config: { scaleMin: number; scaleRange: number },
        targetArray: ManagedEnvironmentObject[],
        position: THREE.Vector3,
        rotation: THREE.Euler,
    ): void {
        const instanceId = targetArray.length // Next available ID for this type
        const entity = new EntityClass(instanceId)

        const scaleVal = config.scaleMin + Math.random() * config.scaleRange
        const scale = new THREE.Vector3(scaleVal, scaleVal, scaleVal)

        targetArray.push({
            entity,
            entityClass: EntityClass,
            position,
            scale,
            rotation,
            distanceSq: Infinity,
            isVisible: false, // Initially not visible, updated in forceInitialUpdate/update
        })
    }

    // Update the count property of all InstancedMeshes based on current array lengths
    private updateAllInstancedMeshCounts(): void {
        this.managedObjects.forEach((arr, cls) => {
            const mesh = cls.getInstancedMesh()
            if (mesh && mesh.count !== arr.length) {
                // console.log(`Setting ${mesh.name}.count to ${arr.length}`); // Optional log
                mesh.count = arr.length
                mesh.instanceMatrix.needsUpdate = true // Important: flag matrix update after count change
            }
        })
    }

    // Perform an initial update of all objects (visibility and matrix)
    private forceInitialUpdate(): void {
        if (!this.isInitialized || !this.camera) {
            // console.warn("Cannot force initial update: Not initialized or camera missing.");
            return
        }
        const cameraPosition = this.camera.position
        console.log("Performing forced initial update of environment objects...")

        this.managedObjects.forEach(objects => {
            this.updateDistances(objects, cameraPosition)
            this.updateInstancesVisibility(objects)
            this.updateAllInstancesMatrix(objects) // Update all matrices initially
        })
        console.log("Forced initial update complete.")
    }

    public update(): void {
        if (!this.isInitialized || !this.camera) return

        const cameraPosition = this.camera.position

        // Update distances and visibility for all objects first
        this.managedObjects.forEach(objects => {
            this.updateDistances(objects, cameraPosition)
            this.updateInstancesVisibility(objects)
        })

        // Update matrices, but only for a subset based on frame counter
        const updateStartIndex = this.frameCounter % UPDATE_FREQUENCY
        this.managedObjects.forEach(objects => {
            this.updateInstancesMatrixSubset(objects, updateStartIndex)
        })

        this.frameCounter++
    }

    private updateDistances(objects: ManagedEnvironmentObject[], cameraPosition: THREE.Vector3): void {
        objects.forEach(obj => {
            obj.distanceSq = obj.position.distanceToSquared(cameraPosition)
        })
    }

    private updateInstancesVisibility(objects: ManagedEnvironmentObject[]): void {
        objects.forEach(obj => {
            // Simplified visibility: visible if within LOW distance LOD
            obj.isVisible = obj.distanceSq <= LOD_DISTANCES_SQUARED.LOW
            // Could add frustum culling checks here if needed (more complex)
        })
    }

    // Updates matrices only for instances where (index % UPDATE_FREQUENCY === updateIndex)
    private updateInstancesMatrixSubset(objects: ManagedEnvironmentObject[], updateIndex: number): void {
        objects.forEach((obj, index) => {
            if (index % UPDATE_FREQUENCY !== updateIndex) return // Skip if not this frame's turn

            this.calculateAndUpdateInstanceMatrix(obj)
        })
    }

    // Updates matrices for ALL instances in the array
    private updateAllInstancesMatrix(objects: ManagedEnvironmentObject[]): void {
        objects.forEach(obj => {
            this.calculateAndUpdateInstanceMatrix(obj)
        })
    }

    // Common logic to calculate and apply the matrix for a single instance
    private calculateAndUpdateInstanceMatrix(obj: ManagedEnvironmentObject): void {
        let targetMatrix: THREE.Matrix4

        if (!obj.isVisible) {
            targetMatrix = this.zeroScaleMatrix // Use precomputed zero scale matrix
        } else {
            // Determine LOD scale factor
            let lodScaleFactor = 1.0
            if (obj.distanceSq > LOD_DISTANCES_SQUARED.MEDIUM) {
                lodScaleFactor = LOD_SCALE_FACTORS.LOW
            } else if (obj.distanceSq > LOD_DISTANCES_SQUARED.HIGH) {
                lodScaleFactor = LOD_SCALE_FACTORS.MEDIUM
            } else {
                // Optional: Could use LOD_SCALE_FACTORS.HIGH here if needed,
                // currently full scale for HIGH LOD range.
            }

            // Calculate final scale
            this.finalScale.copy(obj.scale).multiplyScalar(lodScaleFactor)
            // Get rotation quaternion from Euler
            this.rotationQuaternion.setFromEuler(obj.rotation)

            // Compose the final matrix
            // Check for invalid inputs before composing
            if (
                isNaN(obj.position.x) ||
                isNaN(this.rotationQuaternion.x) ||
                isNaN(this.finalScale.x) ||
                this.finalScale.x < 0 ||
                this.finalScale.y < 0 ||
                this.finalScale.z < 0
            ) {
                console.error(`Invalid matrix component before compose for ${obj.entityClass.MODEL_NAME} instance:`, {
                    pos: obj.position,
                    quat: this.rotationQuaternion,
                    scale: this.finalScale,
                })
                targetMatrix = this.zeroScaleMatrix // Use zero scale on error
            } else {
                this.matrix.compose(obj.position, this.rotationQuaternion, this.finalScale)
                targetMatrix = this.matrix
            }
        }

        // Update the specific instance in the InstancedMesh
        obj.entity.updateInstance(targetMatrix)
    }

    public dispose(): void {
        if (!this.isInitialized) return
        console.log("Disposing EnvironmentManager...")

        // Dispose shared resources for each entity type
        this.managedObjects.forEach((_, entityClass) => {
            try {
                entityClass.disposeShared()
            } catch (e) {
                console.error(`Error disposing shared resources for ${entityClass.MODEL_NAME}:`, e)
            }
        })

        // Clear managed objects
        this.managedObjects.clear()

        // Remove instanced meshes from the scene (they might already be removed by disposeShared)
        Object.values(ENTITY_GENERATION_CONFIG).forEach(config => {
            const EntityClass = config.class as IInstancedEnvironmentEntityClass
            const mesh = this.scene.getObjectByName(`${EntityClass.MODEL_NAME}InstancedMesh`)
            if (mesh) {
                this.scene.remove(mesh)
                // console.log(`Removed ${mesh.name} from scene during dispose.`) // Optional log
            }
        })

        EnvironmentManager.instance = null
        this.isInitialized = false
        this.camera = null
        console.log("EnvironmentManager disposed.")
    }
}

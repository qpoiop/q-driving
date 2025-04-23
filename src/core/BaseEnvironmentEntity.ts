import * as THREE from "three"
import { ResourceManager } from "./ResourceManager"
import { ManagedEnvironmentObject } from "./EnvironmentManager" // Assuming ManagedEnvironmentObject is exported or defined globally

/**
 * Base abstract class for environment entities managed by EnvironmentManager.
 * Defines the common interface and responsibilities.
 */
export abstract class BaseEnvironmentEntity {
    public abstract readonly instanceId: number // Each instance needs an ID

    /**
     * Initializes shared resources for this entity type (geometry, materials, InstancedMesh).
     * Should be called once per entity type.
     * @param resourceManager - Resource manager for loading models.
     */
    public static async initializeShared(resourceManager: ResourceManager): Promise<void> {
        // Static method needs to be implemented in each subclass
        throw new Error("Static method 'initializeShared' must be implemented by subclass.")
    }

    /**
     * Disposes of shared resources used by this entity type.
     */
    public static disposeShared(): void {
        // Static method needs to be implemented in each subclass
        throw new Error("Static method 'disposeShared' must be implemented by subclass.")
    }

    /**
     * Returns the InstancedMesh objects associated with this entity type.
     * Could be multiple meshes if using different materials.
     */
    public static getInstancedMeshes(): THREE.InstancedMesh[] {
        // Static method needs to be implemented in each subclass
        throw new Error("Static method 'getInstancedMeshes' must be implemented by subclass.")
    }

    /**
     * Calculates and applies the final transformation matrix for this specific instance.
     * This method is called by EnvironmentManager for visible instances.
     * Implementation should handle LOD scaling, specific rotations/adjustments, etc.
     * and call setMatrixAt on the appropriate InstancedMesh(es).
     *
     * @param baseTransform - The base position, rotation, and scale determined by EnvironmentManager.
     * @param cameraPosition - The current camera position for LOD calculations.
     */
    public abstract updateInstanceMatrix(baseTransform: ManagedEnvironmentObject, cameraPosition: THREE.Vector3): void

    /**
     * Calculates and returns the world-aligned bounding box for a specific instance.
     * @param instanceTransform - The transformation data of the specific instance.
     * @returns The world bounding box for the instance, or null if base bounding box is not available.
     */
    public abstract getWorldBoundingBox(instanceTransform: ManagedEnvironmentObject): THREE.Box3 | null

    // Optional: Common methods like setInstanceId could be added here if needed
    // public abstract setInstanceId(id: number): void;
}

// NOTE: We might need to adjust the import path for ManagedEnvironmentObject
// if it's not directly exported from EnvironmentManager or defined elsewhere.
// Consider creating a separate types file (e.g., types.ts) for shared interfaces/types.

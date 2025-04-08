import * as THREE from "three"
import { ResourceManager } from "./ResourceManager"

export interface ITerrainService {
    getHeightAt(x: number, y: number, z: number): number
    getNormalAt(x: number, y: number, z: number): THREE.Vector3
    getResourceManager(): ResourceManager
}

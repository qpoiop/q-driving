import * as THREE from "three"
import { ResourceManager } from "./ResourceManager"
import { Road } from "../entities/Road"

export interface ITerrainService {
    getHeightAt(x: number, y: number, z: number): number
    getNormalAt(x: number, y: number, z: number): THREE.Vector3
    getResourceManager(): ResourceManager
    isPointOnRoad(x: number, z: number, checkWidth?: number): boolean
    getRoad(): Road | null
}

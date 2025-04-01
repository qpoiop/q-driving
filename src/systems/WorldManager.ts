import * as THREE from "three"
import { Terrain } from "../entities/Terrain"
import { SceneryManager } from "./SceneryManager"
import { WorldObjectManager } from "./WorldObjectManager"

const TILE_SIZE = 500
const LOAD_RADIUS = 2

export class WorldManager {
    private tiles = new Map<string, Terrain>()
    private lastCenter = new THREE.Vector2(Infinity, Infinity)
    private worldObjects = new WorldObjectManager()
    private scenery: SceneryManager

    private terrainOptions = {
        size: TILE_SIZE,
        resolution: 128,
        heightScale: 3,
        flattenWidth: 10,
        textureRepeat: 200,
    }

    constructor(private scene: THREE.Scene) {
        this.scenery = new SceneryManager(scene, this.getHeightAt.bind(this), this.worldObjects)
    }

    public async init(center: THREE.Vector3) {
        await this.scenery.init()
        this.update(center)
    }

    public update(pos: THREE.Vector3) {
        const center = new THREE.Vector2(Math.floor(pos.x / TILE_SIZE), Math.floor(pos.z / TILE_SIZE))
        if (center.equals(this.lastCenter)) return
        this.lastCenter.copy(center)

        const needed = new Set<string>()
        for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
            for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
                const tx = center.x + dx
                const tz = center.y + dz
                const key = `${tx},${tz}`
                needed.add(key)

                if (!this.tiles.has(key)) {
                    const terrain = new Terrain({ ...this.terrainOptions, offsetX: tx * TILE_SIZE, offsetZ: tz * TILE_SIZE })
                    this.scene.add(terrain.mesh)
                    this.tiles.set(key, terrain)
                    this.scenery.populateTile(tx, tz)
                }
            }
        }

        for (const [key, terrain] of this.tiles.entries()) {
            if (!needed.has(key)) {
                this.scene.remove(terrain.mesh)
                terrain.dispose()
                this.tiles.delete(key)
            }
        }
    }

    public getHeightAt(pos: THREE.Vector3): number {
        const tx = Math.floor(pos.x / TILE_SIZE)
        const tz = Math.floor(pos.z / TILE_SIZE)
        return this.tiles.get(`${tx},${tz}`)?.getHeightAt(pos) ?? 0
    }

    public getNormalAt(pos: THREE.Vector3): THREE.Vector3 {
        return new THREE.Vector3(0, 1, 0)
    }

    public isColliding(pos: THREE.Vector3): boolean {
        return this.worldObjects.isColliding(pos)
    }
}

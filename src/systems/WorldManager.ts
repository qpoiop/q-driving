// ✅ WorldManager.ts
import * as THREE from "three"
import { Terrain } from "../entities/Terrain"

interface Tile {
    key: string
    position: THREE.Vector2
    terrain: Terrain
}

const TILE_SIZE = 500
const LOAD_RADIUS = 2

export class WorldManager {
    private tiles = new Map<string, Tile>()
    private lastCenter = new THREE.Vector2(Infinity, Infinity)
    private terrainOptions = {
        size: TILE_SIZE,
        resolution: 128,
        heightScale: 3,
        flattenWidth: 10,
        textureRepeat: 200,
    }

    constructor(private scene: THREE.Scene) {}

    public init(center: THREE.Vector3) {
        this.update(center)
    }

    public update(pos: THREE.Vector3) {
        const currentCenter = new THREE.Vector2(Math.floor(pos.x / TILE_SIZE), Math.floor(pos.z / TILE_SIZE))
        if (currentCenter.equals(this.lastCenter)) return

        this.lastCenter.copy(currentCenter)
        const newKeys = new Set<string>()

        for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
            for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
                const x = currentCenter.x + dx
                const z = currentCenter.y + dz
                const key = `${x}_${z}`
                newKeys.add(key)

                if (!this.tiles.has(key)) {
                    const terrain = new Terrain({ ...this.terrainOptions, offsetX: x * TILE_SIZE, offsetZ: z * TILE_SIZE })
                    terrain.mesh.position.set(x * TILE_SIZE, 0, z * TILE_SIZE)
                    this.scene.add(terrain.mesh)
                    this.tiles.set(key, { key, position: new THREE.Vector2(x, z), terrain })
                }
            }
        }

        for (const [key, tile] of this.tiles.entries()) {
            if (!newKeys.has(key)) {
                this.scene.remove(tile.terrain.mesh)
                tile.terrain.dispose()
                this.tiles.delete(key)
            }
        }
    }

    public getHeightAt(pos: THREE.Vector3): number {
        let nearest: Tile | null = null
        let minDistSq = Infinity
        for (const tile of this.tiles.values()) {
            const tileCenter = new THREE.Vector2(tile.position.x * TILE_SIZE, tile.position.y * TILE_SIZE)
            const distSq = tileCenter.distanceToSquared(new THREE.Vector2(pos.x, pos.z))
            if (distSq < minDistSq) {
                minDistSq = distSq
                nearest = tile
            }
        }
        return nearest?.terrain.getHeightAt(pos) ?? 0
    }

    public getNormalAt(pos: THREE.Vector3): THREE.Vector3 {
        let nearest: Tile | null = null
        let minDistSq = Infinity
        for (const tile of this.tiles.values()) {
            const tileCenter = new THREE.Vector2(tile.position.x * TILE_SIZE, tile.position.y * TILE_SIZE)
            const distSq = tileCenter.distanceToSquared(new THREE.Vector2(pos.x, pos.z))
            if (distSq < minDistSq) {
                minDistSq = distSq
                nearest = tile
            }
        }
        return nearest?.terrain.getNormalAt(pos) ?? new THREE.Vector3(0, 1, 0)
    }
}

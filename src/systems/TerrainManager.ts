import * as THREE from "three"
import { Terrain } from "../entities/Terrain"

export class TerrainManager {
    private tiles = new Map<string, Terrain>()
    private readonly tileSize = 500
    private readonly visibleRange = 2

    constructor(private scene: THREE.Scene) {}

    public update(position: THREE.Vector3) {
        const tileX = Math.floor(position.x / this.tileSize)
        const tileZ = Math.floor(position.z / this.tileSize)

        const needed = new Set<string>()

        for (let dz = -this.visibleRange; dz <= this.visibleRange; dz++) {
            for (let dx = -this.visibleRange; dx <= this.visibleRange; dx++) {
                const nx = tileX + dx
                const nz = tileZ + dz
                const key = `${nx},${nz}`
                needed.add(key)

                if (!this.tiles.has(key)) {
                    const terrain = new Terrain({
                        size: this.tileSize,
                        resolution: 128,
                        heightScale: 3,
                        flattenWidth: 10,
                        textureRepeat: 200,
                        offsetX: nx * this.tileSize,
                        offsetZ: nz * this.tileSize,
                    })
                    this.tiles.set(key, terrain)
                    this.scene.add(terrain.mesh)
                }
            }
        }

        for (const [key, terrain] of this.tiles.entries()) {
            if (!needed.has(key)) {
                this.scene.remove(terrain.mesh)
                this.tiles.delete(key)
            }
        }
    }
}

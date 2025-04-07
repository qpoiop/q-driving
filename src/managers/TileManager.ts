import * as THREE from "three"

export class TileManager {
    private populatedTiles = new Set<string>()
    private readonly TILE_SIZE = 100
    private readonly MIN_ROAD_DISTANCE = 25
    private readonly SLOPE_THRESHOLD = 0.4
    private readonly SAMPLE_RADIUS = 1.5

    constructor(private heightProvider: (pos: THREE.Vector3) => number, private getRoadDistance?: (pos: THREE.Vector3) => number) {}

    getTileKey(tileX: number, tileZ: number): string {
        return `${tileX},${tileZ}`
    }

    getTileCenter(tileX: number, tileZ: number): THREE.Vector3 {
        return new THREE.Vector3(tileX * this.TILE_SIZE, 0, tileZ * this.TILE_SIZE)
    }

    isTilePopulated(tileKey: string): boolean {
        return this.populatedTiles.has(tileKey)
    }

    markTileAsPopulated(tileKey: string) {
        this.populatedTiles.add(tileKey)
    }

    isValidPosition(position: THREE.Vector3): boolean {
        if (this.getRoadDistance) {
            const roadDist = this.getRoadDistance(position)
            if (roadDist < this.MIN_ROAD_DISTANCE) return false
        }

        const centerHeight = this.heightProvider(position)
        const samples = [
            new THREE.Vector3(position.x + this.SAMPLE_RADIUS, 0, position.z),
            new THREE.Vector3(position.x - this.SAMPLE_RADIUS, 0, position.z),
            new THREE.Vector3(position.x, 0, position.z + this.SAMPLE_RADIUS),
            new THREE.Vector3(position.x, 0, position.z - this.SAMPLE_RADIUS),
        ]

        for (const samplePos of samples) {
            const height = this.heightProvider(samplePos)
            const slope = Math.abs(height - centerHeight) / this.SAMPLE_RADIUS
            if (slope > this.SLOPE_THRESHOLD) return false
        }

        return true
    }

    clear() {
        this.populatedTiles.clear()
    }

    public getHeight(position: THREE.Vector3): number {
        return this.heightProvider(position)
    }
}

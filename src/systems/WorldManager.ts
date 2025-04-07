import * as THREE from "three"
import { Terrain } from "../entities/Terrain"
import { SceneryManager } from "./SceneryManager"
import { WorldObjectManager } from "./WorldObjectManager"

const TILE_SIZE = 500
const LOAD_RADIUS = 1
const UPDATE_THRESHOLD = TILE_SIZE * 0.3

export class WorldManager {
    private tiles = new Map<string, Terrain>()
    private lastCenter = new THREE.Vector2(Infinity, Infinity)
    private lastUpdatePosition = new THREE.Vector3(Infinity, Infinity, Infinity)
    private worldObjects = new WorldObjectManager()
    public scenery: SceneryManager
    private loadedTilesCount = 0

    private terrainOptions = {
        size: TILE_SIZE,
        resolution: 96,
        heightScale: 3,
        flattenWidth: 10,
        textureRepeat: 200,
    }

    constructor(private scene: THREE.Scene) {
        console.log("[WorldManager] 초기화")
        this.scenery = new SceneryManager(scene, this.getHeightAt.bind(this), this.worldObjects)
    }

    public async init(center: THREE.Vector3) {
        console.log("[WorldManager] 월드 초기화 시작")
        // 초기 타일 생성
        const tx = Math.floor(center.x / TILE_SIZE)
        const tz = Math.floor(center.z / TILE_SIZE)

        for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
            for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
                const key = `${tx + dx},${tz + dz}`
                if (!this.tiles.has(key)) {
                    const terrain = new Terrain({
                        ...this.terrainOptions,
                        offsetX: (tx + dx) * TILE_SIZE,
                        offsetZ: (tz + dz) * TILE_SIZE,
                    })
                    this.scene.add(terrain.mesh)
                    this.tiles.set(key, terrain)
                    this.loadedTilesCount++
                }
            }
        }
        console.log(`[WorldManager] 초기 타일 ${this.loadedTilesCount}개 생성 완료`)

        // SceneryManager 초기화
        await this.scenery.init()
        console.log("[WorldManager] SceneryManager 초기화 완료")

        // 초기 타일에 풍경 배치
        for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
            for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
                this.scenery.populateTile(tx + dx, tz + dz)
            }
        }
        console.log("[WorldManager] 초기 타일 풍경 배치 완료")

        this.update(center)
    }

    public update(pos: THREE.Vector3) {
        if (pos.distanceTo(this.lastUpdatePosition) < UPDATE_THRESHOLD) return

        const center = new THREE.Vector2(Math.floor(pos.x / TILE_SIZE), Math.floor(pos.z / TILE_SIZE))
        if (center.equals(this.lastCenter)) return

        this.lastUpdatePosition.copy(pos)
        const oldCenter = this.lastCenter.clone()
        this.lastCenter.copy(center)

        const needed = new Set<string>()
        let newTiles = 0
        let removedTiles = 0

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
                    newTiles++
                }
            }
        }

        for (const [key, terrain] of this.tiles.entries()) {
            if (!needed.has(key)) {
                this.scene.remove(terrain.mesh)
                terrain.dispose()
                this.tiles.delete(key)
                removedTiles++
            }
        }

        if (newTiles > 0 || removedTiles > 0) {
            console.log(`[WorldManager] 타일 업데이트 - 새로 생성: ${newTiles}, 제거: ${removedTiles}, 총: ${this.tiles.size}개`)
            console.log(`[WorldManager] 중심점 이동: (${oldCenter.x}, ${oldCenter.y}) -> (${center.x}, ${center.y})`)
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

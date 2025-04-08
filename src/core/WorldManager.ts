import * as THREE from "three"
import { Terrain } from "../entities/Terrain"
import { Road } from "../entities/Road"
import { ResourceManager } from "./ResourceManager"
import { ITerrainService } from "./ITerrainService"
import { EnvironmentManager } from "./EnvironmentManager"
import { Engine } from "./Engine"

export class WorldManager implements ITerrainService {
    private static instance: WorldManager | null = null
    private terrain: Terrain | null = null
    private road: Road | null = null
    private scene: THREE.Scene
    private resourceManager: ResourceManager
    private environmentManager: EnvironmentManager | null = null

    private constructor() {
        const engine = Engine.getInstance()
        this.resourceManager = ResourceManager.getInstance()
        this.scene = engine.getScene()
    }

    public static getInstance(): WorldManager {
        if (!WorldManager.instance) {
            WorldManager.instance = new WorldManager()
        }
        return WorldManager.instance
    }

    public async initialize(): Promise<void> {
        try {
            // 지형 초기화
            const terrainConfig = {
                width: 300, // 더 넓은 지형
                height: 300,
                heightScale: 1.0, // 더 낮은 높이로 조정
                segments: 128,
                textureRepeat: 8,
            }
            this.terrain = new Terrain(this, terrainConfig)
            await this.terrain.initialize()

            // 지형을 원점에 위치시키기
            this.terrain.setPosition(-terrainConfig.width / 2, 0, -terrainConfig.height / 2)

            // 도로 초기화 - 카메라 방향으로 직선
            const roadConfig = {
                width: 8, // 2차선 도로에 맞는 폭
                segments: 200,
                curveRadius: 150, // 더 긴 도로
                curveSegments: 32,
                textureRepeat: 20,
            }
            this.road = new Road(this, roadConfig)
            await this.road.initialize()

            // 환경 매니저 초기화 및 환경 요소 추가
            this.environmentManager = EnvironmentManager.getInstance(this, this.scene)
            await this.environmentManager.initialize()

            // 씬에 추가
            this.scene.add(this.terrain.getModel())
            const roadModel = this.road.getModel()
            roadModel.position.y = 0 // 도로를 지면에 정확히 맞춤
            this.scene.add(roadModel)

            // 조명 설정
            this.setupLighting()

            // 안개 효과 추가 - 멀리 있는 지형을 부드럽게 처리
            this.scene.fog = new THREE.Fog(0x87ceeb, 250, 1000) // 안개 시작 거리 증가
        } catch (error) {
            console.error("Failed to initialize world:", error)
            throw error
        }
    }

    private setupLighting(): void {
        // 주변광
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
        this.scene.add(ambientLight)

        // 태양광
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(50, 100, 30)
        directionalLight.castShadow = true

        // 그림자 품질 향상
        directionalLight.shadow.mapSize.width = 4096
        directionalLight.shadow.mapSize.height = 4096
        directionalLight.shadow.camera.near = 0.5
        directionalLight.shadow.camera.far = 1000
        directionalLight.shadow.camera.left = -500
        directionalLight.shadow.camera.right = 500
        directionalLight.shadow.camera.top = 500
        directionalLight.shadow.camera.bottom = -500
        directionalLight.shadow.bias = -0.0001

        this.scene.add(directionalLight)

        // 보조 조명 추가
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
        fillLight.position.set(-50, 50, -30)
        this.scene.add(fillLight)

        // 그림자 설정
        this.scene.traverse(object => {
            if (object instanceof THREE.Mesh) {
                object.castShadow = true
                object.receiveShadow = true
            }
        })
    }

    public getHeightAt(x: number, y: number, z: number): number {
        return this.terrain?.getHeightAt(x, y, z) || 0
    }

    public getNormalAt(x: number, y: number, z: number): THREE.Vector3 {
        return this.terrain?.getNormalAt(x, y, z) || new THREE.Vector3(0, 1, 0)
    }

    public getResourceManager(): ResourceManager {
        return this.resourceManager
    }

    public getTerrain(): Terrain | null {
        return this.terrain
    }

    public getRoad(): Road | null {
        return this.road
    }

    public getScene(): THREE.Scene {
        return this.scene
    }

    public update(deltaTime: number): void {
        this.terrain?.update(deltaTime)
        this.road?.update(deltaTime)
        if (this.environmentManager) {
            const engine = Engine.getInstance()
            this.environmentManager.update(engine.getCamera().position)
        }
    }

    public dispose(): void {
        this.terrain?.dispose()
        this.road?.dispose()
        this.environmentManager?.dispose()
        this.scene.clear()
        WorldManager.instance = null
    }
}

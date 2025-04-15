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
    private renderer: THREE.WebGLRenderer
    private resourceManager: ResourceManager
    private environmentManager: EnvironmentManager | null = null
    private isDay: boolean = true
    private ambientLight: THREE.AmbientLight | null = null
    private directionalLight: THREE.DirectionalLight | null = null
    private fillLight: THREE.DirectionalLight | null = null

    private constructor() {
        const engine = Engine.getInstance()
        this.resourceManager = ResourceManager.getInstance()
        this.scene = engine.getScene()
        this.renderer = engine.getRenderer()
    }

    public static getInstance(): WorldManager {
        if (!WorldManager.instance) {
            WorldManager.instance = new WorldManager()
        }
        return WorldManager.instance
    }

    public async initialize(): Promise<void> {
        try {
            // 환경 설정 (배경, 그림자 등)
            this.setupEnvironment()

            // 지형 초기화
            const terrainConfig = {
                width: 300,
                height: 300,
                heightScale: 1.0,
                segments: 64,
                textureRepeat: 8,
            }
            this.terrain = new Terrain(this, terrainConfig)
            await this.terrain.initialize()
            this.terrain.getModel().traverse(object => {
                if (object instanceof THREE.Mesh) {
                    object.receiveShadow = true
                }
            })
            this.terrain.setPosition(-terrainConfig.width / 2, 0, -terrainConfig.height / 2)

            // 도로 초기화
            const roadConfig = {
                width: 8, // 2차선 도로에 맞는 폭
                segments: 200,
                curveRadius: 150, // 더 긴 도로
                curveSegments: 32,
                textureRepeat: 20,
            }
            this.road = new Road(this, roadConfig)
            await this.road.initialize()
            const roadModel = this.road.getModel()
            roadModel.traverse(object => {
                if (object instanceof THREE.Mesh) {
                    object.receiveShadow = true
                }
            })
            roadModel.position.y = 0
            this.scene.add(roadModel)

            // 환경 매니저 초기화
            this.environmentManager = EnvironmentManager.getInstance(this, this.scene)
            await this.environmentManager.initialize()

            // 씬에 추가
            this.scene.add(this.terrain.getModel())

            // 조명 설정
            this.setupLighting()

            // 안개 효과 추가
            this.scene.fog = new THREE.Fog(0x87ceeb, 250, 1000)
        } catch (error) {
            console.error("Failed to initialize world:", error)
            throw error
        }
    }

    private setupEnvironment(): void {
        // 하늘색 배경 설정
        this.scene.background = new THREE.Color(0x87ceeb)

        // 렌더러 그림자 설정
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }

    private setupLighting(): void {
        // 주변광
        this.ambientLight = new THREE.AmbientLight(0xffffff, this.isDay ? 0.6 : 0.2)

        // 태양광
        this.directionalLight = new THREE.DirectionalLight(0xffffff, this.isDay ? 0.8 : 0.3)
        this.directionalLight.position.set(50, 100, 30)
        this.directionalLight.castShadow = true

        // 그림자 품질 향상 -> 해상도 감소
        this.directionalLight.shadow.mapSize.width = 2048
        this.directionalLight.shadow.mapSize.height = 2048
        this.directionalLight.shadow.camera.near = 0.5
        this.directionalLight.shadow.camera.far = 1000
        this.directionalLight.shadow.camera.left = -500
        this.directionalLight.shadow.camera.right = 500
        this.directionalLight.shadow.camera.top = 500
        this.directionalLight.shadow.camera.bottom = -500
        this.directionalLight.shadow.bias = -0.0001

        // 조명 강도 증가
        this.ambientLight.intensity = 1.0
        this.directionalLight.intensity = 1.0

        this.scene.add(this.ambientLight)
        this.scene.add(this.directionalLight)

        // 보조 조명 추가 (Fill light probably doesn't need shadow)
        this.fillLight = new THREE.DirectionalLight(0xffffff, this.isDay ? 0.4 : 0.1)
        this.fillLight.position.set(-50, 50, -30)
        this.scene.add(this.fillLight)
    }

    public toggleDayNight(): void {
        this.isDay = !this.isDay
        if (this.ambientLight) {
            this.ambientLight.intensity = this.isDay ? 0.6 : 0.2
        }
        if (this.directionalLight) {
            this.directionalLight.intensity = this.isDay ? 0.8 : 0.3
        }
        if (this.fillLight) {
            this.fillLight.intensity = this.isDay ? 0.4 : 0.1
        }

        // 안개 색상 변경 (밤에는 더 어둡게)
        if (this.scene.fog instanceof THREE.Fog) {
            this.scene.fog.color.setHex(this.isDay ? 0x87ceeb : 0x000033)
        }
        this.scene.background = new THREE.Color(this.isDay ? 0x87ceeb : 0x000011)

        // TODO: Sky 객체 업데이트 필요
        // const sky = this.scene.getObjectByName('sky');
        // if (sky instanceof Sky) { sky.setNightMode(this.isNightMode); }
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

    public update(): void {
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

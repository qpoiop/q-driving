import * as THREE from "three"
import { Terrain } from "../entities/Terrain"
import { Road } from "../entities/Road"
import { ResourceManager } from "./ResourceManager"
import { ITerrainService } from "./ITerrainService"
import { EnvironmentManager } from "./EnvironmentManager"
import { Engine } from "./Engine"
import { Car } from "../entities/Car"
import { CarConfig } from "../config/CarConfig"
import { InputSystem } from "../systems/InputSystem"

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
    private car: Car | null = null

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
            this.setupEnvironment()

            const terrainConfig = { width: 300, height: 300, heightScale: 1.0, segments: 64, textureRepeat: 8 }
            this.terrain = new Terrain(this, terrainConfig)
            await this.terrain.initialize()
            this.terrain.getModel().traverse(object => {
                if (object instanceof THREE.Mesh) object.receiveShadow = true
            })
            this.terrain.setPosition(-terrainConfig.width / 2, 0, -terrainConfig.height / 2)
            this.scene.add(this.terrain.getModel())

            const roadConfig = { width: 8, segments: 100, curveRadius: 150, curveSegments: 16, textureRepeat: 20 }
            this.road = new Road(this, roadConfig)
            await this.road.initialize()
            const roadModel = this.road.getModel()
            roadModel.traverse(object => {
                if (object instanceof THREE.Mesh) object.receiveShadow = true
            })
            this.scene.add(roadModel)

            this.environmentManager = EnvironmentManager.getInstance(this, this.resourceManager, this.scene)
            await this.environmentManager.initialize()

            this.setupLighting()
            this.scene.fog = new THREE.Fog(0x87ceeb, 250, 1000)
        } catch (error) {
            console.error("Failed to initialize world:", error)
            throw error
        }
    }

    public async createCar(carConfig: CarConfig, inputSystem: InputSystem): Promise<Car> {
        if (this.car) {
            console.warn("Car already exists in WorldManager.")
            return this.car
        }
        try {
            console.log("[WorldManager] Creating car instance...")
            this.car = new Car(this, carConfig, inputSystem)
            await this.car.initialize()

            const carModel = this.car.getModel()
            if (!carModel) {
                throw new Error("Car model is missing after initialization")
            }
            this.scene.add(carModel)
            console.log("[WorldManager] Car created and added to scene.")
            return this.car
        } catch (error) {
            console.error("[WorldManager] Failed to create car:", error)
            throw error
        }
    }

    public getCar(): Car | null {
        return this.car
    }

    private setupEnvironment(): void {
        this.scene.background = new THREE.Color(0x87ceeb)
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }

    private setupLighting(): void {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        this.directionalLight.position.set(50, 100, 30)
        this.directionalLight.castShadow = true
        this.directionalLight.shadow.mapSize.width = 2048
        this.directionalLight.shadow.mapSize.height = 2048
        this.directionalLight.shadow.camera.near = 50
        this.directionalLight.shadow.camera.far = 250
        this.directionalLight.shadow.camera.left = -150
        this.directionalLight.shadow.camera.right = 150
        this.directionalLight.shadow.camera.top = 150
        this.directionalLight.shadow.camera.bottom = -150
        this.directionalLight.shadow.bias = -0.001

        this.fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
        this.fillLight.position.set(-50, 50, -30)

        this.scene.add(this.ambientLight)
        this.scene.add(this.directionalLight)
        this.scene.add(this.directionalLight.target)
        this.scene.add(this.fillLight)
        this.scene.add(this.fillLight.target)

        this.updateLighting(true)
    }

    private updateLighting(isDay: boolean): void {
        this.isDay = isDay
        const ambientIntensity = this.isDay ? 1.0 : 0.15
        const directionalIntensity = this.isDay ? 1.0 : 0.1
        const fillIntensity = this.isDay ? 0.5 : 0.05
        const fogColor = this.isDay ? 0x87ceeb : 0x000020
        const backgroundColor = this.isDay ? 0x87ceeb : 0x000011
        const fogNear = this.isDay ? 250 : 50
        const fogFar = this.isDay ? 1000 : 400

        if (this.ambientLight) this.ambientLight.intensity = ambientIntensity
        if (this.directionalLight) this.directionalLight.intensity = directionalIntensity
        if (this.fillLight) this.fillLight.intensity = fillIntensity

        if (this.scene.fog instanceof THREE.Fog) {
            this.scene.fog.color.setHex(fogColor)
            this.scene.fog.near = fogNear
            this.scene.fog.far = fogFar
        } else {
            this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar)
        }
        if (this.scene.background instanceof THREE.Color) {
            this.scene.background.setHex(backgroundColor)
        } else {
            this.scene.background = new THREE.Color(backgroundColor)
        }
    }

    public toggleDayNight(): void {
        this.updateLighting(!this.isDay)
        this.car?.setNightMode(!this.isDay)
    }

    public getHeightAt(x: number, y: number, z: number): number {
        return this.terrain?.getHeightAt(x, y, z) ?? 0
    }

    public getNormalAt(x: number, y: number, z: number): THREE.Vector3 {
        return this.terrain?.getNormalAt(x, y, z) ?? new THREE.Vector3(0, 1, 0)
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
        this.environmentManager?.update()
    }

    public dispose(): void {
        console.log("Disposing WorldManager...")
        this.terrain?.dispose()
        this.road?.dispose()
        this.car?.dispose()
        this.environmentManager?.dispose()

        if (this.ambientLight) this.scene.remove(this.ambientLight)
        if (this.directionalLight) {
            this.scene.remove(this.directionalLight.target)
            this.scene.remove(this.directionalLight)
        }
        if (this.fillLight) {
            this.scene.remove(this.fillLight.target)
            this.scene.remove(this.fillLight)
        }

        this.terrain = null
        this.road = null
        this.car = null
        this.environmentManager = null
        this.ambientLight = null
        this.directionalLight = null
        this.fillLight = null

        WorldManager.instance = null
        console.log("WorldManager disposed.")
    }

    public isPointOnRoad(x: number, z: number, checkWidth?: number): boolean {
        return this.road?.isPointOnRoad(x, z, checkWidth) ?? false
    }
}

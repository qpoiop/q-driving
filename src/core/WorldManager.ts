import * as THREE from "three"
import { Terrain } from "../entities/Terrain"
import { Road } from "../entities/Road"
import { ResourceManager } from "./ResourceManager"
import { ITerrainService } from "./ITerrainService"
import { EnvironmentManager } from "./EnvironmentManager"
import { Car } from "../entities/Car"
import { CarConfig } from "../config/CarConfig"
import { InputSystem } from "../systems/InputSystem"
import { PhysicsComponent } from "../components/PhysicsComponent"
import { TransformComponent } from "../components/TransformComponent"
import { Time } from "./Time"
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
    private car: Car | null = null

    // Helper objects for collision
    private collisionNormal = new THREE.Vector3()
    private relativeVelocity = new THREE.Vector3()
    private impulse = new THREE.Vector3()
    private carPositionVec = new THREE.Vector3()
    private objectPositionVec = new THREE.Vector3()

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

            // Terrain setup (adjust parameters as needed for visual density)
            const terrainConfig = { width: 500, height: 500, heightScale: 1.5, segments: 128, textureRepeat: 12 }
            this.terrain = new Terrain(this, terrainConfig)
            await this.terrain.initialize()
            this.terrain.getModel().traverse(object => {
                if (object instanceof THREE.Mesh) object.receiveShadow = true
            })
            this.terrain.setPosition(-terrainConfig.width / 2, 0, -terrainConfig.height / 2)
            this.scene.add(this.terrain.getModel())

            // Road setup (adjust parameters as needed)
            const roadConfig = { width: 8, segments: 150, curveRadius: 180, curveSegments: 20, textureRepeat: 30 }
            this.road = new Road(this, roadConfig)
            await this.road.initialize()
            const roadModel = this.road.getModel()
            roadModel.traverse(object => {
                if (object instanceof THREE.Mesh) object.receiveShadow = true
            })
            this.scene.add(roadModel)

            // Environment Manager setup
            this.environmentManager = EnvironmentManager.getInstance(this, this.resourceManager, this.scene)
            await this.environmentManager.initialize()

            // Lighting and Fog setup (adjust for visual style)
            this.setupLighting()
            this.scene.fog = new THREE.Fog(0xaaaaaa, 100, 600) // Adjusted fog
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
        this.scene.background = new THREE.Color(0xaaaaaa) // Neutral background
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.toneMappingExposure = 1.0
    }

    private setupLighting(): void {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7) // Slightly brighter ambient
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0) // Slightly brighter sun
        this.directionalLight.position.set(70, 120, 50) // Adjusted sun position
        this.directionalLight.castShadow = true
        this.directionalLight.shadow.mapSize.width = 1024 // Reduced shadow map size
        this.directionalLight.shadow.mapSize.height = 1024 // Reduced shadow map size
        this.directionalLight.shadow.camera.near = 10
        this.directionalLight.shadow.camera.far = 300 // Reduced far plane for tighter shadows
        this.directionalLight.shadow.camera.left = -150
        this.directionalLight.shadow.camera.right = 150
        this.directionalLight.shadow.camera.top = 150
        this.directionalLight.shadow.camera.bottom = -150
        this.directionalLight.shadow.bias = -0.002 // Adjusted bias

        this.fillLight = new THREE.DirectionalLight(0xaaaaaa, 0.4) // Neutral fill
        this.fillLight.position.set(-70, 70, -50)

        this.scene.add(this.ambientLight)
        this.scene.add(this.directionalLight)
        this.scene.add(this.directionalLight.target) // Ensure target is added
        this.scene.add(this.fillLight)
        this.scene.add(this.fillLight.target) // Ensure target is added

        this.updateLighting(true)
    }

    private updateLighting(isDay: boolean): void {
        this.isDay = isDay
        const ambientIntensity = this.isDay ? 0.7 : 0.1
        const directionalIntensity = this.isDay ? 1.0 : 0.05
        const fillIntensity = this.isDay ? 0.4 : 0.02
        const fogColor = this.isDay ? 0xaaaaaa : 0x050510
        const backgroundColor = this.isDay ? 0xaaaaaa : 0x020208
        const fogNear = this.isDay ? 100 : 30
        const fogFar = this.isDay ? 600 : 250

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
        const engine = Engine.getInstance()
        const camera = engine.getCamera()
        const deltaTime = Time.getDeltaTime()

        // Pass required info (deltaTime, camera and car position) to EnvironmentManager
        const carPosition = this.car?.getComponent<TransformComponent>("transform")?.getPosition()
        this.environmentManager?.update(deltaTime, camera, carPosition) // Pass deltaTime, camera and car position

        // --- Improved Collision Detection & Response ---
        if (this.car && this.environmentManager && carPosition) {
            const carBox = this.car.getWorldBoundingBox()
            const physics = this.car.getComponent<PhysicsComponent>("physics")
            const carVelocity = physics?.getVelocity() // Get car velocity for response

            if (carBox && physics && carVelocity) {
                const nearbyObjects = this.environmentManager.getNearbyObjects(carPosition, 2) // Reduced radius from 5 to 2
                let collisionOccurred = false

                for (const obj of nearbyObjects) {
                    const objBox = obj.entity.getWorldBoundingBox(obj)
                    if (objBox && carBox.intersectsBox(objBox)) {
                        if (!collisionOccurred) {
                            // Handle only first collision per frame for stability
                            console.error("COLLISION DETECTED between Car and", obj.entityClass.MODEL_NAME, `[${obj.entity.instanceId}]`)
                            collisionOccurred = true

                            // Calculate collision normal (approximate: from object center to car center)
                            this.carPositionVec.copy(carPosition)
                            this.objectPositionVec.copy(obj.position)
                            this.collisionNormal.subVectors(this.carPositionVec, this.objectPositionVec).normalize()

                            // --- Prevent sinking by flattening the normal to XZ plane --- //
                            this.collisionNormal.y = 0
                            this.collisionNormal.normalize() // Re-normalize after flattening
                            // -------------------------------------------------------------- //

                            // Calculate relative velocity along the normal
                            this.relativeVelocity.copy(carVelocity) // Simple approximation
                            const velocityAlongNormal = this.relativeVelocity.dot(this.collisionNormal)

                            // Calculate impulse magnitude (using restitution e=0.3)
                            const restitution = 0.3
                            let impulseMagnitude = -(1 + restitution) * velocityAlongNormal
                            // Use getter for mass
                            const carMass = physics.getMass()
                            if (carMass > 0) {
                                // Avoid division by zero
                                impulseMagnitude /= 1 / carMass // Simplified: assume object mass is infinite
                            } else {
                                impulseMagnitude = 0 // No impulse if mass is invalid
                            }

                            // Apply impulse
                            this.impulse.copy(this.collisionNormal).multiplyScalar(impulseMagnitude)
                            physics.applyImpulse(this.impulse)

                            // Break after handling the first collision this frame
                            break
                        }
                    }
                }
            }
        }
        // ---------------------------------
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

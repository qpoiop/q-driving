import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { PhysicsComponent } from "../components/PhysicsComponent"
import { SuspensionComponent } from "../components/SuspensionComponent"
import { InputComponent } from "../components/InputComponent"
import { ITerrainService } from "../core/ITerrainService"
import { InputSystem } from "../systems/InputSystem"
import { CarConfig } from "../config/CarConfig"

export class Car extends Entity {
    private terrainService: ITerrainService
    private config: CarConfig
    private headlight: THREE.SpotLight
    private taillight: THREE.SpotLight
    private isNightMode: boolean
    private wheelMeshes: THREE.Mesh[] = []
    private smokeParticles: THREE.Points
    private driftTrail: THREE.Line
    private inputSystem: InputSystem

    constructor(terrainService: ITerrainService, config: CarConfig, inputSystem: InputSystem) {
        super()
        this.terrainService = terrainService
        this.config = config
        this.isNightMode = false

        // 기본 컴포넌트 추가
        this.addComponent(new TransformComponent())
        this.addComponent(new ModelComponent(new THREE.Group()))
        this.addComponent(new PhysicsComponent(config.physics))
        this.addComponent(
            new SuspensionComponent(
                config.suspension,
                [
                    { position: new THREE.Vector3(-1, 0, 1), radius: config.suspension.wheelRadius, width: config.suspension.wheelWidth },
                    { position: new THREE.Vector3(1, 0, 1), radius: config.suspension.wheelRadius, width: config.suspension.wheelWidth },
                    { position: new THREE.Vector3(-1, 0, -1), radius: config.suspension.wheelRadius, width: config.suspension.wheelWidth },
                    { position: new THREE.Vector3(1, 0, -1), radius: config.suspension.wheelRadius, width: config.suspension.wheelWidth },
                ],
                this.terrainService,
            ),
        )
        this.addComponent(new InputComponent(inputSystem))

        // --- Log Initial Velocity Right After PhysicsComponent Creation (Debug) ---
        const initialPhysics = this.getComponent<PhysicsComponent>("physics")
        if (initialPhysics) {
            const v = initialPhysics.getVelocity()
            console.log(`[Car Constructor] Initial Physics Velocity: ${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`)
        }
        // ----------------------------------------------------------------------

        // 이벤트 구독
        const eventManager = inputSystem.getEventManager()
        eventManager.on("input:keydown", this.onKeyDown.bind(this))
        eventManager.on("input:keyup", this.onKeyUp.bind(this))

        this.inputSystem = inputSystem
    }

    private onKeyDown(key: string): void {
        const input = this.getComponent<InputComponent>("input")
        const physics = this.getComponent<PhysicsComponent>("physics")
        if (!input || !physics) return

        if (input.isHandbraking() && physics.getVelocity().length() > 5) {
            this.startDrift()
        }
    }

    private onKeyUp(key: string): void {
        const input = this.getComponent<InputComponent>("input")
        if (!input) return

        if (key === this.inputSystem.getKeyMapping().handbrake) {
            this.stopDrift()
        }
    }

    private startDrift(): void {
        const physics = this.getComponent<PhysicsComponent>("physics")
        if (!physics) return

        // 드리프트 시작 시 물리 속성 변경
        physics.setGrip(this.config.physics.grip * this.config.driftFactor)
        physics.setTurnSpeed(this.config.physics.turnSpeed * 1.5)
    }

    private stopDrift(): void {
        const physics = this.getComponent<PhysicsComponent>("physics")
        if (!physics) return

        // 드리프트 종료 시 물리 속성 복원
        physics.setGrip(this.config.physics.grip)
        physics.setTurnSpeed(this.config.physics.turnSpeed)
    }

    public setNightMode(isNightMode: boolean): void {
        this.isNightMode = isNightMode
        // Update light visibility based on mode
        if (this.headlight) {
            this.headlight.visible = this.isNightMode
            this.headlight.target.visible = this.isNightMode // Target might also need visibility toggle
        }
        if (this.taillight) {
            // Taillights might always be visible, or only when braking/night
            // For simplicity, let's toggle visibility with night mode for now
            this.taillight.visible = this.isNightMode
            this.taillight.target.visible = this.isNightMode
        }
    }

    public override dispose(): void {
        super.dispose()
        this.wheelMeshes.forEach(wheel => wheel.geometry.dispose())
        if (this.smokeParticles) this.smokeParticles.geometry.dispose()
        if (this.driftTrail) this.driftTrail.geometry.dispose()
    }

    public getModel(): THREE.Group {
        const modelComponent = this.getComponent<ModelComponent>("model")
        if (!modelComponent) {
            throw new Error("Model component not found")
        }
        return modelComponent.getModel()
    }

    public override async initialize(): Promise<void> {
        await super.initialize()
        await this.loadCarModel()
        this.setupLights()
        this.setupSmokeParticles()
        this.setupDriftTrail()
    }

    private async loadCarModel(): Promise<void> {
        try {
            console.log("Starting to load car model...")
            const resourceManager = this.terrainService.getResourceManager()
            const model = await resourceManager.loadModel("car", "models/car/car01.gltf")
            console.log("Car model loaded:", model)

            if (!model) {
                throw new Error("Car model is null after loading")
            }

            const modelComponent = this.getComponent<ModelComponent>("model")
            if (!modelComponent) {
                throw new Error("Model component not found")
            }

            modelComponent.setModel(model)
            console.log("Model set to car component")

            if (model.children.length === 0) {
                throw new Error("Car model has no children")
            }

            // 모델 스케일 조정
            model.scale.set(1, 1, 1)

            // 그림자 설정
            model.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true
                    console.log("Shadow settings applied to mesh:", child.name)
                }
            })

            console.log("Car model setup completed")
        } catch (error) {
            console.error("Failed to load car model:", error)
            throw error
        }
    }

    private setupLights(): void {
        const modelComponent = this.getComponent<ModelComponent>("model")
        if (!modelComponent) return

        const model = modelComponent.getModel()
        this.headlight = new THREE.SpotLight(0xffffff, 5, 100, Math.PI / 3.5, 0.3, 1)
        this.headlight.position.set(0, 0.8, 1.5)
        this.headlight.target.position.set(0, 0.5, 10)
        this.headlight.castShadow = true
        this.headlight.shadow.mapSize.width = 1024
        this.headlight.shadow.mapSize.height = 1024
        this.headlight.shadow.camera.near = 0.5
        this.headlight.shadow.camera.far = 100

        model.add(this.headlight)
        model.add(this.headlight.target)

        this.taillight = new THREE.SpotLight(0xff0000, 3, 50, Math.PI / 4, 0.5, 2)
        this.taillight.position.set(0, 0.8, -1.8)
        this.taillight.target.position.set(0, 0.5, -10)
        this.taillight.castShadow = true
        model.add(this.taillight)
        model.add(this.taillight.target)
    }

    private setupSmokeParticles(): void {
        const modelComponent = this.getComponent<ModelComponent>("model")
        if (!modelComponent) return

        const particleCount = 100
        const particles = new Float32Array(particleCount * 3)
        const particleGeometry = new THREE.BufferGeometry()
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x888888,
            size: 0.1,
            transparent: true,
            opacity: 0.5,
        })

        for (let i = 0; i < particleCount; i++) {
            particles[i * 3] = 0
            particles[i * 3 + 1] = 0
            particles[i * 3 + 2] = 0
        }

        particleGeometry.setAttribute("position", new THREE.BufferAttribute(particles, 3))
        this.smokeParticles = new THREE.Points(particleGeometry, particleMaterial)
        modelComponent.getModel().add(this.smokeParticles)
    }

    private setupDriftTrail(): void {
        const modelComponent = this.getComponent<ModelComponent>("model")
        if (!modelComponent) return

        const trailGeometry = new THREE.BufferGeometry()
        const trailMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 })
        this.driftTrail = new THREE.Line(trailGeometry, trailMaterial)
        modelComponent.getModel().add(this.driftTrail)
    }

    public getSpeed(): number {
        const physics = this.getComponent<PhysicsComponent>("physics")
        if (!physics) return 0
        return physics.getVelocity().length()
    }

    private updateWheelRotation(deltaTime: number): void {
        const physics = this.getComponent<PhysicsComponent>("physics")
        if (!physics) return

        const speed = physics.getVelocity().length()
        const direction = physics.getVelocity().normalize()

        this.wheelMeshes.forEach((wheel, index) => {
            // 바퀴 회전
            wheel.rotation.x += speed * deltaTime

            // 바퀴 스티어링
            if (index < 2) {
                // 전륜만
                const input = this.getComponent<InputComponent>("input")
                if (input) {
                    const steerAngle = (input.getSteeringAngle() * Math.PI) / 4
                    wheel.rotation.y = steerAngle
                }
            }
        })
    }

    private updateDriftTrail(): void {
        // 드리프트 트레일 업데이트
    }

    private updateSmokeParticles(): void {
        // 연기 파티클 업데이트
    }
}

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
        this.addComponent(new SuspensionComponent(config.suspension))
        this.addComponent(new InputComponent(inputSystem))

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
        physics.setGrip(this.config.grip * this.config.driftFactor)
        physics.setTurnSpeed(this.config.turnSpeed * 1.5)
    }

    private stopDrift(): void {
        const physics = this.getComponent<PhysicsComponent>("physics")
        if (!physics) return

        // 드리프트 종료 시 물리 속성 복원
        physics.setGrip(this.config.grip)
        physics.setTurnSpeed(this.config.turnSpeed)
    }

    public override update(deltaTime: number): void {
        super.update(deltaTime)

        const input = this.getComponent<InputComponent>("input")
        const physics = this.getComponent<PhysicsComponent>("physics")
        const suspension = this.getComponent<SuspensionComponent>("suspension")
        const transform = this.getComponent<TransformComponent>("transform")

        if (!input || !physics || !suspension || !transform) return

        // 입력 처리
        const direction = input.getMovementDirection()
        const moveDirection = new THREE.Vector3(direction.x, 0, direction.z)

        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize()
        }

        // 물리 적용
        const targetVelocity = moveDirection.multiplyScalar(this.config.physics.maxSpeed)
        const acceleration = input.isBraking() ? this.config.physics.deceleration : this.config.physics.acceleration
        physics.applyForce(targetVelocity.multiplyScalar(acceleration), deltaTime)

        // 서스펜션 처리
        const position = transform.getPosition()
        const terrainHeight = this.terrainService.getHeightAt(position.x, position.y, position.z)
        const terrainNormal = this.terrainService.getNormalAt(position.x, position.y, position.z)

        const suspensionForce = suspension.calculateForce(position.y - terrainHeight, terrainNormal)
        physics.applyForce(suspensionForce, deltaTime)
        suspension.setHeight(terrainHeight + this.config.suspension.restLength)

        // 바퀴 회전 업데이트
        this.updateWheelRotation(deltaTime)

        // 드리프트 및 연기 효과
        if (input.isHandbraking() && physics.getVelocity().length() > 5) {
            this.updateDriftTrail()
            this.updateSmokeParticles()
        }
    }

    private updateWheelRotation(deltaTime: number): void {
        const physics = this.getComponent<PhysicsComponent>("physics")
        if (!physics) return

        const speed = physics.getVelocity().length()
        this.wheelMeshes.forEach(wheel => {
            wheel.rotation.x += speed * deltaTime
        })
    }

    private updateDriftTrail(): void {
        // 드리프트 트레일 업데이트
    }

    private updateSmokeParticles(): void {
        // 연기 파티클 업데이트
    }

    public setNightMode(isNightMode: boolean): void {
        this.isNightMode = isNightMode
        // 조명 업데이트
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
                    child.receiveShadow = true
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
        this.headlight = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 4, 0.5)
        this.headlight.position.set(0, 1, 2)
        this.headlight.target.position.set(0, 0, 10)
        this.headlight.castShadow = true
        model.add(this.headlight)
        model.add(this.headlight.target)

        this.taillight = new THREE.SpotLight(0xff0000, 0.5, 50, Math.PI / 4, 0.5)
        this.taillight.position.set(0, 1, -2)
        this.taillight.target.position.set(0, 0, -10)
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
}

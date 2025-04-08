import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { ITerrainService } from "../core/ITerrainService"
import { EventManager } from "../core/EventManager"
import { InputSystem } from "../systems/InputSystem"
import { Time } from "../core/Time"

interface CarConfig {
    maxSpeed: number
    acceleration: number
    deceleration: number
    turnSpeed: number
    grip: number // 도로 접지력
    driftFactor: number // 드리프트 계수
    suspensionStiffness: number // 서스펜션 강성
    suspensionDamping: number // 서스펜션 감쇠
    suspensionCompression: number // 서스펜션 압축
    suspensionRestLength: number // 서스펜션 기본 길이
    rollInfluence: number // 롤 영향도
}

export class Car extends Entity {
    private transform: TransformComponent
    private model: ModelComponent
    private mesh: THREE.Mesh
    private terrainService: ITerrainService
    private config: CarConfig
    private velocity: THREE.Vector3
    private direction: THREE.Vector3
    private headlight: THREE.SpotLight
    private taillight: THREE.SpotLight
    private isNightMode: boolean
    private isBraking: boolean
    private isDrifting: boolean // 드리프트 상태 추가
    private currentGrip: number // 현재 접지력
    private wheelRotation: number // 바퀴 회전 각도
    private suspensionHeight: number // 서스펜션 높이
    private raycaster: THREE.Raycaster
    private lastObstructingObjects: THREE.Object3D[] = []
    private eventManager: EventManager
    private inputSystem: InputSystem
    private wheelMeshes: THREE.Mesh[] = [] // 바퀴 메시 배열
    private smokeParticles: THREE.Points // 연기 파티클
    private driftTrail: THREE.Line // 드리프트 트레일
    private activeKeys = new Set<string>()

    constructor(terrainService: ITerrainService, config: CarConfig, inputSystem: InputSystem) {
        super()
        this.terrainService = terrainService
        this.config = config
        this.inputSystem = inputSystem
        this.transform = new TransformComponent()
        this.model = new ModelComponent(new THREE.Group())
        this.mesh = new THREE.Mesh()
        this.velocity = new THREE.Vector3()
        this.direction = new THREE.Vector3(0, 0, -1)
        this.isNightMode = false
        this.isBraking = false
        this.isDrifting = false
        this.currentGrip = config.grip
        this.wheelRotation = 0
        this.suspensionHeight = config.suspensionRestLength
        this.raycaster = new THREE.Raycaster()
        this.eventManager = this.inputSystem.getEventManager()

        // 키 이벤트 구독
        this.eventManager.on("input:keydown", this.onKeyDown.bind(this))
        this.eventManager.on("input:keyup", this.onKeyUp.bind(this))

        this.addComponent(this.transform)
        this.addComponent(this.model)
    }

    private onKeyDown(key: string): void {
        console.log("[Car] Key down:", key)
        this.activeKeys.add(key)
    }

    private onKeyUp(key: string): void {
        console.log("[Car] Key up:", key)
        this.activeKeys.delete(key)
    }

    private setupSmokeParticles(): void {
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
        this.model.getModel().add(this.smokeParticles)
    }

    private setupDriftTrail(): void {
        const trailGeometry = new THREE.BufferGeometry()
        const trailMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 })
        this.driftTrail = new THREE.Line(trailGeometry, trailMaterial)
        this.model.getModel().add(this.driftTrail)
    }

    private updateInput(): void {
        let moveDirection = new THREE.Vector3(0, 0, 0)
        let brake = false
        let handbrake = false

        if (this.inputSystem.hasTouchInput()) {
            const touchDirection = this.inputSystem.getTouchDirection()
            moveDirection.set(touchDirection.x, 0, -touchDirection.y)
            brake = this.activeKeys.has("b")
            handbrake = this.activeKeys.has("space")
        } else {
            const forward = this.activeKeys.has("arrowup")
            const backward = this.activeKeys.has("arrowdown")
            const left = this.activeKeys.has("arrowleft")
            const right = this.activeKeys.has("arrowright")
            brake = this.activeKeys.has("b")
            handbrake = this.activeKeys.has("space")

            if (forward) moveDirection.z -= 1
            if (backward) moveDirection.z += 1
            if (left) moveDirection.x -= 1
            if (right) moveDirection.x += 1
        }

        this.isBraking = brake
        this.isDrifting = handbrake && Math.abs(this.velocity.length()) > 5

        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize()
        }

        this.currentGrip = this.isDrifting ? this.config.grip * this.config.driftFactor : this.config.grip

        const targetVelocity = moveDirection.multiplyScalar(this.config.maxSpeed)
        const acceleration = this.isBraking ? this.config.deceleration : this.config.acceleration
        this.velocity.lerp(targetVelocity, acceleration * Time.getDeltaTime())
    }

    private updatePhysics(deltaTime: number): void {
        const position = this.transform.getPosition()
        const terrainHeight = this.terrainService.getHeightAt(position.x, position.y, position.z)
        const terrainNormal = this.terrainService.getNormalAt(position.x, position.y, position.z)

        const suspensionForce = this.calculateSuspensionForce(position.y - terrainHeight, terrainNormal)

        this.updateRotation(deltaTime)

        const moveDelta = this.velocity.clone().multiplyScalar(deltaTime).add(suspensionForce)

        this.transform.setPosition(position.x + moveDelta.x, terrainHeight + this.suspensionHeight, position.z + moveDelta.z)

        this.updateWheelRotation(deltaTime)

        if (this.isDrifting) {
            this.updateDriftTrail()
        }

        this.updateSmokeParticles()
    }

    private calculateSuspensionForce(height: number, normal: THREE.Vector3): THREE.Vector3 {
        const compression = this.config.suspensionRestLength - height
        const force = compression * this.config.suspensionStiffness
        return normal.multiplyScalar(force)
    }

    private updateRotation(deltaTime: number): void {
        const speed = this.velocity.length()
        if (speed > 0.1) {
            const turnFactor = this.isDrifting ? 2 : 1
            const rotationAmount = this.velocity.x * this.config.turnSpeed * turnFactor * deltaTime
            this.transform.rotateY(rotationAmount)
        }
    }

    private updateWheelRotation(deltaTime: number): void {
        const speed = this.velocity.length()
        this.wheelRotation += speed * deltaTime
        this.wheelMeshes.forEach(wheel => {
            wheel.rotation.x = this.wheelRotation
        })
    }

    private updateDriftTrail(): void {
        const position = this.transform.getPosition()
        const trailGeometry = this.driftTrail.geometry as THREE.BufferGeometry
        const positions = trailGeometry.attributes.position.array as Float32Array

        positions[0] = position.x
        positions[1] = position.y
        positions[2] = position.z

        trailGeometry.attributes.position.needsUpdate = true
    }

    private updateSmokeParticles(): void {
        if (!this.smokeParticles) return

        const positions = this.smokeParticles.geometry.attributes.position.array as Float32Array

        if (this.isDrifting || this.isBraking) {
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += (Math.random() - 0.5) * 0.1
                positions[i + 1] += Math.random() * 0.1
                positions[i + 2] += (Math.random() - 0.5) * 0.1
            }
        }

        this.smokeParticles.geometry.attributes.position.needsUpdate = true
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

            // 모델 설정
            this.model.setModel(model)
            console.log("Model set to car component")

            if (model.children.length === 0) {
                throw new Error("Car model has no children")
            }

            this.mesh = model.children[0] as THREE.Mesh
            console.log("Car mesh assigned:", this.mesh)

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
        this.headlight = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 4, 0.5)
        this.headlight.position.set(0, 1, 2)
        this.headlight.target.position.set(0, 0, 10)
        this.headlight.castShadow = true
        this.model.getModel().add(this.headlight)
        this.model.getModel().add(this.headlight.target)

        this.taillight = new THREE.SpotLight(0xff0000, 0.5, 50, Math.PI / 4, 0.5)
        this.taillight.position.set(0, 1, -2)
        this.taillight.target.position.set(0, 0, -10)
        this.taillight.castShadow = true
        this.model.getModel().add(this.taillight)
        this.model.getModel().add(this.taillight.target)
    }

    public override update(deltaTime: number): void {
        super.update(deltaTime)
        this.updateInput()
        this.updatePhysics(deltaTime)
        this.updateTerrainInteraction()
        this.updateLights()
        this.checkCollisions()
    }

    private updateTerrainInteraction(): void {
        const position = this.transform.getPosition()
        const height = this.terrainService.getHeightAt(position.x, position.y, position.z)
        const normal = this.terrainService.getNormalAt(position.x, position.y, position.z)

        // 지면 위에 약간의 여유 높이를 두어 파묻힘 방지
        position.y = height + this.suspensionHeight + 0.1
        this.transform.setPosition(position.x, position.y, position.z)

        const up = new THREE.Vector3(0, 1, 0)
        const quaternion = new THREE.Quaternion()
        quaternion.setFromUnitVectors(up, normal)
        this.transform.setRotationFromQuaternion(quaternion)
    }

    private updateLights(): void {
        if (!this.headlight || !this.taillight) return // 조명이 초기화되지 않았으면 리턴
        this.headlight.intensity = this.isNightMode ? 1 : 0
        this.taillight.intensity = this.isBraking ? 1 : 0.5
    }

    public getSpeed(): number {
        return this.velocity.length()
    }

    public getPosition(): THREE.Vector3 {
        return this.transform.getPosition()
    }

    public getRotation(): THREE.Euler {
        return this.transform.getRotation()
    }

    public getModel(): THREE.Group {
        return this.model.getModel()
    }

    public setNightMode(isNightMode: boolean): void {
        this.isNightMode = isNightMode
    }

    public setBraking(isBraking: boolean): void {
        this.isBraking = isBraking
    }

    public setKeyState(key: string, state: boolean): void {
        // this.keyStates[key] = state // 제거
    }

    private checkCollisions(): void {
        const position = this.transform.getPosition()
        this.raycaster.set(position, new THREE.Vector3(0, -1, 0))

        const intersects = this.raycaster.intersectObjects(this.model.getModel().children)
        if (intersects.length > 0) {
            const obstructingObjects = intersects.filter(intersect => intersect.distance < 5).map(intersect => intersect.object)

            if (obstructingObjects.length > 0) {
                this.eventManager.emit("car:collision", obstructingObjects)
            }

            this.lastObstructingObjects = obstructingObjects
        }
    }

    public override dispose(): void {
        super.dispose()
        this.model.dispose()
        this.headlight.dispose()
        this.taillight.dispose()
        this.eventManager.dispose()
        // window.removeEventListener("keydown", this.onKeyDown.bind(this))
        // window.removeEventListener("keyup", this.onKeyUp.bind(this))
    }
}

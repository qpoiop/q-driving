import * as THREE from "three"
import { gltfLoader } from "../loaders/glbfLoader"
import { InputSystem } from "../systems/InputSystem"
import { GroundTracker } from "../systems/GroundTracker"
import { Joystick } from "../ui/Joystick"

export class Car {
    public mesh: THREE.Object3D | null = null

    private steeringAngle = 0

    private acceleration = 0
    private readonly maxSpeed = 1.2
    private readonly accelerationRate = 0.02
    private readonly decelerationRate = 0.015
    private readonly brakeRate = 0.05

    private readonly steeringAccel = 0.003
    private readonly maxSteering = 0.03
    private readonly steeringFriction = 0.9

    private prevPosition = new THREE.Vector3()
    private currentSpeed = 0

    private readonly forward = new THREE.Vector3()
    private readonly velocity = new THREE.Vector3()
    private readonly smoothedNormal = new THREE.Vector3(0, 1, 0)

    private readonly rollingFriction = 0.98
    private readonly airResistance = 0.995

    private headLights: THREE.SpotLight[] = []

    private initial = {
        position: new THREE.Vector3(0, 0.5, -25),
        rotation: new THREE.Euler(0, Math.PI, 0),
        scale: new THREE.Vector3(1.8, 1.8, 1.8),
    }

    constructor(private scene: THREE.Scene, private input: InputSystem, private tracker?: GroundTracker, private joystick?: Joystick) {}

    public setInitial(config: Partial<{ position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }>) {
        if (config.position) this.initial.position.copy(config.position)
        if (config.rotation) this.initial.rotation.copy(config.rotation)
        if (config.scale) this.initial.scale.copy(config.scale)
    }

    public load() {
        gltfLoader.load("/assets/models/car/scene.gltf", gltf => {
            const model = gltf.scene
            model.scale.copy(this.initial.scale)
            model.position.copy(this.initial.position)
            model.rotation.copy(this.initial.rotation)

            this.scene.add(model)
            this.mesh = model
            this.prevPosition.copy(model.position)

            this.setupHeadlights()
            this.toggleLights(false)
        })
    }

    public update() {
        if (!this.mesh) return

        this.forward.set(0, 0, 1).applyQuaternion(this.mesh.quaternion).setY(0).normalize()
        this.velocity.set(0, 0, 0)

        // 터치 기반 회전 및 가속
        const touch = this.input.getTouchDirection()
        const isTouch = this.input.hasTouchInput()

        // Steering
        const steer = isTouch ? -touch.x : this.input.isKeyPressed("a") ? 1 : this.input.isKeyPressed("d") ? -1 : 0
        this.steeringAngle += steer * this.steeringAccel
        this.steeringAngle *= this.steeringFriction
        this.steeringAngle = THREE.MathUtils.clamp(this.steeringAngle, -this.maxSteering, this.maxSteering)
        this.mesh.rotation.y += this.steeringAngle

        // update() 내 기존 steer/accel 처리 대체
        const { x, y } = this.joystick?.getInput?.() ?? { x: 0, y: 0 }
        this.steeringAngle += -x * this.steeringAccel
        this.steeringAngle *= this.steeringFriction
        this.steeringAngle = THREE.MathUtils.clamp(this.steeringAngle, -this.maxSteering, this.maxSteering)
        this.mesh.rotation.y += this.steeringAngle

        if (this.input.isKeyPressed("w") || this.input.isKeyPressed("arrowup") || y < -0.2) {
            this.acceleration += this.accelerationRate
        } else if (this.input.isKeyPressed("s") || this.input.isKeyPressed("arrowdown") || y > 0.2) {
            this.acceleration -= this.brakeRate
        } else {
            this.acceleration *= this.rollingFriction * this.airResistance
        }

        this.acceleration = THREE.MathUtils.clamp(this.acceleration, -this.maxSpeed * 0.7, this.maxSpeed) // 모바일 감속
        this.velocity.copy(this.forward).multiplyScalar(this.acceleration)

        // 이동 처리
        const nextPos = this.mesh.position.clone().add(this.velocity)
        let terrainY = 0
        if (this.tracker) {
            terrainY = this.tracker.getHeightAt(nextPos)
        }
        nextPos.y = THREE.MathUtils.lerp(this.mesh.position.y, terrainY + 0.2, 0.2)
        this.mesh.position.copy(nextPos)

        // 노멀 기반 회전 보정
        if (this.tracker) {
            const rawNormal = this.tracker.getNormalAt(this.mesh.position)
            this.smoothedNormal.lerp(rawNormal, 0.1)

            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion)
            const right = new THREE.Vector3().crossVectors(this.smoothedNormal, forward).normalize()
            const correctedForward = new THREE.Vector3().crossVectors(right, this.smoothedNormal).normalize()

            const m = new THREE.Matrix4().makeBasis(right, this.smoothedNormal, correctedForward)
            const q = new THREE.Quaternion().setFromRotationMatrix(m)
            this.mesh.quaternion.slerp(q, 0.1)
        }

        this.currentSpeed = this.mesh.position.distanceTo(this.prevPosition)
        this.prevPosition.copy(this.mesh.position)
    }

    // 전조등 설정 함수
    private setupHeadlights() {
        const lightL = new THREE.SpotLight(0xffffff, 5, 100, Math.PI / 10, 0.5)
        const lightR = new THREE.SpotLight(0xffffff, 5, 100, Math.PI / 10, 0.5)

        lightL.castShadow = true
        lightR.castShadow = true

        // 광원 위치 (차량 앞 범퍼 부근)
        lightL.position.set(-0.6, 0.3, 1.4)
        lightR.position.set(0.6, 0.3, 1.4)

        // 빛이 향하는 방향 (앞으로 멀리)
        const targetL = new THREE.Object3D()
        const targetR = new THREE.Object3D()
        targetL.position.set(-0.6, 0.1, 10)
        targetR.position.set(0.6, 0.1, 10)

        this.mesh!.add(lightL, lightR, targetL, targetR)
        lightL.target = targetL
        lightR.target = targetR

        this.headLights.push(lightL, lightR)
    }

    // 불빛 켜고 끄는 함수
    public toggleLights(on: boolean) {
        this.headLights.forEach(light => (light.visible = on))
    }

    public get position(): THREE.Vector3 {
        return this.mesh?.position || new THREE.Vector3()
    }

    public get quaternion(): THREE.Quaternion {
        return this.mesh?.quaternion || new THREE.Quaternion()
    }

    public getSpeed(): number {
        return this.acceleration
    }
}

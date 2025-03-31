import * as THREE from "three"
import { gltfLoader } from "../loaders/glbfLoader"
import { InputSystem } from "../systems/InputSystem"
import { GroundTracker } from "../systems/GroundTracker"

export class Car {
    public mesh: THREE.Object3D | null = null

    private steeringAngle = 0

    // 가속도 기반 속도 처리
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
    private readonly smoothedNormal = new THREE.Vector3(0, 1, 0) // 추가: 노멀 보정값

    private readonly rollingFriction = 0.98 // 관성 유지하면서 점차 감속
    private readonly airResistance = 0.995 // 공기 저항

    private initial = {
        position: new THREE.Vector3(0, 0.5, -25),
        rotation: new THREE.Euler(0, Math.PI, 0),
        scale: new THREE.Vector3(1.8, 1.8, 1.8),
    }

    constructor(private scene: THREE.Scene, private input: InputSystem, private tracker?: GroundTracker) {}

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
        })
    }

    public update() {
        const mesh = this.mesh
        if (!mesh) return

        // 방향 벡터 초기화
        this.forward.set(0, 0, 1).applyQuaternion(mesh.quaternion)
        this.velocity.set(0, 0, 0)

        // 입력에 따라 회전 처리
        if (this.input.isKeyPressed("a") || this.input.isKeyPressed("arrowleft")) {
            this.steeringAngle += this.steeringAccel
        } else if (this.input.isKeyPressed("d") || this.input.isKeyPressed("arrowright")) {
            this.steeringAngle -= this.steeringAccel
        } else {
            this.steeringAngle *= this.steeringFriction
        }

        this.steeringAngle = THREE.MathUtils.clamp(this.steeringAngle, -this.maxSteering, this.maxSteering)
        mesh.rotation.y += this.steeringAngle

        // 가속도 처리
        if (this.input.isKeyPressed("w") || this.input.isKeyPressed("arrowup")) {
            this.acceleration += this.accelerationRate
        } else if (this.input.isKeyPressed("s") || this.input.isKeyPressed("arrowdown")) {
            this.acceleration -= this.brakeRate
        } else {
            this.acceleration *= this.rollingFriction * this.airResistance
        }

        this.acceleration = THREE.MathUtils.clamp(this.acceleration, -this.maxSpeed, this.maxSpeed)
        this.velocity.copy(this.forward).multiplyScalar(this.acceleration)
        mesh.position.add(this.velocity)

        // 지형 높이 및 노멀 반영
        if (this.tracker) {
            const terrainY = this.tracker.getHeightAt(mesh.position)
            mesh.position.y = terrainY + 0.2

            // 노멀 보정 (지면 방향에 차량 방향 맞추기)
            const rawNormal = this.tracker.getNormalAt(mesh.position)
            this.smoothedNormal.lerp(rawNormal, 0.15) // 이전보다 느리게 따라감

            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion)
            const right = new THREE.Vector3().crossVectors(this.smoothedNormal, forward).normalize()
            const correctedForward = new THREE.Vector3().crossVectors(right, this.smoothedNormal).normalize()

            const m = new THREE.Matrix4().makeBasis(right, this.smoothedNormal, correctedForward)
            const q = new THREE.Quaternion().setFromRotationMatrix(m)

            mesh.quaternion.slerp(q, 0.1)
        }

        // 속도 계산
        this.currentSpeed = mesh.position.distanceTo(this.prevPosition)
        this.prevPosition.copy(mesh.position)
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

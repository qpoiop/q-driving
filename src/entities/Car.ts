import * as THREE from "three"
import { gltfLoader } from "../loaders/glbfLoader"
import { InputSystem } from "../systems/InputSystem"
import { GroundTracker } from "../systems/GroundTracker"

export class Car {
    public mesh: THREE.Object3D | null = null

    private steeringAngle = 0
    private readonly maxSteering = 0.04
    private readonly steeringAccel = 0.002
    private readonly steeringFriction = 0.9
    private readonly moveSpeed = 0.1

    private prevPosition = new THREE.Vector3()
    private currentSpeed = 0

    private readonly forward = new THREE.Vector3()
    private readonly velocity = new THREE.Vector3()

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

        // 이동 처리
        if (this.input.isKeyPressed("w") || this.input.isKeyPressed("arrowup")) {
            this.velocity.add(this.forward.clone().multiplyScalar(this.moveSpeed))
        }
        if (this.input.isKeyPressed("s") || this.input.isKeyPressed("arrowdown")) {
            this.velocity.add(this.forward.clone().multiplyScalar(-this.moveSpeed))
        }

        mesh.position.add(this.velocity)

        // 지형 높이 반영
        if (this.tracker) {
            const terrainY = this.tracker.getHeightAt(mesh.position)
            mesh.position.y = terrainY + 0.2
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
}

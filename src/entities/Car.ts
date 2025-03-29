// src/entities/Car.ts
import * as THREE from "three"
import { gltfLoader } from "../loaders/glbfLoader"
import { InputSystem } from "../systems/InputSystem"

export class Car {
    public mesh: THREE.Object3D | null = null

    private steeringAngle = 0
    private readonly maxSteering = 0.04
    private readonly steeringAccel = 0.002
    private readonly steeringFriction = 0.9
    private readonly moveSpeed = 0.1

    private prevPosition = new THREE.Vector3()
    private currentSpeed = 0

    private initial = {
        position: new THREE.Vector3(0, 0.5, -25),
        rotation: new THREE.Euler(0, Math.PI, 0),
        scale: new THREE.Vector3(1.8, 1.8, 1.8),
    }

    constructor(private scene: THREE.Scene, private input: InputSystem) {}

    public setInitial(config: Partial<{ position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }>) {
        if (config.position) this.initial.position.copy(config.position)
        if (config.rotation) this.initial.rotation.copy(config.rotation)
        if (config.scale) this.initial.scale.copy(config.scale)
    }

    public load() {
        gltfLoader.load("/assets/models/car/scene.gltf", gltf => {
            this.mesh = gltf.scene
            this.mesh.scale.copy(this.initial.scale)
            this.mesh.position.copy(this.initial.position)
            this.mesh.rotation.copy(this.initial.rotation) // 초기 방향 적용
            this.scene.add(this.mesh)
            this.prevPosition.copy(this.mesh.position)
        })
    }

    public update() {
        if (!this.mesh) return

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion)

        if (this.input.isKeyPressed("a") || this.input.isKeyPressed("arrowleft")) {
            this.steeringAngle += this.steeringAccel
        } else if (this.input.isKeyPressed("d") || this.input.isKeyPressed("arrowright")) {
            this.steeringAngle -= this.steeringAccel
        } else {
            this.steeringAngle *= this.steeringFriction
        }

        this.steeringAngle = THREE.MathUtils.clamp(this.steeringAngle, -this.maxSteering, this.maxSteering)

        const velocity = new THREE.Vector3()
        if (this.input.isKeyPressed("w") || this.input.isKeyPressed("arrowup")) {
            velocity.add(forward.clone().multiplyScalar(this.moveSpeed))
        }
        if (this.input.isKeyPressed("s") || this.input.isKeyPressed("arrowdown")) {
            velocity.add(forward.clone().multiplyScalar(-this.moveSpeed))
        }

        this.mesh.position.add(velocity)

        if (velocity.lengthSq() > 0) {
            const newForward = velocity.clone().normalize()
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), newForward)
            this.mesh.quaternion.slerp(targetQuat, 0.1)
        }

        this.currentSpeed = this.mesh.position.distanceTo(this.prevPosition)
        this.prevPosition.copy(this.mesh.position)
    }

    public get position(): THREE.Vector3 {
        return this.mesh?.position || new THREE.Vector3()
    }

    public get quaternion(): THREE.Quaternion {
        return this.mesh?.quaternion || new THREE.Quaternion()
    }
}

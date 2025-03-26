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

    constructor(private scene: THREE.Scene, private input: InputSystem) {
        this.loadModel()
    }

    private loadModel() {
        gltfLoader.load("/assets/models/car.glb", gltf => {
            this.mesh = gltf.scene
            this.mesh.scale.set(1, 1, 1)
            this.mesh.position.set(0, 0, 0)
            this.scene.add(this.mesh)
        })
    }

    public update() {
        if (!this.mesh) return

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion)

        // 회전 입력
        if (this.input.isKeyPressed("a") || this.input.isKeyPressed("arrowleft")) {
            this.steeringAngle += this.steeringAccel
        } else if (this.input.isKeyPressed("d") || this.input.isKeyPressed("arrowright")) {
            this.steeringAngle -= this.steeringAccel
        } else {
            this.steeringAngle *= this.steeringFriction
        }

        this.steeringAngle = THREE.MathUtils.clamp(this.steeringAngle, -this.maxSteering, this.maxSteering)
        this.mesh.rotation.y += this.steeringAngle

        // 이동 입력
        if (this.input.isKeyPressed("w") || this.input.isKeyPressed("arrowup")) {
            this.mesh.position.add(forward.clone().multiplyScalar(this.moveSpeed))
        }
        if (this.input.isKeyPressed("s") || this.input.isKeyPressed("arrowdown")) {
            this.mesh.position.add(forward.clone().multiplyScalar(-this.moveSpeed))
        }
    }

    public get position(): THREE.Vector3 {
        return this.mesh?.position || new THREE.Vector3()
    }

    public get quaternion(): THREE.Quaternion {
        return this.mesh?.quaternion || new THREE.Quaternion()
    }
}

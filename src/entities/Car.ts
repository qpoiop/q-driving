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

    private groundTracker: GroundTracker | null = null
    private wheels: THREE.Object3D[] = []
    private prevPosition = new THREE.Vector3()
    private currentSpeed = 0

    constructor(private scene: THREE.Scene, private input: InputSystem) {
        this.loadModel()
    }

    private loadModel() {
        gltfLoader.load("/assets/models/car.glb", gltf => {
            this.mesh = gltf.scene
            this.mesh.scale.set(2, 2, 2)
            this.mesh.position.set(0, 0, 0)
            this.scene.add(this.mesh)

            // 바퀴 노드 자동 탐색
            this.mesh.traverse(child => {
                if (child.name.toLowerCase().includes("wheel")) {
                    this.wheels.push(child)
                }
            })

            // 초기 위치 저장
            this.prevPosition.copy(this.mesh.position)
            this.mesh.name = "car" // 디버깅용

            const terrain = this.scene.getObjectByName("terrain")
            if (terrain) {
                this.groundTracker = new GroundTracker(terrain)
            }
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
        const velocity = new THREE.Vector3()
        if (this.input.isKeyPressed("w") || this.input.isKeyPressed("arrowup")) {
            velocity.add(forward.clone().multiplyScalar(this.moveSpeed))
        }
        if (this.input.isKeyPressed("s") || this.input.isKeyPressed("arrowdown")) {
            velocity.add(forward.clone().multiplyScalar(-this.moveSpeed))
        }
        this.mesh.position.add(velocity)

        // 속도 계산
        const distance = this.mesh.position.distanceTo(this.prevPosition)
        this.currentSpeed = distance // 단순한 프레임별 거리
        this.prevPosition.copy(this.mesh.position)

        // 바퀴 회전 (Z축 기준)
        for (const wheel of this.wheels) {
            wheel.rotateX(this.currentSpeed * 10) // 속도에 비례한 회전
        }

        if (this.groundTracker) {
            const y = this.groundTracker.getHeight(this.mesh.position)
            this.mesh.position.y = y + 0.5
        }
    }

    public get position(): THREE.Vector3 {
        return this.mesh?.position || new THREE.Vector3()
    }

    public get quaternion(): THREE.Quaternion {
        return this.mesh?.quaternion || new THREE.Quaternion()
    }
}

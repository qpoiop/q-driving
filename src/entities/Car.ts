import * as THREE from "three"
import { gltfLoader } from "../loaders/glbfLoader"
import { InputSystem } from "../systems/InputSystem"
import { WorldManager } from "../systems/WorldManager"
import { Joystick } from "../ui/Joystick"

export class Car {
    public mesh: THREE.Object3D | null = null

    private acceleration = 0
    private steeringAngle = 0
    private readonly maxSpeed = 1.2
    private readonly accelerationRate = 0.015
    private readonly brakeRate = 0.05
    private readonly steeringAccel = 0.0025
    private readonly maxSteering = 0.035
    private readonly steeringFriction = 0.9
    private readonly rollingFriction = 0.97
    private readonly airResistance = 0.99

    private forward = new THREE.Vector3()
    private velocity = new THREE.Vector3()
    private prevPosition = new THREE.Vector3()
    private smoothedNormal = new THREE.Vector3(0, 1, 0)

    private initial = {
        position: new THREE.Vector3(0, 0.5, -25),
        rotation: new THREE.Euler(0, Math.PI, 0),
        scale: new THREE.Vector3(1.8, 1.8, 1.8),
    }

    private headlights: THREE.SpotLight[] = []

    constructor(private scene: THREE.Scene, private input: InputSystem, private world: WorldManager, private joystick?: Joystick) {}

    public setInitial(config: Partial<typeof this.initial>) {
        if (config.position) this.initial.position.copy(config.position)
        if (config.rotation) this.initial.rotation.copy(config.rotation)
        if (config.scale) this.initial.scale.copy(config.scale)
    }

    public load() {
        gltfLoader.load("/assets/models/car/scene.gltf", gltf => {
            const model = gltf.scene
            model.position.copy(this.initial.position)
            model.scale.copy(this.initial.scale)
            model.rotation.copy(this.initial.rotation)
            model.traverse(obj => (obj.castShadow = true))
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
        const inputX = this.joystick?.getInput().x ?? 0
        const inputY = this.joystick?.getInput().y ?? 0
        const keyLeft = this.input.isKeyPressed("a") || this.input.isKeyPressed("arrowleft")
        const keyRight = this.input.isKeyPressed("d") || this.input.isKeyPressed("arrowright")
        const keyUp = this.input.isKeyPressed("w") || this.input.isKeyPressed("arrowup")
        const keyDown = this.input.isKeyPressed("s") || this.input.isKeyPressed("arrowdown")

        let steer = inputX + (keyLeft ? 1 : keyRight ? -1 : 0)
        const accel = inputY || (keyUp ? -1 : keyDown ? 1 : 0)

        this.steeringAngle += steer * this.steeringAccel
        this.steeringAngle *= this.steeringFriction
        this.steeringAngle = THREE.MathUtils.clamp(this.steeringAngle, -this.maxSteering, this.maxSteering)
        this.mesh.rotation.y += this.steeringAngle

        if (accel < -0.2) this.acceleration += this.accelerationRate
        else if (accel > 0.2) this.acceleration -= this.brakeRate
        else this.acceleration *= this.rollingFriction * this.airResistance

        this.acceleration = THREE.MathUtils.clamp(this.acceleration, -this.maxSpeed * 0.7, this.maxSpeed)
        this.velocity.copy(this.forward).multiplyScalar(this.acceleration)

        const next = this.mesh.position.clone().add(this.velocity)
        if (!this.world.isColliding(next)) {
            const y = this.world.getHeightAt(next)
            next.y = THREE.MathUtils.lerp(this.mesh.position.y, y + 0.3, 0.4)
            this.mesh.position.copy(next)
        }

        const rawNormal = this.world.getNormalAt(this.mesh.position)
        this.smoothedNormal.lerp(rawNormal, 0.1)
        const right = new THREE.Vector3().crossVectors(this.smoothedNormal, this.forward).normalize()
        const correctedForward = new THREE.Vector3().crossVectors(right, this.smoothedNormal).normalize()
        const m = new THREE.Matrix4().makeBasis(right, this.smoothedNormal, correctedForward)
        const q = new THREE.Quaternion().setFromRotationMatrix(m)
        this.mesh.quaternion.slerp(q, 0.1)

        this.prevPosition.copy(this.mesh.position)
    }

    private setupHeadlights() {
        const lightL = new THREE.SpotLight(0xffffff, 5, 100, Math.PI / 10, 0.5)
        const lightR = new THREE.SpotLight(0xffffff, 5, 100, Math.PI / 10, 0.5)
        lightL.castShadow = true
        lightR.castShadow = true
        lightL.position.set(-0.6, 0.3, 1.4)
        lightR.position.set(0.6, 0.3, 1.4)
        const targetL = new THREE.Object3D()
        const targetR = new THREE.Object3D()
        targetL.position.set(-0.6, 0.1, 10)
        targetR.position.set(0.6, 0.1, 10)
        this.mesh!.add(lightL, lightR, targetL, targetR)
        lightL.target = targetL
        lightR.target = targetR
        this.headlights.push(lightL, lightR)
    }

    public toggleLights(on: boolean) {
        this.headlights.forEach(light => (light.visible = on))
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

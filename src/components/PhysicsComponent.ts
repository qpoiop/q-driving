import * as THREE from "three"
import { Component } from "../core/Component"
import { TransformComponent } from "./TransformComponent"

export interface PhysicsConfig {
    mass: number
    drag: number
    maxSpeed: number
    acceleration: number
    deceleration: number
    grip: number
    turnSpeed: number
}

export class PhysicsComponent extends Component {
    private velocity: THREE.Vector3
    private acceleration: number
    private config: PhysicsConfig
    private currentGrip: number
    private currentTurnSpeed: number

    constructor(config: PhysicsConfig) {
        super("physics")
        this.velocity = new THREE.Vector3()
        this.acceleration = 0
        this.config = config
        this.currentGrip = config.grip
        this.currentTurnSpeed = config.turnSpeed
    }

    public getVelocity(): THREE.Vector3 {
        return this.velocity.clone()
    }

    public setVelocity(velocity: THREE.Vector3): void {
        this.velocity.copy(velocity)
    }

    public setGrip(grip: number): void {
        this.currentGrip = grip
    }

    public setTurnSpeed(turnSpeed: number): void {
        this.currentTurnSpeed = turnSpeed
    }

    public applyForce(force: THREE.Vector3, deltaTime: number): void {
        const acceleration = force.divideScalar(this.config.mass)
        this.velocity.add(acceleration.multiplyScalar(deltaTime))

        // 최대 속도 제한
        if (this.velocity.length() > this.config.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.config.maxSpeed)
        }

        // 항력 및 그립 적용
        const dragForce = this.velocity.clone().multiplyScalar(-this.config.drag * this.currentGrip)
        this.velocity.add(dragForce.multiplyScalar(deltaTime))
    }

    public override update(deltaTime: number): void {
        const position = this.entity?.getComponent<TransformComponent>("transform")?.getPosition()
        if (!position) return

        const newPosition = position.clone().add(this.velocity.clone().multiplyScalar(deltaTime))
        this.entity?.getComponent<TransformComponent>("transform")?.setPosition(newPosition.x, newPosition.y, newPosition.z)
    }

    public override dispose(): void {
        this.velocity.set(0, 0, 0)
    }
}

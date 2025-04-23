import * as THREE from "three"
import { Component } from "../core/Component"
import { TransformComponent } from "./TransformComponent"
import { InputComponent } from "./InputComponent"
import { SuspensionComponent } from "./SuspensionComponent"

export interface PhysicsConfig {
    mass: number
    drag: number
    maxSpeed: number
    acceleration: number
    deceleration: number
    grip: number
    turnSpeed: number
    momentOfInertia: number
    torqueCurve: number[]
    gearRatios: number[]
    tireFriction: number
    aerodynamicDrag: number
    liftCoefficient: number
    frontWheelDrive: boolean
    rearWheelDrive: boolean
    allWheelDrive: boolean
    rollingResistanceCoefficient: number
    backwardAccelerationFactor: number
    tireStiffnessMultiplier: number
}

// Define ZERO_VECTOR constant
const ZERO_VECTOR = new THREE.Vector3(0, 0, 0)

export class PhysicsComponent extends Component {
    private velocity: THREE.Vector3
    private angularVelocity: THREE.Vector3
    private acceleration: number
    private config: PhysicsConfig
    private currentGrip: number
    private currentTurnSpeed: number
    private currentGear: number
    private rpm: number
    private wheelSlip: number

    // Temporary calculation vectors
    private _tempForce = new THREE.Vector3()
    private _tempAccel = new THREE.Vector3()
    private _tempVehicleForward = new THREE.Vector3()
    private _tempMoveDirection = new THREE.Vector3()
    private _tempVelocityClone = new THREE.Vector3()
    private _tempDriveForce = new THREE.Vector3()
    private _tempBrakeForce = new THREE.Vector3()
    private _tempDecelForce = new THREE.Vector3() // For natural deceleration
    private _tempSuspensionSum = new THREE.Vector3()
    private _tempAeroForce = new THREE.Vector3()
    private _tempTireForce = new THREE.Vector3()
    private _tempDragForce = new THREE.Vector3()
    private _tempGravityForce = new THREE.Vector3()
    private _tempRotationAxis = new THREE.Vector3()
    private _tempComposeScale = new THREE.Vector3()
    private _tempWheelWorldPos = new THREE.Vector3()
    private _tempRollingResistance = new THREE.Vector3()
    private _tempCollisionImpulse = new THREE.Vector3() // For collision response

    constructor(config: PhysicsConfig) {
        super("physics")
        this.velocity = new THREE.Vector3()
        this.angularVelocity = new THREE.Vector3()
        this.acceleration = 0
        // Apply tuned default values if specific values are missing or zero
        this.config = {
            ...config,
            drag: config.drag || 0.45, // Tuned value
            deceleration: config.deceleration || 15.0, // Tuned value
            tireFriction: config.tireFriction || 1.2, // Tuned value
            aerodynamicDrag: config.aerodynamicDrag || 0.8, // Tuned value
            rollingResistanceCoefficient: config.rollingResistanceCoefficient || 0.02, // Tuned value
            tireStiffnessMultiplier: config.tireStiffnessMultiplier || 150, // Tuned value
        }
        this.currentGrip = this.config.grip
        this.currentTurnSpeed = this.config.turnSpeed
        this.currentGear = 1
        this.rpm = 0
        this.wheelSlip = 0
    }

    public override async initialize(): Promise<void> {}

    public getVelocity(): THREE.Vector3 {
        return this.velocity.clone() // Return clone to prevent external modification
    }

    public setVelocity(velocity: THREE.Vector3): void {
        if (velocity.lengthSq() > this.config.maxSpeed * this.config.maxSpeed * 1.1) {
            // Add slight buffer
            // Clamp velocity if trying to set above max speed
            this.velocity.copy(velocity).normalize().multiplyScalar(this.config.maxSpeed)
        } else {
            this.velocity.copy(velocity)
        }
    }

    public getAngularVelocity(): THREE.Vector3 {
        return this.angularVelocity.clone()
    }

    public setAngularVelocity(angularVelocity: THREE.Vector3): void {
        this.angularVelocity.copy(angularVelocity)
    }

    // Getter for mass
    public getMass(): number {
        // Ensure config exists before accessing mass
        if (!this.config) {
            console.error("PhysicsComponent: Config not initialized when getting mass!")
            return 1 // Return a default mass or handle error appropriately
        }
        return this.config.mass
    }

    // Method to apply an impulse (e.g., from collision)
    public applyImpulse(impulse: THREE.Vector3): void {
        if (!this.config.mass || this.config.mass <= 0) return // Need mass > 0
        // dv = impulse / mass
        const deltaV = this._tempCollisionImpulse.copy(impulse).divideScalar(this.config.mass)
        this.velocity.add(deltaV)

        // Clamp velocity after impulse if it exceeds max speed
        if (this.velocity.lengthSq() > this.config.maxSpeed * this.config.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.config.maxSpeed)
        }
    }

    public setGrip(grip: number): void {
        this.currentGrip = grip
    }

    public setTurnSpeed(turnSpeed: number): void {
        this.currentTurnSpeed = turnSpeed
    }

    public calculateTorque(): number {
        const rpmIndex = Math.min(Math.floor(this.rpm / 1000), this.config.torqueCurve.length - 1)
        return this.config.torqueCurve[rpmIndex] * this.config.gearRatios[this.currentGear]
    }

    /**
     * 공기 역학적 힘(항력 및 양력)을 계산합니다.
     * @returns {THREE.Vector3} 공기 역학적 힘 벡터
     */
    public calculateAerodynamicForces(): THREE.Vector3 {
        const speed = this.velocity.length()
        const speedSq = speed * speed
        const dragForce = this.velocity
            .clone()
            .normalize()
            .multiplyScalar(-this.config.aerodynamicDrag * speedSq)
        const liftForce = new THREE.Vector3(0, -this.config.liftCoefficient * speedSq, 0)
        return this._tempAeroForce.copy(dragForce).add(liftForce) // Reuse temp vector
    }

    /**
     * 타이어의 측면 힘(횡력)을 계산합니다. 차량의 측면 미끄러짐을 억제합니다.
     * @param {THREE.Vector3} vehicleForward 차량 전방 벡터
     * @param {THREE.Vector3} vehicleRight 차량 우측 벡터
     * @param {THREE.Vector3} vehicleUp 차량 상단 벡터 (현재 미사용)
     * @returns {THREE.Vector3} 타이어 측면 힘 벡터
     */
    public calculateTireForces(vehicleForward: THREE.Vector3, vehicleRight: THREE.Vector3, vehicleUp: THREE.Vector3): THREE.Vector3 {
        const speed = this.velocity.length()
        if (speed < 0.1) return this._tempTireForce.set(0, 0, 0)

        const lateralVelocity = this.velocity.dot(vehicleRight)
        const lateralSlipFactor = -lateralVelocity
        const tireStiffness = this.config.tireFriction * this.config.tireStiffnessMultiplier
        let lateralForceMagnitude = lateralSlipFactor * tireStiffness
        const gripReduction = 1.0 - Math.min(1, speed / (this.config.maxSpeed * 1.5))
        lateralForceMagnitude *= 0.5 + gripReduction * 0.5
        const maxLateralForce = this.config.mass * 9.81 * this.config.tireFriction
        lateralForceMagnitude = THREE.MathUtils.clamp(lateralForceMagnitude, -maxLateralForce, maxLateralForce)
        if (isNaN(lateralForceMagnitude)) lateralForceMagnitude = 0
        return this._tempTireForce.copy(vehicleRight).multiplyScalar(lateralForceMagnitude)
    }

    public override update(deltaTime: number): void {
        const transform = this.entity?.getComponent<TransformComponent>("transform")
        const input = this.entity?.getComponent<InputComponent>("input")
        const suspension = this.entity?.getComponent<SuspensionComponent>("suspension")

        if (!transform || !input || !suspension) return

        const vehicleQuaternion = transform.getQuaternion()
        this._tempVehicleForward.set(0, 0, 1).applyQuaternion(vehicleQuaternion)
        const vehicleRight = this._tempRotationAxis.set(1, 0, 0).applyQuaternion(vehicleQuaternion) // Reuse temp vector
        const vehicleUp = this._tempSuspensionSum.set(0, 1, 0).applyQuaternion(vehicleQuaternion) // Reuse temp vector

        const direction = input.getMovementDirection()
        this._tempVelocityClone.copy(this.velocity)
        const currentSpeedSq = this._tempVelocityClone.lengthSq()
        const localZVelocity = this._tempVelocityClone.dot(this._tempVehicleForward)

        // Drive Force
        this._tempDriveForce.set(0, 0, 0)
        if (!input.isBraking()) {
            if (direction.z > 0) {
                this._tempDriveForce.copy(this._tempVehicleForward).multiplyScalar(this.config.acceleration)
            } else if (direction.z < 0) {
                this._tempDriveForce.copy(this._tempVehicleForward).multiplyScalar(-this.config.acceleration * this.config.backwardAccelerationFactor)
            }
        }

        // Brake Force
        this._tempBrakeForce.set(0, 0, 0)
        const isOppositeDirection = (direction.z > 0 && localZVelocity < -0.1) || (direction.z < 0 && localZVelocity > 0.1)
        const shouldBrake = input.isBraking() || (isOppositeDirection && currentSpeedSq > 0.1)
        if (shouldBrake) {
            const brakeStrength = input.isBraking() ? this.config.deceleration : this.config.deceleration * 1.5
            if (currentSpeedSq > 0.01) {
                this._tempBrakeForce.copy(this._tempVelocityClone).normalize().multiplyScalar(-brakeStrength)
            }
        }

        // Natural Deceleration Force (when not accelerating/braking)
        this._tempDecelForce.set(0, 0, 0)
        if (direction.z === 0 && !input.isBraking() && currentSpeedSq > 0.01) {
            this._tempDecelForce
                .copy(this._tempVelocityClone)
                .normalize()
                .multiplyScalar(-this.config.deceleration * 0.5) // Adjust factor as needed
        }

        // Suspension Forces
        const suspensionForces = suspension.getWheelForces()
        this._tempSuspensionSum.set(0, 0, 0)
        for (const force of suspensionForces) {
            this._tempSuspensionSum.add(force)
        }

        // Aerodynamic Forces
        this.calculateAerodynamicForces() // Result stored in this._tempAeroForce

        // Tire Lateral Force
        this.calculateTireForces(this._tempVehicleForward, vehicleRight, vehicleUp) // Result stored in this._tempTireForce

        // Drag Force (always applied)
        this._tempDragForce.set(0, 0, 0)
        if (currentSpeedSq > 0.01) {
            this._tempDragForce.copy(this._tempVelocityClone).multiplyScalar(-this.config.drag)
        }

        // Gravity Force
        const gravity = 9.81
        this._tempGravityForce.set(0, -gravity * this.config.mass, 0)

        // Rolling Resistance
        this._tempRollingResistance.set(0, 0, 0)
        if (currentSpeedSq > 0.01) {
            const normalForce = this.config.mass * gravity // Approximation
            const rollingResistanceMag = this.config.rollingResistanceCoefficient * normalForce
            this._tempRollingResistance.copy(this._tempVelocityClone).normalize().multiplyScalar(-rollingResistanceMag)
        }

        // Sum Forces
        this._tempForce
            .set(0, 0, 0)
            .add(this._tempDriveForce)
            .add(this._tempBrakeForce)
            .add(this._tempDecelForce) // Add natural deceleration
            .add(this._tempSuspensionSum)
            .add(this._tempAeroForce)
            .add(this._tempTireForce)
            .add(this._tempDragForce)
            .add(this._tempGravityForce)
            .add(this._tempRollingResistance)

        // Apply Force -> Acceleration -> Velocity
        this._tempAccel.copy(this._tempForce).divideScalar(this.config.mass)
        this.velocity.addScaledVector(this._tempAccel, deltaTime)

        // Clamp velocity to max speed
        if (this.velocity.lengthSq() > this.config.maxSpeed * this.config.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.config.maxSpeed)
        }
        // If speed is very low and no input, stop completely to prevent creeping
        if (currentSpeedSq < 0.01 && direction.x === 0 && direction.z === 0 && !input.isBraking()) {
            this.velocity.set(0, 0, 0)
        }

        // Angular Velocity (simplified turning logic)
        const turnFactor = THREE.MathUtils.clamp(this.velocity.length() / (this.config.maxSpeed * 0.3), 0, 1) // Less turning power at low speed
        const effectiveTurnSpeed = this.currentTurnSpeed * turnFactor
        this.angularVelocity.y = -direction.x * effectiveTurnSpeed * deltaTime

        // Apply Velocity and Angular Velocity to Transform
        transform.translateZ(this.velocity.z * deltaTime) // Assumes forward is local Z
        transform.translateX(this.velocity.x * deltaTime) // Assumes right is local X
        transform.translateY(this.velocity.y * deltaTime)
        transform.rotateY(this.angularVelocity.y) // Assumes Y is the rotation axis

        // Update RPM, Gear, etc. (simplified)
        this.rpm = this.velocity.length() * 60 // Very rough estimate
        // Simple gear logic placeholder
        if (this.rpm > 6000 && this.currentGear < this.config.gearRatios.length - 1) {
            this.currentGear++
        } else if (this.rpm < 2000 && this.currentGear > 1) {
            this.currentGear--
        }
    }

    public override dispose(): void {
        this.velocity.set(0, 0, 0)
        this.angularVelocity.set(0, 0, 0)
    }
}

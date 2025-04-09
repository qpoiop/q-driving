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
}

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

    // Temporary calculation vectors to reduce GC pressure
    private _tempForce = new THREE.Vector3()
    private _tempAccel = new THREE.Vector3()
    private _tempVehicleForward = new THREE.Vector3()
    private _tempMoveDirection = new THREE.Vector3()
    private _tempVelocityClone = new THREE.Vector3()
    // Add more temp vectors
    private _tempDriveForce = new THREE.Vector3()
    private _tempBrakeForce = new THREE.Vector3()
    private _tempSuspensionSum = new THREE.Vector3()
    private _tempAeroForce = new THREE.Vector3()
    private _tempTireForce = new THREE.Vector3()
    private _tempDragForce = new THREE.Vector3()
    private _tempGravityForce = new THREE.Vector3()
    private _tempRotationAxis = new THREE.Vector3()
    private _tempComposeScale = new THREE.Vector3()
    private _tempWheelWorldPos = new THREE.Vector3()

    constructor(config: PhysicsConfig) {
        super("physics")
        this.velocity = new THREE.Vector3()
        this.angularVelocity = new THREE.Vector3()
        this.acceleration = 0
        this.config = config
        this.currentGrip = config.grip
        this.currentTurnSpeed = config.turnSpeed
        this.currentGear = 1
        this.rpm = 0
        this.wheelSlip = 0
    }

    public override async initialize(): Promise<void> {}

    public getVelocity(): THREE.Vector3 {
        return this.velocity.clone()
    }

    public setVelocity(velocity: THREE.Vector3): void {
        this.velocity.copy(velocity)
    }

    public getAngularVelocity(): THREE.Vector3 {
        return this.angularVelocity.clone()
    }

    public setAngularVelocity(angularVelocity: THREE.Vector3): void {
        this.angularVelocity.copy(angularVelocity)
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

    public calculateAerodynamicForces(): THREE.Vector3 {
        const speed = this.velocity.length()
        const dragForce = this.velocity
            .clone()
            .normalize()
            .multiplyScalar(-this.config.aerodynamicDrag * speed * speed)
        const liftForce = new THREE.Vector3(0, -this.config.liftCoefficient * speed * speed, 0)
        return dragForce.add(liftForce)
    }

    public calculateTireForces(direction: THREE.Vector3, vehicleForward: THREE.Vector3): THREE.Vector3 {
        // Restore original logic with added safety checks
        const speed = this.velocity.length()
        if (speed < 0.01) return new THREE.Vector3() // Return zero force at very low speeds

        // Ensure direction components are valid numbers
        const dirX = Number.isFinite(direction.x) ? direction.x : 0
        const dirZ = Number.isFinite(direction.z) ? direction.z : 0

        // Avoid division by zero or instability when velocity components are near zero
        const velX = Math.abs(this.velocity.x) < 1e-6 ? 0 : this.velocity.x
        const velZ = Math.abs(this.velocity.z) < 1e-6 ? 0 : this.velocity.z

        // Calculate angles safely
        const velocityAngle = Math.atan2(velX, velZ)
        const directionAngle = Math.atan2(dirX, dirZ)

        // Check for NaN angles which might occur if inputs are still problematic
        if (isNaN(velocityAngle) || isNaN(directionAngle)) {
            console.warn("[Physics] NaN detected in tire force angle calculation.")
            return new THREE.Vector3() // Return zero force if angles are invalid
        }

        let slipAngle = velocityAngle - directionAngle

        // Normalize slip angle to be within -PI to PI
        while (slipAngle > Math.PI) slipAngle -= 2 * Math.PI
        while (slipAngle < -Math.PI) slipAngle += 2 * Math.PI

        this.wheelSlip = Math.abs(slipAngle)

        // Calculate grip factor safely
        const gripFactor = Math.max(0, 1 - this.wheelSlip / (Math.PI / 2)) // Use PI/2 as max slip angle denominator? Or tune.
        if (isNaN(gripFactor)) {
            console.warn("[Physics] NaN detected in grip factor calculation.")
            return new THREE.Vector3() // Return zero force if grip factor is invalid
        }

        // Apply force in the direction the wheels are pointing (use the input direction)
        const forceDirection = direction.lengthSq() > 0 ? direction.clone().normalize() : vehicleForward.clone()
        if (!forceDirection || forceDirection.lengthSq() === 0 || isNaN(forceDirection.x)) {
            console.warn("[Physics] Invalid forceDirection in tire calculation.")
            return new THREE.Vector3()
        }

        const tireForceMagnitude = this.config.tireFriction * gripFactor * speed
        if (isNaN(tireForceMagnitude)) {
            console.warn("[Physics] NaN detected in tire force magnitude calculation.")
            return new THREE.Vector3()
        }

        return forceDirection.multiplyScalar(tireForceMagnitude)
    }

    public override update(deltaTime: number): void {
        // Remove previous detailed velocity logs and deltaTime clamping

        const transform = this.entity?.getComponent<TransformComponent>("transform")
        const input = this.entity?.getComponent<InputComponent>("input")
        const suspension = this.entity?.getComponent<SuspensionComponent>("suspension")

        if (!transform || !input || !suspension) return

        // --- 1. Calculate Forces (Use temp vectors where possible) ---
        const direction = input.getMovementDirection()
        this._tempMoveDirection.set(direction.x, 0, direction.z) // Use temp vector

        this._tempVehicleForward.set(0, 0, 1).applyQuaternion(transform.getQuaternion()) // Use temp vector
        this._tempVelocityClone.copy(this.velocity) // Use temp vector

        // Drive Force (Use temp vector)
        this._tempDriveForce.set(0, 0, 0) // Reset
        if (this._tempMoveDirection.z > 0 && !input.isBraking()) {
            this._tempDriveForce.copy(this._tempVehicleForward).multiplyScalar(this.config.acceleration)
        } else if (this._tempMoveDirection.z < 0 && !input.isBraking()) {
            this._tempDriveForce.copy(this._tempVehicleForward).multiplyScalar(-this.config.deceleration * 0.5)
        }

        // Brake Force (Use temp vector)
        this._tempBrakeForce.set(0, 0, 0) // Reset
        if (input.isBraking()) {
            if (this._tempVelocityClone.lengthSq() > 0.01) {
                this._tempBrakeForce.copy(this._tempVelocityClone).normalize().multiplyScalar(-this.config.deceleration)
            }
        }

        // Suspension Forces (Optimize reduce)
        const suspensionForces = suspension.getWheelForces()
        this._tempSuspensionSum.set(0, 0, 0) // Reset
        for (const force of suspensionForces) {
            this._tempSuspensionSum.add(force)
        }

        // Aerodynamic Forces (Use temp vector, but calculateAerodynamicForces needs refactoring)
        // For now, keep original call which creates vectors internally
        this._tempAeroForce.copy(this.calculateAerodynamicForces()) // Copy result to temp

        // Tire Forces (Use temp vector, but calculateTireForces needs refactoring)
        if (this._tempMoveDirection.lengthSq() > 0) {
            this._tempMoveDirection.normalize()
        }
        this._tempTireForce.copy(this.calculateTireForces(this._tempMoveDirection, this._tempVehicleForward)) // Copy result to temp

        // Drag Force (Use temp vector)
        this._tempDragForce.set(0, 0, 0) // Reset
        if (this._tempVelocityClone.lengthSq() > 0.01) {
            this._tempDragForce.copy(this._tempVelocityClone).multiplyScalar(-this.config.drag * this.currentGrip)
        }

        // Gravity Force (Use temp vector)
        this._tempGravityForce.set(0, -9.81 * this.config.mass, 0)

        // --- 2. Sum Forces (Use _tempForce and other temp forces) ---
        this._tempForce
            .copy(this._tempDriveForce)
            .add(this._tempBrakeForce)
            .add(this._tempSuspensionSum)
            .add(this._tempAeroForce)
            .add(this._tempTireForce)
            .add(this._tempDragForce)
            .add(this._tempGravityForce)

        // --- 3. Update Velocity & Angular Velocity (Use _tempAccel) ---
        this._tempAccel.copy(this._tempForce).divideScalar(this.config.mass) // Use temp vector
        this.velocity.add(this._tempAccel.multiplyScalar(deltaTime))

        // Calculate Angular Velocity (Rotation) - Corrected for Linter and Logic
        let targetAngularVelocityY = 0
        if (direction.x !== 0 && this._tempVelocityClone.length() > 0.1) {
            const steeringInput = direction.x // Directly use the input value (-1 to 1)

            // Simple proportional control for target angular velocity (yaw)
            // Adjust the multiplier (this.currentTurnSpeed * some_factor) to tune steering sensitivity
            const speedFactor = Math.min(1, this._tempVelocityClone.length() / 10) // Speed influence (tune the denominator)
            // Ensure currentTurnSpeed is used from the potentially updated config/state
            targetAngularVelocityY = -steeringInput * this.currentTurnSpeed * speedFactor * (Math.PI / 2)
        } else {
            // Dampen angular velocity if no steering input or moving too slow
            this.angularVelocity.y *= 0.9 // Apply damping only to yaw
            targetAngularVelocityY = this.angularVelocity.y // Target the damped velocity
        }
        // Smoothly interpolate towards target angular velocity (only for yaw) - Reduced lerp factor
        this.angularVelocity.y = THREE.MathUtils.lerp(this.angularVelocity.y, targetAngularVelocityY, 0.05)
        // Ensure other angular velocity components are zero or handled elsewhere if needed
        this.angularVelocity.x = 0
        this.angularVelocity.z = 0

        // Max Speed Limit - More stable implementation
        const speedSq = this.velocity.lengthSq()
        const maxSpeedSq = this.config.maxSpeed * this.config.maxSpeed
        if (speedSq > maxSpeedSq) {
            const correctionFactor = Math.sqrt(maxSpeedSq / speedSq)
            this.velocity.multiplyScalar(correctionFactor)
        }

        // --- 4. Predict Next Position & Rotation (Use temp vector for delta) ---
        // Re-use _tempAccel for positionDelta to avoid new Vector3
        const positionDelta = this._tempAccel.copy(this.velocity).multiplyScalar(deltaTime)
        const nextPosition = transform.getPosition().add(positionDelta)

        // Calculate rotation delta using Quaternion for stability
        const rotationDelta = new THREE.Quaternion().setFromAxisAngle(
            // Use temp axis vector
            this._tempRotationAxis.set(0, 1, 0),
            this.angularVelocity.y * deltaTime,
        )
        const nextRotation = transform.getQuaternion().clone().multiply(rotationDelta) // Keep clone here for now
        nextRotation.normalize()

        // --- 5. Ground Constraint (Use temp vector) ---
        let maxPenetration = 0
        const terrain = suspension.getTerrain() // Terrain 객체 가져오기
        const wheels = suspension.getWheels() // SuspensionComponent에서 바퀴 설정 가져오기

        if (terrain && wheels.length > 0) {
            // Use temp scale vector
            const worldMatrix = new THREE.Matrix4().compose(nextPosition, nextRotation, this._tempComposeScale.set(1, 1, 1))

            for (const wheel of wheels) {
                // Use temp wheel position vector
                const wheelWorldPos = this._tempWheelWorldPos.copy(wheel.position).applyMatrix4(worldMatrix)
                // Call getHeightAt with x, y, and z arguments
                const terrainHeight = terrain.getHeightAt(wheelWorldPos.x, wheelWorldPos.y, wheelWorldPos.z)

                // Calculate penetration considering wheel radius
                const targetWheelY = terrainHeight + wheel.radius // Target height for the wheel center
                const penetration = targetWheelY - wheelWorldPos.y // Positive if wheel is below target

                if (penetration > maxPenetration) {
                    maxPenetration = penetration
                }
            }

            if (maxPenetration > 0) {
                // Adjust vehicle Y position based on max penetration
                nextPosition.y += maxPenetration
                // Remove velocity damping on collision to allow natural settling
                /* if (this.velocity.y < 0) {
                    this.velocity.y *= 0.1 // Adjust damping factor as needed
                } */
            }
        }

        // --- 6. Update Transform (Convert Quaternion to Euler, Euler creation ok here) ---
        transform.setPosition(nextPosition.x, nextPosition.y, nextPosition.z) // Use correct arguments

        // Convert Quaternion back to Euler for TransformComponent's setRotation
        const nextEuler = new THREE.Euler().setFromQuaternion(nextRotation, "YXZ") // Match expected order? Adjust if needed
        transform.setRotation(nextEuler) // Use setRotation with Euler angles
    }

    public override dispose(): void {
        this.velocity.set(0, 0, 0)
        this.angularVelocity.set(0, 0, 0)
    }
}

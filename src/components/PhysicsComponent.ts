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

    public calculateTireForces(vehicleForward: THREE.Vector3, vehicleRight: THREE.Vector3, vehicleUp: THREE.Vector3): THREE.Vector3 {
        const speed = this.velocity.length()
        // 저속에서는 측면 힘 거의 없음
        if (speed < 0.2) return this._tempTireForce.set(0, 0, 0)

        // 로컬 측면 속도 계산 (월드 속도를 차량의 오른쪽 벡터에 투영)
        const lateralVelocity = this.velocity.dot(vehicleRight)

        // 측면 슬립 각도 근사치 계산 (측면 속도에 비례하는 복원력 가정)
        const lateralSlipFactor = -lateralVelocity

        // 타이어 측면 강성 (튜닝 필요)
        const tireStiffness = this.config.tireFriction * 50 // 예시 값

        // 측면 힘 계산 (로컬 X축 방향 힘의 크기)
        let lateralForceMagnitude = lateralSlipFactor * tireStiffness

        // 속도에 따른 그립 감소 (간단화)
        const gripReduction = 1.0 - Math.min(1, speed / (this.config.maxSpeed * 1.5))
        lateralForceMagnitude *= 0.5 + gripReduction * 0.5

        // 너무 강한 힘 제한 (튜닝 필요)
        lateralForceMagnitude = THREE.MathUtils.clamp(lateralForceMagnitude, -this.config.mass * 5, this.config.mass * 5)

        if (isNaN(lateralForceMagnitude)) lateralForceMagnitude = 0

        // 최종 측면 힘 벡터 (월드 좌표계)
        return this._tempTireForce.copy(vehicleRight).multiplyScalar(lateralForceMagnitude)
    }

    public override update(deltaTime: number): void {
        const transform = this.entity?.getComponent<TransformComponent>("transform")
        const input = this.entity?.getComponent<InputComponent>("input")
        const suspension = this.entity?.getComponent<SuspensionComponent>("suspension")

        if (!transform || !input || !suspension) return

        console.log("velocity", this.velocity)

        // --- 1. Calculate Vehicle Basis Vectors ---
        const vehicleQuaternion = transform.getQuaternion()
        this._tempVehicleForward.set(0, 0, 1).applyQuaternion(vehicleQuaternion)
        const vehicleRight = new THREE.Vector3(1, 0, 0).applyQuaternion(vehicleQuaternion)
        const vehicleUp = new THREE.Vector3(0, 1, 0).applyQuaternion(vehicleQuaternion)

        // --- 2. Calculate Forces ---
        const direction = input.getMovementDirection() // {x, z} local input
        this._tempVelocityClone.copy(this.velocity)
        const currentSpeedSq = this._tempVelocityClone.lengthSq()
        const localZVelocity = this._tempVelocityClone.dot(this._tempVehicleForward)

        // Drive Force (로컬 Z축 기준)
        this._tempDriveForce.set(0, 0, 0)
        if (!input.isBraking()) {
            if (direction.z > 0) {
                // Forward input
                this._tempDriveForce.copy(this._tempVehicleForward).multiplyScalar(this.config.acceleration)
            } else if (direction.z < 0) {
                // Backward input
                this._tempDriveForce.copy(this._tempVehicleForward).multiplyScalar(-this.config.acceleration * 0.5) // 약한 후진
            }
        }

        // Brake Force (방향 전환 제동 포함)
        this._tempBrakeForce.set(0, 0, 0)
        const isOppositeDirection = (direction.z > 0 && localZVelocity < -0.1) || (direction.z < 0 && localZVelocity > 0.1)
        const shouldBrake = input.isBraking() || (isOppositeDirection && currentSpeedSq > 0.1)

        if (shouldBrake) {
            const brakeStrength = input.isBraking() ? this.config.deceleration : this.config.deceleration * 1.5 // 방향 전환 시 더 강하게
            if (currentSpeedSq > 0.01) {
                this._tempBrakeForce.copy(this._tempVelocityClone).normalize().multiplyScalar(-brakeStrength)
            } else if (currentSpeedSq > 1e-6) {
                // 속도가 아주 작을 때 정지 유도
                // 힘 대신 직접 속도 감쇠 적용 (더 안정적일 수 있음)
                this.velocity.multiplyScalar(Math.max(0, 1 - ((brakeStrength / this.config.mass) * deltaTime) / this.velocity.length()))
            }
        }

        // Suspension Forces (기존 유지)
        const suspensionForces = suspension.getWheelForces()
        this._tempSuspensionSum.set(0, 0, 0)
        for (const force of suspensionForces) {
            this._tempSuspensionSum.add(force)
        }

        // Aerodynamic Forces (기존 유지)
        this._tempAeroForce.copy(this.calculateAerodynamicForces())

        // Tire Lateral Force (수정된 함수 호출)
        this._tempTireForce.copy(this.calculateTireForces(this._tempVehicleForward, vehicleRight, vehicleUp))

        // Drag Force (기존 유지)
        this._tempDragForce.set(0, 0, 0)
        if (currentSpeedSq > 0.01) {
            // Use currentSpeedSq here
            this._tempDragForce.copy(this._tempVelocityClone).multiplyScalar(-this.config.drag * this.currentGrip)
        }

        // Gravity Force (기존 유지)
        this._tempGravityForce.set(0, -9.81 * this.config.mass, 0)

        // --- 3. Sum Forces ---
        this._tempForce
            .set(0, 0, 0)
            .add(this._tempDriveForce)
            .add(this._tempBrakeForce) // 브레이크 로직에서 직접 속도를 변경했다면 이 힘은 0일 수 있음
            .add(this._tempSuspensionSum)
            .add(this._tempAeroForce)
            .add(this._tempTireForce) // 측면 힘
            .add(this._tempDragForce)
            .add(this._tempGravityForce)

        // (로그 유지)
        console.log("this._tempDriveForce", this._tempDriveForce)
        console.log("this._tempBrakeForce", this._tempBrakeForce)
        console.log("this._tempSuspensionSum", this._tempSuspensionSum)
        console.log("this._tempAeroForce", this._tempAeroForce)
        console.log("this._tempTireForce(Lateral)", this._tempTireForce)
        console.log("this._tempDragForce", this._tempDragForce)
        console.log("this._tempGravityForce", this._tempGravityForce)
        console.log("this._tempForce Sum", this._tempForce)

        // --- 4. Update Velocity & Angular Velocity ---
        this._tempAccel.copy(this._tempForce).divideScalar(this.config.mass)
        // 브레이크 로직에서 속도를 직접 변경하지 않았다면 여기서 힘을 적용
        if (!shouldBrake || currentSpeedSq > 0.01) {
            // 브레이크 힘으로 감속하는 경우
            this.velocity.add(this._tempAccel.multiplyScalar(deltaTime))
        }

        // Angular Velocity (방향 전환 시 각속도 영향 감소 고려)
        let targetAngularVelocityY = 0
        const speedForSteering = this.velocity.length()
        const steeringInput = direction.x

        if (steeringInput !== 0 && speedForSteering > 0.1) {
            const speedFactor = Math.min(1, speedForSteering / 10)
            // 방향 전환 중(isOppositeDirection)이거나 핸드브레이크 사용 시 회전율 증가 (튜닝 필요)
            const turnMultiplier = input.isHandbraking() || isOppositeDirection ? 1.5 : 1.0
            targetAngularVelocityY = -steeringInput * this.currentTurnSpeed * speedFactor * turnMultiplier * (Math.PI / 2)
        } else {
            targetAngularVelocityY = this.angularVelocity.y * 0.9 // Dampen
        }
        this.angularVelocity.y = THREE.MathUtils.lerp(this.angularVelocity.y, targetAngularVelocityY, 0.1) // Lerp 값 약간 증가 (0.05 -> 0.1)
        this.angularVelocity.x = 0
        this.angularVelocity.z = 0

        // 최종 정지 처리 (임계값 유지 또는 약간 조정)
        const absoluteStopSpeedSqThreshold = 0.01 * 0.01
        if (this.velocity.lengthSq() < absoluteStopSpeedSqThreshold && this.angularVelocity.lengthSq() < 0.001) {
            this.velocity.set(0, 0, 0)
            this.angularVelocity.set(0, 0, 0)
            console.log("Final Stop Applied")
        }

        // --- 5. Max Speed Limit ---
        const speedSq = this.velocity.lengthSq()
        const maxSpeedSq = this.config.maxSpeed * this.config.maxSpeed
        if (speedSq > maxSpeedSq) {
            const correctionFactor = Math.sqrt(maxSpeedSq / speedSq)
            this.velocity.multiplyScalar(correctionFactor)
        }

        // --- 6. Predict Next Position & Rotation (오류 수정된 위치) ---
        const currentPosition = transform.getPosition()
        const currentRotation = transform.getQuaternion()

        // 다음 위치 예측 (currentPosition 복제 필수!)
        const positionDelta = this._tempAccel.copy(this.velocity).multiplyScalar(deltaTime)
        const nextPosition = currentPosition.clone().add(positionDelta)

        // 다음 회전 예측
        const rotationDelta = new THREE.Quaternion().setFromAxisAngle(this._tempRotationAxis.set(0, 1, 0), this.angularVelocity.y * deltaTime)
        const nextRotation = currentRotation.clone().multiply(rotationDelta)
        nextRotation.normalize()

        // --- 7. Ground Constraint (오류 수정) ---
        let maxPenetration = 0
        const terrain = suspension.getTerrain()
        const wheels = suspension.getWheels()

        if (terrain && wheels.length > 0) {
            // 예측된 다음 위치/회전을 사용하여 월드 매트릭스 계산 (오류 수정)
            const worldMatrix = new THREE.Matrix4().compose(nextPosition, nextRotation, this._tempComposeScale.set(1, 1, 1))

            for (const wheel of wheels) {
                const wheelWorldPos = this._tempWheelWorldPos.copy(wheel.position).applyMatrix4(worldMatrix)
                const terrainHeight = terrain.getHeightAt(wheelWorldPos.x, wheelWorldPos.y, wheelWorldPos.z)
                const targetWheelY = terrainHeight + wheel.radius
                const penetration = targetWheelY - wheelWorldPos.y
                if (penetration > maxPenetration) {
                    maxPenetration = penetration
                }
            }

            if (maxPenetration > 0) {
                // 예측된 다음 위치를 조정 (오류 수정)
                nextPosition.y += maxPenetration
                // 지면 충돌 시 수직 속도 감쇠 (여전히 유효)
                if (this.velocity.y < 0) {
                    this.velocity.y *= 0.1
                }
            }
        }

        // --- 8. Update Transform ---
        // 최종 계산된 nextPosition, nextRotation 사용
        transform.setPosition(nextPosition.x, nextPosition.y, nextPosition.z)
        const nextEuler = new THREE.Euler().setFromQuaternion(nextRotation, "YXZ")
        transform.setRotation(nextEuler)
    }

    public override dispose(): void {
        this.velocity.set(0, 0, 0)
        this.angularVelocity.set(0, 0, 0)
    }
}

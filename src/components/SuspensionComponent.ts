import * as THREE from "three"
import { Component } from "../core/Component"
import { TransformComponent } from "./TransformComponent"
import { PhysicsComponent } from "./PhysicsComponent"
import { ITerrainService } from "../core/ITerrainService"

export interface SuspensionConfig {
    stiffness: number
    damping: number
    compression: number
    restLength: number
    rollCenterHeight: number
    antiRollBar: number
    wheelRadius: number
    wheelWidth: number
    rollPitchSensitivity: number
    rollPitchSmoothingFactor: number
}

export interface WheelConfig {
    position: THREE.Vector3
    radius: number
    width: number
}

export class SuspensionComponent extends Component {
    private config: SuspensionConfig
    private wheels: WheelConfig[]
    private wheelHeights: number[]
    private wheelForces: THREE.Vector3[]
    private rollAngle: number
    private pitchAngle: number
    private terrainService: ITerrainService

    constructor(config: SuspensionConfig, wheels: WheelConfig[], terrainService: ITerrainService) {
        super("suspension")
        this.config = config
        this.wheels = wheels
        this.terrainService = terrainService
        this.wheelHeights = wheels.map(() => 0)
        this.wheelForces = wheels.map(() => new THREE.Vector3())
        this.rollAngle = 0
        this.pitchAngle = 0
    }

    public override async initialize(): Promise<void> {}

    public override update(deltaTime: number): void {
        const transform = this.entity?.getComponent<TransformComponent>("transform")
        const physics = this.entity?.getComponent<PhysicsComponent>("physics")
        if (!transform || !physics) return

        const position = transform.getPosition()
        const rotation = transform.getRotation()
        const quaternion = new THREE.Quaternion().setFromEuler(rotation)

        let totalRollForce = 0
        let totalPitchForce = 0

        for (let i = 0; i < this.wheels.length; i++) {
            const wheelLocalPos = this.wheels[i].position
            const wheelWorldPos = wheelLocalPos.clone().applyQuaternion(quaternion).add(position)

            const terrainHeight = this.terrainService.getHeightAt(wheelWorldPos.x, wheelWorldPos.y, wheelWorldPos.z)
            const terrainNormal = this.terrainService.getNormalAt(wheelWorldPos.x, wheelWorldPos.y, wheelWorldPos.z)

            const currentLength = wheelWorldPos.y - terrainHeight
            const compression = this.config.restLength - currentLength

            let suspensionForceMag = 0
            if (compression > 0) {
                const prevHeight = this.wheelHeights[i]
                const verticalVelocity = deltaTime > 1e-6 ? (currentLength - prevHeight) / deltaTime : 0

                const springForceMag = compression * this.config.stiffness
                const dampingForceMag = verticalVelocity * this.config.damping
                suspensionForceMag = Math.max(0, springForceMag - dampingForceMag)

                this.wheelForces[i].copy(terrainNormal).multiplyScalar(suspensionForceMag)
                this.wheelHeights[i] = currentLength

                totalRollForce += suspensionForceMag * wheelLocalPos.x
                totalPitchForce += suspensionForceMag * wheelLocalPos.z
            } else {
                this.wheelForces[i].set(0, 0, 0)
                this.wheelHeights[i] = currentLength
            }
        }

        const targetRollAngle = -totalRollForce * this.config.rollPitchSensitivity
        const targetPitchAngle = totalPitchForce * this.config.rollPitchSensitivity
        this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, targetRollAngle, this.config.rollPitchSmoothingFactor)
        this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, targetPitchAngle, this.config.rollPitchSmoothingFactor)
    }

    public calculateAntiRollForce(wheelIndex1: number, wheelIndex2: number): number {
        const heightDiff = this.wheelHeights[wheelIndex1] - this.wheelHeights[wheelIndex2]
        return heightDiff * this.config.antiRollBar
    }

    public getWheelForces(): THREE.Vector3[] {
        return this.wheelForces
    }

    public getRollAngle(): number {
        return this.rollAngle
    }

    public getPitchAngle(): number {
        return this.pitchAngle
    }

    public override dispose(): void {
        this.wheelHeights = this.wheels.map(() => this.config.restLength)
        this.wheelForces = this.wheels.map(() => new THREE.Vector3())
        this.rollAngle = 0
        this.pitchAngle = 0
    }

    // Public getters for PhysicsComponent access
    public getTerrain(): ITerrainService | null {
        return this.terrainService
    }

    public getWheels(): WheelConfig[] {
        return this.wheels
    }
}

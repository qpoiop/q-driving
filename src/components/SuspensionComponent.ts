import * as THREE from "three"
import { Component } from "../core/Component"
import { TransformComponent } from "./TransformComponent"

export interface SuspensionConfig {
    stiffness: number
    damping: number
    compression: number
    restLength: number
}

export class SuspensionComponent extends Component {
    private config: SuspensionConfig
    private height: number

    constructor(config: SuspensionConfig) {
        super("suspension")
        this.config = config
        this.height = config.restLength
    }

    public calculateForce(height: number, normal: THREE.Vector3): THREE.Vector3 {
        const compression = Math.max(0, this.config.restLength - height)
        const force = compression * this.config.stiffness
        return normal.multiplyScalar(force)
    }

    public getHeight(): number {
        return this.height
    }

    public setHeight(height: number): void {
        this.height = height
    }

    public override update(deltaTime: number): void {
        const transform = this.entity?.getComponent<TransformComponent>("transform")
        if (!transform) return

        const position = transform.getPosition()
        transform.setPosition(position.x, this.height, position.z)
    }

    public override dispose(): void {
        this.height = this.config.restLength
    }
}

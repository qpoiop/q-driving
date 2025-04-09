import * as THREE from "three"
import { Component } from "../core/Component"
import { TransformComponent } from "./TransformComponent"
import { SuspensionComponent } from "./SuspensionComponent"

export class ModelComponent extends Component {
    private model: THREE.Group

    constructor(model: THREE.Group = new THREE.Group()) {
        super("model")
        this.model = model
    }

    public override async initialize(): Promise<void> {}

    public override update(deltaTime: number): void {
        const transform = this.entity?.getComponent<TransformComponent>("transform")
        const suspension = this.entity?.getComponent<SuspensionComponent>("suspension")

        if (transform && this.model) {
            // 기본 위치/회전 적용 (PhysicsComponent 결과)
            this.model.position.copy(transform.getPosition())
            const baseRotation = transform.getRotation() // Physics가 설정한 Y축 회전 등

            // 서스펜션의 롤/피치 각도 가져오기
            const rollAngle = suspension?.getRollAngle() ?? 0
            const pitchAngle = suspension?.getPitchAngle() ?? 0

            // 최종 회전 계산 및 적용
            const finalRotation = new THREE.Euler(
                pitchAngle, // X축 회전 = 피치
                baseRotation.y, // Y축 회전 (Physics 결과)
                rollAngle, // Z축 회전 = 롤
                "YXZ", // 오일러 각도 순서 중요! (Roll-Pitch-Yaw 순서)
            )
            this.model.rotation.copy(finalRotation)

            // 스케일 적용
            this.model.scale.copy(transform.getScale())
            this.model.updateMatrixWorld()

            // TODO: 바퀴 회전 등 시각 효과 업데이트 로직 이동 필요
            // this.updateWheelRotation(deltaTime);
        }
    }

    public setModel(model: THREE.Group): void {
        this.model = model
    }

    public getModel(): THREE.Group {
        return this.model
    }

    public getPosition(): THREE.Vector3 {
        return this.model.position
    }

    public setPosition(position: THREE.Vector3): void {
        this.model.position.copy(position)
    }

    public getRotation(): THREE.Euler {
        return this.model.rotation
    }

    public setRotation(rotation: THREE.Euler): void {
        this.model.rotation.copy(rotation)
    }

    public getScale(): THREE.Vector3 {
        return this.model.scale
    }

    public setScale(scale: THREE.Vector3): void {
        this.model.scale.copy(scale)
    }

    public getQuaternion(): THREE.Quaternion {
        return this.model.quaternion
    }

    public setQuaternion(quaternion: THREE.Quaternion): void {
        this.model.quaternion.copy(quaternion)
    }

    public getMatrix(): THREE.Matrix4 {
        return this.model.matrix
    }

    public getMatrixWorld(): THREE.Matrix4 {
        return this.model.matrixWorld
    }

    public updateMatrix(): void {
        this.model.updateMatrix()
    }

    public updateMatrixWorld(force: boolean = false): void {
        this.model.updateMatrixWorld(force)
    }

    public override dispose(): void {
        if (!this.model) return

        this.model.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose()
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose())
                } else if (child.material) {
                    child.material.dispose()
                }
            }
        })
    }
}

import { Component } from "../core/Component"
import { InputSystem } from "../systems/InputSystem"

export class InputComponent extends Component {
    private inputSystem: InputSystem
    private movementDirection: { x: number; z: number }
    private _isBraking: boolean
    private _isHandbraking: boolean
    private steeringAngle: number

    constructor(inputSystem: InputSystem) {
        super("input")
        this.inputSystem = inputSystem
        this.movementDirection = { x: 0, z: 0 }
        this._isBraking = false
        this._isHandbraking = false
        this.steeringAngle = 0
    }

    public override async initialize(): Promise<void> {}

    public override update(deltaTime: number): void {
        const keyMapping = this.inputSystem.getKeyMapping()

        // 이동 방향 계산
        this.movementDirection.x = 0
        this.movementDirection.z = 0
        if (this.inputSystem.isKeyPressed(keyMapping.forward)) this.movementDirection.z = 1 // Z+가 전진 방향이라고 가정
        if (this.inputSystem.isKeyPressed(keyMapping.backward)) this.movementDirection.z = -1
        if (this.inputSystem.isKeyPressed(keyMapping.left)) this.movementDirection.x = -1
        if (this.inputSystem.isKeyPressed(keyMapping.right)) this.movementDirection.x = 1

        // 브레이크 상태 업데이트
        this._isBraking = this.inputSystem.isKeyPressed(keyMapping.brake)
        this._isHandbraking = this.inputSystem.isKeyPressed(keyMapping.handbrake)

        // 스티어링 각도 계산
        this.steeringAngle = this.movementDirection.x // [-1, 0, 1]
    }

    public override dispose(): void {
        this.movementDirection = { x: 0, z: 0 }
        this._isBraking = false
        this._isHandbraking = false
        this.steeringAngle = 0
    }

    // Getter 메서드들
    public getMovementDirection(): { x: number; z: number } {
        return this.movementDirection
    }
    public isBraking(): boolean {
        return this._isBraking
    }
    public isHandbraking(): boolean {
        return this._isHandbraking
    }
    public getSteeringAngle(): number {
        return this.steeringAngle
    }
}

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
        const joystickDir = this.inputSystem.getTouchDirection()

        // --- 로깅 추가 ---
        // console.log(`[InputComponent] Joystick Dir: x=${joystickDir.x.toFixed(2)}, y=${joystickDir.y.toFixed(2)}`);
        // ---------------

        // 키보드 입력 처리
        let keyX = 0
        let keyZ = 0
        if (this.inputSystem.isKeyPressed(keyMapping.forward)) keyZ = 1
        if (this.inputSystem.isKeyPressed(keyMapping.backward)) keyZ = -1
        if (this.inputSystem.isKeyPressed(keyMapping.left)) keyX = -1
        if (this.inputSystem.isKeyPressed(keyMapping.right)) keyX = 1

        // 조이스틱 입력 처리 (조이스틱 값이 있으면 우선 적용)
        // 조이스틱 Y값은 Z축 이동(전진/후진), X값은 X축 이동(좌/우회전)으로 매핑
        if (Math.abs(joystickDir.x) > 0.1 || Math.abs(joystickDir.y) > 0.1) {
            // 약간의 Deadzone
            this.movementDirection.x = joystickDir.x
            // Y값 부호 반전 필요할 수 있음 (조이스틱 위 = 전진 = Z+ 가정)
            this.movementDirection.z = -joystickDir.y
        } else {
            // 조이스틱 입력 없으면 키보드 값 사용
            this.movementDirection.x = keyX
            this.movementDirection.z = keyZ
        }

        // 브레이크 상태 업데이트 (키보드만)
        this._isBraking = this.inputSystem.isKeyPressed(keyMapping.brake)
        this._isHandbraking = this.inputSystem.isKeyPressed(keyMapping.handbrake)

        // 스티어링 각도 계산 (X축 이동 방향 사용)
        this.steeringAngle = this.movementDirection.x // [-1, 1] 범위
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

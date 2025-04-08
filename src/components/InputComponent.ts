import { Component } from "../core/Component"
import { EventManager } from "../core/EventManager"
import { InputSystem } from "../systems/InputSystem"

export class InputComponent extends Component {
    private eventManager: EventManager
    private inputSystem: InputSystem

    constructor(inputSystem: InputSystem) {
        super("input")
        this.inputSystem = inputSystem
        this.eventManager = inputSystem.getEventManager()
    }

    public getMovementDirection(): { x: number; z: number } {
        const mapping = this.inputSystem.getKeyMapping()
        let x = 0
        let z = 0

        if (this.inputSystem.isKeyPressed(mapping.forward)) z -= 1
        if (this.inputSystem.isKeyPressed(mapping.backward)) z += 1
        if (this.inputSystem.isKeyPressed(mapping.left)) x -= 1
        if (this.inputSystem.isKeyPressed(mapping.right)) x += 1

        return { x, z }
    }

    public isBraking(): boolean {
        return this.inputSystem.isKeyPressed(this.inputSystem.getKeyMapping().brake)
    }

    public isHandbraking(): boolean {
        return this.inputSystem.isKeyPressed(this.inputSystem.getKeyMapping().handbrake)
    }

    public override dispose(): void {
        // 이벤트 리스너 정리
    }
}

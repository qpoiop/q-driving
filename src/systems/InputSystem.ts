import { System } from "../core/System"
import { EventManager } from "../core/EventManager"
import { Joystick } from "../ui/Joystick"

export interface KeyMapping {
    forward: string
    backward: string
    left: string
    right: string
    brake: string
    handbrake: string
}

export class InputSystem extends System {
    private keys = new Set<string>()
    private joystick: Joystick | null = null
    private eventManager: EventManager
    private keyMapping: KeyMapping
    private keyDownHandler: (e: KeyboardEvent) => void
    private keyUpHandler: (e: KeyboardEvent) => void

    constructor() {
        super("input")
        this.eventManager = new EventManager()
        this.keyMapping = {
            forward: "ArrowUp",
            backward: "ArrowDown",
            left: "ArrowLeft",
            right: "ArrowRight",
            brake: "b",
            handbrake: " ",
        }
        console.log("[InputSystem] Initializing input system...")

        // 이벤트 리스너 등록
        this.keyDownHandler = this.handleKeyDown.bind(this)
        this.keyUpHandler = this.handleKeyUp.bind(this)

        window.addEventListener("keydown", this.keyDownHandler)
        window.addEventListener("keyup", this.keyUpHandler)

        console.log("[InputSystem] Input system initialized")
    }

    public setJoystick(joystick: Joystick): void {
        this.joystick = joystick
        console.log("[InputSystem] Joystick set:", this.joystick)
    }

    public setKeyMapping(mapping: KeyMapping): void {
        this.keyMapping = mapping
    }

    public getKeyMapping(): KeyMapping {
        return this.keyMapping
    }

    public isKeyPressed(key: string): boolean {
        const isPressed = this.keys.has(key)
        return isPressed
    }

    public getTouchDirection(): { x: number; y: number } {
        return this.joystick?.getDirection() ?? { x: 0, y: 0 }
    }

    public hasTouchInput(): boolean {
        const dir = this.getTouchDirection()
        return dir.x !== 0 || dir.y !== 0
    }

    public override async initialize(): Promise<void> {}

    public override update(deltaTime: number): void {
        // 필요하다면 여기서 joystick 값을 읽어 이벤트를 발생시킬 수도 있음
        // 예: if (this.joystick) { this.eventManager.emit('joystick:move', this.joystick.getDirection()); }
    }

    public override dispose(): void {
        // 이벤트 리스너 제거
        window.removeEventListener("keydown", this.keyDownHandler)
        window.removeEventListener("keyup", this.keyUpHandler)
    }

    private handleKeyDown(e: KeyboardEvent): void {
        this.onKeyDown(e)
    }

    private handleKeyUp(e: KeyboardEvent): void {
        this.onKeyUp(e)
    }

    private onKeyDown(e: KeyboardEvent): void {
        this.keys.add(e.key)

        this.eventManager.emit("input:keydown", e.key)
        e.preventDefault() // 이벤트 전파 방지
    }

    private onKeyUp(e: KeyboardEvent): void {
        this.keys.delete(e.key)

        this.eventManager.emit("input:keyup", e.key)
        e.preventDefault() // 이벤트 전파 방지
    }

    public getEventManager(): EventManager {
        return this.eventManager
    }
}

import { System } from "../core/System"
import { EventManager } from "../core/EventManager"

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
    private touchDirection = { x: 0, y: 0 }
    private eventManager: EventManager
    private keyMapping: KeyMapping
    private keyDownHandler: (e: KeyboardEvent) => void
    private keyUpHandler: (e: KeyboardEvent) => void
    private touchStartHandler: (e: TouchEvent) => void
    private touchMoveHandler: (e: TouchEvent) => void
    private touchEndHandler: (e: TouchEvent) => void

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
        this.touchStartHandler = this.onTouchStart.bind(this)
        this.touchMoveHandler = this.onTouchMove.bind(this)
        this.touchEndHandler = this.onTouchEnd.bind(this)

        window.addEventListener("keydown", this.keyDownHandler)
        window.addEventListener("keyup", this.keyUpHandler)
        window.addEventListener("touchstart", this.touchStartHandler)
        window.addEventListener("touchmove", this.touchMoveHandler)
        window.addEventListener("touchend", this.touchEndHandler)

        console.log("[InputSystem] Input system initialized")
    }

    private updateTouchDirection(touch: Touch) {
        const w = window.innerWidth
        const h = window.innerHeight
        const dx = (touch.clientX - w / 2) / w
        const dy = (touch.clientY - h / 2) / h
        this.touchDirection = { x: dx, y: dy }
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
        return this.touchDirection
    }

    public hasTouchInput(): boolean {
        return this.touchDirection.x !== 0 || this.touchDirection.y !== 0
    }

    public override async initialize(): Promise<void> {}

    public override update(deltaTime: number): void {}

    public override dispose(): void {
        // 이벤트 리스너 제거
        window.removeEventListener("keydown", this.keyDownHandler)
        window.removeEventListener("keyup", this.keyUpHandler)
        window.removeEventListener("touchstart", this.touchStartHandler)
        window.removeEventListener("touchmove", this.touchMoveHandler)
        window.removeEventListener("touchend", this.touchEndHandler)
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

    private onTouchStart(e: TouchEvent): void {
        this.updateTouchDirection(e.touches[0])
        this.eventManager.emit("input:touchstart", this.touchDirection)
    }

    private onTouchMove(e: TouchEvent): void {
        this.updateTouchDirection(e.touches[0])
        this.eventManager.emit("input:touchmove", this.touchDirection)
    }

    private onTouchEnd(e: TouchEvent): void {
        this.touchDirection = { x: 0, y: 0 }
        this.eventManager.emit("input:touchend", this.touchDirection)
    }

    public getEventManager(): EventManager {
        return this.eventManager
    }
}

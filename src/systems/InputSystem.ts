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

    constructor() {
        super("input")
        this.eventManager = new EventManager()
        this.keyMapping = {
            forward: "arrowup",
            backward: "arrowdown",
            left: "arrowleft",
            right: "arrowright",
            brake: "b",
            handbrake: "space",
        }
        console.log("[InputSystem] Initializing input system...")

        window.addEventListener("keydown", e => {
            console.log("[InputSystem] Key pressed:", e.key)
            this.keys.add(e.key.toLowerCase())
            this.eventManager.emit("input:keydown", e.key.toLowerCase())
        })

        window.addEventListener("keyup", e => {
            console.log("[InputSystem] Key released:", e.key)
            this.keys.delete(e.key.toLowerCase())
            this.eventManager.emit("input:keyup", e.key.toLowerCase())
        })

        window.addEventListener("touchstart", e => {
            this.updateTouchDirection(e.touches[0])
            this.eventManager.emit("input:touchstart", this.touchDirection)
        })
        window.addEventListener("touchmove", e => {
            this.updateTouchDirection(e.touches[0])
            this.eventManager.emit("input:touchmove", this.touchDirection)
        })
        window.addEventListener("touchend", () => {
            this.touchDirection = { x: 0, y: 0 }
            this.eventManager.emit("input:touchend", this.touchDirection)
        })

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
        const isPressed = this.keys.has(key.toLowerCase())
        console.log("[InputSystem] Checking key:", key, "isPressed:", isPressed)
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
        window.removeEventListener("keydown", e => this.keys.add(e.key.toLowerCase()))
        window.removeEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()))
        window.removeEventListener("touchstart", e => this.updateTouchDirection(e.touches[0]))
        window.removeEventListener("touchmove", e => this.updateTouchDirection(e.touches[0]))
        window.removeEventListener("touchend", () => {
            this.touchDirection = { x: 0, y: 0 }
        })
    }

    public getEventManager(): EventManager {
        return this.eventManager
    }
}

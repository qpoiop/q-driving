export class InputSystem {
    private keys = new Set<string>()
    private touchDirection = { x: 0, y: 0 }

    constructor() {
        window.addEventListener("keydown", e => this.keys.add(e.key.toLowerCase()))
        window.addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()))

        window.addEventListener("touchstart", e => this.updateTouchDirection(e.touches[0]))
        window.addEventListener("touchmove", e => this.updateTouchDirection(e.touches[0]))
        window.addEventListener("touchend", () => {
            this.touchDirection = { x: 0, y: 0 }
        })
    }

    private updateTouchDirection(touch: Touch) {
        const w = window.innerWidth
        const h = window.innerHeight
        const dx = (touch.clientX - w / 2) / w
        const dy = (touch.clientY - h / 2) / h
        this.touchDirection = { x: dx, y: dy }
    }

    public isKeyPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase())
    }

    public getTouchDirection(): { x: number; y: number } {
        return this.touchDirection
    }

    public hasTouchInput(): boolean {
        return this.touchDirection.x !== 0 || this.touchDirection.y !== 0
    }
}

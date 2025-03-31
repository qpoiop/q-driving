export class InputSystem {
    private keys = new Set<string>()

    constructor() {
        window.addEventListener("keydown", e => this.keys.add(e.key.toLowerCase()))
        window.addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()))

        // 모바일 터치 대응
        window.addEventListener("touchstart", e => {
            const touch = e.touches[0]
            if (!touch) return
            const w = window.innerWidth
            const h = window.innerHeight
            const x = touch.clientX
            const y = touch.clientY

            if (x < w / 2 && y > h * 0.5) this.keys.add("arrowleft")
            else if (x > w / 2 && y > h * 0.5) this.keys.add("arrowright")
            if (y < h / 2) this.keys.add("arrowup")
        })

        window.addEventListener("touchend", () => {
            this.keys.clear()
        })
    }

    public isKeyPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase())
    }

    public getSteeringFromTouch(): number {
        if (this.keys.has("arrowleft")) return 1
        if (this.keys.has("arrowright")) return -1
        return 0
    }

    public isAccelerating(): boolean {
        return this.keys.has("arrowup")
    }
}

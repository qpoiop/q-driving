export class Joystick {
    private base: HTMLDivElement
    private knob: HTMLDivElement
    private origin = { x: 0, y: 0 }
    private delta = { x: 0, y: 0 }
    private active = false

    constructor() {
        if (!this.isMobile()) return

        this.base = document.createElement("div")
        this.knob = document.createElement("div")
        Object.assign(this.base.style, {
            position: "absolute",
            bottom: "60px",
            right: "60px",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.2)",
            touchAction: "none",
        })
        Object.assign(this.knob.style, {
            position: "absolute",
            left: "40px",
            top: "40px",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.3)",
        })

        this.base.appendChild(this.knob)
        document.body.appendChild(this.base)

        this.base.addEventListener("touchstart", this.handleStart)
        this.base.addEventListener("touchmove", this.handleMove)
        this.base.addEventListener("touchend", this.handleEnd)
    }

    private isMobile(): boolean {
        return /Mobi|Android/i.test(navigator.userAgent)
    }

    private handleStart = (e: TouchEvent) => {
        this.active = true
        const touch = e.touches[0]
        const rect = this.base.getBoundingClientRect()
        this.origin.x = touch.clientX - rect.left
        this.origin.y = touch.clientY - rect.top
    }

    private handleMove = (e: TouchEvent) => {
        if (!this.active) return
        const touch = e.touches[0]
        const rect = this.base.getBoundingClientRect()
        const x = touch.clientX - rect.left
        const y = touch.clientY - rect.top

        const dx = x - this.origin.x
        const dy = y - this.origin.y
        const len = Math.min(Math.sqrt(dx * dx + dy * dy), 40)

        const angle = Math.atan2(dy, dx)
        this.delta.x = (len / 40) * Math.cos(angle)
        this.delta.y = (len / 40) * Math.sin(angle)

        this.knob.style.transform = `translate(${this.delta.x * 40}px, ${this.delta.y * 40}px)`
    }

    private handleEnd = () => {
        this.active = false
        this.delta.x = 0
        this.delta.y = 0
        this.knob.style.transform = "translate(0, 0)"
    }

    public getInput(): { x: number; y: number } {
        return this.delta
    }
}

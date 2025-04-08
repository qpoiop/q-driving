export class Joystick {
    private container: HTMLElement
    private joystick: HTMLElement
    private isDragging: boolean = false
    private startPos: { x: number; y: number } = { x: 0, y: 0 }
    private currentPos: { x: number; y: number } = { x: 0, y: 0 }
    private maxDistance: number = 50
    private boundMouseDown: (event: MouseEvent) => void
    private boundMouseMove: (event: MouseEvent) => void
    private boundMouseUp: () => void

    constructor() {
        this.boundMouseDown = this.onMouseDown.bind(this)
        this.boundMouseMove = this.onMouseMove.bind(this)
        this.boundMouseUp = this.onMouseUp.bind(this)
    }

    public async initialize(): Promise<void> {
        // 조이스틱 컨테이너 생성
        this.container = document.createElement("div")
        this.container.style.position = "absolute"
        this.container.style.bottom = "20px"
        this.container.style.left = "20px"
        this.container.style.width = "100px"
        this.container.style.height = "100px"
        this.container.style.borderRadius = "50%"
        this.container.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
        document.body.appendChild(this.container)

        // 조이스틱 핸들 생성
        this.joystick = document.createElement("div")
        this.joystick.style.position = "absolute"
        this.joystick.style.left = "50%"
        this.joystick.style.top = "50%"
        this.joystick.style.width = "40px"
        this.joystick.style.height = "40px"
        this.joystick.style.borderRadius = "50%"
        this.joystick.style.backgroundColor = "rgba(255, 255, 255, 0.8)"
        this.joystick.style.transform = "translate(-50%, -50%)"
        this.container.appendChild(this.joystick)

        // 이벤트 리스너 설정
        this.container.addEventListener("mousedown", this.boundMouseDown)
        document.addEventListener("mousemove", this.boundMouseMove)
        document.addEventListener("mouseup", this.boundMouseUp)

        // 터치 이벤트 추가
        this.container.addEventListener("touchstart", (e: TouchEvent) => {
            e.preventDefault()
            const touch = e.touches[0]
            this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
        })
        document.addEventListener("touchmove", (e: TouchEvent) => {
            e.preventDefault()
            if (this.isDragging) {
                const touch = e.touches[0]
                this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
            }
        })
        document.addEventListener("touchend", () => {
            this.onMouseUp()
        })
    }

    private onMouseDown(event: MouseEvent): void {
        this.isDragging = true
        const rect = this.container.getBoundingClientRect()
        this.startPos = {
            x: event.clientX - rect.left - rect.width / 2,
            y: event.clientY - rect.top - rect.height / 2,
        }
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.isDragging) return

        const rect = this.container.getBoundingClientRect()
        this.currentPos = {
            x: event.clientX - rect.left - rect.width / 2 - this.startPos.x,
            y: event.clientY - rect.top - rect.height / 2 - this.startPos.y,
        }

        // 최대 거리 제한
        const distance = Math.sqrt(this.currentPos.x * this.currentPos.x + this.currentPos.y * this.currentPos.y)
        if (distance > this.maxDistance) {
            const ratio = this.maxDistance / distance
            this.currentPos.x *= ratio
            this.currentPos.y *= ratio
        }

        // 조이스틱 위치 업데이트
        this.joystick.style.transform = `translate(calc(-50% + ${this.currentPos.x}px), calc(-50% + ${this.currentPos.y}px))`
    }

    private onMouseUp(): void {
        this.isDragging = false
        this.currentPos = { x: 0, y: 0 }
        this.joystick.style.transform = "translate(-50%, -50%)"
    }

    public getDirection(): { x: number; y: number } {
        return {
            x: this.currentPos.x / this.maxDistance,
            y: this.currentPos.y / this.maxDistance,
        }
    }

    public dispose(): void {
        if (this.container && this.container.parentNode) {
            this.container.removeEventListener("mousedown", this.boundMouseDown)
            document.removeEventListener("mousemove", this.boundMouseMove)
            document.removeEventListener("mouseup", this.boundMouseUp)
            this.container.parentNode.removeChild(this.container)
        }
    }
}

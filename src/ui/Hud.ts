export class HUD {
    private speedText: HTMLDivElement
    private fpsText: HTMLDivElement
    private container: HTMLElement

    constructor() {
        this.container = document.createElement("div")
        this.container.style.position = "absolute"
        this.container.style.bottom = "10px"
        this.container.style.left = "10px"
        this.container.style.color = "#f8f8f8"
        this.container.style.fontFamily = "Arial"
        this.container.style.fontSize = "10px"
        this.container.style.zIndex = "1000"
        this.container.style.pointerEvents = "none"
    }

    public async initialize(): Promise<void> {
        document.body.appendChild(this.container)

        // 속도 표시 텍스트 생성
        this.speedText = document.createElement("div")
        this.speedText.style.marginBottom = "3px"
        this.container.appendChild(this.speedText)

        // FPS 표시 텍스트 생성
        this.fpsText = document.createElement("div")
        this.fpsText.style.marginBottom = "3px"
        this.container.appendChild(this.fpsText)
    }

    public updateSpeed(speed: number): void {
        this.speedText.innerHTML = `Speed: ${speed.toFixed(1)} km/h`
    }

    public updateFPS(fps: number): void {
        this.fpsText.innerHTML = `FPS: ${fps}`
    }

    public dispose(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container)
        }
    }
}

export class Hud {
    private container: HTMLDivElement
    private speedEl: HTMLDivElement
    private gearEl: HTMLDivElement
    private modeEl: HTMLDivElement

    constructor() {
        this.container = document.createElement("div")
        this.container.style.position = "absolute"
        this.container.style.bottom = "20px"
        this.container.style.left = "20px"
        this.container.style.color = "white"
        this.container.style.fontSize = "20px"
        this.container.style.fontFamily = "monospace"
        this.container.style.pointerEvents = "none"

        this.speedEl = document.createElement("div")
        this.gearEl = document.createElement("div")
        this.modeEl = document.createElement("div")

        this.container.appendChild(this.speedEl)
        this.container.appendChild(this.gearEl)
        this.container.appendChild(this.modeEl)

        document.body.appendChild(this.container)
    }

    public update(speed: number, gear: string = "D", mode: string = "DAY") {
        this.speedEl.innerText = `속도: ${(speed * 50).toFixed(1)} km/h`
        this.gearEl.innerText = `기어: ${gear}`
        this.modeEl.innerText = `모드: ${mode}`
    }
}

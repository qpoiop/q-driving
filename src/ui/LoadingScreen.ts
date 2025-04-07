export class LoadingScreen {
    private element: HTMLDivElement
    private progressBar: HTMLDivElement
    private loadingText: HTMLDivElement
    private progressText: HTMLDivElement

    private readonly loadingStages = [
        "Initializing the world...",
        "Crafting your perfect vehicle...",
        "Creating a scenic environment...",
        "Painting the landscape...",
        "Getting ready to start the journey...",
    ]

    constructor() {
        this.element = document.createElement("div")
        this.element.style.position = "fixed"
        this.element.style.top = "0"
        this.element.style.left = "0"
        this.element.style.width = "100%"
        this.element.style.height = "100%"
        this.element.style.backgroundColor = "rgba(0, 0, 0, 0.9)"
        this.element.style.display = "flex"
        this.element.style.flexDirection = "column"
        this.element.style.justifyContent = "center"
        this.element.style.alignItems = "center"
        this.element.style.color = "white"
        this.element.style.fontFamily = "'Segoe UI', Arial, sans-serif"
        this.element.style.zIndex = "1000"

        const title = document.createElement("h1")
        title.textContent = "Q-Driving"
        title.style.marginBottom = "40px"
        title.style.fontSize = "48px"
        title.style.fontWeight = "bold"
        title.style.color = "#ffffff"
        title.style.textShadow = "0 0 10px rgba(255,255,255,0.5)"

        this.loadingText = document.createElement("div")
        this.loadingText.textContent = "Loading..."
        this.loadingText.style.fontSize = "14px"
        this.loadingText.style.color = "#aaa"
        this.loadingText.style.marginBottom = "10px"

        const progressContainer = document.createElement("div")
        progressContainer.style.width = "300px"
        progressContainer.style.height = "3px"
        progressContainer.style.backgroundColor = "#333"
        progressContainer.style.borderRadius = "2px"
        progressContainer.style.overflow = "hidden"
        progressContainer.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)"

        this.progressBar = document.createElement("div")
        this.progressBar.style.width = "0%"
        this.progressBar.style.height = "100%"
        this.progressBar.style.backgroundColor = "#4CAF50"
        this.progressBar.style.transition = "width 0.3s ease-out"
        this.progressBar.style.boxShadow = "0 0 10px rgba(76,175,80,0.5)"

        this.progressText = document.createElement("div")
        this.progressText.style.marginTop = "12px"
        this.progressText.style.fontSize = "12px"
        this.progressText.style.color = "#888"
        this.progressText.style.fontStyle = "italic"
        this.progressText.textContent = this.loadingStages[0]

        this.element.appendChild(title)
        this.element.appendChild(this.loadingText)
        progressContainer.appendChild(this.progressBar)
        this.element.appendChild(progressContainer)
        this.element.appendChild(this.progressText)
    }

    public show() {
        document.body.appendChild(this.element)
    }

    public hide() {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element)
        }
    }

    public updateProgress(progress: number, customMessage?: string) {
        const percentage = Math.min(100, Math.max(0, progress * 100))
        this.progressBar.style.width = `${percentage}%`

        // 진행 상태에 따른 텍스트 업데이트
        if (customMessage) {
            this.progressText.textContent = customMessage
        } else {
            const stageIndex = Math.floor((this.loadingStages.length - 1) * progress)
            this.progressText.textContent = this.loadingStages[Math.min(stageIndex, this.loadingStages.length - 1)]
        }

        // Loading... 텍스트에 애니메이션 효과
        this.loadingText.textContent = "Loading" + ".".repeat(Math.floor((Date.now() / 500) % 4))
    }
}

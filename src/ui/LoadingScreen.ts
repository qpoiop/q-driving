export class LoadingScreen {
    private container: HTMLDivElement
    private progressBar: HTMLDivElement
    private progressText: HTMLDivElement
    private errorText: HTMLDivElement
    private titleText: HTMLDivElement

    private readonly loadingStages = [
        "Initializing the world...",
        "Crafting your perfect vehicle...",
        "Creating a scenic environment...",
        "Painting the landscape...",
        "Getting ready to start the journey...",
    ]

    constructor() {
        // 컨테이너 생성
        this.container = document.createElement("div")
        this.container.style.position = "fixed"
        this.container.style.top = "0"
        this.container.style.left = "0"
        this.container.style.width = "100%"
        this.container.style.height = "100%"
        this.container.style.backgroundColor = "#ffffff" // 흰색 배경
        this.container.style.display = "flex"
        this.container.style.flexDirection = "column"
        this.container.style.alignItems = "center"
        this.container.style.justifyContent = "center"
        this.container.style.zIndex = "1000"

        // 타이틀 텍스트
        this.titleText = document.createElement("div")
        this.titleText.style.color = "#000000"
        this.titleText.style.fontSize = "14px"
        this.titleText.style.fontWeight = "bold"
        this.titleText.style.marginBottom = "10px"
        this.titleText.style.fontFamily = "Arial, sans-serif"
        this.titleText.textContent = "Q Driving"

        // 프로그레스 바 컨테이너
        const barContainer = document.createElement("div")
        barContainer.style.width = "100px" // 너비 줄임
        barContainer.style.backgroundColor = "#ffffff" // 흰색 배경
        barContainer.style.border = "1px solid #cccccc" // 회색 테두리
        barContainer.style.borderRadius = "4px"
        barContainer.style.overflow = "hidden"

        // 프로그레스 바
        this.progressBar = document.createElement("div")
        this.progressBar.style.width = "0%"
        this.progressBar.style.height = "4px"
        this.progressBar.style.backgroundColor = "#333333" // 진한 검은색
        this.progressBar.style.transition = "width 0.3s ease"
        barContainer.appendChild(this.progressBar)

        // 프로그레스 텍스트
        this.progressText = document.createElement("div")
        this.progressText.style.color = "#666666" // 회색 텍스트
        this.progressText.style.marginTop = "5px"
        this.progressText.style.fontSize = "10px" // 작은 폰트 사이즈
        this.progressText.style.fontFamily = "Arial, sans-serif"
        this.progressText.textContent = "로딩 중..."

        // 에러 텍스트
        this.errorText = document.createElement("div")
        this.errorText.style.color = "#ff4444"
        this.errorText.style.marginTop = "20px"
        this.errorText.style.fontSize = "12px" // 작은 폰트 사이즈
        this.errorText.style.fontFamily = "Arial, sans-serif"
        this.errorText.style.display = "none"
        this.errorText.style.textAlign = "center"
        this.errorText.style.maxWidth = "80%"

        this.container.appendChild(this.titleText)
        this.container.appendChild(barContainer)
        this.container.appendChild(this.progressText)
        this.container.appendChild(this.errorText)
    }

    public show(): void {
        document.body.appendChild(this.container)
    }

    public hide(): void {
        if (this.container.parentNode) {
            document.body.removeChild(this.container)
        }
    }

    public updateProgress(progress: number): void {
        const percentage = Math.round(progress * 100)
        this.progressBar.style.width = `${percentage}%`

        // 로딩 단계 텍스트 업데이트
        const stageIndex = Math.floor(progress * this.loadingStages.length)
        const currentStage = this.loadingStages[Math.min(stageIndex, this.loadingStages.length - 1)]
        this.progressText.textContent = `${currentStage} (${percentage}%)`

        this.errorText.style.display = "none"
    }

    public showError(message: string): void {
        this.progressBar.style.backgroundColor = "#ff4444"
        this.progressText.style.display = "none"
        this.errorText.textContent = message
        this.errorText.style.display = "block"
    }
}

import "./style.css"
import { App } from "./App"

class Main {
    private app: App

    constructor() {
        this.app = new App()
    }

    public async initialize(): Promise<void> {
        try {
            const container = document.getElementById("app")
            if (!container) {
                throw new Error("Container element not found")
            }

            await this.app.initialize(container)
            console.log("Application initialized successfully")
        } catch (error) {
            console.error("Failed to initialize application:", error)
            throw error
        }
    }

    public dispose(): void {
        this.app.dispose()
    }
}

// 애플리케이션 시작
const main = new Main()
main.initialize().catch(error => {
    console.error("Application failed to start:", error)
})

export class Time {
    private static instance: Time
    private lastTime: number = 0
    private deltaTime: number = 0
    private timeScale: number = 1
    private elapsedTime: number = 0

    private constructor() {
        this.lastTime = performance.now()
    }

    public static getInstance(): Time {
        if (!Time.instance) {
            Time.instance = new Time()
        }
        return Time.instance
    }

    public static update(): void {
        const currentTime = performance.now()
        Time.instance.deltaTime = (currentTime - Time.instance.lastTime) / 1000
        Time.instance.elapsedTime += Time.instance.deltaTime
        Time.instance.lastTime = currentTime
    }

    public static getDeltaTime(): number {
        return Time.instance.deltaTime
    }

    public static getTimeScale(): number {
        return Time.instance.timeScale
    }

    public static setTimeScale(scale: number): void {
        Time.instance.timeScale = scale
    }

    public static getElapsedTime(): number {
        return Time.instance.elapsedTime
    }
}

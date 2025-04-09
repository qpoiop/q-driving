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
        let dt = (currentTime - Time.instance.lastTime) / 1000

        // Handle potential initial large deltaTime after loading/initialization
        if (dt > 0.1) {
            // If delta time is larger than 100ms, likely the first frame after a pause
            dt = 1 / 60 // Reset to a reasonable value (e.g., 1/60th of a second)
        }

        // Add a minimum delta time clamp to prevent division by zero or very small numbers
        dt = Math.max(1 / 1000, dt) // Ensure dt is at least 1ms

        // Apply time scale
        Time.instance.deltaTime = dt * Time.instance.timeScale
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

export class Time {
    private static instance: Time
    private lastTime: number = 0
    private deltaTime: number = 0
    private timeScale: number = 1
    private elapsedTime: number = 0
    private fixedDeltaTime: number = 1 / 60 // 고정 델타타임 (60fps 기준)
    private accumulatedTime: number = 0
    private fixedTimeStep: boolean = true // 고정 타임스텝 사용 여부

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
            // 100ms보다 큰 틱 발생 시 (로딩 후 첫 프레임 등) 적절한 값으로 제한
            dt = Time.instance.fixedDeltaTime
        }

        // 최소 델타타임 제한 (0으로 나누기 방지)
        dt = Math.max(0.001, dt)

        // 타임스케일 적용
        const scaledDt = dt * Time.instance.timeScale

        if (Time.instance.fixedTimeStep) {
            // 고정 타임스텝 사용 시 누적 시간 계산
            Time.instance.accumulatedTime += scaledDt
            // 고정 델타타임 사용
            Time.instance.deltaTime = Time.instance.fixedDeltaTime
        } else {
            // 가변 타임스텝 사용
            Time.instance.deltaTime = scaledDt
        }

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

    public static shouldRunFixedUpdate(): boolean {
        if (!Time.instance.fixedTimeStep) return true

        if (Time.instance.accumulatedTime >= Time.instance.fixedDeltaTime) {
            Time.instance.accumulatedTime -= Time.instance.fixedDeltaTime
            return true
        }
        return false
    }

    public static setFixedTimeStep(enabled: boolean): void {
        Time.instance.fixedTimeStep = enabled
    }
}

import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { Car } from "./entities/Car"
import { Sky } from "./entities/Sky"
import { WorldManager } from "./core/WorldManager"
import { Engine } from "./core/Engine"
import { HUD } from "./ui/Hud"
import { Joystick } from "./ui/Joystick"
import { LoadingScreen } from "./ui/LoadingScreen"
import { ResourceManager } from "./core/ResourceManager"
import { EventManager } from "./core/EventManager"
import { CameraMode } from "./core/CameraController"
import { CarConfig } from "./config/CarConfig"
import { CameraController } from "./core/CameraController"
import { PhysicsConfig } from "./components/PhysicsComponent"
import { SuspensionConfig } from "./components/SuspensionComponent"
import { InputSystem } from "./systems/InputSystem"

export class App {
    private renderer: THREE.WebGLRenderer
    private camera: THREE.PerspectiveCamera
    private controls: OrbitControls
    private sky: Sky
    private worldManager: WorldManager
    private car: Car | null = null
    private isNightMode: boolean = false

    // 성능 모니터링
    private frameCount: number = 0
    private lastFpsTime: number = 0
    private fps: number = 0

    private hud: HUD
    private joystick: Joystick

    private engine: Engine
    private loadingScreen: LoadingScreen
    private resourceManager: ResourceManager
    private scene: THREE.Scene
    private eventManager: EventManager
    private isInitialized: boolean = false
    private cameraController: CameraController | null = null

    constructor() {
        this.engine = Engine.getInstance()
        this.worldManager = WorldManager.getInstance()
        this.scene = this.engine.getScene()
        this.resourceManager = ResourceManager.getInstance()
        this.eventManager = new EventManager()

        this.renderer = this.engine.getRenderer()
        this.camera = this.engine.getCamera()
        this.cameraController = this.engine.getCameraController()

        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.setupControls()
        this.setupEventListeners()

        this.sky = new Sky()

        this.loadingScreen = new LoadingScreen()
        this.hud = new HUD()
        this.joystick = new Joystick()

        // animate 메서드를 바인딩
        this.animate = this.animate.bind(this)
    }

    private setupControls(): void {
        // OrbitControls 비활성화 (차량 추적 카메라만 사용)
        this.controls.enabled = false
    }

    private setupEventListeners(): void {
        this.onWindowResize = this.onWindowResize.bind(this)
        this.onKeyDown = this.onKeyDown.bind(this)

        window.addEventListener("resize", this.onWindowResize)
        window.addEventListener("keydown", this.onKeyDown)
    }

    private onWindowResize(): void {
        const width = window.innerWidth
        const height = window.innerHeight
        this.renderer.setSize(width, height)
        this.engine.getCameraController().onWindowResize()
    }

    private onKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case "n":
                this.toggleNightMode()
                break
            default:
                return // 다른 키는 전파 허용
        }
        // 'n' 키일 경우에만 이벤트 중단
        event.stopPropagation()
    }

    private toggleNightMode(): void {
        if (this.cameraController) {
            this.cameraController.toggleDayNight()
        }
        if (this.car) {
            // Car의 night mode 설정은 유지 (헤드라이트 등)
            this.car.setNightMode(!this.isNightMode) // isNightMode는 아직 변경되지 않은 상태
        }
        // 톤 매핑 노출값 조정
        this.renderer.toneMappingExposure = this.isNightMode ? 0.5 : 0.75

        // 상태 업데이트
        this.isNightMode = !this.isNightMode
    }

    public async initialize(container: HTMLElement): Promise<void> {
        if (this.isInitialized) {
            console.warn("App is already initialized")
            return
        }

        try {
            console.log("Initializing app...")
            this.loadingScreen.show()

            await this.engine.initialize(container)
            console.log("Engine initialized")
            this.loadingScreen.updateProgress(0.2)

            await this.resourceManager.initialize()
            console.log("Resource manager initialized")

            await this.worldManager.initialize()
            console.log("World manager initialized")
            this.loadingScreen.updateProgress(0.4)

            // 지형 디버깅
            const terrain = this.worldManager.getTerrain()
            if (!terrain) {
                throw new Error("Terrain not initialized")
            }

            // 차량 초기화 및 디버깅
            const physicsConfig: PhysicsConfig = {
                mass: 100, // 차량 질량 (kg)
                drag: 0.3, // 기본 항력 계수 (속도 제곱 비례 저항)
                maxSpeed: 100, // 최고 속도 (m/s)
                acceleration: 300, // 기본 가속력 (N)
                deceleration: 200, // 기본 제동력 (N, 브레이크 시)
                grip: 1.0, // 기본 타이어 그립 계수 (현재는 Drag 계산에서 제외됨, 추후 활용 가능)
                turnSpeed: 1.5, // 기본 회전 속도 계수
                momentOfInertia: 1000, // 관성 모멘트 (회전 저항, 현재 미사용)
                torqueCurve: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], // RPM별 엔진 토크 (현재 미사용)
                gearRatios: [3.0, 2.0, 1.5, 1.0, 0.8, 0.6], // 기어비 (현재 미사용)
                tireFriction: 10, // 타이어 마찰 계수 (횡력 계산에 영향)
                aerodynamicDrag: 0.3, // 공기 역학적 항력 계수 (속도 제곱 비례)
                liftCoefficient: 0.5, // 양력 계수 (고속에서 차체를 누르거나 뜨게 함)
                frontWheelDrive: true, // 전륜 구동 여부 (현재 미사용)
                rearWheelDrive: false, // 후륜 구동 여부 (현재 미사용)
                allWheelDrive: false, // 사륜 구동 여부 (현재 미사용)
                rollingResistanceCoefficient: 0.05, // 구름 저항 계수 (저속 감속에 중요)
                backwardAccelerationFactor: 0.7, // 후진 가속력 비율 (기본 가속력 대비)
                tireStiffnessMultiplier: 50, // 타이어 측면 강성 승수 (횡력 계산에 영향)
            }

            const suspensionConfig: SuspensionConfig = {
                stiffness: 100, // 서스펜션 스프링 강성
                damping: 0.5, // 서스펜션 댐핑 계수 (진동 흡수)
                compression: 0.1, // 서스펜션 압축 관련 값 (현재 미사용?)
                restLength: 2, // 서스펜션 기본 길이
                rollCenterHeight: 0.5, // 롤 센터 높이 (차체 기울어짐 기준점, 현재 미사용?)
                antiRollBar: 0.3, // 안티롤바 강성 (좌우 쏠림 억제)
                wheelRadius: 0.4, // 바퀴 반지름
                wheelWidth: 0.3, // 바퀴 폭
                rollPitchSensitivity: 0.0005, // 서스펜션 힘에 따른 롤/피치 각도 민감도
                rollPitchSmoothingFactor: 0.1, // 롤/피치 각도 변화 부드럽게 하는 계수 (Lerp)
            }

            const carConfig: CarConfig = {
                physics: physicsConfig,
                suspension: suspensionConfig,
                driftFactor: 0.5,
                rollInfluence: 0.5,
            }

            const inputSystem = this.engine.getInputSystem()

            // InputSystem 설정
            inputSystem.setKeyMapping({
                forward: "ArrowUp",
                backward: "ArrowDown",
                left: "ArrowLeft",
                right: "ArrowRight",
                brake: "b",
                handbrake: " ",
            })

            // Car 생성 로직을 WorldManager로 이동
            // this.car = new Car(this.worldManager, carConfig, inputSystem)
            // await this.car.initialize()
            // this.engine.addEntity(this.car)
            this.loadingScreen.updateProgress(0.6)
            this.car = await this.worldManager.createCar(carConfig, inputSystem)
            this.engine.addEntity(this.car) // Engine에는 여전히 Entity를 추가해야 함
            console.log("Car initialized and added to engine (via WorldManager)")

            // 카메라가 차량을 제대로 보게 설정
            const cameraController = this.engine.getCameraController()
            cameraController.setMode(CameraMode.FOLLOW)
            cameraController.setTarget(this.car)
            cameraController.setSmoothFactor(0.1)
            console.log("Camera controller set up for car")
            this.loadingScreen.updateProgress(0.8)

            // 씬에 객체 추가 로직 제거 (WorldManager에서 처리)
            // const carModel = this.car.getModel()
            // if (!carModel) {
            //     throw new Error("Car model not initialized")
            // }
            // console.log("Adding car model to scene:", carModel)
            // this.scene.add(carModel)
            // this.loadingScreen.updateProgress(0.6)
            // console.log("Car added to scene, total objects:", this.scene.children.length)

            // Sky 객체 추가
            this.sky.getMesh().scale.setScalar(10000)
            this.scene.add(this.sky.getMesh())
            console.log("Sky added to scene")

            this.hud.initialize()
            this.joystick.initialize()

            // InputSystem에 Joystick 인스턴스 설정
            if (inputSystem instanceof InputSystem) {
                // 타입 확인
                inputSystem.setJoystick(this.joystick)
            }

            this.loadingScreen.updateProgress(0.9)
            // 셰이더 사전 컴파일 시도 (첫 업데이트 전에 수행)
            console.log("Compiling shaders...")
            console.time("ShaderCompilation")
            this.renderer.compile(this.scene, this.camera)
            console.timeEnd("ShaderCompilation")
            console.log("Shaders compiled.")

            this.loadingScreen.hide()
            this.isInitialized = true
            console.log("App initialization complete")

            this.animate() // 애니메이션 루프 시작
        } catch (error) {
            console.error("App initialization failed:", error)
            this.loadingScreen.showError("Initialization failed. Please check the console.")
            // 초기화 실패 시 추가 처리 (예: 사용자 알림)
        } finally {
            // 로딩 완료 후 로딩 화면 정리
            // this.loadingScreen.hide(); // hide는 성공 시에만 호출되도록 위로 이동
        }
    }

    private animate(): void {
        // console.time("App.animate.frame") // 전체 프레임 시간 측정 시작
        requestAnimationFrame(this.animate)

        // console.time("App.Engine.update") // App에서 Engine 업데이트 호출 시간
        this.engine.update()
        // console.timeEnd("App.Engine.update")

        // WorldManager 업데이트는 주석 처리 가능성을 고려
        // console.time("App.WorldManager.update");
        // this.worldManager.update()
        // console.timeEnd("App.WorldManager.update");

        // console.time("App.App.update") // App 자체 업데이트 시간
        this.update()
        // console.timeEnd("App.App.update")

        // FPS 업데이트는 제외 (내부 로직이 간단)
        // this.updateFPS()

        // console.timeEnd("App.animate.frame") // 전체 프레임 시간 측정 종료
    }

    private update(): void {
        // console.time("App.update.inner")

        // WorldManager 업데이트 (EnvironmentManager 등 업데이트 포함)
        this.worldManager.update()

        // FPS 업데이트
        this.updateFPS()

        // Update OrbitControls (might be disabled)
        this.controls.update()
        // console.timeEnd("App.update.inner")
    }

    private updateFPS(): void {
        this.frameCount++
        const now = performance.now()
        if (now - this.lastFpsTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime))
            this.frameCount = 0
            this.lastFpsTime = now
            this.hud.updateFPS(this.fps)
        }
    }

    public dispose(): void {
        if (this.car) {
            this.car.dispose()
            this.car = null
        }
        this.sky.dispose()
        this.worldManager.dispose()
        this.engine.dispose()
        this.eventManager.dispose()
        window.removeEventListener("resize", this.onWindowResize)
        window.removeEventListener("keydown", this.onKeyDown)
    }
}

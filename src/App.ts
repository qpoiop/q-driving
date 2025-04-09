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
            this.loadingScreen.updateProgress(0.3)

            await this.worldManager.initialize()
            console.log("World manager initialized")
            this.loadingScreen.updateProgress(0.4)

            // 지형 디버깅
            const terrain = this.worldManager.getTerrain()
            if (!terrain) {
                throw new Error("Terrain not initialized")
            }
            this.loadingScreen.updateProgress(0.5)

            // 차량 초기화 및 디버깅
            const physicsConfig: PhysicsConfig = {
                mass: 100,
                drag: 0.1,
                maxSpeed: 80,
                acceleration: 300,
                deceleration: 200,
                grip: 1.0,
                turnSpeed: 0.8,
                momentOfInertia: 1000,
                torqueCurve: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
                gearRatios: [3.0, 2.0, 1.5, 1.0, 0.8, 0.6],
                tireFriction: 1.5,
                aerodynamicDrag: 0.3,
                liftCoefficient: 0.1,
                frontWheelDrive: true,
                rearWheelDrive: false,
                allWheelDrive: false,
            }

            const suspensionConfig: SuspensionConfig = {
                stiffness: 100,
                damping: 0.5,
                compression: 0.1,
                restLength: 2,
                rollCenterHeight: 0.5,
                antiRollBar: 0.3,
                wheelRadius: 0.4,
                wheelWidth: 0.3,
            }

            const carConfig: CarConfig = {
                physics: physicsConfig,
                suspension: suspensionConfig,
                driftFactor: 0.5,
                rollInfluence: 0.5,
            }

            const inputSystem = this.engine.getInputSystem()
            console.log("Creating car instance...")

            // InputSystem 설정
            inputSystem.setKeyMapping({
                forward: "ArrowUp",
                backward: "ArrowDown",
                left: "ArrowLeft",
                right: "ArrowRight",
                brake: "b",
                handbrake: " ",
            })

            this.car = new Car(terrain, carConfig, inputSystem)
            await this.car.initialize()
            this.engine.addEntity(this.car)
            console.log("Car initialized and added to engine")
            this.loadingScreen.updateProgress(0.5)

            // 카메라가 차량을 제대로 보게 설정
            const cameraController = this.engine.getCameraController()
            cameraController.setMode(CameraMode.FOLLOW)
            cameraController.setTarget(this.car)
            cameraController.setSmoothFactor(0.1)
            console.log("Camera controller set up for car")

            // 씬에 객체 추가
            const carModel = this.car.getModel()
            if (!carModel) {
                throw new Error("Car model not initialized")
            }
            console.log("Adding car model to scene:", carModel)
            this.scene.add(carModel)
            this.loadingScreen.updateProgress(0.6)
            console.log("Car added to scene, total objects:", this.scene.children.length)

            // Sky 객체 추가
            this.sky.getMesh().scale.setScalar(10000)
            this.scene.add(this.sky.getMesh())
            console.log("Sky added to scene")
            this.loadingScreen.updateProgress(0.8)

            this.hud.initialize()
            this.joystick.initialize()
            this.loadingScreen.updateProgress(0.9)

            // 초기 렌더링 수행
            this.engine.update()
            this.loadingScreen.updateProgress(1)

            this.loadingScreen.hide()
            this.isInitialized = true
            console.log("App initialization complete")

            // 로딩 완료 처리
            this.loadingScreen.updateProgress(1.0)
            setTimeout(() => {
                this.loadingScreen.hide()
            }, 500)

            // 애니메이션 루프 시작
            this.animate()
        } catch (error) {
            console.error("App initialization failed:", error)
            this.loadingScreen.showError("Initialization failed")
        }
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this))
        this.engine.update()
        this.update()
    }

    private update(): void {
        this.updateFPS()
        this.controls.update()
        if (this.car) {
            this.hud.updateSpeed(this.car.getSpeed())
        }
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

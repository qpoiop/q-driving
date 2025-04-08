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
import { Time } from "./core/Time"
import { TransformComponent } from "./components/TransformComponent"
import { CameraMode } from "./core/CameraController"

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

    // 카메라 추적
    private prevCameraTarget: THREE.Vector3

    private hud: HUD
    private joystick: Joystick
    private ambient: THREE.AmbientLight
    private directional: THREE.DirectionalLight

    private engine: Engine
    private loadingScreen: LoadingScreen
    private resourceManager: ResourceManager
    private scene: THREE.Scene
    private eventManager: EventManager
    private isInitialized: boolean = false

    constructor() {
        this.engine = Engine.getInstance()
        this.worldManager = WorldManager.getInstance()
        this.scene = this.engine.getScene()
        this.resourceManager = ResourceManager.getInstance()
        this.eventManager = new EventManager()

        this.renderer = this.engine.getRenderer()
        this.camera = this.engine.getCamera()

        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.setupControls()
        this.setupEventListeners()

        this.sky = new Sky()

        this.loadingScreen = new LoadingScreen()
        this.hud = new HUD()
        this.joystick = new Joystick()

        this.ambient = new THREE.AmbientLight(0xffffff, 0.5)
        this.directional = new THREE.DirectionalLight(0xffffff, 0.5)
        this.directional.position.set(5, 5, 5)

        this.prevCameraTarget = new THREE.Vector3()

        // animate 메서드를 바인딩
        this.animate = this.animate.bind(this)
    }

    private setupControls(): void {
        // OrbitControls 비활성화 (차량 추적 카메라만 사용)
        this.controls.enabled = false
    }

    private setupEventListeners(): void {
        window.addEventListener("resize", this.onWindowResize.bind(this))
        window.addEventListener("keydown", this.onKeyDown.bind(this))
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
        }
    }

    private toggleNightMode(): void {
        this.isNightMode = !this.isNightMode
        this.sky.setNightMode(this.isNightMode)
        this.ambient.intensity = this.isNightMode ? 0.1 : 0.5
        this.directional.intensity = this.isNightMode ? 0.1 : 0.5
        if (this.car) {
            this.car.setNightMode(this.isNightMode)
        }
        this.renderer.toneMappingExposure = this.isNightMode ? 0.5 : 0.75
    }

    public async initialize(container: HTMLElement): Promise<void> {
        if (this.isInitialized) {
            console.warn("App is already initialized")
            return
        }

        try {
            console.log("Starting initialization...")
            this.loadingScreen.show()

            await this.engine.initialize(container)
            console.log("Engine initialized")
            this.loadingScreen.updateProgress(0.2)

            await this.resourceManager.initialize()
            console.log("Resource manager initialized")
            this.loadingScreen.updateProgress(0.3)

            await this.worldManager.initialize()
            console.log("World manager initialized")

            // 지형 디버깅
            const terrain = this.worldManager.getTerrain()
            if (!terrain) {
                throw new Error("Terrain not initialized")
            }

            // 차량 초기화 및 디버깅
            const carConfig = {
                maxSpeed: 20,
                acceleration: 10,
                deceleration: 5,
                turnSpeed: 2,
                grip: 0.8,
                driftFactor: 0.5,
                suspensionStiffness: 20,
                suspensionDamping: 2.3,
                suspensionCompression: 4.4,
                suspensionRestLength: 0.5,
                rollInfluence: 0.1,
            }
            const inputSystem = this.engine.getInputSystem()
            console.log("Creating car instance...")
            this.car = new Car(terrain, carConfig, inputSystem)
            await this.car.initialize()
            console.log("Car initialized")

            // 차량 위치 디버깅
            const carTransform = this.car.getComponent<TransformComponent>("transform")
            if (carTransform) {
                const height = terrain.getHeightAt(0, 0, 0)
                console.log("Terrain height at car position:", height)
                carTransform.setPosition(0, height + 2, 0) // 지면보다 2 단위 위에 위치
                const position = carTransform.getPosition()
                console.log("Car position after set:", position)

                // 카메라가 차량을 제대로 보게 설정
                const cameraController = this.engine.getCameraController()
                cameraController.setMode(CameraMode.FOLLOW)
                cameraController.setTarget(this.car.getModel())
                cameraController.setSmoothFactor(0.1)
                console.log("Camera controller set up for car")
            }

            // 씬에 객체 추가
            const carModel = this.car.getModel()
            if (!carModel) {
                throw new Error("Car model not initialized")
            }
            console.log("Adding car model to scene:", carModel)
            this.scene.add(carModel)
            console.log("Car added to scene, total objects:", this.scene.children.length)

            // 조명 설정 수정
            this.directional.position.set(50, 50, 50)
            this.directional.castShadow = true
            this.directional.shadow.mapSize.width = 2048
            this.directional.shadow.mapSize.height = 2048
            this.directional.shadow.camera.near = 0.5
            this.directional.shadow.camera.far = 500
            this.directional.shadow.camera.left = -100
            this.directional.shadow.camera.right = 100
            this.directional.shadow.camera.top = 100
            this.directional.shadow.camera.bottom = -100

            // 조명 강도 증가
            this.ambient.intensity = 1.0
            this.directional.intensity = 1.0

            this.sky.getMesh().scale.setScalar(10000)
            this.scene.add(this.sky.getMesh())
            this.scene.add(this.ambient)
            this.scene.add(this.directional)
            console.log("Lights and sky added to scene")

            await this.hud.initialize()
            this.loadingScreen.updateProgress(0.8)

            await this.joystick.initialize()
            this.loadingScreen.updateProgress(0.9)

            this.isInitialized = true
            console.log("Initialization complete")

            // 로딩 완료 처리
            this.loadingScreen.updateProgress(1.0)
            setTimeout(() => {
                this.loadingScreen.hide()
            }, 500)

            // 애니메이션 시작
            this.animate()
        } catch (error) {
            console.error("Failed to initialize app:", error)
            throw error
        }
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this))
        this.update()
        this.render()
    }

    private update(): void {
        this.updateFPS()
        this.controls.update()
        if (this.car) {
            this.car.update(Time.getDeltaTime())
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

    private render(): void {
        if (!this.isInitialized) {
            return
        }

        // 씬 렌더링
        this.renderer.render(this.scene, this.camera)
    }

    public dispose(): void {
        if (this.car) {
            this.car.dispose()
            this.car = null
        }
        this.sky.dispose()
        this.worldManager.dispose()
        this.engine.dispose()
        this.renderer.dispose()
        this.eventManager.dispose()
        window.removeEventListener("resize", this.onWindowResize.bind(this))
    }
}

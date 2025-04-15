import * as THREE from "three"
import { EntityManager } from "./EntityManager"
import { SystemManager } from "./SystemManager"
import { Time } from "./Time"
import { Entity } from "./Entity"
import { System } from "./System"
import { InputSystem } from "../systems/InputSystem"
import { CameraController } from "./CameraController"

export class Engine {
    private static instance: Engine | null = null
    private scene: THREE.Scene
    private camera: THREE.PerspectiveCamera
    private renderer: THREE.WebGLRenderer
    private entityManager: EntityManager
    private systemManager: SystemManager
    private inputSystem: InputSystem
    private cameraController: CameraController
    private isInitialized: boolean = false

    private constructor() {
        Time.getInstance()
        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        this.cameraController = new CameraController(this.camera)
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
        })
        this.entityManager = new EntityManager()
        this.systemManager = new SystemManager()
        this.inputSystem = new InputSystem()
        this.systemManager.addSystem(this.inputSystem)
    }

    public static getInstance(): Engine {
        if (!Engine.instance) {
            Engine.instance = new Engine()
        }
        return Engine.instance
    }

    public async initialize(container: HTMLElement): Promise<void> {
        if (this.isInitialized) {
            return
        }

        try {
            // 씬 초기화
            this.scene.background = new THREE.Color(0x87ceeb)

            // 렌더러 설정
            this.renderer.setSize(window.innerWidth, window.innerHeight)
            this.renderer.setPixelRatio(window.devicePixelRatio)
            container.appendChild(this.renderer.domElement)

            // 시스템 매니저 초기화
            await this.systemManager.initialize()

            // 엔티티 매니저 초기화
            await this.entityManager.initialize()

            this.isInitialized = true
            console.log("Engine initialized with camera position:", this.camera.position)
        } catch (error) {
            console.error("Engine initialization failed:", error)
            throw error
        }
    }

    public update(): void {
        if (!this.isInitialized) {
            console.warn("Engine not initialized")
            return
        }
        console.time("Engine.update.total") // 엔진 전체 업데이트 시간

        // 시간 업데이트
        console.time("Engine.TimeUpdate")
        Time.update()
        console.timeEnd("Engine.TimeUpdate")

        // 시스템 업데이트
        console.time("Engine.SystemUpdate")
        this.systemManager.update(Time.getDeltaTime())
        console.timeEnd("Engine.SystemUpdate")

        // 엔티티 업데이트
        console.time("Engine.EntityUpdate")
        this.entityManager.update(Time.getDeltaTime())
        console.timeEnd("Engine.EntityUpdate")

        // 카메라 업데이트
        console.time("Engine.CameraUpdate")
        this.cameraController.update(Time.getDeltaTime())
        console.timeEnd("Engine.CameraUpdate")

        // 렌더링
        if (this.scene && this.camera) {
            console.time("Engine.Renderer.render") // 렌더링 시간 측정 시작
            this.renderer.render(this.scene, this.camera)
            console.timeEnd("Engine.Renderer.render") // 렌더링 시간 측정 종료
        } else {
            console.warn("Scene or camera not initialized")
        }
        console.timeEnd("Engine.update.total") // 엔진 전체 업데이트 시간 종료
    }

    private updateCamera(): void {
        // 카메라 위치와 방향 업데이트 로직
        // CameraController에서 처리
    }

    public setCameraTarget(target: THREE.Object3D): void {
        // 카메라 추적 대상 설정
        // CameraController에서 처리
    }

    public getScene(): THREE.Scene {
        return this.scene
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera
    }

    public getCameraController(): CameraController {
        return this.cameraController
    }

    public getRenderer(): THREE.WebGLRenderer {
        return this.renderer
    }

    public getInputSystem(): InputSystem {
        return this.inputSystem
    }

    public addEntity(entity: Entity): void {
        this.entityManager.addEntity(entity)
    }

    public addSystem(system: System): void {
        this.systemManager.addSystem(system)
    }

    public dispose(): void {
        this.entityManager.dispose()
        this.systemManager.dispose()
        this.renderer.dispose()
        Engine.instance = null
    }
}

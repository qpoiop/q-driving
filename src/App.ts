import * as THREE from "three"
import { Car } from "./entities/Car"
import { createSky, updateSun } from "./scene/Sky"
import { InputSystem } from "./systems/InputSystem"
import { CenterLine } from "./entities/CenterLine"
import { RoadPath } from "./entities/RoadPath"
import { RoadMesh } from "./entities/RoadMesh"
import { Hud } from "./ui/Hud"
import { Joystick } from "./ui/Joystick"
import { WorldManager } from "./systems/WorldManager"
import { LoadingScreen } from "./ui/LoadingScreen"

let isNight = false

export class App {
    private scene = new THREE.Scene()
    private camera: THREE.PerspectiveCamera
    private renderer: THREE.WebGLRenderer
    private clock = new THREE.Clock()
    private lastUpdateTime = 0
    private readonly updateInterval = 1000 / 60 // 60fps
    private loadingScreen = new LoadingScreen()
    private frameCount = 0
    private lastFpsTime = 0
    private fps = 0
    private raycaster = new THREE.Raycaster()
    private lastObstructingObjects: THREE.Object3D[] = []

    private input = new InputSystem()
    private car: Car
    private hud: Hud
    private world: WorldManager
    private joystick: Joystick
    private ambient!: THREE.AmbientLight
    private directional!: THREE.DirectionalLight
    private prevCameraTarget = new THREE.Vector3()

    constructor(private container: HTMLElement) {
        // 로딩 화면 표시
        this.loadingScreen.show()

        this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000)
        // 카메라 초기 위치 설정
        this.camera.position.set(0, 5, -10)
        this.camera.lookAt(0, 0, 0)

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
        })
        this.renderer.setSize(container.clientWidth, container.clientHeight)
        this.renderer.setPixelRatio(/Mobi|Android/i.test(navigator.userAgent) ? 1 : Math.min(window.devicePixelRatio, 1.5))
        this.renderer.shadowMap.enabled = true
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.toneMappingExposure = 0.75
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        container.appendChild(this.renderer.domElement)

        createSky(this.scene, this.renderer)

        this.ambient = new THREE.AmbientLight(0xffffff, 0.3)
        this.scene.add(this.ambient)

        this.directional = new THREE.DirectionalLight(0xffffff, 0.6)
        this.directional.position.set(0, 20, 20)
        this.directional.castShadow = true
        this.directional.shadow.mapSize.width = 2048
        this.directional.shadow.mapSize.height = 2048
        this.directional.shadow.camera.near = 0.5
        this.directional.shadow.camera.far = 500
        this.directional.shadow.camera.left = -50
        this.directional.shadow.camera.right = 50
        this.directional.shadow.camera.top = 50
        this.directional.shadow.camera.bottom = -50
        this.directional.shadow.bias = -0.001
        this.directional.shadow.normalBias = 0.02
        this.directional.shadow.radius = 1.5
        this.scene.add(this.directional, this.directional.target)

        this.joystick = new Joystick()
        this.initialize()
        this.addResizeListener()
        document.addEventListener("keydown", e => {
            if (e.key.toLowerCase() === "l") {
                this.toggleNightMode()
            }
        })
    }

    private async initialize() {
        try {
            this.loadingScreen.updateProgress(0.1)

            // WorldManager 초기화
            this.world = new WorldManager(this.scene)
            await this.world.init(new THREE.Vector3(0, 0, 0))
            this.loadingScreen.updateProgress(0.3)

            // 지형 생성
            const roadPath = new RoadPath()
            const roadMesh = new RoadMesh(roadPath, pos => this.world.getHeightAt(pos), 4)
            this.scene.add(roadMesh.mesh)
            this.loadingScreen.updateProgress(0.5)

            // 중앙선 생성
            const centerLine = new CenterLine(roadPath)
            this.scene.add(centerLine.meshGroup)
            this.loadingScreen.updateProgress(0.6)

            // 차량 초기화
            this.car = new Car(this.scene, this.input, this.world, this.joystick)
            this.car.setInitial({
                position: new THREE.Vector3(0, 0.5, 0),
                rotation: new THREE.Euler(0, 0, 0),
                scale: new THREE.Vector3(1.8, 1.8, 1.8),
            })
            await this.car.load()
            this.loadingScreen.updateProgress(0.8)

            // HUD 초기화
            this.hud = new Hud()
            this.loadingScreen.updateProgress(0.9)

            // SceneryManager 초기화
            await this.world.scenery.init()
            this.loadingScreen.updateProgress(1.0)

            // 모든 초기화가 완료된 후 애니메이션 시작
            if (this.renderer && this.scene && this.camera) {
                this.animate()
            }

            this.loadingScreen.hide()
        } catch (error) {
            console.error("초기화 실패:", error)
            this.loadingScreen.hide()
            // 에러 발생 시 사용자에게 알림
            alert("게임 초기화에 실패했습니다. 페이지를 새로고침해주세요.")
        }
    }

    private animate = () => {
        requestAnimationFrame(this.animate)

        if (!this.renderer || !this.scene || !this.camera) return

        const currentTime = this.clock.getElapsedTime()
        const deltaTime = currentTime - this.lastUpdateTime

        if (deltaTime >= this.updateInterval) {
            this.update()
            this.lastUpdateTime = currentTime
        }

        this.render()
    }

    private update() {
        if (!this.car.mesh) return

        this.car.update()
        this.world.update(this.car.position)

        // 카메라 위치 업데이트
        const cameraTarget = this.car.position.clone()
        this.prevCameraTarget.lerp(cameraTarget, 0.1)

        // 차량 뒤쪽 상단에 카메라 위치 조정
        const cameraOffset = new THREE.Vector3(0, 3, -8)
        cameraOffset.applyQuaternion(this.car.quaternion)
        this.camera.position.copy(this.prevCameraTarget).add(cameraOffset)

        // 차량 앞쪽을 바라보도록 설정
        const lookAtOffset = new THREE.Vector3(0, 0.5, 4)
        lookAtOffset.applyQuaternion(this.car.quaternion)
        const lookAtPoint = this.prevCameraTarget.clone().add(lookAtOffset)
        this.camera.lookAt(lookAtPoint)

        // 카메라와 차량 사이의 장애물 감지 및 처리
        this.handleCameraObstruction()

        this.world.scenery.updateVisibility(this.camera)
        this.hud.update(this.car.getSpeed())
    }

    private handleCameraObstruction() {
        if (!this.car.mesh) return

        // 이전에 투명했던 물체들을 원래 상태로 복구
        this.lastObstructingObjects.forEach(obj => {
            if (obj instanceof THREE.Mesh && obj.material instanceof THREE.Material) {
                obj.material.transparent = false
                obj.material.opacity = 1.0
            }
        })
        this.lastObstructingObjects = []

        // 카메라에서 차량까지의 방향 벡터 계산
        const carPosition = this.car.position.clone()
        carPosition.y += 1 // 차량의 중심점을 약간 위로 조정
        const direction = carPosition.clone().sub(this.camera.position)
        const distance = direction.length()
        direction.normalize()

        // 레이캐스터 설정
        this.raycaster.set(this.camera.position, direction)
        this.raycaster.far = distance // 레이캐스터의 최대 거리를 차량까지의 거리로 제한

        // 모든 물체를 대상으로 레이캐스팅 수행
        const intersects = this.raycaster.intersectObjects(this.scene.children, true)

        // 차량까지의 거리보다 가까운 물체들을 반투명하게 처리
        for (const intersect of intersects) {
            const obj = intersect.object
            if (obj instanceof THREE.Mesh) {
                // 차량이나 차량의 부품이 아닌 경우에만 처리
                let isCarPart = false
                let parent: THREE.Object3D | null = obj
                while (parent && parent.parent) {
                    if (parent === this.car.mesh) {
                        isCarPart = true
                        break
                    }
                    parent = parent.parent
                }

                if (!isCarPart && obj.material instanceof THREE.Material) {
                    obj.material.transparent = true
                    obj.material.opacity = 0.3
                    obj.material.depthWrite = false // 투명한 객체의 깊이 쓰기 비활성화
                    this.lastObstructingObjects.push(obj)
                }
            }
        }
    }

    private render() {
        if (!this.renderer || !this.scene || !this.camera) return

        // 씬과 카메라가 준비되었는지 확인
        if (!this.scene.children.length || !this.camera.matrixWorldInverse) return

        this.renderer.render(this.scene, this.camera)
    }

    private addResizeListener() {
        const debouncedResize = this.debounce(() => {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight
            this.camera.updateProjectionMatrix()
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
        }, 250)

        window.addEventListener("resize", debouncedResize)
    }

    private debounce(func: Function, wait: number) {
        let timeout: number | null = null
        return (...args: any[]) => {
            if (timeout) window.clearTimeout(timeout)
            timeout = window.setTimeout(() => func.apply(this, args), wait)
        }
    }

    private toggleNightMode() {
        isNight = !isNight
        updateSun(isNight ? -20 : 45, 180, this.scene, this.renderer)
        this.ambient.intensity = isNight ? 0.1 : 0.3
        this.directional.intensity = isNight ? 0.1 : 0.6
        if (this.car) {
            this.car.toggleLights(isNight)
        }
        this.renderer.toneMappingExposure = isNight ? 0.5 : 0.75
    }
}

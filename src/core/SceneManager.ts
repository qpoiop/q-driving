import * as THREE from "three"

export class SceneManager {
    private scene: THREE.Scene
    protected camera: THREE.PerspectiveCamera
    protected renderer: THREE.WebGLRenderer
    private ambientLight: THREE.AmbientLight
    private directionalLight: THREE.DirectionalLight

    constructor() {
        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)

        this.initialize()
    }

    private initialize(): void {
        // 씬 설정
        this.scene.background = new THREE.Color(0x87ceeb) // 하늘색 배경
        this.scene.add(this.ambientLight)
        this.scene.add(this.directionalLight)

        // 카메라 설정
        this.camera.position.set(0, 5, 10)
        this.camera.lookAt(0, 0, 0)

        // 렌더러 설정
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(window.devicePixelRatio)
        this.renderer.shadowMap.enabled = true
        document.body.appendChild(this.renderer.domElement)

        // 윈도우 리사이즈 이벤트 처리
        window.addEventListener("resize", () => this.onWindowResize())
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    public getScene(): THREE.Scene {
        return this.scene
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera
    }

    public getRenderer(): THREE.WebGLRenderer {
        return this.renderer
    }

    public render(): void {
        this.renderer.render(this.scene, this.camera)
    }

    public dispose(): void {
        window.removeEventListener("resize", () => this.onWindowResize())
        this.renderer.dispose()
    }
}

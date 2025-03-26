import * as THREE from "three"
import { InputSystem } from "./systems/InputSystem"
import { Car } from "./entities/Car"

export class App {
    private scene: THREE.Scene
    private camera: THREE.PerspectiveCamera
    private renderer: THREE.WebGLRenderer

    private input = new InputSystem()
    private car: Car

    constructor(private container: HTMLElement) {
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x202020)

        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)
        this.camera.position.set(0, 2, 5)

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(container.clientWidth, container.clientHeight)
        this.renderer.setPixelRatio(window.devicePixelRatio)
        container.appendChild(this.renderer.domElement)

        const light = new THREE.DirectionalLight(0xffffff, 1)
        light.position.set(5, 10, 5)
        this.scene.add(light)

        const grid = new THREE.GridHelper(100, 100)
        this.scene.add(grid)

        this.car = new Car(this.scene, this.input)

        this.animate()
        this.addResizeListener()
    }

    private animate = () => {
        requestAnimationFrame(this.animate)

        this.car.update()

        const targetPos = this.car.position
        const offset = new THREE.Vector3(0, 2.5, -6).applyQuaternion(this.car.quaternion)
        const cameraTarget = new THREE.Vector3().copy(targetPos).add(offset)

        this.camera.position.lerp(cameraTarget, 0.1)
        this.camera.lookAt(targetPos)

        this.renderer.render(this.scene, this.camera)
    }

    private addResizeListener() {
        window.addEventListener("resize", () => {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight
            this.camera.updateProjectionMatrix()
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
        })
    }
}

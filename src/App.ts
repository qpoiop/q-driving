import * as THREE from "three"
import { InputSystem } from "./systems/InputSystem"
import { Car } from "./entities/Car"
import { Terrain } from "./entities/Terrain"
import { createSky } from "./scene/Sky"

export class App {
    private scene: THREE.Scene
    private camera: THREE.PerspectiveCamera
    private renderer: THREE.WebGLRenderer

    private input = new InputSystem()
    private car: Car

    constructor(private container: HTMLElement) {
        this.scene = new THREE.Scene()

        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)
        this.camera.position.set(0, 4, 8)

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(container.clientWidth, container.clientHeight)
        this.renderer.setPixelRatio(window.devicePixelRatio)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.toneMappingExposure = 1.0
        container.appendChild(this.renderer.domElement)

        createSky(this.renderer, this.scene)

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4))

        const light = new THREE.DirectionalLight(0xffffff, 1)
        light.position.set(10, 10, 10)
        light.target.position.set(0, 0, 0)
        this.scene.add(light)
        this.scene.add(light.target)

        const terrain = new Terrain()
        this.scene.add(terrain.mesh)

        this.car = new Car(this.scene, this.input)

        this.animate()
        this.addResizeListener()
    }

    private animate = () => {
        requestAnimationFrame(this.animate)

        this.car.update()

        const targetPos = this.car.position
        const offset = new THREE.Vector3(0, 2.5, 6).applyQuaternion(this.car.quaternion)
        const cameraTarget = new THREE.Vector3().copy(targetPos).add(offset)

        const lookAtPos = targetPos.clone()
        lookAtPos.y += 1.0

        this.camera.position.lerp(cameraTarget, 0.1)
        this.camera.lookAt(lookAtPos)

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

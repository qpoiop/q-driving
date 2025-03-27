import * as THREE from "three"
import { InputSystem } from "./systems/InputSystem"
import { Car } from "./entities/Car"

import { PMREMGenerator } from "three"
import { Terrain } from "./entities/Terrain"
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js"

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
        this.camera.position.set(0, 6, 10)

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(container.clientWidth, container.clientHeight)
        this.renderer.setPixelRatio(window.devicePixelRatio)
        container.appendChild(this.renderer.domElement)

        const pmrem = new PMREMGenerator(this.renderer)
        pmrem.compileEquirectangularShader()

        new RGBELoader().load("/assets/sky/goegap.hdr", hdrTexture => {
            const envMap = pmrem.fromEquirectangular(hdrTexture).texture
            this.scene.environment = envMap
            this.scene.background = envMap

            hdrTexture.dispose()
            pmrem.dispose()
        })

        const grid = new THREE.GridHelper(1000, 100)
        this.scene.add(grid)

        const ambient = new THREE.AmbientLight(0xffffff, 0.4)
        this.scene.add(ambient)

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

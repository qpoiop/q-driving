import * as THREE from "three"
import { Car } from "./entities/Car"
import { Terrain } from "./entities/Terrain"
import { createSky } from "./scene/Sky"
import { InputSystem } from "./systems/InputSystem"
import { CenterLine } from "./entities/CenterLine"
import { RoadPath } from "./entities/RoadPath"
import { RoadMesh } from "./entities/RoadMesh"

export class App {
    private scene: THREE.Scene
    private camera: THREE.PerspectiveCamera
    private renderer: THREE.WebGLRenderer

    private input = new InputSystem()
    private car: Car

    constructor(private container: HTMLElement) {
        this.scene = new THREE.Scene()

        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(container.clientWidth, container.clientHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.toneMappingExposure = 0.75
        container.appendChild(this.renderer.domElement)

        createSky(this.renderer, this.scene)

        const ambient = new THREE.AmbientLight(0xffffff, 0.3)
        this.scene.add(ambient)

        const light = new THREE.DirectionalLight(0xffffff, 0.6)
        light.position.set(10, 10, 10)
        this.scene.add(light)
        this.scene.add(light.target)

        // Terrain
        const terrain = new Terrain({
            size: 500,
            resolution: 256,
            heightScale: 3,
            flattenWidth: 10,
            textureRepeat: 200,
        })
        this.scene.add(terrain.mesh)

        // Road
        const roadPath = new RoadPath()
        const roadMesh = new RoadMesh(roadPath, 2.5)

        this.scene.add(roadMesh.mesh)

        const centerLine = new CenterLine(roadPath)
        this.scene.add(centerLine.meshGroup)

        // Car
        this.car = new Car(this.scene, this.input)
        this.car.setInitial({
            position: new THREE.Vector3(0, 0.5, -25),
            rotation: new THREE.Euler(0, 0, 0),
            scale: new THREE.Vector3(1.8, 1.8, 1.8),
        })

        this.car.load()

        this.animate()
        this.addResizeListener()
    }

    private animate = () => {
        requestAnimationFrame(this.animate)

        this.car.update()

        const targetPos = this.car.position
        const offset = new THREE.Vector3(0, 3, 12).applyQuaternion(this.car.quaternion)
        const cameraTarget = new THREE.Vector3().copy(targetPos).add(offset)

        const lookAt = targetPos.clone()
        lookAt.y += 1

        this.camera.position.lerp(cameraTarget, 0.1)
        this.camera.lookAt(lookAt)

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

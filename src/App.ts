import * as THREE from "three"
import { Car } from "./entities/Car"
import { Terrain } from "./entities/Terrain"
import { createPhysicalSky, updateSun } from "./scene/Sky"
import { InputSystem } from "./systems/InputSystem"
import { CenterLine } from "./entities/CenterLine"
import { RoadPath } from "./entities/RoadPath"
import { RoadMesh } from "./entities/RoadMesh"
import { GroundTracker } from "./systems/GroundTracker"
import { Hud } from "./ui/Hud"

let isNight = false

export class App {
    private scene: THREE.Scene
    private camera: THREE.PerspectiveCamera
    private renderer: THREE.WebGLRenderer

    private input = new InputSystem()
    private car: Car
    private hud: Hud

    constructor(private container: HTMLElement) {
        this.scene = new THREE.Scene()

        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(container.clientWidth, container.clientHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.toneMappingExposure = isNight ? 1.1 : 0.75
        // WebGLRenderer 설정 강화
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

        container.appendChild(this.renderer.domElement)

        createPhysicalSky(this.scene, this.renderer)

        // Ambient Light
        const ambient = new THREE.AmbientLight(0xffffff, 0.3)
        ambient.name = "ambient"
        this.scene.add(ambient)

        // Directional Light (태양 역할)
        const light = new THREE.DirectionalLight(0xffffff, 0.6)
        light.name = "sun"
        light.position.set(0, 20, 20)
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
        const roadMesh = new RoadMesh(roadPath, 4)
        roadMesh.mesh.name = "roadMesh"
        this.scene.add(roadMesh.mesh)

        const centerLine = new CenterLine(roadPath)
        this.scene.add(centerLine.meshGroup)

        // Car
        const tracker = new GroundTracker(terrain.mesh)
        this.car = new Car(this.scene, this.input, tracker)
        this.car.setInitial({
            position: new THREE.Vector3(0, 0.5, -25),
            rotation: new THREE.Euler(0, 0, 0),
            scale: new THREE.Vector3(1.8, 1.8, 1.8),
        })
        this.car.load()

        this.hud = new Hud()
        this.animate()
        this.addResizeListener()

        window.addEventListener("keydown", e => {
            if (e.key === "l" || e.key === "L") this.toggleNightMode()
        })
    }

    private animate = () => {
        requestAnimationFrame(this.animate)

        this.car.update()
        this.hud.update(this.car.getSpeed() ?? 0, "D", isNight ? "NIGHT" : "DAY")

        const targetPos = this.car.position
        const offset = new THREE.Vector3(0, 4, -8).applyQuaternion(this.car.quaternion)
        const cameraTarget = new THREE.Vector3().copy(targetPos).add(offset)

        const lookAt = targetPos.clone()
        lookAt.y += 1

        this.camera.position.lerp(cameraTarget, 0.25)
        this.camera.lookAt(lookAt)

        this.renderer.render(this.scene, this.camera)
    }

    private toggleNightMode() {
        isNight = !isNight
        updateSun(isNight ? 2 : 45, isNight ? 180 : 90, this.scene, this.renderer)

        const ambient = this.scene.getObjectByName("ambient") as THREE.AmbientLight
        if (ambient) ambient.intensity = isNight ? 0.05 : 0.3

        const directional = this.scene.getObjectByName("sun") as THREE.DirectionalLight
        if (directional) directional.intensity = isNight ? 0.1 : 0.6

        this.car.toggleLights(isNight)
    }

    private addResizeListener() {
        window.addEventListener("resize", () => {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight
            this.camera.updateProjectionMatrix()
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
        })
    }
}

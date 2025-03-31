import * as THREE from "three"
import { Car } from "./entities/Car"
import { Terrain } from "./entities/Terrain"
import { createSky, updateSun } from "./scene/Sky"
import { InputSystem } from "./systems/InputSystem"
import { CenterLine } from "./entities/CenterLine"
import { RoadPath } from "./entities/RoadPath"
import { RoadMesh } from "./entities/RoadMesh"
import { GroundTracker } from "./systems/GroundTracker"
import { Hud } from "./ui/Hud"

let isNight = false

export class App {
    private scene = new THREE.Scene()
    private camera: THREE.PerspectiveCamera
    private renderer: THREE.WebGLRenderer

    private input = new InputSystem()
    private car: Car
    private hud: Hud
    private ambient!: THREE.AmbientLight
    private directional!: THREE.DirectionalLight

    constructor(private container: HTMLElement) {
        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(container.clientWidth, container.clientHeight)
        this.renderer.setPixelRatio(/Mobi|Android/i.test(navigator.userAgent) ? 1 : Math.min(window.devicePixelRatio, 1.5))
        this.renderer.shadowMap.enabled = !/Mobi|Android/i.test(navigator.userAgent)
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
        this.scene.add(this.directional, this.directional.target)

        const terrain = new Terrain({
            size: 500,
            resolution: 128,
            heightScale: 3,
            flattenWidth: 10,
            textureRepeat: 200,
        })
        this.scene.add(terrain.mesh)

        const tracker = new GroundTracker(terrain.mesh)

        const roadPath = new RoadPath()
        const roadMesh = new RoadMesh(roadPath, pos => tracker.getHeightAt(pos), 4)
        this.scene.add(roadMesh.mesh)

        const centerLine = new CenterLine(roadPath)
        this.scene.add(centerLine.meshGroup)

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
            if (e.key.toLowerCase() === "l") this.toggleNightMode()
        })
    }

    private animate = () => {
        requestAnimationFrame(this.animate)
        this.car.update()
        this.hud.update(this.car.getSpeed() ?? 0, "D", isNight ? "NIGHT" : "DAY")

        const targetPos = this.car.position
        const offset = new THREE.Vector3(0, 4, -8).applyQuaternion(this.car.quaternion)
        const cameraTarget = targetPos.clone().add(offset)
        const lookAt = targetPos.clone().add(new THREE.Vector3(0, 1, 0))

        this.camera.position.lerp(cameraTarget, 0.25)
        this.camera.quaternion.slerp(
            new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(this.camera.position, lookAt, new THREE.Vector3(0, 1, 0))),
            0.15,
        )

        this.renderer.render(this.scene, this.camera)
    }

    private toggleNightMode() {
        isNight = !isNight
        updateSun(isNight ? 2 : 45, isNight ? 180 : 90, this.scene, this.renderer)
        this.ambient.intensity = isNight ? 0.05 : 0.3
        this.directional.intensity = isNight ? 0.1 : 0.6
        this.car.toggleLights(isNight)
        this.renderer.toneMappingExposure = isNight ? 1.0 : 0.75
    }

    private addResizeListener() {
        window.addEventListener("resize", () => {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight
            this.camera.updateProjectionMatrix()
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
        })
    }
}

import * as THREE from "three"
import { WorldManager } from "./WorldManager"
import { Entity } from "./Entity"
import { TransformComponent } from "../components/TransformComponent"

export enum CameraMode {
    FREE,
    FOLLOW,
    ORBIT,
}

export class CameraController {
    private camera: THREE.PerspectiveCamera
    private target: Entity | null = null
    private mode: CameraMode = CameraMode.FREE
    private smoothFactor: number = 0.25
    private lookAtOffset: THREE.Vector3 = new THREE.Vector3(0, 1, 0)
    private followOffset: THREE.Vector3 = new THREE.Vector3(0, 2, -4)
    private currentLookAt: THREE.Vector3 = new THREE.Vector3()
    private isDay: boolean = true

    // Quaternions for smooth lookAt interpolation
    private currentCamQuat: THREE.Quaternion = new THREE.Quaternion()

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera
        this.initialize()
    }

    private initialize(): void {
        this.camera.position.set(0, 5, 15)
        this.camera.lookAt(0, 0, 0)
        this.camera.fov = 55
        this.camera.near = 0.1
        this.camera.far = 1000
        this.camera.updateProjectionMatrix()
        this.currentLookAt.copy(this.camera.position).add(new THREE.Vector3(0, 0, -1))
        this.currentCamQuat.copy(this.camera.quaternion)
    }

    public toggleDayNight(): void {
        WorldManager.getInstance().toggleDayNight()
        this.isDay = !this.isDay
    }

    public setMode(mode: CameraMode): void {
        this.mode = mode
    }

    public setTarget(target: Entity | null): void {
        this.target = target
        if (this.target) {
            const transform = this.target.getComponent<TransformComponent>("transform")
            if (transform) {
                const targetPosition = transform.getPosition()
                this.currentLookAt.copy(targetPosition).add(this.lookAtOffset)
            } else {
                this.currentLookAt.copy(this.camera.position).add(new THREE.Vector3(0, 0, -1))
            }
        } else {
            this.currentLookAt.copy(this.camera.position).add(new THREE.Vector3(0, 0, -1))
        }
        this.currentCamQuat.copy(this.camera.quaternion)
    }

    public setSmoothFactor(factor: number): void {
        this.smoothFactor = THREE.MathUtils.clamp(factor, 0, 1)
    }

    public setFollowOffset(offset: THREE.Vector3): void {
        this.followOffset.copy(offset)
    }

    public setLookAtOffset(offset: THREE.Vector3): void {
        this.lookAtOffset.copy(offset)
    }

    public update(deltaTime: number): void {
        if (!this.target || this.mode !== CameraMode.FOLLOW) {
            return
        }

        const transform = this.target.getComponent<TransformComponent>("transform")
        if (!transform) {
            console.warn("[CameraController] Target entity does not have a TransformComponent.")
            return
        }

        const targetPosition = transform.getPosition()
        const targetQuaternion = transform.getQuaternion()

        if (!this.currentLookAt.add(this.lookAtOffset).equals(targetPosition)) {
            const offset = this.followOffset.clone().applyQuaternion(targetQuaternion)
            const cameraTarget = targetPosition.clone().add(offset)

            this.camera.position.lerp(cameraTarget, this.smoothFactor)

            this.currentCamQuat.slerp(
                new THREE.Quaternion().setFromRotationMatrix(
                    new THREE.Matrix4().lookAt(this.camera.position, targetPosition.clone().add(this.lookAtOffset), new THREE.Vector3(0, 1, 0)),
                ),
                this.smoothFactor,
            )

            this.camera.setRotationFromQuaternion(this.currentCamQuat)
            this.currentLookAt.copy(targetPosition).add(this.lookAtOffset)
        }
    }

    public onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera
    }
}

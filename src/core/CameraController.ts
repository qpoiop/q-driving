import * as THREE from "three"

export enum CameraMode {
    FREE,
    FOLLOW,
    ORBIT,
}

export class CameraController {
    private camera: THREE.PerspectiveCamera
    private target: THREE.Object3D | null = null
    private mode: CameraMode = CameraMode.FREE
    private offset: THREE.Vector3 = new THREE.Vector3(0, 3, -8)
    private smoothFactor: number = 0.05
    private targetPosition: THREE.Vector3 = new THREE.Vector3()
    private lookAtPosition: THREE.Vector3 = new THREE.Vector3()
    private prevLookAtPosition: THREE.Vector3 = new THREE.Vector3()

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera
        this.setupCamera()
    }

    private setupCamera(): void {
        this.camera.position.set(0, 10, 20)
        this.camera.lookAt(0, 0, 0)
        this.camera.fov = 75
        this.camera.near = 0.1
        this.camera.far = 1000
        this.camera.updateProjectionMatrix()
    }

    public setMode(mode: CameraMode): void {
        this.mode = mode
    }

    public setTarget(target: THREE.Object3D): void {
        this.target = target
        if (target) {
            // 초기 위치 설정
            const position = target.position.clone()
            this.lookAtPosition.copy(position)
            this.prevLookAtPosition.copy(position)
        }
    }

    public setOffset(offset: THREE.Vector3): void {
        this.offset.copy(offset)
    }

    public setSmoothFactor(factor: number): void {
        this.smoothFactor = THREE.MathUtils.clamp(factor, 0, 1)
    }

    public update(deltaTime: number): void {
        if (!this.target || this.mode !== CameraMode.FOLLOW) return

        const position = this.target.position
        const rotation = this.target.rotation

        // 카메라 오프셋 계산
        const cameraOffset = this.offset.clone()
        cameraOffset.applyEuler(new THREE.Euler(0, rotation.y, 0))

        // 타겟 위치 계산
        this.targetPosition.copy(position).add(cameraOffset)
        this.camera.position.lerp(this.targetPosition, this.smoothFactor)

        // 시선 위치 계산
        const lookAtOffset = new THREE.Vector3(0, 2, 20)
        lookAtOffset.applyEuler(new THREE.Euler(0, rotation.y, 0))
        this.lookAtPosition.copy(position).add(lookAtOffset)

        // 부드러운 시선 이동
        this.prevLookAtPosition.lerp(this.lookAtPosition, this.smoothFactor)
        this.camera.lookAt(this.prevLookAtPosition)
    }

    public onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera
    }
}

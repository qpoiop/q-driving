import * as THREE from "three"
import { Component } from "../core/Component"

export class TransformComponent extends Component {
    private position: THREE.Vector3
    private rotation: THREE.Euler
    private scale: THREE.Vector3
    private matrix: THREE.Matrix4
    private matrixWorld: THREE.Matrix4
    private matrixAutoUpdate: boolean

    constructor() {
        super("transform")
        this.position = new THREE.Vector3()
        this.rotation = new THREE.Euler()
        this.scale = new THREE.Vector3(1, 1, 1)
        this.matrix = new THREE.Matrix4()
        this.matrixWorld = new THREE.Matrix4()
        this.matrixAutoUpdate = true
    }

    public override async initialize(): Promise<void> {
        // 초기화 로직
    }

    public override update(deltaTime: number): void {
        // 업데이트 로직
    }

    public override dispose(): void {
        // 정리 로직
    }

    public getPosition(): THREE.Vector3 {
        return this.position
    }

    public setPosition(x: number, y: number, z: number): void {
        this.position.set(x, y, z)
        this.updateMatrix()
    }

    public getRotation(): THREE.Euler {
        return this.rotation
    }

    public setRotation(x: number, y: number, z: number): void {
        this.rotation.set(x, y, z)
        this.updateMatrix()
    }

    public getQuaternion(): THREE.Quaternion {
        return new THREE.Quaternion().setFromEuler(this.rotation)
    }

    public setRotationFromQuaternion(quaternion: THREE.Quaternion): void {
        this.rotation.setFromQuaternion(quaternion)
        this.updateMatrix()
    }

    public getScale(): THREE.Vector3 {
        return this.scale
    }

    public setScale(x: number, y: number, z: number): void {
        this.scale.set(x, y, z)
        this.updateMatrix()
    }

    public getMatrix(): THREE.Matrix4 {
        return this.matrix
    }

    public getMatrixWorld(): THREE.Matrix4 {
        return this.matrixWorld
    }

    public setMatrixAutoUpdate(autoUpdate: boolean): void {
        this.matrixAutoUpdate = autoUpdate
    }

    public updateMatrix(): void {
        this.matrix.compose(this.position, this.getQuaternion(), this.scale)
    }

    public updateMatrixWorld(force: boolean = false): void {
        if (this.matrixAutoUpdate || force) {
            this.updateMatrix()
        }
    }

    public lookAt(target: THREE.Vector3): void {
        const quaternion = new THREE.Quaternion()
        quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.position, target, new THREE.Vector3(0, 1, 0)))
        this.setRotationFromQuaternion(quaternion)
    }

    public rotateAround(axis: THREE.Vector3, angle: number): void {
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle)
        this.setRotationFromQuaternion(quaternion.multiply(this.getQuaternion()))
    }

    public translateX(distance: number): void {
        const v = new THREE.Vector3(1, 0, 0)
        v.applyQuaternion(this.getQuaternion())
        v.multiplyScalar(distance)
        this.position.add(v)
        this.updateMatrix()
    }

    public translateY(distance: number): void {
        const v = new THREE.Vector3(0, 1, 0)
        v.applyQuaternion(this.getQuaternion())
        v.multiplyScalar(distance)
        this.position.add(v)
        this.updateMatrix()
    }

    public translateZ(distance: number): void {
        const v = new THREE.Vector3(0, 0, 1)
        v.applyQuaternion(this.getQuaternion())
        v.multiplyScalar(distance)
        this.position.add(v)
        this.updateMatrix()
    }

    public rotateX(angle: number): void {
        this.rotation.x += angle
        this.updateMatrix()
    }

    public rotateY(angle: number): void {
        this.rotation.y += angle
        this.updateMatrix()
    }

    public rotateZ(angle: number): void {
        this.rotation.z += angle
        this.updateMatrix()
    }
}

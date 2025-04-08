import * as THREE from "three"
import { Component } from "../core/Component"

export class ModelComponent extends Component {
    private model: THREE.Group

    constructor(model: THREE.Group = new THREE.Group()) {
        super("model")
        this.model = model
    }

    public setModel(model: THREE.Group): void {
        this.model = model
    }

    public getModel(): THREE.Group {
        return this.model
    }

    public getPosition(): THREE.Vector3 {
        return this.model.position
    }

    public setPosition(position: THREE.Vector3): void {
        this.model.position.copy(position)
    }

    public getRotation(): THREE.Euler {
        return this.model.rotation
    }

    public setRotation(rotation: THREE.Euler): void {
        this.model.rotation.copy(rotation)
    }

    public getScale(): THREE.Vector3 {
        return this.model.scale
    }

    public setScale(scale: THREE.Vector3): void {
        this.model.scale.copy(scale)
    }

    public getQuaternion(): THREE.Quaternion {
        return this.model.quaternion
    }

    public setQuaternion(quaternion: THREE.Quaternion): void {
        this.model.quaternion.copy(quaternion)
    }

    public getMatrix(): THREE.Matrix4 {
        return this.model.matrix
    }

    public getMatrixWorld(): THREE.Matrix4 {
        return this.model.matrixWorld
    }

    public updateMatrix(): void {
        this.model.updateMatrix()
    }

    public updateMatrixWorld(force: boolean = false): void {
        this.model.updateMatrixWorld(force)
    }

    public override dispose(): void {
        super.dispose()
        this.model.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose()
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose())
                } else {
                    child.material.dispose()
                }
            }
        })
    }
}

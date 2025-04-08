import * as THREE from "three"
import { Sky as ThreeSky } from "three/examples/jsm/objects/Sky"

export class Sky {
    private sky: ThreeSky
    private dayColor: number = 0x87ceeb
    private nightColor: number = 0x000033
    private isNightMode: boolean = false

    constructor() {
        this.sky = new ThreeSky()
        this.sky.scale.setScalar(450000)

        const uniforms = this.sky.material.uniforms
        uniforms["turbidity"].value = 10
        uniforms["rayleigh"].value = 3
        uniforms["mieCoefficient"].value = 0.005
        uniforms["mieDirectionalG"].value = 0.7

        this.updateSunPosition()
    }

    private updateSunPosition(): void {
        const sun = new THREE.Vector3()
        const phi = THREE.MathUtils.degToRad(90 - 2)
        const theta = THREE.MathUtils.degToRad(180)

        sun.setFromSphericalCoords(1, phi, theta)
        this.sky.material.uniforms["sunPosition"].value.copy(sun)
    }

    public getMesh(): THREE.Object3D {
        return this.sky
    }

    public setNightMode(isNightMode: boolean): void {
        this.isNightMode = isNightMode
        const uniforms = this.sky.material.uniforms
        if (isNightMode) {
            uniforms["turbidity"].value = 2
            uniforms["rayleigh"].value = 1
            uniforms["mieCoefficient"].value = 0.01
            uniforms["mieDirectionalG"].value = 0.9
        } else {
            uniforms["turbidity"].value = 10
            uniforms["rayleigh"].value = 3
            uniforms["mieCoefficient"].value = 0.005
            uniforms["mieDirectionalG"].value = 0.7
        }
        this.updateSunPosition()
    }

    public getNightMode(): boolean {
        return this.isNightMode
    }

    public dispose(): void {
        this.sky.geometry.dispose()
        this.sky.material.dispose()
    }
}

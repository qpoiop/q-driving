import * as THREE from "three"
import { Sky } from "three/examples/jsm/objects/Sky"

export function updateSun(sky: Sky, elevation: number): void {
    const phi = THREE.MathUtils.degToRad(90 - elevation)
    const theta = THREE.MathUtils.degToRad(180)

    const sunPosition = new THREE.Vector3()
    sunPosition.setFromSphericalCoords(1, phi, theta)

    sky.material.uniforms["sunPosition"].value.copy(sunPosition)
}

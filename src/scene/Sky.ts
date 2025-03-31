import * as THREE from "three"
import { Sky } from "three/examples/jsm/objects/Sky"

let sky: Sky
let sun: THREE.Vector3
let skyScene: THREE.Scene

export function createPhysicalSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    sky = new Sky()
    sky.scale.setScalar(450000)

    sun = new THREE.Vector3()
    sky.material.uniforms["turbidity"].value = 10
    sky.material.uniforms["rayleigh"].value = 2
    sky.material.uniforms["mieCoefficient"].value = 0.005
    sky.material.uniforms["mieDirectionalG"].value = 0.8
    sky.material.uniforms["sunPosition"].value = sun

    scene.add(sky)

    skyScene = new THREE.Scene()
    skyScene.add(sky)

    updateSun(45, 180, scene, renderer)
}

export function updateSun(elevation: number, azimuth: number, scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    const phi = THREE.MathUtils.degToRad(90 - elevation)
    const theta = THREE.MathUtils.degToRad(azimuth)
    sun.setFromSphericalCoords(1, phi, theta)

    sky.material.uniforms["sunPosition"].value.copy(sun)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const renderTarget = pmrem.fromScene(skyScene)

    scene.environment = renderTarget.texture
    scene.background = renderTarget.texture
}

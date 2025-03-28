import * as THREE from "three"
import { Sky } from "three/examples/jsm/objects/Sky.js"

export function createSky(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const sky = new Sky()
    sky.scale.setScalar(450000)
    scene.add(sky) // 시각적으로는 main scene에 추가

    // 태양 파라미터 설정
    const skyUniforms = sky.material.uniforms
    const sun = new THREE.Vector3()
    const phi = THREE.MathUtils.degToRad(90 - 10)
    const theta = THREE.MathUtils.degToRad(180)
    sun.setFromSphericalCoords(1, phi, theta)

    skyUniforms["sunPosition"].value.copy(sun)
    skyUniforms["turbidity"].value = 2
    skyUniforms["rayleigh"].value = 1.5
    skyUniforms["mieCoefficient"].value = 0.005
    skyUniforms["mieDirectionalG"].value = 0.7

    const envScene = new THREE.Scene()
    envScene.add(sky.clone())

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(envScene).texture

    scene.environment = envMap // 조명용만 설정
}

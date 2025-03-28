import * as THREE from "three"
import { createNoise2D } from "simplex-noise"

export class Terrain {
    public mesh: THREE.Mesh

    constructor() {
        const loader = new THREE.TextureLoader()
        const noise2D = createNoise2D()

        // 텍스처 로드
        const albedo = loader.load("/assets/textures/ground/default_ground_color.jpg")
        const normal = loader.load("/assets/textures/ground/default_ground_normal.jpg")
        const roughness = loader.load("/assets/textures/ground/default_ground_roughness.jpg")
        const aoMap = loader.load("/assets/textures/ground/default_ground_ambient_occlusion.jpg")

        ;[albedo, normal, roughness, aoMap].forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping
            tex.repeat.set(200, 200)
        })

        // ✅ 평면 지형 생성 + 고해상도 (곡률 자연스러움)
        const geometry = new THREE.PlaneGeometry(500, 500, 256, 256)
        geometry.rotateX(-Math.PI / 2)

        // ✅ Perlin noise 적용 + 중앙 도로 평탄화
        const position = geometry.attributes.position
        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i)
            const z = position.getZ(i)

            let y = noise2D(x * 0.02, z * 0.02) * 5

            if (Math.abs(x) < 10) {
                y *= 0.2 // ✅ 중앙 20m 폭 도로 평탄화
            }

            position.setY(i, y)
        }
        position.needsUpdate = true

        // uv2 for aoMap
        geometry.setAttribute("uv2", new THREE.BufferAttribute(geometry.attributes.uv.array, 2))

        const material = new THREE.MeshStandardMaterial({
            map: albedo,
            normalMap: normal,
            roughnessMap: roughness,
            aoMap: aoMap,
        })

        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.receiveShadow = true
    }
}

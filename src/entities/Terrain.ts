import * as THREE from "three"
import { createNoise2D } from "simplex-noise"

interface TerrainOptions {
    size: number
    resolution: number
    heightScale: number
    flattenWidth: number
    textureRepeat: number
}

export class Terrain {
    public mesh: THREE.Mesh

    constructor(options: TerrainOptions) {
        const { size, resolution, heightScale, flattenWidth, textureRepeat } = options

        const loader = new THREE.TextureLoader()
        const noise2D = createNoise2D()

        const albedo = loader.load("/assets/textures/ground/4k/ground008_color.jpg")
        const normal = loader.load("/assets/textures/ground/4k/ground008_normal.jpg")
        const roughness = loader.load("/assets/textures/ground/4k/ground008_roughness.jpg")
        const aoMap = loader.load("/assets/textures/ground/4k/ground008_ao.jpg")

        ;[albedo, normal, roughness, aoMap].forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping
            tex.repeat.set(textureRepeat, textureRepeat)
        })

        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution)
        geometry.rotateX(-Math.PI / 2)

        const position = geometry.attributes.position
        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i)
            const z = position.getZ(i)

            let y = noise2D(x * 0.01, z * 0.01) * heightScale
            if (Math.abs(x) < flattenWidth) {
                y *= 0.2
            }

            position.setY(i, y)
        }
        position.needsUpdate = true

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

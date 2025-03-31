import * as THREE from "three"
import { createNoise2D } from "simplex-noise"

interface TerrainOptions {
    size: number
    resolution: number
    heightScale: number
    flattenWidth: number
    textureRepeat: number
    offsetX?: number
    offsetZ?: number
}

const textureCache = new Map<string, THREE.Texture>()
function loadTexture(path: string): THREE.Texture {
    if (textureCache.has(path)) return textureCache.get(path)!
    const tex = new THREE.TextureLoader().load(path)
    textureCache.set(path, tex)
    return tex
}

export class Terrain {
    public mesh: THREE.Mesh
    private size: number
    private heightData: number[][] = []

    constructor(opts: TerrainOptions) {
        const { size, resolution, heightScale, flattenWidth, textureRepeat, offsetX = 0, offsetZ = 0 } = opts
        this.size = size

        const noise2D = createNoise2D()
        const albedo = loadTexture("/assets/textures/ground/4k/ground008_color.jpg")
        const normal = loadTexture("/assets/textures/ground/4k/ground008_normal.jpg")
        const roughness = loadTexture("/assets/textures/ground/4k/ground008_roughness.jpg")
        const aoMap = loadTexture("/assets/textures/ground/4k/ground008_ao.jpg")

        ;[albedo, normal, roughness, aoMap].forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping
            tex.repeat.set(textureRepeat, textureRepeat)
        })

        const geo = new THREE.PlaneGeometry(size, size, resolution, resolution)
        geo.rotateX(-Math.PI / 2)

        const pos = geo.attributes.position
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i) + offsetX
            const z = pos.getZ(i) + offsetZ
            let y = noise2D(x * 0.01, z * 0.01) * heightScale
            if (Math.abs(x) < flattenWidth) y *= 0.2
            pos.setY(i, y)
        }
        pos.needsUpdate = true
        geo.computeVertexNormals()
        geo.setAttribute("uv2", new THREE.BufferAttribute(geo.attributes.uv.array, 2))

        this.mesh = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({
                map: albedo,
                normalMap: normal,
                roughnessMap: roughness,
                aoMap: aoMap,
            }),
        )
        this.mesh.receiveShadow = true
        this.mesh.position.set(offsetX, 0, offsetZ)

        this.cacheHeightData(geo, resolution)
    }

    private cacheHeightData(geo: THREE.BufferGeometry, resolution: number) {
        const pos = geo.attributes.position
        const size = resolution + 1
        for (let z = 0; z < size; z++) {
            const row: number[] = []
            for (let x = 0; x < size; x++) {
                const idx = z * size + x
                row.push(pos.getY(idx))
            }
            this.heightData.push(row)
        }
    }

    public getHeightAt(pos: THREE.Vector3): number {
        const local = pos.clone().sub(this.mesh.position)
        const half = this.size / 2
        const x = (local.x + half) / this.size
        const z = (local.z + half) / this.size
        const xi = Math.floor(x * (this.heightData.length - 1))
        const zi = Math.floor(z * (this.heightData.length - 1))
        if (!this.heightData[zi] || this.heightData[zi][xi] == null) return this.mesh.position.y
        return this.heightData[zi][xi] + this.mesh.position.y
    }

    public getNormalAt(pos: THREE.Vector3): THREE.Vector3 {
        return new THREE.Vector3(0, 1, 0) // 개선 여지 있음 (현재는 고정)
    }

    public dispose() {
        this.mesh.geometry.dispose()
        if (Array.isArray(this.mesh.material)) {
            this.mesh.material.forEach(m => m.dispose())
        } else {
            this.mesh.material.dispose()
        }
    }
}

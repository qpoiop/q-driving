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
    if (textureCache.has(path)) {
        return textureCache.get(path)!
    }
    console.log(`[Terrain] 텍스처 로딩 시도: ${path}`)
    const tex = new THREE.TextureLoader().load(
        path,
        () => console.log(`[Terrain] 텍스처 로드 성공: ${path}`),
        undefined,
        error => console.error(`[Terrain] 텍스처 로드 실패: ${path}`, error),
    )
    textureCache.set(path, tex)
    return tex
}

export class Terrain {
    public mesh: THREE.Mesh
    private size: number
    private heightData: number[][] = []
    private resolution: number
    private static texturesLoaded = false

    constructor(opts: TerrainOptions) {
        console.log("[Terrain] 지형 생성 시작", { ...opts })
        const { size, resolution, heightScale, flattenWidth, textureRepeat, offsetX = 0, offsetZ = 0 } = opts
        this.size = size
        this.resolution = resolution

        const noise2D = createNoise2D()
        const noise2DDetail = createNoise2D()

        if (!Terrain.texturesLoaded) {
            console.log("[Terrain] 텍스처 로딩 시작")
            const albedo = loadTexture("/assets/textures/ground/ground008_color.jpg")
            const normal = loadTexture("/assets/textures/ground/ground008_normal.jpg")
            const roughness = loadTexture("/assets/textures/ground/ground008_roughness.jpg")
            const aoMap = loadTexture("/assets/textures/ground/ground008_ao.jpg")
            console.log("[Terrain] 텍스처 로딩 완료")
            Terrain.texturesLoaded = true
        }

        const albedo = textureCache.get("/assets/textures/ground/ground008_color.jpg")!
        const normal = textureCache.get("/assets/textures/ground/ground008_normal.jpg")!
        const roughness = textureCache.get("/assets/textures/ground/ground008_roughness.jpg")!
        const aoMap = textureCache.get("/assets/textures/ground/ground008_ao.jpg")!

        ;[albedo, normal, roughness, aoMap].forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping
            tex.repeat.set(textureRepeat, textureRepeat)
        })

        console.log("[Terrain] 지형 지오메트리 생성 시작")
        const geo = new THREE.PlaneGeometry(size, size, resolution, resolution)
        geo.rotateX(-Math.PI / 2)

        const pos = geo.attributes.position
        console.log(`[Terrain] 높이맵 생성 시작 (버텍스 수: ${pos.count})`)
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i) + offsetX
            const z = pos.getZ(i) + offsetZ

            // 큰 지형 변화 (언덕, 계곡 등)
            const largeScale = noise2D(x * 0.005, z * 0.005) * heightScale

            // 작은 지형 변화 (디테일)
            const smallScale = noise2DDetail(x * 0.02, z * 0.02) * heightScale * 0.2

            // 도로 주변 평탄화
            const distanceFromRoad = Math.abs(x)
            const roadInfluence = this.smoothstep(flattenWidth, flattenWidth * 2, distanceFromRoad)

            // 최종 높이 계산
            let y = largeScale * roadInfluence + smallScale * roadInfluence

            // 도로 주변 완전 평탄화
            if (distanceFromRoad < flattenWidth) {
                const t = this.smoothstep(0, flattenWidth, distanceFromRoad)
                y *= t * 0.2
            }

            pos.setY(i, y)
        }
        console.log("[Terrain] 높이맵 생성 완료")

        pos.needsUpdate = true
        geo.computeVertexNormals()
        geo.setAttribute("uv2", new THREE.BufferAttribute(geo.attributes.uv.array, 2))

        console.log("[Terrain] 메시 생성")
        this.mesh = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({
                map: albedo,
                normalMap: normal,
                roughnessMap: roughness,
                aoMap,
                envMapIntensity: 0.5,
            }),
        )
        this.mesh.receiveShadow = true
        this.mesh.position.set(offsetX, 0, offsetZ)

        this.cacheHeightData(geo)
        console.log("[Terrain] 지형 생성 완료", { position: this.mesh.position })
    }

    private smoothstep(min: number, max: number, value: number): number {
        const x = Math.max(0, Math.min(1, (value - min) / (max - min)))
        return x * x * (3 - 2 * x)
    }

    private cacheHeightData(geo: THREE.BufferGeometry) {
        const pos = geo.attributes.position
        const size = this.resolution + 1
        for (let z = 0; z < size; z++) {
            const row: number[] = []
            for (let x = 0; x < size; x++) {
                row.push(pos.getY(z * size + x))
            }
            this.heightData.push(row)
        }
    }

    public getHeightAt(pos: THREE.Vector3): number {
        const local = pos.clone().sub(this.mesh.position)
        const half = this.size / 2
        const x = (local.x + half) / this.size
        const z = (local.z + half) / this.size
        const xi = Math.floor(x * this.resolution)
        const zi = Math.floor(z * this.resolution)
        return this.heightData[zi]?.[xi] + this.mesh.position.y || this.mesh.position.y
    }

    public getNormalAt(_: THREE.Vector3): THREE.Vector3 {
        return new THREE.Vector3(0, 1, 0)
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

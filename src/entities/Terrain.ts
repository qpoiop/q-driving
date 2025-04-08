import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { ResourceManager } from "../core/ResourceManager"
import { ITerrainService } from "../core/ITerrainService"
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise"

interface TerrainConfig {
    width: number
    height: number
    segments: number
    heightScale: number
    textureRepeat?: number
}

export class Terrain extends Entity implements ITerrainService {
    private transform: TransformComponent
    private model: ModelComponent
    private config: TerrainConfig
    private resourceManager: ResourceManager
    private heightData: Float32Array
    private normalData: Float32Array
    private noise: ImprovedNoise
    private mesh: THREE.Mesh

    constructor(terrainService: ITerrainService, config: TerrainConfig) {
        super()
        console.log("[Terrain] Constructor called with config:", config)
        this.config = config
        this.transform = new TransformComponent()
        this.model = new ModelComponent(new THREE.Group())
        this.resourceManager = terrainService.getResourceManager()
        this.noise = new ImprovedNoise()
        this.heightData = new Float32Array((this.config.segments + 1) * (this.config.segments + 1))
        this.normalData = new Float32Array((this.config.segments + 1) * (this.config.segments + 1) * 3)
        this.mesh = new THREE.Mesh()

        this.addComponent(this.transform)
        this.addComponent(this.model)
    }

    public override async initialize(): Promise<void> {
        console.log("[Terrain] Starting initialization")
        await super.initialize()
        await this.generateTerrain()
        await this.createMesh()
        console.log("[Terrain] Initialization completed")
    }

    private async loadTerrainTextures(): Promise<{
        colorTexture: THREE.Texture
        normalTexture: THREE.Texture
        roughnessTexture: THREE.Texture
        aoTexture: THREE.Texture
    }> {
        const textures = await Promise.all([
            this.resourceManager.loadTexture("ground_color", "textures/ground/ground008_color.jpg"),
            this.resourceManager.loadTexture("ground_normal", "textures/ground/ground008_normal.jpg"),
            this.resourceManager.loadTexture("ground_roughness", "textures/ground/ground008_roughness.jpg"),
            this.resourceManager.loadTexture("ground_ao", "textures/ground/ground008_ao.jpg"),
        ])

        return {
            colorTexture: textures[0],
            normalTexture: textures[1],
            roughnessTexture: textures[2],
            aoTexture: textures[3],
        }
    }

    private generateTerrain(): void {
        console.log("[Terrain] Starting terrain generation")
        const size = this.config.segments + 1
        const scale = 0.005 // 더 낮은 스케일로 변경하여 더 완만한 지형 생성

        // 노이즈 기반 높이맵 생성
        for (let i = 0; i <= this.config.segments; i++) {
            for (let j = 0; j <= this.config.segments; j++) {
                const x = (i / this.config.segments) * this.config.width - this.config.width / 2
                const z = (j / this.config.segments) * this.config.height - this.config.height / 2

                // 여러 레이어의 노이즈를 합성하여 더 자연스러운 지형 생성
                let height = 0
                height += this.noise.noise(x * scale, z * scale, 0) * 0.5
                height += this.noise.noise(x * scale * 2, z * scale * 2, 0) * 0.25
                height += this.noise.noise(x * scale * 4, z * scale * 4, 0) * 0.125

                // 높이 범위 조정 - 더 완만하게
                height = (height + 1) * 0.25 // 높이 범위를 더 줄임
                height = Math.pow(height, 2) // 더 평평한 지형

                // 도로 주변 평탄화 - 더 넓은 영역
                const distanceFromCenter = Math.sqrt(x * x + z * z)
                const roadWidth = 80 // 도로와 주변 평지 영역을 더 넓게
                const transitionWidth = 40 // 전환 구간

                if (distanceFromCenter < roadWidth) {
                    height *= 0.1 // 도로 주변을 거의 평평하게
                } else if (distanceFromCenter < roadWidth + transitionWidth) {
                    const t = (distanceFromCenter - roadWidth) / transitionWidth
                    height *= 0.1 + 0.9 * t * t // 부드러운 전환
                }

                // 높이 데이터 저장
                this.heightData[i * size + j] = height * this.config.heightScale

                // 노말 데이터 계산
                const normal = this.calculateNormal(i, j)
                const index = (i * size + j) * 3
                this.normalData[index] = normal.x
                this.normalData[index + 1] = normal.y
                this.normalData[index + 2] = normal.z
            }
        }

        console.log("[Terrain] Terrain generation completed")
    }

    private calculateNormal(i: number, j: number): THREE.Vector3 {
        const size = this.config.segments + 1
        const scale = this.config.width / this.config.segments

        // 주변 점들의 높이를 사용하여 노말 계산
        const hL = this.heightData[Math.max(0, i - 1) * size + j]
        const hR = this.heightData[Math.min(this.config.segments, i + 1) * size + j]
        const hD = this.heightData[i * size + Math.max(0, j - 1)]
        const hU = this.heightData[i * size + Math.min(this.config.segments, j + 1)]

        const normal = new THREE.Vector3(hL - hR, 2.0 * scale, hD - hU).normalize()

        return normal
    }

    private async createMesh(): Promise<void> {
        console.log("[Terrain] Creating terrain mesh with segments:", this.config.segments)
        const geometry = new THREE.PlaneGeometry(this.config.width, this.config.height, this.config.segments, this.config.segments)
        console.log("[Terrain] Geometry created with vertex count:", geometry.attributes.position.count)

        // 정점 위치 업데이트
        const positions = geometry.attributes.position.array
        for (let i = 0; i <= this.config.segments; i++) {
            for (let j = 0; j <= this.config.segments; j++) {
                const index = (i * (this.config.segments + 1) + j) * 3
                const height = this.heightData[i * (this.config.segments + 1) + j]
                positions[index + 2] = height // Z축으로 높이 적용 (회전 후 Y축이 됨)
            }
        }

        // 노말 재계산
        geometry.computeVertexNormals()

        // UV 좌표 업데이트
        const textureRepeat = this.config.textureRepeat || 8
        const uvs = geometry.attributes.uv.array
        for (let i = 0; i <= this.config.segments; i++) {
            for (let j = 0; j <= this.config.segments; j++) {
                const index = (i * (this.config.segments + 1) + j) * 2
                uvs[index] = (j / this.config.segments) * textureRepeat // U 좌표
                uvs[index + 1] = (i / this.config.segments) * textureRepeat // V 좌표
            }
        }

        // 지형 텍스처 생성
        const textures = await this.loadTerrainTextures()
        const material = new THREE.MeshStandardMaterial({
            map: textures.colorTexture,
            normalMap: textures.normalTexture,
            roughnessMap: textures.roughnessTexture,
            aoMap: textures.aoTexture,
            roughness: 0.8,
            metalness: 0.2,
            flatShading: false,
        })

        // 텍스처 반복 설정
        textures.colorTexture.repeat.set(textureRepeat, textureRepeat)
        textures.normalTexture.repeat.set(textureRepeat, textureRepeat)
        textures.roughnessTexture.repeat.set(textureRepeat, textureRepeat)
        textures.aoTexture.repeat.set(textureRepeat, textureRepeat)

        textures.colorTexture.wrapS = textures.colorTexture.wrapT = THREE.RepeatWrapping
        textures.normalTexture.wrapS = textures.normalTexture.wrapT = THREE.RepeatWrapping
        textures.roughnessTexture.wrapS = textures.roughnessTexture.wrapT = THREE.RepeatWrapping
        textures.aoTexture.wrapS = textures.aoTexture.wrapT = THREE.RepeatWrapping

        this.mesh = new THREE.Mesh(geometry, material)

        // 지형 위치와 회전 설정
        this.mesh.position.set(0, 0, 0)
        this.mesh.rotation.x = -Math.PI / 2 // 지형을 수평으로 만들기 위해 -90도 회전
        this.mesh.receiveShadow = true
        this.mesh.castShadow = true

        const group = new THREE.Group()
        group.add(this.mesh)
        this.model.setModel(group)

        console.log("[Terrain] Terrain mesh creation completed")
    }

    public getHeightAt(x: number, y: number, z: number): number {
        const size = this.config.segments + 1
        const i = Math.floor(((x + this.config.width / 2) / this.config.width) * this.config.segments)
        const j = Math.floor(((z + this.config.height / 2) / this.config.height) * this.config.segments)

        if (i < 0 || i >= size || j < 0 || j >= size) {
            return 0
        }

        return this.heightData[i * size + j]
    }

    public getNormalAt(x: number, y: number, z: number): THREE.Vector3 {
        const size = this.config.segments + 1
        const i = Math.floor(((x + this.config.width / 2) / this.config.width) * this.config.segments)
        const j = Math.floor(((z + this.config.height / 2) / this.config.height) * this.config.segments)

        if (i < 0 || i >= size || j < 0 || j >= size) {
            return new THREE.Vector3(0, 1, 0)
        }

        const index = (i * size + j) * 3
        return new THREE.Vector3(this.normalData[index], this.normalData[index + 1], this.normalData[index + 2])
    }

    public getResourceManager(): ResourceManager {
        return this.resourceManager
    }

    public getModel(): THREE.Group {
        return this.model.getModel()
    }

    public setPosition(x: number, y: number, z: number): void {
        this.transform.setPosition(x, y, z)
    }

    public setRotation(x: number, y: number, z: number): void {
        this.transform.setRotation(x, y, z)
    }

    public setScale(x: number, y: number, z: number): void {
        this.transform.setScale(x, y, z)
    }

    public override update(deltaTime: number): void {
        super.update(deltaTime)
    }

    public override dispose(): void {
        super.dispose()
        this.mesh.geometry.dispose()
        if (this.mesh.material instanceof THREE.Material) {
            this.mesh.material.dispose()
        }
    }
}

import * as THREE from "three"
import { Entity } from "../core/Entity"
import { ModelComponent } from "../components/ModelComponent"
import { TransformComponent } from "../components/TransformComponent"
import { ITerrainService } from "../core/ITerrainService"
import { ResourceManager } from "../core/ResourceManager"

interface RoadConfig {
    width: number
    segments: number
    curveRadius: number
    curveSegments: number
    textureRepeat: number
}

export class Road extends Entity {
    private transform: TransformComponent
    private model: ModelComponent
    private config: RoadConfig
    private terrainService: ITerrainService
    private resourceManager: ResourceManager
    private mesh: THREE.Mesh
    private path: THREE.CurvePath<THREE.Vector3>
    private points: THREE.Vector3[]

    constructor(terrainService: ITerrainService, config: RoadConfig) {
        super()
        this.config = config
        this.terrainService = terrainService
        this.resourceManager = terrainService.getResourceManager()
        this.transform = new TransformComponent()
        this.model = new ModelComponent(new THREE.Group())
        this.mesh = new THREE.Mesh()
        this.path = new THREE.CurvePath<THREE.Vector3>()
        this.points = []
        this.addComponent(this.transform)
        this.addComponent(this.model)
    }

    public override async initialize(): Promise<void> {
        await super.initialize()
        this.generatePath()
        await this.createMesh()
    }

    private generatePath(): void {
        // 직선 도로 생성 - 카메라 방향(-z)으로
        const segments = this.config.curveSegments
        const roadLength = this.config.curveRadius * 4 // 도로 길이

        // 제어점 생성 - 직선 도로
        const controlPoints: THREE.Vector3[] = []
        const startPoint = new THREE.Vector3(0, 0, roadLength / 2) // 시작점
        const endPoint = new THREE.Vector3(0, 0, -roadLength / 2) // 끝점 (-z 방향)

        // 시작점
        startPoint.y = this.terrainService.getHeightAt(startPoint.x, 0, startPoint.z)
        controlPoints.push(startPoint)

        // 중간 제어점들
        for (let i = 1; i < segments; i++) {
            const t = i / segments
            const x = 0 // x 좌표는 0으로 고정 (직선)
            const z = THREE.MathUtils.lerp(startPoint.z, endPoint.z, t)
            const point = new THREE.Vector3(x, 0, z)
            point.y = this.terrainService.getHeightAt(x, 0, z)
            controlPoints.push(point)
        }

        // 끝점
        endPoint.y = this.terrainService.getHeightAt(endPoint.x, 0, endPoint.z)
        controlPoints.push(endPoint)

        // 곡선 생성 - 직선이지만 부드러운 높이 변화
        for (let i = 0; i < controlPoints.length - 1; i++) {
            const current = controlPoints[i]
            const next = controlPoints[i + 1]

            // 현재 점과 다음 점 사이의 중간점들 계산
            const midPoints = []
            const numMidPoints = 3
            for (let j = 1; j < numMidPoints; j++) {
                const t = j / numMidPoints
                const midPoint = current.clone().lerp(next, t)
                midPoint.y = this.terrainService.getHeightAt(midPoint.x, 0, midPoint.z)
                midPoints.push(midPoint)
            }

            // 제어점들 생성
            const controls = []
            controls.push(current)
            controls.push(...midPoints)
            controls.push(next)

            // 곡선 추가
            for (let j = 0; j < controls.length - 1; j++) {
                const curve = new THREE.CatmullRomCurve3([controls[j], controls[j + 1]], false, "catmullrom", 0.5)
                this.path.add(curve)
            }

            this.points.push(current)
        }
        this.points.push(controlPoints[controlPoints.length - 1])
    }

    private async createMesh(): Promise<void> {
        console.time("Road.createMesh") // 전체 함수 시간 측정 시작
        // 도로의 점들을 기반으로 평면 지오메트리 생성
        const roadLength = this.path.getLength()
        const geometry = new THREE.PlaneGeometry(this.config.width, roadLength, 1, this.config.segments)

        // 도로를 z축 방향으로 회전
        geometry.rotateX(-Math.PI / 2)

        // 각 버텍스의 높이를 지형에 맞춤
        console.time("Road.createMesh.vertexHeight") // 버텍스 높이 계산 시간 측정 시작
        const positions = geometry.attributes.position.array
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i]
            const z = positions[i + 2]
            const worldX = x
            const worldZ = -z // z 좌표를 반전시켜 도로가 -z 방향으로 향하도록 함
            const averageHeight = this.getAverageHeightAt(worldX, worldZ)
            positions[i + 1] = averageHeight + 0.005 // 지형보다 0.005 높게 설정
        }
        geometry.computeVertexNormals()
        console.timeEnd("Road.createMesh.vertexHeight") // 버텍스 높이 계산 시간 측정 종료

        // UV 좌표 업데이트
        const uvs = geometry.attributes.uv.array
        for (let i = 0; i < uvs.length; i += 2) {
            uvs[i] *= this.config.textureRepeat / 2
            uvs[i + 1] *= this.config.textureRepeat
        }

        // 도로 텍스처 로드
        const [colorMap, normalMap, roughnessMap] = await Promise.all([
            this.resourceManager.loadTexture("road_color", "road/road001_color.jpg"),
            this.resourceManager.loadTexture("road_normal", "road/road001_normal_gl.jpg"),
            this.resourceManager.loadTexture("road_roughness", "road/road001_roughness.jpg"),
        ])

        // 텍스처 설정
        colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping
        normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping
        roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping

        const material = new THREE.MeshStandardMaterial({
            map: colorMap,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            roughness: 0.8,
            metalness: 0.1,
            normalScale: new THREE.Vector2(0.3, 0.3),
        })

        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.receiveShadow = true
        this.mesh.castShadow = false

        // 도로 가장자리 생성 (왼쪽)
        const leftEdgeGeometry = new THREE.PlaneGeometry(0.3, roadLength, 1, this.config.segments)
        leftEdgeGeometry.rotateX(-Math.PI / 2)
        leftEdgeGeometry.translate(-this.config.width / 2 - 0.15, 0, 0)
        this.updateGeometryHeight(leftEdgeGeometry)

        // 도로 가장자리 생성 (오른쪽)
        const rightEdgeGeometry = new THREE.PlaneGeometry(0.3, roadLength, 1, this.config.segments)
        rightEdgeGeometry.rotateX(-Math.PI / 2)
        rightEdgeGeometry.translate(this.config.width / 2 + 0.15, 0, 0)
        this.updateGeometryHeight(rightEdgeGeometry)

        const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.7,
            metalness: 0.1,
        })

        const leftEdge = new THREE.Mesh(leftEdgeGeometry, edgeMaterial)
        const rightEdge = new THREE.Mesh(rightEdgeGeometry, edgeMaterial)
        leftEdge.receiveShadow = true
        rightEdge.receiveShadow = true

        // 중앙선 생성
        const centerLineGeometry = new THREE.PlaneGeometry(0.15, roadLength, 1, this.config.segments)
        centerLineGeometry.rotateX(-Math.PI / 2)
        this.updateGeometryHeight(centerLineGeometry)

        const centerLineMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.1,
            emissive: 0x333333,
        })

        // 점선 패턴 생성
        const dashLength = 3
        const gapLength = 3
        const numDashes = Math.floor(roadLength / (dashLength + gapLength))
        const centerLine = new THREE.Group()

        for (let i = 0; i < numDashes; i++) {
            const dashStart = i * (dashLength + gapLength) - roadLength / 2
            const dashGeometry = new THREE.PlaneGeometry(0.15, dashLength)
            dashGeometry.rotateX(-Math.PI / 2)
            dashGeometry.translate(0, 0.001, dashStart + dashLength / 2)
            this.updateGeometryHeight(dashGeometry)

            const dash = new THREE.Mesh(dashGeometry, centerLineMaterial)
            dash.receiveShadow = true
            centerLine.add(dash)
        }

        const group = new THREE.Group()
        group.add(this.mesh)
        group.add(leftEdge)
        group.add(rightEdge)
        group.add(centerLine)
        this.model.setModel(group)
        console.timeEnd("Road.createMesh") // 전체 함수 시간 측정 종료
    }

    private getAverageHeightAt(x: number, z: number): number {
        const samplePoints = 4
        let totalHeight = 0
        const sampleDistance = 0.5 // 샘플링 거리

        for (let i = 0; i < samplePoints; i++) {
            const angle = (i / samplePoints) * Math.PI * 2
            const sampleX = x + Math.cos(angle) * sampleDistance
            const sampleZ = z + Math.sin(angle) * sampleDistance
            totalHeight += this.terrainService.getHeightAt(sampleX, 0, sampleZ)
        }

        return totalHeight / samplePoints
    }

    private updateGeometryHeight(geometry: THREE.BufferGeometry): void {
        const positions = geometry.attributes.position.array
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i]
            const z = positions[i + 2]
            const worldX = x
            const worldZ = -z
            const averageHeight = this.getAverageHeightAt(worldX, worldZ)
            positions[i + 1] = averageHeight + 0.005 // 지형보다 0.005 높게 설정
        }
        geometry.computeVertexNormals()
    }

    public getPath(): THREE.CurvePath<THREE.Vector3> {
        return this.path
    }

    public getPoints(): THREE.Vector3[] {
        return this.points
    }

    /**
     * 주어진 x, z 좌표가 도로 영역 내에 있는지 확인합니다.
     * @param x 월드 X 좌표
     * @param z 월드 Z 좌표
     * @param checkWidth 확인할 도로 폭 (Padding 포함)
     */
    public isPointOnRoad(x: number, z: number, checkWidth?: number): boolean {
        const roadWidth = checkWidth ?? this.config.width // checkWidth가 없으면 설정된 도로 폭 사용
        const halfWidth = roadWidth / 2

        // 도로는 현재 x=0 축을 따라 생성되므로, x 좌표만 비교
        // 도로의 z 범위는 생성된 path의 범위를 따르지만, 여기서는 x축만 고려
        if (Math.abs(x) < halfWidth) {
            // z좌표도 도로 범위 내에 있는지 추가 확인 (Optional, 더 정확한 판정을 위해)
            const roadLength = this.path.getLength() // path가 초기화된 후 사용 가능
            if (z >= -roadLength / 2 && z <= roadLength / 2) {
                return true
            }
        }

        return false
    }

    public getWidth(): number {
        return this.config.width
    }

    public getModel(): THREE.Group {
        return this.model.getModel()
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

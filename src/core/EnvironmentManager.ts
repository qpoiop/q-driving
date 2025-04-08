import * as THREE from "three"
import { ITerrainService } from "./ITerrainService"
import { Tree } from "../entities/Tree"
import { Rock } from "../entities/Rock"
import { Bush } from "../entities/Bush"

interface EnvironmentObject {
    entity: Tree | Rock | Bush
    position: THREE.Vector3
    scale: THREE.Vector3
    rotation: THREE.Euler
    distance: number
}

export class EnvironmentManager {
    private static instance: EnvironmentManager | null = null
    private terrainService: ITerrainService
    private scene: THREE.Scene

    // LOD 관련 설정
    private readonly LOD_LEVELS = {
        HIGH: 100, // 100m 이내: 고품질
        MEDIUM: 200, // 200m 이내: 중품질
        LOW: 400, // 400m 이내: 저품질
    }

    // 오브젝트 풀
    private trees: EnvironmentObject[] = []
    private rocks: EnvironmentObject[] = []
    private bushes: EnvironmentObject[] = []

    // 매트릭스 변환을 위한 임시 객체들
    private matrix = new THREE.Matrix4()
    private position = new THREE.Vector3()
    private quaternion = new THREE.Quaternion()
    private scale = new THREE.Vector3()

    private constructor(terrainService: ITerrainService, scene: THREE.Scene) {
        this.terrainService = terrainService
        this.scene = scene
    }

    public static getInstance(terrainService: ITerrainService, scene: THREE.Scene): EnvironmentManager {
        if (!EnvironmentManager.instance) {
            EnvironmentManager.instance = new EnvironmentManager(terrainService, scene)
        }
        return EnvironmentManager.instance
    }

    public async initialize(): Promise<void> {
        // 공유 리소스 초기화
        await Tree.initializeShared(this.terrainService, 1000)
        await Rock.initializeShared(this.terrainService, 500)
        await Bush.initializeShared(this.terrainService, 800)

        // 인스턴스 메시를 씬에 추가
        const treeInstancedMesh = Tree.getInstancedMesh()
        const rockInstancedMesh = Rock.getInstancedMesh()
        const bushInstancedMesh = Bush.getInstancedMesh()

        if (treeInstancedMesh) this.scene.add(treeInstancedMesh)
        if (rockInstancedMesh) this.scene.add(rockInstancedMesh)
        if (bushInstancedMesh) this.scene.add(bushInstancedMesh)

        this.generateEnvironmentObjects()
    }

    private async generateEnvironmentObjects(): Promise<void> {
        const terrainSize = 1000
        const halfSize = terrainSize / 2

        let treeCount = 0
        let rockCount = 0
        let bushCount = 0

        for (let i = 0; i < 1000; i++) {
            const x = Math.random() * terrainSize - halfSize
            const z = Math.random() * terrainSize - halfSize
            const y = this.terrainService.getHeightAt(x, 0, z)

            // 지형 높이에 맞춰 위치 설정
            const position = new THREE.Vector3(x, y, z)

            // 지형의 노말 벡터를 기준으로 회전 계산
            const normal = this.terrainService.getNormalAt(x, y, z)
            const up = new THREE.Vector3(0, 1, 0)
            const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal)
            const rotation = new THREE.Euler().setFromQuaternion(quaternion)
            rotation.y = Math.random() * Math.PI * 2 // Y축 회전만 랜덤하게 추가

            if (Math.random() > 0.7 && treeCount < 1000) {
                const tree = new Tree(this.terrainService)
                await tree.initialize()
                tree.setInstanceId(treeCount++)

                const scale = new THREE.Vector3(1.5 + Math.random() * 1, 1.5 + Math.random() * 1, 1.5 + Math.random() * 1)

                this.trees.push({ entity: tree, position, scale, rotation, distance: 0 })
            } else if (Math.random() > 0.5 && rockCount < 500) {
                const rock = new Rock(this.terrainService)
                await rock.initialize()
                rock.setInstanceId(rockCount++)

                const scale = new THREE.Vector3(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4)

                this.rocks.push({ entity: rock, position, scale, rotation, distance: 0 })
            } else if (bushCount < 800) {
                const bush = new Bush(this.terrainService)
                await bush.initialize()
                bush.setInstanceId(bushCount++)

                const scale = new THREE.Vector3(0.5 + Math.random() * 0.3, 0.5 + Math.random() * 0.3, 0.5 + Math.random() * 0.3)

                this.bushes.push({ entity: bush, position, scale, rotation, distance: 0 })
            }
        }
    }

    public update(cameraPosition: THREE.Vector3): void {
        this.updateDistances(this.trees, cameraPosition)
        this.updateDistances(this.rocks, cameraPosition)
        this.updateDistances(this.bushes, cameraPosition)

        this.updateInstances(this.trees)
        this.updateInstances(this.rocks)
        this.updateInstances(this.bushes)
    }

    private updateDistances(objects: EnvironmentObject[], cameraPosition: THREE.Vector3): void {
        objects.forEach(obj => {
            obj.distance = obj.position.distanceTo(cameraPosition)
        })
        objects.sort((a, b) => a.distance - b.distance)
    }

    private updateInstances(objects: EnvironmentObject[]): void {
        objects.forEach(obj => {
            if (obj.distance > this.LOD_LEVELS.LOW) return

            let lodScale = 1
            if (obj.distance > this.LOD_LEVELS.MEDIUM) {
                lodScale = 0.8 // 저품질
            } else if (obj.distance > this.LOD_LEVELS.HIGH) {
                lodScale = 0.9 // 중품질
            }

            this.matrix.compose(obj.position, this.quaternion.setFromEuler(obj.rotation), obj.scale.multiplyScalar(lodScale))
            obj.entity.updateInstance(this.matrix)
        })
    }

    public dispose(): void {
        Tree.disposeShared()
        Rock.disposeShared()
        Bush.disposeShared()

        this.trees.forEach(obj => obj.entity.dispose())
        this.rocks.forEach(obj => obj.entity.dispose())
        this.bushes.forEach(obj => obj.entity.dispose())

        this.trees = []
        this.rocks = []
        this.bushes = []
        EnvironmentManager.instance = null
    }
}

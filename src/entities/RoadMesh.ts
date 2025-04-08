import * as THREE from "three"
import { RoadPath } from "./RoadPath"

export class RoadMesh {
    public mesh: THREE.Mesh

    constructor(private path: RoadPath, private getHeight: (pos: THREE.Vector3) => number, private halfWidth = 2.5, private offsetY = 0.05) {
        console.log("[RoadMesh] 도로 메시 생성 시작", { halfWidth, offsetY })
        this.mesh = this.createMesh()
        console.log("[RoadMesh] 도로 메시 생성 완료")
    }

    private createMesh(): THREE.Mesh {
        console.log("[RoadMesh] 도로 지오메트리 생성 시작")
        const divisions = 200
        const positions: number[] = []
        const uvs: number[] = []
        const indices: number[] = []

        const curve = this.path.curve
        const up = new THREE.Vector3(0, 1, 0)
        const tempVec = new THREE.Vector3()

        console.log("[RoadMesh] 도로 버텍스 생성 시작")
        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions
            const point = curve.getPoint(t)
            const tangent = curve.getTangent(t).normalize()
            const normal = new THREE.Vector3().crossVectors(up, tangent).normalize()

            const left = point.clone().add(normal.clone().multiplyScalar(this.halfWidth))
            const right = point.clone().add(normal.clone().multiplyScalar(-this.halfWidth))

            const height = this.getHeight(point)
            left.y = height + this.offsetY
            right.y = height + this.offsetY

            positions.push(left.x, left.y, left.z)
            positions.push(right.x, right.y, right.z)
            uvs.push(0, t * 10)
            uvs.push(1, t * 10)
        }
        console.log("[RoadMesh] 도로 버텍스 생성 완료")

        console.log("[RoadMesh] 도로 인덱스 생성")
        for (let i = 0; i < divisions; i++) {
            const base = i * 2
            indices.push(base, base + 1, base + 2)
            indices.push(base + 1, base + 3, base + 2)
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
        geometry.setIndex(indices)
        geometry.computeVertexNormals()
        console.log("[RoadMesh] 도로 지오메트리 생성 완료")

        console.log("[RoadMesh] 도로 텍스처 로딩 시작")
        const loader = new THREE.TextureLoader()
        const map = loader.load(
            "/assets/road/4k/road001_color.jpg",
            () => console.log("[RoadMesh] 컬러 텍스처 로드 성공"),
            undefined,
            error => console.error("[RoadMesh] 컬러 텍스처 로드 실패", error),
        )
        const normal = loader.load(
            "/assets/road/4k/road001_normal_gl.jpg",
            () => console.log("[RoadMesh] 노말 텍스처 로드 성공"),
            undefined,
            error => console.error("[RoadMesh] 노말 텍스처 로드 실패", error),
        )
        const rough = loader.load(
            "/assets/road/4k/road001_roughness.jpg",
            () => console.log("[RoadMesh] 러프니스 텍스처 로드 성공"),
            undefined,
            error => console.error("[RoadMesh] 러프니스 텍스처 로드 실패", error),
        )
        console.log("[RoadMesh] 도로 텍스처 로딩 완료")
        ;[map, normal, rough].forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping
            tex.repeat.set(1, 40)
            tex.anisotropy = 16
        })

        const material = new THREE.MeshStandardMaterial({
            map,
            normalMap: normal,
            roughnessMap: rough,
            side: THREE.DoubleSide,
            normalScale: new THREE.Vector2(1, 1),
        })

        const mesh = new THREE.Mesh(geometry, material)
        mesh.receiveShadow = true
        mesh.castShadow = true
        return mesh
    }
}

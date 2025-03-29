import * as THREE from "three"
import { RoadPath } from "./RoadPath"

export class RoadMesh {
    public mesh: THREE.Mesh

    constructor(private path: RoadPath, private halfWidth = 1.5) {
        this.mesh = this.createMesh()
    }

    private createMesh(): THREE.Mesh {
        const divisions = 200
        const geometry = new THREE.BufferGeometry()

        const positions: number[] = []
        const uvs: number[] = []
        const indices: number[] = []

        const curve = this.path.curve
        const up = new THREE.Vector3(0, 1, 0)

        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions
            const point = curve.getPoint(t)
            const tangent = curve.getTangent(t).normalize()

            // let side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize()
            // if (side.length() < 0.0001) {
            //     side = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), tangent).normalize()
            // }

            // 정확한 좌우 방향 (Y-up 기준)
            const normal = new THREE.Vector3().crossVectors(up, tangent).normalize()

            const left = point.clone().add(normal.clone().multiplyScalar(this.halfWidth))
            const right = point.clone().add(normal.clone().multiplyScalar(-this.halfWidth))

            positions.push(left.x, left.y, left.z)
            positions.push(right.x, right.y, right.z)

            uvs.push(0, t * 10) // 좌측
            uvs.push(1, t * 10) // 우측
        }

        for (let i = 0; i < divisions; i++) {
            const base = i * 2
            indices.push(base, base + 1, base + 2)
            indices.push(base + 1, base + 3, base + 2)
        }

        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
        geometry.setIndex(indices)
        geometry.computeVertexNormals()

        const loader = new THREE.TextureLoader()
        const map = loader.load("/assets/models/road/4k/road001_color.jpg")
        const normal = loader.load("/assets/models/road/4k/road001_normal_gl.jpg")
        const roughness = loader.load("/assets/models/road/4k/road001_roughness.jpg")

        ;[map, normal, roughness].forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping
            tex.repeat.set(1, 40)
        })

        // RoadMesh.ts 머티리얼 보완
        const material = new THREE.MeshStandardMaterial({
            map,
            normalMap: normal,
            roughnessMap: roughness,
            roughness: 1,
            metalness: 0,
            envMapIntensity: 0.5,
            side: THREE.DoubleSide,
        })

        const mesh = new THREE.Mesh(geometry, material)
        mesh.receiveShadow = true
        return mesh
    }
}

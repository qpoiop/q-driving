import * as THREE from "three"
import { GroundTracker } from "../systems/GroundTracker"

interface RoadConfig {
    width?: number
    length?: number
    segments?: number
    offsetY?: number
    textureRepeat?: number
}

export class Road {
    public mesh: THREE.Mesh
    private readonly config: Required<RoadConfig>

    constructor(private tracker: GroundTracker, options: RoadConfig = {}) {
        this.config = {
            width: options.width ?? 4,
            length: options.length ?? 100,
            segments: options.segments ?? 100,
            offsetY: options.offsetY ?? 0.5,
            textureRepeat: options.textureRepeat ?? 20,
        }

        this.mesh = this.createMesh()
    }

    private createMesh(): THREE.Mesh {
        const { width, length, segments, offsetY, textureRepeat } = this.config

        const geometry = new THREE.PlaneGeometry(width, length, 1, segments)
        geometry.rotateX(-Math.PI / 2)

        const position = geometry.attributes.position
        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i)
            const z = position.getZ(i)

            const y = this.tracker.getHeightAt(new THREE.Vector3(x, 0, z)) + offsetY
            position.setY(i, y)
        }
        position.needsUpdate = true
        geometry.computeVertexNormals()

        const loader = new THREE.TextureLoader()
        const map = loader.load("/assets/models/road/4k/road001_color.jpg")
        const normal = loader.load("/assets/models/road/4k/road001_normal_gl.jpg")
        const roughness = loader.load("/assets/models/road/4k/road001_roughness.jpg")

        map.wrapS = map.wrapT = THREE.RepeatWrapping
        normal.wrapS = normal.wrapT = THREE.RepeatWrapping
        roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping

        map.repeat.set(1, textureRepeat)
        normal.repeat.set(1, textureRepeat)
        roughness.repeat.set(1, textureRepeat)

        const material = new THREE.MeshStandardMaterial({
            map,
            normalMap: normal,
            roughnessMap: roughness,
        })

        const mesh = new THREE.Mesh(geometry, material)
        mesh.receiveShadow = true
        return mesh
    }
}

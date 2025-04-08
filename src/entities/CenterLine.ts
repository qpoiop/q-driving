import * as THREE from "three"
import { RoadPath } from "./RoadPath"

interface CenterLineOptions {
    color?: number
    dashLength?: number
    spacing?: number
    width?: number
    height?: number
}

export class CenterLine {
    public meshGroup: THREE.Group

    constructor(path: RoadPath, options: CenterLineOptions = {}) {
        const { color = 0xffffff, dashLength = 3.0, spacing = 5.0, width = 0.12, height = 0.005 } = options

        this.meshGroup = new THREE.Group()

        const geometry = new THREE.PlaneGeometry(dashLength, width)
        geometry.rotateX(-Math.PI / 2)
        geometry.translate(dashLength / 2, 0, 0)

        const material = new THREE.MeshStandardMaterial({
            color,
            side: THREE.DoubleSide,
            roughness: 0.5,
            metalness: 0.0,
        })

        const totalLength = path.curve.getLength()
        const dashCount = Math.floor(totalLength / (dashLength + spacing))

        for (let i = 0; i < dashCount; i++) {
            const t = i / dashCount
            const point = path.curve.getPoint(t)
            const tangent = path.curve.getTangent(t)

            point.y += height

            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent.clone().normalize())

            const dash = new THREE.Mesh(geometry, material)
            dash.position.copy(point)
            dash.quaternion.copy(quaternion)
            dash.castShadow = false
            dash.receiveShadow = false

            this.meshGroup.add(dash)
        }
    }
}

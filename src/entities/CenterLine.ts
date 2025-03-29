import * as THREE from "three"
import { RoadPath } from "./RoadPath"

interface CenterLineOptions {
    color?: number
    dashLength?: number
    spacing?: number
    width?: number
}

export class CenterLine {
    public meshGroup: THREE.Group

    constructor(path: RoadPath, options: CenterLineOptions = {}) {
        const { color = 0xffffcc, dashLength = 1.5, spacing = 3.0, width = 0.1 } = options

        this.meshGroup = new THREE.Group()

        const geometry = new THREE.PlaneGeometry(width, dashLength)
        geometry.rotateX(-Math.PI / 2)

        const material = new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
        })

        const totalLength = path.curve.getLength()
        const dashCount = Math.floor(totalLength / (dashLength + spacing))

        for (let i = 0; i < dashCount; i++) {
            const t = i / dashCount
            const point = path.curve.getPoint(t)
            const tangent = path.curve.getTangent(t)

            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent.clone().normalize())

            const dash = new THREE.Mesh(geometry, material)
            dash.position.copy(point)
            dash.quaternion.copy(quaternion)

            this.meshGroup.add(dash)
        }
    }
}

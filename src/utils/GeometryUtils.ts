import * as THREE from "three"

export class GeometryUtils {
    static normalizeGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals()
        }
        if (!geometry.attributes.uv) {
            const uvs = new Float32Array(geometry.attributes.position.count * 2)
            geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
        }
        return geometry
    }

    static mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
        if (geometries.length === 0) {
            throw new Error("No geometries to merge")
        }

        const mergedGeometry = new THREE.BufferGeometry()
        const attributes = {
            position: [] as number[],
            normal: [] as number[],
            uv: [] as number[],
        }

        let vertexCount = 0

        for (const geometry of geometries) {
            const position = geometry.attributes.position
            const normal = geometry.attributes.normal
            const uv = geometry.attributes.uv

            for (let i = 0; i < position.count; i++) {
                attributes.position.push(position.getX(i), position.getY(i), position.getZ(i))
                attributes.normal.push(normal.getX(i), normal.getY(i), normal.getZ(i))
                attributes.uv.push(uv.getX(i), uv.getY(i))
            }

            vertexCount += position.count
        }

        mergedGeometry.setAttribute("position", new THREE.Float32BufferAttribute(attributes.position, 3))
        mergedGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(attributes.normal, 3))
        mergedGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(attributes.uv, 2))

        return mergedGeometry
    }
}

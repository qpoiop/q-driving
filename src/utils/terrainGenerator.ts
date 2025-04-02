import * as THREE from "three"

export async function createTerrainMesh({
    size,
    resolution,
    offsetX,
    offsetZ,
}: {
    size: number
    resolution: number
    offsetX: number
    offsetZ: number
}): Promise<THREE.Mesh> {
    const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution)
    geometry.rotateX(-Math.PI / 2)

    const position = geometry.attributes.position as THREE.BufferAttribute

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i) + offsetX
        const z = position.getZ(i) + offsetZ
        const y = Math.sin(x * 0.01) * 2 + Math.cos(z * 0.01) * 2 // 기본 높이
        position.setY(i, y)
    }

    geometry.computeVertexNormals()

    const material = new THREE.MeshStandardMaterial({
        color: "#556644",
        flatShading: true,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(offsetX, 0, offsetZ)

    return mesh
}

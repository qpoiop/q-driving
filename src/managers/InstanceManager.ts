import * as THREE from "three"
import { QuadTree, Box, Point } from "../utils/QuadTree"

const MIN_OBJECT_DISTANCE = 10

interface InstanceData {
    position: THREE.Vector3
    scale: THREE.Vector3
    rotation: THREE.Euler
    tileKey: string
}

export class InstanceManager {
    private instancedMesh: THREE.InstancedMesh
    private instances: Map<number, InstanceData> = new Map()
    private availableIndices: number[] = []
    private quadtree: QuadTree
    private boundingBox: THREE.Box3
    private matrix = new THREE.Matrix4()
    private quaternion = new THREE.Quaternion()

    constructor(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        private maxInstances: number,
        bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    ) {
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances)
        this.instancedMesh.castShadow = true
        this.instancedMesh.receiveShadow = true
        this.instancedMesh.frustumCulled = true
        this.boundingBox = new THREE.Box3()

        const area = new Box((bounds.maxX + bounds.minX) / 2, (bounds.maxZ + bounds.minZ) / 2, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
        this.quadtree = new QuadTree(area, 4)

        for (let i = maxInstances - 1; i >= 0; i--) {
            this.availableIndices.push(i)
        }
    }

    addInstance(position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3, tileKey: string): boolean {
        if (this.availableIndices.length === 0) return false

        const nearby = this.quadtree.query(new Box(position.x, position.z, MIN_OBJECT_DISTANCE * 2, MIN_OBJECT_DISTANCE * 2))

        if (nearby.some((p: Point) => new THREE.Vector2(p.x - position.x, p.y - position.z).length() < MIN_OBJECT_DISTANCE)) {
            return false
        }

        const index = this.availableIndices.pop()!
        const instance: InstanceData = { position, rotation, scale, tileKey }
        this.instances.set(index, instance)

        this.quadtree.insert(new Point(position.x, position.z, index))

        this.matrix.compose(position, this.quaternion.setFromEuler(rotation), scale)
        this.instancedMesh.setMatrixAt(index, this.matrix)
        this.instancedMesh.instanceMatrix.needsUpdate = true

        this.boundingBox.expandByPoint(position)

        return true
    }

    removeInstancesInTile(tileKey: string) {
        this.instances.forEach((instance, index) => {
            if (instance.tileKey === tileKey) {
                this.quadtree.remove(new Point(instance.position.x, instance.position.z, index))
                this.instances.delete(index)
                this.availableIndices.push(index)

                this.matrix.makeScale(0, 0, 0)
                this.instancedMesh.setMatrixAt(index, this.matrix)
            }
        })
        this.instancedMesh.instanceMatrix.needsUpdate = true
        this.updateBoundingBox()
    }

    private updateBoundingBox() {
        this.boundingBox.makeEmpty()
        this.instances.forEach(instance => {
            this.boundingBox.expandByPoint(instance.position)
        })
    }

    getMesh(): THREE.InstancedMesh {
        return this.instancedMesh
    }

    getBoundingBox(): THREE.Box3 {
        return this.boundingBox
    }

    updateVisibility(frustum: THREE.Frustum) {
        this.instancedMesh.visible = frustum.intersectsBox(this.boundingBox)
    }

    dispose() {
        this.instancedMesh.geometry.dispose()
        if (Array.isArray(this.instancedMesh.material)) {
            this.instancedMesh.material.forEach(m => m.dispose())
        } else {
            this.instancedMesh.material.dispose()
        }
        this.instances.clear()
        this.availableIndices = []
    }
}

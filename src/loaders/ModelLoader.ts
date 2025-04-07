import * as THREE from "three"
import { gltfLoader } from "./glbfLoader"
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils"

export interface ModelInstance {
    position: THREE.Vector3
    rotation: THREE.Euler
    scale: THREE.Vector3
}

export class ModelLoader {
    private instancedMesh: THREE.InstancedMesh | null = null
    private boundingBox: THREE.Box3 | null = null
    private matrix = new THREE.Matrix4()
    private quaternion = new THREE.Quaternion()

    constructor(private maxInstances: number = 1000) {}

    async load(modelPath: string): Promise<void> {
        const gltf = await gltfLoader.loadAsync(modelPath)
        const model = gltf.scene

        // 모델의 바운딩 박스 계산
        this.boundingBox = new THREE.Box3().setFromObject(model)

        // 모든 메시를 하나로 병합
        const geometries: THREE.BufferGeometry[] = []
        model.traverse(child => {
            if (child instanceof THREE.Mesh) {
                const geometry = child.geometry.clone()
                if (child.matrixWorld.determinant() !== 0) {
                    geometry.applyMatrix4(child.matrixWorld)
                }
                geometries.push(geometry)
            }
        })

        // 병합된 지오메트리 생성
        const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries)

        // 기본 material 설정
        const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            envMapIntensity: 1.5,
            metalness: 0.0,
            roughness: 1.0,
        })

        // InstancedMesh 생성
        this.instancedMesh = new THREE.InstancedMesh(mergedGeometry, material, this.maxInstances)
        this.instancedMesh.castShadow = true
        this.instancedMesh.receiveShadow = true
        this.instancedMesh.frustumCulled = true
        this.instancedMesh.count = 0
    }

    addInstance(position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3): boolean {
        if (!this.instancedMesh || this.instancedMesh.count >= this.maxInstances) {
            return false
        }

        this.matrix.compose(position, this.quaternion.setFromEuler(rotation), scale)

        this.instancedMesh.setMatrixAt(this.instancedMesh.count, this.matrix)
        this.instancedMesh.count++
        this.instancedMesh.instanceMatrix.needsUpdate = true

        return true
    }

    getMesh(): THREE.InstancedMesh | null {
        return this.instancedMesh
    }

    getBoundingBox(): THREE.Box3 | null {
        return this.boundingBox
    }

    clear(): void {
        if (this.instancedMesh) {
            this.instancedMesh.count = 0
            this.instancedMesh.instanceMatrix.needsUpdate = true
        }
    }

    dispose(): void {
        if (this.instancedMesh) {
            this.instancedMesh.geometry.dispose()
            if (Array.isArray(this.instancedMesh.material)) {
                this.instancedMesh.material.forEach(m => m.dispose())
            } else {
                this.instancedMesh.material.dispose()
            }
            this.instancedMesh = null
        }
        this.boundingBox = null
    }
}

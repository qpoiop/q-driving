import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader"

export class ResourceManager {
    private static instance: ResourceManager | null = null
    private textureLoader: THREE.TextureLoader
    private gltfLoader: GLTFLoader
    private dracoLoader: DRACOLoader
    private textures: Map<string, THREE.Texture> = new Map()
    private models: Map<string, THREE.Group> = new Map()
    private basePath: string = "/assets/"

    private constructor() {
        this.textureLoader = new THREE.TextureLoader()
        this.gltfLoader = new GLTFLoader()
        this.dracoLoader = new DRACOLoader()
        this.dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/")
        this.gltfLoader.setDRACOLoader(this.dracoLoader)

        // 디버깅을 위한 로그 추가
        console.log("ResourceManager initialized with basePath:", this.basePath)
    }

    public static getInstance(): ResourceManager {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager()
        }
        return ResourceManager.instance
    }

    public async initialize(): Promise<void> {
        console.log("ResourceManager initialized")
    }

    private getFullPath(path: string): string {
        // 이미 절대 경로인 경우 그대로 반환
        if (path.startsWith("/")) {
            return path
        }
        // 상대 경로인 경우 기본 경로와 결합
        return this.basePath + path
    }

    public async loadTexture(name: string, path: string): Promise<THREE.Texture> {
        if (this.textures.has(name)) {
            return this.textures.get(name)!
        }

        const fullPath = this.getFullPath(path)
        console.log(`Loading texture: ${fullPath}`)

        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                fullPath,
                texture => {
                    texture.wrapS = THREE.RepeatWrapping
                    texture.wrapT = THREE.RepeatWrapping
                    this.textures.set(name, texture)
                    resolve(texture)
                },
                undefined,
                error => {
                    console.error(`Failed to load texture: ${fullPath}`, error)
                    reject(error)
                },
            )
        })
    }

    public async loadModel(name: string, path: string): Promise<THREE.Group> {
        if (this.models.has(name)) {
            return this.models.get(name)!
        }

        const fullPath = this.getFullPath(path)
        console.log(`Loading model: ${fullPath}`)

        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                fullPath,
                gltf => {
                    console.log("Model loaded successfully:", gltf)
                    if (!gltf.scene) {
                        console.error("No scene in loaded model")
                        reject(new Error("No scene in loaded model"))
                        return
                    }
                    this.models.set(name, gltf.scene)
                    resolve(gltf.scene)
                },
                progress => {
                    console.log(`Loading progress: ${((progress.loaded / progress.total) * 100).toFixed(2)}%`)
                },
                error => {
                    console.error(`Failed to load model: ${fullPath}`, error)
                    reject(error)
                },
            )
        })
    }

    public getTexture(name: string): THREE.Texture | undefined {
        return this.textures.get(name)
    }

    public getModel(name: string): THREE.Group | undefined {
        return this.models.get(name)
    }

    public dispose(): void {
        this.textures.forEach(texture => texture.dispose())
        this.textures.clear()
        this.models.clear()
    }
}

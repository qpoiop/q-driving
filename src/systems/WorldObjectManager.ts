import { WorldObject } from "../entities/WorldObject"
import * as THREE from "three"

export class WorldObjectManager {
    private objects: WorldObject[] = []
    private scene: THREE.Scene
    private modelMap = new Map<string, THREE.Object3D>()

    constructor(scene: THREE.Scene) {
        this.scene = scene
    }

    public async add(type: "tree" | "rock", position: THREE.Vector3) {
        const path = type === "tree" ? "/assets/models/tree/scene.gltf" : "/assets/models/rock/scene.gltf"
        let model = this.modelMap.get(type)

        if (!model) {
            model = await WorldObject.loadModel(path)
            this.modelMap.set(type, model)
        }

        const object = new WorldObject(model, position)
        this.scene.add(object.getMesh())
        this.objects.push(object)
    }

    public isCollision(pos: THREE.Vector3): boolean {
        return this.objects.some(obj => obj.intersects(pos))
    }

    public clear() {
        for (const obj of this.objects) {
            this.scene.remove(obj.getMesh())
        }
        this.objects = []
    }
}

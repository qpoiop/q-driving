import { Entity } from "./Entity"

export class EntityManager {
    private entities: Map<string, Entity> = new Map()

    public async initialize(): Promise<void> {
        // 엔티티 초기화
        for (const entity of this.entities.values()) {
            await entity.initialize()
        }
    }

    public update(deltaTime: number): void {
        // 엔티티 업데이트 (원래 로직)
        for (const entity of this.entities.values()) {
            entity.update(deltaTime)
        }
    }

    public addEntity(entity: Entity): void {
        this.entities.set(entity.id, entity)
    }

    public removeEntity(entity: Entity): void {
        this.entities.delete(entity.id)
    }

    public getEntity(id: string): Entity | undefined {
        return this.entities.get(id)
    }

    public getAll(): Entity[] {
        return Array.from(this.entities.values())
    }

    public dispose(): void {
        // 엔티티 정리
        for (const entity of this.entities.values()) {
            entity.dispose()
        }
        this.entities.clear()
    }
}

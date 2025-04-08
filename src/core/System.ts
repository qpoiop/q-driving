import { EntityManager } from "./EntityManager"

export abstract class System {
    private _id: string
    protected entityManager: EntityManager | null = null

    constructor(id: string) {
        this._id = id
    }

    public get id(): string {
        return this._id
    }

    public setEntityManager(entityManager: EntityManager): void {
        this.entityManager = entityManager
    }

    public abstract initialize(): Promise<void>
    public abstract update(deltaTime: number): void
    public abstract dispose(): void
}

import { Entity } from "./Entity"

export abstract class Component {
    private _entity: Entity | null = null
    protected name: string

    constructor(name: string) {
        this.name = name
    }

    public get type(): string {
        return this.name
    }

    public get entity(): Entity | null {
        return this._entity
    }

    public setEntity(entity: Entity): void {
        this._entity = entity
    }

    public getName(): string {
        return this.name
    }

    public async initialize?(): Promise<void> {
        // 기본 구현은 비어있음
    }

    public update?(deltaTime: number): void {
        // 기본 구현은 비어있음
    }

    public dispose?(): void {
        // 기본 구현은 비어있음
    }
}

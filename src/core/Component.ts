import { Entity } from "./Entity"

export abstract class Component {
    protected entity: Entity | null = null
    public type: string

    constructor(type: string) {
        this.type = type
    }

    setEntity(entity: Entity): void {
        this.entity = entity
    }

    public async initialize?(): Promise<void> {}

    public update?(deltaTime: number): void {}

    public dispose?(): void {}
}

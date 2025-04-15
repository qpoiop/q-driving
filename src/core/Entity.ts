import { Component } from "./Component"

export abstract class Entity {
    private static nextId = 0
    private _id: string
    private _components: Map<string, Component>
    private _tags: Set<string>
    private _active: boolean

    constructor() {
        this._id = `entity_${Entity.nextId++}`
        this._components = new Map()
        this._tags = new Set()
        this._active = true
    }

    public get id(): string {
        return this._id
    }

    public addComponent(component: Component): void {
        if (this._components.has(component.type)) {
            console.warn(`Component of type ${component.type} already exists`)
            return
        }
        component.setEntity(this)
        this._components.set(component.type, component)
    }

    public removeComponent(type: string): void {
        const component = this._components.get(type)
        if (component) {
            component.dispose()
            this._components.delete(type)
        }
    }

    public getComponent<T extends Component>(type: string): T | undefined {
        return this._components.get(type) as T
    }

    public hasComponent(type: string): boolean {
        return this._components.has(type)
    }

    public addTag(tag: string): void {
        this._tags.add(tag)
    }

    public removeTag(tag: string): void {
        this._tags.delete(tag)
    }

    public hasTag(tag: string): boolean {
        return this._tags.has(tag)
    }

    public setActive(active: boolean): void {
        this._active = active
    }

    public isActive(): boolean {
        return this._active
    }

    public async initialize(): Promise<void> {
        for (const component of this._components.values()) {
            if (component.initialize) {
                await component.initialize()
            }
        }
    }

    public update(deltaTime: number): void {
        if (!this._active) return

        for (const component of this._components.values()) {
            if (typeof component.update === "function") {
                const componentUpdateLabel = `Component.update.${component.constructor.name}.${this.id}`
                console.time(componentUpdateLabel)
                component.update(deltaTime)
                console.timeEnd(componentUpdateLabel)
            }
        }
    }

    public dispose(): void {
        this._components.forEach(component => {
            if (component.dispose) {
                component.dispose()
            }
        })
        this._components.clear()
        this._tags.clear()
    }
}

import { System } from "./System"

export class SystemManager {
    private systems: Map<string, System> = new Map()

    public async initialize(): Promise<void> {
        // 시스템 초기화
        for (const system of this.systems.values()) {
            await system.initialize()
        }
    }

    public update(deltaTime: number): void {
        // 시스템 업데이트
        for (const system of this.systems.values()) {
            // const systemUpdateLabel = `System.update.${system.constructor.name}`
            // console.time(systemUpdateLabel)
            system.update(deltaTime)
            // console.timeEnd(systemUpdateLabel)
        }
    }

    public addSystem(system: System): void {
        this.systems.set(system.id, system)
    }

    public removeSystem(system: System): void {
        this.systems.delete(system.id)
    }

    public getSystem(id: string): System | undefined {
        return this.systems.get(id)
    }

    public dispose(): void {
        // 시스템 정리
        for (const system of this.systems.values()) {
            system.dispose()
        }
        this.systems.clear()
    }
}

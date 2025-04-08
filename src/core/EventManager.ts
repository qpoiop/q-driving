type EventHandler = (...args: any[]) => void

export class EventManager {
    private handlers: Map<string, Set<EventHandler>>

    constructor() {
        this.handlers = new Map()
    }

    public on(event: string, handler: EventHandler): void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set())
        }
        this.handlers.get(event)!.add(handler)
    }

    public off(event: string, handler: EventHandler): void {
        const handlers = this.handlers.get(event)
        if (handlers) {
            handlers.delete(handler)
            if (handlers.size === 0) {
                this.handlers.delete(event)
            }
        }
    }

    public emit(event: string, ...args: any[]): void {
        const handlers = this.handlers.get(event)
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(...args)
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error)
                }
            })
        }
    }

    public dispose(): void {
        this.handlers.clear()
    }
}

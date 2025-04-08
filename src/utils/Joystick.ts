export class Joystick {
    private force: number = 0
    private angle: number = 0

    constructor() {
        // 조이스틱 초기화
    }

    public getForce(): number {
        return this.force
    }

    public getAngle(): number {
        return this.angle
    }

    public setForce(force: number): void {
        this.force = force
    }

    public setAngle(angle: number): void {
        this.angle = angle
    }
}

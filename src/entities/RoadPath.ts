import * as THREE from "three"

export class RoadPath {
    private controlPoints: THREE.Vector3[]
    public curve: THREE.CatmullRomCurve3

    constructor(points?: THREE.Vector3[]) {
        this.controlPoints = points || this.getDefaultPoints()
        this.curve = new THREE.CatmullRomCurve3(this.controlPoints)
    }

    private getDefaultPoints(): THREE.Vector3[] {
        return [
            new THREE.Vector3(0, 0, -70),
            new THREE.Vector3(0, 0, -35),
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 25),
            new THREE.Vector3(0, 0, 50),
        ]
    }

    public getPoints(divisions = 100): THREE.Vector3[] {
        return this.curve.getPoints(divisions)
    }

    public getTangentAt(t: number): THREE.Vector3 {
        return this.curve.getTangent(t)
    }
}

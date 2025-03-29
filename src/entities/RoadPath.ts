import * as THREE from "three"

export class RoadPath {
    public curve: THREE.CatmullRomCurve3

    constructor(points?: THREE.Vector3[]) {
        const controlPoints = points || this.getDefaultPoints()
        this.curve = new THREE.CatmullRomCurve3(controlPoints)
    }

    private getDefaultPoints(): THREE.Vector3[] {
        return [
            new THREE.Vector3(0, 0, -100),
            new THREE.Vector3(0, 0, -50),
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 50),
            new THREE.Vector3(0, 0, 100),
            new THREE.Vector3(0, 0, 150),
        ]
    }
}

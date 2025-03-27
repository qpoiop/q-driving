import * as THREE from "three"

export class Terrain {
    public mesh: THREE.Mesh

    constructor() {
        const loader = new THREE.TextureLoader()

        // 텍스처 로드
        const albedo = loader.load(
            "/assets/textures/ground/default_ground_color.jpg",
            () => console.log("✅ Albedo loaded"),
            undefined,
            err => console.error("❌ Albedo load failed", err),
        )
        const normal = loader.load("/assets/textures/ground/default_ground_normal.jpg")
        const roughness = loader.load("/assets/textures/ground/default_ground_roughness.jpg")
        const aoMap = loader.load("/assets/textures/ground/default_ground_ambient_occlusion.jpg")

        // 반복 설정
        ;[albedo, normal, roughness, aoMap].forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping
            tex.repeat.set(200, 200)
            tex.center.set(0.5, 0.5) // rotation 대비 기준 중심
        })

        // Plane Geometry 생성
        const geometry = new THREE.PlaneGeometry(500, 500, 1, 1)
        geometry.rotateX(-Math.PI / 2)

        // ✅ AO Map에 필요한 uv2 설정
        geometry.setAttribute("uv2", new THREE.BufferAttribute(geometry.attributes.uv.array, 2))

        // 재질 구성
        const material = new THREE.MeshStandardMaterial({
            map: albedo,
            normalMap: normal,
            roughnessMap: roughness,
            aoMap: aoMap,
            metalness: 0,
            transparent: false,
        })

        // 메시 생성
        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.receiveShadow = true
        this.mesh.visible = true

        // 디버깅 출력
        console.log("✅ Terrain initialized")
    }
}

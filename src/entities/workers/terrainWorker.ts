// workers/terrainWorker.ts
import { createNoise2D } from "simplex-noise"

onmessage = e => {
    const { size, resolution, offsetX, offsetZ, heightScale, flattenWidth } = e.data
    const noise2D = createNoise2D()
    const data = new Float32Array((resolution + 1) * (resolution + 1))

    for (let z = 0; z <= resolution; z++) {
        for (let x = 0; x <= resolution; x++) {
            const worldX = (x / resolution - 0.5) * size + offsetX
            const worldZ = (z / resolution - 0.5) * size + offsetZ
            let y = noise2D(worldX * 0.01, worldZ * 0.01) * heightScale
            if (Math.abs(worldX) < flattenWidth) y *= 0.2
            data[z * (resolution + 1) + x] = y
        }
    }

    postMessage(data, [data.buffer])
}

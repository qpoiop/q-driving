import { PhysicsConfig } from "../components/PhysicsComponent"
import { SuspensionConfig } from "../components/SuspensionComponent"

export interface CarConfig {
    physics: PhysicsConfig
    suspension: SuspensionConfig
    driftFactor: number // 드리프트 계수
    rollInfluence: number // 롤 영향도
}

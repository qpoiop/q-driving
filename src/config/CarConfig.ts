import { PhysicsConfig } from "../components/PhysicsComponent"
import { SuspensionConfig } from "../components/SuspensionComponent"

export interface CarConfig {
    physics: PhysicsConfig
    suspension: SuspensionConfig
    maxSpeed: number
    acceleration: number
    deceleration: number
    turnSpeed: number
    grip: number // 도로 접지력
    driftFactor: number // 드리프트 계수
    suspensionStiffness: number // 서스펜션 강성
    suspensionDamping: number // 서스펜션 감쇠
    suspensionCompression: number // 서스펜션 압축
    suspensionRestLength: number // 서스펜션 기본 길이
    rollInfluence: number // 롤 영향도
}

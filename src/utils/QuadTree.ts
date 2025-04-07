export class Point {
    constructor(public x: number, public y: number, public data: number) {}
}

export class Box {
    constructor(public x: number, public y: number, public width: number, public height: number) {}

    contains(point: Point): boolean {
        return (
            point.x >= this.x - this.width / 2 &&
            point.x < this.x + this.width / 2 &&
            point.y >= this.y - this.height / 2 &&
            point.y < this.y + this.height / 2
        )
    }

    intersects(range: Box): boolean {
        return !(
            range.x - range.width / 2 > this.x + this.width / 2 ||
            range.x + range.width / 2 < this.x - this.width / 2 ||
            range.y - range.height / 2 > this.y + this.height / 2 ||
            range.y + range.height / 2 < this.y - this.height / 2
        )
    }
}

export class QuadTree {
    private points: Point[] = []
    private divided = false
    private northeast?: QuadTree
    private northwest?: QuadTree
    private southeast?: QuadTree
    private southwest?: QuadTree

    constructor(private boundary: Box, private capacity: number) {}

    insert(point: Point): boolean {
        if (!this.boundary.contains(point)) {
            return false
        }

        if (this.points.length < this.capacity && !this.divided) {
            this.points.push(point)
            return true
        }

        if (!this.divided) {
            this.subdivide()
        }

        return this.northeast!.insert(point) || this.northwest!.insert(point) || this.southeast!.insert(point) || this.southwest!.insert(point)
    }

    remove(point: Point): boolean {
        if (!this.boundary.contains(point)) {
            return false
        }

        // 현재 노드에서 점 찾기
        const index = this.points.findIndex(p => p.x === point.x && p.y === point.y && p.data === point.data)
        if (index !== -1) {
            this.points.splice(index, 1)
            return true
        }

        // 하위 트리에서 재귀적으로 검색
        if (this.divided) {
            return this.northeast!.remove(point) || this.northwest!.remove(point) || this.southeast!.remove(point) || this.southwest!.remove(point)
        }

        return false
    }

    query(range: Box, found: Point[] = []): Point[] {
        if (!this.boundary.intersects(range)) {
            return found
        }

        for (const point of this.points) {
            if (range.contains(point)) {
                found.push(point)
            }
        }

        if (this.divided) {
            this.northeast!.query(range, found)
            this.northwest!.query(range, found)
            this.southeast!.query(range, found)
            this.southwest!.query(range, found)
        }

        return found
    }

    private subdivide() {
        const x = this.boundary.x
        const y = this.boundary.y
        const w = this.boundary.width / 2
        const h = this.boundary.height / 2

        const ne = new Box(x + w / 2, y - h / 2, w, h)
        const nw = new Box(x - w / 2, y - h / 2, w, h)
        const se = new Box(x + w / 2, y + h / 2, w, h)
        const sw = new Box(x - w / 2, y + h / 2, w, h)

        this.northeast = new QuadTree(ne, this.capacity)
        this.northwest = new QuadTree(nw, this.capacity)
        this.southeast = new QuadTree(se, this.capacity)
        this.southwest = new QuadTree(sw, this.capacity)

        this.divided = true
    }
}

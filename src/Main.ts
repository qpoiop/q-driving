import "./style.css"
import { App } from "./App"

const container = document.getElementById("app")
if (container) {
    new App(container)
}

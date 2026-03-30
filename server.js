import { createApp } from "./app.js"
import { config } from "./config.js";


const port = config.port;

const app = createApp();

app.listen(port, () => {
  console.log(`app is running on http://localhost:${port}`)
})
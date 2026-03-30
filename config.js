import "dotenv/config";

export const config = {
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 4000),
    appName: process.env.APP_NAME || "Node Express Course",
    apiPrefix: process.env.API_PREFIX || "/api",
}


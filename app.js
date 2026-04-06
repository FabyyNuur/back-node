import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { initDb } from "./db.js";
import userRoutes from "./routes/user.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import clientRoutes from "./routes/client.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";

export function createApp(){
    // Initialisation de la base de données SQLite
    initDb();

    const app = express();
    // Évite 304 + reprise d'un vieux JSON sans les champs récents (ex. is_active)
    app.set("etag", false);

    // Middlewares globaux
    app.use(cors()); // Autorise les connexions depuis les fronts (React, Vue)
    app.use(express.json()); // Permet de lire le body des requêtes en JSON

    app.use(config.apiPrefix, (req, res, next) => {
      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("Pragma", "no-cache");
      next();
    });

    // Route racine (Home)
    app.get('/',(req, res)=>{
        return res.send(`
            <h1>Welcome to <code style='color:red'>Nuur GYM API</code></h1>
            <p>Environment: ${config.env}</p>
        `)
    });

    // Info route
    app.get('/info',(req, res)=>{
        return res.json({
            status: "ok",
            env: config.env,
            app: "Nuur GYM Platform",
            time: new Date().toISOString()
        })
    });

    // Enregistrement des routes de ressources
    app.use(`${config.apiPrefix}/users`, userRoutes);
    app.use(`${config.apiPrefix}/activities`, activityRoutes);
    app.use(`${config.apiPrefix}/clients`, clientRoutes);
    app.use(`${config.apiPrefix}/tickets`, ticketRoutes);
    app.use(`${config.apiPrefix}/dashboard`, dashboardRoutes);
    app.use(`${config.apiPrefix}/transactions`, transactionRoutes);

    return app;
}

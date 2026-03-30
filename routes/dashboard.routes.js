import { Router } from "express";
import dashboardCtrl from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const routes = Router();

// Endpoint pour le Gérant afin d'avoir une vue globale de haut niveau
routes.get("/", requireAuth, dashboardCtrl.getStats);

export default routes;

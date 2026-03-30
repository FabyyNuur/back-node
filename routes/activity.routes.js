import { Router } from "express";
import activityCtrl from "../controllers/activity.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const routes = Router();

// Tout le monde (authentifié, Gérant ou Contrôleur) peut voir les activités
routes.get("/", requireAuth, activityCtrl.list);
routes.get("/:id/details", requireAuth, activityCtrl.details);

// Seul l'admin (Gérant) peut gérer le catalogue d'activités
routes.post("/", requireAuth, requireAdmin, activityCtrl.add);
routes.put("/:id", requireAuth, requireAdmin, activityCtrl.update);
routes.delete("/:id", requireAuth, requireAdmin, activityCtrl.remove);

export default routes;

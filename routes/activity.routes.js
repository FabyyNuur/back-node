import { Router } from "express";
import activityCtrl from "../controllers/activity.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const routes = Router();

// Tout le monde (authentifié, Gérant ou Contrôleur) peut voir les activités
routes.get("/", requireAuth, activityCtrl.list);
routes.get("/:id", requireAuth, activityCtrl.getById);
routes.get("/:id/details", requireAuth, activityCtrl.details);
routes.get(
  "/:id/deactivate-impact",
  requireAuth,
  requireAdmin,
  activityCtrl.deactivateImpact,
);

// Seul l'admin (Gérant) peut gérer le catalogue d'activités
routes.post("/", requireAuth, requireAdmin, activityCtrl.add);
routes.put("/:id", requireAuth, requireAdmin, activityCtrl.update);
routes.delete("/:id", requireAuth, requireAdmin, activityCtrl.remove);

export default routes;

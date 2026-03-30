import { Router } from "express";
import clientCtrl from "../controllers/client.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const routes = Router();

// L'administration et le contrôleur peuvent gérer les clients
routes.get("/", requireAuth, clientCtrl.list);
routes.post("/", requireAuth, clientCtrl.add);
routes.put("/:id", requireAuth, clientCtrl.update);
routes.post("/:id/subscribe", requireAuth, clientCtrl.subscribe);
routes.get("/:id/history", requireAuth, clientCtrl.history);

export default routes;

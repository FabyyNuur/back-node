import { Router } from "express";
import userCtrl from "../controllers/user.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const routes = Router();

// Routes pour gérer les utilisateurs Nuur GYM
routes.get("/", requireAuth, requireAdmin, userCtrl.list);
routes.post("/", requireAuth, requireAdmin, userCtrl.add);
routes.put("/:id", requireAuth, requireAdmin, userCtrl.update);
routes.delete("/:id", requireAuth, requireAdmin, userCtrl.delete);
routes.post("/login", userCtrl.login);


export default routes;
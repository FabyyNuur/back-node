import { Router } from "express";
import transactionCtrl from "../controllers/transaction.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const routes = Router();

// Consulter les transactions (historique de caisse)
routes.get("/", requireAuth, transactionCtrl.list);

// Ajouter une dépense ou une recette manuelle (Caisse)
routes.post("/", requireAuth, requireAdmin, transactionCtrl.add);

export default routes;

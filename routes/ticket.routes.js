import { Router } from "express";
import ticketCtrl from "../controllers/ticket.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const routes = Router();

// Billetterie
routes.get("/", requireAuth, ticketCtrl.list);
routes.post("/generate", requireAuth, ticketCtrl.generate);
// Validation / Scanner QR Code
routes.post("/scan", requireAuth, ticketCtrl.validateQr);
// Historique des accès
routes.get("/logs", requireAuth, ticketCtrl.getLogs);

export default routes;

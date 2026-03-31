import { Router } from "express";
import userCtrl from "../controllers/user.controller.js";

const routes = Router();

// Routes pour gérer les utilisateurs Nuur GYM
routes.get("/", userCtrl.list);
routes.post("/", userCtrl.add);
routes.put("/:id", userCtrl.update);
routes.delete("/:id", userCtrl.delete);
routes.post("/login", userCtrl.login);


export default routes;
import { Router } from "express";
import userCtrl from "../controllers/user.controller.js";

const routes = Router();

// Routes pour gérer les utilisateurs Nuur GYM
routes.get("/", userCtrl.list);
routes.post("/", userCtrl.add);
routes.post("/login", userCtrl.login);


export default routes;
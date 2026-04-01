import jwt from "jsonwebtoken";
import db from "../db.js";

const SECRET_KEY = "SUPER_SECRET_NUUR_KEY";

export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Accès non autorisé. Token manquant." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const dbUser = db
            .prepare(`SELECT id, role, email, name, is_active FROM users WHERE id = ?`)
            .get(decoded.id);
        if (!dbUser || Number(dbUser.is_active) !== 1) {
            return res.status(401).json({ message: "Compte inactif ou introuvable." });
        }
        req.user = {
            id: dbUser.id,
            role: dbUser.role,
            email: dbUser.email,
            name: dbUser.name,
        };
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token invalide ou expiré." });
    }
};

export const requireAdmin = (req, res, next) => {
    const role = String(req.user?.role ?? "").toUpperCase();
    if (req.user && role === "ADMIN") {
        next();
    } else {
        return res.status(403).json({ message: "Accès refusé. Privilèges administrateur requis." });
    }
};

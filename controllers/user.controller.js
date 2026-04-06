import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db.js";

const SECRET_KEY = "SUPER_SECRET_NUUR_KEY";

const parseIsActiveFromBody = (value) => {
  if (value === false || value === 0 || value === "0") return 0;
  if (value === true || value === 1 || value === "1") return 1;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (t === "false" || t === "0" || t === "off" || t === "inactive") return 0;
    if (t === "true" || t === "1" || t === "on" || t === "active") return 1;
  }
  return null;
};

const parseRoleFromBody = (value) => {
  if (value === "ADMIN") return "ADMIN";
  if (value === "CAISSIER") return "CAISSIER";
  if (value === "CONTROLEUR") return "CONTROLEUR";
  return null;
};

const userCtrl = {
  list: (req, res) => {
    try {
      const rows = db
        .prepare(`SELECT id, email, name, role, is_active FROM users`)
        .all();
      const users = rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        is_active: u.is_active == null || Number(u.is_active) === 1 ? 1 : 0,
      }));
      return res.status(200).json({ data: users, count: users.length });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
  add: (req, res) => {
    const { email, password, name, role, is_active } = req.body;
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ message: "email, password, et name sont obligatoires" });
    }

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      let userRole = "CONTROLEUR";
      if (role === "ADMIN") userRole = "ADMIN";
      else if (role === "CAISSIER") userRole = "CAISSIER";

      const activeInsert = parseIsActiveFromBody(is_active);
      const result = db
        .prepare(
          `INSERT INTO users (email, password, name, role, is_active) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          email,
          hashedPassword,
          name,
          userRole,
          activeInsert === null ? 1 : activeInsert,
        );

      return res
        .status(201)
        .json({ message: "Utilisateur créé", id: result.lastInsertRowid });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Erreur (email potentiellement déjà pris)" });
    }
  },
  update: (req, res) => {
    const { id } = req.params;
    const { email, password, name, role, is_active } = req.body;

    try {
      const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
      if (!existing) {
        return res.status(404).json({ message: "Utilisateur introuvable." });
      }

      let nextIsActive =
        existing.is_active == null || Number(existing.is_active) === 1 ? 1 : 0;
      const parsedActive = parseIsActiveFromBody(is_active);
      if (Object.prototype.hasOwnProperty.call(req.body, "is_active")) {
        nextIsActive = parsedActive === null ? nextIsActive : parsedActive;
      }

      if (
        req.user &&
        Number(req.user.id) === Number(id) &&
        nextIsActive === 0
      ) {
        return res
          .status(400)
          .json({
            message: "Vous ne pouvez pas désactiver votre propre compte.",
          });
      }

      const nextEmail = Object.prototype.hasOwnProperty.call(req.body, "email")
        ? email
        : existing.email;
      const nextName = Object.prototype.hasOwnProperty.call(req.body, "name")
        ? name
        : existing.name;
      const parsedRole = parseRoleFromBody(role);
      const nextRole = Object.prototype.hasOwnProperty.call(req.body, "role")
        ? parsedRole === null
          ? existing.role
          : parsedRole
        : existing.role;

      let result;
      if (password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        result = db
          .prepare(
            `UPDATE users SET email = ?, password = ?, name = ?, role = ?, is_active = ? WHERE id = ?`,
          )
          .run(nextEmail, hashedPassword, nextName, nextRole, nextIsActive, id);
      } else {
        result = db
          .prepare(
            `UPDATE users SET email = ?, name = ?, role = ?, is_active = ? WHERE id = ?`,
          )
          .run(nextEmail, nextName, nextRole, nextIsActive, id);
      }
      if (result.changes === 0) {
        return res.status(404).json({ message: "Utilisateur introuvable." });
      }
      return res.status(200).json({ message: "Utilisateur mis à jour" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
  delete: (req, res) => {
    const { id } = req.params;
    try {
      db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
      return res.status(200).json({ message: "Utilisateur supprimé" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
  login: (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
      if (!user) {
        return res.status(401).json({ message: "Identifiants invalides" });
      }

      const isValidAuth = bcrypt.compareSync(password, user.password);
      if (!isValidAuth) {
        return res.status(401).json({ message: "Identifiants invalides" });
      }
      if (Number(user.is_active) !== 1) {
        return res
          .status(401)
          .json({ message: "Compte désactivé. Contactez un administrateur." });
      }

      // Générer le token JWT
      const token = jwt.sign(
        { id: user.id, role: user.role, email: user.email, name: user.name },
        SECRET_KEY,
        { expiresIn: "12h" },
      );

      return res.status(200).json({
        message: "Connexion réussie",
        token: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          is_active: user.is_active,
        },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
};

export default userCtrl;

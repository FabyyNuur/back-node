import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db.js";

const SECRET_KEY = "SUPER_SECRET_NUUR_KEY";

const userCtrl = {
    list: (req, res) => {
        try {
            const users = db.prepare(`SELECT id, email, name, role FROM users`).all();
            return res.status(200).json({ data: users, count: users.length });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    add: (req, res) => {
        const { email, password, name, role } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: "email, password, et name sont obligatoires" });
        }
        
        try {
            const hashedPassword = bcrypt.hashSync(password, 10);
            let userRole = 'CONTROLEUR';
            if (role === 'ADMIN') userRole = 'ADMIN';
            else if (role === 'CAISSIER') userRole = 'CAISSIER';
            
            const result = db.prepare(`INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)`).run(
                email, hashedPassword, name, userRole
            );
            
            return res.status(201).json({ message: "Utilisateur créé", id: result.lastInsertRowid });
        } catch (error) {
            return res.status(500).json({ error: "Erreur (email potentiellement déjà pris)" });
        }
    },
    update: (req, res) => {
        const { id } = req.params;
        const { email, password, name, role } = req.body;
        
        try {
            let userRole = 'CONTROLEUR';
            if (role === 'ADMIN') userRole = 'ADMIN';
            else if (role === 'CAISSIER') userRole = 'CAISSIER';

            if (password) {
                const hashedPassword = bcrypt.hashSync(password, 10);
                db.prepare(`UPDATE users SET email = ?, password = ?, name = ?, role = ? WHERE id = ?`).run(
                    email, hashedPassword, name, userRole, id
                );
            } else {
                db.prepare(`UPDATE users SET email = ?, name = ?, role = ? WHERE id = ?`).run(
                    email, name, userRole, id
                );
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
            
            // Générer le token JWT
            const token = jwt.sign(
                { id: user.id, role: user.role, email: user.email, name: user.name }, 
                SECRET_KEY, 
                { expiresIn: "12h" }
            );
            
            return res.status(200).json({ 
                message: "Connexion réussie",
                token: token,
                user: { id: user.id, email: user.email, name: user.name, role: user.role }
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

export default userCtrl;

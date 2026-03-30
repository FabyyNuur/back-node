import db from "../db.js";

const transactionCtrl = {
  list: (req, res) => {
    const { type, start_date, end_date } = req.query;
    try {
      let query = `SELECT * FROM transactions WHERE 1=1`;
      const params = [];

      if (type) {
        query += ` AND type = ?`;
        params.push(type);
      }
      if (start_date) {
        query += ` AND created_at >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        query += ` AND created_at <= ?`;
        params.push(end_date);
      }

      query += ` ORDER BY created_at DESC`;

      const transactions = db.prepare(query).all(...params);
      return res.status(200).json({ data: transactions });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  add: (req, res) => {
    const { amount, type, description, payment_method } = req.body;
    const normalizedType = String(type || "").toUpperCase();

    if (!amount || !normalizedType) {
      return res.status(400).json({
        message: "Le montant et le type (INCOME/EXPENSE) sont obligatoires.",
      });
    }

    if (!["INCOME", "EXPENSE"].includes(normalizedType)) {
      return res.status(400).json({
        message: "Type invalide. Valeurs attendues: INCOME ou EXPENSE.",
      });
    }

    try {
      const result = db
        .prepare(
          `
                INSERT INTO transactions (amount, type, description, payment_method)
                VALUES (?, ?, ?, ?)
            `,
        )
        .run(
          amount,
          normalizedType,
          description || null,
          payment_method || "cash",
        );

      const transaction = db
        .prepare(`SELECT * FROM transactions WHERE id = ?`)
        .get(result.lastInsertRowid);

      return res.status(201).json({
        message: "Transaction enregistrée",
        data: transaction,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
};

export default transactionCtrl;

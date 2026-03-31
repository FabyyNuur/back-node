import db from "../db.js";

const dashboardCtrl = {
  getStats: (req, res) => {
    try {
      const { period = "day" } = req.query;
      const now = new Date();
      let startOfPeriod, endOfPeriod;

      // Formatter pour SQLite (YYYY-MM-DD HH:MM:SS) - UTC par défaut
      const toSqlFormat = (date) => {
        return date.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
      };

      // Détermine la plage de dates selon la période choisie (Calculs en UTC)
      switch (period) {
        case "day":
          startOfPeriod = toSqlFormat(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)));
          endOfPeriod = toSqlFormat(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)));
          break;
        case "week":
          const day = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1; // Lundi = 0
          const monday = new Date(now);
          monday.setUTCDate(now.getUTCDate() - day);
          monday.setUTCHours(0, 0, 0, 0);
          startOfPeriod = toSqlFormat(monday);
          endOfPeriod = toSqlFormat(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)));
          break;
        case "month":
          startOfPeriod = toSqlFormat(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)));
          const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
          endOfPeriod = toSqlFormat(nextMonth);
          break;
        case "year":
          startOfPeriod = toSqlFormat(new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0)));
          endOfPeriod = toSqlFormat(new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59)));
          break;
        case "all":
          startOfPeriod = "1970-01-01 00:00:00";
          endOfPeriod = "2100-12-31 23:59:59";
          break;
        default:
          startOfPeriod = toSqlFormat(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)));
          endOfPeriod = toSqlFormat(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)));
      }

      console.log(`[Dashboard] Period: ${period}, Range: ${startOfPeriod} TO ${endOfPeriod}`);

      // 1. Revenus de la période (Insensible à la casse)
      const incomeRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME' AND created_at BETWEEN ? AND ?`,
        )
        .get(startOfPeriod, endOfPeriod);
      const periodIncome = incomeRow.sum || 0;

      // 2. Dépenses de la période (Insensible à la casse)
      const expenseRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'EXPENSE' AND created_at BETWEEN ? AND ?`,
        )
        .get(startOfPeriod, endOfPeriod);
      const periodExpense = expenseRow.sum || 0;

      // 3. Tickets vendus dans la période
      const ticketsSoldRow = db
        .prepare(
          `SELECT COUNT(*) as count FROM tickets WHERE created_at BETWEEN ? AND ?`,
        )
        .get(startOfPeriod, endOfPeriod);
      const ticketsSold = ticketsSoldRow.count || 0;

      // 4. Nouveaux Membres (inscriptions dans la période)
      const newMembersRow = db
        .prepare(
          `SELECT COUNT(*) as count FROM clients WHERE created_at BETWEEN ? AND ?`,
        )
        .get(startOfPeriod, endOfPeriod);
      const newMembers = newMembersRow.count || 0;

      // 5. Total Membres Actifs (Globalement)
      const activeMembersRow = db
        .prepare(
          `SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE status = 'ACTIVE' AND end_date >= ?`,
        )
        .get(toSqlFormat(new Date()));
      const activeMembers = activeMembersRow?.count || 0;

      // 6. Solde Caisse Global (Calculé sur TOUTES les transactions)
      const totalIncomeRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME'`,
        )
        .get();
      const totalExpenseRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'EXPENSE'`,
        )
        .get();
      const totalIncome = totalIncomeRow.sum || 0;
      const totalExpense = totalExpenseRow.sum || 0;
      const caisseBalance = totalIncome - totalExpense;

      // 7. Transactions récentes (10 dernières)
      const recentTransactions = db
        .prepare(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10`)
        .all();

      // 8. Historique Scanner QR d'Accès récents
      const recentLogs = db
        .prepare(`SELECT * FROM access_logs WHERE scanned_at BETWEEN ? AND ? ORDER BY scanned_at DESC LIMIT 5`)
        .all(startOfPeriod, endOfPeriod);

      // 9. Monthly Trends (Glissement des 6 derniers mois)
      const months = [
        "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"
      ];
      const monthlyLabels = [];
      const monthlyRevenues = [];
      const monthlyMembers = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        monthlyLabels.push(months[d.getUTCMonth()]);

        const startOfMonth = toSqlFormat(d);
        const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
        const endOfMonth = toSqlFormat(lastDay);

        const revRow = db
          .prepare(
            `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME' AND created_at BETWEEN ? AND ?`,
          )
          .get(startOfMonth, endOfMonth);
        monthlyRevenues.push(revRow.sum || 0);

        const memRow = db
          .prepare(
            `SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE start_date <= ? AND end_date >= ?`,
          )
          .get(endOfMonth, startOfMonth);
        monthlyMembers.push(memRow?.count || 0);
      }

      // 10. Weekly Stats
      const weeklyStats = [0, 0, 0, 0, 0, 0, 0];
      const currentDayW = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1;
      const startOfWeekUTC = new Date(now);
      startOfWeekUTC.setUTCDate(now.getUTCDate() - currentDayW);
      startOfWeekUTC.setUTCHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const dStart = new Date(startOfWeekUTC);
        dStart.setUTCDate(startOfWeekUTC.getUTCDate() + i);
        const dEnd = new Date(dStart);
        dEnd.setUTCHours(23, 59, 59, 999);

        const row = db
          .prepare(
            `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME' AND created_at BETWEEN ? AND ?`,
          )
          .get(toSqlFormat(dStart), toSqlFormat(dEnd));
        weeklyStats[i] = row.sum || 0;
      }
      const maxWeekly = Math.max(...weeklyStats, 1);
      const weeklyStatsPercentages = weeklyStats.map((v) =>
        Math.round((v / maxWeekly) * 100),
      );

      return res.status(200).json({
        stats: {
          periodIncome,
          periodExpense,
          ticketsSold,
          newMembers,
          activeMembers,
          totalIncome,
          caisseBalance,
          period
        },
        recentTransactions,
        recentLogs,
        chartData: {
          monthly: {
            labels: monthlyLabels,
            revenues: monthlyRevenues,
            members: monthlyMembers,
          },
          weekly: weeklyStatsPercentages,
          weeklyRaw: weeklyStats
        },
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      return res.status(500).json({ error: error.message });
    }
  },
};

export default dashboardCtrl;

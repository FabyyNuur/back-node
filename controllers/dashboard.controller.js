import db from "../db.js";

const dashboardCtrl = {
  getStats: (req, res) => {
    try {
      const today = new Date();
      const todayDate = today.toISOString().split("T")[0]; // Format: YYYY-MM-DD

      // 1. Revenus du jour (income today)
      const incomeTodayRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE type = 'INCOME' AND DATE(created_at) = ?`,
        )
        .get(todayDate);
      const incomeToday = incomeTodayRow.sum || 0;

      // 2. Tickets vendus jour J
      const ticketsSoldRow = db
        .prepare(
          `SELECT COUNT(*) as count FROM tickets WHERE DATE(created_at) = ?`,
        )
        .get(todayDate);
      const ticketsSoldToday = ticketsSoldRow.count;

      // 3. Membres Actifs
      const activeMembersRow = db
        .prepare(
          `SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE status = 'ACTIVE' AND end_date >= ?`,
        )
        .get(new Date().toISOString());
      const activeMembers = activeMembersRow.count;

      // 4. Solde Caisse Global
      const totalIncomeRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE type = 'INCOME'`,
        )
        .get();
      const totalExpenseRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE type = 'EXPENSE'`,
        )
        .get();
      const totalIncome = totalIncomeRow.sum || 0;
      const totalExpense = totalExpenseRow.sum || 0;
      const caisseBalance = totalIncome - totalExpense;

      // 5. Transactions récentes
      const recentTransactions = db
        .prepare(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10`)
        .all();

      // 6. Historique Scanner QR d'Accès récents
      const recentLogs = db
        .prepare(`SELECT * FROM access_logs ORDER BY scanned_at DESC LIMIT 3`)
        .all();

      // 7. Monthly Trends
      const months = [
        "Jan",
        "Fév",
        "Mar",
        "Avr",
        "Mai",
        "Juin",
        "Juil",
        "Aoû",
        "Sep",
        "Oct",
        "Nov",
        "Déc",
      ];
      const monthlyLabels = [];
      const monthlyRevenues = [];
      const monthlyMembers = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthlyLabels.push(months[d.getMonth()]);

        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];

        const revRow = db
          .prepare(
            `SELECT SUM(amount) as sum FROM transactions WHERE type = 'INCOME' AND DATE(created_at) >= ? AND DATE(created_at) <= ?`,
          )
          .get(startOfMonth, endOfMonth);
        monthlyRevenues.push(revRow.sum || 0);

        const memRow = db
          .prepare(
            `SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE DATE(start_date) <= ? AND DATE(end_date) >= ?`,
          )
          .get(endOfMonth, startOfMonth);
        monthlyMembers.push(memRow.count || 0);
      }

      // 8. Weekly Stats
      const weeklyStats = [0, 0, 0, 0, 0, 0, 0];
      const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - currentDay);
      startOfWeek.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(startOfWeek);
        dayStart.setDate(startOfWeek.getDate() + i);

        if (dayStart <= now) {
          const dayStr = dayStart.toISOString().split("T")[0];
          const row = db
            .prepare(
              `SELECT SUM(amount) as sum FROM transactions WHERE type = 'INCOME' AND DATE(created_at) = ?`,
            )
            .get(dayStr);
          weeklyStats[i] = row.sum || 0;
        }
      }
      const maxWeekly = Math.max(...weeklyStats, 1);
      const weeklyStatsPercentages = weeklyStats.map((v) =>
        Math.round((v / maxWeekly) * 100),
      );

      return res.status(200).json({
        stats: {
          incomeToday,
          ticketsSoldToday,
          activeMembers,
          totalIncome,
          caisseBalance,
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
        },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
};

export default dashboardCtrl;
